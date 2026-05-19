# 1단계 Workthrough: Supabase 스키마/Auth/Storage 설계

## 기준

보고서 `reports/품질관리_Agent_구현현황_보고서.docx`의 권장 다음 작업 순서 1단계:

- 작업: Supabase 스키마/Auth/Storage 설계
- 완료 기준: 테이블, RLS, Storage bucket, seed migration 작성

## 수행 내용

### 1. 기존 구조 확인

기존 로컬 MVP의 데이터 구조를 확인했다.

- `backend/src/domain.js`: 공정, 설비, 매뉴얼, 체크리스트 구조
- `backend/src/store.js`: 현재 JSON 기반 저장소 인터페이스
- `backend/src/seed.js`: 2026-05-12부터 2026-05-18까지 검사 128건 생성 로직
- `docs/frontend/api-contracts.md`: 프론트엔드가 기대하는 API entity shape

### 2. Supabase schema migration 작성

파일:

- `supabase/migrations/202605180001_initial_schema.sql`

포함 내용:

- Auth 연동 `profiles` 테이블
- `processes`, `equipment`
- `manuals`, `manual_chunks`
- `inspections`, `inspection_feedback`
- `reports`
- enum 타입:
  - `app_role`
  - `inspection_result`
  - `inspection_status`
  - `defect_priority`
  - `report_type`
  - `embedding_status`
- `pgvector` 확장 및 `manual_chunks.embedding vector(1536)` 컬럼
- 주요 조회 인덱스
- `updated_at` 자동 갱신 trigger
- 신규 Supabase Auth 사용자 생성 시 `profiles` row 생성 trigger

### 3. RLS 정책 작성

역할은 다음 기준으로 설계했다.

- `worker`: 새 검사 생성, 본인 검사/피드백 중심
- `quality_manager`: 전체 검사 조회, 매뉴얼/리포트 관리
- `process_manager`: 검사/대시보드/리포트 조회
- `admin`: 전체 관리

RLS 적용 대상:

- `profiles`
- `processes`
- `equipment`
- `manuals`
- `manual_chunks`
- `inspections`
- `inspection_feedback`
- `reports`

### 4. Storage bucket 설계

Schema migration 안에 bucket 생성과 object policy를 포함했다.

- `inspection-images`
  - 검사 이미지 저장
  - 공개 읽기
  - worker, quality_manager, admin 업로드 가능
- `manual-files`
  - 품질 기준서 원본 저장
  - 인증 사용자 읽기
  - quality_manager, admin 업로드 가능

### 5. Seed migration 작성

파일:

- `supabase/migrations/202605180002_seed_demo_data.sql`

포함 내용:

- A/B/C 공정
- 설비 4대
- 기준서 4건:
  - scratch
  - contamination
  - dent
  - crack
- 기준서별 `manual_chunks` seed
- 기존 데모와 같은 기간의 검사 128건

검사 seed 구성:

- 기간: 2026-05-12 ~ 2026-05-18
- 총 검사: 128건
- 불량: 17건
- 정상: 111건

### 6. 문서 및 환경변수 예시 추가

추가 파일:

- `docs/supabase.md`
- `backend/.env.example`

`backend/.env.example`에는 2단계에서 필요한 값을 명시했다.

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_INSPECTION_IMAGE_BUCKET=inspection-images
SUPABASE_MANUAL_FILE_BUCKET=manual-files
```

`backend/README.md`에는 Supabase 전환 준비 위치를 추가했다.

## 검증

### 통과

기존 백엔드 테스트:

```bash
npm test
```

결과:

- 3개 테스트 통과
- 기존 JSON 기반 MVP 동작에는 영향 없음

Seed 산술 검증:

- 총 128건
- 불량 17건
- 정상 111건

### 미실행

현재 로컬 환경에 다음 도구가 없어 실제 Supabase/PostgreSQL 적용 검증은 수행하지 못했다.

- `psql`
- `supabase` CLI
- `docker`

따라서 SQL은 정적 검토와 기존 테스트 기준으로만 확인했다. 실제 Supabase 프로젝트 생성 후 SQL Editor 또는 Supabase CLI로 적용 검증이 필요하다.

## 생성/수정 파일

- `supabase/migrations/202605180001_initial_schema.sql`
- `supabase/migrations/202605180002_seed_demo_data.sql`
- `backend/.env.example`
- `docs/supabase.md`
- `backend/README.md`
- `docs/workthrough/01-supabase-schema-auth-storage/workthrough.md`

## 다음 단계 입력값

2단계 `백엔드 저장소 추상화`에서 실제 Supabase 연결까지 진행하려면 아래 값이 필요하다.

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

연결 없이 인터페이스 분리와 `JsonStore` 유지까지 먼저 진행하는 것은 가능하다.
