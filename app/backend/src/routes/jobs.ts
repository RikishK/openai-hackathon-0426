import type { JobsParams, JobsResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";

export const registerJobsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: JobsParams; Reply: JobsResponse }>("/api/jobs/:jobId", async (request) => {
    const { jobId } = request.params;
    return {
      jobId,
      state: "queued",
      progress: 0
    };
  });
};
