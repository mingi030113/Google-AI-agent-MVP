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
      @{ id = "scratch-1"; label = "카테고리별 접촉부 확인: capsule feeder/chute, metal_nut fixture/deburring, screw driver bit"; priority = "high" },
      @{ id = "scratch-2"; label = "금속 칩, burr, 분진, 파손 완충재 제거 또는 교체"; priority = "high" },
      @{ id = "scratch-3"; label = "원본 이미지의 선 방향과 heatmap 집중 방향을 정상 샘플과 비교"; priority = "medium" },
      @{ id = "scratch-4"; label = "동일 LOT 샘플 5개 이상 재검사 후 같은 방향 scratch 재발 여부 확인"; priority = "medium" }
    )
  },
  @{
    Title = "이물/오염 불량 조치 기준서"
    DefectType = "contamination"
    File = "contamination-standard.md"
    Checklist = @(
      @{ id = "contamination-1"; label = "오염 유형 분류: residue, fiber/thread, oil, glue, metal_contamination, liquid"; priority = "high" },
      @{ id = "contamination-2"; label = "bottle 세척 노즐/필터/블로워 또는 tile/leather glue-oil 접촉 구간 확인"; priority = "high" },
      @{ id = "contamination-3"; label = "포장 전 대기 구역, 트레이, 작업대, 금속 칩/섬유 낙진 구간 청소"; priority = "medium" },
      @{ id = "contamination-4"; label = "재세척 또는 표면 닦음 후 동일 LOT 샘플 5개 이상 재검사"; priority = "medium" }
    )
  },
  @{
    Title = "찍힘/변형 불량 조치 기준서"
    DefectType = "dent"
    File = "dent-standard.md"
    Checklist = @(
      @{ id = "dent-1"; label = "정상 샘플 외곽선과 비교해 squeeze, bent, bent_lead, squeezed_teeth 여부 기록"; priority = "high" },
      @{ id = "dent-2"; label = "적재 높이, press/fixture 압력, tray 완충재, guide 간격 확인"; priority = "high" },
      @{ id = "dent-3"; label = "이송 속도 로그, 급정지/충돌 알람, pick-and-place 위치 이력 확인"; priority = "medium" },
      @{ id = "dent-4"; label = "기능면, 리드, 체결면, teeth 변형 의심품은 승인 전 격리"; priority = "high" }
    )
  },
  @{
    Title = "방향 오류/Flip 불량 조치 기준서"
    DefectType = "flip"
    File = "flip-standard.md"
    Checklist = @(
      @{ id = "flip-1"; label = "정상 샘플과 비교해 부품 앞뒤/상하 방향, 체결면 노출 방향, 기준 홈 위치를 확인"; priority = "high" },
      @{ id = "flip-2"; label = "bowl feeder, orientation rail, escapement, pick-and-place 흡착 방향 설정 점검"; priority = "high" },
      @{ id = "flip-3"; label = "동일 LOT 샘플 5개 이상 재검사해 flip 재발 여부와 방향 보정값을 기록"; priority = "medium" },
      @{ id = "flip-4"; label = "vision recipe 기준 샘플, ROI, rotation tolerance 변경 여부 확인"; priority = "medium" }
    )
  },
  @{
    Title = "균열 불량 조치 기준서"
    DefectType = "crack"
    File = "crack-standard.md"
    Checklist = @(
      @{ id = "crack-1"; label = "기능부 또는 관통 균열 의심 시 설비 즉시 정지"; priority = "high" },
      @{ id = "crack-2"; label = "tile/capsule/bottle/hazelnut/pill 원본 이미지에서 branching, 파단 경계, broken 여부 확인"; priority = "high" },
      @{ id = "crack-3"; label = "성형/가압 조건, 냉각/건조 시간, 원자재 LOT 변경 이력 확인"; priority = "high" },
      @{ id = "crack-4"; label = "시험 생산품 5개 이상 정상 확인 후 생산 재개 승인"; priority = "high" }
    )
  }
)

foreach ($manual in $manuals) {
  $path = Join-Path $PSScriptRoot $manual.File
  $checklistJson = $manual.Checklist | ConvertTo-Json -Compress -Depth 4
  $checklistPath = [System.IO.Path]::GetTempFileName()

  Write-Host "Uploading $($manual.Title)..."
  try {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($checklistPath, $checklistJson, $utf8NoBom)

    $response = curl.exe -s `
      -F "title=$($manual.Title)" `
      -F "defectType=$($manual.DefectType)" `
      -F "checklist=<$checklistPath;type=application/json" `
      -F "file=@$path;type=text/markdown" `
      "$baseUrl/api/manuals"

    try {
      $result = $response | ConvertFrom-Json
      Write-Host "Uploaded $($result.manual.id) ($(@($result.chunks).Count) chunks)"
    } catch {
      Write-Host $response
      throw
    }
  } finally {
    if (Test-Path -LiteralPath $checklistPath) {
      Remove-Item -LiteralPath $checklistPath -Force
    }
  }
  Write-Host ""
}


