export type SourceType = "pdf" | "text" | "url";

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

export interface IngestTextRequest {
  title: string;
  text: string;
}

export interface IngestUrlRequest {
  url: string;
}

export interface IngestResponse {
  document: SourceDocument;
  chapters: DocumentChapter[];
  warnings: string[];
}

export interface EstimateRequest {
  documentId: string;
  chapterScope: {
    mode: "all" | "selected";
    chapterIds: string[];
  };
  profile: {
    model: string;
    voice: string;
    speed: number;
  };
}

export interface EstimateResponse {
  estimatedChars: number;
  estimatedTokens: number;
  estimatedCostUsd: number;
  cacheHitPercent: number;
  warnings: string[];
}

export interface GenerateResponse {
  jobId: string;
  state: "queued" | "processing" | "done" | "failed";
}
