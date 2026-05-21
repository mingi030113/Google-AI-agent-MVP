import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { equipment, manuals, processes } from "../domain.js";
import { seedDatabase, seedUploadFiles } from "../seed.js";
import { cosineSimilarity } from "../rag/embedding.js";

export class JsonStore {
  constructor({ dataDir = join(process.cwd(), "data") } = {}) {
    this.dataDir = dataDir;
    this.uploadsDir = join(dataDir, "uploads");
    this.manualsDir = join(dataDir, "manuals");
    this.dbPath = join(dataDir, "db.json");
    this.db = null;
    this.kind = "json";
  }

  async init() {
    await mkdir(this.uploadsDir, { recursive: true });
    await mkdir(this.manualsDir, { recursive: true });
    await seedUploadFiles(this.uploadsDir);

    if (await exists(this.dbPath)) {
      this.db = JSON.parse(await readFile(this.dbPath, "utf8"));
      this.db.manuals ??= manuals;
      this.db.manualChunks ??= [];
    } else {
      this.db = seedDatabase();
      await this.save();
    }

    return this;
  }

  async save() {
    await writeFile(this.dbPath, `${JSON.stringify(this.db, null, 2)}\n`, "utf8");
  }

  async listProcesses() {
    return processes;
  }

  async listEquipment() {
    return equipment;
  }

  async saveUpload({ fileName, buffer }) {
    await mkdir(this.uploadsDir, { recursive: true });
    await writeFile(join(this.uploadsDir, fileName), buffer);
    return `/uploads/${fileName}`;
  }

  async saveManualFile({ fileName, buffer }) {
    await mkdir(this.manualsDir, { recursive: true });
    await writeFile(join(this.manualsDir, fileName), buffer);
    return `/manual-files/${fileName}`;
  }

  async getUpload({ pathname }) {
    const fileName = basename(pathname);
    const filePath = join(this.uploadsDir, fileName);
    await stat(filePath);
    return {
      stream: createReadStream(filePath),
      fileName
    };
  }

  async listInspections() {
    return [...this.db.inspections];
  }

  async searchInspectionHistory(criteria) {
    const { findSimilarInspectionCases } = await import("../similar-case-service.js");
    return findSimilarInspectionCases(this.db.inspections, criteria);
  }

  async getInspection(id) {
    return this.db.inspections.find((inspection) => inspection.id === id) ?? null;
  }

  async addInspection(inspection) {
    this.db.inspections.unshift(inspection);
    await this.save();
    return inspection;
  }

  async updateInspection(id, updater) {
    const index = this.db.inspections.findIndex((inspection) => inspection.id === id);
    if (index === -1) {
      return null;
    }

    this.db.inspections[index] = updater(this.db.inspections[index]);
    await this.save();
    return this.db.inspections[index];
  }

  async listReports() {
    return [...this.db.reports];
  }

  async getReport(id) {
    return this.db.reports.find((report) => report.id === id) ?? null;
  }

  async addReport(report) {
    this.db.reports.unshift(report);
    await this.save();
    return report;
  }

  async deleteReport(id) {
    const index = this.db.reports.findIndex((report) => report.id === id);
    if (index === -1) {
      return false;
    }

    this.db.reports.splice(index, 1);
    await this.save();
    return true;
  }

  async listManuals() {
    return [...this.db.manuals];
  }

  async upsertManualWithChunks(manual, chunks) {
    const manualIndex = this.db.manuals.findIndex((item) => item.id === manual.id);
    if (manualIndex === -1) {
      this.db.manuals.unshift(manual);
    } else {
      this.db.manuals[manualIndex] = { ...this.db.manuals[manualIndex], ...manual };
    }

    this.db.manualChunks = [
      ...chunks,
      ...this.db.manualChunks.filter((chunk) => chunk.manualId !== manual.id)
    ];
    await this.save();
    return manual;
  }

  async deleteManual(id) {
    const index = this.db.manuals.findIndex((manual) => manual.id === id);
    if (index === -1) {
      return false;
    }

    this.db.manuals.splice(index, 1);
    this.db.manualChunks = this.db.manualChunks.filter((chunk) => chunk.manualId !== id);
    await this.save();
    return true;
  }

  async searchManualChunks({ embedding, defectType, limit = 3 }) {
    return this.db.manualChunks
      .map((chunk) => {
        const defectBoost = defectType && chunk.metadata?.defectType === defectType ? 0.12 : 0;
        return {
          ...chunk,
          score: Math.min(cosineSimilarity(embedding, chunk.embedding) + defectBoost, 0.99)
        };
      })
      .filter((chunk) => chunk.score > 0.01)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
