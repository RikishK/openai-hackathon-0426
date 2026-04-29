import type { CacheClearResponse } from "@tts-reader/shared";
import type { FastifyPluginAsync } from "fastify";
import { getStorageContext } from "../services/storage/db.js";

export const registerCacheRoutes: FastifyPluginAsync = async (app) => {
  const clearCache = async (): Promise<CacheClearResponse> => {
    const storage = getStorageContext();
    storage.repositories.audioChunks.clearAll();
    storage.repositories.textChunks.clearAll();
    storage.repositories.generationJobs.clearAll();
    storage.repositories.resumeStates.clearAll();
    storage.repositories.generationProfiles.clearAllUnusedByUiCues();
    await storage.fileStore.clearAudioCache();
    return { cleared: true };
  };

  app.delete<{ Reply: CacheClearResponse }>("/api/cache", clearCache);
  app.post<{ Reply: CacheClearResponse }>("/api/cache/clear", clearCache);
};
