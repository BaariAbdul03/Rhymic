@echo off
title RhyMic Supabase Keep-Alive Installer
echo ============================================================
echo   RhyMic Enterprise -- Scheduled Task installer
echo ============================================================
echo.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_keepalive_task.ps1"
echo.
echo ============================================================
pause
