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
    const classification = classifyImage({ hash, signal });

    return {
      ...classification,
      modelName: this.modelName,
      raw: {
        driver: "local",
        reason: classification.reason,
        defectScores: buildDefectScores(classification),
        signalMatched: signal
      }
    };
  }
}

function classifyImage({ hash, signal }) {
  if (containsAny(signal, ["normal", "ok", "good", "정상"])) {
    return { result: "normal", defectType: null, confidence: 0.94, reason: "입력 신호에서 정상 제품 힌트를 감지했습니다." };
  }

  for (const defectType of defectTypes) {
    if (signal.includes(defectType)) {
      return { result: "defective", defectType, confidence: 0.88, reason: `${defectType} 불량 힌트를 기준으로 판정했습니다.` };
    }
  }

  if (signal.includes("스크래치")) {
    return { result: "defective", defectType: "scratch", confidence: 0.88, reason: "스크래치 불량 힌트를 기준으로 판정했습니다." };
  }

  const score = Number.parseInt(hash.slice(0, 8), 16) / 0xffffffff;
  if (score > 0.68) {
    return {
      result: "normal",
      defectType: null,
      confidence: round2(0.82 + score * 0.12),
      reason: "업로드 이미지 특징값이 정상 기준 범위에 가깝게 계산되었습니다."
    };
  }

  const defectType = defectTypes[Number.parseInt(hash.slice(8, 10), 16) % defectTypes.length];
  return {
    result: "defective",
    defectType,
    confidence: round2(0.78 + (1 - score) * 0.16),
    reason: "업로드 이미지 특징값이 불량 기준 범위에 가깝게 계산되었습니다."
  };
}

function containsAny(value, words) {
  return words.some((word) => value.includes(word));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function buildDefectScores({ result, defectType, confidence }) {
  const scores = Object.fromEntries(defectTypes.map((type) => [type, 0.08]));

  if (result === "normal" || !defectType) {
    return scores;
  }

  scores[defectType] = confidence;
  let offset = 0;
  for (const type of defectTypes) {
    if (type !== defectType) {
      scores[type] = round2(Math.max(0.05, confidence * [0.32, 0.22, 0.14][offset]));
      offset += 1;
    }
  }

  return scores;
}
