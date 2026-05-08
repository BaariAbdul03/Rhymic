# RhyMic PowerShell Launcher
# Run with: .\start.ps1

$Host.UI.RawUI.WindowTitle = "RhyMic Launcher"

Write-Host ""
Write-Host "  =============================================" -ForegroundColor Cyan
Write-Host "     RHYMIC - Starting Development Servers    " -ForegroundColor Cyan
Write-Host "  =============================================" -ForegroundColor Cyan
Write-Host ""

# ── Sanity Checks ──────────────────────────────────────────────────────────
if (-not (Test-Path "app.py")) {
    Write-Host "  [ERROR] Run this file from the project root (where app.py is)." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

if (-not (Test-Path "rhymic-react\package.json")) {
    Write-Host "  [ERROR] React folder not found. Check rhymic-react directory." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# ── Start Flask Backend ────────────────────────────────────────────────────
Write-Host "  [1/2] Starting Flask Backend on http://localhost:5000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList `
    "-NoExit", "-Command", `
    "`$Host.UI.RawUI.WindowTitle = 'RhyMic Backend (Flask)'; " + `
    ".\.venv\Scripts\Activate.ps1; " + `
    "python app.py"

# ── Poll until Flask is actually responding ────────────────────────────────
Write-Host ""
Write-Host "  Waiting for Flask to be ready..." -ForegroundColor Gray
$flaskReady = $false
while (-not $flaskReady) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/api/songs/?page=1&limit=1" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        $flaskReady = $true
    } catch {
        Write-Host "  . still waiting..." -ForegroundColor DarkGray
    }
}
Write-Host "  Flask is ready!" -ForegroundColor Green
Write-Host ""

# ── Start React Frontend ───────────────────────────────────────────────────
Write-Host "  [2/2] Starting React Frontend on http://localhost:5173 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList `
    "-NoExit", "-Command", `
    "`$Host.UI.RawUI.WindowTitle = 'RhyMic Frontend (React)'; " + `
    "Set-Location rhymic-react; " + `
    "npm run dev"

# ── Open the application in the default browser ──────────────────────────
Write-Host ""
Write-Host "  Opening RhyMic in your browser..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "  =============================================" -ForegroundColor Cyan
Write-Host "     Both servers are now running!" -ForegroundColor Cyan
Write-Host "     Backend  -> http://localhost:5000" -ForegroundColor Green
Write-Host "     Frontend -> http://localhost:5173" -ForegroundColor Yellow
Write-Host "  =============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  You can close THIS window. The two server" -ForegroundColor Gray
Write-Host "  windows will keep running." -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to close this launcher"
