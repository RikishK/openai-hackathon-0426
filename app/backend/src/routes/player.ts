import type { PlayerParams, PlayerResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";

export const registerPlayerRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: PlayerParams; Reply: PlayerResponse }>(
    "/api/player/:documentId",
    async (request) => {
      const { documentId } = request.params;
      return {
        documentId,
        audio: [],
        resumePositionMs: 0
      };
    }
  );
};
