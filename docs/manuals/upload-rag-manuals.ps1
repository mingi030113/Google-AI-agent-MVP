$ErrorActionPreference = "Stop"

$baseUrl = $args[0]
if (-not $baseUrl) {
  $baseUrl = "http://localhost:4000"
}

$manuals = @(
  @{
    Title = "스크래치 불량 조치 기준서"
    DefectType = "scratch"
    File = "scratch-standard.md"
    Checklist = @(
      @{ id = "scratch-1"; label = "지그 접촉면 마모 또는 버 발생 여부 확인"; priority = "high" },
      @{ id = "scratch-2"; label = "이송 레일 금속 칩, 분진, 오염물 제거"; priority = "high" },
      @{ id = "scratch-3"; label = "작업대와 트레이 청소 후 완료 사진 기록"; priority = "medium" },
      @{ id = "scratch-4"; label = "동일 LOT 샘플 5개 이상 재검사"; priority = "medium" }
    )
  },
  @{
    Title = "이물/오염 불량 조치 기준서"
    DefectType = "contamination"
    File = "contamination-standard.md"
    Checklist = @(
      @{ id = "contamination-1"; label = "세척 노즐 막힘과 분사각 확인"; priority = "high" },
      @{ id = "contamination-2"; label = "에어 블로워 압력 기록 확인"; priority = "high" },
      @{ id = "contamination-3"; label = "포장 전 대기 구역과 트레이 청소"; priority = "medium" },
      @{ id = "contamination-4"; label = "재세척 후 동일 LOT 샘플 5개 이상 재검사"; priority = "medium" }
    )
  },
  @{
    Title = "찍힘 불량 조치 기준서"
    DefectType = "dent"
    File = "dent-standard.md"
    Checklist = @(
      @{ id = "dent-1"; label = "적재 높이와 제품 간 간격 기준 준수 확인"; priority = "high" },
      @{ id = "dent-2"; label = "이송 속도 로그와 급정지 알람 확인"; priority = "high" },
      @{ id = "dent-3"; label = "트레이, 완충재, 보관 랙 손상 여부 확인"; priority = "medium" },
      @{ id = "dent-4"; label = "기능면 찍힘 의심품 품질관리자 승인 전 격리"; priority = "high" }
    )
  },
  @{
    Title = "균열 불량 조치 기준서"
    DefectType = "crack"
    File = "crack-standard.md"
    Checklist = @(
      @{ id = "crack-1"; label = "기능부 또는 관통 균열 확인 시 설비 즉시 정지"; priority = "high" },
      @{ id = "crack-2"; label = "가압 조건 이탈 알람과 설정값 변경 이력 확인"; priority = "high" },
      @{ id = "crack-3"; label = "냉각 시간 로그와 배출 온도 확인"; priority = "high" },
      @{ id = "crack-4"; label = "원자재 LOT 변경 시점과 불량 발생 시점 비교"; priority = "medium" },
      @{ id = "crack-5"; label = "시험 생산품 5개 이상 정상 확인 후 생산 재개 승인"; priority = "high" }
    )
  }
)

foreach ($manual in $manuals) {
  $path = Join-Path $PSScriptRoot $manual.File
  $checklistJson = $manual.Checklist | ConvertTo-Json -Compress -Depth 4

  Write-Host "Uploading $($manual.Title)..."
  curl.exe -s `
    -F "title=$($manual.Title)" `
    -F "defectType=$($manual.DefectType)" `
    -F "checklist=$checklistJson" `
    -F "file=@$path;type=text/markdown" `
    "$baseUrl/api/manuals"
  Write-Host ""
}
