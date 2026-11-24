#!/usr/bin/env python3
"""Drift-aware database migration runner (invoked by build.sh on Render).

A bare `flask db upgrade` fails when the database schema already exists but
the alembic_version table is missing or behind — e.g. the schema was created
by db.create_all() on app startup, or restored from a pg_dump without the
version table. Alembic then replays old migrations against an already-current
schema and crashes on the first redundant ALTER TABLE (DuplicateColumn).

This runner resolves the state explicitly before touching anything:

    1. alembic_version present   -> normal upgrade() (the standard path)
    2. missing, app tables exist -> stamp('head') then upgrade()
       (schema was created by create_all() or restored from a dump and is
        already at the current model state)
    3. missing, no app tables    -> create_all() + stamp('head')
       (mirrors first-boot provisioning so builds never depend on boot order)

It also tolerates Neon cold starts by waiting for the database to answer
before importing backend.config, which hard-fails in production when the
configured DATABASE_URL is unreachable.

Usage: python scripts/run_migrations.py
"""
import os
import sys
import time

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
    except ImportError:
        return  # config.py will report the connection problem itself

    deadline = time.time() + max_wait
    attempt = 0
    while True:
        attempt += 1
        try:
            conn = psycopg2.connect(url, connect_timeout=10)
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            conn.close()
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
    wait_for_database()

    from flask import Flask
    from sqlalchemy import inspect, text

    from backend.config import config
    from backend.extensions import db, migrate

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
        elif tables:
            print("[migrate] schema exists without alembic_version — "
                  "stamping head (schema was created by create_all or a dump)")
            fm_stamp(revision="head")
        else:
            print("[migrate] empty database — provisioning schema via create_all "
                  "and stamping head")
            import backend.models  # noqa: F401  (register models on metadata)
            db.create_all()
            fm_stamp(revision="head")

        fm_upgrade()
        print("[migrate] done — database schema is up to date")
    return 0


if __name__ == "__main__":
    sys.exit(main())
