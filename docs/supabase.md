# Supabase 설계 및 적용 메모

이 문서는 보고서의 1단계인 `Supabase 스키마/Auth/Storage 설계` 산출물이다.

## 산출물

- `supabase/migrations/202605180001_initial_schema.sql`
  - Auth 연동 `profiles` 테이블
  - 공정/설비/검사/피드백/매뉴얼/매뉴얼 chunk/리포트 테이블
  - `pgvector` 기반 `manual_chunks.embedding vector(1536)` 컬럼
  - 역할 기반 RLS 정책
  - `inspection-images`, `manual-files` Storage bucket 및 object 정책
- `supabase/migrations/202605180002_seed_demo_data.sql`
  - A/B/C 공정, 설비 4대
  - 불량 기준서 4건 및 RAG chunk seed
  - 2026-05-12부터 2026-05-18까지 검사 128건 seed
- `backend/.env.example`
  - 다음 단계 백엔드 연결에 필요한 Supabase 환경변수 목록

## Auth 역할

`profiles.role`은 다음 값을 사용한다.

- `worker`: 새 검사 생성, 본인 검사/피드백 중심
- `quality_manager`: 검사 전체 조회, 매뉴얼/리포트 관리
- `process_manager`: 검사/대시보드/리포트 조회 및 공정 개선 확인
- `admin`: 전체 관리

신규 사용자가 Supabase Auth로 가입하면 `auth.users` 트리거가 `profiles` row를 만든다. 기본 역할은 `worker`이며, 관리자 계정의 역할 변경은 Supabase SQL Editor에서 `profiles.role`을 수정하면 된다.

## Storage

- `inspection-images`: 공개 읽기 bucket. 검사 이미지 업로드 대상.
- `manual-files`: 인증 사용자 읽기, 품질관리자/admin 업로드 bucket. 기준서 원본 파일 대상.

Seed migration은 Storage 파일 자체를 업로드하지 않는다. 현재 로컬 데모 SVG는 `backend/data/uploads`에 남아 있으며, 2단계 저장소 전환 또는 4단계 RAG 업로드 구현 시 bucket에 실제 파일을 올리면 된다.

## 적용 방법

Supabase CLI를 사용하는 경우:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

SQL Editor로 직접 적용하는 경우:

1. `202605180001_initial_schema.sql` 전체 실행
2. `202605180002_seed_demo_data.sql` 전체 실행

## 다음 단계에서 필요한 값

2단계 백엔드 저장소 추상화에서 실제 SupabaseRepository를 붙일 때 아래 값을 요청한다.

- `STORE_DRIVER=supabase`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

프론트에서 Supabase Auth 세션까지 붙이는 5단계에서는 아래 공개 환경변수도 필요하다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
