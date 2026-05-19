# 4단계 Workthrough: RAG 파이프라인 구현

## 기준

3단계 Vision AI 연동 다음 작업:

- 작업: RAG 파이프라인 구현
- 완료 기준: 매뉴얼 업로드, chunking, embedding 저장, top-k 검색, Agent 답변 source/score 표시

## 설계 방향

Pinecone 같은 외부 벡터 DB는 추가하지 않고, 기존 Supabase 설계에 포함된 pgvector를 우선 사용한다.

```text
POST /api/manuals
  -> multipart text/markdown upload
  -> chunkText(...)
  -> embedText(...)
  -> store.upsertManualWithChunks(...)

POST /api/agent/ask
  -> embed question
  -> store.searchManualChunks(...)
  -> answer with sources + score
  -> fallback to built-in manuals when no uploaded chunks exist
```

로컬 MVP에서는 `backend/data/db.json`의 `manualChunks` 배열에 embedding을 저장한다.
Supabase 전환 시에는 `manual_chunks.embedding vector(1536)`와 `match_manual_chunks` RPC를 사용한다.

## 수행 내용

### 1. Embedding 유틸 추가

추가 파일:

- `backend/src/rag/embedding.js`

역할:

- 텍스트 tokenization
- deterministic 1536차원 embedding 생성
- cosine similarity 계산

외부 embedding API 없이도 테스트와 로컬 데모가 재현 가능하도록 해시 기반 embedding을 사용했다.

### 2. 매뉴얼 ingestion 서비스 추가

추가 파일:

- `backend/src/rag/manual-ingestion-service.js`

역할:

- text/markdown 파일 검증
- 제목/불량 유형/checklist 파싱
- 텍스트 정규화 및 chunking
- chunk별 embedding 생성

현재 백엔드 slice에서는 `.txt`, `.md`, `text/plain`, `text/markdown`을 지원한다.

### 3. JSON 저장소 RAG 지원

수정 파일:

- `backend/src/repositories/json-store.js`
- `backend/src/seed.js`

추가 기능:

- `saveManualFile`
- `upsertManualWithChunks`
- `searchManualChunks`
- `manualChunks` seed 구조

### 4. Supabase 저장소 RAG 지원

수정 파일:

- `backend/src/repositories/supabase-repository.js`

추가 기능:

- manual file storage upload
- `manuals` upsert
- `manual_chunks` 재생성
- `match_manual_chunks` RPC 기반 top-k 검색
- RPC 실패 시 최근 chunk fallback 조회

### 5. pgvector 검색 RPC 추가

추가 파일:

- `supabase/migrations/202605180003_manual_rag_match_function.sql`

핵심:

```sql
1 - (manual_chunks.embedding <=> query_embedding) as score
```

`<=>`는 pgvector cosine distance 연산자이며, `1 - distance`를 score로 반환한다.

### 6. API 라우트 추가

수정 파일:

- `backend/src/app.js`

추가 API:

- `POST /api/manuals`

요청:

- `multipart/form-data`
- `file`
- `title`
- `defectType`
- `checklist`

### 7. Agent 답변 RAG 연동

수정 파일:

- `backend/src/agent-service.js`

변경 내용:

- 질문 embedding 생성
- 저장소의 `searchManualChunks` 호출
- 업로드된 매뉴얼 source와 score를 답변에 포함
- 검색 결과가 없으면 기존 내장 기준서 scoring으로 fallback

### 8. 문서/API 계약 갱신

수정 파일:

- `backend/README.md`
- `docs/frontend/api-contracts.md`

## 검증

테스트 추가:

- `backend/test/api.test.js`

검증 내용:

- `POST /api/manuals`로 텍스트 매뉴얼 업로드
- chunk 생성 확인
- `POST /api/agent/ask`가 업로드된 매뉴얼 source title과 score를 반환

데모 매뉴얼:

- `docs/manuals/scratch-standard.md`
- `docs/manuals/contamination-standard.md`
- `docs/manuals/dent-standard.md`
- `docs/manuals/crack-standard.md`
- `docs/manuals/upload-rag-manuals.ps1`

백엔드 실행 후 다음 명령으로 4종 기준서를 업로드할 수 있다.

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File ..\docs\manuals\upload-rag-manuals.ps1
```

## 생성/수정 파일

- `backend/src/rag/embedding.js`
- `backend/src/rag/manual-ingestion-service.js`
- `backend/src/repositories/json-store.js`
- `backend/src/repositories/supabase-repository.js`
- `backend/src/seed.js`
- `backend/src/app.js`
- `backend/src/agent-service.js`
- `backend/test/api.test.js`
- `backend/README.md`
- `docs/frontend/api-contracts.md`
- `supabase/migrations/202605180003_manual_rag_match_function.sql`
- `docs/workthrough/04-rag-pipeline/workthrough.md`

## 남은 개선 후보

- PDF/DOCX 텍스트 추출
- 실제 embedding API 전환
- Supabase RPC 성능 튜닝 및 threshold 적용
- 프론트 매뉴얼 업로드 화면의 실제 API 연결
