# Manufacturing Quality Agent Backend

프론트엔드 API 계약(`docs/frontend/api-contracts.md`)에 맞춘 MVP 백엔드입니다.
외부 패키지 없이 Node.js 내장 모듈만 사용하므로 바로 실행할 수 있습니다.

## 실행

```bash
cd backend
npm start
```

기본 주소는 `http://localhost:4000`입니다. 포트를 바꾸려면 `PORT=4001 npm start`처럼 실행하세요.

## 테스트

```bash
cd backend
npm test
```

## 구현된 API

- `GET /api/health`
- `GET /api/master-data`
- `POST /api/inspections/analyze`
- `GET /api/inspections`
- `GET /api/inspections/:inspectionId`
- `POST /api/inspections/:inspectionId/feedback`
- `DELETE /api/inspections/:inspectionId/feedback/:feedbackId`
- `GET /api/dashboard/metrics`
- `POST /api/agent/ask`
- `GET /api/reports`
- `POST /api/reports`
- `GET /api/reports/:reportId`
- `DELETE /api/reports/:reportId`
- `GET /api/manuals`
- `POST /api/manuals`
- `DELETE /api/manuals/:manualId`

## 데이터

첫 실행 시 `backend/data/db.json`과 `backend/data/uploads/*`가 생성됩니다.
초기 데이터는 2026-05-12부터 2026-05-18까지의 검사 128건이며, 프론트 mock dashboard 수치와 맞춰져 있습니다.

현재 Vision AI는 로컬 규칙 엔진 또는 Gemini Vision으로 동작합니다.
RAG는 로컬 JSON 저장소에서는 deterministic embedding 배열을 `data/db.json`에 저장하고, Supabase 저장소에서는 `manual_chunks.embedding` pgvector 컬럼을 사용합니다.

## Supabase 전환 준비

1단계 설계 산출물은 `../supabase/migrations`와 `../docs/supabase.md`에 있습니다.
현재 포함된 내용은 Auth profile, PostgreSQL 테이블, RLS 정책, Storage bucket, 데모 seed migration입니다.
2단계 저장소 추상화 이후 실제 Supabase 저장소를 사용할 때는 `.env.example`의 `STORE_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 값을 설정해야 합니다.

## Vision AI 전환

기본값은 로컬 휴리스틱 판정입니다.

```env
VISION_DRIVER=local
```

Gemini Vision 분석을 사용할 때는 아래 값을 설정합니다.

```env
VISION_DRIVER=gemini
GEMINI_API_KEY=...
GEMINI_VISION_MODEL=gemini-2.5-flash
```

Gemini 호출이 실패하면 검사 요청은 실패시키지 않고 로컬 판정으로 fallback합니다.

## Agent 답변 생성

RAG 검색은 매뉴얼 chunk를 기준으로 수행하고, 최종 답변은 Gemini가 생성할 수 있습니다.
Gemini 호출이 실패하거나 키가 없으면 기존 로컬 RAG 템플릿 답변으로 fallback합니다.

```env
AGENT_ANSWER_DRIVER=gemini
GEMINI_API_KEY=...
GEMINI_AGENT_MODEL=gemini-3-flash-preview
```

로컬 템플릿만 사용할 때는 아래처럼 설정합니다.

```env
AGENT_ANSWER_DRIVER=local
```

## RAG 매뉴얼 업로드

텍스트/마크다운 매뉴얼을 업로드하면 백엔드가 본문을 chunk로 나누고 embedding을 생성해 저장합니다.

```bash
curl -F "title=스크래치 조치 기준서" \
  -F "defectType=scratch" \
  -F "file=@manual.txt;type=text/plain" \
  http://localhost:4000/api/manuals
```

이후 `POST /api/agent/ask`는 업로드된 매뉴얼 chunk를 우선 검색하고, source title/excerpt/score를 응답에 포함합니다.

Supabase 사용 시 `supabase/migrations/202605180003_manual_rag_match_function.sql`까지 적용해야 pgvector top-k 검색 RPC가 활성화됩니다.

데모 기준서는 `../docs/manuals`에 있으며, 백엔드 실행 후 아래 명령으로 4종 기준서를 한 번에 업로드할 수 있습니다.

```powershell
powershell -ExecutionPolicy Bypass -File ..\docs\manuals\upload-rag-manuals.ps1
```
