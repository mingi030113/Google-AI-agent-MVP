from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Decision:
    result: str
    decision_margin: float
    confidence: float
    threshold_low: float
    threshold_high: float


def decide_result(anomaly_score: float, image_threshold: float, gray_zone_ratio: float = 0.08) -> Decision:
    if image_threshold <= 0:
        raise ValueError("image_threshold must be greater than 0.")

    ratio = min(max(float(gray_zone_ratio), 0.01), 0.25)
    threshold_low = image_threshold * (1 - ratio)
    threshold_high = image_threshold * (1 + ratio)
    margin = anomaly_score - image_threshold

    if anomaly_score < threshold_low:
        result = "normal"
    elif anomaly_score < threshold_high:
        result = "suspicious"
    else:
        result = "defective"

    return Decision(
        result=result,
        decision_margin=round(margin, 6),
        confidence=decision_confidence(anomaly_score, image_threshold, ratio),
        threshold_low=threshold_low,
        threshold_high=threshold_high,
    )


def decision_confidence(anomaly_score: float, image_threshold: float, gray_zone_ratio: float = 0.08) -> float:
    # This is not a softmax probability. It is a decision stability score:
    # distance from the image-level threshold normalized by the gray-zone width,
    # capped to [0, 1]. Scores near the threshold are intentionally low.
    gray_width = max(image_threshold * min(max(gray_zone_ratio, 0.01), 0.25), 1e-6)
    return round(min(abs(anomaly_score - image_threshold) / (gray_width * 3), 1.0), 4)
