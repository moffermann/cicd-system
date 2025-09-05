# PowerShell Script to Start SSH Tunnel Service for CI/CD
# Maintains persistent SSH tunnel for webhook notifications

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting SSH Tunnel Service for CI/CD" -ForegroundColor Green

# Configuration
$TUNNEL_PORT = "9001"
$LOCAL_PORT = "8765"
$REMOTE_HOST = "ubuntu@gocode.cl"
$SSH_KEY = "~/.ssh/id_rsa"  # Update with your SSH key path

# Function to check if tunnel is running
function Test-TunnelRunning {
    $processes = Get-Process | Where-Object { $_.ProcessName -eq "ssh" -and $_.CommandLine -like "*$TUNNEL_PORT*" }
    return $processes.Count -gt 0
}

# Function to start tunnel
function Start-Tunnel {
    Write-Host "🔗 Starting SSH tunnel on port $TUNNEL_PORT..." -ForegroundColor Yellow
    
    $sshArgs = @(
        "-N",
        "-R", "${TUNNEL_PORT}:localhost:${LOCAL_PORT}",
        "-i", $SSH_KEY,
        $REMOTE_HOST
    )
    
    Start-Process -FilePath "ssh" -ArgumentList $sshArgs -WindowStyle Hidden
    Start-Sleep -Seconds 3
    
    if (Test-TunnelRunning) {
        Write-Host "✅ SSH tunnel started successfully" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Failed to start SSH tunnel" -ForegroundColor Red
        return $false
    }
}

# Function to stop existing tunnels
function Stop-ExistingTunnels {
    $processes = Get-Process | Where-Object { $_.ProcessName -eq "ssh" -and $_.CommandLine -like "*$TUNNEL_PORT*" }
    
    if ($processes.Count -gt 0) {
        Write-Host "🛑 Stopping existing SSH tunnels..." -ForegroundColor Yellow
        $processes | Stop-Process -Force
        Start-Sleep -Seconds 2
    }
}

# Main execution
try {
    # Check if already running
    if (Test-TunnelRunning) {
        Write-Host "ℹ️ SSH tunnel already running" -ForegroundColor Blue
        exit 0
    }
    
    # Stop any existing tunnels
    Stop-ExistingTunnels
    
    # Start new tunnel
    if (Start-Tunnel) {
        Write-Host "🎉 SSH Tunnel Service started successfully" -ForegroundColor Green
        Write-Host "📡 Remote port: $TUNNEL_PORT -> Local port: $LOCAL_PORT" -ForegroundColor Cyan
        exit 0
    } else {
        Write-Host "💥 Failed to start SSH Tunnel Service" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "💥 Error: $_" -ForegroundColor Red
    exit 1
}