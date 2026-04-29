import type { AudioChunk } from "@tts-reader/shared";
import type { DatabaseSync } from "node:sqlite";
import { getDbRows, nowIso } from "./shared.js";

interface AudioChunkRow {
  id: string;
  chapter_id: string;
  file_path: string;
  duration_ms: number;
  status: string;
}

export interface AudioChunkRecord {
  id: string;
  documentId: string;
  chapterId: string;
  profileHash: string;
  chunkIndex: number;
  filePath: string;
  durationMs: number;
  checksum?: string;
  status: "pending" | "ready" | "failed";
  sentenceId?: string;
  audioStartMs?: number;
  audioEndMs?: number;
  speakerHint?: string;
  voiceHint?: string;
}

export interface AudioChunksRepository {
  upsert(record: AudioChunkRecord): void;
  listForDocument(documentId: string): AudioChunk[];
}

function toAudioChunk(row: AudioChunkRow): AudioChunk {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    url: row.file_path,
    durationMs: row.duration_ms,
    cached: row.status === "ready"
  };
}

export function createAudioChunksRepository(db: DatabaseSync): AudioChunksRepository {
  const upsertStatement = db.prepare(
    `INSERT INTO audio_chunks
      (id, doc_id, chapter_id, profile_hash, chunk_index, file_path, duration_ms, checksum, status, sentence_id, audio_start_ms, audio_end_ms, speaker_hint, voice_hint, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       chapter_id = excluded.chapter_id,
       profile_hash = excluded.profile_hash,
       chunk_index = excluded.chunk_index,
       file_path = excluded.file_path,
       duration_ms = excluded.duration_ms,
       checksum = excluded.checksum,
       status = excluded.status,
       sentence_id = excluded.sentence_id,
       audio_start_ms = excluded.audio_start_ms,
       audio_end_ms = excluded.audio_end_ms,
       speaker_hint = excluded.speaker_hint,
       voice_hint = excluded.voice_hint,
       updated_at = excluded.updated_at`
  );
  const listForDocumentStatement = db.prepare(
    `SELECT id, chapter_id, file_path, duration_ms, status
     FROM audio_chunks
     WHERE doc_id = ?
     ORDER BY chapter_id ASC, chunk_index ASC`
  );

  return {
    upsert(record) {
      const timestamp = nowIso();
      upsertStatement.run(
        record.id,
        record.documentId,
        record.chapterId,
        record.profileHash,
        record.chunkIndex,
        record.filePath,
        record.durationMs,
        record.checksum ?? null,
        record.status,
        record.sentenceId ?? null,
        record.audioStartMs ?? null,
        record.audioEndMs ?? null,
        record.speakerHint ?? null,
        record.voiceHint ?? null,
        timestamp,
        timestamp
      );
    },
    listForDocument(documentId) {
      return getDbRows<AudioChunkRow>(listForDocumentStatement, documentId).map(toAudioChunk);
    }
  };
}
