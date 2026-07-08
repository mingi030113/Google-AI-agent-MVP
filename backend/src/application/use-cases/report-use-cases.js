import { methodNotAllowed, notFound } from "../../http.js";
import { generateReport } from "../../report-service.js";

export async function listReportsUseCase({ store }) {
  return store.listReports();
}

export async function getReportUseCase({ store, reportId }) {
  return store.getReport(reportId);
}

export async function createReportUseCase({ store, env, payload }) {
  const report = await generateReport(payload, await store.listInspections(), { env, store });
  await store.addReport(report);
  return report;
}

export async function deleteReportUseCase({ store, reportId }) {
  if (!store.deleteReport) {
    throw methodNotAllowed("Report delete is not supported by the active store.");
  }

  const deleted = await store.deleteReport(reportId);
  if (!deleted) {
    throw notFound("Report was not found.");
  }
}
