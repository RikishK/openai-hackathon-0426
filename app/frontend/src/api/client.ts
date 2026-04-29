import type { IngestResponse, IngestTextRequest } from "@tts-reader/shared";

const API_BASE_URL = "http://localhost:4310/api";

export async function ingestText(payload: IngestTextRequest): Promise<IngestResponse> {
  const response = await fetch(`${API_BASE_URL}/ingest/text`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Failed to ingest text payload");
  }

  return (await response.json()) as IngestResponse;
}
