@echo off
setlocal
title OpenCode Autopilot
cd /d "%~dp0"

echo [OpenCode Autopilot] Starting...
where npm >nul 2>nul
if errorlevel 1 (
    echo [OpenCode Autopilot] npm not found. Please install it.
    pause
    exit /b 1
)

npm run dev

if errorlevel 1 (
    echo [OpenCode Autopilot] Exited with error code %errorlevel%.
    pause
)
endlocal
