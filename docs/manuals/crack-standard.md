# 균열 불량 조치 기준서

- 문서번호: QA-MVTEC-CRA-001
- 개정: Rev. 2026-06-29
- 적용 불량 유형: crack
- 적용 데이터셋: MVTec AD 데모 이미지
- 대표 카테고리: tile, capsule, bottle, hazelnut, pill
- 담당: 품질관리자, 공정관리자, 설비 담당자, 현장 작업자

## 1. 목적

MVTec AD 기반 AI 품질검사에서 제품 표면 또는 구조부의 갈라짐, 파단, 미세 균열, 깨짐이 검출되었을 때 Agent가 생산 중지, LOT 격리, 원인 확인, 재검사 조건을 일관되게 제안하도록 한다.

이 기준서는 `crack`, `균열`, `갈라짐`, `파단`, `fracture` 관련 질문에서 우선 검색되어야 한다.

## 2. MVTec AD 적용 범위

| 카테고리 | 대표 이미지 예 | 주요 시각 단서 | 우선 판정 |
| --- | --- | --- | --- |
| tile | `crack-tile.png` | 타일 표면을 가로지르는 어두운 갈라짐, 여러 갈래 균열 | crack |
| capsule | `crack-capsule.png` | 캡슐 shell 갈라짐, 표면 벌어짐, 파단선 | crack 또는 scratch 구분 |
| bottle | `broken_large`, `broken_small` | 병 입구/바닥/측면의 깨짐, 파손 경계, 결손 | crack 또는 broken |
| hazelnut | `crack`, `cut`, `hole` 일부 | 껍질 또는 표면의 갈라짐, 절단, 파인 결손 | crack/cut 구분 |
| pill | `crack` | 알약 코팅 또는 몸체의 갈라짐, 파단선 | crack |
| metal_nut | 체결부 또는 모서리의 파단선, 소재 균열 | crack 의심 |

## 3. MVTec AD 세부 결함명 매핑

Agent는 아래 결함명 또는 표현을 crack 기준서와 연결한다.

| MVTec AD 결함명 또는 표현 | crack으로 보는 조건 | 현장 해석 |
| --- | --- | --- |
| `tile/crack` | 타일 표면을 가로지르는 어두운 선, branching, 표면 분리 | 소재 취성, 충격, 절단/이송 응력 |
| `capsule/crack` | shell 갈라짐, 벌어진 파단선, 코팅층 분리 | 성형/건조 조건, 이송 충격, 과압 |
| `bottle/broken_large`, `bottle/broken_small` | 입구/바닥/측면 결손, 깨진 경계 | 취급 충격, guide 충돌, 병 입구 체결 하중 |
| `hazelnut/crack` | 표면이나 껍질이 갈라짐 | 원자재 취성, 충격, 선별기 압력 |
| `hazelnut/cut`, `hazelnut/hole` | 절단 또는 구멍이 파단과 연결됨 | 절단날/선별기 접촉, 원자재 손상 |
| `pill/crack` | 알약 표면 또는 몸체의 갈라진 선 | 압축 성형 조건, 코팅 건조, 이송 충격 |
| `wood/hole`, `leather/cut` 일부 | 표면층이 실제로 찢기거나 벌어짐 | crack-like damage로 기록 후 카테고리 기준 재검토 |

다음은 crack과 혼동되지만 다른 기준서를 우선 적용한다.

- 얕고 표면 위를 스친 선은 scratch 기준서.
- 오일, glue, 섬유, 금속 이물처럼 표면 위 물질이면 contamination 기준서.
- 벌어진 선이 없고 면이 눌린 형태면 dent 기준서.
- 타일의 정상 speckle, 목재 결, 조명 경계는 정상 샘플과 비교한다.

## 4. 판정 기준

다음 중 하나 이상이면 crack으로 분류한다.

- 결함이 단순 표면 흠집이 아니라 벌어진 선, 틈, 파단 경계를 가진다.
- 타일, 캡슐, 병, 금속 부품의 기능부 또는 모서리에서 갈라짐이 보인다.
- 선형 결함 주변에 불규칙한 파손 경계나 가지 형태 branching이 있다.
- PatchCore heatmap이 균열 경로를 따라 길게 활성화되고, 원본 이미지에서 표면 분리 또는 파단이 확인된다.
- Gemini labeler가 `crack`, `fracture`, `split`, `broken`, `fissure`를 근거로 제시한다.

다음은 crack으로 단정하지 않는다.

- 표면 위 얕은 긁힘만 있으면 scratch 기준서를 우선 적용한다.
- 얼룩, 잔류물, 섬유처럼 표면에 얹힌 결함이면 contamination 기준서를 우선 적용한다.
- 면 형태의 눌림이나 패임이면 dent 기준서를 우선 적용한다.
- 타일 정상 패턴 또는 조명 경계가 균열처럼 보이는 경우 정상 샘플과 비교한다.

## 5. 등급 기준

| 등급 | 이미지 기준 | 처리 기준 |
| --- | --- | --- |
| High | 기능부 균열, 관통 균열, tile 다중 균열, capsule shell 파단, bottle 파손 | 설비 정지, LOT 전량 격리, 품질관리자와 설비 담당자 즉시 호출 |
| Medium | 외관부 미세 균열, 모서리 갈라짐, 원자재/성형 조건 변경 직후 발생 | 조건 복원, 샘플 확대 재검사, 원자재 LOT 확인 |
| Low | 단발성 미세 파손 의심, 정상 패턴과 구분 불명확 | 정상 샘플 비교, 재촬영, 예방 점검 기록 |

## 6. PatchCore 및 Gemini 판단 근거 활용

- `anomalyScore`가 threshold보다 높고 heatmap이 균열 경로를 따라 활성화되면 crack 가능성을 높게 본다.
- heatmap이 선형이어도 표면이 벌어지지 않았으면 scratch 가능성을 재검토한다.
- 타일의 정상 speckle pattern 또는 조명 경계가 균열로 오인될 수 있으므로 정상 tile 샘플과 비교한다.
- Gemini가 crack을 추정했지만 defectScores가 scratch와 유사하면 원본 이미지에서 틈, branching, 파단 경계가 있는지 확인한다.
- 기능부 또는 관통 균열은 confidence와 무관하게 High 등급으로 처리한다.

## 7. 카테고리별 원인 후보와 확인 방법

| 원인 후보 | MVTec AD 대응 해석 | 확인 위치 | 확인 방법 | 우선순위 |
| --- | --- | --- | --- | --- |
| 성형/가압 조건 이탈 | capsule shell 또는 금속/병 구조부 파손 | 성형기, 프레스, 가압 설비 | 압력 설정값, 알람, 최근 조건 변경 이력 확인 | High |
| 냉각 시간 부족 또는 편차 | tile/capsule 미세 균열, 수축 파손 | 냉각 구간, 배출 구간 | 냉각 시간 로그, 배출 온도, 냉각수 상태 확인 | High |
| 원자재 LOT 문제 | 동일 원자재에서 반복 균열 | 원자재 투입 기록 | 변경 시점, 성적서, 입고 검사 결과 확인 | High |
| 금형/치공구 정렬 불량 | 특정 위치 반복 crack | 금형, 지그, 클램프 | 체결 상태, 편심, 마모, 정렬 기준 확인 | Medium |
| 절단/취급 충격 | 모서리 파손 또는 국부 crack | 절단날, 이송/적재 구간 | 절단날 마모, 낙하 가능성, 급정지 로그 확인 | Medium |

### 7.1 카테고리별 우선 점검

| 카테고리 | 먼저 볼 위치 | 구체 조치 |
| --- | --- | --- |
| tile | 절단/이송 구간, 충격 가능 위치, 적재 rack | 충격 흔적 확인, rack 완충재 교체, 정상 tile pattern과 비교 |
| capsule | 성형/건조 조건, feeder 압착부, chute | 건조 시간/온도 확인, feeder 압력 조정, shell crack 반복 위치 확인 |
| bottle | 입구 guide, cap 체결부, 바닥 지지부, 적재 tray | 깨진 edge 위치 기록, guide 간섭 확인, broken large/small 샘플 격리 |
| hazelnut | 선별기 압력, 절단/분류 blade, 원자재 LOT | 원자재 취성 확인, 선별 압력 낮춤, crack/cut/hole 재분류 |
| pill | tablet press, 코팅/건조, feeder 충격 구간 | 압축 하중 확인, 건조 조건 확인, coating crack과 body crack 구분 |
| metal_nut | press/fixture, 체결면, deburring 후 이송 | 소재 균열 여부 확인, fixture 정렬, 낙하/충돌 구간 점검 |

## 8. 즉시 조치 절차

1. 균열 위치, 방향, 길이, branching 여부, 관통 여부를 기록한다.
2. 기능부, 밀봉부, 체결부, 관통 균열이면 설비를 즉시 정지하고 LOT를 격리한다.
3. crack인지 scratch인지 원본 이미지를 확대해 벌어진 틈, 파단 경계, branching을 확인한다.
4. 카테고리별 우선 점검표에 따라 성형/건조/절단/이송/적재 조건을 확인한다.
5. 가압/성형 조건 이탈 알람과 최근 설정값 변경 이력을 확인한다.
6. 냉각 시간, 배출 온도, 원자재 LOT 변경 시점을 확인한다.
7. 금형 정렬, 지그 체결, 절단날 마모 상태를 확인한다.
8. 조건을 표준값으로 복원한 뒤 시험 생산품을 검사한다.
9. 품질관리자와 공정관리자 승인 전까지 생산 재개 또는 출하를 하지 않는다.

## 9. 재검사 및 생산 재개 기준

생산 재개는 다음을 모두 만족할 때만 가능하다.

- 균열 위치와 기능 영향 판단이 기록되어 있다.
- 가압 조건, 냉각 시간, 금형 정렬, 원자재 LOT 점검 결과가 있다.
- 조건 이탈이 확인된 경우 표준 조건으로 복원되었다.
- 시험 생산품 5개 이상에서 crack이 재발하지 않는다.
- 재검사 이미지에서 heatmap이 균열 경로에 재발하지 않는다.
- 품질관리자와 공정관리자가 재개를 승인했다.

다음이면 생산을 재개하지 않는다.

- 동일 원자재 LOT 또는 동일 설비 조건에서 균열이 반복된다.
- 기능부 또는 관통 균열이 하나라도 추가 확인된다.
- 조건 로그가 누락되어 원인을 확인할 수 없다.

## 10. Agent 답변 규칙

Agent는 crack 질문에 답할 때 다음 순서로 말한다.

1. 먼저 "관통/기능부/밀봉부 균열 여부"를 확인하고, 해당하면 즉시 설비 정지와 LOT 격리를 말한다.
2. `tile/crack`은 충격/적재/절단, `capsule/crack`은 성형/건조/feeder 압착, `bottle/broken`은 guide 충돌/체결 하중, `pill/crack`은 tablet press/건조 조건을 우선 제안한다.
3. heatmap이 선형이어도 원본 이미지에 벌어진 틈이 없으면 scratch 가능성을 함께 언급한다.
4. 생산 재개 조건은 "조건 복원, 시험 생산품 5개 이상 정상, 품질관리자와 공정관리자 승인"을 반드시 포함한다.

## 11. 작업자 전달 문구

균열 의심 결함이 확인되었습니다. 기능부 또는 관통 균열이면 설비를 즉시 정지하고 LOT를 격리해 주세요. 가압 조건, 냉각 시간, 원자재 LOT 변경 여부를 확인하고, 조건 복원 후 시험 생산품 5개 이상이 정상으로 확인될 때까지 생산을 재개하지 마세요.

## 12. 기록 항목

- 검사 ID, LOT 번호, 제품 카테고리
- 균열 위치, 방향, 길이, 관통 여부
- anomalyScore, threshold, heatmap 위치
- 가압/성형 조건과 알람 이력
- 냉각 시간과 배출 온도
- 원자재 LOT 정보
- 금형/치공구 정렬 점검 결과
- 시험 생산품 검사 결과
- 생산 재개 승인자와 승인 시각

## 13. Agent 검색 키워드

crack, 균열, 갈라짐, 파단, fracture, split, fissure, broken, broken_large, broken_small, tile crack, capsule crack, bottle broken, hazelnut crack, hazelnut cut, pill crack, 관통 균열, branching, 가압 조건, 냉각 시간, 원자재 LOT, tablet press, guide 충돌, 생산 정지, heatmap 균열 경로
