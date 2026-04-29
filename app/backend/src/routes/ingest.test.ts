import Fastify from "fastify";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerIngestRoutes } from "./ingest.js";
import { loadDocumentSourceText } from "../services/ingestion/textIngest.js";
import { getStorageContext, initializeStorage } from "../services/storage/db.js";

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
    const pdfText = ["Chapter 1 Intro", "First page text", "\f", "Chapter 2 Deep Dive", "Second page text"].join(
      "\n"
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/ingest/pdf",
      payload: {
        title: "Sample PDF",
        pdfBase64: Buffer.from(pdfText, "utf8").toString("base64")
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
