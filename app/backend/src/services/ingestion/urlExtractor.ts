import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

const URL_FETCH_TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 5;

interface UrlExtractorDependencies {
  fetchImpl?: typeof undiciFetch;
  lookupImpl?: typeof lookup;
}

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

function parseIpv4Address(address: string): number | null {
  const octets = address.split(".").map((segment) => Number.parseInt(segment, 10));
  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return null;
  }

  return ((octets[0] ?? 0) << 24) + ((octets[1] ?? 0) << 16) + ((octets[2] ?? 0) << 8) + (octets[3] ?? 0);
}

function isGlobalUnicastIpv4(address: string): boolean {
  const numeric = parseIpv4Address(address);
  if (numeric === null) {
    return false;
  }

  const a = (numeric >>> 24) & 0xff;
  const b = (numeric >>> 16) & 0xff;
  const c = (numeric >>> 8) & 0xff;
  const d = numeric & 0xff;

  if (a === 0 || a === 10 || a === 127) {
    return false;
  }

  if (a === 100 && b >= 64 && b <= 127) {
    return false;
  }

  if (a === 169 && b === 254) {
    return false;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return false;
  }

  if (a === 192 && b === 168) {
    return false;
  }

  if (a === 192 && b === 0 && c === 2) {
    return false;
  }

  if (a === 192 && b === 0 && c === 0 && (d >= 0 && d <= 8)) {
    return false;
  }

  if (a === 192 && b === 0 && c === 0 && d !== 9 && d !== 10) {
    return false;
  }

  if (a === 192 && b === 88 && c === 99) {
    return false;
  }

  if (a === 198 && (b === 18 || b === 19)) {
    return false;
  }

  if (a === 198 && b === 51 && c === 100) {
    return false;
  }

  if (a === 203 && b === 0 && c === 113) {
    return false;
  }

  if (a >= 224) {
    return false;
  }

  if (a === 255 && b === 255 && c === 255 && d === 255) {
    return false;
  }

  return true;
}

function parseIpv6Segments(address: string): number[] | null {
  if (address.includes("%")) {
    return null;
  }

  const doubleColonIndex = address.indexOf("::");
  if (doubleColonIndex !== -1 && address.indexOf("::", doubleColonIndex + 1) !== -1) {
    return null;
  }

  const parseSide = (side: string): number[] | null => {
    if (side.length === 0) {
      return [];
    }

    const tokens = side.split(":");
    const values: number[] = [];
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (!token) {
        return null;
      }

      if (token.includes(".")) {
        if (index !== tokens.length - 1) {
          return null;
        }
        const ipv4 = parseIpv4Address(token);
        if (ipv4 === null) {
          return null;
        }
        values.push((ipv4 >>> 16) & 0xffff, ipv4 & 0xffff);
        continue;
      }

      if (!/^[0-9a-fA-F]{1,4}$/.test(token)) {
        return null;
      }

      values.push(Number.parseInt(token, 16));
    }

    return values;
  };

  if (doubleColonIndex === -1) {
    const full = parseSide(address);
    if (!full || full.length !== 8) {
      return null;
    }
    return full;
  }

  const left = parseSide(address.slice(0, doubleColonIndex));
  const right = parseSide(address.slice(doubleColonIndex + 2));
  if (!left || !right) {
    return null;
  }

  const missing = 8 - (left.length + right.length);
  if (missing < 1) {
    return null;
  }

  return [...left, ...new Array<number>(missing).fill(0), ...right];
}

function isGlobalUnicastIpv6(address: string): boolean {
  const segments = parseIpv6Segments(address.toLowerCase());
  if (!segments) {
    return false;
  }

  if ((segments[0] ?? 0) === 0 && (segments[1] ?? 0) === 0 && (segments[2] ?? 0) === 0 && (segments[3] ?? 0) === 0 && (segments[4] ?? 0) === 0 && (segments[5] ?? 0) === 0xffff) {
    const mapped = `${((segments[6] ?? 0) >>> 8) & 0xff}.${(segments[6] ?? 0) & 0xff}.${((segments[7] ?? 0) >>> 8) & 0xff}.${(segments[7] ?? 0) & 0xff}`;
    return isGlobalUnicastIpv4(mapped);
  }

  const first = segments[0] ?? 0;
  if (first === 0) {
    return false;
  }

  if ((first & 0xfe00) === 0xfc00) {
    return false;
  }

  if ((first & 0xffc0) === 0xfe80) {
    return false;
  }

  if ((first & 0xff00) === 0xff00) {
    return false;
  }

  if ((first & 0xe000) !== 0x2000) {
    return false;
  }

  if ((segments[0] ?? 0) === 0x2001 && (segments[1] ?? 0) === 0x0db8) {
    return false;
  }

  if ((segments[0] ?? 0) === 0x2001 && (segments[1] ?? 0) === 0x0000) {
    return false;
  }

  if (
    (segments[0] ?? 0) === 0x2001 &&
    (segments[1] ?? 0) === 0x0002 &&
    (segments[2] ?? 0) === 0x0000
  ) {
    return false;
  }

  if ((segments[0] ?? 0) === 0x2002) {
    return false;
  }

  if ((segments[0] ?? 0) === 0x2001 && ((segments[1] ?? 0) & 0xfff0) === 0x0010) {
    return false;
  }

  if ((segments[0] ?? 0) === 0x2001 && ((segments[1] ?? 0) & 0xfff0) === 0x0020) {
    return false;
  }

  return true;
}

export function isGlobalUnicastAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return isGlobalUnicastIpv4(address);
  }

  if (version === 6) {
    return isGlobalUnicastIpv6(address);
  }

  return false;
}

interface LookupEntry {
  address: string;
  family: number;
}

function getUnsafeTargetError(): UrlExtractionError {
  return new UrlExtractionError(
    "URL_FETCH_FAILED",
    "This URL target is not allowed for security reasons. Please copy and paste the article text manually."
  );
}

export function selectPinnedTarget(resolved: LookupEntry[]): PinnedTarget {
  if (resolved.length === 0) {
    throw getUnsafeTargetError();
  }

  for (const entry of resolved) {
    if (!isGlobalUnicastAddress(entry.address)) {
      throw getUnsafeTargetError();
    }
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

interface PinnedTarget {
  address: string;
  family: 4 | 6;
}

async function resolveSafeUrlTarget(url: URL, lookupImpl: typeof lookup): Promise<PinnedTarget> {
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw getUnsafeTargetError();
  }

  const literalVersion = isIP(hostname);
  if (literalVersion !== 0) {
    if (!isGlobalUnicastAddress(hostname)) {
      throw getUnsafeTargetError();
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
    resolved = await lookupImpl(hostname, { all: true, verbatim: true });
  } catch (error) {
    throw new UrlExtractionError(
      "URL_FETCH_FAILED",
      "Could not resolve this URL host. Please copy and paste the article text manually.",
      error
    );
  }

  return selectPinnedTarget(resolved);
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

async function fetchWithValidatedRedirects(
  initialUrl: string,
  signal: AbortSignal,
  deps: Required<UrlExtractorDependencies>
): Promise<FetchHtmlResult> {
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

    const pinnedTarget = await resolveSafeUrlTarget(new URL(currentUrl), deps.lookupImpl);
    const agent = new Agent({
      connect: {
        lookup: (_hostname, _options, callback) => {
          callback(null, pinnedTarget.address, pinnedTarget.family);
        }
      }
    });

    let response;
    try {
      response = await deps.fetchImpl(currentUrl, {
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
    if (!response.url) {
      throw new UrlExtractionError(
        "URL_FETCH_FAILED",
        "Could not determine the fetched URL. Please copy and paste the article text manually."
      );
    }

    return {
      canonicalUrl: response.url,
      sourceHtml
    };
  }

  throw new UrlExtractionError(
    "URL_FETCH_FAILED",
    "Could not fetch this URL. Please copy and paste the article text manually."
  );
}

export async function extractReadableUrl(rawUrl: string): Promise<UrlExtractionResult> {
  return extractReadableUrlWithDeps(rawUrl);
}

export async function extractReadableUrlWithDeps(
  rawUrl: string,
  deps: UrlExtractorDependencies = {}
): Promise<UrlExtractionResult> {
  const resolvedDeps: Required<UrlExtractorDependencies> = {
    fetchImpl: deps.fetchImpl ?? undiciFetch,
    lookupImpl: deps.lookupImpl ?? lookup
  };

  const initialUrl = await validateInputUrl(rawUrl);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);

  try {
    const { canonicalUrl, sourceHtml } = await fetchWithValidatedRedirects(
      initialUrl,
      controller.signal,
      resolvedDeps
    );

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
