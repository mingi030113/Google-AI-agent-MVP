# 5단계 Workthrough: 서비스 UX 및 권한 흐름 고도화

## 기준

4단계 RAG 파이프라인 다음 작업:

- 작업: 서비스 구현 고도화
- 완료 기준: 로그인 흐름, 역할별 화면 접근, 운영성 기능, 삭제 관리 흐름이 웹 MVP에 반영됨

## 수행 내용

### 1. MVP 세션 모델 추가

추가 파일:

- `frontend/src/features/auth/session.ts`

역할:

- 데모 사용자와 역할 정의
- localStorage 기반 MVP 세션 저장/조회/삭제
- 역할별 기본 진입 경로 계산
- 역할별 화면 접근 가능 여부 판단

현재 단계에서는 Supabase Auth를 직접 붙이지 않고, 프론트 MVP에서 역할 기반 UX를 검증할 수 있는 로컬 세션으로 구현했다.

### 2. 로그인 화면 개선

수정 파일:

- `frontend/src/app/login/page.tsx`

변경 내용:

- 역할 선택 드롭다운 추가
- 선택 역할에 맞는 데모 사용자 이메일 표시
- 로그인 시 세션 저장 후 역할별 기본 화면으로 이동

역할별 기본 진입:

| 역할 | 기본 화면 |
|---|---|
| 현장 작업자 | `/inspections/new` |
| 품질관리자 | `/dashboard` |
| 공정관리자 | `/dashboard` |
| 관리자 | `/dashboard` |

### 3. 역할별 네비게이션 및 로그아웃

수정 파일:

- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/app/globals.css`

변경 내용:

- 로그인 세션이 없으면 `/login`으로 이동
- 역할별 접근 가능한 메뉴만 표시
- 접근 권한이 없는 화면에 진입하면 역할별 기본 화면으로 이동
- 상단 바에 사용자/역할 표시
- 로그아웃 버튼 추가

역할별 메뉴:

| 역할 | 메뉴 |
|---|---|
| 현장 작업자 | 새 검사, 검사 이력, 조치 Agent |
| 품질관리자 | 새 검사, 검사 이력, 대시보드, 조치 Agent, 리포트, 매뉴얼 |
| 공정관리자 | 검사 이력, 대시보드, 조치 Agent, 리포트 |
| 관리자 | 전체 메뉴 |

### 4. 운영 관리 기능

이 단계 전후로 서비스 운영에 필요한 삭제 기능도 반영했다.

- `DELETE /api/manuals/:manualId`
- `DELETE /api/reports/:reportId`
- 기준서 관리 화면 삭제 버튼
- 리포트 화면 삭제 버튼

## 검증

실행한 검증:

```powershell
cd backend
npm test
```

```powershell
cd frontend
npm run build
```

프론트 주요 화면:

- `/login`
- `/dashboard`
- `/inspections`
- `/inspections/new`
- `/agent`
- `/reports`
- `/admin/manuals`

## 남은 개선 후보

- Supabase Auth 실제 로그인 연동
- 서버 API 권한 검증
- 사용자별 검사/피드백 소유권 정책 적용
- 관리자 사용자 관리 화면
- E2E 테스트 자동화
