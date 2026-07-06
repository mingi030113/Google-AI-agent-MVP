import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GeminiAgentAnswerClient } from "../src/agent/gemini-answer-client.js";
import { answerAgentQuestion } from "../src/agent-service.js";

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

describe("Agent answer driver selection", () => {
  it("uses Gemini first when an API key is configured", async () => {
    const originalFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response(JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                answer: "Gemini 기반 조치 답변입니다.",
                checklist: [{ label: "Gemini 조치 항목 확인", priority: "high" }]
              })
            }]
          }
        }]
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };

    try {
      const result = await answerAgentQuestion(
        { question: "scratch 조치 순서 알려줘", defectType: "scratch" },
        fakeRagStore(),
        {
          env: {
            GEMINI_API_KEY: "test-key",
            GEMINI_AGENT_MODEL: "gemini-3-flash-preview",
            AGENT_ANSWER_DRIVER: "local"
          }
        }
      );

      assert.equal(called, true);
      assert.equal(result.answerDriver, "gemini");
      assert.equal(result.answerModel, "gemini-3-flash-preview");
      assert.equal(result.checklist[0].id, "gemini-1");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps local RAG when Agent local mode is explicitly forced", async () => {
    const originalFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return new Response("{}", { status: 200 });
    };

    try {
      const result = await answerAgentQuestion(
        { question: "scratch 조치 순서 알려줘", defectType: "scratch" },
        fakeRagStore(),
        {
          env: {
            GEMINI_API_KEY: "test-key",
            AGENT_ANSWER_FORCE_LOCAL: "true",
            AGENT_ANSWER_DRIVER: "gemini"
          }
        }
      );

      assert.equal(called, false);
      assert.equal(result.answerDriver, "local");
      assert.match(result.answer, /스크래치/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

function fakeRagStore() {
  return {
    getInspection: async () => null,
    listInspections: async () => [],
    searchManualChunks: async () => [{
      manualId: "manual-scratch",
      chunkIndex: 0,
      content: "스크래치 불량은 설비 접촉면을 확인하고 동일 LOT 재검사를 수행한다.",
      score: 0.92,
      metadata: { title: "스크래치 불량 조치 기준서", defectType: "scratch" }
    }]
  };
}
