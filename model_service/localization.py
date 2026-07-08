from __future__ import annotations

import base64
from dataclasses import dataclass
from io import BytesIO
from typing import Any

import numpy as np
from PIL import Image


@dataclass(frozen=True)
class TransformSpec:
    original_size: tuple[int, int]
    image_size: tuple[int, int]
    center_crop: tuple[int, int]

    @property
    def crop_origin(self) -> tuple[float, float]:
        resized_w, resized_h = self.image_size
        crop_w, crop_h = self.center_crop
        return max((resized_w - crop_w) / 2, 0), max((resized_h - crop_h) / 2, 0)


def build_localization(
    anomaly_map: Any,
    *,
    original_image: Image.Image,
    pixel_threshold: float,
    image_size: tuple[int, int],
    center_crop: tuple[int, int],
) -> dict[str, Any]:
    original_rgb = original_image.convert("RGB")
    original_w, original_h = original_rgb.size
    spec = TransformSpec(
        original_size=(original_w, original_h),
        image_size=image_size,
        center_crop=center_crop,
    )
    map_2d = normalize_anomaly_map(anomaly_map, center_crop)
    heatmap_base64 = heatmap_png_base64(map_2d, spec, mode="threshold", pixel_threshold=pixel_threshold)
    heatmap_full_base64 = heatmap_png_base64(map_2d, spec, mode="full")
    heatmap_focus_base64 = heatmap_png_base64(map_2d, spec, mode="focus", pixel_threshold=pixel_threshold)

    return {
        "heatmapBase64": heatmap_base64,
        "heatmapFullBase64": heatmap_full_base64,
        "heatmapFocusBase64": heatmap_focus_base64,
        "heatmapUrl": None,
        "heatmapFullUrl": None,
        "heatmapFocusUrl": None,
        "heatmapMode": "threshold",
        "maskUrl": None,
        # Bounding boxes are intentionally withheld until pixel-threshold
        # calibration is validated against the heatmap coordinate space.
        "boxes": [],
        "imageSize": {"width": original_w, "height": original_h},
        "modelInputSize": {"width": center_crop[0], "height": center_crop[1]},
    }


def normalize_anomaly_map(anomaly_map: Any, target_size: tuple[int, int]) -> np.ndarray:
    array = to_numpy(anomaly_map).astype(np.float32)
    while array.ndim > 2:
        array = array[0]
    if array.ndim != 2:
        raise ValueError("anomaly_map must be convertible to a 2D array.")

    crop_w, crop_h = target_size
    if array.shape != (crop_h, crop_w):
        pil = Image.fromarray(array)
        pil = pil.resize((crop_w, crop_h), Image.Resampling.BILINEAR)
        array = np.asarray(pil, dtype=np.float32)
    return array


def boxes_from_mask(mask: np.ndarray, scores: np.ndarray, spec: TransformSpec, min_area_ratio: float = 0.0008) -> list[dict[str, Any]]:
    mask_uint8 = (mask.astype(np.uint8) * 255)
    min_area = max(mask.size * min_area_ratio, 4)

    try:
        import cv2  # type: ignore

        contours, _ = cv2.findContours(mask_uint8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        raw_boxes = [cv2.boundingRect(contour) for contour in contours if cv2.contourArea(contour) >= min_area]
    except Exception:
        raw_boxes = connected_component_boxes(mask_uint8 > 0, min_area)

    boxes = []
    for x, y, width, height in raw_boxes:
        if width <= 0 or height <= 0:
            continue
        score_slice = scores[y : y + height, x : x + width]
        score = float(np.max(score_slice)) if score_slice.size else 0.0
        boxes.append({**crop_box_to_original(x, y, width, height, spec), "score": round(score, 6), "coordinateSpace": "original"})

    boxes.sort(key=lambda item: item["score"], reverse=True)
    return boxes[:10]


def crop_box_to_original(x: int, y: int, width: int, height: int, spec: TransformSpec) -> dict[str, int]:
    original_w, original_h = spec.original_size
    resized_w, resized_h = spec.image_size
    crop_left, crop_top = spec.crop_origin

    x1 = (x + crop_left) * original_w / resized_w
    y1 = (y + crop_top) * original_h / resized_h
    x2 = (x + width + crop_left) * original_w / resized_w
    y2 = (y + height + crop_top) * original_h / resized_h

    left = clamp_int(round(x1), 0, original_w)
    top = clamp_int(round(y1), 0, original_h)
    right = clamp_int(round(x2), left, original_w)
    bottom = clamp_int(round(y2), top, original_h)
    return {"x": left, "y": top, "width": max(right - left, 0), "height": max(bottom - top, 0)}


def heatmap_png_base64(map_2d: np.ndarray, spec: TransformSpec, *, mode: str = "threshold", pixel_threshold: float | None = None) -> str:
    if mode == "full":
        colored = full_distribution_colormap(map_2d)
    elif mode == "focus":
        colored = threshold_colormap(map_2d, pixel_threshold, alpha=focus_alpha(map_2d, pixel_threshold))
    else:
        colored = threshold_colormap(map_2d, pixel_threshold)

    crop_w, crop_h = spec.center_crop
    resized_w, resized_h = spec.image_size
    crop_left, crop_top = (int(round(value)) for value in spec.crop_origin)
    canvas = Image.new("RGBA", (resized_w, resized_h), (0, 0, 0, 0))
    heatmap = Image.fromarray(colored, mode="RGBA").resize((crop_w, crop_h), Image.Resampling.BILINEAR)
    canvas.alpha_composite(heatmap, (crop_left, crop_top))
    canvas = canvas.resize(spec.original_size, Image.Resampling.BILINEAR)

    buffer = BytesIO()
    canvas.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def full_distribution_colormap(map_2d: np.ndarray) -> np.ndarray:
    normalized = normalize_to_uint8(map_2d)
    try:
        import cv2  # type: ignore

        colored = cv2.applyColorMap(normalized, cv2.COLORMAP_JET)
        return cv2.cvtColor(colored, cv2.COLOR_BGR2RGBA)
    except Exception:
        red = normalized
        alpha = np.full_like(normalized, 255, dtype=np.uint8)
        return np.stack([red, np.zeros_like(red), 255 - red, alpha], axis=-1)


def threshold_colormap(map_2d: np.ndarray, pixel_threshold: float | None, *, alpha: np.ndarray | None = None) -> np.ndarray:
    threshold = float(pixel_threshold) if pixel_threshold is not None and np.isfinite(pixel_threshold) and pixel_threshold > 0 else None
    if threshold is None:
        ratio = normalize_to_uint8(map_2d).astype(np.float32) / 255.0
    else:
        ratio = np.clip(map_2d.astype(np.float32) / threshold, 0, 1.6) / 1.6

    stops = [
        (0.00, np.array([37, 99, 235], dtype=np.float32)),
        (0.34, np.array([20, 184, 166], dtype=np.float32)),
        (0.62, np.array([250, 204, 21], dtype=np.float32)),
        (0.78, np.array([249, 115, 22], dtype=np.float32)),
        (1.00, np.array([220, 38, 38], dtype=np.float32)),
    ]
    rgb = interpolate_stops(ratio, stops)
    alpha_channel = alpha if alpha is not None else np.full(ratio.shape, 255, dtype=np.uint8)
    return np.dstack([rgb, alpha_channel]).astype(np.uint8)


def focus_alpha(map_2d: np.ndarray, pixel_threshold: float | None) -> np.ndarray:
    scores = map_2d.astype(np.float32)
    max_value = float(np.max(scores))
    threshold = float(pixel_threshold) if pixel_threshold is not None and np.isfinite(pixel_threshold) and pixel_threshold > 0 else np.nan
    if not np.isfinite(max_value) or not np.isfinite(threshold) or max_value <= threshold:
        return np.zeros(scores.shape, dtype=np.uint8)

    scaled = np.clip((scores - threshold) / (max_value - threshold), 0, 1)
    return (np.power(scaled, 0.75) * 230).astype(np.uint8)


def interpolate_stops(values: np.ndarray, stops: list[tuple[float, np.ndarray]]) -> np.ndarray:
    result = np.zeros((*values.shape, 3), dtype=np.float32)
    for index, (start_pos, start_color) in enumerate(stops[:-1]):
        end_pos, end_color = stops[index + 1]
        mask = (values >= start_pos) & (values <= end_pos)
        if not np.any(mask):
            continue
        local = ((values[mask] - start_pos) / (end_pos - start_pos)).reshape(-1, 1)
        result[mask] = start_color + (end_color - start_color) * local
    result[values < stops[0][0]] = stops[0][1]
    result[values > stops[-1][0]] = stops[-1][1]
    return np.clip(result, 0, 255).astype(np.uint8)


def connected_component_boxes(mask: np.ndarray, min_area: float) -> list[tuple[int, int, int, int]]:
    height, width = mask.shape
    visited = np.zeros(mask.shape, dtype=bool)
    boxes: list[tuple[int, int, int, int]] = []

    for y in range(height):
        for x in range(width):
            if not mask[y, x] or visited[y, x]:
                continue
            stack = [(x, y)]
            visited[y, x] = True
            xs: list[int] = []
            ys: list[int] = []
            while stack:
                current_x, current_y = stack.pop()
                xs.append(current_x)
                ys.append(current_y)
                for next_x, next_y in ((current_x + 1, current_y), (current_x - 1, current_y), (current_x, current_y + 1), (current_x, current_y - 1)):
                    if 0 <= next_x < width and 0 <= next_y < height and mask[next_y, next_x] and not visited[next_y, next_x]:
                        visited[next_y, next_x] = True
                        stack.append((next_x, next_y))
            if len(xs) >= min_area:
                min_x, max_x = min(xs), max(xs)
                min_y, max_y = min(ys), max(ys)
                boxes.append((min_x, min_y, max_x - min_x + 1, max_y - min_y + 1))
    return boxes


def normalize_to_uint8(array: np.ndarray) -> np.ndarray:
    arr = array.astype(np.float32)
    min_value = float(np.min(arr))
    max_value = float(np.max(arr))
    if max_value <= min_value:
        return np.zeros(arr.shape, dtype=np.uint8)
    return np.clip((arr - min_value) / (max_value - min_value) * 255, 0, 255).astype(np.uint8)


def to_numpy(value: Any) -> np.ndarray:
    if hasattr(value, "detach"):
        value = value.detach()
    if hasattr(value, "cpu"):
        value = value.cpu()
    if hasattr(value, "numpy"):
        return value.numpy()
    return np.asarray(value)


def clamp_int(value: int, minimum: int, maximum: int) -> int:
    return min(max(value, minimum), maximum)
