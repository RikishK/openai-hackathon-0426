import type { EstimateRequest, EstimateResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { buildGenerationPlan, GenerationPlanValidationError, toEstimateResponse } from "../services/tts/estimator.js";

export const registerEstimateRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: EstimateRequest; Reply: EstimateResponse | { error: string; message: string } }>(
    "/api/estimate",
    async (request, reply) => {
      try {
        const plan = await buildGenerationPlan(request.body);
        return toEstimateResponse(plan);
      } catch (error) {
        if (error instanceof GenerationPlanValidationError) {
          return reply.code(400).send({
            error: "ESTIMATE_INVALID_REQUEST",
            message: error.message
          });
        }

        request.log.error({ error }, "Estimate request failed");
        return reply.code(500).send({
          error: "ESTIMATE_FAILED",
          message: "Failed to estimate generation"
        });
      }
    }
  );
};
