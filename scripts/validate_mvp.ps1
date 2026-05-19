param(
  [string]$BackendBase = "http://localhost:4000",
  [string]$FrontendBase = "http://localhost:3000"
)

$ErrorActionPreference = "Stop"

function Write-Step($Message) {
  Write-Host "[MVP validate] $Message"
}

function Assert-Status($Name, $StatusCode, $Expected = 200) {
  if ($StatusCode -ne $Expected) {
    throw "$Name returned HTTP $StatusCode, expected $Expected"
  }
  Write-Step "$Name OK ($StatusCode)"
}

$createdReportId = $null
$createdManualId = $null
$manualFile = Join-Path $env:TEMP "quality-agent-validate-manual.md"
$uploadScript = Join-Path $env:TEMP "quality-agent-upload-manual.mjs"

try {
  Write-Step "Checking backend health"
  $health = Invoke-RestMethod -Uri "$BackendBase/api/health"
  if (-not $health.ok) {
    throw "Backend health returned ok=false"
  }
  Write-Step "Backend OK store=$($health.storeDriver), vision=$($health.visionDriver)"

  Write-Step "Checking frontend routes"
  foreach ($route in @("/login", "/dashboard", "/inspections", "/inspections/new", "/agent", "/reports", "/admin/manuals")) {
    $response = Invoke-WebRequest -Uri "$FrontendBase$route" -UseBasicParsing
    Assert-Status "frontend $route" $response.StatusCode
  }

  Write-Step "Checking dashboard metrics"
  $metrics = Invoke-RestMethod -Uri "$BackendBase/api/dashboard/metrics"
  if ($null -eq $metrics.summary.totalInspections) {
    throw "Dashboard metrics did not include summary.totalInspections"
  }
  Write-Step "Dashboard OK totalInspections=$($metrics.summary.totalInspections)"

  Write-Step "Checking inspection history"
  $inspections = Invoke-RestMethod -Uri "$BackendBase/api/inspections?page=1&pageSize=5"
  if ($inspections.items.Count -lt 1) {
    throw "Inspection history returned no items"
  }
  Write-Step "Inspection history OK items=$($inspections.items.Count), total=$($inspections.total)"

  Write-Step "Checking Agent answer"
  $agentBody = @{
    question = "scratch action checklist"
    defectType = "scratch"
  } | ConvertTo-Json
  $agent = Invoke-RestMethod -Method Post -Uri "$BackendBase/api/agent/ask" -ContentType "application/json" -Body $agentBody
  if ($agent.sources.Count -lt 1) {
    throw "Agent answer returned no sources"
  }
  Write-Step "Agent OK sources=$($agent.sources.Count), fallback=$($agent.fallback)"

  Write-Step "Checking manual upload and delete"
  $manualContent = @(
    "# MVP validation manual",
    "",
    "- Check jig wear",
    "- Clean transfer rail",
    "- Reinspect same LOT"
  ) -join "`n"
  Set-Content -Encoding UTF8 -LiteralPath $manualFile -Value $manualContent

  @'
import { readFile } from 'node:fs/promises';

const [backendBase, manualFile] = process.argv.slice(2);
const form = new FormData();
form.append('title', 'MVP validation manual');
form.append('defectType', 'scratch');
form.append('checklist', '- Check jig wear\n- Clean transfer rail');
form.append(
  'file',
  new Blob([await readFile(manualFile)], { type: 'text/markdown' }),
  'quality-agent-validate-manual.md'
);

const response = await fetch(`${backendBase}/api/manuals`, {
  method: 'POST',
  body: form
});
const text = await response.text();
if (!response.ok) {
  throw new Error(`Manual upload failed: ${response.status} ${text}`);
}
console.log(text);
'@ | Set-Content -Encoding UTF8 -LiteralPath $uploadScript

  $manualJson = node $uploadScript $BackendBase $manualFile
  if ($LASTEXITCODE -ne 0) {
    throw "Manual upload helper failed with exit code $LASTEXITCODE"
  }
  $manual = $manualJson | ConvertFrom-Json
  $createdManualId = $manual.manual.id
  if (-not $createdManualId) {
    throw "Manual upload did not return manual.id"
  }
  Write-Step "Manual upload OK id=$createdManualId"

  $manualDelete = Invoke-WebRequest -Method Delete -Uri "$BackendBase/api/manuals/$createdManualId" -UseBasicParsing
  Assert-Status "manual delete" $manualDelete.StatusCode 204
  $createdManualId = $null

  Write-Step "Checking report create and delete"
  $reportBody = @{
    reportType = "daily"
    startDate = "2026-05-18"
    endDate = "2026-05-18"
  } | ConvertTo-Json
  $report = Invoke-RestMethod -Method Post -Uri "$BackendBase/api/reports" -ContentType "application/json" -Body $reportBody
  $createdReportId = $report.report.id
  if (-not $createdReportId) {
    throw "Report create did not return report.id"
  }
  Write-Step "Report create OK id=$createdReportId"

  $reportDelete = Invoke-WebRequest -Method Delete -Uri "$BackendBase/api/reports/$createdReportId" -UseBasicParsing
  Assert-Status "report delete" $reportDelete.StatusCode 204
  $createdReportId = $null

  Write-Step "All MVP checks passed"
} finally {
  if ($createdManualId) {
    try {
      Invoke-WebRequest -Method Delete -Uri "$BackendBase/api/manuals/$createdManualId" -UseBasicParsing | Out-Null
      Write-Step "Cleaned up manual id=$createdManualId"
    } catch {
      Write-Warning "Failed to clean up manual id=$createdManualId"
    }
  }

  if ($createdReportId) {
    try {
      Invoke-WebRequest -Method Delete -Uri "$BackendBase/api/reports/$createdReportId" -UseBasicParsing | Out-Null
      Write-Step "Cleaned up report id=$createdReportId"
    } catch {
      Write-Warning "Failed to clean up report id=$createdReportId"
    }
  }

  if (Test-Path -LiteralPath $manualFile) {
    Remove-Item -LiteralPath $manualFile -Force
  }
  if (Test-Path -LiteralPath $uploadScript) {
    Remove-Item -LiteralPath $uploadScript -Force
  }
}
