import { describe, expect, it } from "vitest";
import type { PlayableAudioChunk } from "./readerState";
import {
  buildPlaybackSegments,
  getNextSegmentStart,
  getTotalDurationMs,
  resolvePlaybackCursor
} from "./readerState";

const chunks: PlayableAudioChunk[] = [
  {
    id: "chunk-1",
    chapterId: "ch-1",
    url: "/audio/chunk-1.mp3",
    downloadUrl: "/audio/chunk-1.mp3?download=1",
    durationMs: 1000,
    cached: true
  },
  {
    id: "chunk-2",
    chapterId: "ch-1",
    url: "/audio/chunk-2.mp3",
    downloadUrl: "/audio/chunk-2.mp3?download=1",
    durationMs: 2500,
    cached: true
  },
  {
    id: "chunk-3",
    chapterId: "ch-2",
    url: "/audio/chunk-3.mp3",
    downloadUrl: "/audio/chunk-3.mp3?download=1",
    durationMs: 500,
    cached: false
  }
];

describe("readerState", () => {
  it("builds a continuous timeline for selected chapter scope", () => {
    const segments = buildPlaybackSegments(chunks, "ch-1");

    expect(segments).toHaveLength(2);
    expect(segments[0]?.startMs).toBe(0);
    expect(segments[0]?.endMs).toBe(1000);
    expect(segments[1]?.startMs).toBe(1000);
    expect(segments[1]?.endMs).toBe(3500);
    expect(getTotalDurationMs(segments)).toBe(3500);
  });

  it("resolves resume position into the active chunk and offset", () => {
    const segments = buildPlaybackSegments(chunks, "all");

    expect(resolvePlaybackCursor(segments, 0)).toMatchObject({
      segmentIndex: 0,
      offsetMs: 0,
      positionMs: 0
    });

    expect(resolvePlaybackCursor(segments, 1800)).toMatchObject({
      segmentIndex: 1,
      offsetMs: 800,
      positionMs: 1800
    });
  });

  it("clamps out-of-range resume values", () => {
    const segments = buildPlaybackSegments(chunks, "all");

    expect(resolvePlaybackCursor(segments, -400)).toMatchObject({
      segmentIndex: 0,
      offsetMs: 0,
      positionMs: 0
    });

    expect(resolvePlaybackCursor(segments, 9000)).toMatchObject({
      segmentIndex: 2,
      offsetMs: 500,
      positionMs: 4000
    });
  });

  it("returns next segment start position for chunk transitions", () => {
    const segments = buildPlaybackSegments(chunks, "all");

    expect(getNextSegmentStart(segments, 0)).toBe(1000);
    expect(getNextSegmentStart(segments, 1)).toBe(3500);
    expect(getNextSegmentStart(segments, 2)).toBeNull();
  });
});
