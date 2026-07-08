import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cache = new Map();

const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

// Loads labeled reference images for an asset class so the Gemini defect
// labeler can compare the inspection image against known-good orientation.
// Returns [] for classes without a references/<assetKey>/manifest.json.
export function loadReferenceImages(assetKey) {
  const key = normalizeKey(assetKey);
  if (!key) {
    return [];
  }
  if (cache.has(key)) {
    return cache.get(key);
  }

  const refs = readReferences(key);
  cache.set(key, refs);
  return refs;
}

function readReferences(key) {
  const dir = join(here, key);
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) {
    return [];
  }

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const entries = Array.isArray(manifest) ? manifest : manifest.items ?? [];
    return entries
      .map((entry) => toReference(dir, entry))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function toReference(dir, entry) {
  if (!entry || typeof entry.file !== "string") {
    return null;
  }
  const filePath = join(dir, entry.file);
  if (!existsSync(filePath)) {
    return null;
  }
  const ext = entry.file.slice(entry.file.lastIndexOf(".")).toLowerCase();
  return {
    label: String(entry.label ?? "normal").toLowerCase(),
    note: typeof entry.note === "string" ? entry.note : "",
    mimeType: MIME_BY_EXT[ext] ?? "image/jpeg",
    base64: readFileSync(filePath).toString("base64")
  };
}

function normalizeKey(assetKey) {
  return String(assetKey ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}
