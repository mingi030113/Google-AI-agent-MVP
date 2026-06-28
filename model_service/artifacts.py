from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ThresholdArtifact:
    image_threshold: float
    pixel_threshold: float
    method: str
    normal_val_count: int
    created_at: str

    def to_response(self) -> dict[str, Any]:
        return {
            "image": self.image_threshold,
            "pixel": self.pixel_threshold,
            "method": self.method,
        }


@dataclass(frozen=True)
class ModelMetadata:
    model_name: str
    category: str
    backbone: str
    layers: list[str]
    image_size: tuple[int, int]
    center_crop: tuple[int, int]
    coreset_sampling_ratio: float
    num_neighbors: int
    anomalib_version: str | None = None
    torch_version: str | None = None

    @property
    def asset_key(self) -> str:
        return self.category

    def model_response(self) -> dict[str, Any]:
        return {
            "name": "patchcore",
            "version": self.model_name,
            "assetKey": self.asset_key,
            "backbone": self.backbone,
            "layers": self.layers,
            "coresetSamplingRatio": self.coreset_sampling_ratio,
        }


@dataclass(frozen=True)
class PatchCoreArtifacts:
    artifact_dir: Path
    checkpoint_path: Path
    threshold: ThresholdArtifact
    metadata: ModelMetadata


def load_artifacts(artifact_dir: str | Path) -> PatchCoreArtifacts:
    root = Path(artifact_dir)
    checkpoint_path = root / "model.ckpt"
    threshold_path = root / "threshold.json"
    metadata_path = root / "metadata.json"

    missing = [str(path) for path in [checkpoint_path, threshold_path, metadata_path] if not path.exists()]
    if missing:
        raise FileNotFoundError(f"PatchCore artifact is missing: {', '.join(missing)}")

    threshold = load_threshold(threshold_path)
    metadata = load_metadata(metadata_path)
    return PatchCoreArtifacts(
        artifact_dir=root,
        checkpoint_path=checkpoint_path,
        threshold=threshold,
        metadata=metadata,
    )


def load_threshold(path: str | Path) -> ThresholdArtifact:
    payload = _read_json(path)
    return ThresholdArtifact(
        image_threshold=_positive_float(payload, "imageThreshold"),
        pixel_threshold=_positive_float(payload, "pixelThreshold"),
        method=str(payload.get("method") or "unknown"),
        normal_val_count=max(int(payload.get("normalValCount") or 0), 0),
        created_at=str(payload.get("createdAt") or now_iso()),
    )


def load_metadata(path: str | Path) -> ModelMetadata:
    payload = _read_json(path)
    return ModelMetadata(
        model_name=str(payload.get("modelName") or "patchcore-v1"),
        category=str(payload.get("category") or payload.get("assetKey") or "default"),
        backbone=str(payload.get("backbone") or "wide_resnet50_2"),
        layers=[str(item) for item in payload.get("layers", ["layer2", "layer3"])],
        image_size=_size_pair(payload.get("imageSize"), (256, 256)),
        center_crop=_size_pair(payload.get("centerCrop"), (224, 224)),
        coreset_sampling_ratio=float(payload.get("coresetSamplingRatio", 0.1)),
        num_neighbors=int(payload.get("numNeighbors", 9)),
        anomalib_version=_optional_str(payload.get("anomalibVersion")),
        torch_version=_optional_str(payload.get("torchVersion")),
    )


def write_threshold(
    out_dir: str | Path,
    *,
    image_threshold: float,
    pixel_threshold: float,
    method: str,
    normal_val_count: int,
) -> Path:
    path = Path(out_dir) / "threshold.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "imageThreshold": float(image_threshold),
                "pixelThreshold": float(pixel_threshold),
                "method": method,
                "normalValCount": int(normal_val_count),
                "createdAt": now_iso(),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return path


def write_metadata(
    out_dir: str | Path,
    *,
    model_name: str,
    category: str,
    backbone: str,
    layers: list[str],
    image_size: tuple[int, int],
    center_crop: tuple[int, int],
    coreset_sampling_ratio: float,
    num_neighbors: int,
    anomalib_version: str | None,
    torch_version: str | None,
) -> Path:
    path = Path(out_dir) / "metadata.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "modelName": model_name,
                "category": category,
                "backbone": backbone,
                "layers": layers,
                "imageSize": list(image_size),
                "centerCrop": list(center_crop),
                "coresetSamplingRatio": coreset_sampling_ratio,
                "numNeighbors": num_neighbors,
                "anomalibVersion": anomalib_version,
                "torchVersion": torch_version,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return path


def validate_folder_dataset(root: str | Path) -> dict[str, Any]:
    dataset_root = Path(root)
    required_dirs = [
        dataset_root / "train" / "good",
        dataset_root / "val" / "good",
        dataset_root / "test" / "good",
        dataset_root / "test" / "anomaly",
    ]
    missing = [str(path) for path in required_dirs if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Dataset directory is missing: {', '.join(missing)}")

    counts = {
        "trainGood": count_images(dataset_root / "train" / "good"),
        "valGood": count_images(dataset_root / "val" / "good"),
        "testGood": count_images(dataset_root / "test" / "good"),
        "testAnomaly": count_images(dataset_root / "test" / "anomaly"),
    }
    defect_types = sorted(
        path.name for path in (dataset_root / "test" / "anomaly").iterdir() if path.is_dir()
    )
    return {"root": str(dataset_root), "counts": counts, "defectTypes": defect_types}


def count_images(path: str | Path) -> int:
    root = Path(path)
    if not root.exists():
        return 0
    extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"}
    return sum(1 for item in root.rglob("*") if item.is_file() and item.suffix.lower() in extensions)


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _read_json(path: str | Path) -> dict[str, Any]:
    with Path(path).open("r", encoding="utf-8") as file:
        payload = json.load(file)
    if not isinstance(payload, dict):
        raise ValueError(f"JSON artifact must be an object: {path}")
    return payload


def _positive_float(payload: dict[str, Any], key: str) -> float:
    value = float(payload.get(key))
    if value <= 0:
        raise ValueError(f"{key} must be greater than 0.")
    return value


def _size_pair(value: Any, default: tuple[int, int]) -> tuple[int, int]:
    if isinstance(value, (list, tuple)) and len(value) == 2:
        width = int(value[0])
        height = int(value[1])
        if width > 0 and height > 0:
            return width, height
    return default


def _optional_str(value: Any) -> str | None:
    return str(value) if value is not None else None
