export interface PdfExtractionResult {
  text: string;
  title: string | null;
  pageCount: number;
  outlineTitles: string[];
}

export class PdfExtractionError extends Error {
  readonly code: "PDF_EXTRACTION_FAILED";

  constructor(message: string, cause?: unknown) {
    super(message);
    this.code = "PDF_EXTRACTION_FAILED";
    this.name = "PdfExtractionError";
    if (cause) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

function decodePdfString(input: string): string {
  return input
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function extractPdfStrings(source: string): string[] {
  const direct: string[] = [];
  const directPattern = /\(([^()]*)\)\s*Tj/g;
  let directMatch: RegExpExecArray | null;
  while ((directMatch = directPattern.exec(source)) !== null) {
    const value = directMatch[1];
    if (!value) {
      continue;
    }
    direct.push(decodePdfString(value));
  }

  const batchedPattern = /\[(.*?)\]\s*TJ/gs;
  let batchedMatch: RegExpExecArray | null;
  while ((batchedMatch = batchedPattern.exec(source)) !== null) {
    const batch = batchedMatch[1];
    if (!batch) {
      continue;
    }
    const segmentPattern = /\(([^()]*)\)/g;
    let segmentMatch: RegExpExecArray | null;
    while ((segmentMatch = segmentPattern.exec(batch)) !== null) {
      const value = segmentMatch[1];
      if (!value) {
        continue;
      }
      direct.push(decodePdfString(value));
    }
  }

  return direct
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter((value) => value.length > 0);
}

function extractPdfTitle(source: string): string | null {
  const titleMatch = /\/Title\s*\(([^)]+)\)/.exec(source);
  if (!titleMatch) {
    return null;
  }

  const rawTitle = titleMatch[1];
  if (!rawTitle) {
    return null;
  }

  const title = decodePdfString(rawTitle).trim();
  return title.length > 0 ? title : null;
}

function extractOutlineTitles(source: string): string[] {
  const outlineMatches = source.matchAll(/\/Title\s*\(([^)]+)\)/g);
  const seen = new Set<string>();
  const titles: string[] = [];

  for (const match of outlineMatches) {
    const rawTitle = match[1];
    if (!rawTitle) {
      continue;
    }

    const decoded = decodePdfString(rawTitle).replace(/\s+/g, " ").trim();
    if (decoded.length === 0 || seen.has(decoded)) {
      continue;
    }
    seen.add(decoded);
    titles.push(decoded);
  }

  return titles.slice(0, 50);
}

export function extractPdfContent(buffer: Buffer): PdfExtractionResult {
  const source = buffer.toString("latin1");
  const pageCount = source.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
  const title = extractPdfTitle(source);
  const outlineTitles = extractOutlineTitles(source);
  const text = extractPdfStrings(source).join("\n").trim();

  if (text.length === 0) {
    throw new PdfExtractionError(
      "Could not extract text from this PDF. v1 supports text-based PDFs only (no OCR)."
    );
  }

  return {
    text,
    title,
    pageCount,
    outlineTitles
  };
}
