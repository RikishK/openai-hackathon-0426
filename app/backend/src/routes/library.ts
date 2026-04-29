import type { LibraryResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";

export const registerLibraryRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: LibraryResponse }>("/api/library", async () => ({
    documents: []
  }));
};
