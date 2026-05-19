import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { equipment, manuals, processes } from "./domain.js";

const dayPlan = [
  { date: "2026-05-12", normal: 16, defective: 1 },
  { date: "2026-05-13", normal: 18, defective: 2 },
  { date: "2026-05-14", normal: 15, defective: 4 },
  { date: "2026-05-15", normal: 19, defective: 1 },
  { date: "2026-05-16", normal: 14, defective: 5 },
  { date: "2026-05-17", normal: 15, defective: 2 },
  { date: "2026-05-18", normal: 14, defective: 2 }
];

const defectCycle = ["scratch", "contamination", "dent", "crack", "scratch", "scratch"];

export function seedDatabase() {
  const inspections = [];
  let sequence = 1;
  let defectIndex = 0;

  for (const plan of dayPlan) {
    for (let index = 0; index < plan.defective; index += 1) {
      const defectType = defectCycle[defectIndex % defectCycle.length];
      inspections.push(buildInspection({
        sequence,
        date: plan.date,
        result: "defective",
        defectType,
        defectOrdinal: defectIndex
      }));
      sequence += 1;
      defectIndex += 1;
    }

    for (let index = 0; index < plan.normal; index += 1) {
      inspections.push(buildInspection({
        sequence,
        date: plan.date,
        result: "normal",
        defectType: null,
        defectOrdinal: defectIndex
      }));
      sequence += 1;
    }
  }

  return {
    inspections: inspections.sort((left, right) => right.inspectedAt.localeCompare(left.inspectedAt)),
    reports: [],
    manuals,
    manualChunks: []
  };
}

export async function seedUploadFiles(uploadsDir) {
  await Promise.all([
    writeFile(join(uploadsDir, "seed-normal.svg"), svg("정상", "#1f8a70", "#e5f6f1"), "utf8"),
    writeFile(join(uploadsDir, "seed-scratch.svg"), svg("스크래치", "#b42318", "#fff1f0"), "utf8"),
    writeFile(join(uploadsDir, "seed-contamination.svg"), svg("오염", "#b54708", "#fff7ed"), "utf8"),
    writeFile(join(uploadsDir, "seed-dent.svg"), svg("찍힘", "#7a2e0e", "#fff4e5"), "utf8"),
    writeFile(join(uploadsDir, "seed-crack.svg"), svg("균열", "#8a1538", "#fff0f6"), "utf8")
  ]);
}

function buildInspection({ sequence, date, result, defectType, defectOrdinal }) {
  const process = processes[(sequence + defectOrdinal) % processes.length];
  const processEquipment = equipment.filter((item) => item.processId === process.id);
  const selectedEquipment = processEquipment[sequence % processEquipment.length];
  const id = `insp-${String(sequence).padStart(3, "0")}`;
  const inspectedAt = `${date}T${String(8 + (sequence % 9)).padStart(2, "0")}:${String((sequence * 7) % 60).padStart(2, "0")}:00+09:00`;
  const manual = manuals.find((item) => item.defectType === defectType);

  return {
    id,
    imageUrl: result === "normal" ? "/uploads/seed-normal.svg" : `/uploads/seed-${defectType}.svg`,
    processId: process.id,
    processName: process.name,
    equipmentId: selectedEquipment.id,
    equipmentName: selectedEquipment.name,
    lotNo: `LOT-${date.replaceAll("-", "")}-${String(sequence).padStart(3, "0")}`,
    operatorName: "현장 작업자",
    result,
    defectType,
    confidence: result === "normal" ? 0.91 : 0.86,
    modelName: "local-vision-heuristic-v1",
    status: result === "defective" ? "action_required" : sequence % 4 === 0 ? "reviewed" : "pending",
    inspectedAt,
    agentGuidance: manual
      ? {
          answer: `${manual.title}에 따라 원인 후보를 좁히고 재발 방지 조치를 기록하세요.`,
          checklist: manual.checklist,
          sources: [{ title: manual.title, excerpt: manual.excerpt, score: 0.84 }]
        }
      : undefined
  };
}

function svg(label, stroke, background) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">
  <rect width="960" height="640" fill="${background}"/>
  <rect x="180" y="120" width="600" height="400" rx="18" fill="#ffffff" stroke="${stroke}" stroke-width="8"/>
  <path d="M260 360 C350 300 430 410 520 330 S660 290 720 370" fill="none" stroke="${stroke}" stroke-width="12" stroke-linecap="round"/>
  <text x="480" y="305" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="${stroke}">${label}</text>
</svg>`;
}
