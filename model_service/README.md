# PatchCore Model Service

FastAPI service and CLIs for the PatchCore anomaly localization PoC.

## Train on MVTec AD

```powershell
python -m model_service.train_mvtec `
  --category bottle `
  --root ./datasets/MVTecAD `
  --out-dir ./artifacts/bottle
```

`metal_nut`도 같은 구조로 저장합니다.

```powershell
python -m model_service.train_mvtec `
  --category metal_nut `
  --root ./datasets/MVTecAD `
  --out-dir ./artifacts/metal_nut
```

PatchCore builds a memory bank from normal patch features, so the default epoch is `1`.

## Train on Project Folder Layout

```powershell
python -m model_service.train_folder `
  --asset-key default `
  --data-dir ./datasets/default `
  --out-dir ./artifacts/default
```

Expected layout:

```text
datasets/<assetKey>/train/good
datasets/<assetKey>/val/good
datasets/<assetKey>/test/good
datasets/<assetKey>/test/anomaly/<defectType>
```

## Run Service

```powershell
pwsh ./scripts/start-patchcore.ps1
```

기본 실행은 `./artifacts` 하위의 artifact 폴더를 자동 발견합니다. 예를 들어 아래 구조면 `assetKey=bottle`과 `assetKey=metal_nut` 요청을 모두 처리합니다.

```text
artifacts/
  bottle/
    model.ckpt
    threshold.json
    metadata.json
  metal_nut/
    model.ckpt
    threshold.json
    metadata.json
```

단일 모델만 실행하려면 `PATCHCORE_ARTIFACT_DIR`를 특정 폴더로 지정할 수 있습니다.

`GET /health` only checks server liveness. `GET /ready` checks model, threshold, and metadata artifacts.
