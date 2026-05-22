import {
  analyzeInspection,
  applyFeedback,
  filterInspections,
  normalizeInspectionStatus,
  paginate,
  removeFeedback,
  summarizeInspections,
  toListItem,
  updateChecklistItem
} from "../../inspection-service.js";
import { methodNotAllowed } from "../../http.js";

export async function listInspectionsUseCase({ store, query }) {
  const inspections = await store.listInspections();
  const filtered = filterInspections(inspections, query)
    .sort((left, right) => right.inspectedAt.localeCompare(left.inspectedAt));

  return {
    ...paginate(filtered.map(toListItem), query),
    summary: summarizeInspections(filtered)
  };
}

export async function getInspectionUseCase({ store, inspectionId }) {
  const inspection = await store.getInspection(inspectionId);
  return inspection ? normalizeInspectionStatus(inspection) : null;
}

export async function analyzeInspectionUseCase({ store, visionClient, fields, imageUrl, image }) {
  const inspection = await analyzeInspection({ fields, imageUrl, image, visionClient });
  await store.addInspection(inspection);
  return inspection;
}

export async function applyInspectionFeedbackUseCase({ store, inspectionId, feedback }) {
  return store.updateInspection(inspectionId, (current) => applyFeedback(current, feedback));
}

export async function updateInspectionChecklistUseCase({ store, inspectionId, payload }) {
  return store.updateInspection(inspectionId, (current) => updateChecklistItem(current, payload));
}

export async function deleteInspectionFeedbackUseCase({ store, inspectionId, feedbackId }) {
  if (store.deleteInspectionFeedback) {
    return store.deleteInspectionFeedback(inspectionId, feedbackId);
  }
  if (!store.updateInspection) {
    throw methodNotAllowed("Inspection feedback delete is not supported by the active store.");
  }

  let deleted = false;
  const inspection = await store.updateInspection(inspectionId, (current) => {
    const result = removeFeedback(current, feedbackId);
    deleted = result.deleted;
    return result.inspection;
  });

  return inspection && deleted ? inspection : null;
}
