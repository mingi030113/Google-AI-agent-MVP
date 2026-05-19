export function toKstIsoString(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 19)}+09:00`;
}

export function toDateOnly(value) {
  return value.slice(0, 10);
}

export function addDays(dateOnly, days) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function eachDate(startDate, endDate) {
  const dates = [];
  for (let current = startDate; current <= endDate; current = addDays(current, 1)) {
    dates.push(current);
  }
  return dates;
}

export function latestDateOnly(inspections) {
  if (inspections.length === 0) {
    return toDateOnly(toKstIsoString());
  }

  return inspections
    .map((inspection) => toDateOnly(inspection.inspectedAt))
    .sort()
    .at(-1);
}
