from __future__ import annotations

import shutil
from argparse import Namespace
from pathlib import Path
from typing import Any

import numpy as np

from .artifacts import write_metadata, write_threshold
from .inference import extract_value, first_prediction
from .localization import to_numpy


def build_patchcore(args: Namespace) -> Any:
    from anomalib.models import Patchcore

    pre_processor = Patchcore.configure_pre_processor(
        image_size=(args.image_size, args.image_size),
        center_crop_size=(args.center_crop, args.center_crop),
    )
    return Patchcore(
        backbone=args.backbone,
        layers=args.layers,
        coreset_sampling_ratio=args.coreset_sampling_ratio,
        num_neighbors=args.num_neighbors,
        pre_processor=pre_processor,
    )


def train_and_save(datamodule: Any, args: Namespace, *, category: str) -> None:
    from anomalib import __version__ as anomalib_version
    from anomalib.engine import Engine
    import torch

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    model = build_patchcore(args)
    engine = Engine(
        max_epochs=args.epoch,
        accelerator=args.accelerator,
        devices=args.devices,
        default_root_dir=str(out_dir / "trainer"),
    )
    engine.fit(model=model, datamodule=datamodule)

    checkpoint_path = out_dir / "model.ckpt"
    save_checkpoint(engine, checkpoint_path)

    predictions = engine.predict(model=model, datamodule=datamodule, ckpt_path=str(checkpoint_path))
    normal_scores = collect_scores(predictions, normal_only=True)
    maps = collect_maps(predictions, normal_only=True)
    if len(normal_scores) == 0:
        normal_scores = collect_scores(predictions, normal_only=False)
        maps = collect_maps(predictions, normal_only=False)
    normal_scores = normal_scores if len(normal_scores) else np.asarray([1.0], dtype=np.float32)
    image_threshold = percentile(normal_scores, args.threshold_percentile)
    pixel_threshold = percentile(maps.reshape(-1) if maps.size else normal_scores, args.pixel_threshold_percentile)

    write_threshold(
        out_dir,
        image_threshold=image_threshold,
        pixel_threshold=pixel_threshold,
        method=f"val_good_p{args.threshold_percentile:g}",
        normal_val_count=len(normal_scores),
    )
    write_metadata(
        out_dir,
        model_name=args.model_name or f"patchcore-{category}-v1",
        category=category,
        backbone=args.backbone,
        layers=args.layers,
        image_size=(args.image_size, args.image_size),
        center_crop=(args.center_crop, args.center_crop),
        coreset_sampling_ratio=args.coreset_sampling_ratio,
        num_neighbors=args.num_neighbors,
        anomalib_version=anomalib_version,
        torch_version=torch.__version__,
    )


def save_checkpoint(engine: Any, checkpoint_path: Path) -> None:
    best_path = getattr(engine, "best_model_path", None) or getattr(getattr(engine, "trainer", None), "checkpoint_callback", None)
    if best_path and not isinstance(best_path, (str, Path)):
        best_path = getattr(best_path, "best_model_path", None)
    if best_path and Path(best_path).exists():
        shutil.copy2(best_path, checkpoint_path)
        return
    trainer = getattr(engine, "trainer", None)
    if trainer and hasattr(trainer, "save_checkpoint"):
        trainer.save_checkpoint(str(checkpoint_path))
        return
    raise RuntimeError("Could not locate or save Anomalib checkpoint.")


def collect_scores(predictions: Any, *, normal_only: bool = False) -> np.ndarray:
    values: list[float] = []
    for prediction in flatten_predictions(predictions):
        value = extract_value(prediction, ["pred_score", "pred_scores", "anomaly_score", "image_score", "score"])
        if value is None:
            continue
        scores = to_numpy(value).reshape(-1)
        labels = prediction_labels(prediction)
        if normal_only and labels is not None and labels.size == scores.size:
            scores = scores[labels == 0]
        elif normal_only and labels is not None and labels.size != scores.size:
            continue
        values.extend(float(item) for item in scores)
    return np.asarray(values, dtype=np.float32)


def collect_maps(predictions: Any, *, normal_only: bool = False) -> np.ndarray:
    values: list[np.ndarray] = []
    for prediction in flatten_predictions(predictions):
        value = extract_value(prediction, ["anomaly_map", "anomaly_maps", "pred_map", "heatmap"])
        if value is not None:
            maps = to_numpy(value).astype(np.float32)
            labels = prediction_labels(prediction)
            if normal_only and labels is not None:
                if maps.ndim >= 3 and labels.size == maps.shape[0]:
                    maps = maps[labels == 0]
                elif labels.size == 1:
                    if labels[0] != 0:
                        continue
                else:
                    continue
            values.append(maps)
    if not values:
        return np.asarray([], dtype=np.float32)
    return np.concatenate([value.reshape(-1) for value in values])


def flatten_predictions(predictions: Any) -> list[Any]:
    if predictions is None:
        return []
    if isinstance(predictions, (list, tuple)):
        result: list[Any] = []
        for item in predictions:
            result.extend(flatten_predictions(item))
        return result
    return [first_prediction(predictions)]


def prediction_labels(prediction: Any) -> np.ndarray | None:
    value = extract_value(prediction, ["gt_label", "gt_labels", "label", "labels"])
    if value is None:
        return None
    return to_numpy(value).reshape(-1).astype(np.int64)


def percentile(values: np.ndarray, percent: float) -> float:
    if values.size == 0:
        return 1.0
    return float(np.percentile(values, percent))
