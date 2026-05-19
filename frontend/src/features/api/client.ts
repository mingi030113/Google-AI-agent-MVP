import type {
  AskAgentResponse,
  DashboardMetricsResponse,
  InspectionDetail,
  InspectionListResponse,
  InspectionResult,
  Manual,
  MasterData,
  QualityReport,
  UploadManualResponse
} from "@/features/types/api";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { "content-type": "application/json", ...init?.headers },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? body.error?.message ?? `API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function uploadBase(path: string) {
  return path.startsWith("http") ? path : `${API_BASE}${path}`;
}

export const client = {
  masterData: () => api<MasterData>("/api/master-data"),
  inspections: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams({ page: "1", pageSize: "10", ...params });
    return api<InspectionListResponse>(`/api/inspections?${query}`);
  },
  inspection: (id: string) => api<{ inspection: InspectionDetail }>(`/api/inspections/${id}`),
  analyze: (formData: FormData) =>
    api<{ inspection: InspectionDetail }>("/api/inspections/analyze", { method: "POST", body: formData }),
  feedback: (
    id: string,
    payload: {
      correctedResult?: InspectionResult;
      correctedDefectType?: string;
      actionTaken: string;
      reinspectionResult?: InspectionResult;
      note?: string;
    }
  ) => api<{ inspection: InspectionDetail }>(`/api/inspections/${id}/feedback`, { method: "POST", body: JSON.stringify(payload) }),
  dashboard: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params);
    return api<DashboardMetricsResponse>(`/api/dashboard/metrics?${query}`);
  },
  askAgent: (payload: { question: string; inspectionId?: string; processId?: string; equipmentId?: string; defectType?: string }) =>
    api<AskAgentResponse>("/api/agent/ask", { method: "POST", body: JSON.stringify(payload) }),
  reports: () => api<{ items: QualityReport[] }>("/api/reports"),
  createReport: (payload: { reportType: "daily" | "weekly"; startDate: string; endDate: string }) =>
    api<{ report: QualityReport }>("/api/reports", { method: "POST", body: JSON.stringify(payload) }),
  deleteReport: (id: string) =>
    api<void>(`/api/reports/${id}`, { method: "DELETE" }),
  manuals: () => api<{ items: Manual[] }>("/api/manuals"),
  uploadManual: (formData: FormData) =>
    api<UploadManualResponse>("/api/manuals", { method: "POST", body: formData }),
  deleteManual: (id: string) =>
    api<void>(`/api/manuals/${id}`, { method: "DELETE" })
};
