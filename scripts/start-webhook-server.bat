@echo off
echo 🚀 Starting CI/CD Webhook Server...
echo.

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm packages are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Start the webhook server
echo 🌐 Starting webhook server on port 8765...
node src/webhook-server.js

if errorlevel 1 (
    echo ❌ Webhook server failed to start
    pause
    exit /b 1
)

echo 🎉 Webhook server started successfully!
pause