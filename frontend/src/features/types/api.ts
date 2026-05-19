export type UserRole = "worker" | "quality_manager" | "process_manager" | "admin";
export type InspectionResult = "normal" | "defective";
export type InspectionStatus = "pending" | "reviewed" | "action_required" | "closed";
export type RiskLevel = "low" | "medium" | "high";

export interface MasterData {
  processes: Array<{ id: string; name: string }>;
  equipment: Array<{ id: string; processId: string; name: string }>;
}

export interface InspectionListItem {
  id: string;
  imageUrl: string;
  processName: string;
  equipmentName: string;
  lotNo: string;
  result: InspectionResult;
  defectType: string | null;
  confidence: number;
  status: InspectionStatus;
  inspectedAt: string;
}

export interface InspectionDetail extends InspectionListItem {
  processId: string;
  equipmentId: string;
  operatorName: string;
  modelName: string;
  memo?: string;
  visionAnalysis?: {
    driver?: string;
    reason?: string;
    fallback?: boolean;
    primaryModel?: string;
    fallbackModel?: string;
    signalMatched?: string;
    defectScores?: Record<string, number>;
    usageMetadata?: unknown;
  };
  feedback?: InspectionFeedback;
  feedbackHistory?: InspectionFeedback[];
  agentGuidance?: AgentGuidance;
}

export interface InspectionFeedback {
  id?: string;
  correctedResult?: InspectionResult;
  correctedDefectType?: string;
  actionTaken?: string;
  reinspectionResult?: InspectionResult;
  note?: string;
  createdAt: string;
}

export interface AgentGuidance {
  answer: string;
  checklist: Array<{ id: string; label: string; priority: "low" | "medium" | "high"; checked?: boolean }>;
  sources: Array<{ id?: string; title: string; excerpt: string; score: number; manualId?: string; chunkIndex?: number }>;
}

export interface InspectionListResponse {
  items: InspectionListItem[];
  page: number;
  pageSize: number;
  total: number;
  summary: {
    total: number;
    actionRequired: number;
    pendingReview: number;
    averageConfidence: number;
  };
}

export interface DashboardMetricsResponse {
  summary: {
    totalInspections: number;
    defectiveCount: number;
    defectRate: number;
    todayDate?: string;
    todayInspections?: number;
    todayDefectiveCount?: number;
    inspectionDelta?: number;
    defectiveDelta?: number;
    defectRateDelta?: number;
    actionRequiredCount?: number;
    topDefectType: string | null;
    highRiskProcessCount: number;
    highRiskEquipmentCount: number;
  };
  trend: Array<{ date: string; normal: number; defective: number; defectRate: number }>;
  processMetrics: Array<{
    processId: string;
    processName: string;
    total: number;
    defective: number;
    defectRate: number;
    riskLevel: RiskLevel;
  }>;
  equipmentMetrics: Array<{
    equipmentId: string;
    equipmentName: string;
    processName: string;
    total: number;
    defective: number;
    defectRate: number;
    riskLevel: RiskLevel;
  }>;
  defectTypeDistribution: Array<{ defectType: string; count: number }>;
}

export interface AskAgentResponse extends AgentGuidance {
  fallback: boolean;
}

export interface QualityReport {
  id: string;
  reportType: "daily" | "weekly";
  startDate: string;
  endDate: string;
  title: string;
  summary: string;
  riskProcesses: string[];
  recommendedActions: string[];
  metrics: DashboardMetricsResponse;
  createdAt: string;
}

export interface Manual {
  id: string;
  title: string;
  defectType: string | null;
  excerpt: string;
  checklist: Array<{ id: string; label: string; priority: "low" | "medium" | "high" }>;
  filePath?: string;
  embeddingStatus?: "pending" | "processing" | "completed" | "failed";
  createdAt?: string;
}

export interface UploadManualResponse {
  manual: Manual;
  chunks: Array<{
    id: string;
    manualId: string;
    chunkIndex: number;
    content: string;
    metadata: Record<string, unknown>;
  }>;
}
