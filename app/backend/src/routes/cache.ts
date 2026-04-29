import type { CacheClearResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";

export const registerCacheRoutes: FastifyPluginAsync = async (app) => {
  app.delete<{ Reply: CacheClearResponse }>("/api/cache", async () => ({
    cleared: true
  }));
};
