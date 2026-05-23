import { randomUUID } from "node:crypto";
import { buildDashboardMetrics } from "./dashboard-service.js";
import { GeminiQualityReportClient } from "./report/gemini-report-client.js";
import { toKstIsoString } from "./time.js";

export async function generateReport({ reportType, startDate, endDate }, inspections, { env = process.env, store } = {}) {
  if (!["daily", "weekly"].includes(reportType)) {
    const error = new Error("reportType must be daily or weekly.");
    error.statusCode = 400;
    throw error;
  }

  if (!startDate || !endDate) {
    const error = new Error("startDate and endDate are required.");
    error.statusCode = 400;
    throw error;
  }

  validateReportRange({ reportType, startDate, endDate });

  const metrics = buildDashboardMetrics(inspections, { startDate, endDate });
  const scoped = filterByDateRange(inspections, startDate, endDate);
  const riskProcesses = metrics.processMetrics
    .filter((metric) => metric.riskLevel === "high")
    .map((metric) => metric.processName);
  const manuals = await loadReportManuals(store, metrics.summary.topDefectType);
  const fallbackAnalysis = buildFallbackAnalysis({ metrics, scoped, manuals });
  const generated = await generateAiAnalysis({
    reportType,
    startDate,
    endDate,
    metrics,
    scoped,
    manuals,
    fallbackAnalysis,
    env
  });
  const analysis = generated.analysis;

  return {
    id: `report-${randomUUID().slice(0, 8)}`,
    reportType,
    startDate,
    endDate,
    title: `${reportType === "daily" ? "일일" : "주간"} 품질 리포트 (${startDate} ~ ${endDate})`,
    summary: analysis.executiveSummary,
    riskProcesses,
    recommendedActions: analysis.recommendedActionItems.map((item) => item.action),
    metrics,
    analysis,
    reportDriver: generated.driver,
    createdAt: toKstIsoString()
  };
}

function validateReportRange({ reportType, startDate, endDate }) {
  const start = parseReportDate(startDate);
  const end = parseReportDate(endDate);

  if (!start || !end) {
    const error = new Error("startDate and endDate must be valid YYYY-MM-DD dates.");
    error.statusCode = 400;
    throw error;
  }

  if (end < start) {
    const error = new Error("endDate must be the same as or later than startDate.");
    error.statusCode = 400;
    throw error;
  }

  const daySpan = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (reportType === "daily" && daySpan !== 1) {
    const error = new Error("Daily reports can only be generated for one date.");
    error.statusCode = 400;
    throw error;
  }

  if (reportType === "weekly" && daySpan > 7) {
    const error = new Error("Weekly reports can cover up to 7 days.");
    error.statusCode = 400;
    throw error;
  }
}

function parseReportDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

async function generateAiAnalysis({ reportType, startDate, endDate, metrics, scoped, manuals, fallbackAnalysis, env }) {
  if (env.REPORT_GENERATION_DRIVER !== "gemini" && env.REPORT_ANSWER_DRIVER !== "gemini") {
    return { analysis: fallbackAnalysis, driver: "local" };
  }

  try {
    const client = new GeminiQualityReportClient({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_REPORT_MODEL || env.GEMINI_AGENT_MODEL || "gemini-2.5-flash"
    });
    const result = await client.generate({
      reportType,
      startDate,
      endDate,
      metrics,
      scopedInspections: buildInspectionBriefs(scoped),
      manuals,
      fallbackAnalysis
    });
    return { analysis: result.analysis, driver: result.raw.modelName ?? client.modelName };
  } catch {
    return { analysis: fallbackAnalysis, driver: "local-fallback" };
  }
}

async function loadReportManuals(store, topDefectType) {
  if (!store?.listManuals) {
    return [];
  }

  const manuals = await store.listManuals();
  return manuals
    .filter((manual) => !topDefectType || !manual.defectType || manual.defectType === topDefectType)
    .slice(0, 5)
    .map((manual, index) => ({
      title: manual.title,
      defectType: manual.defectType,
      excerpt: manual.excerpt,
      checklist: manual.checklist?.slice(0, 4) ?? [],
      score: Number((0.92 - index * 0.06).toFixed(2))
    }));
}

function buildFallbackAnalysis({ metrics, scoped, manuals }) {
  const total = metrics.summary.totalInspections;
  const defective = metrics.summary.defectiveCount;
  const defectRate = metrics.summary.defectRate;
  const topDefect = metrics.summary.topDefectType;
  const actionRequired = metrics.summary.actionRequiredCount ?? 0;
  const highRiskProcesses = metrics.processMetrics.filter((metric) => metric.riskLevel === "high");
  const highRiskEquipment = metrics.equipmentMetrics.filter((metric) => metric.riskLevel === "high");
  const defectAnalysis = buildDefectAnalysis(metrics);
  const processAnalysis = buildProcessAnalysis(metrics);
  const similarCases = buildSimilarCases(scoped);
  const ragEvidence = manuals.map((manual) => ({
    title: manual.title,
    excerpt: manual.excerpt,
    score: manual.score ?? 0.8
  }));

  return {
    executiveSummary: [
      `기간 내 총 ${total}건을 검사했고, 이 중 ${defective}건이 불량으로 판정되어 불량률은 ${defectRate}%입니다.`,
      topDefect ? `가장 많이 확인된 불량 유형은 ${topDefect}이며, 관련 공정과 설비 조건을 우선 점검해야 합니다.` : "집중적으로 반복된 불량 유형은 확인되지 않았습니다.",
      actionRequired > 0 ? `현재 조치 필요 상태의 검사 건이 ${actionRequired}건 남아 있어 원인 확인과 재검사 기록 정리가 필요합니다.` : "조치 필요 상태의 미해결 검사 건은 현재 기간 기준으로 확인되지 않았습니다."
    ].join(" "),
    keyFindings: [
      `전체 불량률은 ${defectRate}%이며 불량 ${defective}건이 확인되었습니다.`,
      topDefect ? `${topDefect} 유형이 최다 불량으로 확인되어 기준서 기반 점검이 필요합니다.` : "불량 유형 집중도는 낮아 표준 점검 주기 유지가 적절합니다.",
      highRiskProcesses.length > 0 ? `${highRiskProcesses.map((metric) => metric.processName).join(", ")} 공정이 고위험으로 분류되었습니다.` : "고위험 공정은 확인되지 않았습니다.",
      highRiskEquipment.length > 0 ? `${highRiskEquipment.map((metric) => metric.equipmentName).slice(0, 3).join(", ")} 설비의 불량률을 우선 확인해야 합니다.` : "고위험 설비는 확인되지 않았습니다."
    ],
    anomalySignals: buildAnomalySignals({ metrics, highRiskProcesses, highRiskEquipment, topDefect }),
    defectAnalysis,
    processAnalysis,
    rootCauseHypotheses: buildRootCauseHypotheses({ topDefect, highRiskProcesses, highRiskEquipment }),
    recommendedActionItems: buildRecommendedActionItems({ topDefect, highRiskProcesses, highRiskEquipment, actionRequired }),
    ragEvidence,
    similarCases,
    managerCommentary: buildManagerCommentary({ defectRate, topDefect, actionRequired, highRiskProcesses })
  };
}

function buildAnomalySignals({ metrics, highRiskProcesses, highRiskEquipment, topDefect }) {
  const signals = [];
  if (metrics.summary.defectRate >= 8) {
    signals.push({
      title: "기간 불량률 상승 관리 필요",
      severity: metrics.summary.defectRate >= 15 ? "high" : "medium",
      evidence: `기간 불량률 ${metrics.summary.defectRate}%로 관리 기준상 ${metrics.summary.defectRate >= 15 ? "고위험" : "주의"} 구간입니다.`
    });
  }
  if (topDefect) {
    const top = metrics.defectTypeDistribution.find((item) => item.defectType === topDefect);
    signals.push({
      title: `${topDefect} 유형 반복 발생`,
      severity: top?.count >= 3 ? "high" : "medium",
      evidence: `${topDefect} 불량이 ${top?.count ?? 0}건으로 가장 많이 집계되었습니다.`
    });
  }
  if (highRiskProcesses.length > 0) {
    const process = highRiskProcesses[0];
    signals.push({
      title: `${process.processName} 공정 고위험`,
      severity: "high",
      evidence: `${process.processName} 공정 불량률 ${process.defectRate}%로 고위험 기준을 충족합니다.`
    });
  }
  if (highRiskEquipment.length > 0) {
    const equipment = highRiskEquipment[0];
    signals.push({
      title: `${equipment.equipmentName} 설비 집중 점검 필요`,
      severity: "high",
      evidence: `${equipment.equipmentName} 설비 불량률 ${equipment.defectRate}%가 확인되었습니다.`
    });
  }

  return signals.length > 0 ? signals.slice(0, 4) : [{
    title: "이상 징후 미검출",
    severity: "low",
    evidence: "현재 기간의 공정/설비 지표는 고위험 기준에 도달하지 않았습니다."
  }];
}

function buildDefectAnalysis(metrics) {
  if (metrics.defectTypeDistribution.length === 0) {
    return [{
      defectType: "none",
      count: 0,
      rate: 0,
      interpretation: "기간 내 불량 유형 집계가 없어 표준 검사 주기 유지가 적절합니다."
    }];
  }

  return metrics.defectTypeDistribution.map((item) => ({
    defectType: item.defectType,
    count: item.count,
    rate: metrics.summary.defectiveCount === 0 ? 0 : Math.round((item.count / metrics.summary.defectiveCount) * 10000) / 100,
    interpretation: `${item.defectType} 유형이 불량 ${item.count}건을 차지하므로 관련 기준서와 최근 조치 이력을 우선 확인합니다.`
  }));
}

function buildProcessAnalysis(metrics) {
  return metrics.processMetrics
    .filter((metric) => metric.total > 0 || metric.riskLevel !== "low")
    .sort((left, right) => right.defectRate - left.defectRate)
    .slice(0, 5)
    .map((metric) => ({
      processName: metric.processName,
      defectRate: metric.defectRate,
      riskLevel: metric.riskLevel,
      reason: `${metric.total}건 중 ${metric.defective}건이 불량이며, 불량률 ${metric.defectRate}%로 ${riskLabel(metric.riskLevel)} 수준입니다.`
    }));
}

function buildRootCauseHypotheses({ topDefect, highRiskProcesses, highRiskEquipment }) {
  const hypotheses = [];
  if (topDefect) {
    hypotheses.push(`${topDefect} 유형 기준서의 주요 원인 항목과 실제 검사 이미지 특징이 일치하는지 확인할 필요가 있습니다.`);
  }
  if (highRiskProcesses.length > 0) {
    hypotheses.push(`${highRiskProcesses[0].processName} 공정의 작업 조건, 검사 기준 편차, 투입 LOT 특성 변화 가능성을 점검해야 합니다.`);
  }
  if (highRiskEquipment.length > 0) {
    hypotheses.push(`${highRiskEquipment[0].equipmentName} 설비의 마모, 오염, 세팅 조건 변화가 불량률에 영향을 줬을 가능성이 있습니다.`);
  }
  if (hypotheses.length === 0) {
    hypotheses.push("특정 원인으로 수렴되는 이상 징후는 낮으며, 표준 점검과 추세 모니터링을 유지하는 것이 적절합니다.");
  }
  return hypotheses;
}

function buildRecommendedActionItems({ topDefect, highRiskProcesses, highRiskEquipment, actionRequired }) {
  const actions = [];

  if (topDefect) {
    actions.push({
      priority: "high",
      action: `${topDefect} 유형 기준서 기준으로 원인 점검 항목을 재확인`,
      reason: `${topDefect} 유형이 기간 내 최다 불량으로 집계되었습니다.`
    });
  }

  for (const process of highRiskProcesses.slice(0, 2)) {
    actions.push({
      priority: "high",
      action: `${process.processName} 공정의 설비별 불량률과 최근 작업 조건 상관관계 확인`,
      reason: `${process.processName} 공정 불량률 ${process.defectRate}%로 고위험 기준입니다.`
    });
  }

  for (const equipment of highRiskEquipment.slice(0, 2)) {
    actions.push({
      priority: "medium",
      action: `${equipment.equipmentName} 설비 점검 및 동일 조건 샘플 재검사`,
      reason: `${equipment.equipmentName} 설비에서 불량률 ${equipment.defectRate}%가 확인되었습니다.`
    });
  }

  if (actionRequired > 0) {
    actions.push({
      priority: "medium",
      action: "조치 필요 상태 검사 건의 원인/조치/재검사 결과 입력 완료",
      reason: `미해결 조치 필요 건이 ${actionRequired}건 남아 있습니다.`
    });
  }

  if (actions.length === 0) {
    actions.push({
      priority: "low",
      action: "표준 점검 주기 유지 및 다음 기간 추세 모니터링",
      reason: "현재 기간에는 고위험 공정이나 반복 불량 집중이 확인되지 않았습니다."
    });
  }

  return actions;
}

function buildSimilarCases(scoped) {
  return scoped
    .filter((inspection) => inspection.feedback?.actionTaken || inspection.feedbackHistory?.some((item) => item.actionTaken))
    .slice(0, 5)
    .map((inspection) => {
      const feedback = inspection.feedback ?? inspection.feedbackHistory?.find((item) => item.actionTaken);
      return {
        inspectionId: inspection.id,
        outcome: feedback?.actionTaken ?? "조치 이력 확인 필요",
        similarity: inspection.result === "defective" ? 0.84 : 0.62
      };
    });
}

function buildManagerCommentary({ defectRate, topDefect, actionRequired, highRiskProcesses }) {
  const riskText = defectRate >= 15 ? "고위험" : defectRate >= 8 ? "주의" : "관리 가능";
  const focus = topDefect ? `${topDefect} 유형` : "표준 검사 항목";
  const processText = highRiskProcesses.length > 0 ? `${highRiskProcesses.map((item) => item.processName).join(", ")} 공정` : "전체 공정";
  return `이번 기간 품질 상태는 ${riskText} 수준으로 판단됩니다. ${focus}과 ${processText}을 우선 확인하고, 조치 필요 ${actionRequired}건은 재검사 결과까지 기록해 다음 리포트에서 재발 여부를 비교하십시오.`;
}

function filterByDateRange(inspections, startDate, endDate) {
  return inspections.filter((inspection) => {
    const date = inspection.inspectedAt.slice(0, 10);
    return date >= startDate && date <= endDate;
  });
}

function buildInspectionBriefs(inspections) {
  return inspections.slice(0, 30).map((inspection) => ({
    id: inspection.id,
    lotNo: inspection.lotNo,
    processName: inspection.processName,
    equipmentName: inspection.equipmentName,
    result: inspection.result,
    defectType: inspection.defectType,
    confidence: inspection.confidence,
    status: inspection.status,
    inspectedAt: inspection.inspectedAt,
    actionTaken: inspection.feedback?.actionTaken ?? inspection.feedbackHistory?.find((item) => item.actionTaken)?.actionTaken,
    reinspectionResult: inspection.feedback?.reinspectionResult ?? inspection.feedbackHistory?.find((item) => item.reinspectionResult)?.reinspectionResult
  }));
}

function riskLabel(level) {
  return {
    high: "고위험",
    medium: "주의",
    low: "낮음"
  }[level] ?? "주의";
}
