from __future__ import annotations

import argparse

from .artifacts import validate_folder_dataset
from .train_mvtec import add_common_args
from .training import train_and_save


def main() -> None:
    parser = argparse.ArgumentParser(description="Train PatchCore on the project folder dataset layout.")
    parser.add_argument("--asset-key", default="default")
    parser.add_argument("--data-dir", default="./datasets/default")
    parser.add_argument("--out-dir", default="./artifacts/patchcore/default")
    add_common_args(parser)
    args = parser.parse_args()

    validate_folder_dataset(args.data_dir)
    datamodule = build_folder_datamodule(args)
    train_and_save(datamodule, args, category=args.asset_key)


def build_folder_datamodule(args):
    try:
        from anomalib.data import Folder
    except Exception as error:
        raise RuntimeError("anomalib is required. Install model_service/requirements.txt.") from error

    kwargs = {
        "name": args.asset_key,
        "root": args.data_dir,
        "normal_dir": "train/good",
        "abnormal_dir": "test/anomaly",
        "normal_test_dir": "test/good",
        "train_batch_size": args.train_batch_size,
        "eval_batch_size": args.eval_batch_size,
        "num_workers": args.num_workers,
    }
    try:
        return Folder(**kwargs)
    except TypeError:
        kwargs.pop("name", None)
        return Folder(**kwargs)


if __name__ == "__main__":
    main()
