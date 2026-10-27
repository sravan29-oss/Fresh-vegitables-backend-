# ============================================================
# Fresh Vegetables — Automated PostgreSQL Installer & Setup
# ============================================================

# Check for Administrator elevation
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Elevating permissions to install PostgreSQL..." -ForegroundColor Yellow
    Start-Process powershell -Verb runAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🥬 Fresh Vegetables — PostgreSQL Automatic Setup" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Install PostgreSQL 16 via Chocolatey
Write-Host "`n[1/4] Installing PostgreSQL 16..." -ForegroundColor Yellow
choco install postgresql16 --params '/Password:password' -y

# 2. Refresh Environment Variables
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# 3. Check Service Status
Write-Host "`n[2/4] Verifying PostgreSQL Service..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
$pgService = Get-Service *postgres* -ErrorAction SilentlyContinue
if ($pgService) {
    Write-Host "Service Found: $($pgService.Name) - Status: $($pgService.Status)" -ForegroundColor Green
    if ($pgService.Status -ne 'Running') {
        Start-Service $pgService.Name
    }
} else {
    Write-Host "PostgreSQL service not detected yet, please verify installation." -ForegroundColor Red
}

# 4. Check Port 5432
Write-Host "`n[3/4] Testing Port 5432..." -ForegroundColor Yellow
$portCheck = Test-NetConnection 127.0.0.1 -Port 5432 -WarningAction SilentlyContinue
if ($portCheck.TcpTestSucceeded) {
    Write-Host "Port 5432 is OPEN and listening!" -ForegroundColor Green
} else {
    Write-Host "Port 5432 is not responding yet." -ForegroundColor Red
}

# 5. Initialize Database & Run Migrations
Write-Host "`n[4/4] Creating database 'fresh_vegetables' and running migrations..." -ForegroundColor Yellow
Set-Location -Path "c:\Fresh vegitables\backend"
npm run db:init
npm run db:migrate
npm run test:persistence

Write-Host "`n🎉 Setup Complete! Press any key to close..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
