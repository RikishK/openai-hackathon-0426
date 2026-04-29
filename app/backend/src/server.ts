import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerCacheRoutes } from "./routes/cache.js";
import { registerEstimateRoutes } from "./routes/estimate.js";
import { registerGenerateRoutes } from "./routes/generate.js";
import { registerIngestRoutes } from "./routes/ingest.js";
import { registerJobsRoutes } from "./routes/jobs.js";
import { registerLibraryRoutes } from "./routes/library.js";
import { registerPlayerRoutes } from "./routes/player.js";
import { registerSettingsRoutes } from "./routes/settings.js";

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

const host = "127.0.0.1";
const port = 4310;

await app.listen({ host, port });
