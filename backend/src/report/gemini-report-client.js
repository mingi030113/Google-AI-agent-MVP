const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiQualityReportClient {
  constructor({ apiKey, model = "gemini-2.5-flash", endpoint = GEMINI_ENDPOINT } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint.replace(/\/$/, "");
    this.modelName = `gemini:${model}`;
  }

  async generate({ reportType, startDate, endDate, metrics, scopedInspections, manuals, fallbackAnalysis }) {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is required for Gemini quality reports.");
    }

    const response = await fetch(
      `${this.endpoint}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildRequest({ reportType, startDate, endDate, metrics, scopedInspections, manuals, fallbackAnalysis }))
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini report request failed: ${response.status} ${await response.text()}`);
    }

    const payload = await response.json();
    const text = extractText(payload);
    const parsed = parseJsonObject(text);

    return {
      analysis: normalizeAnalysis(parsed, fallbackAnalysis),
      raw: {
        driver: "gemini",
        model: this.model,
        text,
        usageMetadata: payload.usageMetadata
      }
    };
  }
}

function buildRequest({ reportType, startDate, endDate, metrics, scopedInspections, manuals, fallbackAnalysis }) {
  return {
    generationConfig: {
      temperature: 0.25,
      responseMimeType: "application/json"
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "너는 제조 품질관리 리포트를 작성하는 AI 품질 분석가다.",
              "반드시 제공된 검사 데이터, 집계 지표, 기준서 요약만 사용해 한국어로 작성한다.",
              "근거 없는 수치, 원인 확정, 규정명, 외부 사실은 만들지 않는다.",
              "관리자가 회의/보고에 바로 사용할 수 있도록 간결하지만 구체적으로 작성한다.",
              "출력은 JSON 객체 하나만 반환한다.",
              "JSON shape:",
              JSON.stringify({
                executiveSummary: "string",
                keyFindings: ["string"],
                anomalySignals: [{ title: "string", severity: "high|medium|low", evidence: "string" }],
                defectAnalysis: [{ defectType: "string", count: 0, rate: 0, interpretation: "string" }],
                processAnalysis: [{ processName: "string", defectRate: 0, riskLevel: "high|medium|low", reason: "string" }],
                rootCauseHypotheses: ["string"],
                recommendedActionItems: [{ priority: "high|medium|low", action: "string", reason: "string" }],
                ragEvidence: [{ title: "string", excerpt: "string", score: 0 }],
                similarCases: [{ inspectionId: "string", outcome: "string", similarity: 0 }],
                managerCommentary: "string"
              }),
              "",
              `리포트 유형: ${reportType}`,
              `기간: ${startDate} ~ ${endDate}`,
              "",
              "집계 지표:",
              JSON.stringify(metrics, null, 2),
              "",
              "기간 내 주요 검사 이력:",
              JSON.stringify(scopedInspections, null, 2),
              "",
              "참조 가능한 기준서 요약:",
              JSON.stringify(manuals, null, 2),
              "",
              "로컬 fallback 초안:",
              JSON.stringify(fallbackAnalysis, null, 2),
              "",
              "작성 규칙:",
              "- executiveSummary는 3~5문장으로 쓴다.",
              "- keyFindings는 3~5개로 작성한다.",
              "- anomalySignals는 데이터상 의미 있는 이상 징후만 2~4개 작성한다.",
              "- defectAnalysis는 불량 유형별 수량과 비율을 유지하고 해석을 붙인다.",
              "- processAnalysis는 공정별 위험도와 이유를 쓴다.",
              "- rootCauseHypotheses는 확정 표현이 아니라 '가능성', '점검 필요' 표현을 사용한다.",
              "- recommendedActionItems는 실행 우선순위, 조치 내용, 근거를 포함한다.",
              "- ragEvidence는 제공된 기준서만 사용하고 score는 0~1 범위로 둔다.",
              "- similarCases는 제공된 검사 이력 중 조치/재검사 결과가 있는 항목만 사용한다."
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

function normalizeAnalysis(value, fallback) {
  const normalized = {
    executiveSummary: stringOr(value?.executiveSummary, fallback.executiveSummary),
    keyFindings: stringList(value?.keyFindings, fallback.keyFindings, 5),
    anomalySignals: normalizeAnomalySignals(value?.anomalySignals, fallback.anomalySignals),
    defectAnalysis: normalizeDefectAnalysis(value?.defectAnalysis, fallback.defectAnalysis),
    processAnalysis: normalizeProcessAnalysis(value?.processAnalysis, fallback.processAnalysis),
    rootCauseHypotheses: stringList(value?.rootCauseHypotheses, fallback.rootCauseHypotheses, 5),
    recommendedActionItems: normalizeActionItems(value?.recommendedActionItems, fallback.recommendedActionItems),
    ragEvidence: normalizeRagEvidence(value?.ragEvidence, fallback.ragEvidence),
    similarCases: normalizeSimilarCases(value?.similarCases, fallback.similarCases),
    managerCommentary: stringOr(value?.managerCommentary, fallback.managerCommentary)
  };

  return normalized.executiveSummary ? normalized : fallback;
}

function stringOr(value, fallback = "") {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function stringList(value, fallback, limit) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = value.map((item) => stringOr(item)).filter(Boolean).slice(0, limit);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeAnomalySignals(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = value.map((item) => ({
    title: stringOr(item?.title),
    severity: normalizeLevel(item?.severity),
    evidence: stringOr(item?.evidence)
  })).filter((item) => item.title && item.evidence).slice(0, 4);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeDefectAnalysis(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = value.map((item) => ({
    defectType: stringOr(item?.defectType),
    count: numberOr(item?.count, 0),
    rate: numberOr(item?.rate, 0),
    interpretation: stringOr(item?.interpretation)
  })).filter((item) => item.defectType && item.interpretation).slice(0, 6);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeProcessAnalysis(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = value.map((item) => ({
    processName: stringOr(item?.processName),
    defectRate: numberOr(item?.defectRate, 0),
    riskLevel: normalizeLevel(item?.riskLevel),
    reason: stringOr(item?.reason)
  })).filter((item) => item.processName && item.reason).slice(0, 6);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeActionItems(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = value.map((item) => ({
    priority: normalizeLevel(item?.priority),
    action: stringOr(item?.action),
    reason: stringOr(item?.reason)
  })).filter((item) => item.action && item.reason).slice(0, 6);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeRagEvidence(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = value.map((item) => ({
    title: stringOr(item?.title),
    excerpt: stringOr(item?.excerpt),
    score: Math.max(0, Math.min(numberOr(item?.score, 0), 1))
  })).filter((item) => item.title && item.excerpt).slice(0, 5);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeSimilarCases(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = value.map((item) => ({
    inspectionId: stringOr(item?.inspectionId),
    outcome: stringOr(item?.outcome),
    similarity: Math.max(0, Math.min(numberOr(item?.similarity, 0), 1))
  })).filter((item) => item.inspectionId && item.outcome).slice(0, 5);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeLevel(value) {
  return ["high", "medium", "low"].includes(value) ? value : "medium";
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
