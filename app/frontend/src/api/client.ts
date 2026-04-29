import type {
  IngestPdfRequest,
  IngestResponse,
  IngestTextRequest,
  LibraryResponse,
  PlayerResponse,
  PlayerResumeRequest,
  PlayerResumeResponse
} from "@tts-reader/shared";

const API_BASE_URL = "/api";

interface ApiErrorPayload {
  message?: string;
}

async function parseResponseOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as ApiErrorPayload;
      if (typeof payload.message !== "string" || payload.message.trim().length === 0) {
        throw new Error(`Request failed with status ${response.status} and an invalid JSON error payload`);
      }

      throw new Error(payload.message);
    }

    throw new Error(`Request failed with status ${response.status} ${response.statusText}`.trim());
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

  return parseResponseOrThrow<IngestResponse>(response);
}

export async function ingestPdf(payload: IngestPdfRequest): Promise<IngestResponse> {
  const response = await fetch(`${API_BASE_URL}/ingest/pdf`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponseOrThrow<IngestResponse>(response);
}

export async function getLibrary(): Promise<LibraryResponse> {
  const response = await fetch(`${API_BASE_URL}/library`);
  return parseResponseOrThrow<LibraryResponse>(response);
}

export async function getPlayer(documentId: string): Promise<PlayerResponse> {
  const response = await fetch(`${API_BASE_URL}/player/${documentId}`);
  return parseResponseOrThrow<PlayerResponse>(response);
}

export async function savePlayerResume(
  documentId: string,
  payload: PlayerResumeRequest
): Promise<PlayerResumeResponse> {
  const response = await fetch(`${API_BASE_URL}/player/${documentId}/resume`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseResponseOrThrow<PlayerResumeResponse>(response);
}
