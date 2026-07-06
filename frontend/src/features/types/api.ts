export type UserRole = "worker" | "quality_manager" | "process_manager" | "admin";
export type InspectionResult = "normal" | "suspicious" | "defective";
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
  checklistProgress?: {
    completed: number;
    total: number;
  };
}

export interface InspectionDetail extends InspectionListItem {
  processId: string;
  equipmentId: string;
  operatorName: string;
  modelName: string;
  memo?: string;
  visionAnalysis?: {
    driver?: string;
    result?: InspectionResult;
    confidence?: number;
    anomalyScore?: number;
    threshold?: VisionThreshold;
    decisionMargin?: number;
    localization?: VisionLocalization | null;
    patchcoreModel?: PatchCoreModel;
    labelerModel?: LabelerModel | null;
    defectTypeCandidate?: string | null;
    reason?: string;
    fallback?: boolean;
    fallbackUsed?: boolean;
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

export interface VisionThreshold {
  image: number;
  pixel: number;
  method: string;
}

export interface PatchCoreModel {
  name: string;
  version: string;
  assetKey: string;
  backbone?: string;
  layers?: string[];
  coresetSamplingRatio?: number;
}

export interface LabelerModel {
  name: string;
  defectTypeCandidate: string | null;
  confidence: number;
  reason?: string;
  error?: string;
  defectScores?: Record<string, number>;
}

export interface VisionLocalization {
  heatmapBase64?: string | null;
  heatmapFullBase64?: string | null;
  heatmapFocusBase64?: string | null;
  heatmapUrl?: string | null;
  heatmapFullUrl?: string | null;
  heatmapFocusUrl?: string | null;
  heatmapMode?: "threshold" | "full" | "focus";
  maskUrl?: string | null;
  boxes: VisionBox[];
  imageSize?: { width: number; height: number } | null;
  modelInputSize?: { width: number; height: number } | null;
}

export interface VisionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  coordinateSpace: "original";
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
  similarCases?: SimilarInspectionCase[];
}

export interface SimilarInspectionCase {
  inspectionId: string;
  lotNo: string;
  processName: string;
  equipmentName: string;
  defectType: string | null;
  status: InspectionStatus;
  inspectedAt: string;
  actionTaken?: string;
  reinspectionResult?: InspectionResult;
  note?: string;
  score: number;
  reasons: string[];
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
  answerDriver?: "gemini" | "gemini-fallback" | "local" | string;
  answerModel?: string;
  answerFallbackReason?: string;
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
  analysis?: QualityReportAnalysis;
  reportDriver?: string;
  createdAt: string;
}

export interface QualityReportAnalysis {
  executiveSummary: string;
  keyFindings: string[];
  anomalySignals: Array<{ title: string; severity: RiskLevel; evidence: string }>;
  defectAnalysis: Array<{ defectType: string; count: number; rate: number; interpretation: string }>;
  processAnalysis: Array<{ processName: string; defectRate: number; riskLevel: RiskLevel; reason: string }>;
  rootCauseHypotheses: string[];
  recommendedActionItems: Array<{ priority: RiskLevel; action: string; reason: string }>;
  ragEvidence: Array<{ title: string; excerpt: string; score: number }>;
  similarCases: Array<{ inspectionId: string; outcome: string; similarity: number }>;
  managerCommentary: string;
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
