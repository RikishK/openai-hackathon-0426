import type { FastifyPluginAsync } from "fastify";

export const registerLibraryRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/library", async () => ({
    documents: []
  }));
};
