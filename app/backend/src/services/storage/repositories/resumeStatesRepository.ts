import type { DatabaseSync } from "node:sqlite";
import { getDbValue, nowIso } from "./shared.js";

interface ResumeStateRow {
  playback_position_ms: number;
}

export interface ResumeStateRecord {
  documentId: string;
  chapterId: string;
  profileHash: string;
  playbackPositionMs: number;
}

export interface ResumeStatesRepository {
  save(record: ResumeStateRecord): void;
  getPlaybackPosition(record: Omit<ResumeStateRecord, "playbackPositionMs">): number | null;
}

export function createResumeStatesRepository(db: DatabaseSync): ResumeStatesRepository {
  const upsertStatement = db.prepare(
    `INSERT INTO resume_states (doc_id, chapter_id, profile_hash, playback_position_ms, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(doc_id, chapter_id, profile_hash) DO UPDATE SET
       playback_position_ms = excluded.playback_position_ms,
       updated_at = excluded.updated_at`
  );
  const getPlaybackStatement = db.prepare(
    `SELECT playback_position_ms
     FROM resume_states
     WHERE doc_id = ? AND chapter_id = ? AND profile_hash = ?
     LIMIT 1`
  );

  return {
    save(record) {
      upsertStatement.run(
        record.documentId,
        record.chapterId,
        record.profileHash,
        record.playbackPositionMs,
        nowIso()
      );
    },
    getPlaybackPosition(record) {
      const row = getDbValue<ResumeStateRow>(
        getPlaybackStatement,
        record.documentId,
        record.chapterId,
        record.profileHash
      );
      if (!row) {
        return null;
      }

      return row.playback_position_ms;
    }
  };
}
