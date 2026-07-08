# 방향 오류/Flip 불량 조치 기준서

- 문서번호: QA-MVTEC-FLP-001
- 개정: Rev. 2026-07-08
- 적용 불량 유형: flip
- 적용 데이터셋: MVTec AD metal_nut 및 앱 확장 taxonomy
- 대표 카테고리: metal_nut, cable, transistor, zipper, 조립/이송 방향 검사 라인
- 담당: 품질관리자, 공정관리자, 현장 작업자

## 1. 목적

제품이 정상 기준 방향과 다르게 뒤집히거나 회전된 상태로 검사, 이송, 조립되는 경우 Agent가 스크래치, 찍힘, 오염, 균열과 구분하여 조치 기준을 제안하도록 한다.

`flip`은 표면 손상보다는 방향/정렬/투입 상태 이상이다. 특히 metal_nut에서는 체결면, chamfer, 기준 홈, 내경/외경 패턴이 정상 샘플과 반대로 보이거나 기준 위치에서 벗어난 경우를 우선 대상으로 한다.

## 2. 적용 범위

| 카테고리 | 가능한 시각 단서 | 우선 판정 |
| --- | --- | --- |
| metal_nut | 기준 홈, chamfer, 체결면 또는 내경 패턴이 정상 샘플과 반대로 보임 | flip |
| cable | connector 방향, wire routing 또는 clamp 방향이 반대 | flip 또는 assembly orientation |
| transistor | lead 방향, marking 면, body orientation이 반대 | flip 또는 misplaced |
| zipper | teeth 방향 또는 체결 방향이 반대 | flip 또는 assembly orientation |
| 일반 조립품 | 기준면, 로고, 홀 위치가 정상 fixture 기준과 반대 | flip |

## 3. MVTec AD 세부 결함명 매핑

Agent는 아래 결함명 또는 표현을 flip 기준서와 연결한다.

| MVTec AD 결함명 또는 표현 | flip으로 보는 조건 | 현장 해석 |
| --- | --- | --- |
| `metal_nut/flip` | nut 방향이 뒤집혀 정상 기준면과 다른 면이 노출됨 | bowl feeder 방향 선별 실패, orientation rail 설정 오류 |
| `transistor/misplaced` 일부 | 단순 위치 이동보다 방향 반전 또는 lead 방향 오류가 중심 | pick-and-place 회전각, tray 방향 오류 |
| `cable/swap` 일부 | cable routing 또는 connector 방향이 정상 기준과 반대 | 조립 순서 오류, clamp guide 방향 오류 |
| `zipper/fabric_border` 일부 | 기준 방향이 바뀌어 teeth/천 위치가 반대로 보임 | feeding 방향 오류, guide 기준면 반전 |

다음은 flip과 혼동되지만 다른 기준서를 우선 적용한다.

- 방향은 정상이고 표면에 선형 손상이 있으면 scratch 기준서.
- 방향은 정상이고 형상 자체가 휘거나 눌렸으면 dent 기준서.
- 방향은 정상이고 색상 얼룩, 이물, 오일막이면 contamination 기준서.
- 방향은 정상이고 파단, 균열, 결손이면 crack 기준서.

## 4. 판정 기준

다음 중 하나 이상이면 flip으로 분류한다.

- 정상 샘플 대비 기준 홈, chamfer, 홀 위치, 로고, marking, 체결면 방향이 반대다.
- 제품 중심은 검출되지만 기준면 또는 위/아래 면이 정상과 다르다.
- 동일 설비에서 같은 방향 오류가 반복된다.
- PatchCore heatmap이 표면 손상 위치가 아니라 제품 전체 윤곽 또는 기준 특징 위치 차이에 집중된다.
- Gemini labeler가 `flip`, `orientation`, `reversed`, `upside down`, `wrong side`, `misoriented`를 근거로 제시한다.

다음은 flip으로 단정하지 않는다.

- 단순 회전 허용 범위 안의 각도 차이는 정상 또는 재촬영 대상으로 본다.
- 조명 반사 때문에 기준면이 다르게 보이는 경우 정상 샘플과 재촬영 비교를 먼저 한다.
- 형상 변형 때문에 방향이 다르게 보이는 경우 dent 기준서를 함께 검토한다.

## 5. 등급 기준

| 등급 | 이미지 기준 | 처리 기준 |
| --- | --- | --- |
| High | 조립/체결 기준면이 반대로 들어가 기능 불량 또는 후공정 막힘 가능 | LOT 격리, 설비 정지 후 feeder/정렬부 즉시 점검 |
| Medium | 방향 오류가 단발 또는 일부 샘플에서 반복, 후공정 보정 가능 | orientation rail, vision 기준점, pick angle 점검 |
| Low | 방향 오류 의심이나 정상 샘플/조명 영향 구분 필요 | 재촬영, 정상 샘플 비교, 작업자 확인 |

## 6. PatchCore 및 Gemini 판단 근거 활용

- heatmap이 특정 긁힘이나 오염 spot보다 제품 윤곽, 내경/외경, 기준 홈 주변에 넓게 분포하면 flip 가능성을 높게 본다.
- metal_nut에서는 정상 샘플과 내경 highlight, chamfer 위치, 체결면 노출 방향을 비교한다.
- Gemini가 flip을 추정했지만 원본 이미지에서 기준면 차이가 확인되지 않으면 `flip 의심`으로 기록하고 재촬영을 요구한다.
- scratch/dent와 혼동될 때는 결함이 제품 표면 손상인지, 제품 방향 자체의 오류인지 먼저 분리한다.

## 7. 카테고리별 원인 후보와 확인 방법

| 원인 후보 | MVTec AD 대응 해석 | 확인 위치 | 확인 방법 | 우선순위 |
| --- | --- | --- | --- | --- |
| bowl feeder 방향 선별 실패 | metal_nut flip 반복 | bowl feeder, orientation rail | rail 폭, 진동 세기, stopper 마모, 방향 선별 reject 동작 확인 | High |
| escapement/stopper 위치 불량 | 일정 간격으로 반전품 유입 | escapement, stopper | stopper 높이, timing, 역방향 통과 가능성 확인 | High |
| pick-and-place 회전각 오류 | 집기 후 방향 반전 | robot, gripper, suction nozzle | pick angle, place angle, gripper 기준점, recipe revision 확인 | High |
| vision 기준점 등록 오류 | 정상품을 flip으로 오판 또는 반대 | camera, vision recipe | 기준 샘플 재등록, ROI, rotation tolerance, template 방향 확인 | Medium |
| 작업자 수동 투입 방향 오류 | 특정 작업자/교대조에서 발생 | 수동 투입대, 작업 표준 | 투입 방향 표준 표시, 작업자 교육, jig poka-yoke 확인 | Medium |

### 7.1 metal_nut 우선 점검

| 점검 위치 | 구체 조치 |
| --- | --- |
| bowl feeder | 진동 조건, 방향 선별 홈, rail 막힘, reject gate 동작 확인 |
| orientation rail | rail 폭, chamfer 기준면 통과 조건, 역방향 통과 여부 확인 |
| escapement | stopper 마모, timing offset, 2개 동시 공급 여부 확인 |
| vision recipe | normal 기준 이미지, ROI, rotation tolerance, flip template 등록 상태 확인 |
| pick-and-place | 흡착면, 회전각, place 방향, gripper 기준점 보정 |

## 8. 즉시 조치 절차

1. 정상 샘플과 비교해 기준 홈, chamfer, 체결면, 홀 방향이 반대인지 확인한다.
2. flip 의심품과 동일 LOT를 보류하고 같은 설비 통과품을 우선 샘플링한다.
3. bowl feeder와 orientation rail의 방향 선별 조건을 확인한다.
4. escapement, stopper, reject gate가 역방향 제품을 통과시키는지 확인한다.
5. vision recipe의 기준 샘플, ROI, rotation tolerance를 확인한다.
6. pick-and-place 회전각과 gripper 기준점이 최근 변경되었는지 확인한다.
7. 동일 조건 샘플 5개 이상을 재검사해 flip 재발 여부를 확인한다.

## 9. 추가 검사 및 종료 기준

조치는 다음을 모두 만족할 때 종료한다.

- flip 발생 위치, 방향, 정상 샘플과의 차이가 기록되어 있다.
- feeder, orientation rail, escapement, vision recipe 점검 결과가 있다.
- 조정 후 동일 LOT 샘플 5개 이상에서 flip이 재발하지 않는다.
- 후공정 체결/조립 기준면에 영향이 없음을 품질관리자가 확인했다.

다음이면 조치를 종료하지 않는다.

- 같은 설비에서 flip이 반복된다.
- orientation rail 또는 reject gate 조정값이 기록되지 않았다.
- 정상 샘플 비교 없이 조명/촬영 각도 문제를 배제하지 않았다.

## 10. Agent 답변 규칙

Agent는 flip 질문에 답할 때 다음 순서로 말한다.

1. 먼저 "표면 손상인지 방향 오류인지 정상 샘플과 기준면을 비교"하라고 안내한다.
2. metal_nut flip이면 bowl feeder, orientation rail, escapement, vision recipe를 우선 점검 대상으로 제안한다.
3. 후공정 체결/조립 기준면이 반대이면 High로 보고 LOT 격리와 설비 정지 점검을 포함한다.
4. 단순 조명/촬영 각도 가능성이 있으면 재촬영과 정상 샘플 비교를 포함한다.

## 11. 작업자 전달 문구

방향 오류 또는 flip 의심 결함이 확인되었습니다. 정상 샘플과 기준 홈, chamfer, 체결면 방향을 비교하고 bowl feeder와 orientation rail의 방향 선별 조건을 먼저 확인해 주세요. 동일 LOT 샘플을 재검사해 flip이 재발하지 않는지 기록해 주세요.

## 12. 기록 항목

- 검사 ID, LOT 번호, 제품 카테고리
- flip 방향, 기준면 차이, 정상 샘플 비교 결과
- anomalyScore, threshold, heatmap 위치
- feeder, orientation rail, escapement 점검 결과
- vision recipe 기준 샘플/ROI/rotation tolerance 변경 여부
- 추가 검사 수량과 결과
- 품질관리자 승인 여부

## 13. Agent 검색 키워드

flip, 방향 오류, 정렬 오류, orientation, misorientation, reversed, upside down, wrong side, metal_nut flip, 기준면 반전, chamfer 방향, 체결면 방향, bowl feeder, orientation rail, escapement, reject gate, pick angle, place angle, gripper 기준점, vision recipe, rotation tolerance, 정상 샘플 비교
