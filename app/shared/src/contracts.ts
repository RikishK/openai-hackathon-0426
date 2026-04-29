export type SourceType = "pdf" | "text" | "url";
export type JobState = "queued" | "processing" | "done" | "failed";

export interface VoiceProfile {
  model: string;
  voice: string;
  speed: number;
}

export interface ChapterScope {
  mode: "all" | "selected";
  chapterIds: string[];
}

export interface SourceDocument {
  id: string;
  title: string;
  type: SourceType;
}

export interface DocumentChapter {
  id: string;
  index: number;
  title: string;
  startPage?: number;
  endPage?: number;
}

export interface JobStatus {
  jobId: string;
  state: JobState;
  progress: number;
}

export interface AudioChunk {
  id: string;
  chapterId: string;
  url: string;
  downloadUrl?: string;
  durationMs: number;
  cached: boolean;
}

export interface ResumePosition {
  documentId: string;
  positionMs: number;
  updatedAtIso: string;
}

export interface UICue {
  id: string;
  kind: "info" | "warning" | "error";
  message: string;
}

export interface IngestTextRequest {
  title: string;
  text: string;
}

export interface IngestUrlRequest {
  url: string;
}

export interface IngestPdfRequest {
  title: string;
  pdfBase64: string;
}

export interface IngestResponse {
  document: SourceDocument;
  chapters: DocumentChapter[];
  warnings: string[];
}

export interface EstimateRequest {
  documentId: string;
  chapterScope: ChapterScope;
  profile: VoiceProfile;
}

export interface EstimateResponse {
  estimatedChars: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  cacheHitPercent: number;
  warnings: string[];
}

export interface GenerateRequest {
  documentId: string;
  chapterScope: ChapterScope;
  profile: VoiceProfile;
  confirmedEstimate: boolean;
}

export interface GenerateResponse {
  jobId: string;
  state: JobState;
}

export interface JobsParams {
  jobId: string;
}

export type JobsResponse = JobStatus;

export interface LibraryResponse {
  documents: SourceDocument[];
}

export interface PlayerParams {
  documentId: string;
}

export interface PlayerResponse {
  documentId: string;
  audio: AudioChunk[];
  resumePositionMs: number;
}

export interface PlayerResumeRequest {
  chapterId: string;
  profileHash: string;
  playbackPositionMs: number;
}

export interface PlayerResumeResponse {
  saved: boolean;
  resumePositionMs: number;
}

export interface SettingsResponse {
  apiKeyConfigured: boolean;
  defaultVoice: string;
}

export interface CacheClearResponse {
  cleared: boolean;
}
