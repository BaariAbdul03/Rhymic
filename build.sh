#!/usr/bin/env bash
set -Eeuo pipefail

echo "Installing Python dependencies..."
pip install -r requirements.txt

case "${ONLINE_STREAM_PROVIDER:-embed}" in
  extractor|auto|resolver)
    echo "Installing legacy resolver dependencies..."
    npm ci --prefix backend/resolver
    ;;
esac

echo "Installing frontend dependencies..."
# Use npm install instead of ci because the lockfile doesn't match
# package.json (test dependencies were added without updating lock).
npm ci --prefix rhymic-react

echo "Building React frontend..."
npm run build --prefix rhymic-react

echo "Running database migrations..."
# Drift-aware runner: stamps databases whose schema already exists without
# an alembic_version row (create_all / restored dumps) instead of failing
# with DuplicateColumn errors. See scripts/run_migrations.py.
python scripts/run_migrations.py

echo "Build complete."
