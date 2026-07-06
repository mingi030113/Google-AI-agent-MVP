# PatchCore Model Service

FastAPI service and CLIs for the PatchCore anomaly localization PoC.

## Train on MVTec AD

```powershell
python -m model_service.train_mvtec `
  --category bottle `
  --root ./datasets/MVTecAD `
  --out-dir ./artifacts/bottle
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

`GET /health` only checks server liveness. `GET /ready` checks model, threshold, and metadata artifacts.
