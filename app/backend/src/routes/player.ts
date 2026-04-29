import type { PlayerParams, PlayerResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { getStorageContext } from "../services/storage/db.js";

export const registerPlayerRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: PlayerParams; Reply: PlayerResponse }>(
    "/api/player/:documentId",
    async (request) => {
      const storage = getStorageContext();
      const { documentId } = request.params;
      const resumePositionMs = storage.repositories.resumeStates.getLatestPlaybackPositionByDocument(documentId) ?? 0;

      return {
        documentId,
        audio: storage.repositories.audioChunks.listForDocument(documentId),
        resumePositionMs
      };
    }
  );
};
