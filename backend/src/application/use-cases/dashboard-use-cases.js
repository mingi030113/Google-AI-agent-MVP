import { buildDashboardMetrics } from "../../dashboard-service.js";

export async function getDashboardMetricsUseCase({ store, query }) {
  return buildDashboardMetrics(await store.listInspections(), query);
}
