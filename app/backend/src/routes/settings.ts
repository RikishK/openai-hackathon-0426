import type { SettingsResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";

export const registerSettingsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: SettingsResponse }>("/api/settings", async () => ({
    apiKeyConfigured: false,
    defaultVoice: "alloy"
  }));
};
