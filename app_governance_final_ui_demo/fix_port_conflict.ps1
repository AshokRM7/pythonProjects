# Helper script to fix [Errno 10048] Port Conflict
# This script identifies the process ID using port 8000 and terminates it.

$port = 8000
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1

if ($process) {
    Write-Host "Found process $($process.OwningProcess) using port $port. Terminating..." -ForegroundColor Yellow
    Stop-Process -Id $process.OwningProcess -Force
    Write-Host "Process terminated. You can now restart the backend." -ForegroundColor Green
} else {
    Write-Host "No process found using port $port. The port is already free." -ForegroundColor Green
}
