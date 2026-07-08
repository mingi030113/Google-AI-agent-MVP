param(
  [string]$BackendUrl = "http://localhost:4000",
  [string]$LogDir = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

function Find-Cloudflared {
  $command = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidates = @(
    "C:\Program Files\cloudflared\cloudflared.exe",
    "C:\Program Files (x86)\cloudflared\cloudflared.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  throw "cloudflared.exe was not found. Install it with: winget install Cloudflare.cloudflared"
}

function Wait-ForTunnelUrl {
  param(
    [string]$OutLog,
    [string]$ErrLog
  )

  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    $logs = @()
    if (Test-Path -LiteralPath $OutLog) {
      $logs += Get-Content -LiteralPath $OutLog
    }
    if (Test-Path -LiteralPath $ErrLog) {
      $logs += Get-Content -LiteralPath $ErrLog
    }

    $match = ($logs | Select-String -Pattern "https://[-a-z0-9]+\.trycloudflare\.com" | Select-Object -First 1)
    if ($match) {
      return $match.Matches.Value
    }
  }

  return $null
}

try {
  $health = Invoke-RestMethod "$BackendUrl/api/health"
  Write-Host "Backend health: ok=$($health.ok), store=$($health.storeDriver), vision=$($health.visionDriver)"
} catch {
  throw "Backend is not reachable at $BackendUrl. Start backend first, then run this script."
}

$cloudflared = Find-Cloudflared
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outLog = Join-Path $LogDir "cloudflared-$timestamp.out.log"
$errLog = Join-Path $LogDir "cloudflared-$timestamp.err.log"

Start-Process `
  -FilePath $cloudflared `
  -ArgumentList "tunnel", "--url", $BackendUrl `
  -WorkingDirectory $LogDir `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog

$tunnelUrl = Wait-ForTunnelUrl -OutLog $outLog -ErrLog $errLog

if (-not $tunnelUrl) {
  Write-Host "Cloudflare Tunnel started, but the URL was not found in logs yet."
  Write-Host "Check logs:"
  Write-Host "  $errLog"
  Write-Host "  $outLog"
  exit 1
}

Write-Host ""
Write-Host "Cloudflare backend URL:"
Write-Host $tunnelUrl
Write-Host ""
Write-Host "Set this in Vercel:"
Write-Host "NEXT_PUBLIC_API_BASE=$tunnelUrl"
