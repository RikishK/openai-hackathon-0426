import type { LibraryResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { getStorageContext } from "../services/storage/db.js";

export const registerLibraryRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: LibraryResponse }>("/api/library", async () => {
    const storage = getStorageContext();
    const documents = storage.repositories.documents.list();

    return {
      documents: documents.map((document) => {
        const chapters = storage.repositories.chapters.listByDocumentId(document.id);
        const generatedChapterIds = [
          ...new Set(storage.repositories.audioChunks.listForDocument(document.id).map((chunk) => chunk.chapterId))
        ];

        return {
          document,
          chapters,
          generatedChapterIds
        };
      })
    };
  });
};
