import { GeminiVisionModelClient } from "./gemini-vision-client.js";
import { LocalVisionModelClient } from "./local-vision-client.js";

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
      model: env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash"
    });
    return new FallbackVisionModelClient({ primary: gemini, fallback: local, kind: "gemini" });
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
      return await this.primary.analyze(input);
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
