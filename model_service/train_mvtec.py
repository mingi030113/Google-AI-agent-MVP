from __future__ import annotations

import argparse

from .training import train_and_save


def main() -> None:
    parser = argparse.ArgumentParser(description="Train PatchCore on an MVTec AD category.")
    parser.add_argument("--category", default="bottle")
    parser.add_argument("--root", default="./datasets/MVTecAD")
    parser.add_argument("--out-dir", default="./artifacts/bottle")
    add_common_args(parser)
    args = parser.parse_args()

    try:
        from anomalib.data import MVTecAD
    except Exception as error:
        raise RuntimeError("anomalib is required. Install model_service/requirements.txt.") from error

    datamodule = MVTecAD(
        root=args.root,
        category=args.category,
        train_batch_size=args.train_batch_size,
        eval_batch_size=args.eval_batch_size,
        num_workers=args.num_workers,
    )
    train_and_save(datamodule, args, category=args.category)


def add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--model-name", default=None)
    parser.add_argument("--backbone", default="wide_resnet50_2")
    parser.add_argument("--layers", nargs="+", default=["layer2", "layer3"])
    parser.add_argument("--image-size", type=int, default=256)
    parser.add_argument("--center-crop", type=int, default=224)
    parser.add_argument("--coreset-sampling-ratio", type=float, default=0.1)
    parser.add_argument("--num-neighbors", type=int, default=9)
    parser.add_argument("--epoch", type=int, default=1)
    parser.add_argument("--train-batch-size", type=int, default=16)
    parser.add_argument("--eval-batch-size", type=int, default=16)
    parser.add_argument("--num-workers", type=int, default=4)
    parser.add_argument("--accelerator", default="auto")
    parser.add_argument("--devices", type=int, default=1)
    parser.add_argument("--threshold-percentile", type=float, default=99.0)
    parser.add_argument("--pixel-threshold-percentile", type=float, default=99.0)


if __name__ == "__main__":
    main()
