# 이물/오염 불량 조치 기준서

- 문서번호: QA-MVTEC-CON-001
- 개정: Rev. 2026-06-29
- 적용 불량 유형: contamination
- 적용 데이터셋: MVTec AD 데모 이미지
- 대표 카테고리: bottle, tile, pill, leather, carpet, grid, wood
- 담당: 품질관리자, 공정관리자, 현장 작업자

## 1. 목적

MVTec AD 기반 AI 품질검사에서 제품 표면 또는 내부에 이물, 얼룩, 잔류물, 섬유, 오일막, 세척 자국이 검출되었을 때 Agent가 표준 조치와 재검사 기준을 제안하도록 한다.

이 기준서는 `contamination`, `오염`, `이물`, `residue`, `foreign material` 관련 질문에서 우선 검색되어야 한다.

## 2. MVTec AD 적용 범위

| 카테고리 | 대표 이미지 예 | 주요 시각 단서 | 우선 판정 |
| --- | --- | --- | --- |
| bottle | `contamination-bottle.png` | 병 내부 바닥 또는 링 주변의 흰 잔류물, 섬유, 얼룩, 흐림 | contamination |
| capsule | 표면에 묻은 먼지, 섬유, 얼룩, 인쇄와 무관한 점상 이물 | contamination 의심 |
| metal_nut | 금속 가공면 위의 먼지, 오일막, 금속분 | contamination 또는 scratch 구분 |
| pill | `contamination`, `color`, `combined` 일부 | 코팅 표면 이물, 색 번짐, 분말 부착, 오염 spot | contamination |
| tile | `oil`, `glue_strip` | 타일 표면의 오일막, 접착제 줄, 국부 얼룩 | contamination |
| leather | `glue`, `color` | 접착제 잔류, 색상 오염, 표면 이물 | contamination |
| carpet/grid | `metal_contamination`, `thread` | 금속 이물, 실/thread, 섬유성 부착물 | contamination |
| wood | `liquid`, `color`, `combined` 일부 | 액체 얼룩, 표면 변색, 오염 확산 | contamination |

## 3. MVTec AD 세부 결함명 매핑

Agent는 아래 결함명 또는 표현을 contamination 기준서와 연결한다.

| MVTec AD 결함명 또는 표현 | contamination으로 보는 조건 | 현장 해석 |
| --- | --- | --- |
| `bottle/contamination` | 병 내부 바닥, 입구 링, 홈 주변의 흰 잔류물 또는 이물 | 세척 잔류, 건조 부족, 포장 전 낙진 |
| `pill/contamination` | 알약 표면의 점상 이물, 분말, 코팅 잔류 | 코팅 분말 부착, feeder 오염, 정전기 부착 |
| `tile/oil` | 표면에 번진 유막 또는 반사성 얼룩 | 윤활유, 장갑 오염, 이송 roller 오염 |
| `tile/glue_strip` | 일정 폭의 접착제 줄 또는 끈적한 잔류 | 접착/라벨/보호필름 공정 잔류 |
| `leather/glue` | 표면 위 접착제 뭉침 또는 끌린 흔적 | 접착제 도포량 과다, nozzle 잔류 |
| `carpet/metal_contamination`, `grid/metal_contamination` | 금속성 밝은 입자 또는 이물 | 절삭 칩, 설비 마모분, 작업대 이물 |
| `carpet/thread`, `grid/thread` | 실, 섬유, 가느다란 이물 | 포장재 섬유, 작업복/장갑 섬유 낙진 |
| `wood/liquid`, `wood/color` | 액체 얼룩, 표면 변색 | 세척액, 오일, 습기, 도장/착색 오염 |

다음은 contamination과 혼동되지만 다른 기준서를 우선 적용한다.

- 길고 좁은 손상선이 표면을 파고들면 scratch 기준서.
- 갈라짐, 벌어짐, 파단 경계가 있으면 crack 기준서.
- 형상이 눌리거나 휘어 있으면 dent 기준서.
- 조명 반사나 정상 texture는 정상 샘플과 촬영 조건을 비교한다.

## 4. 판정 기준

다음 중 하나 이상이면 contamination으로 분류한다.

- 결함이 점상, 얼룩형, 섬유형, 뭉침형으로 보인다.
- 병 내부, 홈, 링 주변, 포장 전 표면에 이물 또는 잔류물이 보인다.
- 닦거나 세척하면 제거될 가능성이 있는 표면 부착물로 보인다.
- PatchCore heatmap이 넓은 얼룩형 또는 점상 영역에 활성화된다.
- Gemini labeler가 `contamination`, `foreign material`, `residue`, `fiber`, `stain`, `oil`을 근거로 제시한다.

다음은 contamination으로 단정하지 않는다.

- 길고 좁은 선형 흔적이면 scratch 기준서를 우선 적용한다.
- 표면이 벌어지거나 파단된 형태면 crack 기준서를 우선 적용한다.
- 표면 형상이 눌리거나 변형되었으면 dent 기준서를 우선 적용한다.
- 타일이나 금속의 정상 텍스처가 heatmap에 잡힌 경우 정상 샘플과 비교한다.

## 5. 등급 기준

| 등급 | 이미지 기준 | 처리 기준 |
| --- | --- | --- |
| High | 오일, 금속분, 제거 불가 이물, 병 내부 오염, 동일 LOT 반복 | LOT 격리, 세척/블로워 조건 점검, 재세척 전 출하 금지 |
| Medium | 먼지, 섬유, 세척 잔류물, 포장 전 대기 구역 반복 오염 | 청정도 점검, 재세척, 동일 LOT 샘플 재검사 |
| Low | 단발성 제거 가능 먼지, 정상 패턴과 구분이 애매함 | 현장 제거 후 예방 청소 기록과 샘플 확인 |

## 6. PatchCore 및 Gemini 판단 근거 활용

- `anomalyScore`가 threshold보다 높고 heatmap이 얼룩형이면 contamination 가능성을 높게 본다.
- heatmap이 병 내부 바닥, 병 입구 링, 홈, 모서리에 집중되면 세척/건조/보관 문제를 우선 의심한다.
- Gemini 추정이 contamination이고 원본 이미지에 residue, fiber, stain이 보이면 contamination 기준서를 적용한다.
- Gemini가 scratch와 혼동하면 결함이 선형인지, 닦으면 제거될 형태인지 먼저 비교한다.
- 정상 병 이미지에서도 내부 링 반사나 조명 반사가 이물처럼 보일 수 있으므로 정상 샘플과 비교한다.

## 7. 카테고리별 원인 후보와 확인 방법

| 원인 후보 | MVTec AD 대응 해석 | 확인 위치 | 확인 방법 | 우선순위 |
| --- | --- | --- | --- | --- |
| 세척 노즐 막힘 | bottle 내부 잔류물, 흐림, 얼룩 | 세척기 노즐, 필터 | 분사 패턴, 필터 막힘, 세척액 상태 확인 | High |
| 건조/블로워 조건 부족 | 물자국, 세척 잔류물, 점상 얼룩 | 에어 블로워, 건조 구간 | 압력, 풍량, 건조 시간 로그 확인 | High |
| 포장 전 대기 구역 오염 | 먼지, 섬유, 낙진 | 대기 테이블, 트레이, 커버 | 청소 상태, 덮개 사용, 낙진 여부 확인 | Medium |
| 작업자 장갑/공구 오염 | 국부 얼룩, 오일막 | 수동 취급 구간 | 장갑 교체, 공구 닦음 상태 확인 | Medium |
| 정상 반사/패턴 오인 | 병 내부 반사, 타일 패턴 | 원본 이미지, 정상 샘플 | 조명 반사 위치와 정상 패턴 비교 | Low |

### 7.1 카테고리별 우선 점검

| 카테고리 | 먼저 볼 위치 | 구체 조치 |
| --- | --- | --- |
| bottle | 세척 노즐, 필터, 건조/블로워, 병 내부 이송 jig | nozzle 막힘 확인, 필터 교체, 블로워 압력/시간 복원, 병 내부 재세척 |
| pill | coating drum, feeder bowl, 정렬판, 포장 전 대기 tray | 코팅 분말 제거, 정전기 제거, feeder 내부 닦음, 오염 pill LOT 격리 |
| tile | roller, 표면 보호필름, glue/oil 접촉 구간 | 오일 누유 확인, glue 잔류 제거, roller 세척, 보호필름 접착면 확인 |
| leather | glue nozzle, press plate, 이송 belt | nozzle 토출량 확인, press plate 닦음, belt 접착제 잔류 제거 |
| carpet/grid | 작업대, 커팅 구간, 금속 지그, 섬유 낙진 구간 | metal chip 흡입 청소, thread 제거, cover 적용, 작업복/장갑 점검 |
| wood | sanding 후 대기 구역, 도장/액체 취급 구간 | 액체 누출 확인, 습기 관리, 도장/착색 공정 분리, 표면 닦음 재검사 |

## 8. 즉시 조치 절차

1. 오염 유형을 먼지, 섬유, 오일, 금속분, 세척 잔류물, 반사 의심 중 하나로 기록한다.
2. 오염 제품과 동일 LOT 제품을 임시 보류한다.
3. 카테고리별 우선 점검표에 따라 세척, 건조, glue/oil, 금속 이물, 섬유 낙진 구간을 확인한다.
4. 포장 전 대기 구역, 트레이, 작업대, 커버 상태를 확인하고 청소한다.
5. 제거 가능한 오염은 재세척 또는 표면 닦음 후 Vision 검사와 육안 검사를 모두 수행한다.
6. 오일, glue, 금속분이면 단순 닦음으로 종료하지 않고 발생 설비를 확인한다.
7. 동일 LOT 샘플 5개 이상에서 오염 재발 여부를 확인한다.
8. 동일 위치 오염이 반복되면 세척/건조 조건 또는 작업대 청정도 기준을 재승인한다.

## 9. 재세척 및 종료 기준

조치는 다음을 모두 만족할 때 종료한다.

- 오염 유형과 발생 위치가 기록되어 있다.
- 세척 노즐, 필터, 블로워 압력, 대기 구역 점검 결과가 있다.
- 재세척 후 원본 이미지에서 오염물이 제거되었다.
- 재검사에서 `anomalyScore`가 threshold 이하이거나 heatmap이 오염 위치에 재발하지 않는다.
- 동일 LOT 샘플 5개 이상에서 contamination이 재발하지 않는다.

다음이면 조치를 종료하지 않는다.

- 오일 또는 금속분 오염 원인을 확인하지 못했다.
- 동일 위치 오염이 반복되지만 세척/건조 로그가 누락됐다.
- 정상 반사인지 이물인지 판단이 불명확한데 정상 샘플 비교를 하지 않았다.

## 10. Agent 답변 규칙

Agent는 contamination 질문에 답할 때 다음 순서로 말한다.

1. 오염 유형을 먼저 묻거나 추정한다: residue, fiber/thread, oil, glue, metal contamination, liquid, color stain.
2. `bottle`이면 세척 노즐/필터/블로워, `tile`이면 oil/glue 접촉 구간, `pill`이면 coating/feed 구간, `carpet/grid`이면 metal chip/thread 낙진 구간을 우선 제안한다.
3. 오염은 제거 가능성과 재발 가능성을 나눠 말한다. 제거 가능해도 동일 LOT 5개 이상 재검사 전에는 종료하지 않는다.
4. 오일, glue, 금속분은 High로 취급하고 설비 확인 전 출하 금지를 포함한다.

## 11. 작업자 전달 문구

이물/오염 의심 결함이 확인되었습니다. 병 내부, 홈, 표면의 오염 위치를 기록하고 세척 노즐, 필터, 블로워 압력, 포장 전 대기 구역을 우선 확인해 주세요. 제거 가능한 오염은 재세척 후 동일 LOT 샘플을 재검사하고, 오일 또는 금속분이면 LOT를 격리한 뒤 설비 담당자에게 공유해 주세요.

## 12. 기록 항목

- 검사 ID, LOT 번호, 제품 카테고리
- 오염 유형과 위치
- anomalyScore, threshold, heatmap 위치
- 세척 노즐/필터 점검 결과
- 블로워 압력과 건조 조건
- 재세척 여부와 재검사 결과
- 격리 수량과 해제 승인자

## 13. Agent 검색 키워드

contamination, 오염, 이물, foreign material, residue, fiber, thread, stain, oil, glue, metal_contamination, liquid, color stain, bottle contamination, pill contamination, tile oil, tile glue_strip, leather glue, carpet thread, grid metal_contamination, wood liquid, 병 내부 오염, 세척 잔류물, 블로워 압력, 세척 노즐, 재세척, heatmap 얼룩
