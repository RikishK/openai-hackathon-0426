import type { FastifyPluginAsync } from "fastify";

export const registerCacheRoutes: FastifyPluginAsync = async (app) => {
  app.delete("/api/cache", async () => ({
    cleared: true
  }));
};
