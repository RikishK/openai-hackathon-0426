import type { JobsParams, JobsResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { getStorageContext } from "../services/storage/db.js";

export const registerJobsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Params: JobsParams;
    Reply: JobsResponse | { error: string; message: string };
  }>("/api/jobs/:jobId", async (request, reply) => {
    const storage = getStorageContext();
    const { jobId } = request.params;
    const status = storage.repositories.generationJobs.getStatusById(jobId);
    if (status) {
      return status;
    }

    return reply.code(404).send({
      error: "JOB_NOT_FOUND",
      message: `No generation job exists for id ${jobId}`
    });
  });
};
