import { equipment, processes } from "./domain.js";
import { addDays, eachDate, latestDateOnly } from "./time.js";

export function buildDashboardMetrics(inspections, query = {}) {
  const latest = latestDateOnly(inspections);
  const startDate = query.startDate || addDays(latest, -6);
  const endDate = query.endDate || latest;
  const scoped = inspections.filter((inspection) => {
    const date = inspection.inspectedAt.slice(0, 10);
    return date >= startDate && date <= endDate;
  });

  const trend = eachDate(startDate, endDate).map((date) => {
    const items = scoped.filter((inspection) => inspection.inspectedAt.startsWith(date));
    const defective = countDefective(items);
    const normal = items.length - defective;
    return { date, normal, defective, defectRate: defectRate(defective, items.length) };
  });

  const processMetrics = processes.map((process) => {
    const items = scoped.filter((inspection) => inspection.processId === process.id);
    const defective = countDefective(items);
    const rate = defectRate(defective, items.length);
    return {
      processId: process.id,
      processName: process.name,
      total: items.length,
      defective,
      defectRate: rate,
      riskLevel: riskLevel(rate)
    };
  });

  const equipmentMetrics = equipment.map((item) => {
    const items = scoped.filter((inspection) => inspection.equipmentId === item.id);
    const defective = countDefective(items);
    const rate = defectRate(defective, items.length);
    const process = processes.find((candidate) => candidate.id === item.processId);
    return {
      equipmentId: item.id,
      equipmentName: item.name,
      processName: process?.name ?? item.processId,
      total: items.length,
      defective,
      defectRate: rate,
      riskLevel: riskLevel(rate)
    };
  });

  const defectTypeDistribution = Object.entries(
    scoped.reduce((counts, inspection) => {
      if (inspection.result === "defective" && inspection.defectType) {
        counts[inspection.defectType] = (counts[inspection.defectType] ?? 0) + 1;
      }
      return counts;
    }, {})
  )
    .map(([defectType, count]) => ({ defectType, count }))
    .sort((left, right) => right.count - left.count);

  const defectiveCount = countDefective(scoped);
  const topDefectType = defectTypeDistribution[0]?.defectType ?? null;

  return {
    summary: {
      totalInspections: scoped.length,
      defectiveCount,
      defectRate: defectRate(defectiveCount, scoped.length),
      topDefectType,
      highRiskProcessCount: processMetrics.filter((metric) => metric.riskLevel === "high").length,
      highRiskEquipmentCount: equipmentMetrics.filter((metric) => metric.riskLevel === "high").length
    },
    trend,
    processMetrics,
    equipmentMetrics,
    defectTypeDistribution
  };
}

function countDefective(items) {
  return items.filter((inspection) => inspection.result === "defective").length;
}

function defectRate(defective, total) {
  return total === 0 ? 0 : Math.round((defective / total) * 10000) / 100;
}

function riskLevel(rate) {
  if (rate >= 15) {
    return "high";
  }
  if (rate >= 8) {
    return "medium";
  }
  return "low";
}
