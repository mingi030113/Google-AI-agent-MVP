# 찍힘/변형 불량 조치 기준서

- 문서번호: QA-MVTEC-DEN-001
- 개정: Rev. 2026-06-29
- 적용 불량 유형: dent
- 적용 데이터셋: MVTec AD 데모 이미지 및 앱 확장 taxonomy
- 대표 카테고리: capsule, metal_nut, transistor, cable, zipper, bottle
- 담당: 품질관리자, 공정관리자, 현장 작업자

## 1. 목적

MVTec AD 데모 앱에서 국부 눌림, 패임, 찌그러짐, 충격 흔적, 형상 변형이 의심될 때 Agent가 스크래치, 균열, 오염과 구분하여 조치 기준을 제안하도록 한다.

MVTec AD 원본 taxonomy에는 `dent`라는 단일 결함명이 많지 않다. 이 기준서는 앱의 `dent` 유형을 MVTec AD의 `bent`, `squeeze`, `damaged_case`, `misplaced`, `squeezed_teeth` 등 형상 변형 계열 결함과 연결하기 위한 운영 기준서이다.

## 2. 적용 범위

| 카테고리 | 가능한 시각 단서 | 우선 판정 |
| --- | --- | --- |
| metal_nut | 금속 표면의 국부 패임, 모서리 눌림, 원형 충격 흔적 | dent |
| capsule | 캡슐 shell 눌림, 찌그러짐, 국부 변형 | dent |
| transistor | 리드 휨, 케이스 손상, 부품 위치 어긋남 | dent 또는 deformation |
| cable | wire 휨, 피복 눌림, cable swap과 구분 필요한 형상 이상 | dent 의심 |
| zipper | teeth 눌림, squeezed teeth, split teeth와 구분 | dent 또는 assembly deformation |
| bottle | 병 입구, 바닥, 측면의 눌림 또는 변형 | dent |
| tile | 표면이 깨지지 않았지만 국부적으로 파인 흔적 | dent 또는 crack 구분 |

## 3. MVTec AD 세부 결함명 매핑

Agent는 아래 결함명 또는 표현을 dent/변형 기준서와 연결한다.

| MVTec AD 결함명 또는 표현 | dent/변형으로 보는 조건 | 현장 해석 |
| --- | --- | --- |
| `capsule/squeeze` | 캡슐 shell이 눌리거나 타원형으로 변형 | 과압, 적재 하중, feeder 압착 |
| `capsule/poke` | 표면이 찢어진 균열보다 국부 압흔/구멍 중심 | 핀/돌출부 접촉, guide pin 간섭 |
| `metal_nut/bent` | nut 외곽, 체결면, chamfer가 휘거나 눌림 | 프레스/fixture 압력, 낙하 충격 |
| `metal_nut/bent` | nut 외곽, chamfer, 체결면이 눌리거나 휘어 정상 외곽선과 다름 | feeding 충격, fixture 압력 과다 |
| `transistor/bent_lead` | 리드가 휘어짐 | insertion jig, pick-and-place, tray 간섭 |
| `transistor/damaged_case` | 케이스 모서리 깨짐보다 눌림/찌그러짐이 중심 | 취급 충격, press force 과다 |
| `transistor/misplaced` | 부품 위치가 정상 기준에서 벗어남 | 조립 jig 정렬, suction nozzle 위치 |
| `cable/bent_wire` | wire가 기준 위치에서 꺾임 | cable routing guide, clamp 압력 |
| `zipper/squeezed_teeth` | teeth가 눌려 간격이 좁아짐 | press/roller 압력, 가이드 간격 |

다음은 dent와 혼동되지만 다른 기준서를 우선 적용한다.

- 표면 위 이물, 얼룩, glue, oil이면 contamination 기준서.
- 길고 얕은 선형 마찰이면 scratch 기준서.
- 갈라짐, 파단, 관통 또는 벌어진 경계가 있으면 crack 기준서.
- 단순 위치 어긋남은 dent가 아니라 조립/정렬 불량으로 기록하되, 앱 유형은 dent로 임시 분류할 수 있다.

## 4. 판정 기준

다음 중 하나 이상이면 dent로 분류한다.

- 결함이 선형 흠집이 아니라 면 형태의 눌림 또는 패임이다.
- 제품 외곽선, 모서리, 구멍 주변 형상이 정상 샘플과 다르게 변형되어 있다.
- 밝기 변화가 충격 중심을 기준으로 원형 또는 타원형으로 나타난다.
- PatchCore heatmap이 국부적인 면 영역에 집중되고, 원본 이미지에서 형상 변형이 확인된다.
- Gemini labeler가 `dent`, `deformation`, `depressed`, `impact mark`, `dimple`을 근거로 제시한다.

다음은 dent로 단정하지 않는다.

- 길고 좁은 선형 손상은 scratch 기준서를 우선 적용한다.
- 표면이 벌어지거나 실제 파단선이 있으면 crack 기준서를 우선 적용한다.
- 표면 위 이물이나 얼룩이면 contamination 기준서를 우선 적용한다.
- 정상 제품의 그림자, 조명 반사, 패턴 변화만으로 형상 변형을 확정하지 않는다.

## 5. 등급 기준

| 등급 | 이미지 기준 | 처리 기준 |
| --- | --- | --- |
| High | 기능면, 조립 기준면, 밀봉면, 금속 체결면에 찍힘 또는 변형 | LOT 격리, 해당 구간 통과품 추가 검사, 품질관리자 승인 전 출하 금지 |
| Medium | 외관면의 명확한 눌림, 동일 위치 반복, 이송/적재 직후 집중 | 이송 속도, 적재 높이, 트레이 상태 점검 |
| Low | 비기능면 단발성 미세 패임, 판정 불확실 | 정상 샘플 비교, 샘플 재검사, 예방 점검 기록 |

## 6. PatchCore 및 Gemini 판단 근거 활용

- heatmap이 넓은 점상 또는 면 형태이고 원본 이미지에서 표면 높낮이 변화가 보이면 dent 가능성을 높게 본다.
- heatmap이 모서리 또는 체결면 주변에 집중되면 기능 영향 가능성을 High로 본다.
- Gemini가 dent를 추정하더라도 원본 이미지에서 형상 변형이 보이지 않으면 `dent 의심`으로 기록하고 정상 샘플 비교를 요구한다.
- crack과 혼동될 때는 벌어진 선, 파단, 갈라짐이 있는지 우선 확인한다.
- scratch와 혼동될 때는 선형 마찰 흔적인지, 면 단위 눌림인지 비교한다.

## 7. 카테고리별 원인 후보와 확인 방법

| 원인 후보 | MVTec AD 대응 해석 | 확인 위치 | 확인 방법 | 우선순위 |
| --- | --- | --- | --- | --- |
| 적재 높이 초과 | 제품 간 압착, 국부 패임 | 적재 랙, 트레이 | 적재 단수, 제품 간격, 하중 집중 확인 | High |
| 이송 급정지 또는 충돌 | 일정 위치 반복 찍힘 | 컨베이어, 로봇 이송 구간 | 속도 로그, 급정지 알람, 센서 이력 확인 | High |
| 트레이/완충재 파손 | 모서리 또는 특정 면 반복 손상 | 트레이, 포장재, 보관 랙 | 완충재 누락, 고정핀 손상, 트레이 균열 확인 | Medium |
| 수동 취급 중 낙하 | 위치가 불규칙한 단발성 찍힘 | 작업자 이동 구간 | CCTV, 작업 동선, 임시 적치 위치 확인 | Medium |
| 조명/그림자 오인 | 정상 형상을 변형으로 오인 | 원본 이미지, 정상 샘플 | 촬영 각도와 정상 샘플 비교 | Low |

### 7.1 카테고리별 우선 점검

| 카테고리 | 먼저 볼 위치 | 구체 조치 |
| --- | --- | --- |
| capsule | feeder 압착부, chute, 적재 tray | 압착 흔적 확인, tray 높이 조정, shell squeeze 재발 검사 |
| metal_nut | press/fixture, deburring 후 이송, bulk feeder | fixture 압력 확인, 낙하 높이 확인, 방향 flip 발생 여부 점검 |
| transistor | pick-and-place nozzle, lead forming jig, insertion guide | nozzle 위치 보정, lead guide 간격 확인, bent lead 샘플 추가 검사 |
| cable | clamp, routing guide, crimping 전후 구간 | clamp 압력 조정, wire guide 간격 확인, bent wire 반복 위치 기록 |
| zipper | roller/press, teeth guide, 포장 압착 구간 | roller 압력 낮춤, teeth spacing 확인, squeezed teeth 재발 검사 |
| bottle | 입구/바닥 guide, 적재/보관 tray | 병 입구 눌림, 바닥 변형, stacking 하중 확인 |

## 8. 즉시 조치 절차

1. 찍힘 위치가 기능면, 조립면, 외관면, 모서리 중 어디인지 기록한다.
2. 동일 LOT와 같은 이송/적재 구간 통과품을 보류한다.
3. 형상 기준선을 정상 샘플과 비교한다. 외곽선, 리드 위치, teeth 간격, shell 타원율을 우선 본다.
4. 적재 높이, 제품 간 간격, 트레이 칸막이와 완충재 상태를 확인한다.
5. 이송 속도 로그, 급정지 알람, 충돌 가능 구간을 확인한다.
6. 기능면, 체결면, 리드, teeth, 밀봉면 dent이면 품질관리자 승인 전까지 출하하지 않는다.
7. 트레이 또는 완충재가 손상되었으면 즉시 교체하고 해당 구간 통과품을 추가 검사한다.
8. 동일 조건 샘플 5개 이상을 재검사한다.

## 9. 추가 검사 및 종료 기준

조치는 다음을 모두 만족할 때 종료한다.

- dent 위치와 크기, 기능 영향 가능성이 기록되어 있다.
- 적재 높이, 이송 속도, 급정지 알람, 트레이 상태 점검 결과가 있다.
- 손상 트레이 또는 완충재 교체 여부가 기록되어 있다.
- 동일 LOT 샘플 5개 이상에서 dent가 재발하지 않는다.
- 기능면 또는 조립 기준면 의심품은 품질관리자가 격리 해제 여부를 승인했다.

다음이면 조치를 종료하지 않는다.

- 같은 위치의 찍힘이 같은 설비 또는 작업자 구간에서 반복된다.
- 급정지 알람 원인이 해소되지 않았다.
- 정상 샘플 비교 없이 그림자/반사 오인을 배제하지 않았다.

## 10. Agent 답변 규칙

Agent는 dent 질문에 답할 때 다음 순서로 말한다.

1. 먼저 "형상 변화가 실제인지 정상 샘플 외곽선과 비교"를 요구한다.
2. `capsule/squeeze`는 압착/적재, `metal_nut/bent`는 fixture/낙하, `transistor/bent_lead`는 insertion jig, `zipper/squeezed_teeth`는 roller 압력을 우선 제안한다.
3. 기능부, 조립 기준면, 리드, 체결면, 밀봉면 변형은 High로 보고 LOT 격리와 승인 전 출하 금지를 포함한다.
4. 단순 색 변화나 조명 그림자라면 dent 확정이 아니라 재촬영/정상 샘플 비교로 답한다.

## 11. 작업자 전달 문구

찍힘 또는 국부 변형 의심 결함이 확인되었습니다. 적재 높이, 트레이 완충재, 이송 급정지 로그를 먼저 확인하고 기능면 또는 조립면 손상 가능성이 있으면 품질관리자 승인 전까지 LOT를 격리해 주세요. 동일 조건 샘플을 재검사해 변형이 재발하지 않는지 확인해 주세요.

## 12. 기록 항목

- 검사 ID, LOT 번호, 제품 카테고리
- dent 위치, 크기, 기능 영향 가능성
- anomalyScore, threshold, heatmap 위치
- 적재 높이와 제품 간격
- 이송 속도와 급정지 알람
- 트레이/완충재 교체 여부
- 추가 검사 수량과 결과
- 품질관리자 승인 여부

## 13. Agent 검색 키워드

dent, 찍힘, 눌림, 패임, deformation, depressed, impact mark, dimple, squeeze, bent, bent_lead, bent_wire, damaged_case, misplaced, squeezed_teeth, metal_nut bent, capsule squeeze, transistor bent_lead, cable bent_wire, zipper squeezed_teeth, bottle deformation, 적재 높이, 급정지, 완충재, 트레이 파손, press pressure, fixture pressure, heatmap 국부
