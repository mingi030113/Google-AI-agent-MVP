import { randomUUID } from "node:crypto";
import { buildDashboardMetrics } from "./dashboard-service.js";
import { toKstIsoString } from "./time.js";

export function generateReport({ reportType, startDate, endDate }, inspections) {
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

  const metrics = buildDashboardMetrics(inspections, { startDate, endDate });
  const riskProcesses = metrics.processMetrics
    .filter((metric) => metric.riskLevel === "high")
    .map((metric) => metric.processName);
  const topDefect = metrics.summary.topDefectType;

  return {
    id: `report-${randomUUID().slice(0, 8)}`,
    reportType,
    startDate,
    endDate,
    title: `${reportType === "daily" ? "일일" : "주간"} 품질 리포트 (${startDate} ~ ${endDate})`,
    summary: `기간 내 검사 ${metrics.summary.totalInspections}건 중 불량 ${metrics.summary.defectiveCount}건, 불량률 ${metrics.summary.defectRate}%입니다.`,
    riskProcesses,
    recommendedActions: buildRecommendedActions({ riskProcesses, topDefect }),
    metrics,
    createdAt: toKstIsoString()
  };
}

function buildRecommendedActions({ riskProcesses, topDefect }) {
  const actions = [];

  if (topDefect) {
    actions.push(`${topDefect} 유형 기준서에 따라 반복 원인을 우선 점검`);
  }

  for (const process of riskProcesses) {
    actions.push(`${process} 설비별 불량률과 최근 작업 조건 상관관계 확인`);
  }

  if (actions.length === 0) {
    actions.push("현재 기간에는 고위험 공정이 없으므로 표준 점검 주기를 유지");
  }

  return actions;
}
