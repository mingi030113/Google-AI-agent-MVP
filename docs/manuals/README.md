# MVTec AD RAG 기준서 업로드 자료

AI 품질검사 데모에서 조치 Agent가 MVTec AD 이미지 판정 결과를 기준으로 답변할 수 있도록 만든 기준서입니다. 단순 이상 탐지 결과를 넘어서, `scratch`, `contamination`, `dent`, `flip`, `crack` 유형별 시각 단서, 원인 후보, 즉시 조치, 재검사 기준을 RAG 근거로 제공합니다.

## 파일 목록

| 불량 유형 | 기준서명 | 주요 MVTec AD 카테고리 | 파일 |
| --- | --- | --- | --- |
| scratch | 스크래치 불량 조치 기준서 | capsule, metal_nut, screw, pill, wood, leather | `scratch-standard.md` |
| contamination | 이물/오염 불량 조치 기준서 | bottle, tile, pill, leather, carpet, grid, wood | `contamination-standard.md` |
| dent | 찍힘/변형 불량 조치 기준서 | capsule, metal_nut, transistor, cable, zipper, bottle | `dent-standard.md` |
| flip | 방향 오류/Flip 불량 조치 기준서 | metal_nut, cable, transistor, zipper | `flip-standard.md` |
| crack | 균열 불량 조치 기준서 | tile, capsule, bottle, hazelnut, pill | `crack-standard.md` |

## 기준서 설계 원칙

- MVTec AD 데모 이미지와 원본 taxonomy의 결함명(`scratch_head`, `metal_contamination`, `bent_lead`, `broken_large` 등)을 함께 반영했습니다.
- PatchCore의 `anomalyScore`, `threshold`, `heatmap`을 현장 판단 근거로 해석하는 방법을 포함했습니다.
- Gemini labeler가 산출하는 결함 유형 추정을 보조 근거로 사용하되, 최종 조치는 기준서와 재검사 조건을 따르도록 구성했습니다.
- RAG 검색 성능을 위해 영문/한글 결함명, 데이터셋 카테고리명, 현장 조치 키워드를 반복 포함했습니다.
- Agent가 답변할 때 카테고리별 우선 점검 위치와 생산 재개/종료 조건을 함께 말하도록 `Agent 답변 규칙` 섹션을 각 기준서에 추가했습니다.

## 화면에서 수동 업로드

각 파일을 `메뉴얼 관리 > 매뉴얼 업로드`에서 선택하고 아래 값을 입력합니다.

### scratch

- 기준서명: 스크래치 불량 조치 기준서
- 불량 유형: scratch
- 체크리스트:

```text
- 지그, 클램프, 가이드 레일 접촉면의 버와 마모 확인
- 금속 칩, 분진, 파손 완충재 제거 또는 교체
- capsule/metal_nut/screw/pill 정상 샘플과 heatmap 방향 비교
- 동일 LOT 샘플 5개 이상 재검사 후 anomalyScore 확인
```

### contamination

- 기준서명: 이물/오염 불량 조치 기준서
- 불량 유형: contamination
- 체크리스트:

```text
- bottle 내부, 홈, 링 주변 오염 위치와 유형 기록
- oil/glue/thread/metal_contamination 여부 분류
- 세척 노즐, 필터, 블로워 압력과 건조 조건 확인
- 포장 전 대기 구역, 트레이, 작업대 청소
- 재세척 후 동일 LOT 샘플 5개 이상 재검사
```

### dent

- 기준서명: 찍힘/변형 불량 조치 기준서
- 불량 유형: dent
- 체크리스트:

```text
- 기능면, 조립면, 리드, teeth, 모서리의 눌림/패임 위치 기록
- capsule squeeze, metal_nut bent, transistor bent_lead, zipper squeezed_teeth 여부 확인
- 적재 높이, 제품 간격, 트레이 완충재 상태 확인
- 이송 속도 로그와 급정지/충돌 알람 확인
- 기능면 dent 의심품은 품질관리자 승인 전 격리
```

### flip

- 기준서명: 방향 오류/Flip 불량 조치 기준서
- 불량 유형: flip
- 체크리스트:

```text
- 정상 샘플과 비교해 부품 앞뒤/상하 방향, 체결면 노출 방향, 기준 홈 위치를 확인
- bowl feeder, orientation rail, escapement, pick-and-place 흡착 방향 설정 점검
- 동일 LOT 샘플 5개 이상 재검사해 flip 재발 여부와 방향 보정값을 기록
- vision recipe 기준 샘플, ROI, rotation tolerance 변경 여부 확인
```

### crack

- 기준서명: 균열 불량 조치 기준서
- 불량 유형: crack
- 체크리스트:

```text
- 기능부 또는 관통 균열 의심 시 설비 즉시 정지
- tile/capsule/bottle/hazelnut/pill 원본 이미지에서 branching, 파단 경계 확인
- broken_large, broken_small, pill crack, hazelnut crack 여부 기록
- 가압 조건, 냉각 시간, 원자재 LOT 변경 이력 확인
- 시험 생산품 5개 이상 정상 확인 후 생산 재개 승인
```

## 일괄 업로드

백엔드가 `http://localhost:4000`에서 실행 중이면 아래 명령으로 5개 기준서를 한 번에 등록할 수 있습니다.

```powershell
pwsh -ExecutionPolicy Bypass -File docs\manuals\upload-rag-manuals.ps1
```

백엔드 주소가 다르면 첫 번째 인자로 전달합니다.

```powershell
pwsh -ExecutionPolicy Bypass -File docs\manuals\upload-rag-manuals.ps1 http://localhost:4001
```

## 업로드 후 확인 질문 예시

Agent 화면에서 아래 질문으로 RAG 검색 품질을 확인합니다.

```text
metal_nut scratch면 fixture랑 deburring 중 어디를 먼저 봐야 해?
metal_nut flip이면 bowl feeder랑 vision recipe 중 어디를 먼저 봐야 해?
tile oil contamination이면 어떤 설비를 확인해야 해?
transistor bent_lead가 dent로 잡히면 조치 순서가 뭐야?
bottle broken_small이면 생산을 바로 멈춰야 해?
pill crack이면 press 조건과 건조 조건 중 무엇을 확인해야 해?
```
