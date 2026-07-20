#!/usr/bin/env bash
# ─── RhyMic YouTube OAuth Credential Setup ─────────────────────────────────────
# Run this ONCE on your local machine to generate YouTube OAuth credentials.
# The output is a Base64-encoded JSON string you save as YT_OAUTH_CREDENTIALS.
#
# Usage: bash scripts/setup_yt_oauth.sh
# Requirements: Node.js >= 18
# ────────────────────────────────────────────────────────────────────────────────
set -Eeuo pipefail

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║     RhyMic — YouTube OAuth Credential Setup                     ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# ── Check Node.js ─────────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed. Install Node.js >= 18 and try again."
  echo "   https://nodejs.org/"
  exit 1
fi

NODE_VERSION=$(node -e "console.log(process.version.slice(1).split('.')[0])" 2>/dev/null || echo "0")
if [ "$NODE_VERSION" -lt 18 ] 2>/dev/null; then
  echo "❌ Node.js >= 18 required. Found: $(node --version)"
  echo "   Upgrade at: https://nodejs.org/"
  exit 1
fi
echo "✅ Node.js $(node --version)"
echo ""

echo "⚠️  IMPORTANT: Use a BURNER Google account, not your personal one!"
echo "   YouTube may restrict accounts used for API automation."
echo ""

# Output file in current directory (persists after script exits)
OUTPUT_FILE="$(pwd)/YT_OAUTH_CREDENTIALS.txt"

# Create temp directory for the setup script
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

cd "$TMP_DIR"

echo "📦 Initializing Node.js project..."
npm init -y --silent 2>/dev/null
npm install youtubei.js@latest --silent 2>/dev/null

echo ""

# Create the OAuth script
cat > oauth_setup.mjs << 'SCRIPT'
import { Innertube } from 'youtubei.js';
import fs from 'fs';

async function run() {
  const youtube = await Innertube.create({
    client_type: 'TV_EMBEDDED',
    generate_session_locally: true,
  });

  let resolved = false;

  youtube.session.on('auth-pending', (data) => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║              🔐 ACTION REQUIRED — Authorize YouTube!            ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('   1. Open this URL in your browser:');
    console.log(`      ${data.verification_url}`);
    console.log('');
    console.log('   2. Sign in with your BURNER Google account');
    console.log('');
    console.log('   3. Enter this code:');
    console.log(`      ${data.user_code}`);
    console.log('');
    console.log('⏳ Waiting for you to complete the authorization...');
    console.log('');
  });

  youtube.session.on('auth', ({ credentials }) => {
    if (resolved) return;
    resolved = true;
    console.log('');
    console.log('✅ Authorization successful!');
    console.log('');
    const b64 = Buffer.from(JSON.stringify(credentials)).toString('base64');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║  🔑 YOUR YT_OAUTH_CREDENTIALS (Save this!)                      ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(b64);
    console.log('');
    console.log('────────────────────────────────────────────────────────────────');
    console.log('  Add this to your Render environment variables as:');
    console.log('  YT_OAUTH_CREDENTIALS');
    console.log('────────────────────────────────────────────────────────────────');
    console.log('');

    // Also save to OUTPUT_FILE path (passed as env var from parent script)
    const outputPath = process.env.OUTPUT_FILE;
    if (outputPath) {
      fs.writeFileSync(outputPath, b64);
      console.log(`📄 Saved to: ${outputPath}`);
    }
    console.log('');

    // Keep running to allow token refresh
    console.log('🔄 Keeping session alive for token refresh... (Ctrl+C to exit)');
    console.log('');
  });

  youtube.session.on('update-credentials', ({ credentials }) => {
    const b64 = Buffer.from(JSON.stringify(credentials)).toString('base64');
    console.log('');
    console.log('🔄 Credentials refreshed! Updated value:');
    console.log(b64);
    console.log('');

    // Update the saved file
    const outputPath = process.env.OUTPUT_FILE;
    if (outputPath) {
      fs.writeFileSync(outputPath, b64);
      console.log(`📄 Updated: ${outputPath}`);
    }
  });

  try {
    await youtube.session.signIn();
  } catch (err) {
    if (!resolved) {
      console.error('');
      console.error('❌ OAuth flow failed:', err.message);
      console.error('');
      console.error('  Possible issues:');
      console.error('  - No internet connection');
      console.error('  - YouTube is blocking your IP');
      console.error('  - youtubei.js version mismatch');
      console.error('');
      process.exit(1);
    }
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
SCRIPT

export OUTPUT_FILE
echo "🚀 Starting OAuth device flow..."
echo ""

node oauth_setup.mjs

echo ""
echo "📁 Credentials file: ${OUTPUT_FILE}"
echo "   (Keep this file safe — it contains your YouTube OAuth tokens!)"
echo ""
