from __future__ import annotations

import tempfile
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image

from .artifacts import PatchCoreArtifacts, load_artifacts
from .decision import decide_result
from .localization import build_localization, to_numpy


class MultiAssetPatchCorePredictor:
    def __init__(
        self,
        artifact_dirs: dict[str, str | Path],
        *,
        default_asset_key: str = "bottle",
        gray_zone_ratio: float = 0.08,
        device: str | None = None,
        preload_all: bool = False,
    ) -> None:
        self.artifact_dirs = {
            normalize_asset_key(asset_key): Path(artifact_dir)
            for asset_key, artifact_dir in artifact_dirs.items()
        }
        self.default_asset_key = normalize_asset_key(default_asset_key)
        if self.default_asset_key not in self.artifact_dirs and self.artifact_dirs:
            self.default_asset_key = next(iter(self.artifact_dirs))
        self.gray_zone_ratio = gray_zone_ratio
        self.device = device
        self.preload_all = preload_all
        self.predictors: dict[str, PatchCorePredictor] = {}
        self.load_error: str | None = None

    @classmethod
    def discover(
        cls,
        artifact_root: str | Path,
        *,
        default_asset_key: str = "bottle",
        gray_zone_ratio: float = 0.08,
        device: str | None = None,
        preload_all: bool = False,
    ) -> "MultiAssetPatchCorePredictor":
        root = Path(artifact_root)
        artifact_dirs = {
            item.name: item
            for item in sorted(root.iterdir(), key=lambda path: path.name) if is_artifact_dir(item)
        } if root.exists() else {}
        return cls(
            artifact_dirs,
            default_asset_key=default_asset_key,
            gray_zone_ratio=gray_zone_ratio,
            device=device,
            preload_all=preload_all,
        )

    @property
    def ready(self) -> bool:
        if not self.artifact_dirs:
            return False
        default = self.predictors.get(self.default_asset_key)
        return default.ready if default else True

    @property
    def ready_asset_keys(self) -> list[str]:
        return [asset_key for asset_key, predictor in self.predictors.items() if predictor.ready]

    def load(self) -> None:
        if not self.artifact_dirs:
            self.load_error = "No PatchCore artifact directories were found."
            return

        if self.preload_all:
            for asset_key in self.artifact_dirs:
                try:
                    self._load_predictor(asset_key)
                except Exception as error:  # pragma: no cover - depends on external artifact files.
                    self.load_error = str(error)
            return

        try:
            self._load_predictor(self.default_asset_key)
            self.load_error = None
        except Exception as error:  # pragma: no cover - depends on external artifact files.
            self.load_error = str(error)

    def ready_payload(self) -> dict[str, Any]:
        assets: dict[str, Any] = {}
        for asset_key, artifact_dir in self.artifact_dirs.items():
            predictor = self.predictors.get(asset_key)
            if predictor:
                assets[asset_key] = predictor.ready_payload()
            else:
                assets[asset_key] = {
                    "ok": True,
                    "modelLoaded": False,
                    "thresholdLoaded": is_artifact_dir(artifact_dir),
                    "metadataLoaded": is_artifact_dir(artifact_dir),
                    "artifactDir": str(artifact_dir),
                    "error": None,
                }

        default = self.predictors.get(self.default_asset_key)
        return {
            "ok": bool(self.artifact_dirs) and (default.ready if default else True),
            "modelLoaded": bool(default.ready) if default else False,
            "thresholdLoaded": bool(self.artifact_dirs),
            "metadataLoaded": bool(self.artifact_dirs),
            "defaultAssetKey": self.default_asset_key,
            "assetKeys": list(self.artifact_dirs.keys()),
            "readyAssetKeys": self.ready_asset_keys,
            "assets": assets,
            "error": self.load_error,
        }

    def predict_bytes(self, image_bytes: bytes, *, filename: str = "image.png", asset_key: str | None = None) -> dict[str, Any]:
        selected_asset_key = normalize_asset_key(asset_key or self.default_asset_key)
        predictor = self._load_predictor(selected_asset_key)
        return predictor.predict_bytes(image_bytes, filename=filename)

    def _load_predictor(self, asset_key: str) -> "PatchCorePredictor":
        if asset_key not in self.artifact_dirs:
            available = ", ".join(self.artifact_dirs.keys()) or "none"
            raise KeyError(f"Unknown PatchCore assetKey '{asset_key}'. Available assetKeys: {available}")

        predictor = self.predictors.get(asset_key)
        if predictor is None:
            predictor = PatchCorePredictor(
                self.artifact_dirs[asset_key],
                gray_zone_ratio=self.gray_zone_ratio,
                device=self.device,
            )
            self.predictors[asset_key] = predictor

        if not predictor.ready:
            predictor.load()
        if not predictor.ready:
            raise RuntimeError(predictor.load_error or f"PatchCore model '{asset_key}' is not ready.")
        return predictor


class PatchCorePredictor:
    def __init__(self, artifact_dir: str | Path, *, gray_zone_ratio: float = 0.08, device: str | None = None) -> None:
        self.artifact_dir = Path(artifact_dir)
        self.gray_zone_ratio = gray_zone_ratio
        self.device = device
        self.artifacts: PatchCoreArtifacts | None = None
        self.model: Any = None
        self.engine: Any = None
        self.loaded_from_checkpoint = False
        self.load_error: str | None = None

    @property
    def ready(self) -> bool:
        return self.artifacts is not None and self.model is not None and self.load_error is None

    def load(self) -> None:
        try:
            self.artifacts = load_artifacts(self.artifact_dir)
        except Exception as error:  # pragma: no cover - depends on external artifact files.
            self.load_error = str(error)
            self.artifacts = None
            self.model = None
            self.engine = None
            return

        try:
            self.engine, self.model, self.loaded_from_checkpoint = load_anomalib_model(self.artifacts, device=self.device)
            self.load_error = None
        except Exception as error:  # pragma: no cover - exercised through /ready contract tests with fake runner.
            self.load_error = str(error)
            self.model = None
            self.engine = None

    def ready_payload(self) -> dict[str, Any]:
        threshold_loaded = self.artifacts is not None
        metadata_loaded = self.artifacts is not None
        return {
            "ok": self.ready,
            "modelLoaded": self.model is not None,
            "thresholdLoaded": threshold_loaded,
            "metadataLoaded": metadata_loaded,
            "artifactDir": str(self.artifact_dir),
            "error": self.load_error,
        }

    def predict_bytes(self, image_bytes: bytes, *, filename: str = "image.png") -> dict[str, Any]:
        if not self.ready or self.artifacts is None:
            raise RuntimeError(self.load_error or "PatchCore model is not ready.")

        original = Image.open(BytesIO(image_bytes)).convert("RGB")
        suffix = Path(filename).suffix or ".png"
        with tempfile.TemporaryDirectory() as temp_dir:
            image_path = Path(temp_dir) / f"input{suffix}"
            image_path.write_bytes(image_bytes)
            raw_prediction = self._predict_path(image_path)

        anomaly_score = extract_scalar(raw_prediction, ["pred_score", "pred_scores", "anomaly_score", "image_score", "score"])
        anomaly_map = extract_value(raw_prediction, ["anomaly_map", "anomaly_maps", "pred_map", "heatmap"])
        if anomaly_map is None:
            raise RuntimeError("PatchCore prediction did not include an anomaly map.")

        threshold = self.artifacts.threshold
        metadata = self.artifacts.metadata
        decision = decide_result(anomaly_score, threshold.image_threshold, self.gray_zone_ratio)
        localization = build_localization(
            anomaly_map,
            original_image=original,
            pixel_threshold=threshold.pixel_threshold,
            image_size=metadata.image_size,
            center_crop=metadata.center_crop,
        )

        return {
            "result": decision.result,
            "anomalyScore": round(float(anomaly_score), 6),
            "threshold": threshold.to_response(),
            "decisionMargin": decision.decision_margin,
            "confidence": decision.confidence,
            "model": metadata.model_response(),
            "localization": localization,
        }

    def _predict_path(self, image_path: Path) -> Any:
        assert self.artifacts is not None
        if self.engine is None or self.model is None:
            raise RuntimeError("PatchCore model is not loaded.")

        kwargs: dict[str, Any] = {
            "model": self.model,
            "data_path": str(image_path),
            "return_predictions": True,
        }
        if not self.loaded_from_checkpoint:
            kwargs["ckpt_path"] = str(self.artifacts.checkpoint_path)
        try:
            predictions = self.engine.predict(**kwargs)
        except TypeError:
            kwargs.pop("return_predictions", None)
            predictions = self.engine.predict(**kwargs)
        return first_prediction(predictions)


def load_anomalib_model(artifacts: PatchCoreArtifacts, *, device: str | None = None) -> tuple[Any, Any, bool]:
    try:
        from anomalib.engine import Engine
        from anomalib.models import Patchcore
    except Exception as error:  # pragma: no cover - depends on optional runtime deps.
        raise RuntimeError(
            "anomalib is required for PatchCore inference. Install model_service/requirements.txt."
        ) from error

    metadata = artifacts.metadata
    pre_processor = Patchcore.configure_pre_processor(
        image_size=metadata.image_size,
        center_crop_size=metadata.center_crop,
    )
    try:
        model = Patchcore.load_from_checkpoint(str(artifacts.checkpoint_path), map_location=device or "cpu")
        loaded_from_checkpoint = True
    except Exception:
        model = Patchcore(
            backbone=metadata.backbone,
            layers=metadata.layers,
            coreset_sampling_ratio=metadata.coreset_sampling_ratio,
            num_neighbors=metadata.num_neighbors,
            pre_processor=pre_processor,
        )
        loaded_from_checkpoint = False

    engine = Engine(devices=1, accelerator="auto")
    return engine, model, loaded_from_checkpoint


def first_prediction(predictions: Any) -> Any:
    if isinstance(predictions, (list, tuple)):
        if not predictions:
            raise RuntimeError("PatchCore prediction returned no results.")
        return first_prediction(predictions[0])
    return predictions


def extract_scalar(prediction: Any, names: list[str]) -> float:
    value = extract_value(prediction, names)
    if value is None:
        raise RuntimeError(f"PatchCore prediction did not include any of: {', '.join(names)}")
    array = to_numpy(value).reshape(-1)
    if array.size == 0:
        raise RuntimeError("PatchCore prediction score is empty.")
    return float(array[0])


def extract_value(value: Any, names: list[str]) -> Any:
    if isinstance(value, dict):
        for name in names:
            if name in value:
                return value[name]
    for name in names:
        if hasattr(value, name):
            return getattr(value, name)
    if isinstance(value, (list, tuple)) and value:
        return extract_value(value[0], names)
    return None


def normalize_asset_key(value: str | None) -> str:
    text = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    return "".join(char for char in text if char.isalnum() or char == "_") or "bottle"


def is_artifact_dir(path: Path) -> bool:
    return (
        path.is_dir()
        and (path / "model.ckpt").exists()
        and (path / "threshold.json").exists()
        and (path / "metadata.json").exists()
    )
