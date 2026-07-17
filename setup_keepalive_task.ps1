# RhyMic Supabase Keep-Alive Scheduled Task Setup
# This script registers a daily Windows Scheduled Task that pings the Supabase database.

$ProjectRoot = (Get-Item -Path ".").FullName
$PythonPath = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$ScriptPath = Join-Path $ProjectRoot "keep_alive.py"

# Validate environment
if (-not (Test-Path $PythonPath)) {
    Write-Error "Could not find Python executable at: $PythonPath. Please run backend installation steps first."
    Exit 1
}

if (-not (Test-Path $ScriptPath)) {
    Write-Error "Could not find keep_alive.py at: $ScriptPath."
    Exit 1
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   RhyMic Enterprise -- Register Daily Keep-Alive Task" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Project Directory: $ProjectRoot" -ForegroundColor Gray

# Define Task Action (uses cmd.exe to handle output redirection to a log file)
$CmdPath = "cmd.exe"
$CmdArgs = "/c `".venv\Scripts\python.exe keep_alive.py >> keep_alive.log 2>&1`""
$Action = New-ScheduledTaskAction -Execute $CmdPath -Argument $CmdArgs -WorkingDirectory $ProjectRoot

# Define Task Trigger (runs daily at 12:00 PM noon)
$Trigger = New-ScheduledTaskTrigger -Daily -At "12:00 PM"

# Define Task Settings (Start when available, run on battery)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Register Scheduled Task
try {
    Register-ScheduledTask -TaskName "RhyMicSupabaseKeepAlive" -Action $Action -Trigger $Trigger -Settings $Settings -Description "Runs the RhyMic database and storage keep-alive daily to prevent Supabase projects from going to sleep." -Force
    
    Write-Host ""
    Write-Host "[SUCCESS] Windows Scheduled Task 'RhyMicSupabaseKeepAlive' registered!" -ForegroundColor Green
    Write-Host "  * Executable : cmd.exe" -ForegroundColor Gray
    Write-Host "  * Arguments  : $CmdArgs" -ForegroundColor Gray
    Write-Host "  * Work Dir   : $ProjectRoot" -ForegroundColor Gray
    Write-Host "  * Schedule   : Daily at 12:00 PM (will catch up if missed)" -ForegroundColor Gray
    Write-Host "  * Log File   : keep_alive.log (in project root)" -ForegroundColor Gray
    
    # Run the task once immediately to test and verify
    Write-Host ""
    Write-Host "Executing task immediately to verify registration..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName "RhyMicSupabaseKeepAlive"
    
    Start-Sleep -Seconds 3
    
    $Task = Get-ScheduledTask -TaskName "RhyMicSupabaseKeepAlive"
    Write-Host "Task State   : $($Task.State)" -ForegroundColor Green
    
    if (Test-Path "keep_alive.log") {
        Write-Host "Log file successfully created at keep_alive.log!" -ForegroundColor Green
    } else {
        Write-Host "Waiting for log file to write..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        if (Test-Path "keep_alive.log") {
            Write-Host "Log file successfully created at keep_alive.log!" -ForegroundColor Green
        }
    }
}
catch {
    Write-Error "Failed to register Scheduled Task: $_"
    Write-Host "NOTE: Make sure to run this script in a PowerShell window with appropriate permissions." -ForegroundColor Yellow
}
