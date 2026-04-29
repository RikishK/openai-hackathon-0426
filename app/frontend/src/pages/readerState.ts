import type { AudioChunk } from "@tts-reader/shared";

export interface PlaybackSegment {
  chunkId: string;
  chapterId: string;
  url: string;
  downloadUrl?: string;
  durationMs: number;
  startMs: number;
  endMs: number;
}

export interface PlaybackCursor {
  segmentIndex: number;
  offsetMs: number;
  positionMs: number;
}

export function buildPlaybackSegments(chunks: AudioChunk[], chapterId: string): PlaybackSegment[] {
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
      durationMs: sanitizedDurationMs,
      startMs,
      endMs,
      ...(chunk.downloadUrl ? { downloadUrl: chunk.downloadUrl } : {})
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
