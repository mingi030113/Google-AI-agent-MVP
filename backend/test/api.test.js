import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { ingestManual } from "../src/rag/manual-ingestion-service.js";
import { embedText } from "../src/rag/embedding.js";
import { SupabaseRepository } from "../src/repositories/supabase-repository.js";

describe("quality agent backend API", () => {
  let dataDir;
  let server;
  let baseUrl;

  before(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "quality-agent-backend-"));
    server = await createApp({
      dataDir,
      env: {
        STORE_DRIVER: "json",
        VISION_DRIVER: "local",
        AGENT_ANSWER_DRIVER: "local"
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
  });

  it("returns seeded inspection history and dashboard metrics", async () => {
    const masterData = await jsonFetch(`${baseUrl}/api/master-data`);
    assert.deepEqual(masterData.assetClasses.map((item) => item.id), ["bottle", "metal_nut"]);
    assert.equal(masterData.equipment.find((item) => item.id === "eq-a-1").assetKey, "bottle");
    assert.equal(masterData.equipment.find((item) => item.id === "eq-b-1").assetKey, "metal_nut");

    const inspections = await jsonFetch(`${baseUrl}/api/inspections?page=1&pageSize=5`);
    assert.equal(inspections.items.length, 5);
    assert.equal(inspections.total, 128);
    assert.deepEqual(inspections.summary, {
      total: 128,
      actionRequired: 17,
      pendingReview: 0,
      averageConfidence: 90.3
    });

    const searched = await jsonFetch(`${baseUrl}/api/inspections?page=1&pageSize=5&q=crack`);
    assert.equal(searched.summary.total, 3);
    assert.equal(searched.summary.actionRequired, 3);

    const metrics = await jsonFetch(`${baseUrl}/api/dashboard/metrics?startDate=2026-05-12&endDate=2026-05-18`);
    assert.equal(metrics.summary.totalInspections, 128);
    assert.equal(metrics.summary.defectiveCount, 17);
    assert.equal(metrics.trend.length, 7);
  });

  it("analyzes an uploaded image and accepts feedback", async () => {
    const form = new FormData();
    form.append("processId", "process-b");
    form.append("equipmentId", "eq-b-1");
    form.append("lotNo", "LOT-TEST-scratch");
    form.append("memo", "스크래치 의심");
    form.append("image", new Blob(["fake image bytes"], { type: "image/jpeg" }), "scratch.jpg");

    const analyzed = await jsonFetch(`${baseUrl}/api/inspections/analyze`, {
      method: "POST",
      body: form
    });

    assert.equal(analyzed.inspection.result, "defective");
    assert.equal(analyzed.inspection.defectType, "scratch");
    assert.equal(analyzed.inspection.assetKey, "metal_nut");
    assert.equal(analyzed.inspection.assetName, "Metal Nut");

    const checklistItemIds = analyzed.inspection.agentGuidance.checklist.map((item) => item.id);
    const firstChecklistUpdate = await jsonFetch(`${baseUrl}/api/inspections/${analyzed.inspection.id}/checklist`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        itemId: checklistItemIds[0],
        checked: true
      })
    });
    assert.equal(firstChecklistUpdate.inspection.agentGuidance.checklist[0].checked, true);
    assert.equal(firstChecklistUpdate.inspection.status, "action_required");

    for (const itemId of checklistItemIds.slice(1)) {
      await jsonFetch(`${baseUrl}/api/inspections/${analyzed.inspection.id}/checklist`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId, checked: true })
      });
    }

    const listed = await jsonFetch(`${baseUrl}/api/inspections?page=1&pageSize=1&q=LOT-TEST-scratch`);
    assert.deepEqual(listed.items[0].checklistProgress, { completed: 3, total: 3 });
    assert.equal(listed.items[0].status, "reviewed");

    const feedback = await jsonFetch(`${baseUrl}/api/inspections/${analyzed.inspection.id}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionTaken: "지그 접촉면 점검 및 청소 완료",
        reinspectionResult: "normal"
      })
    });

    assert.equal(feedback.inspection.status, "closed");
    assert.ok(feedback.inspection.feedback.id);

    const deletedFeedback = await jsonFetch(`${baseUrl}/api/inspections/${analyzed.inspection.id}/feedback/${feedback.inspection.feedback.id}`, {
      method: "DELETE"
    });

    assert.equal(deletedFeedback.inspection.feedbackHistory.length, 0);
    assert.equal(deletedFeedback.inspection.feedback, undefined);
  });

  it("answers agent questions and generates reports", async () => {
    const answer = await jsonFetch(`${baseUrl}/api/agent/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "scratch 조치 기준 알려줘", defectType: "scratch" })
    });
    assert.equal(answer.fallback, false);
    assert.equal(answer.answerDriver, "local");
    assert.ok(answer.sources.length > 0);
    assert.ok(answer.similarCases.length > 0);
    assert.equal(answer.similarCases[0].defectType, "scratch");

    const reinspectionAnswer = await jsonFetch(`${baseUrl}/api/agent/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "scratch 재검사 기준 알려줘", defectType: "scratch" })
    });
    const workerMessageAnswer = await jsonFetch(`${baseUrl}/api/agent/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "scratch 작업자 안내 문구 작성", defectType: "scratch" })
    });
    assert.notEqual(answer.answer, reinspectionAnswer.answer);
    assert.notEqual(reinspectionAnswer.answer, workerMessageAnswer.answer);
    assert.match(reinspectionAnswer.answer, /재검사|동일 LOT/);
    assert.match(workerMessageAnswer.answer, /작업자 전달 문구/);

    const invalidDailyReport = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reportType: "daily",
        startDate: "2026-05-12",
        endDate: "2026-05-18"
      })
    });
    assert.equal(invalidDailyReport.status, 400);

    const invalidWeeklyReport = await fetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reportType: "weekly",
        startDate: "2026-05-01",
        endDate: "2026-05-18"
      })
    });
    assert.equal(invalidWeeklyReport.status, 400);

    const report = await jsonFetch(`${baseUrl}/api/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reportType: "daily",
        startDate: "2026-05-18",
        endDate: "2026-05-18"
      })
    });
    assert.match(report.report.title, /품질 리포트/);
    assert.ok(report.report.analysis.executiveSummary.length > 20);
    assert.ok(report.report.analysis.keyFindings.length >= 3);
    assert.ok(report.report.analysis.anomalySignals.length >= 1);
    assert.ok(report.report.analysis.recommendedActionItems.length >= 1);
    assert.ok(report.report.summary.includes("검사"));

    const deleteResponse = await fetch(`${baseUrl}/api/reports/${report.report.id}`, {
      method: "DELETE"
    });
    assert.equal(deleteResponse.status, 204);

    const reports = await jsonFetch(`${baseUrl}/api/reports`);
    assert.equal(reports.items.some((item) => item.id === report.report.id), false);
  });

  it("uploads manuals, chunks them, and answers with RAG sources", async () => {
    const form = new FormData();
    form.append("title", "스크래치 재발 방지 작업표준");
    form.append("defectType", "scratch");
    form.append("checklist", "- 지그 접촉면 마모 확인\n- 이송 레일 청소\n- 동일 LOT 재검사");
    form.append(
      "file",
      new Blob([
        "스크래치 불량은 지그 접촉면 마모와 이송 레일 오염을 우선 확인한다.\n\n동일 LOT는 조치 이후 재검사를 수행하고 작업자 피드백에 기록한다."
      ], { type: "text/plain" }),
      "scratch-standard.txt"
    );

    const uploaded = await jsonFetch(`${baseUrl}/api/manuals`, {
      method: "POST",
      body: form
    });
    assert.equal(uploaded.manual.title, "스크래치 재발 방지 작업표준");
    assert.ok(uploaded.chunks.length >= 1);

    const duplicateForm = new FormData();
    duplicateForm.append("title", "스크래치 재발 방지 작업표준");
    duplicateForm.append("defectType", "scratch");
    duplicateForm.append("checklist", "- 지그 접촉면 재점검\n- 동일 LOT 재검사");
    duplicateForm.append(
      "file",
      new Blob([
        "스크래치 재발 시 지그 접촉면 재점검과 동일 LOT 재검사를 우선 수행한다.\n\n조치 이후 결과를 검사 피드백에 기록한다."
      ], { type: "text/plain" }),
      "scratch-standard-v2.txt"
    );

    const updated = await jsonFetch(`${baseUrl}/api/manuals`, {
      method: "POST",
      body: duplicateForm
    });
    assert.equal(updated.manual.id, uploaded.manual.id);

    const manuals = await jsonFetch(`${baseUrl}/api/manuals`);
    const matchingManuals = manuals.items.filter((manual) => manual.title === "스크래치 재발 방지 작업표준");
    assert.equal(matchingManuals.length, 1);

    const answer = await jsonFetch(`${baseUrl}/api/agent/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "스크래치가 계속 나면 어디를 봐야 해?", defectType: "scratch" })
    });

    assert.equal(answer.fallback, false);
    assert.equal(answer.sources[0].title, "스크래치 재발 방지 작업표준");
    assert.ok(answer.sources[0].score > 0);
    assert.ok(answer.checklist.every((item) => !item.label.startsWith("#")));
    const sourceTitles = answer.sources.map((source) => source.title);
    assert.equal(new Set(sourceTitles).size, sourceTitles.length);

    const deleteResponse = await fetch(`${baseUrl}/api/manuals/${uploaded.manual.id}`, {
      method: "DELETE"
    });
    assert.equal(deleteResponse.status, 204);

    const remainingManuals = await jsonFetch(`${baseUrl}/api/manuals`);
    assert.equal(remainingManuals.items.some((manual) => manual.id === uploaded.manual.id), false);
  });
});

describe("supabase repository fallback behavior", () => {
  it("does not break agent answers when manual chunk search fails", async () => {
    const repository = new SupabaseRepository({
      url: "https://example.supabase.co",
      serviceRoleKey: "test-key"
    });
    repository.request = async () => {
      throw new Error("simulated Supabase failure");
    };

    const chunks = await repository.searchManualChunks({
      embedding: [],
      defectType: "scratch",
      limit: 3
    });

    assert.deepEqual(chunks, []);
  });

  it("computes real scores when pgvector RPC fallback uses manual chunk embeddings", async () => {
    const repository = new SupabaseRepository({
      url: "https://example.supabase.co",
      serviceRoleKey: "test-key"
    });
    const scratchEmbedding = embedText("scratch 지그 접촉면 마모 이송 레일 청소");
    const crackEmbedding = embedText("crack 냉각 시간 가압 조건 균열");
    repository.request = async (path) => {
      if (path.includes("/rpc/match_manual_chunks")) {
        throw new Error("simulated RPC failure");
      }
      if (path.includes("metadata->>defectType=eq.scratch")) {
        return [{
          id: "00000000-0000-0000-0000-000000000001",
          manual_id: "manual-scratch",
          chunk_index: 0,
          content: "스크래치 불량은 지그 접촉면 마모와 이송 레일 오염을 우선 확인한다.",
          metadata: { title: "스크래치 기준서", defectType: "scratch" },
          embedding: `[${scratchEmbedding.join(",")}]`
        }, {
          id: "00000000-0000-0000-0000-000000000002",
          manual_id: "manual-crack",
          chunk_index: 0,
          content: "균열은 냉각 시간과 가압 조건을 확인한다.",
          metadata: { title: "균열 기준서", defectType: "crack" },
          embedding: `[${crackEmbedding.join(",")}]`
        }];
      }
      return [];
    };

    const chunks = await repository.searchManualChunks({
      embedding: scratchEmbedding,
      defectType: "scratch",
      limit: 2
    });

    assert.equal(chunks[0].manualId, "manual-scratch");
    assert.notEqual(chunks[0].score, 0.5);
    assert.equal(chunks.some((chunk) => chunk.manualId === "manual-crack"), false);
  });
});

describe("manual ingestion resilience", () => {
  it("stores RAG manual data even when original file storage rejects the MIME type", async () => {
    let savedManual;
    let savedChunks;
    let storedContentType;
    const store = {
      listManuals: async () => [],
      saveManualFile: async ({ contentType }) => {
        storedContentType = contentType;
        throw new Error("simulated storage rejection");
      },
      upsertManualWithChunks: async (manual, chunks) => {
        savedManual = manual;
        savedChunks = chunks;
        return manual;
      }
    };

    const result = await ingestManual({
      fields: {
        title: "MIME 정규화 기준서",
        defectType: "scratch",
        checklist: "- 지그 마모 확인"
      },
      file: {
        filename: "manual.md",
        contentType: "application/octet-stream",
        buffer: Buffer.from("# 기준서\n\n- 지그 마모 확인", "utf8")
      },
      store
    });

    assert.equal(storedContentType, "text/markdown");
    assert.equal(savedManual.title, "MIME 정규화 기준서");
    assert.equal(savedManual.filePath, undefined);
    assert.equal(savedChunks.length, 1);
    assert.equal(result.manual.id, savedManual.id);
  });
});

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  assert.ok(response.ok, JSON.stringify(payload));
  return payload;
}
