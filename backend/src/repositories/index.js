import { JsonStore } from "./json-store.js";
import { SupabaseRepository } from "./supabase-repository.js";

export async function createRepository({ dataDir, env = process.env } = {}) {
  const driver = (env.STORE_DRIVER ?? "json").trim();

  if (driver === "json") {
    return new JsonStore({ dataDir }).init();
  }

  if (driver === "supabase") {
    return new SupabaseRepository({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      anonKey: env.SUPABASE_ANON_KEY,
      inspectionImageBucket: env.SUPABASE_INSPECTION_IMAGE_BUCKET ?? "inspection-images",
      manualFileBucket: env.SUPABASE_MANUAL_FILE_BUCKET ?? "manual-files"
    }).init();
  }

  throw new Error(`Unsupported STORE_DRIVER: ${driver}`);
}
