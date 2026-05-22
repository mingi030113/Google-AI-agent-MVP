import { createRepository } from "../repositories/index.js";
import { createVisionModelClient } from "../vision/index.js";
import { assertRepositoryPort } from "../application/ports/repository-port.js";

export async function createBackendContainer({ dataDir, env = process.env, visionClient } = {}) {
  const store = assertRepositoryPort(await createRepository({ dataDir, env }));
  const vision = visionClient ?? createVisionModelClient({ env });

  return {
    store,
    visionClient: vision
  };
}
