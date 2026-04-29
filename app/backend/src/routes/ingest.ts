import type { IngestPdfRequest, IngestResponse, IngestTextRequest, IngestUrlRequest } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { detectPdfChapters } from "../services/ingestion/chapterDetector.js";
import { extractTextFromPdfBytes } from "../services/ingestion/pdfExtractor.js";
import { persistDocumentSourceText } from "../services/ingestion/textIngest.js";
import { getStorageContext } from "../services/storage/db.js";

const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

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

  app.post<{ Body: IngestPdfRequest; Reply: IngestResponse | { error: string; message: string } }>(
    "/api/ingest/pdf",
    async (request, reply) => {
      const trimmedTitle = request.body.title.trim();
      if (trimmedTitle.length === 0) {
        return reply.code(400).send({
          error: "INVALID_PDF_TITLE",
          message: "PDF ingestion requires a non-empty title"
        });
      }

      const base64Content = request.body.pdfBase64.trim();
      if (base64Content.length === 0) {
        return reply.code(400).send({
          error: "INVALID_PDF_PAYLOAD",
          message: "PDF ingestion requires a base64 payload"
        });
      }

      if (!BASE64_PATTERN.test(base64Content)) {
        return reply.code(400).send({
          error: "INVALID_PDF_PAYLOAD",
          message: "PDF payload is not valid base64"
        });
      }

      const pdfBytes = Buffer.from(base64Content, "base64");
      if (pdfBytes.length === 0) {
        return reply.code(400).send({
          error: "INVALID_PDF_PAYLOAD",
          message: "PDF payload is empty"
        });
      }

      let extractedPdf;
      try {
        extractedPdf = await extractTextFromPdfBytes(pdfBytes);
      } catch (error) {
        const extractionError = error instanceof Error ? error.message : "Unable to extract text from PDF payload";
        return reply.code(422).send({
          error: "PDF_EXTRACTION_FAILED",
          message: extractionError
        });
      }

      const chapterDetection = detectPdfChapters(extractedPdf.pages);
      const warnings = [...extractedPdf.warnings, ...chapterDetection.warnings];

      const storage = getStorageContext();
      const documentId = `doc_${randomUUID()}`;
      const document = storage.repositories.documents.create({
        id: documentId,
        title: trimmedTitle,
        type: "pdf"
      });

      const chaptersWithDetection = chapterDetection.chapters.map((chapter) => ({
        id: `ch_${randomUUID()}`,
        index: chapter.index,
        title: chapter.title,
        startPage: chapter.startPage,
        endPage: chapter.endPage,
        detectionMethod: chapter.detectionMethod
      }));

      storage.repositories.chapters.createMany(
        chaptersWithDetection.map((chapter) => ({
          id: chapter.id,
          documentId,
          index: chapter.index,
          title: chapter.title,
          startPage: chapter.startPage,
          endPage: chapter.endPage,
          detectionMethod: chapter.detectionMethod
        }))
      );

      const chapters = chaptersWithDetection.map((chapter) => ({
        id: chapter.id,
        index: chapter.index,
        title: chapter.title,
        startPage: chapter.startPage,
        endPage: chapter.endPage
      }));

      await persistDocumentSourceText(documentId, extractedPdf.text);

      return {
        document,
        chapters,
        warnings
      };
    }
  );
};
