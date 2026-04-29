import type { FastifyPluginAsync } from "fastify";

export const registerPlayerRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/player/:documentId", async (request) => {
    const params = request.params as { documentId: string };
    return {
      documentId: params.documentId,
      audio: [],
      resumePositionMs: 0
    };
  });
};
