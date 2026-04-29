import type {
  IngestPdfRequest,
  IngestResponse,
  IngestTextRequest,
  LibraryResponse
} from "@tts-reader/shared";

const API_BASE_URL = "/api";

interface ApiErrorPayload {
  message?: string;
}

async function parseResponseOrThrow<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    let message = fallbackMessage;
    try {
      const payload = (await response.json()) as ApiErrorPayload;
      if (typeof payload.message === "string" && payload.message.length > 0) {
        message = payload.message;
      }
    } catch {
      message = fallbackMessage;
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function ingestText(payload: IngestTextRequest): Promise<IngestResponse> {
  const response = await fetch(`${API_BASE_URL}/ingest/text`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponseOrThrow<IngestResponse>(response, "Failed to ingest text payload");
}

export async function ingestPdf(payload: IngestPdfRequest): Promise<IngestResponse> {
  const response = await fetch(`${API_BASE_URL}/ingest/pdf`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponseOrThrow<IngestResponse>(response, "Failed to ingest PDF payload");
}

export async function getLibrary(): Promise<LibraryResponse> {
  const response = await fetch(`${API_BASE_URL}/library`);
  return parseResponseOrThrow<LibraryResponse>(response, "Failed to load library");
}
