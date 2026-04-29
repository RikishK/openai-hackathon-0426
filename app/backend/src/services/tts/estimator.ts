import type { ChapterScope, DocumentChapter, EstimateResponse, VoiceProfile } from "@tts-reader/shared";
import { chunkNormalizedText } from "../chunking/chunker.js";
import { normalizeTextForChunking } from "../chunking/normalizer.js";
import { loadDocumentSourceText } from "../ingestion/textIngest.js";
import { getStorageContext } from "../storage/db.js";
import { createChunkCacheKey, createProfileHash } from "./cacheKey.js";

const TOKENS_PER_CHARACTER = 1 / 3.8;
const ESTIMATED_USD_PER_CHARACTER = 1 / 50000;

export class GenerationPlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationPlanValidationError";
  }
}

interface ChapterTextSlice {
  chapterId: string;
  text: string;
}

export interface PlannedChunk {
  id: string;
  chapterId: string;
  chunkIndex: number;
  text: string;
  charStart: number;
  charEnd: number;
}

export interface GenerationPlan {
  documentId: string;
  profileHash: string;
  chunks: PlannedChunk[];
  estimatedChars: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  cacheHitPercent: number;
  warnings: string[];
}

function selectChapterIds(chapters: DocumentChapter[], scope: ChapterScope): string[] {
  if (scope.mode === "all") {
    return chapters.map((chapter) => chapter.id);
  }

  const requested = new Set(scope.chapterIds);
  const selected = chapters.filter((chapter) => requested.has(chapter.id)).map((chapter) => chapter.id);
  if (selected.length !== requested.size) {
    throw new GenerationPlanValidationError("Some requested chapterIds do not belong to the selected document");
  }
  return selected;
}

function splitTextAcrossChapters(text: string, chapters: DocumentChapter[]): ChapterTextSlice[] {
  if (chapters.length === 0) {
    return [];
  }

  const sortedChapters = [...chapters].sort((left, right) => left.index - right.index);
  const slices: ChapterTextSlice[] = [];

  for (let index = 0; index < sortedChapters.length; index += 1) {
    const chapter = sortedChapters[index];
    if (!chapter) {
      continue;
    }
    const start = Math.floor((index * text.length) / sortedChapters.length);
    const end = Math.floor(((index + 1) * text.length) / sortedChapters.length);
    const value = text.slice(start, end).trim();
    slices.push({
      chapterId: chapter.id,
      text: value
    });
  }

  return slices;
}

export async function buildGenerationPlan(input: {
  documentId: string;
  chapterScope: ChapterScope;
  profile: VoiceProfile;
}): Promise<GenerationPlan> {
  const storage = getStorageContext();
  const document = storage.repositories.documents.getById(input.documentId);
  if (!document) {
    throw new GenerationPlanValidationError(`Document ${input.documentId} does not exist`);
  }

  const sourceText = await loadDocumentSourceText(input.documentId);
  if (sourceText === null) {
    throw new GenerationPlanValidationError(`No source text exists for document ${input.documentId}`);
  }

  const normalizedText = normalizeTextForChunking(sourceText);
  const allChapters = storage.repositories.chapters.listByDocumentId(input.documentId);
  const chapterIds = selectChapterIds(allChapters, input.chapterScope);
  const chapterIdSet = new Set(chapterIds);
  const chapterSlices = splitTextAcrossChapters(normalizedText, allChapters).filter((slice) => chapterIdSet.has(slice.chapterId));

  const profileHash = createProfileHash(input.profile);
  const chunks: PlannedChunk[] = [];

  for (const chapterSlice of chapterSlices) {
    const chapterChunks = chunkNormalizedText(chapterSlice.text);
    for (const chapterChunk of chapterChunks) {
      const cacheKey = createChunkCacheKey({
        documentId: input.documentId,
        chapterId: chapterSlice.chapterId,
        profileHash,
        chunkText: chapterChunk.text
      });

      chunks.push({
        id: cacheKey,
        chapterId: chapterSlice.chapterId,
        chunkIndex: chapterChunk.chunkIndex,
        text: chapterChunk.text,
        charStart: chapterChunk.charStart,
        charEnd: chapterChunk.charEnd
      });
    }
  }

  const estimatedChars = chunks.reduce((total, chunk) => total + chunk.text.length, 0);
  const estimatedTokens = Math.round(estimatedChars * TOKENS_PER_CHARACTER);
  const estimatedCostUsd = Number((estimatedChars * ESTIMATED_USD_PER_CHARACTER).toFixed(2));
  const cachedChunks = chunks.filter((chunk) => {
    const cached = storage.repositories.audioChunks.getById(chunk.id);
    return cached?.status === "ready";
  }).length;
  const cacheHitPercent = chunks.length === 0 ? 0 : Math.round((cachedChunks / chunks.length) * 100);

  const warnings: string[] = [];
  if (estimatedChars > 200_000) {
    warnings.push("Long generation time expected");
  }
  if (estimatedCostUsd >= 5) {
    warnings.push("Estimated cost is above $5.00");
  }

  return {
    documentId: input.documentId,
    profileHash,
    chunks,
    estimatedChars,
    estimatedTokens,
    estimatedCostUsd,
    cacheHitPercent,
    warnings
  };
}

export function toEstimateResponse(plan: GenerationPlan): EstimateResponse {
  return {
    estimatedChars: plan.estimatedChars,
    estimatedTokens: plan.estimatedTokens,
    estimatedCostUsd: plan.estimatedCostUsd,
    cacheHitPercent: plan.cacheHitPercent,
    warnings: plan.warnings
  };
}
