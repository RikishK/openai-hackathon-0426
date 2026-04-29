import type { EstimateRequest, EstimateResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { buildGenerationPlan, toEstimateResponse } from "../services/tts/estimator.js";

export const registerEstimateRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: EstimateRequest; Reply: EstimateResponse | { error: string; message: string } }>(
    "/api/estimate",
    async (request, reply) => {
      try {
        const plan = await buildGenerationPlan(request.body);
        return toEstimateResponse(plan);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to estimate generation";
        return reply.code(400).send({
          error: "ESTIMATE_FAILED",
          message
        });
      }
    }
  );
};
