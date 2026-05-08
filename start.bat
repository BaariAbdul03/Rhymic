@echo off
title RhyMic Launcher
color 0A

echo.
echo  =============================================
echo     RHYMIC - Starting Development Servers
echo  =============================================
echo.

:: ── Check if we're in the right directory ───────────────────────────────────
if not exist "app.py" (
    echo  [ERROR] Run this file from the project root ^(where app.py is^).
    pause
    exit /b 1
)

if not exist "rhymic-react\package.json" (
    echo  [ERROR] React folder not found. Check rhymic-react directory.
    pause
    exit /b 1
)

echo  [1/2] Starting Flask Backend on http://localhost:5000 ...
start "RhyMic Backend (Flask)" cmd /k "title RhyMic Backend (Flask) && color 0B && .venv\Scripts\activate && python app.py"

:: ── Wait until Flask is actually responding before launching React ──────────
echo.
echo  Waiting for Flask to be ready...
:WAIT_LOOP
timeout /t 1 /nobreak >nul
curl -s http://localhost:5000/api/songs/?page=1^&limit=1 >nul 2>&1
if %errorlevel% neq 0 (
    set /p DUMMY="  Still waiting for backend." <nul
    echo  .
    goto WAIT_LOOP
)
echo  Flask is ready!
echo.

echo  [2/2] Starting React Frontend on http://localhost:5173 ...
start "RhyMic Frontend (React)" cmd /k "title RhyMic Frontend (React) && color 0E && cd rhymic-react && npm run dev"

:: ── Open the application in the default browser ──────────────────────────
echo.
echo  Opening RhyMic in your browser...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo  =============================================
echo     Both servers are now running!
echo     Backend  -> http://localhost:5000
echo     Frontend -> http://localhost:5173
echo  =============================================
echo.
echo  You can close THIS window. The two server
echo  windows will keep running.
echo.
pause
