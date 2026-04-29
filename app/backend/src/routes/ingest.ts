import type { IngestResponse, IngestTextRequest, IngestUrlRequest } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
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

      return {
        document,
        chapters,
        warnings: []
      };
    }
  );

  app.post<{ Body: IngestUrlRequest; Reply: IngestResponse }>(
    "/api/ingest/url",
    async (request) => {
      const storage = getStorageContext();
      const documentId = `doc_${randomUUID()}`;
      const chapterId = `ch_${randomUUID()}`;

      const document = storage.repositories.documents.create({
        id: documentId,
        title: request.body.url,
        type: "url"
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
          detectionMethod: "readability"
        }))
      );

      return {
        document,
        chapters,
        warnings: []
      };
    }
  );

  app.post<{ Reply: IngestResponse }>("/api/ingest/pdf", async () => {
    const storage = getStorageContext();
    const documentId = `doc_${randomUUID()}`;

    const document = storage.repositories.documents.create({
      id: documentId,
      title: "Uploaded PDF",
      type: "pdf"
    });

    const chapters = [
      { id: `ch_${randomUUID()}`, index: 0, title: "Full document" },
      { id: `ch_${randomUUID()}`, index: 1, title: "Chapter 1", startPage: 1, endPage: 16 }
    ];

    storage.repositories.chapters.createMany(
      chapters.map((chapter) => ({
        ...chapter,
        documentId,
        detectionMethod: "placeholder"
      }))
    );

    return {
      document,
      chapters,
      warnings: []
    };
  });
};
