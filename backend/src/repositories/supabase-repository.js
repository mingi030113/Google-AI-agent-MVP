import { equipment, getAssetClass, getAssetKeyForEquipment, manuals, processes } from "../domain.js";
import { removeFeedback } from "../inspection-service.js";
import { cosineSimilarity, tokenize } from "../rag/embedding.js";

export class SupabaseRepository {
  constructor({
    url,
    serviceRoleKey,
    anonKey,
    inspectionImageBucket = "inspection-images",
    manualFileBucket = "manual-files"
  }) {
    this.url = url?.trim().replace(/\/$/, "");
    this.key = (serviceRoleKey || anonKey)?.trim();
    this.inspectionImageBucket = inspectionImageBucket.trim();
    this.manualFileBucket = manualFileBucket.trim();
    this.kind = "supabase";
  }

  async init() {
    if (!this.url) {
      throw new Error("SUPABASE_URL is required when STORE_DRIVER=supabase.");
    }
    if (!this.key) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is required when STORE_DRIVER=supabase.");
    }
    return this;
  }

  async listProcesses() {
    return this.request("/rest/v1/processes?select=id,name&order=sort_order.asc").then((rows) =>
      rows.map((row) => ({ id: row.id, name: row.name }))
    ).catch(() => processes);
  }

  async listEquipment() {
    return this.request("/rest/v1/equipment?select=id,process_id,name&order=sort_order.asc").then((rows) =>
      rows.map((row) => ({ id: row.id, processId: row.process_id, name: row.name, assetKey: getAssetKeyForEquipment(row.id) }))
    ).catch(() => equipment);
  }

  async saveUpload({ fileName, buffer, contentType }) {
    const path = `inspections/${Date.now()}-${fileName}`;
    await this.storageRequest(
      `/storage/v1/object/${this.inspectionImageBucket}/${encodeURIComponentPath(path)}`,
      {
        method: "POST",
        headers: {
          "content-type": contentType || "application/octet-stream",
          "x-upsert": "false"
        },
        body: buffer
      }
    );
    return `${this.url}/storage/v1/object/public/${this.inspectionImageBucket}/${encodeURIComponentPath(path)}`;
  }

  async saveManualFile({ fileName, buffer, contentType }) {
    const path = `manuals/${Date.now()}-${fileName}`;
    await this.storageRequest(
      `/storage/v1/object/${this.manualFileBucket}/${encodeURIComponentPath(path)}`,
      {
        method: "POST",
        headers: {
          "content-type": contentType || "application/octet-stream",
          "x-upsert": "false"
        },
        body: buffer
      }
    );
    return path;
  }

  async getUpload() {
    return null;
  }

  async listInspections() {
    const rows = await this.request(
      "/rest/v1/inspections?select=*,processes(name),equipment!inspections_equipment_process_fk(name),inspection_feedback(*)&order=inspected_at.desc"
    );
    return rows.map((row) => mapInspectionRow(row, this.publicStorageBase()));
  }

  async searchInspectionHistory(criteria = {}) {
    const params = new URLSearchParams();
    params.set("select", "*,processes(name),equipment!inspections_equipment_process_fk(name),inspection_feedback(*)");
    params.set("order", "inspected_at.desc");
    params.set("limit", "80");

    if (criteria.defectType) {
      params.set("defect_type", `eq.${criteria.defectType}`);
    }

    const anchorDate = criteria.currentInspection?.inspectedAt ? new Date(criteria.currentInspection.inspectedAt) : null;
    if (anchorDate && !Number.isNaN(anchorDate.getTime())) {
      const startDate = new Date(anchorDate.getTime() - 30 * 86_400_000).toISOString();
      const endDate = new Date(anchorDate.getTime() + 1 * 86_400_000).toISOString();
      params.set("inspected_at", `gte.${startDate}`);
      params.append("inspected_at", `lte.${endDate}`);
    }

    const rows = await this.request(`/rest/v1/inspections?${params.toString()}`);
    const inspections = rows.map((row) => mapInspectionRow(row, this.publicStorageBase()));
    const { findSimilarInspectionCases } = await import("../similar-case-service.js");
    return findSimilarInspectionCases(inspections, criteria);
  }

  async getInspection(id) {
    const rows = await this.request(
      `/rest/v1/inspections?id=eq.${encodeURIComponent(id)}&select=*,processes(name),equipment!inspections_equipment_process_fk(name),inspection_feedback(*)&limit=1`
    );
    return rows[0] ? mapInspectionRow(rows[0], this.publicStorageBase()) : null;
  }

  async addInspection(inspection) {
    const payload = inspectionToRow(inspection);
    await this.request("/rest/v1/inspections", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify(payload)
    });
    return inspection;
  }

  async updateInspection(id, updater) {
    const current = await this.getInspection(id);
    if (!current) {
      return null;
    }

    const updated = updater(current);
    await this.request(`/rest/v1/inspections?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        result: updated.result,
        defect_type: updated.defectType,
        status: updated.status,
        analyzed_payload: {
          agentGuidance: updated.agentGuidance,
          visionAnalysis: updated.visionAnalysis
        }
      })
    });

    if (updated.feedback && !feedbackExists(current, updated.feedback.id)) {
      const feedbackPayload = {
        inspection_id: id,
        corrected_result: updated.feedback.correctedResult || null,
        corrected_defect_type: updated.feedback.correctedDefectType || null,
        action_taken: updated.feedback.actionTaken,
        reinspection_result: updated.feedback.reinspectionResult || null,
        note: updated.feedback.note || null,
        created_at: updated.feedback.createdAt
      };

      if (isUuid(updated.feedback.id)) {
        feedbackPayload.id = updated.feedback.id;
      }

      await this.request("/rest/v1/inspection_feedback", {
        method: "POST",
        headers: { prefer: "return=minimal" },
        body: JSON.stringify(feedbackPayload)
      });
    }

    return this.getInspection(id);
  }

  async deleteInspectionFeedback(inspectionId, feedbackId) {
    const current = await this.getInspection(inspectionId);
    if (!current) {
      return null;
    }

    const result = removeFeedback(current, feedbackId);
    if (!result.deleted) {
      return null;
    }

    await this.request(`/rest/v1/inspection_feedback?id=eq.${encodeURIComponent(feedbackId)}&inspection_id=eq.${encodeURIComponent(inspectionId)}`, {
      method: "DELETE",
      headers: { prefer: "return=minimal" }
    });

    await this.request(`/rest/v1/inspections?id=eq.${encodeURIComponent(inspectionId)}`, {
      method: "PATCH",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        result: result.inspection.result,
        defect_type: result.inspection.defectType,
        status: result.inspection.status
      })
    });

    return this.getInspection(inspectionId);
  }

  async listReports() {
    const rows = await this.request("/rest/v1/reports?select=*&order=created_at.desc");
    return rows.map(mapReportRow);
  }

  async getReport(id) {
    const rows = await this.request(`/rest/v1/reports?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    return rows[0] ? mapReportRow(rows[0]) : null;
  }

  async addReport(report) {
    await this.request("/rest/v1/reports", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        id: report.id,
        report_type: report.reportType,
        start_date: report.startDate,
        end_date: report.endDate,
        title: report.title,
        summary: report.summary,
        risk_processes: report.riskProcesses,
        recommended_actions: report.recommendedActions,
        metrics: {
          ...report.metrics,
          reportAnalysis: report.analysis,
          reportDriver: report.reportDriver
        },
        created_at: report.createdAt
      })
    });
    return report;
  }

  async deleteReport(id) {
    const report = await this.getReport(id);
    if (!report) {
      return false;
    }

    await this.request(`/rest/v1/reports?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { prefer: "return=minimal" }
    });
    return true;
  }

  async listManuals() {
    try {
      const rows = await this.request("/rest/v1/manuals?select=id,title,defect_type,excerpt,checklist&order=created_at.asc");
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        defectType: row.defect_type,
        excerpt: row.excerpt,
        checklist: row.checklist ?? []
      }));
    } catch {
      return manuals;
    }
  }

  async upsertManualWithChunks(manual, chunks) {
    await this.request("/rest/v1/manuals", {
      method: "POST",
      headers: {
        prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({
        id: manual.id,
        title: manual.title,
        defect_type: manual.defectType,
        excerpt: manual.excerpt,
        checklist: manual.checklist,
        file_path: manual.filePath,
        embedding_status: manual.embeddingStatus
      })
    });

    await this.request(`/rest/v1/manual_chunks?manual_id=eq.${encodeURIComponent(manual.id)}`, {
      method: "DELETE",
      headers: { prefer: "return=minimal" }
    });

    if (chunks.length > 0) {
      await this.request("/rest/v1/manual_chunks", {
        method: "POST",
        headers: { prefer: "return=minimal" },
        body: JSON.stringify(chunks.map((chunk) => ({
          id: chunk.id,
          manual_id: chunk.manualId,
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          embedding: chunk.embedding,
          metadata: chunk.metadata
        })))
      });
    }

    return manual;
  }

  async deleteManual(id) {
    const rows = await this.request(`/rest/v1/manuals?id=eq.${encodeURIComponent(id)}&select=id&limit=1`);
    if (!rows[0]) {
      return false;
    }

    await this.request(`/rest/v1/manuals?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { prefer: "return=minimal" }
    });
    return true;
  }

  async searchManualChunks({ embedding, defectType, limit = 3 }) {
    try {
      const rows = await this.request("/rest/v1/rpc/match_manual_chunks", {
        method: "POST",
        body: JSON.stringify({
          query_embedding: embedding,
          match_count: limit,
          defect_type_filter: defectType
        })
      });
      return rows.map(mapManualChunkMatchRow);
    } catch {
      return this.searchManualChunksLocally({ embedding, defectType, limit });
    }
  }

  async searchManualChunksLocally({ embedding, defectType, limit = 3 }) {
    try {
      const rows = await this.fetchManualChunkCandidates({ defectType, limit });
      const scored = rows
        .map((row) => {
          const chunk = mapManualChunkRow(row);
          const chunkEmbedding = parseEmbedding(row.embedding);
          const vectorScore = chunkEmbedding.length > 0
            ? cosineSimilarity(embedding, chunkEmbedding)
            : lexicalSimilarity(`${chunk.metadata?.title ?? ""}\n${chunk.content}`, defectType ?? "");
          const defectBoost = defectType && chunk.metadata?.defectType === defectType ? 0.06 : 0;
          return {
            ...chunk,
            score: Math.max(0, Math.min(vectorScore + defectBoost, 0.99))
          };
        })
        .filter((chunk) => chunk.score > 0.01)
        .sort((left, right) => right.score - left.score)
        .slice(0, Number(limit));

      return scored;
    } catch {
      return [];
    }
  }

  async fetchManualChunkCandidates({ defectType, limit }) {
    const candidateLimit = Math.min(Math.max(Number(limit) * 10, 20), 80);
    const base = `/rest/v1/manual_chunks?select=id,manual_id,chunk_index,content,metadata,embedding&limit=${candidateLimit}&order=created_at.desc`;

    if (!defectType) {
      return this.request(base);
    }

    const filtered = await this.request(`${base}&metadata->>defectType=eq.${encodeURIComponent(defectType)}`);
    if (filtered.length > 0) {
      return filtered;
    }

    return this.request(base);
  }

  async request(path, init = {}) {
    const response = await fetch(`${this.url}${path}`, {
      ...init,
      headers: {
        apikey: this.key,
        authorization: `Bearer ${this.key}`,
        "content-type": "application/json",
        ...init.headers
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
    }

    if (response.status === 204) {
      return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async storageRequest(path, init = {}) {
    const response = await fetch(`${this.url}${path}`, {
      ...init,
      headers: {
        apikey: this.key,
        authorization: `Bearer ${this.key}`,
        ...init.headers
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase storage request failed: ${response.status} ${await response.text()}`);
    }

    return response;
  }

  publicStorageBase() {
    return `${this.url}/storage/v1/object/public/${this.inspectionImageBucket}`;
  }
}

function mapInspectionRow(row, publicStorageBase) {
  const feedbackHistory = [...(row.inspection_feedback ?? [])]
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .map(mapFeedbackRow);
  const feedback = feedbackHistory[0];
  const assetKey = row.analyzed_payload?.visionAnalysis?.assetKey
    ?? row.analyzed_payload?.visionAnalysis?.patchcoreModel?.assetKey
    ?? getAssetKeyForEquipment(row.equipment_id);
  const assetClass = getAssetClass(assetKey);

  const inspection = {
    id: row.id,
    imageUrl: toImageUrl(row.image_path, publicStorageBase),
    processId: row.process_id,
    processName: row.processes?.name ?? row.process_name ?? row.process_id,
    equipmentId: row.equipment_id,
    equipmentName: row.equipment?.name ?? row.equipment_name ?? row.equipment_id,
    assetKey,
    assetName: assetClass?.name ?? assetKey,
    lotNo: row.lot_no,
    operatorName: row.operator_name,
    result: row.result,
    defectType: row.defect_type,
    confidence: Number(row.confidence),
    modelName: row.model_name,
    status: row.status,
    inspectedAt: row.inspected_at,
    memo: row.memo ?? undefined,
    visionAnalysis: row.analyzed_payload?.visionAnalysis,
    agentGuidance: row.analyzed_payload?.agentGuidance,
    feedbackHistory
  };

  if (feedback) {
    inspection.feedback = feedback;
  }

  return inspection;
}

function mapFeedbackRow(row) {
  return {
    id: row.id,
    correctedResult: row.corrected_result ?? undefined,
    correctedDefectType: row.corrected_defect_type ?? undefined,
    actionTaken: row.action_taken,
    reinspectionResult: row.reinspection_result ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.created_at
  };
}

function feedbackExists(inspection, feedbackId) {
  if (!feedbackId) {
    return false;
  }

  const history = inspection.feedbackHistory ?? (inspection.feedback ? [inspection.feedback] : []);
  return history.some((item) => item.id === feedbackId);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? ""));
}

function inspectionToRow(inspection) {
  return {
    id: inspection.id,
    image_path: inspection.imageUrl,
    process_id: inspection.processId,
    equipment_id: inspection.equipmentId,
    lot_no: inspection.lotNo,
    operator_name: inspection.operatorName,
    result: inspection.result,
    defect_type: inspection.defectType,
    confidence: inspection.confidence,
    model_name: inspection.modelName,
    status: inspection.status,
    memo: inspection.memo,
    analyzed_payload: {
      agentGuidance: inspection.agentGuidance,
      visionAnalysis: inspection.visionAnalysis
    },
    inspected_at: inspection.inspectedAt
  };
}

function mapReportRow(row) {
  return {
    id: row.id,
    reportType: row.report_type,
    startDate: row.start_date,
    endDate: row.end_date,
    title: row.title,
    summary: row.summary,
    riskProcesses: row.risk_processes ?? [],
    recommendedActions: row.recommended_actions ?? [],
    metrics: row.metrics ?? {},
    analysis: row.analysis ?? row.metrics?.reportAnalysis ?? undefined,
    reportDriver: row.report_driver ?? row.metrics?.reportDriver ?? undefined,
    createdAt: row.created_at
  };
}

function mapManualChunkRow(row) {
  return {
    id: row.id,
    manualId: row.manual_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    metadata: row.metadata ?? {}
  };
}

function mapManualChunkMatchRow(row) {
  return {
    id: row.id,
    manualId: row.manual_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    metadata: row.metadata ?? {},
    score: Number(row.score ?? row.similarity ?? 0)
  };
}

function parseEmbedding(value) {
  if (Array.isArray(value)) {
    return value.map(Number).filter(Number.isFinite);
  }

  if (typeof value !== "string") {
    return [];
  }

  return value
    .replace(/^\s*\[/, "")
    .replace(/\]\s*$/, "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter(Number.isFinite);
}

function lexicalSimilarity(text, query) {
  const textTokens = new Set(tokenize(text));
  const queryTokens = tokenize(query);
  if (textTokens.size === 0 || queryTokens.length === 0) {
    return 0;
  }

  const matches = queryTokens.filter((token) => textTokens.has(token)).length;
  return matches / Math.max(queryTokens.length, 1);
}

function encodeURIComponentPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function toImageUrl(path, publicStorageBase) {
  if (!path || path.startsWith("http") || path.startsWith("/")) {
    return path;
  }
  return `${publicStorageBase}/${encodeURIComponentPath(path)}`;
}
