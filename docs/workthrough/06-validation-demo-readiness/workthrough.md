# 6단계 Workthrough: 검증 및 데모 준비

## 기준

5단계 서비스 UX/권한 흐름 다음 작업:

- 작업: 검증 및 데모 준비
- 완료 기준: 핵심 웹/API 흐름을 한 번에 점검할 수 있는 스모크 테스트와 실행 문서가 준비됨

## 수행 내용

### 1. MVP 스모크 테스트 스크립트 추가

추가 파일:

- `scripts/validate_mvp.ps1`

검증 범위:

- 백엔드 health
- 프론트 주요 라우트
- 대시보드 지표 API
- 검사 이력 API
- 조치 Agent API
- 기준서 업로드 후 삭제
- 리포트 생성 후 삭제

스크립트는 검증 중 생성한 기준서와 리포트를 즉시 삭제한다. 실패 중간에 멈춰도 `finally` 블록에서 정리한다.

### 2. 실행 방법

백엔드와 프론트가 각각 실행 중이어야 한다.

```powershell
cd backend
npm start
```

```powershell
cd frontend
npm run dev -- -p 3000
```

검증:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\validate_mvp.ps1
```

다른 포트를 쓰는 경우:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\validate_mvp.ps1 `
  -BackendBase http://localhost:4001 `
  -FrontendBase http://localhost:3001
```

## 완료 기준 체크리스트

- `npm test` 통과
- `npm run build` 통과
- `scripts/validate_mvp.ps1` 통과
- `/login`에서 역할 선택 가능
- `/admin/manuals`에서 기준서 업로드/삭제 가능
- `/agent`에서 기준서 출처가 포함된 답변 확인 가능
- `/reports`에서 리포트 생성/삭제 가능

## 남은 개선 후보

- Playwright 기반 브라우저 E2E 테스트
- Supabase Auth 실제 로그인 후 권한 검증
- CI에서 backend test/frontend build/smoke test 자동 실행
- 데모 데이터 초기화 스크립트
