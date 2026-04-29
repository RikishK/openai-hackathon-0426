import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { fileURLToPath } from "node:url";

const REPEATED_BLANK_LINES = /\n{3,}/g;
const STANDARD_FONT_DATA_URL = `${fileURLToPath(
  new URL("../../../../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url)
)}/`;

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedPdfDocument {
  text: string;
  pages: ExtractedPdfPage[];
  totalPages: number;
  warnings: string[];
}

function normalizeExtractedText(source: string): string {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(REPEATED_BLANK_LINES, "\n\n")
    .trim();
}

function isLikelyPdf(pdfBytes: Buffer): boolean {
  return pdfBytes.subarray(0, 5).toString("ascii") === "%PDF-";
}

function getPageText(items: unknown[]): string {
  return items
    .map((item) => {
      if (typeof item !== "object" || item === null || !("str" in item)) {
        return "";
      }

      const value = item.str;
      return typeof value === "string" ? value : "";
    })
    .join("\n");
}

export async function extractTextFromPdfBytes(pdfBytes: Buffer): Promise<ExtractedPdfDocument> {
  if (pdfBytes.length === 0) {
    throw new Error("PDF payload is empty");
  }

  if (!isLikelyPdf(pdfBytes)) {
    throw new Error("PDF payload is malformed or missing a valid PDF header");
  }

  try {
    const loadingTask = getDocument({
      data: new Uint8Array(pdfBytes),
      standardFontDataUrl: STANDARD_FONT_DATA_URL
    });

    const pdfDocument = await loadingTask.promise;
    const pages: ExtractedPdfPage[] = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = normalizeExtractedText(getPageText(textContent.items));

      if (pageText.length === 0) {
        continue;
      }

      pages.push({
        pageNumber,
        text: pageText
      });
    }

    const documentText = normalizeExtractedText(pages.map((page) => page.text).join("\n\n"));
    if (documentText.length === 0) {
      throw new Error("Unable to extract text from PDF payload");
    }

    return {
      text: documentText,
      pages,
      totalPages: pdfDocument.numPages,
      warnings: []
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Unable to extract text from PDF payload") {
      throw error;
    }

    throw new Error("Unable to extract text from PDF payload", {
      cause: error
    });
  }
}
