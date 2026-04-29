import type { DatabaseSync } from "node:sqlite";
import { createAudioChunksRepository, type AudioChunksRepository } from "./audioChunksRepository.js";
import { createChaptersRepository, type ChaptersRepository } from "./chaptersRepository.js";
import { createDocumentsRepository, type DocumentsRepository } from "./documentsRepository.js";
import { createGenerationJobsRepository, type GenerationJobsRepository } from "./generationJobsRepository.js";
import {
  createGenerationProfilesRepository,
  type GenerationProfilesRepository
} from "./generationProfilesRepository.js";
import { createResumeStatesRepository, type ResumeStatesRepository } from "./resumeStatesRepository.js";
import { createTextChunksRepository, type TextChunksRepository } from "./textChunksRepository.js";
import { createUiCueAudioRepository, type UiCueAudioRepository } from "./uiCueAudioRepository.js";

export interface StorageRepositories {
  documents: DocumentsRepository;
  chapters: ChaptersRepository;
  generationProfiles: GenerationProfilesRepository;
  generationJobs: GenerationJobsRepository;
  textChunks: TextChunksRepository;
  audioChunks: AudioChunksRepository;
  resumeStates: ResumeStatesRepository;
  uiCueAudio: UiCueAudioRepository;
}

export function createStorageRepositories(db: DatabaseSync): StorageRepositories {
  return {
    documents: createDocumentsRepository(db),
    chapters: createChaptersRepository(db),
    generationProfiles: createGenerationProfilesRepository(db),
    generationJobs: createGenerationJobsRepository(db),
    textChunks: createTextChunksRepository(db),
    audioChunks: createAudioChunksRepository(db),
    resumeStates: createResumeStatesRepository(db),
    uiCueAudio: createUiCueAudioRepository(db)
  };
}
