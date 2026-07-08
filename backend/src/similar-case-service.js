const DEFAULT_LOOKBACK_DAYS = 30;

export function findSimilarInspectionCases(inspections, {
  currentInspection,
  defectType,
  processId,
  equipmentId,
  lotNo,
  limit = 3,
  lookbackDays = DEFAULT_LOOKBACK_DAYS
} = {}) {
  const anchorDate = currentInspection?.inspectedAt ? new Date(currentInspection.inspectedAt) : null;

  return inspections
    .filter((inspection) => inspection.id !== currentInspection?.id)
    .filter((inspection) => inspection.result === "defective" || inspection.feedback || inspection.feedbackHistory?.length)
    .filter((inspection) => withinLookback(inspection.inspectedAt, anchorDate, lookbackDays))
    .map((inspection) => scoreInspectionCase(inspection, {
      defectType,
      processId,
      equipmentId,
      lotNo
    }))
    .filter((item) => item.score >= 0.18)
    .sort((left, right) => right.score - left.score || right.inspectedAt.localeCompare(left.inspectedAt))
    .slice(0, Number(limit))
    .map(toSimilarCase);
}

function scoreInspectionCase(inspection, { defectType, processId, equipmentId, lotNo }) {
  const reasons = [];
  let score = 0;

  if (defectType && inspection.defectType === defectType) {
    score += 0.34;
    reasons.push("same_defect_type");
  }

  if (equipmentId && inspection.equipmentId === equipmentId) {
    score += 0.28;
    reasons.push("same_equipment");
  }

  if (processId && inspection.processId === processId) {
    score += 0.14;
    reasons.push("same_process");
  }

  if (lotNo && sameLotFamily(inspection.lotNo, lotNo)) {
    score += 0.08;
    reasons.push("similar_lot");
  }

  const feedback = latestFeedback(inspection);
  if (feedback?.actionTaken) {
    score += 0.1;
    reasons.push("has_action_history");
  }

  if (feedback?.reinspectionResult) {
    score += 0.06;
    reasons.push("has_reinspection_result");
  }

  if (inspection.status === "closed") {
    score += 0.03;
    reasons.push("closed_case");
  }

  return {
    inspection,
    feedback,
    reasons,
    score: Math.min(Math.round(score * 100) / 100, 0.99),
    inspectedAt: inspection.inspectedAt
  };
}

function toSimilarCase({ inspection, feedback, reasons, score }) {
  return {
    inspectionId: inspection.id,
    lotNo: inspection.lotNo,
    processName: inspection.processName,
    equipmentName: inspection.equipmentName,
    defectType: inspection.defectType,
    status: inspection.status,
    inspectedAt: inspection.inspectedAt,
    actionTaken: feedback?.actionTaken,
    reinspectionResult: feedback?.reinspectionResult,
    note: feedback?.note,
    score,
    reasons
  };
}

function latestFeedback(inspection) {
  if (inspection.feedback) {
    return inspection.feedback;
  }

  return [...(inspection.feedbackHistory ?? [])]
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];
}

function withinLookback(value, anchorDate, lookbackDays) {
  if (!anchorDate || Number.isNaN(anchorDate.getTime())) {
    return true;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return true;
  }

  const diffDays = Math.abs(anchorDate.getTime() - date.getTime()) / 86_400_000;
  return diffDays <= lookbackDays;
}

function sameLotFamily(left, right) {
  const leftParts = String(left ?? "").split("-");
  const rightParts = String(right ?? "").split("-");
  return leftParts.slice(0, 2).join("-") === rightParts.slice(0, 2).join("-");
}
