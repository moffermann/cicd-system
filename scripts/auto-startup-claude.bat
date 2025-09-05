@echo off
echo 🤖 Claude Code Auto-Startup Script
echo ================================
echo.

REM Change to project directory
cd /d "%~dp0.."

REM Run startup checklist
echo 📋 Running startup checklist...
node src/claude-startup-checklist-complete.js

if errorlevel 1 (
    echo ❌ Startup checklist failed
    echo 💡 Please fix the issues above before continuing
    pause
    exit /b 1
)

echo.
echo ✅ Startup checklist passed!
echo 🚀 Ready for Claude Code development
echo.

REM Optional: Start webhook server
set /p START_WEBHOOK=Start webhook server? (y/n): 
if /i "%START_WEBHOOK%"=="y" (
    echo 🌐 Starting webhook server...
    start "Webhook Server" cmd /k "node src/webhook-server.js"
)

echo.
echo 🎉 Setup complete! You can now use Claude Code.
echo 💡 Run 'npm run health-check' anytime to verify system status
pause