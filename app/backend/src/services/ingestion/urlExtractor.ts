import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const URL_FETCH_TIMEOUT_MS = 12000;

export interface UrlExtractionResult {
  canonicalUrl: string;
  title: string;
  text: string;
  sourceHtml: string;
}

export class UrlExtractionError extends Error {
  readonly code: "URL_FETCH_FAILED" | "READABILITY_EXTRACTION_FAILED";

  constructor(code: "URL_FETCH_FAILED" | "READABILITY_EXTRACTION_FAILED", message: string, cause?: unknown) {
    super(message);
    this.code = code;
    this.name = "UrlExtractionError";
    if (cause) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

function validateInputUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UrlExtractionError("URL_FETCH_FAILED", "Invalid URL. Please provide a full http(s) URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UrlExtractionError("URL_FETCH_FAILED", "Only http(s) URLs are supported.");
  }

  return parsed.toString();
}

export async function extractReadableUrl(rawUrl: string): Promise<UrlExtractionResult> {
  const canonicalUrl = validateInputUrl(rawUrl);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(canonicalUrl, {
      signal: controller.signal,
      headers: {
        "user-agent": "tts-reader/0.1"
      }
    });
  } catch (error) {
    throw new UrlExtractionError(
      "URL_FETCH_FAILED",
      "Could not fetch this URL. Please copy and paste the article text manually.",
      error
    );
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    throw new UrlExtractionError(
      "URL_FETCH_FAILED",
      "Could not fetch this URL. Please copy and paste the article text manually."
    );
  }

  const sourceHtml = await response.text();
  const dom = new JSDOM(sourceHtml, { url: canonicalUrl });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  const text = article?.textContent?.trim() ?? "";
  if (text.length === 0) {
    throw new UrlExtractionError(
      "READABILITY_EXTRACTION_FAILED",
      "Could not extract readable text. Please copy and paste the article text manually."
    );
  }

  return {
    canonicalUrl,
    title: article?.title?.trim() || canonicalUrl,
    text,
    sourceHtml
  };
}
