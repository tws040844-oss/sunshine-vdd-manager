@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js 20+ from https://nodejs.org/
    pause
    exit /b 1
)
echo Starting Sunshine VDD Manager on http://127.0.0.1:47995 ...
node "%~dp0server\index.js" --open
if errorlevel 1 (
    echo.
    echo [ERROR] Server exited unexpectedly.
    pause
)
endlocal
