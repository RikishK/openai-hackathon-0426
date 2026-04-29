import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateGeneration, generateAudio, getGenerationJob, ingestPdf } from "./client";

describe("ingestPdf", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts PDF payload and returns ingest response", async () => {
    const payload = {
      title: "Handbook",
      pdfBase64: "YWJj"
    };

    const mockResponse = {
      document: { id: "doc_1", title: "Handbook", type: "pdf" as const },
      chapters: [{ id: "ch_1", index: 0, title: "Intro" }],
      warnings: []
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const response = await ingestPdf(payload);

    expect(fetchMock).toHaveBeenCalledWith("/api/ingest/pdf", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    expect(response).toEqual(mockResponse);
  });

  it("surfaces backend error message for failed responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "PDF payload is not valid base64" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      })
    );

    await expect(ingestPdf({ title: "Bad", pdfBase64: "###" })).rejects.toThrow(
      "PDF payload is not valid base64"
    );
  });
});

describe("generation endpoints", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts chapter scope to estimate endpoint", async () => {
    const payload = {
      documentId: "doc_1",
      chapterScope: {
        mode: "selected" as const,
        chapterIds: ["ch_1", "ch_3"]
      },
      profile: {
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        speed: 1
      }
    };

    const mockResponse = {
      estimatedChars: 12000,
      estimatedTokens: 3158,
      estimatedCostUsd: 0.24,
      cacheHitPercent: 20,
      warnings: []
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const response = await estimateGeneration(payload);

    expect(fetchMock).toHaveBeenCalledWith("/api/estimate", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    expect(response).toEqual(mockResponse);
  });

  it("posts confirmed generate payload and returns queued job", async () => {
    const payload = {
      documentId: "doc_1",
      chapterScope: {
        mode: "all" as const,
        chapterIds: []
      },
      profile: {
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        speed: 1
      },
      confirmedEstimate: true
    };

    const mockResponse = {
      jobId: "job_123",
      state: "queued" as const
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const response = await generateAudio(payload);

    expect(fetchMock).toHaveBeenCalledWith("/api/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    expect(response).toEqual(mockResponse);
  });

  it("gets job status for polling", async () => {
    const mockResponse = {
      jobId: "job_123",
      state: "processing" as const,
      progress: 42
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const response = await getGenerationJob("job_123");

    expect(fetchMock).toHaveBeenCalledWith("/api/jobs/job_123");
    expect(response).toEqual(mockResponse);
  });
});
