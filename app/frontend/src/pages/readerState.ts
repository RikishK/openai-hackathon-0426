import type { AudioChunk, ChapterScope, DocumentChapter } from "@tts-reader/shared";

export interface PlayableAudioChunk extends AudioChunk {
  downloadUrl: string;
}

export interface PlaybackSegment {
  chunkId: string;
  chapterId: string;
  url: string;
  downloadUrl: string;
  durationMs: number;
  startMs: number;
  endMs: number;
}

export interface PlaybackCursor {
  segmentIndex: number;
  offsetMs: number;
  positionMs: number;
}

export function buildPlaybackSegments(chunks: PlayableAudioChunk[], chapterId: string): PlaybackSegment[] {
  const filteredChunks =
    chapterId === "all" ? chunks : chunks.filter((chunk) => chunk.chapterId === chapterId);

  let runningDurationMs = 0;
  return filteredChunks.map((chunk) => {
    const startMs = runningDurationMs;
    const sanitizedDurationMs = Math.max(0, chunk.durationMs);
    const endMs = startMs + sanitizedDurationMs;
    runningDurationMs = endMs;

    return {
      chunkId: chunk.id,
      chapterId: chunk.chapterId,
      url: chunk.url,
      downloadUrl: chunk.downloadUrl,
      durationMs: sanitizedDurationMs,
      startMs,
      endMs
    };
  });
}

export function getTotalDurationMs(segments: PlaybackSegment[]): number {
  return segments.at(-1)?.endMs ?? 0;
}

export function resolvePlaybackCursor(segments: PlaybackSegment[], requestedPositionMs: number): PlaybackCursor {
  if (segments.length === 0) {
    return {
      segmentIndex: -1,
      offsetMs: 0,
      positionMs: 0
    };
  }

  const totalDurationMs = getTotalDurationMs(segments);
  const clampedPositionMs = Math.max(0, Math.min(requestedPositionMs, totalDurationMs));
  const segmentIndex = segments.findIndex((segment) => clampedPositionMs < segment.endMs);
  const resolvedIndex = segmentIndex === -1 ? segments.length - 1 : segmentIndex;
  const activeSegment = segments[resolvedIndex];

  if (!activeSegment) {
    return {
      segmentIndex: -1,
      offsetMs: 0,
      positionMs: 0
    };
  }

  const offsetMs = Math.min(Math.max(clampedPositionMs - activeSegment.startMs, 0), activeSegment.durationMs);

  return {
    segmentIndex: resolvedIndex,
    offsetMs,
    positionMs: activeSegment.startMs + offsetMs
  };
}

export function getNextSegmentStart(segments: PlaybackSegment[], segmentIndex: number): number | null {
  const nextSegment = segments[segmentIndex + 1];
  return nextSegment ? nextSegment.startMs : null;
}

export function buildChapterScope(
  chapters: DocumentChapter[],
  mode: "all" | "selected",
  selectedChapterIds: string[]
): ChapterScope {
  const chapterIds = chapters.map((chapter) => chapter.id);
  if (mode === "all") {
    return {
      mode: "all",
      chapterIds
    };
  }

  const knownChapterIdSet = new Set(chapterIds);
  const dedupedSelectedChapterIds = [...new Set(selectedChapterIds)].filter((chapterId) =>
    knownChapterIdSet.has(chapterId)
  );

  return {
    mode: "selected",
    chapterIds: dedupedSelectedChapterIds
  };
}
