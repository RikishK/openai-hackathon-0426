import type { VoiceProfile } from "@tts-reader/shared";
import type { DatabaseSync } from "node:sqlite";
import { getDbValue, nowIso } from "./shared.js";

interface GenerationProfileRow {
  id: string;
  model: string;
  voice: string;
  speed: number;
  prompt_style: string | null;
  profile_hash: string;
}

export interface GenerationProfileRecord {
  id: string;
  profileHash: string;
  profile: VoiceProfile;
  promptStyle?: string;
}

export interface CreateGenerationProfileInput {
  id: string;
  profileHash: string;
  profile: VoiceProfile;
  promptStyle?: string;
}

export interface GenerationProfilesRepository {
  upsert(input: CreateGenerationProfileInput): GenerationProfileRecord;
  getByHash(profileHash: string): GenerationProfileRecord | null;
  clearAllUnusedByUiCues(): void;
}

function toGenerationProfileRecord(row: GenerationProfileRow): GenerationProfileRecord {
  const record: GenerationProfileRecord = {
    id: row.id,
    profileHash: row.profile_hash,
    profile: {
      model: row.model,
      voice: row.voice,
      speed: row.speed
    }
  };

  if (row.prompt_style !== null) {
    record.promptStyle = row.prompt_style;
  }

  return record;
}

export function createGenerationProfilesRepository(db: DatabaseSync): GenerationProfilesRepository {
  const upsertStatement = db.prepare(
    `INSERT INTO generation_profiles
      (id, model, voice, speed, prompt_style, profile_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(profile_hash) DO UPDATE SET
       model = excluded.model,
       voice = excluded.voice,
       speed = excluded.speed,
       prompt_style = excluded.prompt_style`
  );
  const getByHashStatement = db.prepare(
    `SELECT id, model, voice, speed, prompt_style, profile_hash
     FROM generation_profiles
     WHERE profile_hash = ?
     LIMIT 1`
  );
  const clearAllUnusedByUiCuesStatement = db.prepare(
    `DELETE FROM generation_profiles
     WHERE profile_hash NOT IN (SELECT DISTINCT profile_hash FROM ui_cue_audio)`
  );

  return {
    upsert(input) {
      upsertStatement.run(
        input.id,
        input.profile.model,
        input.profile.voice,
        input.profile.speed,
        input.promptStyle ?? null,
        input.profileHash,
        nowIso()
      );

      const row = getDbValue<GenerationProfileRow>(getByHashStatement, input.profileHash);
      if (!row) {
        throw new Error(`Failed to read generation profile ${input.profileHash}`);
      }

      return toGenerationProfileRecord(row);
    },
    getByHash(profileHash) {
      const row = getDbValue<GenerationProfileRow>(getByHashStatement, profileHash);
      if (!row) {
        return null;
      }

      return toGenerationProfileRecord(row);
    },
    clearAllUnusedByUiCues() {
      clearAllUnusedByUiCuesStatement.run();
    }
  };
}
