#!/usr/bin/env bash
set -Eeuo pipefail

echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Installing resolver dependencies..."
npm ci --prefix backend/resolver

echo "Installing frontend dependencies..."
# Use npm install instead of ci because the lockfile doesn't match
# package.json (test dependencies were added without updating lock).
npm install --prefix rhymic-react

echo "Building React frontend..."
npm run build --prefix rhymic-react

echo "Running database migrations..."
flask db upgrade

echo "Build complete."

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  📋 Post-Build Notes                                           ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "  To enable YouTube streaming on Render:"
echo ""
echo "  1. Set YT_OAUTH_CREDENTIALS env var:"
echo "     Run 'bash scripts/setup_yt_oauth.sh' locally, then paste"
echo "     the Base64 output into Render's dashboard."
echo ""
echo "  2. To enable WARP IP bypass (optional):"
echo "     Set WARP_ENABLED=true and WARP_MODE=wireproxy"
echo "     The wireproxy binary will be downloaded at runtime."
echo ""
echo "  3. Current stream provider: ${ONLINE_STREAM_PROVIDER:-piped}"
echo ""
