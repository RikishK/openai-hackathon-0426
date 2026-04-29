import { useState } from "react";
import type { FormEvent } from "react";
import type { DocumentChapter, SourceDocument } from "@tts-reader/shared";
import { ingestPdf } from "../api/client";

interface IngestPageProps {
  onIngested: (document: SourceDocument, chapters: DocumentChapter[]) => void;
  onViewLibrary: () => void;
}

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

export function IngestPage({ onIngested, onViewLibrary }: IngestPageProps) {
  const [title, setTitle] = useState("Uploaded PDF");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [status, setStatus] = useState("Select a PDF file to begin.");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detectedChapters, setDetectedChapters] = useState<DocumentChapter[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pdfFile) {
      setStatus("Select a PDF file before submitting.");
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
      setSelectedChapterIds(response.chapters.map((chapter) => chapter.id));
      onIngested(response.document, response.chapters);
      setStatus(
        `Saved ${response.document.title} with ${response.chapters.length} detected chapter${response.chapters.length === 1 ? "" : "s"}.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown ingest error";
      console.error("Ingest request failed", error);
      setStatus(`Failed to submit ingest request: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleChapterSelection(chapterId: string) {
    setSelectedChapterIds((current) => {
      if (current.includes(chapterId)) {
        return current.filter((id) => id !== chapterId);
      }
      return [...current, chapterId];
    });
  }

  function selectAllChapters() {
    setSelectedChapterIds(detectedChapters.map((chapter) => chapter.id));
  }

  function clearChapterSelection() {
    setSelectedChapterIds([]);
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
              setPdfFile(selected);
            }}
            type="file"
            disabled={isSubmitting}
            required
          />
        </label>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit PDF"}
        </button>
      </form>
      {detectedChapters.length > 0 ? (
        <section className="stack" aria-labelledby="detected-chapters-title">
          <h3 id="detected-chapters-title">Detected chapters</h3>
          <p>
            {selectedChapterIds.length} of {detectedChapters.length} chapter
            {detectedChapters.length === 1 ? "" : "s"} selected.
          </p>
          <div className="row">
            <button type="button" onClick={selectAllChapters}>
              Select all
            </button>
            <button type="button" onClick={clearChapterSelection}>
              Clear
            </button>
          </div>
          <ul className="chapter-list">
            {detectedChapters.map((chapter) => (
              <li key={chapter.id}>
                <label className="chapter-option">
                  <input
                    type="checkbox"
                    checked={selectedChapterIds.includes(chapter.id)}
                    onChange={() => toggleChapterSelection(chapter.id)}
                  />
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
