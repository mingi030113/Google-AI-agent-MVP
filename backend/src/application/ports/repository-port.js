const BASE_REPOSITORY_METHODS = [
  "listProcesses",
  "listEquipment",
  "listInspections",
  "getInspection",
  "addInspection",
  "updateInspection",
  "listReports",
  "getReport",
  "addReport",
  "listManuals"
];

export function assertRepositoryPort(store, { optional = [] } = {}) {
  const missing = [...BASE_REPOSITORY_METHODS, ...optional]
    .filter((method) => typeof store?.[method] !== "function");

  if (missing.length > 0) {
    throw new Error(`Repository port is missing methods: ${missing.join(", ")}`);
  }

  return store;
}
