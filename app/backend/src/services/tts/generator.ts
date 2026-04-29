import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getStorageContext } from "../storage/db.js";
import type { GenerationPlan } from "./estimator.js";

async function synthesizeAudioChunk(chunkText: string, profile: { model: string; voice: string; speed: number }): Promise<Uint8Array> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: profile.model,
      voice: profile.voice,
      speed: profile.speed,
      format: "mp3",
      input: chunkText
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI audio request failed (${response.status}): ${detail}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function estimateDurationMs(text: string): number {
  return Math.max(500, Math.round((text.length / 14) * 1000));
}

export async function processGenerationJob(input: {
  jobId: string;
  plan: GenerationPlan;
  profile: {
    model: string;
    voice: string;
    speed: number;
  };
}): Promise<void> {
  const storage = getStorageContext();
  const chapters = storage.repositories.chapters.listByDocumentId(input.plan.documentId);
  const chapterIndexById = new Map(chapters.map((chapter) => [chapter.id, chapter.index]));

  storage.repositories.generationJobs.updateState(input.jobId, "processing");

  try {
    if (input.plan.chunks.length === 0) {
      storage.repositories.generationJobs.updateProgress(input.jobId, 100);
      storage.repositories.generationJobs.updateState(input.jobId, "done");
      return;
    }

    for (let index = 0; index < input.plan.chunks.length; index += 1) {
      const chunk = input.plan.chunks[index];
      if (!chunk) {
        continue;
      }
      const existing = storage.repositories.audioChunks.getById(chunk.id);
      const chapterIndex = chapterIndexById.get(chunk.chapterId);
      if (chapterIndex === undefined) {
        throw new Error(`Chapter ${chunk.chapterId} does not exist for document ${input.plan.documentId}`);
      }

      if (!existing || existing.status !== "ready") {
        const audioBytes = await synthesizeAudioChunk(chunk.text, input.profile);
        const filePath = storage.fileStore.getAudioChunkPath(
          input.plan.documentId,
          input.plan.profileHash,
          chapterIndex,
          chunk.chunkIndex
        );

        await mkdir(dirname(filePath), { recursive: true });
        await writeFile(filePath, audioBytes);

        storage.repositories.audioChunks.upsert({
          id: chunk.id,
          documentId: input.plan.documentId,
          chapterId: chunk.chapterId,
          profileHash: input.plan.profileHash,
          chunkIndex: chunk.chunkIndex,
          filePath,
          durationMs: estimateDurationMs(chunk.text),
          status: "ready"
        });
      }

      storage.repositories.textChunks.upsert({
        id: chunk.id,
        documentId: input.plan.documentId,
        chapterId: chunk.chapterId,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        charStart: chunk.charStart,
        charEnd: chunk.charEnd
      });

      const progress = Math.round(((index + 1) / input.plan.chunks.length) * 100);
      storage.repositories.generationJobs.updateProgress(input.jobId, progress);
    }

    storage.repositories.generationJobs.updateState(input.jobId, "done");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    storage.repositories.generationJobs.markFailed(input.jobId, message);
    throw error;
  }
}
