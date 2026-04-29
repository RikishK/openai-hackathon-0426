import type { GenerateResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { getStorageContext } from "../services/storage/db.js";

function createProfileHash(model: string, voice: string, speed: number): string {
  const source = `${model}:${voice}:${speed}`;
  return createHash("sha256").update(source).digest("hex");
}

export const registerGenerateRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Reply: GenerateResponse }>("/api/generate", async () => {
    const storage = getStorageContext();
    const profileHash = createProfileHash("gpt-audio-1.5", "alloy", 1);

    storage.repositories.generationProfiles.upsert({
      id: `prof_${randomUUID()}`,
      profileHash,
      profile: {
        model: "gpt-audio-1.5",
        voice: "alloy",
        speed: 1
      }
    });

    const documents = storage.repositories.documents.list();
    const targetDocument = documents[0] ?? storage.repositories.documents.create({
      id: `doc_${randomUUID()}`,
      type: "text",
      title: "Untitled document"
    });

    const status = storage.repositories.generationJobs.create({
      id: `job_${randomUUID()}`,
      documentId: targetDocument.id,
      chapterScope: "all",
      chapterIds: ["all"],
      profileHash,
      estimatedChars: 0,
      estimatedCostUsd: 0,
      state: "queued"
    });

    return {
      jobId: status.jobId,
      state: status.state
    };
  });
};
