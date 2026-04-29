import { afterEach, describe, expect, it, vi } from "vitest";
import { ingestPdf } from "./client";

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
