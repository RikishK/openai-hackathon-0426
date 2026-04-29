import type { DocumentChapter, SourceDocument } from "@tts-reader/shared";

export interface LibraryDocumentEntry {
  document: SourceDocument;
  chapters: DocumentChapter[];
}

export function upsertLibraryDocument(
  entries: LibraryDocumentEntry[],
  document: SourceDocument,
  chapters: DocumentChapter[]
): LibraryDocumentEntry[] {
  const withoutCurrent = entries.filter((entry) => entry.document.id !== document.id);
  return [{ document, chapters }, ...withoutCurrent];
}
