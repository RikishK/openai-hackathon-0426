import type { EstimateRequest, EstimateResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";

export const registerEstimateRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: EstimateRequest; Reply: EstimateResponse }>(
    "/api/estimate",
    async (request) => {
      const estimatedChars = request.body.chapterScope.mode === "all" ? 50000 : 18000;

      return {
        estimatedChars,
        estimatedTokens: Math.round(estimatedChars / 3.8),
        estimatedCostUsd: Number((estimatedChars / 50000).toFixed(2)),
        cacheHitPercent: 0,
        warnings: []
      };
    }
  );
};
