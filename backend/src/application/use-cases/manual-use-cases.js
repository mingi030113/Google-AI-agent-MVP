import { methodNotAllowed } from "../../http.js";
import { ingestManual } from "../../rag/manual-ingestion-service.js";

export async function listManualsUseCase({ store }) {
  return store.listManuals();
}

export async function ingestManualUseCase({ store, fields, file }) {
  if (!store.upsertManualWithChunks) {
    throw methodNotAllowed("Manual upload is not supported by the active store.");
  }

  return ingestManual({ fields, file, store });
}

export async function deleteManualUseCase({ store, manualId }) {
  if (!store.deleteManual) {
    throw methodNotAllowed("Manual delete is not supported by the active store.");
  }

  return store.deleteManual(manualId);
}
