from __future__ import annotations

import json
import base64
import tempfile
import unittest
from io import BytesIO
from pathlib import Path

from model_service.artifacts import load_metadata, load_threshold, validate_folder_dataset
from model_service.decision import decide_result

try:
    import numpy as np
    from PIL import Image
    from model_service.localization import TransformSpec, boxes_from_mask, crop_box_to_original, heatmap_png_base64
except ModuleNotFoundError:  # pragma: no cover - optional runtime deps.
    np = None
    Image = None
    TransformSpec = None
    boxes_from_mask = None
    crop_box_to_original = None
    heatmap_png_base64 = None

try:
    from fastapi.testclient import TestClient
    from model_service.app import create_app
except Exception:  # pragma: no cover - optional FastAPI dependency in local smoke runs.
    TestClient = None
    create_app = None


class ArtifactTests(unittest.TestCase):
    def test_loads_threshold_and_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "threshold.json").write_text(
                json.dumps({"imageThreshold": 0.57, "pixelThreshold": 0.61, "method": "val_good_p99", "normalValCount": 80}),
                encoding="utf-8",
            )
            (root / "metadata.json").write_text(
                json.dumps({
                    "modelName": "patchcore-bottle-v1",
                    "category": "bottle",
                    "backbone": "wide_resnet50_2",
                    "layers": ["layer2", "layer3"],
                    "imageSize": [256, 256],
                    "centerCrop": [224, 224],
                    "coresetSamplingRatio": 0.1,
                    "numNeighbors": 9,
                }),
                encoding="utf-8",
            )

            threshold = load_threshold(root / "threshold.json")
            metadata = load_metadata(root / "metadata.json")

            self.assertEqual(threshold.image_threshold, 0.57)
            self.assertEqual(threshold.normal_val_count, 80)
            self.assertEqual(metadata.model_name, "patchcore-bottle-v1")
            self.assertEqual(metadata.layers, ["layer2", "layer3"])

    def test_validates_folder_dataset_structure(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            for path in ["train/good", "val/good", "test/good", "test/anomaly/scratch"]:
                (root / path).mkdir(parents=True)
            (root / "train/good/a.png").write_bytes(b"png")

            result = validate_folder_dataset(root)

            self.assertEqual(result["counts"]["trainGood"], 1)
            self.assertEqual(result["defectTypes"], ["scratch"])


class DecisionTests(unittest.TestCase):
    def test_three_way_decision_uses_gray_zone(self) -> None:
        self.assertEqual(decide_result(0.40, 0.57).result, "normal")
        self.assertEqual(decide_result(0.57, 0.57).result, "suspicious")
        self.assertEqual(decide_result(0.70, 0.57).result, "defective")


@unittest.skipIf(np is None, "numpy/pillow localization dependencies are not installed")
class LocalizationTests(unittest.TestCase):
    def test_bbox_is_returned_in_original_coordinate_space(self) -> None:
        spec = TransformSpec(original_size=(1024, 768), image_size=(256, 256), center_crop=(224, 224))
        box = crop_box_to_original(104, 72, 16, 24, spec)

        self.assertEqual(box["x"], 480)
        self.assertEqual(box["y"], 264)
        self.assertEqual(box["width"], 64)
        self.assertEqual(box["height"], 72)

    def test_boxes_include_coordinate_space_original(self) -> None:
        mask = np.zeros((224, 224), dtype=bool)
        mask[20:40, 30:60] = True
        scores = np.zeros((224, 224), dtype=np.float32)
        scores[20:40, 30:60] = 0.91
        boxes = boxes_from_mask(mask, scores, TransformSpec((1024, 768), (256, 256), (224, 224)))

        self.assertGreaterEqual(len(boxes), 1)
        self.assertEqual(boxes[0]["coordinateSpace"], "original")

    def test_heatmap_png_supports_threshold_full_and_focus_modes(self) -> None:
        scores = np.array([[0.10, 0.20], [0.31, 0.90]], dtype=np.float32)
        spec = TransformSpec((2, 2), (2, 2), (2, 2))

        threshold_encoded = heatmap_png_base64(scores, spec, mode="threshold", pixel_threshold=0.30)
        threshold_image = Image.open(BytesIO(base64.b64decode(threshold_encoded))).convert("RGBA")
        low_pixel = threshold_image.getpixel((0, 0))
        high_pixel = threshold_image.getpixel((1, 1))
        self.assertEqual(low_pixel[3], 255)
        self.assertEqual(high_pixel[3], 255)
        self.assertLess(low_pixel[0], high_pixel[0])

        full_encoded = heatmap_png_base64(scores, spec, mode="full")
        full_image = Image.open(BytesIO(base64.b64decode(full_encoded))).convert("RGBA")
        self.assertEqual(full_image.getpixel((0, 0))[3], 255)
        self.assertEqual(full_image.getpixel((1, 1))[3], 255)
        self.assertNotEqual(full_image.getpixel((0, 0))[:3], full_image.getpixel((1, 1))[:3])

        focus_encoded = heatmap_png_base64(scores, spec, mode="focus", pixel_threshold=0.30)
        focus_image = Image.open(BytesIO(base64.b64decode(focus_encoded))).convert("RGBA")
        self.assertEqual(focus_image.getpixel((0, 0))[3], 0)
        self.assertGreater(focus_image.getpixel((1, 1))[3], 0)


@unittest.skipIf(TestClient is None or create_app is None, "fastapi test dependencies are not installed")
class FastApiContractTests(unittest.TestCase):
    def test_health_ready_and_predict_shape(self) -> None:
        class FakeRunner:
            ready = True

            def load(self) -> None:
                return None

            def ready_payload(self):
                return {"ok": True, "modelLoaded": True, "thresholdLoaded": True, "metadataLoaded": True}

            def predict_bytes(self, image_bytes: bytes, *, filename: str):
                return {
                    "result": "defective",
                    "anomalyScore": 0.82,
                    "threshold": {"image": 0.57, "pixel": 0.61, "method": "val_good_p99"},
                    "decisionMargin": 0.25,
                    "confidence": 0.78,
                    "model": {
                        "name": "patchcore",
                        "version": "patchcore-bottle-v1",
                        "assetKey": "bottle",
                        "backbone": "wide_resnet50_2",
                        "layers": ["layer2", "layer3"],
                        "coresetSamplingRatio": 0.1,
                    },
                    "localization": {
                        "heatmapBase64": None,
                        "heatmapUrl": None,
                        "maskUrl": None,
                        "boxes": [{"x": 1, "y": 2, "width": 3, "height": 4, "score": 0.91, "coordinateSpace": "original"}],
                        "imageSize": {"width": 10, "height": 8},
                        "modelInputSize": {"width": 224, "height": 224},
                    },
                }

        client = TestClient(create_app(FakeRunner()))
        self.assertEqual(client.get("/health").json(), {"ok": True})
        ready = client.get("/ready").json()
        self.assertEqual(ready["modelLoaded"], True)
        self.assertEqual(ready["thresholdLoaded"], True)

        response = client.post("/predict", files={"image": ("part.png", b"png", "image/png")})
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["threshold"]["image"], 0.57)
        self.assertEqual(payload["localization"]["boxes"][0]["coordinateSpace"], "original")

    def test_predict_passes_asset_key_to_multi_asset_runner(self) -> None:
        class FakeMultiRunner:
            ready = True
            artifact_dirs = {"bottle": "./artifacts/bottle", "metal_nut": "./artifacts/metal_nut"}

            def __init__(self) -> None:
                self.asset_key = None

            def load(self) -> None:
                return None

            def ready_payload(self):
                return {
                    "ok": True,
                    "modelLoaded": False,
                    "thresholdLoaded": True,
                    "metadataLoaded": True,
                    "assetKeys": ["bottle", "metal_nut"],
                }

            def predict_bytes(self, image_bytes: bytes, *, filename: str, asset_key: str | None = None):
                self.asset_key = asset_key
                return {
                    "result": "normal",
                    "anomalyScore": 0.2,
                    "threshold": {"image": 0.57, "pixel": 0.61, "method": "val_good_p99"},
                    "decisionMargin": -0.37,
                    "confidence": 0.91,
                    "model": {
                        "name": "patchcore",
                        "version": "patchcore-metal_nut-v1",
                        "assetKey": "metal_nut",
                        "backbone": "wide_resnet50_2",
                        "layers": ["layer2", "layer3"],
                        "coresetSamplingRatio": 0.1,
                    },
                    "localization": None,
                }

        runner = FakeMultiRunner()
        client = TestClient(create_app(runner))
        response = client.post(
            "/predict",
            data={"assetKey": "metal_nut"},
            files={"image": ("part.png", b"png", "image/png")},
        )
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(runner.asset_key, "metal_nut")
        self.assertEqual(payload["model"]["assetKey"], "metal_nut")


if __name__ == "__main__":
    unittest.main()
