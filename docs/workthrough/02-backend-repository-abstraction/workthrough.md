# 2단계 Workthrough: 백엔드 저장소 추상화

## 기준

보고서 `reports/품질관리_Agent_구현현황_보고서.docx`의 권장 다음 작업 순서 2단계:

- 작업: 백엔드 저장소 추상화
- 완료 기준: `JsonStore`와 `SupabaseRepository`를 교체 가능한 구조로 분리

## 수행 내용

### 1. 기존 저장소 결합 지점 확인

기존 백엔드는 `backend/src/app.js`에서 `JsonStore`를 직접 생성하고, 라우트에서 아래 메서드를 직접 호출하고 있었다.

- `listInspections`
- `getInspection`
- `addInspection`
- `updateInspection`
- `listReports`
- `getReport`
- `addReport`
- `listManuals`

이미지 업로드도 `app.js`가 직접 `store.uploadsDir`에 파일을 쓰고 `/uploads/:fileName`으로 읽어주는 구조였다.

### 2. Repository factory 추가

추가 파일:

- `backend/src/repositories/index.js`

역할:

- `STORE_DRIVER=json`이면 `JsonStore` 사용
- `STORE_DRIVER=supabase`이면 `SupabaseRepository` 사용
- 지원하지 않는 driver는 명시적으로 에러 처리

### 3. JsonStore 이동 및 계약 정리

추가 파일:

- `backend/src/repositories/json-store.js`

기존 `backend/src/store.js`는 호환성을 위해 `JsonStore` re-export만 남겼다.

`JsonStore`는 기존 JSON 기반 동작을 유지하면서 다음 async repository 계약을 제공한다.

- `init`
- `listProcesses`
- `listEquipment`
- `saveUpload`
- `getUpload`
- `listInspections`
- `getInspection`
- `addInspection`
- `updateInspection`
- `listReports`
- `getReport`
- `addReport`
- `listManuals`

### 4. SupabaseRepository 추가

추가 파일:

- `backend/src/repositories/supabase-repository.js`

특징:

- `@supabase/supabase-js` 의존성 없이 Supabase REST API와 Storage API를 직접 호출
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 또는 `SUPABASE_ANON_KEY`로 초기화
- 검사 이미지 업로드는 `inspection-images` bucket에 저장
- DB row의 snake_case를 프론트/API 계약의 camelCase로 변환
- `inspections`, `inspection_feedback`, `reports`, `manuals`, `processes`, `equipment` 접근 구현
- seed의 Storage path는 public Storage URL로 변환

### 5. app.js 저장소 의존성 제거

수정 파일:

- `backend/src/app.js`

변경 내용:

- `new JsonStore()` 직접 생성 제거
- `createRepository()` 사용
- 저장소 호출을 async 계약으로 통일
- `/api/master-data`도 repository에서 공정/설비 조회
- 이미지 저장을 `store.saveUpload()`로 위임
- `/uploads/:fileName` 로컬 파일 응답을 `store.getUpload()`로 위임

### 6. Agent 서비스 async 전환

수정 파일:

- `backend/src/agent-service.js`

`inspectionId` 기반 조회가 async repository 계약을 따르도록 `answerAgentQuestion`을 async 함수로 변경했다.

### 7. 환경변수/문서 갱신

수정 파일:

- `backend/.env.example`
- `backend/README.md`
- `docs/supabase.md`

추가된 설정:

```env
STORE_DRIVER=json
```

Supabase 사용 시:

```env
STORE_DRIVER=supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## 검증

기존 JSON 드라이버 기준 백엔드 테스트를 실행했다.

```bash
npm test
```

결과:

- 3개 테스트 통과
- 검사 이력/대시보드 정상
- 이미지 분석/피드백 정상
- Agent/리포트 정상

## 미검증 항목

실제 Supabase 프로젝트 연결 검증은 아직 수행하지 않았다.

필요한 값:

```env
STORE_DRIVER=supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

또한 1단계 migration이 Supabase 프로젝트에 먼저 적용되어 있어야 한다.

## 생성/수정 파일

- `backend/src/repositories/index.js`
- `backend/src/repositories/json-store.js`
- `backend/src/repositories/supabase-repository.js`
- `backend/src/store.js`
- `backend/src/app.js`
- `backend/src/agent-service.js`
- `backend/src/server.js`
- `backend/.env.example`
- `backend/README.md`
- `docs/supabase.md`
- `docs/workthrough/02-backend-repository-abstraction/workthrough.md`

## 다음 단계

## 추가 연결 확인

사용자가 `backend/.env`에 Supabase 값을 저장한 뒤 연결을 확인했다.

결과:

- driver: `supabase`
- processes: 3
- equipment: 4
- inspections: 128
- manuals: 4
- reports: 0

확인 중 PostgREST가 `inspections`와 `equipment` 사이의 FK가 2개라 조인을 고르지 못하는 문제가 있었다. `SupabaseRepository`의 inspection select 구문을 `equipment!inspections_equipment_process_fk(name)`로 명시해 해결했다.

또한 `npm start` 실행 시 `.env`가 자동 로드되도록 `backend/src/server.js`에 간단한 `.env` 로더를 추가했다.

## 다음 단계

3단계는 `실제 Vision AI 연동`이다.

예상 작업:

- `VisionModelClient` 인터페이스 정의
- 현재 `local-vision-heuristic-v1`를 local 구현체로 분리
- 실제 Vision API 구현체 추가
- 실패 시 local 또는 명시적 fallback 처리
- 테스트 이미지 기준 정상/불량/유형 응답 검증
