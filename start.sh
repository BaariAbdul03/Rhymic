#!/usr/bin/env bash
# Rhymic Unified Start Script
# 1. Start the internal resolver in the background
echo "Starting internal Node.js resolver..."
cd backend/resolver && node server.js &
cd ../..

# 2. Start the Flask application
echo "Starting Flask Backend..."
gunicorn app:app --workers 2 --timeout 120
