const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const ALLOWED_DEFECT_TYPES = new Set(["scratch", "contamination", "dent", "crack"]);

export class GeminiVisionModelClient {
  constructor({ apiKey, model = "gemini-3-flash-preview", endpoint = GEMINI_ENDPOINT } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.endpoint = endpoint.replace(/\/$/, "");
    this.modelName = `gemini:${model}`;
  }

  async analyze({ image, fields, process, selectedEquipment }) {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is required when VISION_DRIVER=gemini.");
    }

    const response = await fetch(
      `${this.endpoint}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildRequest({ image, fields, process, selectedEquipment }))
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini vision request failed: ${response.status} ${await response.text()}`);
    }

    const payload = await response.json();
    const text = extractText(payload);
    const parsed = parseJsonObject(text);
    return normalizeGeminiResult(parsed, { payload, text, modelName: this.modelName });
  }

  async labelDefectType({ image, fields, process, selectedEquipment, patchcore }) {
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is required for Gemini defect type labeling.");
    }

    const response = await fetch(
      `${this.endpoint}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildLabelRequest({ image, fields, process, selectedEquipment, patchcore }))
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini defect labeler request failed: ${response.status} ${await response.text()}`);
    }

    const payload = await response.json();
    const text = extractText(payload);
    const parsed = parseJsonObject(text);
    return normalizeGeminiLabel(parsed, { payload, text, modelName: this.modelName });
  }
}

function buildRequest({ image, fields, process, selectedEquipment }) {
  return {
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: supportedMimeType(image.contentType),
              data: image.buffer.toString("base64")
            }
          },
          {
            text: [
              "You are a manufacturing visual quality inspector.",
              "Classify the uploaded product image for visual defects.",
              "Return only valid JSON with this exact shape:",
              "{\"result\":\"normal|defective\",\"defectType\":\"scratch|contamination|dent|crack|null\",\"confidence\":0.0,\"defectScores\":{\"scratch\":0.0,\"contamination\":0.0,\"dent\":0.0,\"crack\":0.0},\"reason\":\"short reason\"}",
              "Use null defectType when result is normal.",
              "defectScores must estimate the relative likelihood for each allowed defect type from 0.0 to 1.0.",
              "If uncertain, choose the closest allowed defectType and lower confidence.",
              `Process: ${process.name}`,
              `Equipment: ${selectedEquipment.name}`,
              `LOT: ${fields.lotNo?.trim() ?? ""}`,
              `Operator memo: ${fields.memo?.trim() ?? ""}`
            ].join("\n")
          }
        ]
      }
    ]
  };
}

function buildLabelRequest({ image, fields, process, selectedEquipment, patchcore }) {
  return {
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: supportedMimeType(image.contentType),
              data: image.buffer.toString("base64")
            }
          },
          {
            text: [
              "You are a manufacturing visual defect labeler.",
              "PatchCore already made the final normal/suspicious/defective decision. Do not override it.",
              "Only suggest the closest defect type for operator triage.",
              "Return only valid JSON with this exact shape:",
              "{\"defectTypeCandidate\":\"scratch|contamination|dent|crack|null\",\"confidence\":0.0,\"defectScores\":{\"scratch\":0.0,\"contamination\":0.0,\"dent\":0.0,\"crack\":0.0},\"reason\":\"short reason\"}",
              "Use null only when no defect type can be inferred.",
              `PatchCore result: ${patchcore.result}`,
              `PatchCore anomalyScore: ${patchcore.anomalyScore}`,
              `PatchCore threshold.image: ${patchcore.threshold?.image}`,
              `PatchCore boxes: ${JSON.stringify(patchcore.localization?.boxes ?? [])}`,
              `Process: ${process.name}`,
              `Equipment: ${selectedEquipment.name}`,
              `LOT: ${fields.lotNo?.trim() ?? ""}`,
              `Operator memo: ${fields.memo?.trim() ?? ""}`
            ].join("\n")
          }
        ]
      }
    ]
  };
}

function supportedMimeType(mimeType) {
  return ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"].includes(mimeType)
    ? mimeType
    : "image/jpeg";
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

function normalizeGeminiResult(parsed, { payload, text, modelName }) {
  const result = parsed.result === "defective" ? "defective" : "normal";
  const defectType = result === "defective" && ALLOWED_DEFECT_TYPES.has(parsed.defectType)
    ? parsed.defectType
    : null;
  const confidence = clampConfidence(Number(parsed.confidence));
  const defectScores = normalizeDefectScores(parsed.defectScores, { defectType, confidence, result });

  return {
    result,
    defectType,
    confidence,
    modelName,
    raw: {
      driver: "gemini",
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
      defectScores,
      text,
      usageMetadata: payload.usageMetadata
    }
  };
}

function normalizeGeminiLabel(parsed, { payload, text, modelName }) {
  const candidate = ALLOWED_DEFECT_TYPES.has(parsed.defectTypeCandidate)
    ? parsed.defectTypeCandidate
    : null;
  const confidence = clampConfidence(Number(parsed.confidence));
  const defectScores = normalizeDefectScores(parsed.defectScores, {
    defectType: candidate,
    confidence,
    result: candidate ? "defective" : "normal"
  });

  return {
    defectTypeCandidate: candidate,
    confidence,
    modelName,
    reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    defectScores,
    raw: {
      driver: "gemini-labeler",
      text,
      usageMetadata: payload.usageMetadata
    }
  };
}

function clampConfidence(value) {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(Math.max(Math.round(value * 100) / 100, 0), 1);
}

function normalizeDefectScores(value, { defectType, confidence, result }) {
  const fallback = buildFallbackScores({ defectType, confidence, result });
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const scores = {};
  for (const type of ALLOWED_DEFECT_TYPES) {
    scores[type] = clampConfidence(Number(value[type] ?? fallback[type]));
  }

  if (defectType && scores[defectType] < confidence) {
    scores[defectType] = confidence;
  }

  return scores;
}

function buildFallbackScores({ defectType, confidence, result }) {
  const scores = {
    scratch: 0.08,
    contamination: 0.08,
    dent: 0.08,
    crack: 0.08
  };

  if (result === "defective" && defectType) {
    scores[defectType] = confidence;
    let offset = 0;
    for (const type of ALLOWED_DEFECT_TYPES) {
      if (type !== defectType) {
        scores[type] = clampConfidence(Math.max(0.05, confidence * [0.32, 0.22, 0.14][offset]));
        offset += 1;
      }
    }
  }

  return scores;
}
