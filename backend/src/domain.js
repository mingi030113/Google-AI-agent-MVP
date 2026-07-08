export const processes = [
  { id: "process-a", name: "A공정" },
  { id: "process-b", name: "B공정" },
  { id: "process-c", name: "C공정" }
];

export const equipment = [
  { id: "eq-a-1", processId: "process-a", name: "A공정 1호기", assetKey: "bottle" },
  { id: "eq-a-2", processId: "process-a", name: "A공정 2호기", assetKey: "bottle" },
  { id: "eq-b-1", processId: "process-b", name: "B공정 1호기", assetKey: "metal_nut" },
  { id: "eq-c-1", processId: "process-c", name: "C공정 1호기", assetKey: "metal_nut" }
];

export const assetClasses = [
  { id: "bottle", name: "Bottle" },
  { id: "metal_nut", name: "Metal Nut" }
];

export const manuals = [
  {
    id: "manual-scratch",
    title: "스크래치 불량 조치 기준서",
    defectType: "scratch",
    excerpt: "MVTec AD scratch 의심 시 capsule feeder/chute, metal_nut fixture/deburring, screw driver bit, pill feeder, wood sanding belt 등 카테고리별 접촉부와 heatmap 선형 방향을 확인한다.",
    checklist: [
      { id: "scratch-1", label: "카테고리별 접촉부 확인: capsule feeder/chute, metal_nut fixture/deburring, screw driver bit", priority: "high" },
      { id: "scratch-2", label: "금속 칩, burr, 분진, 파손 완충재 제거 또는 교체", priority: "high" },
      { id: "scratch-3", label: "원본 이미지의 선 방향과 heatmap 집중 방향을 정상 샘플과 비교", priority: "medium" }
    ]
  },
  {
    id: "manual-contamination",
    title: "이물/오염 불량 조치 기준서",
    defectType: "contamination",
    excerpt: "MVTec AD contamination 의심 시 residue, fiber/thread, oil, glue, metal_contamination, liquid 유형으로 분류하고 bottle 세척/건조, tile/leather glue-oil 구간, carpet/grid 낙진 구간을 점검한다.",
    checklist: [
      { id: "contamination-1", label: "오염 유형 분류: residue, fiber/thread, oil, glue, metal_contamination, liquid", priority: "high" },
      { id: "contamination-2", label: "bottle 세척 노즐/필터/블로워 또는 tile/leather glue-oil 접촉 구간 확인", priority: "high" },
      { id: "contamination-3", label: "재세척 또는 표면 닦음 후 동일 LOT 샘플 5개 이상 재검사", priority: "medium" }
    ]
  },
  {
    id: "manual-dent",
    title: "찍힘/변형 불량 조치 기준서",
    defectType: "dent",
    excerpt: "dent/변형 의심 시 MVTec AD의 capsule squeeze, metal_nut bent, transistor bent_lead, cable bent_wire, zipper squeezed_teeth를 정상 샘플 외곽선과 비교하고 press/fixture/tray/guide 조건을 점검한다.",
    checklist: [
      { id: "dent-1", label: "정상 샘플 외곽선과 비교해 squeeze, bent, bent_lead, squeezed_teeth 여부 기록", priority: "high" },
      { id: "dent-2", label: "적재 높이, press/fixture 압력, tray 완충재, guide 간격 확인", priority: "high" },
      { id: "dent-3", label: "이송 속도 로그, 급정지/충돌 알람, pick-and-place 위치 이력 확인", priority: "medium" }
    ]
  },
  {
    id: "manual-flip",
    title: "방향 오류/Flip 불량 조치 기준서",
    defectType: "flip",
    excerpt: "metal_nut flip 또는 방향/정렬 오류 의심 시 bowl feeder, orientation rail, vision 정렬 기준, pick-and-place 방향 보정값을 확인한다.",
    checklist: [
      { id: "flip-1", label: "정상 샘플과 비교해 부품 앞뒤/상하 방향, 체결면 노출 방향, 기준 홈 위치를 확인", priority: "high" },
      { id: "flip-2", label: "bowl feeder, orientation rail, escapement, pick-and-place 흡착 방향 설정 점검", priority: "high" },
      { id: "flip-3", label: "동일 LOT 샘플 5개 이상 재검사해 flip 재발 여부와 방향 보정값을 기록", priority: "medium" }
    ]
  },
  {
    id: "manual-crack",
    title: "균열 불량 조치 기준서",
    defectType: "crack",
    excerpt: "MVTec AD crack 의심 시 tile/capsule/pill crack, bottle broken_large/broken_small, hazelnut crack/cut/hole의 branching과 파단 경계를 확인하고 기능부 또는 관통 균열이면 설비 정지와 LOT 격리를 수행한다.",
    checklist: [
      { id: "crack-1", label: "기능부 또는 관통 균열 의심 시 설비 즉시 정지", priority: "high" },
      { id: "crack-2", label: "tile/capsule/bottle/hazelnut/pill 원본 이미지에서 branching, 파단 경계, broken 여부 확인", priority: "high" },
      { id: "crack-3", label: "성형/가압 조건, 냉각/건조 시간, 원자재 LOT 변경 이력 확인", priority: "high" }
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

export function getAssetKeyForEquipment(equipmentId) {
  return normalizeAssetKey(getEquipment(equipmentId)?.assetKey);
}

export function getAssetClass(assetKey) {
  const normalized = normalizeAssetKey(assetKey);
  return assetClasses.find((item) => item.id === normalized) ?? null;
}

export function normalizeAssetKey(assetKey) {
  return String(assetKey ?? "bottle")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_")
    .replace(/[^a-z0-9_]/g, "") || "bottle";
}

export function getManualByDefectType(defectType) {
  return manuals.find((manual) => manual.defectType === defectType) ?? null;
}
