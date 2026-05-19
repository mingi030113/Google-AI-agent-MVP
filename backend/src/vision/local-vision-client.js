import { createHash } from "node:crypto";
import { defectTypes } from "../domain.js";

export class LocalVisionModelClient {
  constructor() {
    this.modelName = "local-vision-heuristic-v1";
  }

  async analyze({ image, fields }) {
    const memo = fields.memo?.trim() || "";
    const lotNo = fields.lotNo?.trim() || "";
    const hash = createHash("sha256").update(image.buffer).digest("hex");
    const signal = `${image.filename} ${memo} ${lotNo}`.toLowerCase();

    return {
      ...classifyImage({ hash, signal }),
      modelName: this.modelName,
      raw: {
        driver: "local",
        signalMatched: signal
      }
    };
  }
}

function classifyImage({ hash, signal }) {
  if (containsAny(signal, ["normal", "ok", "good", "정상"])) {
    return { result: "normal", defectType: null, confidence: 0.94 };
  }

  for (const defectType of defectTypes) {
    if (signal.includes(defectType)) {
      return { result: "defective", defectType, confidence: 0.88 };
    }
  }

  if (signal.includes("스크래치")) {
    return { result: "defective", defectType: "scratch", confidence: 0.88 };
  }

  const score = Number.parseInt(hash.slice(0, 8), 16) / 0xffffffff;
  if (score > 0.68) {
    return { result: "normal", defectType: null, confidence: round2(0.82 + score * 0.12) };
  }

  const defectType = defectTypes[Number.parseInt(hash.slice(8, 10), 16) % defectTypes.length];
  return {
    result: "defective",
    defectType,
    confidence: round2(0.78 + (1 - score) * 0.16)
  };
}

function containsAny(value, words) {
  return words.some((word) => value.includes(word));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
