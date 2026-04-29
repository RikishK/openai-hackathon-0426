import Fastify from "fastify";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIngestRoutes } from "./ingest.js";
import { loadDocumentSourceText } from "../services/ingestion/textIngest.js";
import { getStorageContext, initializeStorage } from "../services/storage/db.js";

async function createPdfBase64(pages: string[]): Promise<string> {
  const pdfDocument = await PDFDocument.create();
  const font = await pdfDocument.embedFont(StandardFonts.Helvetica);

  for (const pageContent of pages) {
    const page = pdfDocument.addPage([612, 792]);
    if (pageContent.length === 0) {
      continue;
    }

    page.drawText(pageContent, {
      x: 48,
      y: 740,
      size: 12,
      font,
      lineHeight: 16,
      maxWidth: 520
    });
  }

  const bytes = await pdfDocument.save();
  return Buffer.from(bytes).toString("base64");
}

describe("ingest routes", () => {
  const app = Fastify();
  let tempDir = "";

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "tts-reader-ingest-"));

    await initializeStorage({
      dbPath: join(tempDir, "app.db"),
      dataDir: join(tempDir, "data"),
      migrationsDir: resolve(process.cwd(), "migrations")
    });

    await app.register(registerIngestRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    if (tempDir.length > 0) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("ingests a PDF payload and persists detected chapters", async () => {
    const pdfBase64 = await createPdfBase64(["Chapter 1 Intro\nFirst page text", "Chapter 2 Deep Dive\nSecond page text"]);

    const response = await app.inject({
      method: "POST",
      url: "/api/ingest/pdf",
      payload: {
        title: "Sample PDF",
        pdfBase64
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.document.type).toBe("pdf");
    expect(body.document.title).toBe("Sample PDF");
    expect(body.chapters).toHaveLength(2);
    expect(body.chapters[0]).toMatchObject({
      index: 0,
      title: "Chapter 1 Intro",
      startPage: 1,
      endPage: 1
    });
    expect(body.chapters[1]).toMatchObject({
      index: 1,
      title: "Chapter 2 Deep Dive",
      startPage: 2,
      endPage: 2
    });

    const persistedSourceText = await loadDocumentSourceText(body.document.id);
    expect(persistedSourceText).toContain("Chapter 1 Intro");
    expect(persistedSourceText).toContain("Chapter 2 Deep Dive");

    const persistedChapters = getStorageContext().repositories.chapters.listByDocumentId(body.document.id);
    expect(persistedChapters).toHaveLength(2);
  });

  it("uses actual PDF page count for the final chapter end page", async () => {
    const pdfBase64 = await createPdfBase64(["Chapter 1 Intro\nFirst page text", "Chapter 2 Deep Dive\nSecond page text", ""]);

    const response = await app.inject({
      method: "POST",
      url: "/api/ingest/pdf",
      payload: {
        title: "Sparse pages PDF",
        pdfBase64
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.chapters).toHaveLength(2);
    expect(body.chapters[1]).toMatchObject({
      startPage: 2,
      endPage: 3
    });
  });

  it("returns 400 when title is not a string", async () => {
    const pdfBase64 = await createPdfBase64(["Chapter 1 Intro\nFirst page text"]);

    const response = await app.inject({
      method: "POST",
      url: "/api/ingest/pdf",
      payload: {
        title: 42,
        pdfBase64
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "INVALID_PDF_TITLE"
    });
  });

  it("returns 400 when pdfBase64 is not a string", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/ingest/pdf",
      payload: {
        title: "Sample PDF",
        pdfBase64: 12345
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "INVALID_PDF_PAYLOAD"
    });
  });

  it("returns 400 for malformed base64 payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/ingest/pdf",
      payload: {
        title: "Bad PDF",
        pdfBase64: "not-base64!!!"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "INVALID_PDF_PAYLOAD"
    });
  });

  it("returns 422 when payload is base64 but not a valid PDF", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/ingest/pdf",
      payload: {
        title: "Bad PDF",
        pdfBase64: Buffer.from("plain text", "utf8").toString("base64")
      }
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: "PDF_EXTRACTION_FAILED"
    });
  });

  it("returns no chapters when chapter headings are not detected", async () => {
    const pdfBase64 = await createPdfBase64(["Introduction content only", "More body content only"]);

    const response = await app.inject({
      method: "POST",
      url: "/api/ingest/pdf",
      payload: {
        title: "No headings",
        pdfBase64
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.chapters).toHaveLength(0);
    expect(body.warnings).toContain("No chapter headings were detected in the PDF");
  });

  it("returns 501 for URL ingestion", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/ingest/url",
      payload: { url: "https://example.com/article" }
    });

    expect(response.statusCode).toBe(501);
    expect(response.json()).toMatchObject({
      error: "READABILITY_EXTRACTION_UNAVAILABLE"
    });
  });
});
