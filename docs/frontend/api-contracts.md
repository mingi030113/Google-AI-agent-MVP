# Frontend API Contracts

프론트엔드는 아래 계약을 기준으로 구현한다.
백엔드 구현 전에는 동일한 shape의 mock data를 사용한다.

## Common Types

```ts
export type UserRole =
  | "worker"
  | "quality_manager"
  | "process_manager"
  | "admin";

export type InspectionResult = "normal" | "defective";

export type InspectionStatus =
  | "pending"
  | "reviewed"
  | "action_required"
  | "closed";

export type RiskLevel = "low" | "medium" | "high";
```

## `POST /api/inspections/analyze`

Analyze an uploaded product image.

Request: `multipart/form-data`

| Field | Type |
|---|---|
| `image` | File |
| `processId` | string |
| `equipmentId` | string |
| `lotNo` | string |
| `memo` | string optional |

Response:

```ts
export interface AnalyzeInspectionResponse {
  inspection: InspectionDetail;
}
```

## `GET /api/inspections`

Query inspection history.

Query params:

| Param | Type |
|---|---|
| `startDate` | string optional |
| `endDate` | string optional |
| `processId` | string optional |
| `equipmentId` | string optional |
| `result` | InspectionResult optional |
| `status` | InspectionStatus optional |
| `page` | number |
| `pageSize` | number |

Response:

```ts
export interface InspectionListResponse {
  items: InspectionListItem[];
  page: number;
  pageSize: number;
  total: number;
}
```

## `GET /api/inspections/:inspectionId`

Response:

```ts
export interface InspectionDetailResponse {
  inspection: InspectionDetail;
}
```

## `POST /api/inspections/:inspectionId/feedback`

Request:

```ts
export interface SubmitFeedbackRequest {
  correctedResult?: InspectionResult;
  correctedDefectType?: string;
  actionTaken: string;
  reinspectionResult?: InspectionResult;
  note?: string;
}
```

Response:

```ts
export interface SubmitFeedbackResponse {
  inspection: InspectionDetail;
}
```

## `GET /api/dashboard/metrics`

Query params:

| Param | Type |
|---|---|
| `startDate` | string |
| `endDate` | string |

Response:

```ts
export interface DashboardMetricsResponse {
  summary: {
    totalInspections: number;
    defectiveCount: number;
    defectRate: number;
    topDefectType: string | null;
    highRiskProcessCount: number;
    highRiskEquipmentCount: number;
  };
  trend: Array<{
    date: string;
    normal: number;
    defective: number;
    defectRate: number;
  }>;
  processMetrics: Array<{
    processId: string;
    processName: string;
    total: number;
    defective: number;
    defectRate: number;
    riskLevel: RiskLevel;
  }>;
  equipmentMetrics: Array<{
    equipmentId: string;
    equipmentName: string;
    processName: string;
    total: number;
    defective: number;
    defectRate: number;
    riskLevel: RiskLevel;
  }>;
  defectTypeDistribution: Array<{
    defectType: string;
    count: number;
  }>;
}
```

## `POST /api/agent/ask`

Request:

```ts
export interface AskAgentRequest {
  question: string;
  inspectionId?: string;
  processId?: string;
  equipmentId?: string;
  defectType?: string;
}
```

## `GET /api/manuals`

Response:

```ts
export interface ManualListResponse {
  items: Array<{
    id: string;
    title: string;
    defectType: string | null;
    excerpt: string;
    checklist: Array<{
      id: string;
      label: string;
      priority: "low" | "medium" | "high";
    }>;
    filePath?: string;
    embeddingStatus?: "pending" | "processing" | "completed" | "failed";
  }>;
}
```

## `POST /api/manuals`

Upload a text or markdown manual and build searchable RAG chunks.

Request: `multipart/form-data`

| Field | Type |
|---|---|
| `file` | File |
| `title` | string |
| `defectType` | string optional |
| `checklist` | JSON array or newline list optional |

Response:

```ts
export interface UploadManualResponse {
  manual: {
    id: string;
    title: string;
    defectType: string | null;
    excerpt: string;
    checklist: Array<{
      id: string;
      label: string;
      priority: "low" | "medium" | "high";
    }>;
    filePath?: string;
    embeddingStatus: "completed";
    createdAt: string;
  };
  chunks: Array<{
    id: string;
    manualId: string;
    chunkIndex: number;
    content: string;
    metadata: Record<string, unknown>;
  }>;
}
```

Response:

```ts
export interface AskAgentResponse {
  answer: string;
  checklist: Array<{
    id: string;
    label: string;
    priority: "low" | "medium" | "high";
  }>;
  sources: Array<{
    title: string;
    excerpt: string;
    score: number;
  }>;
  fallback: boolean;
}
```

## `POST /api/reports`

Request:

```ts
export interface GenerateReportRequest {
  reportType: "daily" | "weekly";
  startDate: string;
  endDate: string;
}
```

Response:

```ts
export interface GenerateReportResponse {
  report: QualityReport;
}
```

## Shared Entity Shapes

```ts
export interface InspectionListItem {
  id: string;
  imageUrl: string;
  processName: string;
  equipmentName: string;
  lotNo: string;
  result: InspectionResult;
  defectType: string | null;
  confidence: number;
  status: InspectionStatus;
  inspectedAt: string;
}

export interface InspectionDetail extends InspectionListItem {
  processId: string;
  equipmentId: string;
  operatorName: string;
  modelName: string;
  memo?: string;
  feedback?: {
    correctedResult?: InspectionResult;
    correctedDefectType?: string;
    actionTaken?: string;
    reinspectionResult?: InspectionResult;
    note?: string;
    createdAt: string;
  };
  agentGuidance?: {
    answer: string;
    checklist: Array<{
      id: string;
      label: string;
      priority: "low" | "medium" | "high";
      checked?: boolean;
    }>;
    sources: Array<{
      title: string;
      excerpt: string;
      score: number;
    }>;
  };
}

export interface QualityReport {
  id: string;
  reportType: "daily" | "weekly";
  startDate: string;
  endDate: string;
  title: string;
  summary: string;
  riskProcesses: string[];
  recommendedActions: string[];
  metrics: Record<string, unknown>;
  createdAt: string;
}
```
