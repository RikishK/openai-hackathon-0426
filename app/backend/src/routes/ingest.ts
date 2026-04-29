import type { IngestResponse, IngestTextRequest, IngestUrlRequest } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname } from "node:path";
import { detectPdfChapters } from "../services/ingestion/chapterDetector.js";
import { extractPdfContent, PdfExtractionError } from "../services/ingestion/pdfExtractor.js";
import {
  persistTextSource,
  prepareTextIngest,
  TextIngestValidationError
} from "../services/ingestion/textIngest.js";
import { extractReadableUrl, UrlExtractionError } from "../services/ingestion/urlExtractor.js";
import { getStorageContext } from "../services/storage/db.js";

const SOFT_TEXT_LIMIT_CHARS = 250_000;
const SOFT_PDF_LIMIT_BYTES = 20 * 1024 * 1024;

interface IngestErrorReply {
  error: string;
  message: string;
}

function hashString(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hashBuffer(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function formatLargeTextWarning(charCount: number): string {
  return `Large text (${charCount.toLocaleString()} characters): generation may be slow.`;
}

function formatLargeFileWarning(fileSizeBytes: number): string {
  const sizeInMb = (fileSizeBytes / (1024 * 1024)).toFixed(1);
  return `Large file (${sizeInMb} MB): generation may be slow.`;
}

function maybeLargeTextWarning(charCount: number): string[] {
  if (charCount <= SOFT_TEXT_LIMIT_CHARS) {
    return [];
  }

  return [formatLargeTextWarning(charCount)];
}

async function persistBinarySource(path: string, data: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

export const registerIngestRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: IngestTextRequest; Reply: IngestResponse | IngestErrorReply }>(
    "/api/ingest/text",
    async (request, reply) => {
      const storage = getStorageContext();
      let prepared;

      try {
        prepared = prepareTextIngest({
          title: request.body.title,
          text: request.body.text
        });
      } catch (error) {
        if (error instanceof TextIngestValidationError) {
          return reply.code(400).send({
            error: error.code,
            message: error.message
          });
        }

        throw error;
      }

      const documentId = `doc_${randomUUID()}`;
      const chapterId = `ch_${randomUUID()}`;

      const document = storage.repositories.documents.create({
        id: documentId,
        title: prepared.title,
        type: "text",
        sourceHash: hashString(`${prepared.title}\n${prepared.text}`),
        rawTextHash: hashString(prepared.text)
      });

      await persistTextSource(storage.fileStore, documentId, prepared.text);

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
        warnings: maybeLargeTextWarning(prepared.text.length)
      };
    }
  );

  app.post<{ Body: IngestUrlRequest; Reply: IngestResponse | IngestErrorReply }>(
    "/api/ingest/url",
    async (request, reply) => {
      const storage = getStorageContext();
      let extracted;

      try {
        extracted = await extractReadableUrl(request.body.url);
      } catch (error) {
        if (error instanceof UrlExtractionError) {
          return reply.code(422).send({
            error: error.code,
            message: error.message
          });
        }
        throw error;
      }

      const documentId = `doc_${randomUUID()}`;
      const chapterId = `ch_${randomUUID()}`;

      const document = storage.repositories.documents.create({
        id: documentId,
        title: extracted.title,
        type: "url",
        sourceHash: hashString(extracted.canonicalUrl),
        rawTextHash: hashString(extracted.text)
      });

      await persistTextSource(storage.fileStore, documentId, extracted.text);
      const sourceHtmlPath = storage.fileStore.getDocumentSourcePath(documentId, "html");
      await mkdir(dirname(sourceHtmlPath), { recursive: true });
      await writeFile(sourceHtmlPath, extracted.sourceHtml, "utf8");

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
        warnings: maybeLargeTextWarning(extracted.text.length)
      };
    }
  );

  app.post<{ Reply: IngestResponse | IngestErrorReply }>("/api/ingest/pdf", async (request, reply) => {
    const storage = getStorageContext();
    const uploaded = await request.file();

    if (!uploaded) {
      return reply.code(400).send({
        error: "PDF_FILE_REQUIRED",
        message: "Attach a PDF file in multipart form data using the `file` field."
      });
    }

    const filename = uploaded.filename ?? "uploaded.pdf";
    const extension = extname(filename).toLowerCase();
    if (uploaded.mimetype !== "application/pdf" && extension !== ".pdf") {
      return reply.code(400).send({
        error: "UNSUPPORTED_FILE_TYPE",
        message: "Only PDF uploads are supported."
      });
    }

    const data = await uploaded.toBuffer();
    const warnings = data.byteLength > SOFT_PDF_LIMIT_BYTES ? [formatLargeFileWarning(data.byteLength)] : [];

    let extracted;
    try {
      extracted = extractPdfContent(data);
    } catch (error) {
      if (error instanceof PdfExtractionError) {
        return reply.code(422).send({
          error: error.code,
          message: error.message
        });
      }
      throw error;
    }

    const documentId = `doc_${randomUUID()}`;
    const sourcePath = storage.fileStore.getDocumentSourcePath(documentId, "pdf");
    await persistBinarySource(sourcePath, data);

    await persistTextSource(storage.fileStore, documentId, extracted.text);

    const detection = detectPdfChapters({
      text: extracted.text,
      outlineTitles: extracted.outlineTitles,
      pageCount: extracted.pageCount
    });
    const chapters = detection.chapters.map((chapter) => {
      const outputChapter: IngestResponse["chapters"][number] = {
        id: `ch_${randomUUID()}`,
        index: chapter.index,
        title: chapter.title
      };
      if (typeof chapter.startPage === "number") {
        outputChapter.startPage = chapter.startPage;
      }
      if (typeof chapter.endPage === "number") {
        outputChapter.endPage = chapter.endPage;
      }

      return outputChapter;
    });

    const document = storage.repositories.documents.create({
      id: documentId,
      title: extracted.title ?? (basename(filename, extname(filename)) || "Uploaded PDF"),
      type: "pdf",
      sourceHash: hashBuffer(data),
      rawTextHash: hashString(extracted.text)
    });

    storage.repositories.chapters.createMany(
      chapters.map((chapter) => {
        const createInput = {
          id: chapter.id,
          documentId,
          index: chapter.index,
          title: chapter.title,
          detectionMethod: detection.detectionMethod
        } as const;

        if (typeof chapter.startPage === "number" && typeof chapter.endPage === "number") {
          return {
            ...createInput,
            startPage: chapter.startPage,
            endPage: chapter.endPage
          };
        }

        return createInput;
      })
    );

    return {
      document,
      chapters,
      warnings: [...warnings, ...maybeLargeTextWarning(extracted.text.length)]
    };
  });
};
