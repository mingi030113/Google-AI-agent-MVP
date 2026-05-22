import { createServer } from "node:http";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { createBackendContainer } from "./infrastructure/container.js";
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
  analyzeInspectionUseCase,
  applyInspectionFeedbackUseCase,
  getInspectionUseCase,
  listInspectionsUseCase
} from "./application/use-cases/inspection-use-cases.js";
import { getDashboardMetricsUseCase } from "./application/use-cases/dashboard-use-cases.js";
import { askAgentQuestionUseCase } from "./application/use-cases/agent-use-cases.js";
import {
  createReportUseCase,
  deleteReportUseCase,
  getReportUseCase,
  listReportsUseCase
} from "./application/use-cases/report-use-cases.js";
import {
  deleteManualUseCase,
  ingestManualUseCase,
  listManualsUseCase
} from "./application/use-cases/manual-use-cases.js";

export async function createApp({ dataDir, env = process.env, visionClient } = {}) {
  const container = await createBackendContainer({ dataDir, env, visionClient });

  return createServer(async (request, response) => {
    try {
      await routeRequest({ request, response, ...container, env });
    } catch (error) {
      sendError(response, error);
    }
  });
}

async function routeRequest({ request, response, store, visionClient, env }) {
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
    sendJson(response, 200, await listInspectionsUseCase({ store, query }));
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
    const inspection = await getInspectionUseCase({ store, inspectionId: inspectionMatch[1] });
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
    sendJson(response, 200, await getDashboardMetricsUseCase({ store, query }));
    return;
  }

  if (pathname === "/api/agent/ask") {
    if (request.method !== "POST") {
      throw methodNotAllowed();
    }
    sendJson(response, 200, await askAgentQuestionUseCase({ store, env, payload: await readJson(request) }));
    return;
  }

  if (pathname === "/api/reports") {
    if (request.method === "GET") {
      sendJson(response, 200, { items: await listReportsUseCase({ store }) });
      return;
    }
    if (request.method === "POST") {
      const report = await createReportUseCase({ store, env, payload: await readJson(request) });
      sendJson(response, 201, { report });
      return;
    }
    throw methodNotAllowed();
  }

  const reportMatch = pathname.match(/^\/api\/reports\/([^/]+)$/);
  if (reportMatch) {
    if (request.method === "GET") {
      const report = await getReportUseCase({ store, reportId: reportMatch[1] });
      if (!report) {
        throw notFound("Report was not found.");
      }
      sendJson(response, 200, { report });
      return;
    }
    if (request.method === "DELETE") {
      await deleteReportUseCase({ store, reportId: reportMatch[1] });
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
    const deleted = await deleteManualUseCase({ store, manualId: manualMatch[1] });
    if (!deleted) {
      throw notFound("Manual was not found.");
    }
    sendNoContent(response);
    return;
  }

  if (pathname === "/api/manuals") {
    if (request.method === "GET") {
      sendJson(response, 200, { items: await listManualsUseCase({ store }) });
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

  const body = await readBody(request);
  const { fields, files } = parseMultipart(body, contentType);
  const file = files.file || files.manual;
  const result = await ingestManualUseCase({ fields, file, store });
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

  const inspection = await analyzeInspectionUseCase({ store, fields, imageUrl, image, visionClient });

  sendJson(response, 201, { inspection });
}

async function handleFeedback(request, response, store, inspectionId) {
  const feedback = await readJson(request);
  const inspection = await applyInspectionFeedbackUseCase({ store, inspectionId, feedback });
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
