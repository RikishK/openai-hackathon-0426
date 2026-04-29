import type { IngestResponse, IngestTextRequest, IngestUrlRequest } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";

const defaultIngestResponse: IngestResponse = {
  document: {
    id: "doc_seed",
    title: "Seed Document",
    type: "text"
  },
  chapters: [{ id: "all", index: 0, title: "Full document" }],
  warnings: []
};

export const registerIngestRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: IngestTextRequest; Reply: IngestResponse }>(
    "/api/ingest/text",
    async (request) => ({
      ...defaultIngestResponse,
      document: {
        id: `doc_${Date.now()}`,
        title: request.body.title,
        type: "text"
      }
    })
  );

  app.post<{ Body: IngestUrlRequest; Reply: IngestResponse }>(
    "/api/ingest/url",
    async (request) => ({
      ...defaultIngestResponse,
      document: {
        id: `doc_${Date.now()}`,
        title: request.body.url,
        type: "url"
      }
    })
  );

  app.post<{ Reply: IngestResponse }>("/api/ingest/pdf", async () => ({
    ...defaultIngestResponse,
    document: {
      id: `doc_${Date.now()}`,
      title: "Uploaded PDF",
      type: "pdf"
    },
    chapters: [
      { id: "all", index: 0, title: "Full document" },
      { id: "ch_1", index: 1, title: "Chapter 1", startPage: 1, endPage: 16 }
    ]
  }));
};
