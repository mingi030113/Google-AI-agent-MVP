from __future__ import annotations

import argparse
import json
from pathlib import Path

from .inference import PatchCorePredictor


def main() -> None:
    parser = argparse.ArgumentParser(description="Run PatchCore inference on one image.")
    parser.add_argument("--artifact-dir", default="./artifacts/patchcore/bottle")
    parser.add_argument("--image", required=True)
    parser.add_argument("--out-json")
    args = parser.parse_args()

    predictor = PatchCorePredictor(args.artifact_dir)
    predictor.load()
    if not predictor.ready:
        raise RuntimeError(predictor.load_error or "PatchCore predictor is not ready.")

    image_path = Path(args.image)
    result = predictor.predict_bytes(image_path.read_bytes(), filename=image_path.name)
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if args.out_json:
        Path(args.out_json).write_text(text + "\n", encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
