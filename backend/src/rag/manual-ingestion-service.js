import { randomUUID } from "node:crypto";
import { basename, extname } from "node:path";
import { badRequest } from "../http.js";
import { embedText } from "./embedding.js";

const MAX_CHUNK_LENGTH = 700;
const CHUNK_OVERLAP = 120;

export async function ingestManual({ fields, file, store }) {
  const content = extractText(file);
  const title = normalizeTitle(fields.title, file.filename);
  const defectType = normalizeOptional(fields.defectType);
  const checklist = parseChecklist(fields.checklist);
  const chunks = chunkText(content);

  if (chunks.length === 0) {
    throw badRequest("manual file must include text content.");
  }

  const existingManual = fields.id?.trim() ? null : await findExistingManual(store, { title, defectType });
  const manualId = fields.id?.trim() || existingManual?.id || `manual-${randomUUID().slice(0, 8)}`;
  const filePath = await saveManualFile({ store, file });

  const manual = {
    id: manualId,
    title,
    defectType,
    excerpt: summarize(content),
    checklist,
    filePath,
    embeddingStatus: "completed",
    createdAt: new Date().toISOString()
  };

  const manualChunks = chunks.map((chunk, index) => ({
    id: randomUUID(),
    manualId,
    chunkIndex: index,
    content: chunk,
    embedding: embedText(`${title}\n${defectType ?? ""}\n${chunk}`),
    metadata: {
      title,
      defectType,
      fileName: file.filename
    }
  }));

  await store.upsertManualWithChunks(manual, manualChunks);
  return { manual, chunks: manualChunks.map(toChunkSummary) };
}

async function saveManualFile({ store, file }) {
  if (!store.saveManualFile) {
    return undefined;
  }

  try {
    return await store.saveManualFile({
      fileName: buildManualFileName(file.filename),
      buffer: file.buffer,
      contentType: normalizeManualContentType(file)
    });
  } catch {
    return undefined;
  }
}

async function findExistingManual(store, { title, defectType }) {
  if (!store.listManuals) {
    return null;
  }

  const normalizedTitle = title.trim().toLowerCase();
  const manuals = await store.listManuals();
  return manuals.find((manual) =>
    manual.title?.trim().toLowerCase() === normalizedTitle &&
    normalizeOptional(manual.defectType) === defectType
  ) ?? null;
}

export function chunkText(text) {
  const normalized = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (`${current}\n\n${paragraph}`.trim().length <= MAX_CHUNK_LENGTH) {
      current = `${current}\n\n${paragraph}`.trim();
      continue;
    }

    if (current) {
      chunks.push(current);
      current = overlapTail(current);
    }

    if (paragraph.length <= MAX_CHUNK_LENGTH) {
      current = `${current}\n\n${paragraph}`.trim();
    } else {
      for (const segment of splitLongText(paragraph)) {
        if (current) {
          chunks.push(current);
        }
        current = segment;
      }
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function extractText(file) {
  if (!file || file.buffer.length === 0) {
    throw badRequest("manual file is required.");
  }

  const extension = extname(file.filename).toLowerCase();
  const contentType = file.contentType.toLowerCase();
  if (
    extension !== ".txt" &&
    extension !== ".md" &&
    contentType !== "text/plain" &&
    contentType !== "text/markdown"
  ) {
    throw badRequest("manual upload supports text/plain or markdown files in this backend slice.");
  }

  return file.buffer.toString("utf8");
}

function parseChecklist(rawChecklist) {
  if (!rawChecklist) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawChecklist);
    if (!Array.isArray(parsed)) {
      throw new Error("checklist must be an array.");
    }
    return parsed.map((item, index) => ({
      id: String(item.id ?? `manual-check-${index + 1}`),
      label: String(item.label ?? item),
      priority: ["low", "medium", "high"].includes(item.priority) ? item.priority : "medium"
    }));
  } catch {
    return rawChecklist
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean)
      .map((label, index) => ({
        id: `manual-check-${index + 1}`,
        label,
        priority: "medium"
      }));
  }
}

function normalizeTitle(title, filename) {
  const value = title?.trim() || basename(filename, extname(filename));
  if (!value) {
    throw badRequest("title is required.");
  }
  return value;
}

function normalizeOptional(value) {
  return value?.trim() || null;
}

function normalizeManualContentType(file) {
  const extension = extname(file.filename).toLowerCase();
  if (extension === ".md") {
    return "text/markdown";
  }
  if (extension === ".txt") {
    return "text/plain";
  }
  return file.contentType || "application/octet-stream";
}

function summarize(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
}

function splitLongText(text) {
  const chunks = [];
  for (let start = 0; start < text.length; start += MAX_CHUNK_LENGTH - CHUNK_OVERLAP) {
    chunks.push(text.slice(start, start + MAX_CHUNK_LENGTH).trim());
  }
  return chunks.filter(Boolean);
}

function overlapTail(text) {
  return text.length > CHUNK_OVERLAP ? text.slice(-CHUNK_OVERLAP).trim() : "";
}

function buildManualFileName(filename) {
  const safeName = basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${Date.now()}-${safeName || "manual.txt"}`;
}

function toChunkSummary(chunk) {
  return {
    id: chunk.id,
    manualId: chunk.manualId,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    metadata: chunk.metadata
  };
}
