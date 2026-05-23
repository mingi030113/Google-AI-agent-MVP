# RAG 기준서 업로드 시연 자료

메뉴얼 관리 화면에서 불량 유형별 기준서 업데이트를 시연하기 위한 마크다운 기준서입니다.

## 파일 목록

| 불량 유형 | 기준서명 | 파일 |
| --- | --- | --- |
| scratch | 스크래치 불량 조치 기준서 | `scratch-standard.md` |
| contamination | 이물/오염 불량 조치 기준서 | `contamination-standard.md` |
| dent | 찍힘 불량 조치 기준서 | `dent-standard.md` |
| crack | 균열 불량 조치 기준서 | `crack-standard.md` |

## 화면에서 수동 업로드

각 파일을 `메뉴얼 관리 > 매뉴얼 업로드`에서 선택하고 아래 값을 입력합니다.

### scratch

- 기준서명: 스크래치 불량 조치 기준서
- 불량 유형: scratch
- 체크리스트:

```text
- 지그 접촉면 마모 또는 버 발생 여부 확인
- 이송 레일 금속 칩, 분진, 오염물 제거
- 작업대와 트레이 청소 후 완료 사진 기록
- 동일 LOT 샘플 5개 이상 재검사
```

### contamination

- 기준서명: 이물/오염 불량 조치 기준서
- 불량 유형: contamination
- 체크리스트:

```text
- 세척 노즐 막힘과 분사각 확인
- 에어 블로워 압력 기록 확인
- 포장 전 대기 구역과 트레이 청소
- 재세척 후 동일 LOT 샘플 5개 이상 재검사
```

### dent

- 기준서명: 찍힘 불량 조치 기준서
- 불량 유형: dent
- 체크리스트:

```text
- 적재 높이와 제품 간 간격 기준 준수 확인
- 이송 속도 로그와 급정지 알람 확인
- 트레이, 완충재, 보관 랙 손상 여부 확인
- 기능면 찍힘 의심품 품질관리자 승인 전 격리
```

### crack

- 기준서명: 균열 불량 조치 기준서
- 불량 유형: crack
- 체크리스트:

```text
- 기능부 또는 관통 균열 확인 시 설비 즉시 정지
- 가압 조건 이탈 알람과 설정값 변경 이력 확인
- 냉각 시간 로그와 배출 온도 확인
- 원자재 LOT 변경 시점과 불량 발생 시점 비교
- 시험 생산품 5개 이상 정상 확인 후 생산 재개 승인
```

## 일괄 업로드

백엔드가 `http://localhost:4000`에서 실행 중이면 아래 명령으로 4개 기준서를 한 번에 등록할 수 있습니다.

```powershell
powershell -ExecutionPolicy Bypass -File docs\manuals\upload-rag-manuals.ps1
```

백엔드 주소가 다르면 첫 번째 인자로 전달합니다.

```powershell
powershell -ExecutionPolicy Bypass -File docs\manuals\upload-rag-manuals.ps1 http://localhost:4001
```
