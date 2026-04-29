import type { FastifyPluginAsync } from "fastify";

export const registerSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/settings", async () => ({
    apiKeyConfigured: false,
    defaultVoice: "alloy"
  }));
};
