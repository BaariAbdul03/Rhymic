#!/usr/env bash
set -o errexit

echo "Installing Python Dependencies..."
pip install -r requirements.txt

echo "Running Database Migrations..."
flask db upgrade

echo "Building React Frontend..."
cd rhymic-react
npm install
npm run build
cd ..

echo "Build Complete!"
