#!/usr/bin/env bash
set -o errexit

echo "Installing Python Dependencies..."
pip install -r requirements.txt
pip install --upgrade yt-dlp

echo "Running Database Migrations..."
flask db upgrade

echo "Building React Frontend..."
cd rhymic-react
npm install
npm run build
cd ..

echo "Build Complete!"
