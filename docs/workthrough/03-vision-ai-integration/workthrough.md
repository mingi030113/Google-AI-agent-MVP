# 3단계 Workthrough: 실제 Vision AI 연동

## 기준

보고서 `reports/품질관리_Agent_구현현황_보고서.docx`의 권장 다음 작업 순서 3단계:

- 작업: 실제 Vision AI 연동
- 완료 기준: 테스트 이미지 기준 정상/불량 및 유형 응답, 실패 fallback 처리

## 설계 방향

검사 생성 흐름은 유지하고, 이미지 판정 책임만 `VisionModelClient` 계층으로 분리했다.

```text
app.js
  -> analyzeInspection(...)
    -> visionClient.analyze(...)
      -> LocalVisionModelClient
      -> GeminiVisionModelClient
      -> FallbackVisionModelClient
```

내부 표준 응답은 다음 shape로 통일했다.

```js
{
  result: "normal" | "defective",
  defectType: "scratch" | "contamination" | "dent" | "crack" | null,
  confidence: number,
  modelName: string,
  raw: object
}
```

## 수행 내용

### 1. Vision client factory 추가

추가 파일:

- `backend/src/vision/index.js`

역할:

- `VISION_DRIVER=local`: 로컬 휴리스틱 판정
- `VISION_DRIVER=gemini`: Gemini Vision 호출 + 실패 시 local fallback

### 2. LocalVisionModelClient 추가

추가 파일:

- `backend/src/vision/local-vision-client.js`

기존 `inspection-service.js`에 있던 파일명/메모/LOT/hash 기반 판정 로직을 이 파일로 이동했다.

역할:

- 오프라인 테스트
- 데모 기본값
- Gemini 실패 시 fallback

### 3. GeminiVisionModelClient 추가

추가 파일:

- `backend/src/vision/gemini-vision-client.js`

특징:

- 별도 SDK 없이 Gemini REST API 호출
- 이미지 buffer를 base64 inline data로 전달
- 제조 품질검사 프롬프트를 함께 전달
- JSON 응답을 파싱해 내부 표준 응답으로 변환
- 허용 불량 유형:
  - `scratch`
  - `contamination`
  - `dent`
  - `crack`

기본 모델:

```env
GEMINI_VISION_MODEL=gemini-2.5-flash
```

### 4. 실패 fallback 구현

`FallbackVisionModelClient`를 추가했다.

동작:

```text
Gemini 성공 -> Gemini 결과 저장
Gemini 실패 -> LocalVisionModelClient 결과 저장
```

fallback 발생 시 `modelName`은 다음처럼 남긴다.

```text
gemini:<model>-fallback-local-vision-heuristic-v1
```

그리고 `visionAnalysis.raw`에 fallback 사유를 남긴다.

### 5. 검사 서비스 변경

수정 파일:

- `backend/src/inspection-service.js`

변경 내용:

- `analyzeInspection`을 async 함수로 변경
- `visionClient.analyze(...)` 호출
- Vision 결과의 `modelName`, `confidence`, `defectType`, `raw`를 검사 결과에 반영

### 6. 앱 주입 구조 변경

수정 파일:

- `backend/src/app.js`

변경 내용:

- `createVisionModelClient` 생성
- 테스트에서 `visionClient`를 직접 주입할 수 있도록 `createApp({ visionClient })` 지원

### 7. Supabase 저장 payload 보강

수정 파일:

- `backend/src/repositories/supabase-repository.js`

`inspections.analyzed_payload`에 다음 값을 저장하도록 보강했다.

- `agentGuidance`
- `visionAnalysis`

### 8. 환경변수 문서화

수정 파일:

- `backend/.env.example`
- `backend/README.md`

추가 설정:

```env
VISION_DRIVER=local
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_VISION_MODEL=gemini-2.5-flash
```

Gemini 사용 시:

```env
VISION_DRIVER=gemini
GEMINI_API_KEY=...
```

## 검증

테스트 추가:

- `backend/test/vision.test.js`

검증 내용:

- local vision client가 기존처럼 `scratch` 불량을 판정
- primary vision model 실패 시 local fallback으로 검사 생성 계속 진행
- fallback 발생 시 `modelName`과 `visionAnalysis.fallback` 기록

전체 테스트:

```bash
npm test
```

결과:

- 5개 테스트 통과
- 기존 API 테스트 3개 통과
- Vision 테스트 2개 통과

## 미검증 항목

초기 구현 시점에는 실제 Gemini API 호출을 실행하지 않았다. 이후 사용자가 `backend/.env`에 Gemini API 키를 추가한 뒤 실제 샘플 이미지 분석을 수행했다.

실행 설정:

```env
VISION_DRIVER=gemini
GEMINI_API_KEY=
GEMINI_VISION_MODEL=gemini-2.5-flash
```

키가 없거나 Gemini 호출이 실패해도 local fallback이 동작하도록 구현되어 있다.

## MVTec AD 샘플 실측

공식 MVTec AD 다운로드 링크가 불안정해서 Hugging Face의 `Voxel51/mvtec-ad` 미러에서 데모용 샘플만 내려받았다.

생성 파일:

- `demo-assets/mvtec-ad/manifest.json`
- `demo-assets/mvtec-ad/results.json`
- `demo-assets/mvtec-ad/api-results.json`

다운로드한 샘플:

- `normal-bottle-good.png`
- `normal-metal-nut-good.png`
- `normal-tile-good.png`
- `normal-capsule-good.png`
- `contamination-bottle.png`
- `scratch-capsule.png`
- `crack-capsule.png`
- `scratch-metal-nut.png`
- `crack-tile.png`

Gemini direct 분석 결과:

- `normal-metal-nut-good.png`: `normal`, confidence `0.95`
- `normal-tile-good.png`: `normal`, confidence `0.98`
- `normal-capsule-good.png`: `normal`, confidence `0.98`
- `contamination-bottle.png`: `defective / contamination`, confidence `0.95`
- `scratch-capsule.png`: `defective / scratch`, confidence `0.95`
- `scratch-metal-nut.png`: `defective / scratch`, confidence `0.9`
- `crack-tile.png`: `defective / crack`, confidence `0.98`

주의할 케이스:

- `normal-bottle-good.png`는 MVTec label은 `good`이지만 Gemini가 내부 링의 섬유/이물처럼 보이는 부분을 근거로 `defective / contamination`으로 판정했다.
- `crack-capsule.png`는 MVTec label은 `crack`이지만 Gemini는 표면 흠집으로 보고 `scratch`로 판정했다.

이 결과는 MVP 데모에서 작업자 피드백/수정 판정이 필요한 이유를 보여주는 사례로도 쓸 수 있다.

실제 백엔드 API `/api/inspections/analyze` 경로로 업로드한 결과:

- `normal-metal-nut-good.png`: `normal`, confidence `0.98`, status `pending`
- `contamination-bottle.png`: `defective / contamination`, confidence `0.95`, status `action_required`
- `scratch-capsule.png`: `defective / scratch`, confidence `0.95`, status `action_required`
- `crack-tile.png`: `defective / crack`, confidence `0.95`, status `action_required`

불량 샘플은 Agent 조치 체크리스트까지 함께 반환됐다.

## 생성/수정 파일

- `backend/src/vision/index.js`
- `backend/src/vision/local-vision-client.js`
- `backend/src/vision/gemini-vision-client.js`
- `backend/src/inspection-service.js`
- `backend/src/app.js`
- `backend/src/repositories/supabase-repository.js`
- `backend/test/vision.test.js`
- `backend/.env.example`
- `backend/README.md`
- `docs/workthrough/03-vision-ai-integration/workthrough.md`

## 다음 단계

4단계는 `RAG 파이프라인 구현`이다.

예상 작업:

- 매뉴얼 파일 업로드 API 구현
- 텍스트 추출/chunking
- embedding 생성
- `manual_chunks.embedding` 저장
- pgvector top-k 검색
- Agent 답변에 실제 source와 score 표시
