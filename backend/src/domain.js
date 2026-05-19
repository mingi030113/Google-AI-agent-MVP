export const processes = [
  { id: "process-a", name: "A공정" },
  { id: "process-b", name: "B공정" },
  { id: "process-c", name: "C공정" }
];

export const equipment = [
  { id: "eq-a-1", processId: "process-a", name: "A공정 1호기" },
  { id: "eq-a-2", processId: "process-a", name: "A공정 2호기" },
  { id: "eq-b-1", processId: "process-b", name: "B공정 1호기" },
  { id: "eq-c-1", processId: "process-c", name: "C공정 1호기" }
];

export const manuals = [
  {
    id: "manual-scratch",
    title: "스크래치 불량 조치 기준서",
    defectType: "scratch",
    excerpt: "스크래치 발생 시 지그 접촉면과 이송 레일 상태를 우선 확인한다.",
    checklist: [
      { id: "scratch-1", label: "지그 마모 상태 확인", priority: "high" },
      { id: "scratch-2", label: "이송 레일 오염 여부 확인", priority: "medium" },
      { id: "scratch-3", label: "작업대 이물질 제거", priority: "medium" }
    ]
  },
  {
    id: "manual-contamination",
    title: "이물/오염 불량 조치 기준서",
    defectType: "contamination",
    excerpt: "이물 부착은 세척 공정, 에어 블로워 압력, 포장 전 대기 시간을 함께 확인한다.",
    checklist: [
      { id: "contamination-1", label: "세척 노즐 막힘 확인", priority: "high" },
      { id: "contamination-2", label: "에어 블로워 압력 기록 확인", priority: "medium" },
      { id: "contamination-3", label: "포장 전 보관 구역 청소", priority: "medium" }
    ]
  },
  {
    id: "manual-dent",
    title: "찍힘 불량 조치 기준서",
    defectType: "dent",
    excerpt: "찍힘 불량은 적재 높이, 이송 속도, 작업자 수동 취급 구간을 우선 점검한다.",
    checklist: [
      { id: "dent-1", label: "적재 높이 기준 준수 확인", priority: "high" },
      { id: "dent-2", label: "이송 속도 로그 확인", priority: "medium" },
      { id: "dent-3", label: "수동 취급 구간 완충재 확인", priority: "low" }
    ]
  },
  {
    id: "manual-crack",
    title: "균열 불량 조치 기준서",
    defectType: "crack",
    excerpt: "균열은 가압 조건과 냉각 시간 편차가 반복 원인인지 확인한다.",
    checklist: [
      { id: "crack-1", label: "가압 조건 이탈 알람 확인", priority: "high" },
      { id: "crack-2", label: "냉각 시간 편차 확인", priority: "high" },
      { id: "crack-3", label: "원자재 LOT 변경 여부 확인", priority: "medium" }
    ]
  }
];

export const defectTypes = manuals.map((manual) => manual.defectType);

export function getProcess(processId) {
  return processes.find((process) => process.id === processId) ?? null;
}

export function getEquipment(equipmentId) {
  return equipment.find((item) => item.id === equipmentId) ?? null;
}

export function getManualByDefectType(defectType) {
  return manuals.find((manual) => manual.defectType === defectType) ?? null;
}
