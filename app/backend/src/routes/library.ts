import type { LibraryResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { getStorageContext } from "../services/storage/db.js";

export const registerLibraryRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: LibraryResponse }>("/api/library", async () => {
    const storage = getStorageContext();
    return {
      documents: storage.repositories.documents.list()
    };
  });
};
