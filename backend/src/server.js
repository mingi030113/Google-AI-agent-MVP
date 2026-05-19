import { createApp } from "./app.js";
import { existsSync, readFileSync } from "node:fs";

loadDotEnv();

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

const server = await createApp();
server.listen(port, host, () => {
  console.log(`Quality Agent backend listening on http://${host}:${port}`);
});

function loadDotEnv(path = ".env") {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }
    process.env[match[1]] = match[2].trim().replace(/^"|"$/g, "").trim();
  }
}
