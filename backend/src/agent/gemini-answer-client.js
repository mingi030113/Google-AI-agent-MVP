const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiAgentAnswerClient {
  constructor({ apiKey, model = "gemini-3-flash-preview", endpoint = GEMINI_ENDPOINT } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint.replace(/\/$/, "");
    this.modelName = `gemini:${model}`;
  }

  async generate({ question, intent, context, sources, similarCases = [], checklist, fallbackAnswer }) {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is required for Gemini Agent answers.");
    }

    const response = await fetch(
      `${this.endpoint}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildRequest({ question, intent, context, sources, similarCases, checklist, fallbackAnswer }))
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini agent answer request failed: ${response.status} ${await response.text()}`);
    }

    const payload = await response.json();
    const text = extractText(payload);
    const parsed = parseJsonObject(text);

    return {
      answer: normalizeAnswer(parsed.answer, fallbackAnswer),
      checklist: normalizeChecklist(parsed.checklist, checklist),
      raw: {
        driver: "gemini",
        model: this.model,
        text,
        usageMetadata: payload.usageMetadata
      }
    };
  }
}

function buildRequest({ question, intent, context, sources, similarCases, checklist, fallbackAnswer }) {
  return {
    generationConfig: {
      temperature: 0.35,
      responseMimeType: "application/json"
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "너는 제조 품질관리 RAG 조치 Agent다.",
              "반드시 제공된 검사 컨텍스트와 RAG 근거만 사용해 한국어로 답변한다.",
              "근거에 없는 수치, 정책, 원인 확정 표현은 만들지 않는다.",
              "사용자 질문 의도에 맞춰 답변 톤과 내용을 바꾼다.",
              "출력은 JSON 객체 하나만 반환한다.",
              "JSON shape:",
              "{\"answer\":\"string\",\"checklist\":[{\"label\":\"string\",\"priority\":\"high|medium|low\"}]}",
              "",
              `질문 의도: ${intent}`,
              `사용자 질문: ${question}`,
              "",
              "검사 컨텍스트:",
              JSON.stringify(context, null, 2),
              "",
              "RAG 참조 근거:",
              JSON.stringify(sources, null, 2),
              "",
              "과거 유사 검사/조치 이력:",
              JSON.stringify(similarCases, null, 2),
              "",
              "초안 체크리스트:",
              JSON.stringify(checklist, null, 2),
              "",
              "로컬 fallback 초안:",
              fallbackAnswer,
              "",
              "작성 규칙:",
              "- answer는 2~5문장으로 작성한다.",
              "- 조치 질문이면 실행 순서와 완료 조건을 포함한다.",
              "- 원인 질문이면 원인 후보와 확인 순서를 구분한다.",
              "- 재검사 질문이면 동일 LOT/동일 조건 재검사와 종료 조건을 포함한다.",
              "- 작업자 안내문 질문이면 현장 전달 문구처럼 바로 전달 가능한 문장으로 작성한다.",
              "- 리포트 질문이면 보고서에 붙일 수 있는 요약 문장으로 작성한다.",
              "- 유사 사례가 있으면 같은 설비/불량/조치 결과가 현재 판단에 어떤 의미인지 1문장으로 반영한다.",
              "- checklist는 3~5개, 각 label은 현장에서 수행 가능한 동작으로 쓴다."
            ].join("\n")
          }
        ]
      }
    ]
  };
}

function extractText(payload) {
  return payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim() ?? "";
}

function parseJsonObject(text) {
  if (!text) {
    throw new Error("Gemini response did not include text.");
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) {
    throw new Error("Gemini response did not include a JSON object.");
  }
  return JSON.parse(candidate.slice(first, last + 1));
}

function normalizeAnswer(answer, fallbackAnswer) {
  const value = String(answer ?? "").replace(/\s+/g, " ").trim();
  return value || fallbackAnswer;
}

function normalizeChecklist(checklist, fallbackChecklist) {
  if (!Array.isArray(checklist)) {
    return fallbackChecklist;
  }

  const normalized = checklist
    .map((item, index) => ({
      id: `gemini-${index + 1}`,
      label: String(item?.label ?? item ?? "").replace(/\s+/g, " ").trim(),
      priority: ["high", "medium", "low"].includes(item?.priority) ? item.priority : "medium"
    }))
    .filter((item) => item.label.length > 0)
    .slice(0, 5);

  return normalized.length > 0 ? normalized : fallbackChecklist;
}
