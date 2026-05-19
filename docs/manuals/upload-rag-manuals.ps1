$ErrorActionPreference = "Stop"

$baseUrl = $args[0]
if (-not $baseUrl) {
  $baseUrl = "http://localhost:4000"
}

$manuals = @(
  @{ Title = "스크래치 불량 조치 기준서"; DefectType = "scratch"; File = "scratch-standard.md"; Checklist = "- 지그 접촉면 마모 확인`n- 이송 레일 청소`n- 동일 LOT 재검사" },
  @{ Title = "이물/오염 불량 조치 기준서"; DefectType = "contamination"; File = "contamination-standard.md"; Checklist = "- 세척 노즐 막힘 확인`n- 블로워 압력 확인`n- 재세척 후 재검사" },
  @{ Title = "찍힘 불량 조치 기준서"; DefectType = "dent"; File = "dent-standard.md"; Checklist = "- 적재 높이 확인`n- 이송 급정지 로그 확인`n- 완충재 상태 확인" },
  @{ Title = "균열 불량 조치 기준서"; DefectType = "crack"; File = "crack-standard.md"; Checklist = "- 가압 조건 확인`n- 냉각 시간 편차 확인`n- 원자재 LOT 격리 판단" }
)

foreach ($manual in $manuals) {
  $path = Join-Path $PSScriptRoot $manual.File
  Write-Host "Uploading $($manual.Title)..."
  curl.exe -s `
    -F "title=$($manual.Title)" `
    -F "defectType=$($manual.DefectType)" `
    -F "checklist=$($manual.Checklist)" `
    -F "file=@$path;type=text/markdown" `
    "$baseUrl/api/manuals"
  Write-Host ""
}
