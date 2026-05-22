import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeInspection } from "../src/inspection-service.js";
import { FallbackVisionModelClient } from "../src/vision/index.js";
import { LocalVisionModelClient } from "../src/vision/local-vision-client.js";

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
});
