#!/usr/bin/env bash
set -Eeuo pipefail

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Installing resolver dependencies..."
npm ci --prefix backend/resolver

echo "Installing frontend dependencies..."
npm ci --prefix rhymic-react

echo "Building React frontend..."
npm run build --prefix rhymic-react

echo "Running database migrations..."
flask db upgrade

echo "Build complete."
