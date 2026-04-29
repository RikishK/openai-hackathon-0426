const REPEATED_BLANK_LINES = /\n{3,}/g;

function stripNonPrintableCharacters(source: string): string {
  let normalized = "";
  for (const character of source) {
    const code = character.charCodeAt(0);
    const isTab = code === 9;
    const isLineBreak = code === 10 || code === 13;
    const isPrintableAscii = code >= 32 && code <= 126;

    normalized += isTab || isLineBreak || isPrintableAscii ? character : " ";
  }

  return normalized;
}

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedPdfDocument {
  text: string;
  pages: ExtractedPdfPage[];
  warnings: string[];
}

function normalizeExtractedText(source: string): string {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .split("\n")
    .map((line) => stripNonPrintableCharacters(line).trimEnd())
    .join("\n")
    .replace(REPEATED_BLANK_LINES, "\n\n")
    .trim();
}

function splitPages(source: string): string[] {
  if (source.includes("\f")) {
    return source
      .split("\f")
      .map((page) => page.trim())
      .filter((page) => page.length > 0);
  }

  return [source];
}

export function extractTextFromPdfBytes(pdfBytes: Buffer): ExtractedPdfDocument {
  if (pdfBytes.length === 0) {
    throw new Error("PDF payload is empty");
  }

  const decodedSource = pdfBytes.toString("utf8");
  const normalizedPages = splitPages(decodedSource)
    .map((pageText) => normalizeExtractedText(pageText))
    .filter((pageText) => pageText.length > 0);

  const normalizedDocumentText = normalizedPages.join("\n\n").trim();
  if (normalizedDocumentText.length === 0) {
    throw new Error("Unable to extract text from PDF payload");
  }

  const warnings: string[] = [];
  if (!decodedSource.includes("\f")) {
    warnings.push("PDF page boundaries were not detected; chapter detection used whole-document text");
  }

  const pages = normalizedPages.map((pageText, pageIndex) => ({
    pageNumber: pageIndex + 1,
    text: pageText
  }));

  return {
    text: normalizedDocumentText,
    pages,
    warnings
  };
}
