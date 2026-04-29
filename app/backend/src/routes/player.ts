import type { PlayerParams, PlayerResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { getStorageContext } from "../services/storage/db.js";

const DEFAULT_RESUME_POSITION_MS = 0;

export const registerPlayerRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: PlayerParams; Reply: PlayerResponse }>(
    "/api/player/:documentId",
    async (request) => {
      const storage = getStorageContext();
      const { documentId } = request.params;
      const savedResumePosition = storage.repositories.resumeStates.getLatestPlaybackPositionByDocument(documentId);
      const resumePositionMs =
        savedResumePosition === null ? DEFAULT_RESUME_POSITION_MS : savedResumePosition;

      return {
        documentId,
        audio: storage.repositories.audioChunks.listForDocument(documentId),
        resumePositionMs
      };
    }
  );
};
