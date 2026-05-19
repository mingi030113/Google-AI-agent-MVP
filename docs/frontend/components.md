# Frontend Component Plan

## Layout

| Component | Responsibility |
|---|---|
| `AppShell` | authenticated app layout |
| `SidebarNav` | role-aware navigation |
| `TopBar` | page title, current user, role |
| `PageHeader` | title, description, actions |
| `PermissionGate` | hide or disable UI by role |

## Inspection

| Component | Responsibility |
|---|---|
| `InspectionUploadForm` | image, process, equipment, LOT input |
| `ImageDropzone` | file selection and drag-and-drop |
| `ImagePreview` | selected or stored image preview |
| `InspectionResultPanel` | result, defect type, confidence |
| `InspectionTable` | history list |
| `InspectionFilterBar` | date/process/equipment/result filters |
| `InspectionStatusBadge` | pending/reviewed/action_required/closed display |
| `FeedbackForm` | corrected result and action taken |

## Dashboard

| Component | Responsibility |
|---|---|
| `MetricCard` | summary KPI |
| `DefectTrendChart` | recent defect trend |
| `ProcessDefectRateChart` | process-level defect rate |
| `DefectTypeChart` | defect type distribution |
| `RiskEquipmentTable` | high-risk equipment list |
| `DateRangeToolbar` | dashboard date filter |

## Agent

| Component | Responsibility |
|---|---|
| `AgentChat` | question input and answer stream/result |
| `AgentAnswer` | generated answer |
| `SourceList` | RAG source snippets |
| `ActionChecklist` | recommended actions |
| `FallbackNotice` | no-source fallback state |

## Reports

| Component | Responsibility |
|---|---|
| `ReportGenerateForm` | daily/weekly report generation |
| `ReportList` | generated report history |
| `ReportViewer` | report content display |
| `ReportMetricSummary` | report KPI summary |

## Manuals

| Component | Responsibility |
|---|---|
| `ManualUploadForm` | manual file upload |
| `ManualTable` | manual list |
| `EmbeddingStatusBadge` | pending/processing/completed/failed |

## UI Rules

- Tables should support empty, loading, and error states.
- Buttons that trigger AI or report generation must show loading state.
- RAG answers must always show source snippets when `fallback` is false.
- If `fallback` is true, do not show confident action recommendations.
- Worker role should see execution-focused screens first: new inspection, history, detail.
- Manager roles should see analysis-focused screens first: dashboard, reports.

