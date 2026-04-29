import type {
  PlayerParams,
  PlayerResponse,
  PlayerResumeRequest,
  PlayerResumeResponse
} from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { getStorageContext } from "../services/storage/db.js";

const DEFAULT_RESUME_POSITION_MS = 0;

interface PlayerChunkParams extends PlayerParams {
  chunkId: string;
}

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
        audio: storage.repositories.audioChunks.listForDocument(documentId).map((chunk) => ({
          ...chunk,
          url: `/api/player/${documentId}/chunks/${chunk.id}/stream`,
          downloadUrl: `/api/player/${documentId}/chunks/${chunk.id}/download`
        })),
        resumePositionMs
      };
    }
  );

  app.post<{ Params: PlayerParams; Body: PlayerResumeRequest; Reply: PlayerResumeResponse }>(
    "/api/player/:documentId/resume",
    async (request, reply) => {
      const { documentId } = request.params;
      const payload = request.body;

      if (typeof payload.chapterId !== "string" || payload.chapterId.trim().length === 0) {
        return reply.code(400).send({
          saved: false,
          resumePositionMs: DEFAULT_RESUME_POSITION_MS
        });
      }

      if (typeof payload.profileHash !== "string" || payload.profileHash.trim().length === 0) {
        return reply.code(400).send({
          saved: false,
          resumePositionMs: DEFAULT_RESUME_POSITION_MS
        });
      }

      if (!Number.isFinite(payload.playbackPositionMs) || payload.playbackPositionMs < 0) {
        return reply.code(400).send({
          saved: false,
          resumePositionMs: DEFAULT_RESUME_POSITION_MS
        });
      }

      const storage = getStorageContext();
      const normalizedPositionMs = Math.round(payload.playbackPositionMs);

      storage.repositories.resumeStates.save({
        documentId,
        chapterId: payload.chapterId,
        profileHash: payload.profileHash,
        playbackPositionMs: normalizedPositionMs
      });

      return {
        saved: true,
        resumePositionMs: normalizedPositionMs
      };
    }
  );

  app.get<{ Params: PlayerChunkParams }>("/api/player/:documentId/chunks/:chunkId/stream", async (request, reply) => {
    const storage = getStorageContext();
    const { documentId, chunkId } = request.params;
    const chunk = storage.repositories.audioChunks.getByIdForDocument(documentId, chunkId);

    if (!chunk || chunk.status !== "ready") {
      return reply.code(404).send({ message: "Audio chunk not found" });
    }

    try {
      await access(chunk.file_path);
    } catch {
      return reply.code(404).send({ message: "Audio chunk file is missing" });
    }

    reply.header("accept-ranges", "bytes");
    return reply.type("audio/mpeg").send(createReadStream(chunk.file_path));
  });

  app.get<{ Params: PlayerChunkParams }>(
    "/api/player/:documentId/chunks/:chunkId/download",
    async (request, reply) => {
      const storage = getStorageContext();
      const { documentId, chunkId } = request.params;
      const chunk = storage.repositories.audioChunks.getByIdForDocument(documentId, chunkId);

      if (!chunk || chunk.status !== "ready") {
        return reply.code(404).send({ message: "Audio chunk not found" });
      }

      try {
        await access(chunk.file_path);
      } catch {
        return reply.code(404).send({ message: "Audio chunk file is missing" });
      }

      reply.header("content-disposition", `attachment; filename="${chunk.id}.mp3"`);
      reply.header("accept-ranges", "bytes");
      return reply.type("audio/mpeg").send(createReadStream(chunk.file_path));
    }
  );
};
