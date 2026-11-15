@echo off
title QuestLog Launcher
cd /d "%~dp0"

echo ========================================================
echo   Starting QuestLog - Game Backlog & Progress Tracker
echo ========================================================

:: Check if server is already running on port 3001
curl -s -I http://localhost:3001/ >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Starting QuestLog local backend server...
    start /b "" node server.js >nul 2>&1
    timeout /t 2 /nobreak >nul
)

:: Launch standalone desktop window in maximized / windowed fullscreen mode
if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3001/ --start-maximized
) else if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:3001/ --start-maximized
) else (
    start http://localhost:3001/
)

exit
