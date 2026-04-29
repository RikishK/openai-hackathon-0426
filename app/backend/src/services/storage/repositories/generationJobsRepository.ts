import type { JobState, JobStatus } from "@tts-reader/shared";
import type { DatabaseSync } from "node:sqlite";
import { getDbValue, nowIso } from "./shared.js";

interface GenerationJobRow {
  id: string;
  state: JobState;
  progress: number;
}

export interface CreateGenerationJobInput {
  id: string;
  documentId: string;
  chapterScope: "all" | "selected";
  chapterIds: string[];
  profileHash: string;
  estimatedChars: number;
  estimatedCostUsd: number;
  state: JobState;
}

export interface GenerationJobsRepository {
  create(input: CreateGenerationJobInput): JobStatus;
  getStatusById(jobId: string): JobStatus | null;
  updateProgress(jobId: string, progress: number): void;
  updateState(jobId: string, state: JobState): void;
  markFailed(jobId: string, message: string): void;
  clearAll(): void;
}

function toJobStatus(row: GenerationJobRow): JobStatus {
  return {
    jobId: row.id,
    state: row.state,
    progress: row.progress
  };
}

export function createGenerationJobsRepository(db: DatabaseSync): GenerationJobsRepository {
  const insertStatement = db.prepare(
    `INSERT INTO generation_jobs
      (id, doc_id, chapter_scope, chapter_ids_json, profile_hash, estimated_chars, estimated_cost, progress, state, error, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const getStatusByIdStatement = db.prepare(`SELECT id, state, progress FROM generation_jobs WHERE id = ? LIMIT 1`);
  const updateProgressStatement = db.prepare(
    `UPDATE generation_jobs
     SET progress = ?, updated_at = ?
     WHERE id = ?`
  );
  const updateStateStatement = db.prepare(
    `UPDATE generation_jobs
     SET state = ?, updated_at = ?
     WHERE id = ?`
  );
  const markFailedStatement = db.prepare(
    `UPDATE generation_jobs
     SET state = 'failed', error = ?, updated_at = ?
     WHERE id = ?`
  );
  const clearAllStatement = db.prepare(`DELETE FROM generation_jobs`);

  return {
    create(input) {
      const timestamp = nowIso();
      insertStatement.run(
        input.id,
        input.documentId,
        input.chapterScope,
        JSON.stringify(input.chapterIds),
        input.profileHash,
        input.estimatedChars,
        input.estimatedCostUsd,
        0,
        input.state,
        null,
        timestamp,
        timestamp
      );

      return {
        jobId: input.id,
        state: input.state,
        progress: 0
      };
    },
    getStatusById(jobId) {
      const row = getDbValue<GenerationJobRow>(getStatusByIdStatement, jobId);
      if (!row) {
        return null;
      }

      return toJobStatus(row);
    },
    updateProgress(jobId, progress) {
      updateProgressStatement.run(progress, nowIso(), jobId);
    },
    updateState(jobId, state) {
      updateStateStatement.run(state, nowIso(), jobId);
    },
    markFailed(jobId, message) {
      markFailedStatement.run(message, nowIso(), jobId);
    },
    clearAll() {
      clearAllStatement.run();
    }
  };
}
