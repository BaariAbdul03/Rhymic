#!/usr/bin/env python3
"""Drift-aware database migration runner (invoked by build.sh on Render).

A bare `flask db upgrade` fails when the database schema already exists but
the alembic_version table is missing or behind — e.g. the schema was created
by db.create_all() on app startup, or restored from a pg_dump without the
version table. Alembic then replays old migrations against an already-current
schema and crashes on the first redundant ALTER TABLE (DuplicateColumn).

This runner resolves the state explicitly before touching anything:

    1. alembic_version present   -> normal upgrade() (the standard path)
    2. unversioned legacy song schema -> run the guarded revision chain
    3. current or fresh schema -> create missing tables, verify, and stamp head

It also tolerates Neon cold starts by waiting for the database to answer
before importing backend.config, which hard-fails in production when the
configured DATABASE_URL is unreachable.

Usage: python scripts/run_migrations.py
"""
import os
import sys
import time
from contextlib import closing

from dotenv import load_dotenv

# Make repo-root imports work regardless of the caller's cwd.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def wait_for_database(max_wait=45):
    """Ping the database until it answers, so a suspended Neon compute can
    wake up before config.py performs its own (single-attempt) check."""
    url = os.environ.get("DATABASE_URL", "")
    if not url or url.startswith("sqlite"):
        return
    try:
        import psycopg2
        from sqlalchemy.engine import make_url
    except ImportError:
        return  # config.py will report the connection problem itself
    url = make_url(url).set(drivername="postgresql").render_as_string(hide_password=False)

    deadline = time.time() + max_wait
    attempt = 0
    while True:
        attempt += 1
        try:
            with closing(psycopg2.connect(url, connect_timeout=10)) as conn, conn.cursor() as cur:
                cur.execute("SELECT 1")
            print(f"[migrate] database reachable (attempt {attempt})")
            return
        except Exception as exc:
            if time.time() >= deadline:
                print(f"[migrate] database still unreachable after {max_wait}s "
                      f"({type(exc).__name__}); continuing — config will validate")
                return
            print(f"[migrate] database waking up (attempt {attempt})...")
            time.sleep(5)


def main():
    load_dotenv()
    if direct_url := os.getenv("DATABASE_URL_UNPOOLED"):
        os.environ["DATABASE_URL"] = direct_url
    wait_for_database()

    from flask import Flask
    from sqlalchemy import inspect, text

    from backend.config import config
    from backend.extensions import db, migrate
    import backend.models  # Register tables on metadata.

    # Minimal app: extensions only. Do NOT use create_app() here — it would
    # register routes, run scan_library() and create_all(), none of which
    # belong in a build step.
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    config_name = os.getenv("FLASK_CONFIG", "production")
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    db.init_app(app)
    # Absolute migrations dir: Flask(__name__) as __main__ has an unreliable
    # root_path, so never let flask-migrate resolve a relative one.
    migrate.init_app(app, db, directory=os.path.join(repo_root, "migrations"))

    from flask_migrate import stamp as fm_stamp, upgrade as fm_upgrade

    with app.app_context():
        inspector = inspect(db.engine)
        tables = set(inspector.get_table_names())

        version_rows = []
        if "alembic_version" in tables:
            with db.engine.connect() as conn:
                version_rows = [
                    row[0]
                    for row in conn.execute(text("SELECT version_num FROM alembic_version"))
                ]

        if len(version_rows) > 1:
            print(f"[migrate] ERROR: branching alembic_version rows: {version_rows}")
            print("[migrate] resolve manually with `flask db stamp <revision>`")
            return 1

        if version_rows:
            print(f"[migrate] alembic_version at {version_rows[0]} — running upgrades")
            fm_upgrade()
        elif "song" in tables and not {"youtube_id", "source"} <= {
            column["name"] for column in inspector.get_columns("song")
        }:
            print("[migrate] unversioned legacy catalog — running upgrades")
            fm_upgrade()

        db.create_all()
        inspector = inspect(db.engine)
        for table in db.metadata.sorted_tables:
            actual = {column["name"] for column in inspector.get_columns(table.name)}
            if missing := set(table.columns.keys()) - actual:
                print(f"[migrate] {table.name} is missing expected columns: {', '.join(sorted(missing))}")
                return 1

        if not version_rows:
            fm_stamp(revision="head")
        print("[migrate] done — database schema is up to date")
    return 0


if __name__ == "__main__":
    sys.exit(main())
