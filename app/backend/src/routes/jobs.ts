import type { JobsParams, JobsResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { getStorageContext } from "../services/storage/db.js";

export const registerJobsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: JobsParams; Reply: JobsResponse }>("/api/jobs/:jobId", async (request) => {
    const storage = getStorageContext();
    const { jobId } = request.params;
    const status = storage.repositories.generationJobs.getStatusById(jobId);
    if (status) {
      return status;
    }

    return {
      jobId,
      state: "queued",
      progress: 0
    };
  });
};
