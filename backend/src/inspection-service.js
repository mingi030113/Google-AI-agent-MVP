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
    status: analysis.result === "defective" ? "action_required" : "closed",
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
  const normalized = normalizeInspectionStatus(inspection);
  return {
    id: normalized.id,
    imageUrl: normalized.imageUrl,
    processName: normalized.processName,
    equipmentName: normalized.equipmentName,
    lotNo: normalized.lotNo,
    result: normalized.result,
    defectType: normalized.defectType,
    confidence: normalized.confidence,
    status: normalized.status,
    inspectedAt: normalized.inspectedAt,
    checklistProgress: checklistProgress(normalized)
  };
}

export function normalizeInspectionStatus(inspection) {
  return {
    ...inspection,
    status: effectiveStatus(inspection)
  };
}

export function filterInspections(inspections, query) {
  const keyword = query.q?.trim().toLowerCase();
  return inspections.filter((inspection) => {
    const inspectedDate = inspection.inspectedAt.slice(0, 10);
    const searchTarget = [
      inspection.lotNo,
      inspection.processName,
      inspection.equipmentName,
      inspection.result,
      inspection.defectType,
      effectiveStatus(inspection)
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!keyword || searchTarget.includes(keyword)) &&
      (!query.startDate || inspectedDate >= query.startDate) &&
      (!query.endDate || inspectedDate <= query.endDate) &&
      (!query.processId || inspection.processId === query.processId) &&
      (!query.equipmentId || inspection.equipmentId === query.equipmentId) &&
      (!query.result || inspection.result === query.result) &&
      (!query.status || effectiveStatus(inspection) === query.status)
    );
  });
}

export function summarizeInspections(inspections) {
  const total = inspections.length;
  const actionRequired = inspections.filter((inspection) => effectiveStatus(inspection) === "action_required").length;
  const pendingReview = inspections.filter((inspection) => effectiveStatus(inspection) === "pending").length;
  const averageConfidence =
    total === 0
      ? 0
      : Math.round((inspections.reduce((sum, inspection) => sum + Number(inspection.confidence ?? 0), 0) / total) * 1000) / 10;

  return {
    total,
    actionRequired,
    pendingReview,
    averageConfidence
  };
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
  const feedbackEntry = {
    id: `fb-${randomUUID().slice(0, 8)}`,
    correctedResult: feedback.correctedResult,
    correctedDefectType: feedback.correctedDefectType,
    actionTaken: feedback.actionTaken.trim(),
    reinspectionResult: feedback.reinspectionResult,
    note: feedback.note,
    createdAt: toKstIsoString()
  };
  const existingHistory = inspection.feedbackHistory ?? (inspection.feedback ? [inspection.feedback] : []);

  return {
    ...inspection,
    result: correctedResult,
    defectType: correctedDefectType,
    status,
    feedback: feedbackEntry,
    feedbackHistory: [feedbackEntry, ...existingHistory]
  };
}

export function updateChecklistItem(inspection, { itemId, checked }) {
  if (!inspection.agentGuidance?.checklist?.length) {
    throw badRequest("Agent checklist is not available for this inspection.");
  }

  let matched = false;
  const checklist = inspection.agentGuidance.checklist.map((item) => {
    if (item.id !== itemId) {
      return item;
    }

    matched = true;
    return { ...item, checked: Boolean(checked) };
  });

  if (!matched) {
    throw badRequest("checklist item was not found.");
  }

  const nextInspection = {
    ...inspection,
    agentGuidance: {
      ...inspection.agentGuidance,
      checklist
    }
  };
  const progress = checklistProgress(nextInspection);

  if (inspection.status !== "closed" && progress.total > 0 && progress.completed === progress.total) {
    nextInspection.status = "reviewed";
  } else if (inspection.status === "reviewed" && inspection.result === "defective" && progress.completed < progress.total) {
    nextInspection.status = "action_required";
  }

  return nextInspection;
}

export function checklistProgress(inspection) {
  const checklist = inspection.agentGuidance?.checklist ?? [];
  return {
    completed: checklist.filter((item) => item.checked).length,
    total: checklist.length
  };
}

export function removeFeedback(inspection, feedbackId) {
  const existingHistory = inspection.feedbackHistory ?? (inspection.feedback ? [inspection.feedback] : []);
  const nextHistory = existingHistory.filter((item) => feedbackKey(item) !== feedbackId);

  if (nextHistory.length === existingHistory.length) {
    return { inspection, deleted: false };
  }

  const feedback = nextHistory[0];
  const nextInspection = {
    ...inspection,
    feedback,
    feedbackHistory: nextHistory,
    status: statusAfterFeedbackDelete(inspection, feedback)
  };

  if (!feedback) {
    delete nextInspection.feedback;
  }

  if (feedback?.correctedResult) {
    nextInspection.result = feedback.correctedResult;
    nextInspection.defectType = feedback.correctedResult === "defective"
      ? feedback.correctedDefectType ?? inspection.defectType ?? "scratch"
      : null;
  }

  return { inspection: nextInspection, deleted: true };
}

function feedbackKey(feedback) {
  return feedback.id ?? feedback.createdAt;
}

function statusAfterFeedbackDelete(inspection, feedback) {
  if (!feedback) {
    return inspection.result === "defective" ? "action_required" : "closed";
  }
  if (feedback.reinspectionResult === "normal") {
    return "closed";
  }
  if ((feedback.correctedResult ?? inspection.result) === "defective") {
    return "action_required";
  }
  return "reviewed";
}

function effectiveStatus(inspection) {
  return inspection.result === "normal" ? "closed" : inspection.status;
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(Math.trunc(value), min), max);
}
