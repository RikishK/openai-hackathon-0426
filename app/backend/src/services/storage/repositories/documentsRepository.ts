import type { SourceDocument, SourceType } from "@tts-reader/shared";
import type { DatabaseSync } from "node:sqlite";
import { getDbRows, getDbValue, nowIso } from "./shared.js";

interface SourceDocumentRow {
  id: string;
  type: SourceType;
  title: string;
}

interface CreateSourceDocumentInput {
  id: string;
  type: SourceType;
  title: string;
  sourceHash?: string;
  rawTextHash?: string;
}

export interface DocumentsRepository {
  create(input: CreateSourceDocumentInput): SourceDocument;
  getById(id: string): SourceDocument | null;
  list(): SourceDocument[];
}

function toSourceDocument(row: SourceDocumentRow): SourceDocument {
  return {
    id: row.id,
    type: row.type,
    title: row.title
  };
}

export function createDocumentsRepository(db: DatabaseSync): DocumentsRepository {
  const insertStatement = db.prepare(
    `INSERT INTO source_documents (id, type, title, source_hash, raw_text_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const getByIdStatement = db.prepare(`SELECT id, type, title FROM source_documents WHERE id = ? LIMIT 1`);
  const listStatement = db.prepare(`SELECT id, type, title FROM source_documents ORDER BY created_at DESC`);

  return {
    create(input) {
      insertStatement.run(
        input.id,
        input.type,
        input.title,
        input.sourceHash ?? null,
        input.rawTextHash ?? null,
        nowIso()
      );

      return {
        id: input.id,
        type: input.type,
        title: input.title
      };
    },
    getById(id) {
      const row = getDbValue<SourceDocumentRow>(getByIdStatement, id);
      if (!row) {
        return null;
      }

      return toSourceDocument(row);
    },
    list() {
      return getDbRows<SourceDocumentRow>(listStatement).map(toSourceDocument);
    }
  };
}
