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
echo [36m🔧 ===== CI/CD System - Windows Service Control =====[0m
echo [33m=== WEBHOOK SERVER ===[0m
echo [33m1.[0m Install Webhook Service (auto-start on boot)
echo [33m2.[0m Uninstall Webhook Service (complete removal)
echo [33m3.[0m Start Webhook Service
echo [33m4.[0m Stop Webhook Service
echo [33m5.[0m Restart Webhook Service
echo [33m6.[0m Check Webhook Service Status
echo [33m=== SSH TUNNEL ===[0m
echo [33m7.[0m Install SSH Tunnel Service (auto-start on boot)
echo [33m8.[0m Uninstall SSH Tunnel Service (complete removal)
echo [33m9.[0m Start SSH Tunnel Service
echo [33m10.[0m Stop SSH Tunnel Service
echo [33m11.[0m Check SSH Tunnel Status
echo [33m=== SYSTEM ===[0m
echo [33m12.[0m View Service Logs
echo [33m13.[0m Test Complete System
echo [33m14.[0m Exit
echo [36m============================================================[0m
echo.
set /p choice="Enter your choice (1-14): "

if "%choice%"=="1" goto install_webhook
if "%choice%"=="2" goto uninstall_webhook
if "%choice%"=="3" goto start_webhook
if "%choice%"=="4" goto stop_webhook
if "%choice%"=="5" goto restart_webhook
if "%choice%"=="6" goto status_webhook
if "%choice%"=="7" goto install_tunnel
if "%choice%"=="8" goto uninstall_tunnel
if "%choice%"=="9" goto start_tunnel
if "%choice%"=="10" goto stop_tunnel
if "%choice%"=="11" goto status_tunnel
if "%choice%"=="12" goto logs
if "%choice%"=="13" goto test_system
if "%choice%"=="14" goto exit
goto menu

:install_webhook
echo [33m🔧 Installing Webhook Windows Service...[0m
cd /d "%~dp0\.."
node scripts\install-windows-service.js
echo.
echo [32m✅ Webhook service installation completed![0m
echo [36m🔧 You can now manage the service via Windows Services (services.msc)[0m
pause
goto menu

:install_tunnel
echo [33m🔗 Installing SSH Tunnel Windows Service...[0m
cd /d "%~dp0\.."
node scripts\install-ssh-tunnel-service.cjs
echo.
echo [32m✅ SSH Tunnel service installation completed![0m
echo [36m🔧 You can now manage the service via Windows Services (services.msc)[0m
pause
goto menu

:uninstall_webhook
echo [33m🗑️ Uninstalling Webhook Windows Service...[0m
cd /d "%~dp0\.."
node scripts\uninstall-windows-service.js
echo.
echo [32m✅ Webhook service uninstallation completed![0m
pause
goto menu

:uninstall_tunnel
echo [33m🗑️ Uninstalling SSH Tunnel Windows Service...[0m
cd /d "%~dp0\.."
node scripts\uninstall-ssh-tunnel-service.cjs
echo.
echo [32m✅ SSH Tunnel service uninstallation completed![0m
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