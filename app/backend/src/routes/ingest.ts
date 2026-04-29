import type { IngestResponse, IngestTextRequest, IngestUrlRequest } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { persistDocumentSourceText } from "../services/ingestion/textIngest.js";
import { getStorageContext } from "../services/storage/db.js";

export const registerIngestRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: IngestTextRequest; Reply: IngestResponse }>(
    "/api/ingest/text",
    async (request) => {
      const storage = getStorageContext();
      const documentId = `doc_${randomUUID()}`;
      const chapterId = `ch_${randomUUID()}`;

      const document = storage.repositories.documents.create({
        id: documentId,
        title: request.body.title,
        type: "text"
      });

      const chapters = [
        {
          id: chapterId,
          index: 0,
          title: "Full document"
        }
      ];

      storage.repositories.chapters.createMany(
        chapters.map((chapter) => ({
          ...chapter,
          documentId,
          detectionMethod: "manual"
        }))
      );

      await persistDocumentSourceText(documentId, request.body.text);

      return {
        document,
        chapters,
        warnings: []
      };
    }
  );

  app.post<{ Body: IngestUrlRequest; Reply: IngestResponse | { error: string; message: string } }>(
    "/api/ingest/url",
    async (_, reply) => {
      return reply.code(501).send({
        error: "READABILITY_EXTRACTION_UNAVAILABLE",
        message: "URL ingestion requires Readability extraction and is not yet implemented"
      });
    }
  );

  app.post<{ Reply: IngestResponse | { error: string; message: string } }>("/api/ingest/pdf", async (_, reply) => {
    return reply.code(501).send({
      error: "PDF_EXTRACTION_UNAVAILABLE",
      message: "PDF ingestion is not yet implemented"
    });
  });
};
