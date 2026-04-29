import type { DocumentChapter } from "@tts-reader/shared";
import type { DatabaseSync } from "node:sqlite";
import { getDbRows, nowIso } from "./shared.js";

interface DocumentChapterRow {
  id: string;
  chapter_index: number;
  title: string;
  start_page: number | null;
  end_page: number | null;
}

export interface CreateDocumentChapterInput {
  id: string;
  documentId: string;
  index: number;
  title: string;
  startPage?: number;
  endPage?: number;
  startChar?: number;
  endChar?: number;
  detectionMethod?: string;
}

export interface ChaptersRepository {
  createMany(chapters: CreateDocumentChapterInput[]): void;
  listByDocumentId(documentId: string): DocumentChapter[];
}

function toDocumentChapter(row: DocumentChapterRow): DocumentChapter {
  const chapter: DocumentChapter = {
    id: row.id,
    index: row.chapter_index,
    title: row.title
  };

  if (row.start_page !== null) {
    chapter.startPage = row.start_page;
  }

  if (row.end_page !== null) {
    chapter.endPage = row.end_page;
  }

  return chapter;
}

export function createChaptersRepository(db: DatabaseSync): ChaptersRepository {
  const insertStatement = db.prepare(
    `INSERT INTO document_chapters
      (id, doc_id, chapter_index, title, start_char, end_char, start_page, end_page, detection_method, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const listByDocumentIdStatement = db.prepare(
    `SELECT id, chapter_index, title, start_page, end_page
     FROM document_chapters
     WHERE doc_id = ?
     ORDER BY chapter_index ASC`
  );

  return {
    createMany(chapters) {
      if (chapters.length === 0) {
        return;
      }

      for (const chapter of chapters) {
        insertStatement.run(
          chapter.id,
          chapter.documentId,
          chapter.index,
          chapter.title,
          chapter.startChar ?? null,
          chapter.endChar ?? null,
          chapter.startPage ?? null,
          chapter.endPage ?? null,
          chapter.detectionMethod ?? null,
          nowIso()
        );
      }
    },
    listByDocumentId(documentId) {
      return getDbRows<DocumentChapterRow>(listByDocumentIdStatement, documentId).map(toDocumentChapter);
    }
  };
}
