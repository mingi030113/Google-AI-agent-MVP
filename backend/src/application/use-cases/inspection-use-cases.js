import {
  analyzeInspection,
  applyFeedback,
  filterInspections,
  paginate,
  summarizeInspections,
  toListItem
} from "../../inspection-service.js";

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
  return store.getInspection(inspectionId);
}

export async function analyzeInspectionUseCase({ store, visionClient, fields, imageUrl, image }) {
  const inspection = await analyzeInspection({ fields, imageUrl, image, visionClient });
  await store.addInspection(inspection);
  return inspection;
}

export async function applyInspectionFeedbackUseCase({ store, inspectionId, feedback }) {
  return store.updateInspection(inspectionId, (current) => applyFeedback(current, feedback));
}
