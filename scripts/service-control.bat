@echo off
REM Windows Service Control Script for CI/CD Webhook Server
REM Must be run as Administrator

setlocal

:: Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [32m✅ Running as Administrator[0m
) else (
    echo [31m❌ ERROR: This script must be run as Administrator[0m
    echo [33m📋 Right-click this file and select "Run as Administrator"[0m
    pause
    exit /b 1
)

:: Display menu
:menu
echo.
echo [36m🔧 ===== CI/CD Webhook Server - Windows Service Control =====[0m
echo [33m1.[0m Install Service (auto-start on boot)
echo [33m2.[0m Uninstall Service (complete removal)
echo [33m3.[0m Start Service
echo [33m4.[0m Stop Service
echo [33m5.[0m Restart Service
echo [33m6.[0m Check Service Status
echo [33m7.[0m View Service Logs
echo [33m8.[0m Test Webhook URL
echo [33m9.[0m Exit
echo [36m============================================================[0m
echo.
set /p choice="Enter your choice (1-9): "

if "%choice%"=="1" goto install
if "%choice%"=="2" goto uninstall
if "%choice%"=="3" goto start
if "%choice%"=="4" goto stop
if "%choice%"=="5" goto restart
if "%choice%"=="6" goto status
if "%choice%"=="7" goto logs
if "%choice%"=="8" goto test
if "%choice%"=="9" goto exit
goto menu

:install
echo [33m🔧 Installing Windows Service...[0m
cd /d "%~dp0\.."
node scripts\install-windows-service.js
echo.
echo [32m✅ Service installation completed![0m
echo [36m🔧 You can now manage the service via Windows Services (services.msc)[0m
pause
goto menu

:uninstall
echo [33m🗑️ Uninstalling Windows Service...[0m
cd /d "%~dp0\.."
node scripts\uninstall-windows-service.js
echo.
echo [32m✅ Service uninstallation completed![0m
pause
goto menu

:start
echo [33m🚀 Starting CI/CD Webhook Server service...[0m
sc start "CICD-Webhook-Server"
if %errorlevel% == 0 (
    echo [32m✅ Service started successfully![0m
    echo [36m🌐 Webhook URL: http://localhost:8765[0m
) else (
    echo [31m❌ Failed to start service[0m
)
pause
goto menu

:stop
echo [33m🛑 Stopping CI/CD Webhook Server service...[0m
sc stop "CICD-Webhook-Server"
if %errorlevel% == 0 (
    echo [32m✅ Service stopped successfully![0m
) else (
    echo [31m❌ Failed to stop service[0m
)
pause
goto menu

:restart
echo [33m🔄 Restarting CI/CD Webhook Server service...[0m
sc stop "CICD-Webhook-Server"
timeout /t 3 /nobreak >nul
sc start "CICD-Webhook-Server"
if %errorlevel% == 0 (
    echo [32m✅ Service restarted successfully![0m
    echo [36m🌐 Webhook URL: http://localhost:8765[0m
) else (
    echo [31m❌ Failed to restart service[0m
)
pause
goto menu

:status
echo [33m📊 Checking service status...[0m
sc query "CICD-Webhook-Server"
echo.
echo [36m🔗 Quick health check...[0m
curl -s http://localhost:8765/health 2>nul
if %errorlevel% == 0 (
    echo [32m✅ Webhook server is responding[0m
) else (
    echo [31m❌ Webhook server is not responding[0m
)
pause
goto menu

:logs
echo [33m📝 Opening Event Viewer for service logs...[0m
echo [36m📋 Look for events from "CICD-Webhook-Server" source[0m
eventvwr.msc
pause
goto menu

:test
echo [33m🧪 Testing webhook endpoint...[0m
echo [36m🌐 Testing: http://localhost:8765/health[0m
curl -s http://localhost:8765/health
echo.
echo.
echo [36m🔗 Testing: http://localhost:8765/api/projects[0m
curl -s http://localhost:8765/api/projects
echo.
pause
goto menu

:exit
echo [36m👋 Goodbye![0m
exit /b 0