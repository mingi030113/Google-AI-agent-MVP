from __future__ import annotations

import os
from typing import Any

try:
    from fastapi import FastAPI, File, Form, HTTPException, UploadFile
except Exception as import_error:  # pragma: no cover
    raise RuntimeError("fastapi is required to run the PatchCore model service.") from import_error

from .inference import MultiAssetPatchCorePredictor, PatchCorePredictor, normalize_asset_key


def create_app(runner: Any | None = None) -> FastAPI:
    gray_zone_ratio = float(os.getenv("PATCHCORE_GRAY_ZONE_RATIO", "0.08"))
    predictor = runner or create_predictor_from_env(gray_zone_ratio=gray_zone_ratio)

    app = FastAPI(title="PatchCore Model Service", version="0.1.0")
    app.state.predictor = predictor

    @app.on_event("startup")
    async def startup() -> None:
        if hasattr(app.state.predictor, "load"):
            app.state.predictor.load()

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {"ok": True}

    @app.get("/ready")
    async def ready() -> dict[str, Any]:
        if hasattr(app.state.predictor, "ready_payload"):
            return app.state.predictor.ready_payload()
        return {
            "ok": bool(getattr(app.state.predictor, "ready", False)),
            "modelLoaded": bool(getattr(app.state.predictor, "ready", False)),
            "thresholdLoaded": bool(getattr(app.state.predictor, "ready", False)),
        }

    @app.post("/predict")
    async def predict(
        image: UploadFile = File(...),
        assetKey: str | None = Form(None),
        asset_key: str | None = Form(None),
    ) -> dict[str, Any]:
        selected_asset_key = assetKey or asset_key
        if not bool(getattr(app.state.predictor, "ready", False)) and not hasattr(app.state.predictor, "artifact_dirs"):
            detail = "PatchCore model and threshold artifacts are not loaded."
            if hasattr(app.state.predictor, "load_error") and app.state.predictor.load_error:
                detail = app.state.predictor.load_error
            raise HTTPException(status_code=503, detail=detail)
        image_bytes = await image.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="image file is empty.")
        try:
            return predict_with_optional_asset_key(
                app.state.predictor,
                image_bytes,
                filename=image.filename or "image.png",
                asset_key=selected_asset_key,
            )
        except KeyError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error
        except Exception as error:
            raise HTTPException(status_code=500, detail=str(error)) from error

    return app


def create_predictor_from_env(*, gray_zone_ratio: float) -> Any:
    default_asset_key = normalize_asset_key(os.getenv("PATCHCORE_DEFAULT_ASSET_KEY") or os.getenv("PATCHCORE_ASSET_KEY"))
    preload_all = os.getenv("PATCHCORE_PRELOAD_ALL", "").strip().lower() == "true"
    artifact_dirs = parse_artifact_dirs(os.getenv("PATCHCORE_ARTIFACT_DIRS"))

    if artifact_dirs:
        return MultiAssetPatchCorePredictor(
            artifact_dirs,
            default_asset_key=default_asset_key,
            gray_zone_ratio=gray_zone_ratio,
            preload_all=preload_all,
        )

    artifact_root = os.getenv("PATCHCORE_ARTIFACT_ROOT")
    if artifact_root:
        return MultiAssetPatchCorePredictor.discover(
            artifact_root,
            default_asset_key=default_asset_key,
            gray_zone_ratio=gray_zone_ratio,
            preload_all=preload_all,
        )

    artifact_dir = os.getenv("PATCHCORE_ARTIFACT_DIR")
    if artifact_dir:
        return PatchCorePredictor(artifact_dir, gray_zone_ratio=gray_zone_ratio)

    default_root = os.getenv("PATCHCORE_DEFAULT_ARTIFACT_ROOT", "./artifacts")
    discovered = MultiAssetPatchCorePredictor.discover(
        default_root,
        default_asset_key=default_asset_key,
        gray_zone_ratio=gray_zone_ratio,
        preload_all=preload_all,
    )
    if discovered.artifact_dirs:
        return discovered
    return PatchCorePredictor("./artifacts/bottle", gray_zone_ratio=gray_zone_ratio)


def parse_artifact_dirs(value: str | None) -> dict[str, str]:
    if not value:
        return {}
    artifact_dirs: dict[str, str] = {}
    for entry in value.split(";"):
        if not entry.strip():
            continue
        if "=" not in entry:
            continue
        key, path = entry.split("=", 1)
        asset_key = normalize_asset_key(key)
        artifact_dirs[asset_key] = path.strip()
    return artifact_dirs


def predict_with_optional_asset_key(predictor: Any, image_bytes: bytes, *, filename: str, asset_key: str | None) -> dict[str, Any]:
    if hasattr(predictor, "artifact_dirs"):
        return predictor.predict_bytes(image_bytes, filename=filename, asset_key=asset_key)
    return predictor.predict_bytes(image_bytes, filename=filename)


app = create_app()
