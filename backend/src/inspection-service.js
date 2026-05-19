import { randomUUID } from "node:crypto";
import { badRequest } from "./http.js";
import {
  getEquipment,
  getManualByDefectType,
  getProcess
} from "./domain.js";
import { toKstIsoString } from "./time.js";

export function validateInspectionInput({ processId, equipmentId, lotNo }) {
  const process = getProcess(processId);
  const selectedEquipment = getEquipment(equipmentId);

  if (!process) {
    throw badRequest("processId is invalid.");
  }

  if (!selectedEquipment || selectedEquipment.processId !== processId) {
    throw badRequest("equipmentId is invalid for the selected process.");
  }

  if (!lotNo || lotNo.trim().length === 0) {
    throw badRequest("lotNo is required.");
  }

  return { process, selectedEquipment };
}

export async function analyzeInspection({ fields, imageUrl, image, visionClient }) {
  const processId = fields.processId?.trim();
  const equipmentId = fields.equipmentId?.trim();
  const lotNo = fields.lotNo?.trim();
  const memo = fields.memo?.trim() || undefined;
  const { process, selectedEquipment } = validateInspectionInput({ processId, equipmentId, lotNo });
  const analysis = await visionClient.analyze({ fields, image, process, selectedEquipment });
  const manual = analysis.defectType ? getManualByDefectType(analysis.defectType) : null;

  return {
    id: `insp-${randomUUID().slice(0, 8)}`,
    imageUrl,
    processId,
    processName: process.name,
    equipmentId,
    equipmentName: selectedEquipment.name,
    lotNo,
    operatorName: "현장 작업자",
    result: analysis.result,
    defectType: analysis.defectType,
    confidence: analysis.confidence,
    modelName: analysis.modelName,
    status: analysis.result === "defective" ? "action_required" : "pending",
    inspectedAt: toKstIsoString(),
    memo,
    visionAnalysis: analysis.raw,
    agentGuidance: manual
      ? {
          answer: `${manual.title} 기준으로 설비 상태와 작업 조건을 우선 점검하세요.`,
          checklist: manual.checklist,
          sources: [{ title: manual.title, excerpt: manual.excerpt, score: 0.86 }]
        }
      : undefined
  };
}

export function toListItem(inspection) {
  return {
    id: inspection.id,
    imageUrl: inspection.imageUrl,
    processName: inspection.processName,
    equipmentName: inspection.equipmentName,
    lotNo: inspection.lotNo,
    result: inspection.result,
    defectType: inspection.defectType,
    confidence: inspection.confidence,
    status: inspection.status,
    inspectedAt: inspection.inspectedAt
  };
}

export function filterInspections(inspections, query) {
  return inspections.filter((inspection) => {
    const inspectedDate = inspection.inspectedAt.slice(0, 10);
    return (
      (!query.startDate || inspectedDate >= query.startDate) &&
      (!query.endDate || inspectedDate <= query.endDate) &&
      (!query.processId || inspection.processId === query.processId) &&
      (!query.equipmentId || inspection.equipmentId === query.equipmentId) &&
      (!query.result || inspection.result === query.result) &&
      (!query.status || inspection.status === query.status)
    );
  });
}

export function paginate(items, query) {
  const page = clampNumber(Number(query.page ?? 1), 1, 100000);
  const pageSize = clampNumber(Number(query.pageSize ?? 20), 1, 100);
  const offset = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    total: items.length,
    items: items.slice(offset, offset + pageSize)
  };
}

export function applyFeedback(inspection, feedback) {
  if (!feedback.actionTaken || feedback.actionTaken.trim().length === 0) {
    throw badRequest("actionTaken is required.");
  }

  const correctedResult = feedback.correctedResult ?? inspection.result;
  const correctedDefectType =
    correctedResult === "defective"
      ? feedback.correctedDefectType ?? inspection.defectType ?? "scratch"
      : null;
  const status =
    feedback.reinspectionResult === "normal"
      ? "closed"
      : correctedResult === "defective"
        ? "action_required"
        : "reviewed";

  return {
    ...inspection,
    result: correctedResult,
    defectType: correctedDefectType,
    status,
    feedback: {
      correctedResult: feedback.correctedResult,
      correctedDefectType: feedback.correctedDefectType,
      actionTaken: feedback.actionTaken.trim(),
      reinspectionResult: feedback.reinspectionResult,
      note: feedback.note,
      createdAt: toKstIsoString()
    }
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(Math.trunc(value), min), max);
}
