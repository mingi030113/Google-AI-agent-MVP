import { createServer } from "node:http";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { createRepository } from "./repositories/index.js";
import { parseMultipart } from "./multipart.js";
import {
  badRequest,
  methodNotAllowed,
  notFound,
  readBody,
  readJson,
  sendError,
  sendJson,
  sendNoContent
} from "./http.js";
import {
  analyzeInspection,
  applyFeedback,
  filterInspections,
  paginate,
  summarizeInspections,
  toListItem
} from "./inspection-service.js";
import { buildDashboardMetrics } from "./dashboard-service.js";
import { answerAgentQuestion } from "./agent-service.js";
import { generateReport } from "./report-service.js";
import { createVisionModelClient } from "./vision/index.js";
import { ingestManual } from "./rag/manual-ingestion-service.js";

export async function createApp({ dataDir, env = process.env, visionClient } = {}) {
  const store = await createRepository({ dataDir, env });
  const vision = visionClient ?? createVisionModelClient({ env });

  return createServer(async (request, response) => {
    try {
      await routeRequest({ request, response, store, visionClient: vision });
    } catch (error) {
      sendError(response, error);
    }
  });
}

async function routeRequest({ request, response, store, visionClient }) {
  if (request.method === "OPTIONS") {
    sendNoContent(response);
    return;
  }

  const url = new URL(request.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const query = Object.fromEntries(url.searchParams.entries());

  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      storeDriver: store.kind,
      visionDriver: visionClient.kind ?? visionClient.modelName ?? "unknown"
    });
    return;
  }

  if (request.method === "GET" && pathname === "/api/master-data") {
    const [processes, equipment] = await Promise.all([store.listProcesses(), store.listEquipment()]);
    sendJson(response, 200, { processes, equipment });
    return;
  }

  if (request.method === "GET" && pathname.startsWith("/uploads/")) {
    await sendUpload(response, store, pathname);
    return;
  }

  if (pathname === "/api/inspections/analyze") {
    if (request.method !== "POST") {
      throw methodNotAllowed();
    }
    await handleAnalyzeInspection(request, response, store, visionClient);
    return;
  }

  if (pathname === "/api/inspections") {
    if (request.method !== "GET") {
      throw methodNotAllowed();
    }
    const inspections = await store.listInspections();
    const filtered = filterInspections(inspections, query)
      .sort((left, right) => right.inspectedAt.localeCompare(left.inspectedAt));
    sendJson(response, 200, {
      ...paginate(filtered.map(toListItem), query),
      summary: summarizeInspections(filtered)
    });
    return;
  }

  const inspectionFeedbackMatch = pathname.match(/^\/api\/inspections\/([^/]+)\/feedback$/);
  if (inspectionFeedbackMatch) {
    if (request.method !== "POST") {
      throw methodNotAllowed();
    }
    await handleFeedback(request, response, store, inspectionFeedbackMatch[1]);
    return;
  }

  const inspectionMatch = pathname.match(/^\/api\/inspections\/([^/]+)$/);
  if (inspectionMatch) {
    if (request.method !== "GET") {
      throw methodNotAllowed();
    }
    const inspection = await store.getInspection(inspectionMatch[1]);
    if (!inspection) {
      throw notFound("Inspection was not found.");
    }
    sendJson(response, 200, { inspection });
    return;
  }

  if (pathname === "/api/dashboard/metrics") {
    if (request.method !== "GET") {
      throw methodNotAllowed();
    }
    sendJson(response, 200, buildDashboardMetrics(await store.listInspections(), query));
    return;
  }

  if (pathname === "/api/agent/ask") {
    if (request.method !== "POST") {
      throw methodNotAllowed();
    }
    const body = await readJson(request);
    if (!body.question || body.question.trim().length === 0) {
      throw badRequest("question is required.");
    }
    sendJson(response, 200, await answerAgentQuestion(body, store));
    return;
  }

  if (pathname === "/api/reports") {
    if (request.method === "GET") {
      sendJson(response, 200, { items: await store.listReports() });
      return;
    }
    if (request.method === "POST") {
      const report = generateReport(await readJson(request), await store.listInspections());
      await store.addReport(report);
      sendJson(response, 201, { report });
      return;
    }
    throw methodNotAllowed();
  }

  const reportMatch = pathname.match(/^\/api\/reports\/([^/]+)$/);
  if (reportMatch) {
    if (request.method === "GET") {
      const report = await store.getReport(reportMatch[1]);
      if (!report) {
        throw notFound("Report was not found.");
      }
      sendJson(response, 200, { report });
      return;
    }
    if (request.method === "DELETE") {
      if (!store.deleteReport) {
        throw methodNotAllowed("Report delete is not supported by the active store.");
      }
      const deleted = await store.deleteReport(reportMatch[1]);
      if (!deleted) {
        throw notFound("Report was not found.");
      }
      sendNoContent(response);
      return;
    }
    throw methodNotAllowed();
  }

  const manualMatch = pathname.match(/^\/api\/manuals\/([^/]+)$/);
  if (manualMatch) {
    if (request.method !== "DELETE") {
      throw methodNotAllowed();
    }
    if (!store.deleteManual) {
      throw methodNotAllowed("Manual delete is not supported by the active store.");
    }
    const deleted = await store.deleteManual(manualMatch[1]);
    if (!deleted) {
      throw notFound("Manual was not found.");
    }
    sendNoContent(response);
    return;
  }

  if (pathname === "/api/manuals") {
    if (request.method === "GET") {
      sendJson(response, 200, { items: await store.listManuals() });
      return;
    }
    if (request.method === "POST") {
      await handleManualUpload(request, response, store);
      return;
    }
    throw methodNotAllowed();
  }

  throw notFound();
}

async function handleManualUpload(request, response, store) {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw badRequest("Content-Type must be multipart/form-data.");
  }

  if (!store.upsertManualWithChunks) {
    throw methodNotAllowed("Manual upload is not supported by the active store.");
  }

  const body = await readBody(request);
  const { fields, files } = parseMultipart(body, contentType);
  const file = files.file || files.manual;
  const result = await ingestManual({ fields, file, store });
  sendJson(response, 201, result);
}

async function handleAnalyzeInspection(request, response, store, visionClient) {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw badRequest("Content-Type must be multipart/form-data.");
  }

  const body = await readBody(request);
  const { fields, files } = parseMultipart(body, contentType);
  const image = files.image;
  if (!image || image.buffer.length === 0) {
    throw badRequest("image file is required.");
  }

  const storedName = buildStoredUploadName(image.filename);
  const imageUrl = await store.saveUpload({
    fileName: storedName,
    buffer: image.buffer,
    contentType: image.contentType
  });

  const inspection = await analyzeInspection({
    fields,
    imageUrl,
    image,
    visionClient
  });
  await store.addInspection(inspection);

  sendJson(response, 201, { inspection });
}

async function handleFeedback(request, response, store, inspectionId) {
  const feedback = await readJson(request);
  const inspection = await store.updateInspection(inspectionId, (current) => applyFeedback(current, feedback));
  if (!inspection) {
    throw notFound("Inspection was not found.");
  }
  sendJson(response, 200, { inspection });
}

async function sendUpload(response, store, pathname) {
  try {
    const upload = await store.getUpload({ pathname });
    if (!upload) {
      throw notFound("Upload was not found.");
    }
    const contentType = contentTypeFor(upload.fileName);
    response.writeHead(200, {
      "content-type": contentType,
      "cache-control": "public, max-age=3600"
    });
    upload.stream.pipe(response);
  } catch {
    throw notFound("Upload was not found.");
  }
}

function buildStoredUploadName(filename) {
  const extension = sanitizeExtension(extname(filename));
  return `${Date.now()}-${randomUUID().slice(0, 8)}${extension}`;
}

function sanitizeExtension(extension) {
  const lowered = extension.toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg"].includes(lowered)
    ? lowered
    : ".bin";
}

function contentTypeFor(fileName) {
  const extension = extname(fileName).toLowerCase();
  return {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml"
  }[extension] ?? "application/octet-stream";
}
