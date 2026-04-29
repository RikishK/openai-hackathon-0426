import type { DatabaseSync } from "node:sqlite";
import { nowIso } from "./shared.js";

export interface TextChunkRecord {
  id: string;
  documentId: string;
  chapterId: string | null;
  chunkIndex: number;
  text: string;
  charStart: number;
  charEnd: number;
  sentenceId?: string;
  audioStartMs?: number;
  audioEndMs?: number;
  speakerHint?: string;
  voiceHint?: string;
}

export interface TextChunksRepository {
  upsert(record: TextChunkRecord): void;
}

export function createTextChunksRepository(db: DatabaseSync): TextChunksRepository {
  const upsertStatement = db.prepare(
    `INSERT INTO text_chunks
      (id, doc_id, chapter_id, chunk_index, text, char_start, char_end, sentence_id, audio_start_ms, audio_end_ms, speaker_hint, voice_hint, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       chapter_id = excluded.chapter_id,
       chunk_index = excluded.chunk_index,
       text = excluded.text,
       char_start = excluded.char_start,
       char_end = excluded.char_end,
       sentence_id = excluded.sentence_id,
       audio_start_ms = excluded.audio_start_ms,
       audio_end_ms = excluded.audio_end_ms,
       speaker_hint = excluded.speaker_hint,
       voice_hint = excluded.voice_hint`
  );

  return {
    upsert(record) {
      upsertStatement.run(
        record.id,
        record.documentId,
        record.chapterId,
        record.chunkIndex,
        record.text,
        record.charStart,
        record.charEnd,
        record.sentenceId ?? null,
        record.audioStartMs ?? null,
        record.audioEndMs ?? null,
        record.speakerHint ?? null,
        record.voiceHint ?? null,
        nowIso()
      );
    }
  };
}
