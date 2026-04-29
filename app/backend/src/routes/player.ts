import type {
  PlayerParams,
  PlayerResponse,
  PlayerResumeRequest,
  PlayerResumeResponse
} from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { createReadStream } from "node:fs";
import type { ReadStream } from "node:fs";
import { once } from "node:events";
import { getStorageContext } from "../services/storage/db.js";

const DEFAULT_RESUME_POSITION_MS = 0;

interface PlayerChunkParams extends PlayerParams {
  chunkId: string;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}

async function createVerifiedAudioReadStream(filePath: string): Promise<ReadStream> {
  const stream = createReadStream(filePath);

  try {
    await once(stream, "open");
    return stream;
  } catch (error) {
    stream.destroy();
    throw error;
  }
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
      const stream = await createVerifiedAudioReadStream(chunk.file_path);
      reply.header("accept-ranges", "bytes");
      return reply.type("audio/mpeg").send(stream);
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") {
        return reply.code(404).send({ message: "Audio chunk file is missing" });
      }

      request.log.error({ error, documentId, chunkId }, "Unable to open audio chunk stream");
      return reply.code(500).send({ message: "Unable to open audio chunk stream" });
    }
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
        const stream = await createVerifiedAudioReadStream(chunk.file_path);
        reply.header("content-disposition", `attachment; filename="${chunk.id}.mp3"`);
        reply.header("accept-ranges", "bytes");
        return reply.type("audio/mpeg").send(stream);
      } catch (error) {
        if (isErrnoException(error) && error.code === "ENOENT") {
          return reply.code(404).send({ message: "Audio chunk file is missing" });
        }

        request.log.error({ error, documentId, chunkId }, "Unable to open audio chunk download stream");
        return reply.code(500).send({ message: "Unable to open audio chunk download stream" });
      }
    }
  );
};
