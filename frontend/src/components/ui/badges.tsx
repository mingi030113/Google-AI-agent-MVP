import type { InspectionResult, InspectionStatus, RiskLevel } from "@/features/types/api";

const resultLabels: Record<InspectionResult, string> = {
  normal: "정상",
  suspicious: "의심",
  defective: "불량"
};

const statusLabels: Record<InspectionStatus, string> = {
  pending: "대기",
  reviewed: "검토",
  action_required: "조치 필요",
  closed: "완료"
};

const riskLabels: Record<RiskLevel, string> = {
  low: "낮음",
  medium: "중간",
  high: "높음"
};

export function ResultBadge({ value }: { value: InspectionResult }) {
  return <span className={`badge ${value}`}>{resultLabels[value]}</span>;
}

export function StatusBadge({ value }: { value: InspectionStatus }) {
  return <span className={`badge ${value}`}>{statusLabels[value]}</span>;
}

export function RiskBadge({ value }: { value: RiskLevel }) {
  return <span className={`badge ${value}`}>{riskLabels[value]}</span>;
}
