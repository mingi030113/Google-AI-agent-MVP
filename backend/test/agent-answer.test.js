import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GeminiAgentAnswerClient } from "../src/agent/gemini-answer-client.js";

describe("Gemini Agent answer client", () => {
  it("parses Gemini JSON answers into the Agent response shape", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              answer: "동일 LOT 재검사 후 정상 전환 여부를 확인하세요.",
              checklist: [
                { label: "동일 LOT 재검사 수행", priority: "high" },
                { label: "재검사 결과를 피드백에 기록", priority: "medium" }
              ]
            })
          }]
        }
      }],
      usageMetadata: { totalTokenCount: 42 }
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });

    try {
      const client = new GeminiAgentAnswerClient({ apiKey: "test-key", model: "gemini-3-flash-preview" });
      const result = await client.generate({
        question: "재검사 기준 알려줘",
        intent: "reinspection",
        context: { lotNo: "LOT-1", defectType: "scratch" },
        sources: [{ title: "스크래치 기준서", excerpt: "동일 LOT 재검사", score: 0.9 }],
        checklist: [{ id: "fallback-1", label: "fallback", priority: "medium" }],
        fallbackAnswer: "fallback answer"
      });

      assert.match(result.answer, /동일 LOT 재검사/);
      assert.equal(result.checklist[0].id, "gemini-1");
      assert.equal(result.checklist[0].priority, "high");
      assert.equal(result.raw.model, "gemini-3-flash-preview");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
