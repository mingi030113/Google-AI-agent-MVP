from __future__ import annotations

import tempfile
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image

from .artifacts import PatchCoreArtifacts, load_artifacts
from .decision import decide_result
from .localization import build_localization, to_numpy


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
