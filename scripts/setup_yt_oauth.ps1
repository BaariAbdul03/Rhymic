# ─── RhyMic YouTube OAuth Credential Setup (Windows PowerShell) ────────────
# Run this ONCE on your local machine to generate YouTube OAuth credentials.
# The output is a Base64-encoded JSON string you save as YT_OAUTH_CREDENTIALS.
#
# Usage: .\scripts\setup_yt_oauth.ps1
# Requirements: Node.js >= 18
# ────────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     RhyMic — YouTube OAuth Credential Setup                     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Check Node.js ──────────────────────────────────────────────────────────
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "not found" }
    $majorVersion = [int]($nodeVersion -replace 'v','' -split '\.')[0]
    if ($majorVersion -lt 18) {
        Write-Host "❌ Node.js >= 18 required. Found: $nodeVersion" -ForegroundColor Red
        Write-Host "   Upgrade at: https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Install Node.js >= 18 and try again." -ForegroundColor Red
    Write-Host "   https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

Write-Host "⚠️  IMPORTANT: Use a BURNER Google account, not your personal one!" -ForegroundColor Yellow
Write-Host "   YouTube may restrict accounts used for API automation."
Write-Host ""

# Output file in current directory (persists after script exits)
$outputFile = Join-Path (Get-Location) "YT_OAUTH_CREDENTIALS.txt"
$env:OUTPUT_FILE = $outputFile

# Create temp directory
$tmpDir = Join-Path $env:TEMP "rhymic-oauth-$(Get-Random)"
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

try {
    Push-Location $tmpDir

    Write-Host "📦 Initializing Node.js project..."
    npm init -y --silent 2>$null
    npm install youtubei.js@latest --silent 2>$null

    Write-Host ""

    # Create the OAuth setup script
    $scriptContent = @'
import { Innertube } from 'youtubei.js';

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

  youtube.session.on('auth', async ({ credentials }) => {
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

    const outputPath = process.env.OUTPUT_FILE;
    if (outputPath) {
      const fs = await import('fs');
      fs.writeFileSync(outputPath, b64);
      console.log(`📄 Saved to: ${outputPath}`);
    }
    console.log('');
    console.log('🔄 Keeping session alive for token refresh... (Ctrl+C to exit)');
  });

  youtube.session.on('update-credentials', async ({ credentials }) => {
    const b64 = Buffer.from(JSON.stringify(credentials)).toString('base64');
    console.log('');
    console.log('🔄 Credentials refreshed! Updated value:');
    console.log(b64);
    console.log('');
    const outputPath = process.env.OUTPUT_FILE;
    if (outputPath) {
      const fs = await import('fs');
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
      process.exit(1);
    }
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
'@

    Set-Content -Path "oauth_setup.mjs" -Value $scriptContent -Encoding UTF8

    Write-Host "🚀 Starting OAuth device flow..." -ForegroundColor Green
    Write-Host ""

    node oauth_setup.mjs

    Write-Host ""
    Write-Host "📁 Credentials file: $outputFile" -ForegroundColor Green
    Write-Host "   (Keep this file safe — it contains your YouTube OAuth tokens!)" -ForegroundColor Yellow

} finally {
    Pop-Location
    Remove-Item -Recurse -Force $tmpDir -ErrorAction SilentlyContinue
}
