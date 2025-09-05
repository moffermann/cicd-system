# PowerShell Script to Keep SSH Tunnel Alive
# Monitors and restarts SSH tunnel if it goes down

$ErrorActionPreference = "Stop"

Write-Host "🔄 Starting SSH Tunnel Monitor" -ForegroundColor Green

# Configuration
$TUNNEL_PORT = "9001"
$LOCAL_PORT = "8765"
$REMOTE_HOST = "ubuntu@gocode.cl"
$SSH_KEY = "~/.ssh/id_rsa"  # Update with your SSH key path
$CHECK_INTERVAL = 30  # seconds

# Function to check if tunnel is running
function Test-TunnelRunning {
    $processes = Get-Process | Where-Object { $_.ProcessName -eq "ssh" -and $_.CommandLine -like "*$TUNNEL_PORT*" }
    return $processes.Count -gt 0
}

# Function to test tunnel connectivity
function Test-TunnelConnectivity {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$LOCAL_PORT/health" -TimeoutSec 5 -UseBasicParsing
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

# Function to start tunnel
function Start-Tunnel {
    Write-Host "🔗 Starting SSH tunnel..." -ForegroundColor Yellow
    
    $sshArgs = @(
        "-N",
        "-R", "${TUNNEL_PORT}:localhost:${LOCAL_PORT}",
        "-i", $SSH_KEY,
        "-o", "ServerAliveInterval=60",
        "-o", "ServerAliveCountMax=3",
        $REMOTE_HOST
    )
    
    Start-Process -FilePath "ssh" -ArgumentList $sshArgs -WindowStyle Hidden
    Start-Sleep -Seconds 5
}

# Function to clean up dead processes
function Stop-DeadTunnels {
    $processes = Get-Process | Where-Object { $_.ProcessName -eq "ssh" -and $_.CommandLine -like "*$TUNNEL_PORT*" }
    
    foreach ($process in $processes) {
        if ($process.HasExited -or $process.Responding -eq $false) {
            Write-Host "🧹 Cleaning up dead SSH process: $($process.Id)" -ForegroundColor Yellow
            $process | Stop-Process -Force -ErrorAction SilentlyContinue
        }
    }
}

# Main monitoring loop
Write-Host "👀 Starting tunnel monitoring (Check interval: ${CHECK_INTERVAL}s)" -ForegroundColor Cyan
Write-Host "💡 Press Ctrl+C to stop monitoring" -ForegroundColor Gray

$restartCount = 0

while ($true) {
    try {
        # Clean up any dead processes first
        Stop-DeadTunnels
        
        # Check if tunnel process is running
        if (-not (Test-TunnelRunning)) {
            Write-Host "⚠️ SSH tunnel process not found, restarting..." -ForegroundColor Yellow
            Start-Tunnel
            $restartCount++
            Write-Host "🔄 Tunnel restart #$restartCount" -ForegroundColor Cyan
        } else {
            # Test connectivity
            if (Test-TunnelConnectivity) {
                Write-Host "✅ $(Get-Date -Format 'HH:mm:ss') - Tunnel healthy" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Tunnel process exists but connectivity failed, restarting..." -ForegroundColor Yellow
                
                # Kill existing processes
                Get-Process | Where-Object { $_.ProcessName -eq "ssh" -and $_.CommandLine -like "*$TUNNEL_PORT*" } | Stop-Process -Force
                Start-Sleep -Seconds 3
                
                # Restart
                Start-Tunnel
                $restartCount++
                Write-Host "🔄 Tunnel restart #$restartCount" -ForegroundColor Cyan
            }
        }
        
        Start-Sleep -Seconds $CHECK_INTERVAL
        
    } catch {
        Write-Host "❌ Monitor error: $_" -ForegroundColor Red
        Start-Sleep -Seconds $CHECK_INTERVAL
    }
}
