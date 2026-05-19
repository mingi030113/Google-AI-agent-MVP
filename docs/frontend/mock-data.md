# Frontend Mock Data

프론트 개발자는 백엔드 API가 완성되기 전까지 아래 데이터를 기준으로 UI를 구현한다.

## Processes

```ts
export const mockProcesses = [
  { id: "process-a", name: "A공정" },
  { id: "process-b", name: "B공정" },
  { id: "process-c", name: "C공정" },
];
```

## Equipment

```ts
export const mockEquipment = [
  { id: "eq-a-1", processId: "process-a", name: "A공정 1호기" },
  { id: "eq-a-2", processId: "process-a", name: "A공정 2호기" },
  { id: "eq-b-1", processId: "process-b", name: "B공정 1호기" },
];
```

## Inspection

```ts
export const mockInspection = {
  id: "insp-001",
  imageUrl: "/mock/product-scratch.jpg",
  processId: "process-a",
  processName: "A공정",
  equipmentId: "eq-a-1",
  equipmentName: "A공정 1호기",
  lotNo: "LOT-20260518-001",
  operatorName: "현장 작업자",
  result: "defective",
  defectType: "scratch",
  confidence: 0.86,
  modelName: "roboflow-demo-v1",
  status: "action_required",
  inspectedAt: "2026-05-18T09:30:00+09:00",
  agentGuidance: {
    answer:
      "스크래치 불량은 지그 마모, 이송 레일 오염, 작업대 이물질과 관련될 수 있습니다.",
    checklist: [
      { id: "c1", label: "지그 마모 상태 확인", priority: "high" },
      { id: "c2", label: "이송 레일 오염 여부 확인", priority: "medium" },
      { id: "c3", label: "작업대 이물질 제거", priority: "medium" },
    ],
    sources: [
      {
        title: "스크래치 불량 조치 기준서",
        excerpt: "스크래치 발생 시 지그 접촉면과 이송 레일 상태를 우선 확인한다.",
        score: 0.84,
      },
    ],
  },
};
```

## Dashboard

```ts
export const mockDashboardMetrics = {
  summary: {
    totalInspections: 128,
    defectiveCount: 17,
    defectRate: 13.28,
    topDefectType: "scratch",
    highRiskProcessCount: 1,
    highRiskEquipmentCount: 2,
  },
  trend: [
    { date: "2026-05-12", normal: 16, defective: 1, defectRate: 5.88 },
    { date: "2026-05-13", normal: 18, defective: 2, defectRate: 10.0 },
    { date: "2026-05-14", normal: 15, defective: 4, defectRate: 21.05 },
    { date: "2026-05-15", normal: 19, defective: 1, defectRate: 5.0 },
    { date: "2026-05-16", normal: 14, defective: 5, defectRate: 26.32 },
    { date: "2026-05-17", normal: 15, defective: 2, defectRate: 11.76 },
    { date: "2026-05-18", normal: 14, defective: 2, defectRate: 12.5 },
  ],
  processMetrics: [
    {
      processId: "process-a",
      processName: "A공정",
      total: 58,
      defective: 11,
      defectRate: 18.97,
      riskLevel: "high",
    },
    {
      processId: "process-b",
      processName: "B공정",
      total: 43,
      defective: 4,
      defectRate: 9.3,
      riskLevel: "medium",
    },
    {
      processId: "process-c",
      processName: "C공정",
      total: 27,
      defective: 2,
      defectRate: 7.41,
      riskLevel: "low",
    },
  ],
};
```

