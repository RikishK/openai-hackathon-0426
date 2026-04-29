import type { DatabaseSync } from "node:sqlite";
import { getDbRows, getDbValue, nowIso } from "./shared.js";

interface UiCueAudioRow {
  cue_name: string;
  profile_hash: string;
  file_path: string;
  checksum: string | null;
}

export interface UiCueAudioRecord {
  cueName: string;
  profileHash: string;
  filePath: string;
  checksum?: string;
}

export interface UiCueAudioRepository {
  upsert(record: UiCueAudioRecord): void;
  get(cueName: string, profileHash: string): UiCueAudioRecord | null;
  list(): UiCueAudioRecord[];
}

function toUiCueAudioRecord(row: UiCueAudioRow): UiCueAudioRecord {
  const record: UiCueAudioRecord = {
    cueName: row.cue_name,
    profileHash: row.profile_hash,
    filePath: row.file_path
  };

  if (row.checksum !== null) {
    record.checksum = row.checksum;
  }

  return record;
}

export function createUiCueAudioRepository(db: DatabaseSync): UiCueAudioRepository {
  const upsertStatement = db.prepare(
    `INSERT INTO ui_cue_audio (cue_name, profile_hash, file_path, checksum, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(cue_name, profile_hash) DO UPDATE SET
       file_path = excluded.file_path,
       checksum = excluded.checksum`
  );
  const getStatement = db.prepare(
    `SELECT cue_name, profile_hash, file_path, checksum
     FROM ui_cue_audio
     WHERE cue_name = ? AND profile_hash = ?
     LIMIT 1`
  );
  const listStatement = db.prepare(`SELECT cue_name, profile_hash, file_path, checksum FROM ui_cue_audio`);

  return {
    upsert(record) {
      upsertStatement.run(record.cueName, record.profileHash, record.filePath, record.checksum ?? null, nowIso());
    },
    get(cueName, profileHash) {
      const row = getDbValue<UiCueAudioRow>(getStatement, cueName, profileHash);
      if (!row) {
        return null;
      }

      return toUiCueAudioRecord(row);
    },
    list() {
      return getDbRows<UiCueAudioRow>(listStatement).map(toUiCueAudioRecord);
    }
  };
}
