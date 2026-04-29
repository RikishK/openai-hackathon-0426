import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

const URL_FETCH_TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 5;

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

function isBlockedIpv4(address: string): boolean {
  const octets = address.split(".").map((segment) => Number.parseInt(segment, 10));
  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return true;
  }

  const a = octets[0] ?? -1;
  const b = octets[1] ?? -1;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") {
    return true;
  }

  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }

  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  const mappedV4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedV4?.[1]) {
    return isBlockedIpv4(mappedV4[1]);
  }

  return false;
}

function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return isBlockedIpv4(address);
  }

  if (version === 6) {
    return isBlockedIpv6(address);
  }

  return true;
}

interface PinnedTarget {
  address: string;
  family: 4 | 6;
}

async function resolveSafeUrlTarget(url: URL): Promise<PinnedTarget> {
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new UrlExtractionError(
      "URL_FETCH_FAILED",
      "This URL target is not allowed for security reasons. Please copy and paste the article text manually."
    );
  }

  const literalVersion = isIP(hostname);
  if (literalVersion !== 0) {
    if (isBlockedAddress(hostname)) {
      throw new UrlExtractionError(
        "URL_FETCH_FAILED",
        "This URL target is not allowed for security reasons. Please copy and paste the article text manually."
      );
    }

    if (literalVersion !== 4 && literalVersion !== 6) {
      throw new UrlExtractionError(
        "URL_FETCH_FAILED",
        "Could not resolve this URL host. Please copy and paste the article text manually."
      );
    }

    return {
      address: hostname,
      family: literalVersion
    };
  }

  let resolved;
  try {
    resolved = await lookup(hostname, { all: true, verbatim: true });
  } catch (error) {
    throw new UrlExtractionError(
      "URL_FETCH_FAILED",
      "Could not resolve this URL host. Please copy and paste the article text manually.",
      error
    );
  }

  if (resolved.length === 0 || resolved.some((entry) => isBlockedAddress(entry.address))) {
    throw new UrlExtractionError(
      "URL_FETCH_FAILED",
      "This URL target is not allowed for security reasons. Please copy and paste the article text manually."
    );
  }

  const selected = resolved[0];
  if (!selected || (selected.family !== 4 && selected.family !== 6)) {
    throw new UrlExtractionError(
      "URL_FETCH_FAILED",
      "Could not resolve this URL host. Please copy and paste the article text manually."
    );
  }

  return {
    address: selected.address,
    family: selected.family
  };
}

async function validateInputUrl(rawUrl: string): Promise<string> {
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

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

interface FetchHtmlResult {
  canonicalUrl: string;
  sourceHtml: string;
}

async function fetchWithValidatedRedirects(initialUrl: string, signal: AbortSignal): Promise<FetchHtmlResult> {
  const visited = new Set<string>();
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (visited.has(currentUrl)) {
      throw new UrlExtractionError(
        "URL_FETCH_FAILED",
        "Could not fetch this URL due to a redirect loop. Please copy and paste the article text manually."
      );
    }

    visited.add(currentUrl);

    const pinnedTarget = await resolveSafeUrlTarget(new URL(currentUrl));
    const agent = new Agent({
      connect: {
        lookup: (_hostname, _options, callback) => {
          callback(null, pinnedTarget.address, pinnedTarget.family);
        }
      }
    });

    let response;
    try {
      response = await undiciFetch(currentUrl, {
        signal,
        redirect: "manual",
        dispatcher: agent,
        headers: {
          "user-agent": "tts-reader/0.1"
        }
      });
    } catch (error) {
      await agent.close();
      throw new UrlExtractionError(
        "URL_FETCH_FAILED",
        "Could not fetch this URL. Please copy and paste the article text manually.",
        error
      );
    }

    if (isRedirectStatus(response.status)) {
      if (redirectCount >= MAX_REDIRECTS) {
        await response.body?.cancel();
        await agent.close();
        throw new UrlExtractionError(
          "URL_FETCH_FAILED",
          "Could not fetch this URL due to too many redirects. Please copy and paste the article text manually."
        );
      }

      const location = response.headers.get("location");
      if (!location) {
        await response.body?.cancel();
        await agent.close();
        throw new UrlExtractionError(
          "URL_FETCH_FAILED",
          "Could not fetch this URL because a redirect target is missing. Please copy and paste the article text manually."
        );
      }

      let nextUrl: URL;
      try {
        nextUrl = new URL(location, currentUrl);
      } catch (error) {
        await response.body?.cancel();
        await agent.close();
        throw new UrlExtractionError(
          "URL_FETCH_FAILED",
          "Could not fetch this URL because a redirect target is invalid. Please copy and paste the article text manually.",
          error
        );
      }

      if (nextUrl.protocol !== "http:" && nextUrl.protocol !== "https:") {
        await response.body?.cancel();
        await agent.close();
        throw new UrlExtractionError(
          "URL_FETCH_FAILED",
          "Could not fetch this URL because a redirect target is not http(s). Please copy and paste the article text manually."
        );
      }

      await response.body?.cancel();
      await agent.close();
      currentUrl = nextUrl.toString();
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      await agent.close();
      throw new UrlExtractionError(
        "URL_FETCH_FAILED",
        "Could not fetch this URL. Please copy and paste the article text manually."
      );
    }

    let sourceHtml: string;
    try {
      sourceHtml = await response.text();
    } catch (error) {
      await agent.close();
      throw new UrlExtractionError(
        "READABILITY_EXTRACTION_FAILED",
        "Could not extract readable text. Please copy and paste the article text manually.",
        error
      );
    }

    await agent.close();
    return {
      canonicalUrl: response.url || currentUrl,
      sourceHtml
    };
  }

  throw new UrlExtractionError(
    "URL_FETCH_FAILED",
    "Could not fetch this URL. Please copy and paste the article text manually."
  );
}

export async function extractReadableUrl(rawUrl: string): Promise<UrlExtractionResult> {
  const initialUrl = await validateInputUrl(rawUrl);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);

  try {
    const { canonicalUrl, sourceHtml } = await fetchWithValidatedRedirects(initialUrl, controller.signal);

    let article: ReturnType<Readability["parse"]>;
    try {
      const dom = new JSDOM(sourceHtml, { url: canonicalUrl });
      const reader = new Readability(dom.window.document);
      article = reader.parse();
    } catch (error) {
      throw new UrlExtractionError(
        "READABILITY_EXTRACTION_FAILED",
        "Could not extract readable text. Please copy and paste the article text manually.",
        error
      );
    }

    const text = article?.textContent?.trim() ?? "";
    const title = article?.title?.trim() ?? "";
    if (text.length === 0) {
      throw new UrlExtractionError(
        "READABILITY_EXTRACTION_FAILED",
        "Could not extract readable text. Please copy and paste the article text manually."
      );
    }

    if (title.length === 0) {
      throw new UrlExtractionError(
        "READABILITY_EXTRACTION_FAILED",
        "Could not extract a readable article title. Please copy and paste the article text manually."
      );
    }

    return {
      canonicalUrl,
      title,
      text,
      sourceHtml
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}
