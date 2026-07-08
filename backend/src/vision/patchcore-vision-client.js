const DEFAULT_PATCHCORE_ENDPOINT = "http://127.0.0.1:8000";
const ALLOWED_RESULTS = new Set(["normal", "suspicious", "defective"]);
const ALLOWED_DEFECT_TYPES = new Set(["scratch", "contamination", "dent", "crack", "flip"]);

export class PatchCoreVisionModelClient {
  constructor({
    endpoint = DEFAULT_PATCHCORE_ENDPOINT,
    labeler = null,
    fetchImpl = fetch
  } = {}) {
    this.endpoint = endpoint.replace(/\/$/, "");
    this.labeler = labeler;
    this.fetch = fetchImpl;
    this.kind = "patchcore";
    this.modelName = "patchcore";
  }

  async analyze(input) {
    const assetKey = normalizeAssetKey(input.assetKey ?? input.fields?.assetKey ?? input.fields?.asset_key);
    const patchcore = await this.predict(input.image, { assetKey });
    let defectTypeCandidate = null;
    let labelerModel = null;

    if (patchcore.result !== "normal" && this.labeler) {
      try {
        const label = await this.labeler.labelDefectType({ ...input, patchcore, assetKey });
        defectTypeCandidate = ALLOWED_DEFECT_TYPES.has(label.defectTypeCandidate)
          ? label.defectTypeCandidate
          : null;
        labelerModel = {
          name: label.modelName,
          defectTypeCandidate,
          confidence: label.confidence,
          reason: label.reason,
          defectScores: label.defectScores
        };
      } catch (error) {
        labelerModel = {
          name: this.labeler.modelName,
          defectTypeCandidate: null,
          confidence: 0,
          error: error instanceof Error ? error.message : "Gemini labeler failed."
        };
      }
    }

    const patchcoreModel = patchcore.model;
    const defectType = patchcore.result === "normal" ? null : defectTypeCandidate;
    const modelVersion = patchcoreModel?.version ?? patchcoreModel?.name ?? "patchcore";
    this.modelName = `patchcore:${modelVersion}`;

    return {
      result: patchcore.result,
      defectType,
      confidence: patchcore.confidence,
      modelName: this.modelName,
      raw: {
        driver: "patchcore",
        result: patchcore.result,
        confidence: patchcore.confidence,
        anomalyScore: patchcore.anomalyScore,
        threshold: patchcore.threshold,
        decisionMargin: patchcore.decisionMargin,
        localization: patchcore.localization,
        patchcoreModel,
        assetKey,
        labelerModel,
        defectTypeCandidate,
        defectScores: labelerModel?.defectScores,
        fallbackUsed: false
      }
    };
  }

  async predict(image, { assetKey = "bottle" } = {}) {
    const form = new FormData();
    form.append("assetKey", normalizeAssetKey(assetKey));
    form.append(
      "image",
      new Blob([image.buffer], { type: image.contentType || "application/octet-stream" }),
      image.filename || "image.png"
    );

    let response;
    try {
      response = await this.fetch(`${this.endpoint}/predict`, {
        method: "POST",
        body: form
      });
    } catch (error) {
      throw patchcoreUnavailable(error);
    }

    if (!response.ok) {
      throw patchcoreUnavailable(await response.text().catch(() => ""));
    }

    return normalizePatchCoreResponse(await response.json());
  }
}

function normalizePatchCoreResponse(payload) {
  const result = ALLOWED_RESULTS.has(payload?.result) ? payload.result : "normal";
  const model = normalizeModel(payload?.model);
  const threshold = {
    image: numberOr(payload?.threshold?.image, 0),
    pixel: numberOr(payload?.threshold?.pixel, 0),
    method: String(payload?.threshold?.method ?? "unknown")
  };

  return {
    result,
    anomalyScore: numberOr(payload?.anomalyScore, 0),
    threshold,
    decisionMargin: numberOr(payload?.decisionMargin, numberOr(payload?.anomalyScore, 0) - threshold.image),
    confidence: clamp01(payload?.confidence),
    model,
    localization: normalizeLocalization(payload?.localization)
  };
}

function normalizeModel(model) {
  return {
    name: String(model?.name ?? "patchcore"),
    version: String(model?.version ?? "patchcore-v1"),
    assetKey: String(model?.assetKey ?? "default"),
    backbone: String(model?.backbone ?? "wide_resnet50_2"),
    layers: Array.isArray(model?.layers) ? model.layers.map(String) : ["layer2", "layer3"],
    coresetSamplingRatio: numberOr(model?.coresetSamplingRatio, 0.1)
  };
}

function normalizeAssetKey(value) {
  return String(value ?? "bottle")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_")
    .replace(/[^a-z0-9_]/g, "") || "bottle";
}

function normalizeLocalization(localization) {
  if (!localization || typeof localization !== "object") {
    return null;
  }

  return {
    heatmapBase64: typeof localization.heatmapBase64 === "string" ? localization.heatmapBase64 : null,
    heatmapFullBase64: typeof localization.heatmapFullBase64 === "string" ? localization.heatmapFullBase64 : null,
    heatmapFocusBase64: typeof localization.heatmapFocusBase64 === "string" ? localization.heatmapFocusBase64 : null,
    heatmapUrl: typeof localization.heatmapUrl === "string" ? localization.heatmapUrl : null,
    heatmapFullUrl: typeof localization.heatmapFullUrl === "string" ? localization.heatmapFullUrl : null,
    heatmapFocusUrl: typeof localization.heatmapFocusUrl === "string" ? localization.heatmapFocusUrl : null,
    heatmapMode: ["threshold", "full", "focus"].includes(localization.heatmapMode) ? localization.heatmapMode : "threshold",
    maskUrl: typeof localization.maskUrl === "string" ? localization.maskUrl : null,
    boxes: [],
    imageSize: normalizeSize(localization.imageSize),
    modelInputSize: normalizeSize(localization.modelInputSize)
  };
}

function normalizeSize(size) {
  if (!size || typeof size !== "object") {
    return null;
  }
  return {
    width: Math.max(0, Math.round(numberOr(size.width, 0))),
    height: Math.max(0, Math.round(numberOr(size.height, 0)))
  };
}

function patchcoreUnavailable(reason) {
  const error = new Error("PatchCore model service is unavailable.");
  error.statusCode = 503;
  error.code = "PATCHCORE_UNAVAILABLE";
  error.fallbackUsed = false;
  error.reason = reason instanceof Error ? reason.message : String(reason ?? "");
  return error;
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.min(Math.max(Math.round(number * 10000) / 10000, 0), 1);
}
