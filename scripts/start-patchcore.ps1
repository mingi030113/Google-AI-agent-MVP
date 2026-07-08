$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$artifactRoot = $env:PATCHCORE_ARTIFACT_ROOT
$artifactDir = $env:PATCHCORE_ARTIFACT_DIR
if (-not $artifactRoot -and -not $artifactDir) {
  $artifactRoot = Join-Path $root "artifacts"
}

$pythonCandidates = @(
  $env:PATCHCORE_PYTHON,
  (Join-Path $root ".venv\Scripts\python.exe"),
  "C:\tmp\patchcore-venv\Scripts\python.exe",
  "python"
) | Where-Object { $_ }

$python = $null
foreach ($candidate in $pythonCandidates) {
  if ($candidate -eq "python") {
    $python = $candidate
    break
  }
  if (Test-Path -LiteralPath $candidate) {
    $python = $candidate
    break
  }
}

if (-not $python) {
  throw "Python runtime was not found. Set PATCHCORE_PYTHON to a Python executable with model_service requirements installed."
}

if ($artifactRoot) {
  $env:PATCHCORE_ARTIFACT_ROOT = $artifactRoot
  if (-not $env:PATCHCORE_DEFAULT_ASSET_KEY) {
    $env:PATCHCORE_DEFAULT_ASSET_KEY = "bottle"
  }
} else {
  $env:PATCHCORE_ARTIFACT_DIR = $artifactDir
}

Write-Host "Starting PatchCore model service"
if ($env:PATCHCORE_ARTIFACT_ROOT) {
  Write-Host "Artifact root: $env:PATCHCORE_ARTIFACT_ROOT"
  Write-Host "Default asset: $env:PATCHCORE_DEFAULT_ASSET_KEY"
} else {
  Write-Host "Artifact dir: $env:PATCHCORE_ARTIFACT_DIR"
}
Write-Host "Python: $python"

Set-Location $root
& $python -m uvicorn model_service.app:app --host 0.0.0.0 --port 8000
