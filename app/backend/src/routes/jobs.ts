import type { FastifyPluginAsync } from "fastify";

export const registerJobsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/jobs/:jobId", async (request) => {
    const params = request.params as { jobId: string };
    return {
      jobId: params.jobId,
      state: "queued",
      progress: 0
    };
  });
};
