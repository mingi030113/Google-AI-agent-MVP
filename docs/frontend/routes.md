# Frontend Routes

## Route Map

| Route | Page Purpose | Primary Components | Data Source |
|---|---|---|---|
| `/login` | 사용자 로그인 | `LoginForm` | Supabase Auth |
| `/inspections/new` | 제품 이미지 검사 요청 | `InspectionUploadForm`, `ImagePreview`, `InspectionResultPanel` | `POST /api/inspections/analyze` |
| `/inspections` | 검사 이력 조회 | `InspectionFilterBar`, `InspectionTable`, `InspectionStatusBadge` | `GET /api/inspections` |
| `/inspections/:inspectionId` | 검사 상세 및 피드백 | `InspectionSummary`, `DefectResultCard`, `FeedbackForm`, `ActionChecklist` | `GET /api/inspections/:id` |
| `/dashboard` | 품질 지표 시각화 | `MetricCard`, `DefectRateChart`, `RiskEquipmentTable`, `DefectTypeChart` | `GET /api/dashboard/metrics` |
| `/agent` | RAG 기반 조치 가이드 | `AgentChat`, `SourceList`, `ActionChecklist` | `POST /api/agent/ask` |
| `/reports` | 품질 리포트 생성/조회 | `ReportGenerateForm`, `ReportList`, `ReportViewer` | `GET/POST /api/reports` |
| `/admin/manuals` | 품질 매뉴얼 관리 | `ManualUploadForm`, `ManualTable`, `EmbeddingStatusBadge` | `GET/POST /api/manuals` |

## MVP Auth Flow

현재 웹 MVP는 Supabase Auth 직접 연동 전 단계로, `/login`에서 역할을 선택하면 브라우저 localStorage에 데모 세션을 저장한다.
`AppShell`은 세션 유무와 역할을 확인해 메뉴를 필터링하고, 접근 권한이 없는 화면은 역할별 기본 화면으로 돌려보낸다.

| Role | Visible Routes |
|---|---|
| `worker` | `/inspections/new`, `/inspections`, `/agent` |
| `quality_manager` | `/inspections/new`, `/inspections`, `/dashboard`, `/agent`, `/reports`, `/admin/manuals` |
| `process_manager` | `/inspections`, `/dashboard`, `/agent`, `/reports` |
| `admin` | all MVP app routes |

## Global Layout

App 영역은 좌측 사이드바와 상단 헤더를 사용한다.

```text
┌─────────────────────────────────────────────┐
│ Header: page title, user menu, role          │
├──────────────┬──────────────────────────────┤
│ Sidebar      │ Page Content                  │
│ - 새 검사     │                              │
│ - 검사 이력   │                              │
│ - 대시보드    │                              │
│ - Agent      │                              │
│ - 리포트      │                              │
└──────────────┴──────────────────────────────┘
```

## Page Details

### `/inspections/new`

Required fields:

| Field | Type | Required |
|---|---|---|
| `image` | file | yes |
| `processId` | select | yes |
| `equipmentId` | select | yes |
| `lotNo` | text | yes |
| `memo` | textarea | no |

Primary states:

| State | UI |
|---|---|
| idle | empty upload form |
| image_selected | image preview and metadata form |
| analyzing | disabled form, progress indicator |
| success | result panel and link to detail |
| error | retryable error message |

### `/inspections/:inspectionId`

Sections:

1. 검사 기본 정보
2. 이미지 미리보기
3. AI 판정 결과
4. RAG 조치 체크리스트
5. 작업자 피드백
6. 관련 Agent 답변 이력

### `/dashboard`

Default date range: recent 7 days.

Widgets:

| Widget | Description |
|---|---|
| Total inspections | 기간 내 검사 건수 |
| Defect rate | 전체 불량률 |
| Top defect type | 가장 많이 발생한 불량 유형 |
| Risk process | 위험 공정 |
| Defect trend | 일자별 정상/불량 추이 |
| Process defect rate | 공정별 불량률 |
| Equipment risk table | 설비별 불량률과 위험도 |
