import type { GenerateResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";

export const registerGenerateRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Reply: GenerateResponse }>("/api/generate", async () => ({
    jobId: `job_${Date.now()}`,
    state: "queued"
  }));
};
