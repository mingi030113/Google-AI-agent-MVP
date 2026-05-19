# Manufacturing Quality Agent

제조 품질검사, 기준서 RAG, 조치 Agent, 리포트 생성을 연결한 MVP입니다.

## 구성

- `frontend`: Next.js 웹 앱
- `backend`: Node.js HTTP API
- `supabase`: Supabase schema/migration
- `docs`: API/화면/매뉴얼 문서
- `demo-assets`: 데모 이미지

## 실행

백엔드:

```powershell
cd backend
copy .env.example .env
npm start
```

프론트엔드:

```powershell
cd frontend
copy .env.example .env.local
npm install
npm run dev -- -p 3000
```

접속:

```text
http://localhost:3000
```

백엔드 health:

```text
http://localhost:4000/api/health
```

## 주요 기능

- MVP 로그인과 역할별 네비게이션
- 이미지 기반 검사 생성
- 검사 이력/상세/피드백
- 대시보드 품질 지표
- 기준서 업로드, 삭제, RAG chunk 저장
- 조치 Agent 질의응답
- 리포트 생성, 삭제
- JSON 저장소와 Supabase 저장소 지원

## 데모 로그인

`/login`에서 역할을 선택해 접속합니다. 현재 단계에서는 Supabase Auth 직접 연동 전이며, 브라우저 localStorage 기반 MVP 세션으로 역할별 화면 접근을 검증합니다.

## 검증

```powershell
cd backend
npm test
```

```powershell
cd frontend
npm run build
```

서버 실행 후 전체 MVP 스모크 테스트:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\validate_mvp.ps1
```

스모크 테스트는 백엔드 health, 프론트 주요 라우트, 대시보드, 검사이력, Agent, 기준서 업로드/삭제, 리포트 생성/삭제를 확인합니다.

## 보안 주의

실제 `.env`에는 Supabase/Gemini 키가 들어가므로 커밋하지 않습니다. GitHub에는 `.env.example`만 올립니다.
