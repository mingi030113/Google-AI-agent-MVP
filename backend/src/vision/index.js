import { GeminiVisionModelClient } from "./gemini-vision-client.js";
import { LocalVisionModelClient } from "./local-vision-client.js";
import { PatchCoreVisionModelClient } from "./patchcore-vision-client.js";

export function createVisionModelClient({ env = process.env } = {}) {
  const driver = (env.VISION_DRIVER ?? "local").trim();
  const local = new LocalVisionModelClient();

  if (driver === "local") {
    local.kind = "local";
    return local;
  }

  if (driver === "gemini") {
    const gemini = new GeminiVisionModelClient({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_VISION_MODEL ?? "gemini-3-flash-preview"
    });
    return new FallbackVisionModelClient({ primary: gemini, fallback: local, kind: "gemini" });
  }

  if (driver === "patchcore") {
    const labeler = env.GEMINI_API_KEY
      ? new GeminiVisionModelClient({
          apiKey: env.GEMINI_API_KEY,
          model: env.GEMINI_VISION_MODEL ?? "gemini-3-flash-preview"
        })
      : null;
    return new PatchCoreVisionModelClient({
      endpoint: env.PATCHCORE_MODEL_SERVICE_URL ?? "http://127.0.0.1:8000",
      labeler
    });
  }

  throw new Error(`Unsupported VISION_DRIVER: ${driver}`);
}

export class FallbackVisionModelClient {
  constructor({ primary, fallback, kind = "fallback" }) {
    this.primary = primary;
    this.fallback = fallback;
    this.kind = kind;
  }

  async analyze(input) {
    try {
      const primaryResult = await this.primary.analyze(input);
      if (hasStrongNormalHint(input)) {
        const localResult = await this.fallback.analyze(input);
        if (localResult.result === "normal") {
          return {
            ...localResult,
            modelName: `${this.primary.modelName}-normal-hint-${localResult.modelName}`,
            raw: {
              ...localResult.raw,
              normalHintOverride: true,
              primaryModel: this.primary.modelName,
              primaryResult
            }
          };
        }
      }
      return primaryResult;
    } catch (error) {
      const fallbackResult = await this.fallback.analyze(input);
      return {
        ...fallbackResult,
        modelName: `${this.primary.modelName}-fallback-${fallbackResult.modelName}`,
        raw: {
          fallback: true,
          reason: error instanceof Error ? error.message : "Vision model request failed.",
          primaryModel: this.primary.modelName,
          fallbackModel: fallbackResult.modelName
        }
      };
    }
  }
}

function hasStrongNormalHint(input) {
  const filename = input?.image?.filename?.toLowerCase() ?? "";
  const memo = input?.fields?.memo?.toLowerCase() ?? "";
  const defectWords = ["scratch", "contamination", "dent", "crack", "스크래치", "오염", "찍힘", "크랙", "불량"];

  if (defectWords.some((word) => filename.includes(word))) {
    return false;
  }

  return ["normal", "good", "ok", "정상"].some((word) => filename.includes(word) || memo.includes(word));
}
