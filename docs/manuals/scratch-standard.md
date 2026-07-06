# 스크래치 불량 조치 기준서

- 문서번호: QA-MVTEC-SCR-001
- 개정: Rev. 2026-06-29
- 적용 불량 유형: scratch
- 적용 데이터셋: MVTec AD 데모 이미지
- 대표 카테고리: capsule, metal_nut, screw, pill, wood, leather
- 담당: 품질관리자, 공정관리자, 현장 작업자

## 1. 목적

MVTec AD 기반 AI 품질검사에서 제품 표면의 선형 긁힘, 마찰 흔적, 표면 코팅 손상, 가공면 흠집이 검출되었을 때 Agent가 동일한 기준으로 원인 후보와 현장 조치, 재검사 조건을 제안하도록 표준화한다.

이 기준서는 `scratch`, `스크래치`, `긁힘`, `선형 흠집`, `surface scratch` 관련 질문에서 우선 검색되어야 한다.

## 2. MVTec AD 적용 범위

| 카테고리 | 대표 이미지 예 | 주요 시각 단서 | 우선 판정 |
| --- | --- | --- | --- |
| capsule | `scratch-capsule.png` | 캡슐 표면 또는 인쇄 영역 위로 지나가는 밝은 선, 긁힌 자국, 표면 scuff | scratch |
| metal_nut | `scratch-metal-nut.png` | 금속 표면의 대각선 또는 원주 방향 선형 흠집, 가공면 마찰 흔적 | scratch |
| screw | `scratch_head`, `scratch_neck` 유형 | 나사 머리 또는 목 부위의 선형 마찰 자국, 드라이버/피더 접촉 흔적 | scratch |
| pill | `scratch`, `faulty_imprint` 일부 | 코팅면 긁힘, 문자 인쇄부 손상, 이송 중 마찰 흔적 | scratch 또는 imprint 구분 |
| wood | `scratch` | 목재 표면 결을 따라 생긴 길고 얕은 긁힘 | scratch |
| leather | `cut`, `fold`, `poke`와 구분 필요 | 표면층이 벗겨진 선형 흠집이면 scratch 유사, 절단면이 깊으면 crack/cut로 재분류 | scratch 의심 |
| bottle | 병 입구나 내부 링의 섬유/얼룩이 아닌 선형 마찰 흔적 | contamination과 구분 필요 |
| tile | 패턴 자체가 아닌 표면층의 얕은 긁힘 | crack과 구분 필요 |

## 3. MVTec AD 세부 결함명 매핑

Agent는 질문이나 검사 결과에 아래 단어가 포함되면 scratch 기준서를 우선 검색한다.

| MVTec AD 결함명 또는 표현 | scratch로 보는 조건 | 현장 해석 |
| --- | --- | --- |
| `capsule/scratch` | 캡슐 shell 표면을 가로지르는 밝은 선 또는 scuff | bowl feeder, chute, 가이드 레일 마찰 |
| `metal_nut/scratch` | 가공면 또는 외곽 chamfer에 일정 방향의 선형 손상 | 금속 칩, 디버링 불량, fixture 접촉 |
| `screw/scratch_head` | 나사 머리 상면의 원형 또는 선형 마찰 흔적 | 드라이버 bit 마모, 정렬 불량, 진동 피더 접촉 |
| `screw/scratch_neck` | 나사 목 부위의 좁고 긴 손상 | 이송 rail 간격, guide plate 접촉 |
| `pill/scratch` | 코팅 표면에 얇은 선, 긁힌 코팅 분말 | feeder/정렬판 마찰, 코팅 경화 부족 |
| `wood/scratch` | 목재 결 위의 긴 표면 흠집 | sanding belt, 적재 마찰, 포장재 접촉 |
| `tile/gray_stroke` | 균열이 아니라 회색 선형 마찰 자국 | 타일 표면 오염 또는 스크래치 의심 |

다음 표현은 scratch와 혼동되지만 다른 기준서를 우선 적용한다.

- `crack`, `split`, `fracture`, `broken`: 갈라짐과 틈이 있으면 crack 기준서.
- `contamination`, `stain`, `oil`, `residue`, `thread`: 표면에 얹힌 물질이면 contamination 기준서.
- `dent`, `bent`, `squeeze`, `deformation`: 형상이 눌리거나 휘었으면 dent 기준서.

## 4. 판정 기준

다음 중 하나 이상이면 scratch로 분류한다.

- 결함이 선형이며 길이 방향이 뚜렷하다.
- 표면 위에 밝거나 어두운 가느다란 긁힘이 반복된다.
- 캡슐 인쇄, 금속 너트 가공면, 타일 표면 위에 마찰 방향이 보인다.
- PatchCore heatmap이 길고 좁은 영역을 따라 활성화된다.
- Gemini labeler가 `scratch`, `scratched`, `scuff`, `linear mark`, `surface mark`를 근거로 제시한다.

다음은 scratch로 단정하지 않는다.

- 오염물이 표면 위에 얹혀 있거나 닦으면 제거될 것처럼 보이면 contamination 기준서를 우선 적용한다.
- 선이 깊게 벌어져 표면이 갈라진 형태면 crack 기준서를 우선 적용한다.
- 국부적으로 눌린 자국, 변형, 충격 흔적이 중심이면 dent 기준서를 우선 적용한다.

## 5. 등급 기준

| 등급 | 이미지 기준 | 처리 기준 |
| --- | --- | --- |
| High | 기능면, 인쇄 식별 영역, 조립 기준면을 가로지르는 긴 스크래치 또는 동일 LOT 반복 | LOT 격리, 접촉면/이송부 즉시 점검, 품질관리자 승인 전 출하 금지 |
| Medium | 외관면의 명확한 선형 긁힘, 동일 방향 반복, heatmap이 선형으로 집중 | 설비 접촉면과 트레이 점검 후 동일 조건 재검사 |
| Low | 미세하고 단발성인 표면 scuff, 정상 패턴과 구분이 애매함 | 작업대/트레이 청소 후 샘플 재검사와 기록 |

## 6. PatchCore 및 Gemini 판단 근거 활용

- `anomalyScore`가 `threshold`보다 높고 heatmap이 길고 좁게 나타나면 scratch 가능성을 높게 본다.
- heatmap이 넓고 얼룩 형태면 contamination 가능성을 재검토한다.
- heatmap이 선형이지만 갈라진 틈처럼 경계가 벌어져 보이면 crack 가능성을 재검토한다.
- Gemini의 결함 유형 추정이 scratch이고, 원본 이미지에서 선형 마찰 흔적이 확인되면 scratch 기준서를 적용한다.
- Gemini 추정 점수가 낮거나 defectScores가 분산되어 있으면 "스크래치 의심"으로 두고 재검사 이미지를 확보한다.

## 7. 카테고리별 원인 후보와 확인 방법

| 원인 후보 | MVTec AD 대응 해석 | 확인 위치 | 확인 방법 | 우선순위 |
| --- | --- | --- | --- | --- |
| 지그/클램프 접촉면 마모 | 캡슐 또는 금속 부품 표면에 반복 방향 긁힘 | 고정 지그, 클램프, 가이드 핀 | 버, 날카로운 모서리, 표면 박리 확인 | High |
| 이송 레일 금속 칩 | 금속 너트 표면에 대각선 또는 원주 방향 흠집 | 컨베이어, 레일, 가이드 | 레일 닦음 검사, 금속 칩/분진 확인 | High |
| 트레이/보관 랙 마찰 | 동일 위치 또는 동일 방향 반복 흠집 | 트레이, 적재 랙, 포장 전 대기 구역 | 제품 접촉면과 완충재 상태 확인 | Medium |
| 작업자 취급 중 공구 접촉 | 단발성 긁힘, 위치가 불규칙 | 수동 취급 구간 | 장갑, 핀셋, 공구 접촉 여부 확인 | Medium |
| 정상 패턴 오인 | 타일/금속 표면의 정상 텍스처와 혼동 | 원본 이미지, 정상 샘플 | 정상 샘플과 heatmap 위치 비교 | Low |

### 7.1 카테고리별 우선 점검

| 카테고리 | 먼저 볼 위치 | 구체 조치 |
| --- | --- | --- |
| capsule | bowl feeder, chute, 인쇄/검사 가이드 | shell 접촉부 마모, 인쇄 가이드 모서리, 정렬판 이물 제거 |
| metal_nut | 가공 fixture, deburring 공정, 컨베이어 side rail | 금속 칩 제거, deburring wheel 상태 확인, fixture burr 제거 |
| screw | driver bit, screw feeder, guide plate | bit 마모 교체, 피더 진동 세기 확인, neck 접촉 guide 간격 조정 |
| pill | coating drum, feeder rail, 선별 plate | 코팅 경화 시간 확인, rail 모서리 청소, 분말 부착 제거 |
| wood | sanding belt, 적재 rack, 포장재 | belt grit 마모 확인, rack 완충재 교체, 포장 전 마찰 방지 |
| leather | punching/press guide, 이송 roller | roller 표면 이물 제거, guide 압력 조정, cut/fold 여부 재분류 |

## 8. 즉시 조치 절차

1. 검사 ID, LOT, 카테고리, 결함 위치, heatmap 위치를 기록한다.
2. 동일 LOT 제품을 임시 보류하고 같은 설비 또는 같은 작업 구간 통과품을 우선 확인한다.
3. heatmap 방향과 원본 이미지의 선 방향이 일치하는지 확인한다. 전체 heatmap이 넓게 퍼지면 contamination 또는 정상 패턴 오인을 함께 검토한다.
4. 카테고리별 우선 점검표에 따라 feeder, rail, fixture, guide, tray를 확인한다.
5. 금속 칩, 분진, 파손된 완충재, 날카로운 burr가 있으면 제거하거나 교체한다.
6. 조치 전후 원본 이미지, heatmap, 설비 접촉면 사진을 남긴다.
7. 동일 조건으로 정상 샘플 또는 동일 LOT 샘플 5개 이상을 재검사한다.
8. 같은 방향 스크래치가 재발하면 설비를 재가동하지 않고 공정관리자에게 escalate한다.

## 9. 재검사 및 종료 기준

조치는 다음을 모두 만족할 때 종료한다.

- 접촉면, 레일, 트레이 점검 결과가 기록되어 있다.
- 청소, 교체, 조건 복원 조치가 피드백에 남아 있다.
- 동일 LOT 샘플 5개 이상에서 scratch가 재발하지 않는다.
- 재검사 이미지의 heatmap이 사라졌거나 `anomalyScore`가 threshold 이하로 내려갔다.
- 품질관리자가 외관 등급과 기능 영향 여부를 승인했다.

다음이면 조치를 종료하지 않는다.

- 동일 방향 긁힘이 같은 설비에서 반복된다.
- Gemini가 scratch와 crack을 혼동하거나 heatmap이 균열처럼 보인다.
- 정상 샘플과 비교 없이 단순 육안 정상으로만 판단했다.

## 10. Agent 답변 규칙

Agent는 scratch 질문에 답할 때 다음 순서로 말한다.

1. "PatchCore heatmap이 선형/마찰 방향으로 보이는지 먼저 확인"을 첫 근거로 제시한다.
2. 카테고리가 `capsule`이면 feeder/chute/가이드, `metal_nut`이면 fixture/deburring/금속 칩, `screw`이면 driver bit/feeder, `pill`이면 coating/feeder를 우선 조치로 제안한다.
3. `anomalyScore`와 threshold 차이가 작으면 "스크래치 확정"이 아니라 "스크래치 의심, 정상 샘플 비교 필요"라고 답한다.
4. 종료 조건은 "동일 LOT 5개 이상 재검사, 같은 방향 재발 없음, 조치 전후 사진 기록"을 포함한다.

## 11. 작업자 전달 문구

스크래치 의심 결함이 확인되었습니다. 지그 접촉면, 가이드 레일, 트레이 접촉부를 먼저 확인하고 금속 칩이나 버가 있으면 즉시 제거 또는 교체해 주세요. 청소 후 동일 LOT 샘플 5개 이상을 재검사하고, 같은 방향의 긁힘이 반복되면 설비를 임의 재가동하지 말고 공정관리자에게 공유해 주세요.

## 12. 기록 항목

- 검사 ID, LOT 번호, 제품 카테고리
- 원본 이미지와 heatmap 위치
- anomalyScore, threshold, 기준 대비 값
- 스크래치 방향, 길이, 발생 위치
- 지그/레일/트레이 점검 결과
- 청소 또는 교체 조치
- 재검사 수량과 결과
- 승인자와 완료 시각

## 13. Agent 검색 키워드

scratch, 스크래치, 긁힘, 선형 흠집, surface scratch, scuff, capsule scratch, metal_nut scratch, screw scratch_head, screw scratch_neck, pill scratch, wood scratch, leather scratch, tile gray_stroke, 금속 너트 흠집, 캡슐 표면 긁힘, 지그 마모, 레일 금속 칩, driver bit 마모, feeder rail, heatmap 선형
