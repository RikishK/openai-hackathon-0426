import { useState } from "react";
import type { FormEvent } from "react";
import type { DocumentChapter, SourceDocument } from "@tts-reader/shared";
import { ingestPdf } from "../api/client";

interface IngestPageProps {
  onIngested: (document: SourceDocument, chapters: DocumentChapter[]) => void;
  onViewLibrary: () => void;
}

const MAX_PDF_BYTES = 20 * 1024 * 1024;

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];

    if (first === undefined) {
      break;
    }

    const firstChar = BASE64_ALPHABET[(first & 0b11111100) >> 2];
    if (firstChar === undefined) {
      throw new Error("Invalid base64 conversion state for first character");
    }

    if (second === undefined) {
      const secondChar = BASE64_ALPHABET[(first & 0b00000011) << 4];
      if (secondChar === undefined) {
        throw new Error("Invalid base64 conversion state for second character");
      }

      parts.push(`${firstChar}${secondChar}==`);
      continue;
    }

    const secondChar = BASE64_ALPHABET[((first & 0b00000011) << 4) | ((second & 0b11110000) >> 4)];
    if (secondChar === undefined) {
      throw new Error("Invalid base64 conversion state for second character");
    }

    if (third === undefined) {
      const thirdChar = BASE64_ALPHABET[(second & 0b00001111) << 2];
      if (thirdChar === undefined) {
        throw new Error("Invalid base64 conversion state for third character");
      }

      parts.push(`${firstChar}${secondChar}${thirdChar}=`);
      continue;
    }

    const thirdChar = BASE64_ALPHABET[((second & 0b00001111) << 2) | ((third & 0b11000000) >> 6)];
    const fourthChar = BASE64_ALPHABET[third & 0b00111111];
    if (thirdChar === undefined || fourthChar === undefined) {
      throw new Error("Invalid base64 conversion state for trailing characters");
    }

    parts.push(`${firstChar}${secondChar}${thirdChar}${fourthChar}`);
  }

  return parts.join("");
}

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return bytesToBase64(bytes);
}

export function IngestPage({ onIngested, onViewLibrary }: IngestPageProps) {
  const [title, setTitle] = useState("Uploaded PDF");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Select a PDF file to begin.");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detectedChapters, setDetectedChapters] = useState<DocumentChapter[]>([]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pdfFile) {
      setStatus("Select a PDF file before submitting.");
      return;
    }

    if (pdfFile.size > MAX_PDF_BYTES) {
      setStatus("Selected PDF exceeds the 20 MB upload limit.");
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setStatus("Enter a title before submitting.");
      return;
    }

    setIsSubmitting(true);
    setStatus("Uploading PDF and detecting chapters...");

    try {
      const pdfBase64 = await toBase64(pdfFile);
      const response = await ingestPdf({ title: trimmedTitle, pdfBase64 });
      setDetectedChapters(response.chapters);
      onIngested(response.document, response.chapters);
      setStatus(
        `Saved ${response.document.title} with ${response.chapters.length} detected chapter${response.chapters.length === 1 ? "" : "s"}.`
      );
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      console.error("Ingest request failed", error);
      setStatus(`Failed to submit ingest request: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const canViewLibrary = detectedChapters.length > 0;

  return (
    <section className="card stack" aria-labelledby="ingest-title">
      <h2 id="ingest-title">Ingest PDF</h2>
      <p>URL ingest is disabled for this PDF-first scope.</p>
      <form className="stack" onSubmit={handleSubmit}>
        <label className="stack">
          <span>Document title</span>
          <input
            onChange={(event) => setTitle(event.target.value)}
            value={title}
            disabled={isSubmitting}
            required
          />
        </label>
        <label className="stack">
          <span>PDF file</span>
          <input
            accept="application/pdf,.pdf"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              if (selected && selected.size > MAX_PDF_BYTES) {
                setPdfFile(null);
                setStatus("Selected PDF exceeds the 20 MB upload limit.");
                return;
              }

              setPdfFile(selected);
              if (selected) {
                setStatus("Ready to upload PDF.");
              }
            }}
            type="file"
            disabled={isSubmitting}
            required
          />
        </label>
        <p>PDF size limit: 20 MB.</p>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit PDF"}
        </button>
      </form>
      {detectedChapters.length > 0 ? (
        <section className="stack" aria-labelledby="detected-chapters-title">
          <h3 id="detected-chapters-title">Detected chapters</h3>
          <p>
            Chapter selection is read-only in this scope and will become actionable in the generation flow.
          </p>
          <div className="row">
            <button type="button" disabled>
              Select all
            </button>
            <button type="button" disabled>
              Clear
            </button>
          </div>
          <ul className="chapter-list">
            {detectedChapters.map((chapter) => (
              <li key={chapter.id}>
                <label className="chapter-option">
                  <input type="checkbox" defaultChecked disabled />
                  <span>
                    {chapter.index + 1}. {chapter.title}
                    {chapter.startPage !== undefined && chapter.endPage !== undefined
                      ? ` (pages ${chapter.startPage}-${chapter.endPage})`
                      : ""}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p>{status}</p>
      {canViewLibrary ? (
        <button type="button" onClick={onViewLibrary}>
          View in library
        </button>
      ) : null}
    </section>
  );
}
