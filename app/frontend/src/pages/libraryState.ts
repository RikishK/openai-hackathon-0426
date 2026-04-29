import type { DocumentChapter, SourceDocument } from "@tts-reader/shared";

export interface LibraryDocumentEntry {
  document: SourceDocument;
  chapters: DocumentChapter[];
  generatedChapterIds: string[];
}

export function upsertLibraryDocument(
  entries: LibraryDocumentEntry[],
  document: SourceDocument,
  chapters: DocumentChapter[]
): LibraryDocumentEntry[] {
  const withoutCurrent = entries.filter((entry) => entry.document.id !== document.id);
  const previousEntry = entries.find((entry) => entry.document.id === document.id);
  return [
    {
      document,
      chapters,
      generatedChapterIds: previousEntry?.generatedChapterIds ?? []
    },
    ...withoutCurrent
  ];
}

export function markGeneratedChapters(
  entries: LibraryDocumentEntry[],
  documentId: string,
  generatedChapterIds: string[]
): LibraryDocumentEntry[] {
  const dedupedChapterIds = [...new Set(generatedChapterIds)];

  return entries.map((entry) => {
    if (entry.document.id !== documentId) {
      return entry;
    }

    return {
      ...entry,
      generatedChapterIds: dedupedChapterIds
    };
  });
}
