<#
.SYNOPSIS
  Start Eat n RepEat in LAN/Local Mode for phone testing.

.DESCRIPTION
  Auto-detects the laptop's current Wi-Fi LAN IP address and starts both the
  backend (Express on :4000) and frontend (Next.js on :3000) with the correct
  environment variables so phones on the same Wi-Fi can access the system.

.PARAMETER LanIp
  Optional. Override the auto-detected LAN IP (e.g., -LanIp 192.168.1.5).

.EXAMPLE
  .\start-lan.ps1
  .\start-lan.ps1 -LanIp 192.168.1.5
#>
param(
    [string]$LanIp
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- Auto-detect LAN IP ---
if (-not $LanIp) {
    $candidates = Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.IPAddress -ne "127.0.0.1" -and
            $_.PrefixOrigin -ne "WellKnown" -and
            (
                $_.IPAddress.StartsWith("192.168.") -or
                $_.IPAddress.StartsWith("10.") -or
                $_.IPAddress -match "^172\.(1[6-9]|2[0-9]|3[01])\."
            )
        } |
        Sort-Object -Property InterfaceIndex |
        Select-Object -First 1

    if (-not $candidates) {
        Write-Host ""
        Write-Host "  ERROR: Could not detect a LAN IP address." -ForegroundColor Red
        Write-Host "  Make sure you are connected to Wi-Fi, or supply one manually:" -ForegroundColor Yellow
        Write-Host "    .\start-lan.ps1 -LanIp 192.168.1.3" -ForegroundColor Cyan
        Write-Host ""
        exit 1
    }

    $LanIp = $candidates.IPAddress
}

# --- Display banner ---
Write-Host ""
Write-Host "  ========================================================" -ForegroundColor DarkYellow
Write-Host "         Eat n RepEat  --  LAN / Local Mode" -ForegroundColor DarkYellow
Write-Host "  ========================================================" -ForegroundColor DarkYellow
Write-Host ""
Write-Host "  Detected LAN IP : " -NoNewline
Write-Host $LanIp -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend (phone) : " -NoNewline
Write-Host "http://${LanIp}:3000" -ForegroundColor Cyan
Write-Host "  Backend  (phone) : " -NoNewline
Write-Host "http://${LanIp}:4000" -ForegroundColor Cyan
Write-Host "  Frontend (laptop): " -NoNewline
Write-Host "http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "  Press Ctrl+C to stop both servers." -ForegroundColor DarkGray
Write-Host ""

# --- Set environment variables for this process and its children ---
$env:NEXTAUTH_URL           = "http://${LanIp}:3000"
$env:NEXT_PUBLIC_API_URL    = "http://${LanIp}:4000"
$env:NEXT_PUBLIC_SITE_URL   = "http://${LanIp}:3000"

Write-Host "  ENV  NEXTAUTH_URL         = $env:NEXTAUTH_URL" -ForegroundColor DarkGray
Write-Host "  ENV  NEXT_PUBLIC_API_URL   = $env:NEXT_PUBLIC_API_URL" -ForegroundColor DarkGray
Write-Host "  ENV  NEXT_PUBLIC_SITE_URL  = $env:NEXT_PUBLIC_SITE_URL" -ForegroundColor DarkGray
Write-Host ""

# --- Start backend ---
$backendDir = Join-Path $ProjectRoot "eat-n-repeat-backend"
Write-Host "  Starting backend..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm start 2>&1
} -ArgumentList $backendDir

# Give the backend a moment to boot
Start-Sleep -Seconds 3

# --- Start frontend (blocking, runs in foreground) ---
$frontendDir = Join-Path $ProjectRoot "eat-n-repeat-frontend"
Write-Host "  Starting frontend..." -ForegroundColor Yellow
Write-Host ""

try {
    Set-Location $frontendDir
    npm run dev -- --hostname 0.0.0.0
}
finally {
    Write-Host ""
    Write-Host "  Stopping backend..." -ForegroundColor Yellow
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -Force -ErrorAction SilentlyContinue
    Write-Host "  Done." -ForegroundColor Green
}
