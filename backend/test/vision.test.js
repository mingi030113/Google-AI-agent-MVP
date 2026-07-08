import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";
import { analyzeInspection } from "../src/inspection-service.js";
import { FallbackVisionModelClient } from "../src/vision/index.js";
import { LocalVisionModelClient } from "../src/vision/local-vision-client.js";
import { PatchCoreVisionModelClient } from "../src/vision/patchcore-vision-client.js";
import { GeminiVisionModelClient } from "../src/vision/gemini-vision-client.js";

describe("vision model clients", () => {
  it("keeps the local heuristic behavior for offline analysis", async () => {
    const client = new LocalVisionModelClient();
    const result = await client.analyze({
      fields: { lotNo: "LOT-TEST-scratch", memo: "스크래치 의심" },
      image: { filename: "scratch.jpg", contentType: "image/jpeg", buffer: Buffer.from("fake image bytes") }
    });

    assert.equal(result.result, "defective");
    assert.equal(result.defectType, "scratch");
    assert.equal(result.modelName, "local-vision-heuristic-v1");
    assert.equal(Number.isFinite(result.raw.defectScores.flip), true);
    assert.equal(Object.values(result.raw.defectScores).every(Number.isFinite), true);
  });

  it("falls back to local analysis when the primary vision model fails", async () => {
    const client = new FallbackVisionModelClient({
      primary: {
        modelName: "gemini:test",
        analyze: async () => {
          throw new Error("upstream unavailable");
        }
      },
      fallback: new LocalVisionModelClient()
    });

    const inspection = await analyzeInspection({
      fields: {
        processId: "process-a",
        equipmentId: "eq-a-1",
        lotNo: "LOT-TEST-scratch",
        memo: "스크래치 의심"
      },
      imageUrl: "/uploads/test.jpg",
      image: { filename: "scratch.jpg", contentType: "image/jpeg", buffer: Buffer.from("fake image bytes") },
      visionClient: client
    });

    assert.equal(inspection.result, "defective");
    assert.equal(inspection.defectType, "scratch");
    assert.equal(inspection.modelName, "gemini:test-fallback-local-vision-heuristic-v1");
    assert.equal(inspection.visionAnalysis.fallback, true);
  });

  it("keeps demo normal images normal even when the primary model is over-sensitive", async () => {
    const client = new FallbackVisionModelClient({
      primary: {
        modelName: "gemini:test",
        analyze: async () => ({
          result: "defective",
          defectType: "dent",
          confidence: 0.85,
          modelName: "gemini:test",
          raw: { defectScores: { dent: 0.9, scratch: 0.3, contamination: 0.1, crack: 0 } }
        })
      },
      fallback: new LocalVisionModelClient()
    });

    const inspection = await analyzeInspection({
      fields: {
        processId: "process-a",
        equipmentId: "eq-a-1",
        lotNo: "LOT-TEST-normal",
        memo: ""
      },
      imageUrl: "/uploads/normal-metal-nut-good.png",
      image: { filename: "normal-metal-nut-good.png", contentType: "image/png", buffer: Buffer.from("fake normal image bytes") },
      visionClient: client
    });

    assert.equal(inspection.result, "normal");
    assert.equal(inspection.defectType, null);
    assert.equal(inspection.status, "closed");
    assert.equal(inspection.visionAnalysis.normalHintOverride, true);
  });

  it("does not call Gemini labeler when PatchCore returns normal", async () => {
    const client = new PatchCoreVisionModelClient({
      fetchImpl: async () => jsonResponse(patchcorePayload({ result: "normal", anomalyScore: 0.2 })),
      labeler: {
        modelName: "gemini:test",
        labelDefectType: async () => {
          throw new Error("labeler should not be called");
        }
      }
    });

    const result = await client.analyze({
      fields: { lotNo: "LOT-NORMAL", memo: "" },
      process: { name: "A공정" },
      selectedEquipment: { name: "A공정 1호기" },
      image: { filename: "normal.png", contentType: "image/png", buffer: Buffer.from("image") }
    });

    assert.equal(result.result, "normal");
    assert.equal(result.defectType, null);
    assert.equal(result.raw.labelerModel, null);
    assert.equal(result.raw.anomalyScore, 0.2);
  });

  it("uses Gemini only as a defectTypeCandidate labeler for suspicious PatchCore results", async () => {
    let labelerCalled = false;
    const client = new PatchCoreVisionModelClient({
      fetchImpl: async () => jsonResponse(patchcorePayload({ result: "suspicious", anomalyScore: 0.59 })),
      labeler: {
        modelName: "gemini:test",
        labelDefectType: async () => {
          labelerCalled = true;
          return {
            modelName: "gemini:test",
            defectTypeCandidate: "scratch",
            confidence: 0.64,
            defectScores: { scratch: 0.64, contamination: 0.1, dent: 0.08, crack: 0.05, flip: 0.04 }
          };
        }
      }
    });

    const result = await client.analyze({
      fields: { lotNo: "LOT-SUS", memo: "" },
      process: { name: "A공정" },
      selectedEquipment: { name: "A공정 1호기" },
      image: { filename: "part.png", contentType: "image/png", buffer: Buffer.from("image") }
    });

    assert.equal(labelerCalled, true);
    assert.equal(result.result, "suspicious");
    assert.equal(result.defectType, "scratch");
    assert.equal(result.raw.defectTypeCandidate, "scratch");
    assert.equal(result.raw.patchcoreModel.version, "patchcore-bottle-v1");
  });

  it("accepts flip as a PatchCore defect type candidate", async () => {
    const client = new PatchCoreVisionModelClient({
      fetchImpl: async () => jsonResponse(patchcorePayload({ result: "defective", anomalyScore: 0.91, assetKey: "metal_nut" })),
      labeler: {
        modelName: "gemini:test",
        labelDefectType: async () => ({
          modelName: "gemini:test",
          defectTypeCandidate: "flip",
          confidence: 0.82,
          reason: "metal_nut 기준면이 정상 샘플과 반대로 보입니다.",
          defectScores: { flip: 0.82, dent: 0.22, scratch: 0.12, contamination: 0.08, crack: 0.04 }
        })
      }
    });

    const result = await client.analyze({
      fields: { assetKey: "metal_nut", lotNo: "LOT-FLIP", memo: "" },
      process: { name: "B공정" },
      selectedEquipment: { name: "B공정 1호기" },
      image: { filename: "metal-nut-flip.png", contentType: "image/png", buffer: Buffer.from("image") }
    });

    assert.equal(result.result, "defective");
    assert.equal(result.defectType, "flip");
    assert.equal(result.raw.defectTypeCandidate, "flip");
    assert.equal(result.raw.defectScores.flip, 0.82);
    assert.equal(result.raw.patchcoreModel.assetKey, "metal_nut");
  });

  it("sends the selected assetKey to the PatchCore model service", async () => {
    let selectedAssetKey = null;
    const client = new PatchCoreVisionModelClient({
      fetchImpl: async (_url, init) => {
        selectedAssetKey = init.body.get("assetKey");
        return jsonResponse(patchcorePayload({ result: "normal", anomalyScore: 0.2, assetKey: "metal_nut" }));
      }
    });

    const result = await client.analyze({
      fields: { assetKey: "metal-nut", lotNo: "LOT-METAL", memo: "" },
      process: { name: "A공정" },
      selectedEquipment: { name: "A공정 1호기" },
      image: { filename: "normal-metal-nut-good.png", contentType: "image/png", buffer: Buffer.from("image") }
    });

    assert.equal(selectedAssetKey, "metal_nut");
    assert.equal(result.raw.patchcoreModel.assetKey, "metal_nut");
    assert.equal(result.modelName, "patchcore:patchcore-metal_nut-v1");
  });

  it("keeps PatchCore decision when Gemini defect labeler fails", async () => {
    const client = new PatchCoreVisionModelClient({
      fetchImpl: async () => jsonResponse(patchcorePayload({ result: "defective", anomalyScore: 0.82 })),
      labeler: {
        modelName: "gemini:test",
        labelDefectType: async () => {
          throw new Error("gemini unavailable");
        }
      }
    });

    const result = await client.analyze({
      fields: { lotNo: "LOT-DEF", memo: "" },
      process: { name: "A공정" },
      selectedEquipment: { name: "A공정 1호기" },
      image: { filename: "part.png", contentType: "image/png", buffer: Buffer.from("image") }
    });

    assert.equal(result.result, "defective");
    assert.equal(result.defectType, null);
    assert.equal(result.raw.defectTypeCandidate, null);
    assert.match(result.raw.labelerModel.error, /gemini unavailable/);
  });

  it("does not fall back to local hash analysis when PatchCore is unavailable", async () => {
    const client = new PatchCoreVisionModelClient({
      fetchImpl: async () => {
        throw new Error("connection refused");
      }
    });

    await assert.rejects(
      () => client.analyze({
        fields: { lotNo: "LOT-TEST-scratch", memo: "스크래치 의심" },
        process: { name: "A공정" },
        selectedEquipment: { name: "A공정 1호기" },
        image: { filename: "scratch.jpg", contentType: "image/jpeg", buffer: Buffer.from("fake image bytes") }
      }),
      (error) => {
        assert.equal(error.statusCode, 503);
        assert.equal(error.code, "PATCHCORE_UNAVAILABLE");
        assert.equal(error.fallbackUsed, false);
        return true;
      }
    );
  });

  it("stores PatchCore localization and strips heatmap base64 from analyzed payload", async () => {
    const saved = [];
    const inspection = await analyzeInspection({
      fields: {
        assetKey: "bottle",
        processId: "process-a",
        equipmentId: "eq-a-1",
        lotNo: "LOT-TEST-patchcore",
        memo: ""
      },
      imageUrl: "/uploads/part.png",
      image: { filename: "part.png", contentType: "image/png", buffer: Buffer.from("image") },
      store: {
        saveUpload: async ({ fileName, buffer, contentType }) => {
          saved.push({ fileName, buffer, contentType });
          return `/uploads/${fileName}`;
        }
      },
      visionClient: {
        analyze: async () => ({
          result: "defective",
          defectType: "scratch",
          confidence: 0.78,
          modelName: "patchcore:patchcore-bottle-v1",
          raw: {
            driver: "patchcore",
            anomalyScore: 0.82,
            threshold: { image: 0.57, pixel: 0.61, method: "val_good_p99" },
            localization: {
              heatmapBase64: Buffer.from("png").toString("base64"),
              heatmapFullBase64: Buffer.from("full").toString("base64"),
              heatmapFocusBase64: Buffer.from("focus").toString("base64"),
              boxes: [{ x: 10, y: 12, width: 20, height: 30, score: 0.91, coordinateSpace: "original" }],
              imageSize: { width: 100, height: 80 },
              modelInputSize: { width: 224, height: 224 }
            }
          }
        })
      }
    });

    assert.equal(inspection.result, "defective");
    assert.equal(inspection.assetKey, "bottle");
    assert.equal(inspection.assetName, "Bottle");
    assert.equal(inspection.visionAnalysis.localization.heatmapBase64, undefined);
    assert.equal(inspection.visionAnalysis.localization.heatmapFullBase64, undefined);
    assert.equal(inspection.visionAnalysis.localization.heatmapFocusBase64, undefined);
    assert.match(inspection.visionAnalysis.localization.heatmapUrl, /^\/uploads\/insp-.+-patchcore-heatmap\.png$/);
    assert.match(inspection.visionAnalysis.localization.heatmapFullUrl, /^\/uploads\/insp-.+-patchcore-heatmap-full\.png$/);
    assert.match(inspection.visionAnalysis.localization.heatmapFocusUrl, /^\/uploads\/insp-.+-patchcore-heatmap-focus\.png$/);
    assert.deepEqual(inspection.visionAnalysis.localization.boxes, []);
    assert.equal(saved.length, 3);
    assert.ok(saved.every((item) => item.contentType === "image/png"));
  });

  it("injects labeled reference images into the Gemini labeler prompt for metal_nut", async () => {
    const { client, capturedBody, restore } = withStubbedGeminiLabeler({ defectTypeCandidate: "flip", confidence: 0.72 });
    try {
      const label = await client.labelDefectType({
        image: { buffer: Buffer.from("inspection"), contentType: "image/png", filename: "flip.png" },
        fields: { lotNo: "LOT-FLIP", memo: "" },
        process: { name: "B공정" },
        selectedEquipment: { name: "B공정 1호기" },
        patchcore: { result: "defective", anomalyScore: 0.9, threshold: { image: 0.5 }, localization: { boxes: [] } },
        assetKey: "metal_nut"
      });

      const parts = capturedBody().contents[0].parts;
      const imageParts = parts.filter((part) => part.inlineData);
      const promptText = parts.map((part) => part.text ?? "").join("\n");

      // 3 reference images (2 normal + 1 flip) plus the inspection image.
      assert.equal(imageParts.length, 4);
      assert.match(promptText, /FLIP DEFECT/);
      assert.match(promptText, /Product class: metal_nut/);
      assert.match(promptText, /In-plane rotation of the same face is NORMAL/);
      assert.match(promptText, /Metal_nut-specific labeling rules/);
      assert.match(promptText, /Do not choose contamination just because the flipped side has different brightness/);
      assert.match(promptText, /When contamination and flip both seem plausible, prefer flip/);
      assert.equal(label.defectTypeCandidate, "flip");
    } finally {
      restore();
    }
  });

  it("omits reference images for classes without a manifest", async () => {
    const { client, capturedBody, restore } = withStubbedGeminiLabeler({ defectTypeCandidate: "scratch", confidence: 0.6 });
    try {
      await client.labelDefectType({
        image: { buffer: Buffer.from("inspection"), contentType: "image/png", filename: "part.png" },
        fields: { lotNo: "LOT-BOTTLE", memo: "" },
        process: { name: "A공정" },
        selectedEquipment: { name: "A공정 1호기" },
        patchcore: { result: "defective", anomalyScore: 0.9, threshold: { image: 0.5 }, localization: { boxes: [] } },
        assetKey: "bottle"
      });

      const parts = capturedBody().contents[0].parts;
      const imageParts = parts.filter((part) => part.inlineData);
      const promptText = parts.map((part) => part.text ?? "").join("\n");

      // No references, so only the single inspection image is sent.
      assert.equal(imageParts.length, 1);
      assert.doesNotMatch(promptText, /FLIP DEFECT/);
      assert.doesNotMatch(promptText, /Metal_nut-specific labeling rules/);
    } finally {
      restore();
    }
  });
});

describe("patchcore backend API integration", () => {
  it("analyzes through a fake PatchCore server when VISION_DRIVER=patchcore", async () => {
    const modelServer = await startJsonServer(patchcorePayload({ result: "suspicious", anomalyScore: 0.58 }));
    const dataDir = await mkdtemp(join(tmpdir(), "quality-agent-patchcore-"));
    const app = await createApp({
      dataDir,
      env: {
        STORE_DRIVER: "json",
        VISION_DRIVER: "patchcore",
        PATCHCORE_MODEL_SERVICE_URL: modelServer.url,
        AGENT_ANSWER_DRIVER: "local"
      }
    });
    await listen(app);

    try {
      const response = await fetch(`${serverUrl(app)}/api/inspections/analyze`, {
        method: "POST",
        body: inspectionForm("part.png")
      });
      const payload = await response.json();

      assert.equal(response.status, 201);
      assert.equal(payload.inspection.result, "suspicious");
      assert.equal(payload.inspection.status, "pending");
      assert.equal(payload.inspection.visionAnalysis.anomalyScore, 0.58);
      assert.equal(payload.inspection.visionAnalysis.localization.heatmapBase64, undefined);
      assert.ok(payload.inspection.visionAnalysis.localization.heatmapUrl);
      assert.ok(payload.inspection.visionAnalysis.localization.heatmapFullUrl);
      assert.ok(payload.inspection.visionAnalysis.localization.heatmapFocusUrl);
      assert.deepEqual(payload.inspection.visionAnalysis.localization.boxes, []);
    } finally {
      await close(app);
      await modelServer.close();
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it("returns 503 instead of local fallback when PatchCore server is down", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "quality-agent-patchcore-down-"));
    const app = await createApp({
      dataDir,
      env: {
        STORE_DRIVER: "json",
        VISION_DRIVER: "patchcore",
        PATCHCORE_MODEL_SERVICE_URL: "http://127.0.0.1:9",
        AGENT_ANSWER_DRIVER: "local"
      }
    });
    await listen(app);

    try {
      const response = await fetch(`${serverUrl(app)}/api/inspections/analyze`, {
        method: "POST",
        body: inspectionForm("scratch.jpg")
      });
      const payload = await response.json();

      assert.equal(response.status, 503);
      assert.equal(payload.code, "PATCHCORE_UNAVAILABLE");
      assert.equal(payload.fallbackUsed, false);
    } finally {
      await close(app);
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});

function patchcorePayload({ result, anomalyScore, assetKey = "bottle" }) {
  const normalizedAssetKey = String(assetKey).replace("-", "_");
  return {
    result,
    anomalyScore,
    threshold: { image: 0.57, pixel: 0.61, method: "val_good_p99" },
    decisionMargin: Math.round((anomalyScore - 0.57) * 100) / 100,
    confidence: 0.78,
    model: {
      name: "patchcore",
      version: `patchcore-${normalizedAssetKey}-v1`,
      assetKey: normalizedAssetKey,
      backbone: "wide_resnet50_2",
      layers: ["layer2", "layer3"],
      coresetSamplingRatio: 0.1
    },
    localization: {
      heatmapBase64: Buffer.from("png").toString("base64"),
      heatmapFullBase64: Buffer.from("full").toString("base64"),
      heatmapFocusBase64: Buffer.from("focus").toString("base64"),
      heatmapUrl: null,
      heatmapFullUrl: null,
      heatmapFocusUrl: null,
      heatmapMode: "threshold",
      maskUrl: null,
      boxes: [{ x: 120, y: 88, width: 54, height: 31, score: 0.91, coordinateSpace: "original" }],
      imageSize: { width: 1024, height: 768 },
      modelInputSize: { width: 224, height: 224 }
    }
  };
}

function withStubbedGeminiLabeler(labelResult) {
  const originalFetch = global.fetch;
  let body = null;
  global.fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(labelResult) }] } }]
      })
    };
  };

  return {
    client: new GeminiVisionModelClient({ apiKey: "test-key" }),
    capturedBody: () => body,
    restore: () => {
      global.fetch = originalFetch;
    }
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function inspectionForm(filename) {
  const form = new FormData();
  form.append("processId", "process-a");
  form.append("equipmentId", "eq-a-1");
  form.append("lotNo", "LOT-TEST-patchcore");
  form.append("memo", "");
  form.append("image", new Blob(["fake image bytes"], { type: "image/png" }), filename);
  return form;
}

async function startJsonServer(payload) {
  const server = createServer((request, response) => {
    if (request.method === "POST" && request.url === "/predict") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });
  await listen(server);
  return {
    url: serverUrl(server),
    close: () => close(server)
  };
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function serverUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}
