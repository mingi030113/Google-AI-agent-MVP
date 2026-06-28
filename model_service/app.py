from __future__ import annotations

import os
from typing import Any

try:
    from fastapi import FastAPI, File, HTTPException, UploadFile
except Exception as import_error:  # pragma: no cover
    raise RuntimeError("fastapi is required to run the PatchCore model service.") from import_error

from .inference import PatchCorePredictor


def create_app(runner: Any | None = None) -> FastAPI:
    artifact_dir = os.getenv("PATCHCORE_ARTIFACT_DIR", "./artifacts/patchcore/bottle")
    gray_zone_ratio = float(os.getenv("PATCHCORE_GRAY_ZONE_RATIO", "0.08"))
    predictor = runner or PatchCorePredictor(artifact_dir, gray_zone_ratio=gray_zone_ratio)

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
    async def predict(image: UploadFile = File(...)) -> dict[str, Any]:
        if not bool(getattr(app.state.predictor, "ready", False)):
            detail = "PatchCore model and threshold artifacts are not loaded."
            if hasattr(app.state.predictor, "load_error") and app.state.predictor.load_error:
                detail = app.state.predictor.load_error
            raise HTTPException(status_code=503, detail=detail)
        image_bytes = await image.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="image file is empty.")
        try:
            return app.state.predictor.predict_bytes(image_bytes, filename=image.filename or "image.png")
        except Exception as error:
            raise HTTPException(status_code=500, detail=str(error)) from error

    return app


app = create_app()
