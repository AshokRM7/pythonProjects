# Run this script to start the full stack demo
$ErrorActionPreference = "Stop"

Write-Host "Starting IAM Agentic Demo..." -ForegroundColor Green

# Check for OpenAI Key
if (-not $env:OPENAI_API_KEY) {
    Write-Warning "OPENAI_API_KEY is not set in this session."
    $key = Read-Host "Please enter your OpenAI API Key (or press Enter to skip if set in system env)"
    if ($key) {
        $env:OPENAI_API_KEY = $key
    }
}

# Start Backend
Write-Host "Starting Backend on Port 9000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python -m venv .venv; .\.venv\Scripts\Activate; python -m uvicorn app.main:app --reload --port 9000"

# Start Frontend
Write-Host "Starting Frontend on Port 5173..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"

Write-Host "All systems go! Access the app at http://localhost:5173" -ForegroundColor Green
