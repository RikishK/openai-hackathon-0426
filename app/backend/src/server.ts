import cors from "@fastify/cors";
import Fastify from "fastify";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { registerCacheRoutes } from "./routes/cache.js";
import { registerEstimateRoutes } from "./routes/estimate.js";
import { registerGenerateRoutes } from "./routes/generate.js";
import { registerIngestRoutes } from "./routes/ingest.js";
import { registerJobsRoutes } from "./routes/jobs.js";
import { registerLibraryRoutes } from "./routes/library.js";
import { registerPlayerRoutes } from "./routes/player.js";
import { registerSettingsRoutes } from "./routes/settings.js";

interface LocalConfig {
  server: {
    host: string;
    port: number;
  };
}

async function readLocalConfig(): Promise<LocalConfig> {
  const configPath = resolve(process.cwd(), "config/local.json");
  const configSource = await readFile(configPath, "utf8");
  const parsed = JSON.parse(configSource) as Partial<LocalConfig>;

  if (!parsed.server || typeof parsed.server.host !== "string") {
    throw new Error("config/local.json is missing server.host");
  }

  if (
    typeof parsed.server.port !== "number" ||
    !Number.isInteger(parsed.server.port) ||
    parsed.server.port < 1 ||
    parsed.server.port > 65535
  ) {
    throw new Error("config/local.json has an invalid server.port");
  }

  return {
    server: {
      host: parsed.server.host,
      port: parsed.server.port
    }
  };
}

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: true
});

app.get("/api/health", async () => ({ status: "ok" }));

await app.register(registerIngestRoutes);
await app.register(registerEstimateRoutes);
await app.register(registerGenerateRoutes);
await app.register(registerJobsRoutes);
await app.register(registerLibraryRoutes);
await app.register(registerPlayerRoutes);
await app.register(registerSettingsRoutes);
await app.register(registerCacheRoutes);

const { server } = await readLocalConfig();

await app.listen({ host: server.host, port: server.port });
