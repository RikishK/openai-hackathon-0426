import type { GenerateRequest, GenerateResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { randomUUID } from "node:crypto";
import { getStorageContext } from "../services/storage/db.js";
import { buildGenerationPlan, GenerationPlanValidationError } from "../services/tts/estimator.js";
import { processGenerationJob } from "../services/tts/generator.js";

export const registerGenerateRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: GenerateRequest; Reply: GenerateResponse | { error: string; message: string } }>(
    "/api/generate",
    async (request, reply) => {
      if (!request.body.confirmedEstimate) {
        return reply.code(400).send({
          error: "CONFIRMATION_REQUIRED",
          message: "Set confirmedEstimate=true before creating a generation job"
        });
      }

      let plan;
      try {
        plan = await buildGenerationPlan(request.body);
      } catch (error) {
        if (error instanceof GenerationPlanValidationError) {
          return reply.code(400).send({
            error: "GENERATE_INVALID_REQUEST",
            message: error.message
          });
        }

        request.log.error({ error }, "Failed to create generation plan");
        return reply.code(500).send({
          error: "GENERATE_PLAN_FAILED",
          message: "Failed to create generation plan"
        });
      }

      const storage = getStorageContext();
      const profile = storage.repositories.generationProfiles.upsert({
        id: `prof_${randomUUID()}`,
        profileHash: plan.profileHash,
        profile: request.body.profile
      });

      const jobId = `job_${randomUUID()}`;
      const jobChapterIds =
        request.body.chapterScope.mode === "all"
          ? [...new Set(plan.chunks.map((chunk) => chunk.chapterId))]
          : request.body.chapterScope.chapterIds;
      const status = storage.repositories.generationJobs.create({
        id: jobId,
        documentId: plan.documentId,
        chapterScope: request.body.chapterScope.mode,
        chapterIds: jobChapterIds,
        profileHash: profile.profileHash,
        estimatedChars: plan.estimatedChars,
        estimatedCostUsd: plan.estimatedCostUsd,
        state: "queued"
      });

      processGenerationJob({
        jobId,
        plan,
        profile: request.body.profile
      }).catch((error) => {
        request.log.error({ error, jobId }, "Generation job failed in background worker");
      });

      return {
        jobId: status.jobId,
        state: status.state
      };
    }
  );
};
