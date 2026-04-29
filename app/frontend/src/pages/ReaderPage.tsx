import type { DocumentChapter, EstimateResponse, JobState, VoiceProfile } from "@tts-reader/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { estimateGeneration, generateAudio, getGenerationJob, getPlayer, savePlayerResume } from "../api/client";
import { A11yCueManager } from "../components/A11yCueManager";
import { ChapterPicker } from "../components/ChapterPicker";
import { JobProgress } from "../components/JobProgress";
import { PlayerControls } from "../components/PlayerControls";
import type { LibraryDocumentEntry } from "./libraryState";
import {
  buildChapterScope,
  buildPlaybackSegments,
  getNextSegmentStart,
  getTotalDurationMs,
  type PlayableAudioChunk,
  resolvePlaybackCursor
} from "./readerState";

interface ReaderPageProps {
  documents: LibraryDocumentEntry[];
  onGeneratedScope(documentId: string, chapterIds: string[]): void;
}

const DEFAULT_PROFILE_HASH = "default";
const DEFAULT_GENERATION_PROFILE: VoiceProfile = {
  model: "gpt-4o-mini-tts",
  voice: "alloy",
  speed: 1
};
const JOB_POLL_INTERVAL_MS = 1500;
const JOB_POLL_TIMEOUT_MS = 120000;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

function toChapterOptions(document: LibraryDocumentEntry | null, chapterIdsFromAudio: string[]): DocumentChapter[] {
  if (document && document.chapters.length > 0) {
    return document.chapters;
  }

  return chapterIdsFromAudio.map((chapterId, index) => ({
    id: chapterId,
    index,
    title: `Chapter ${index + 1}`
  }));
}

function toPlayableAudioChunks(
  chunks: Awaited<ReturnType<typeof getPlayer>>["audio"]
): PlayableAudioChunk[] {
  return chunks.map((chunk) => {
    if (typeof chunk.downloadUrl !== "string" || chunk.downloadUrl.trim().length === 0) {
      throw new Error(`Player response is missing downloadUrl for chunk ${chunk.id}`);
    }

    return {
      ...chunk,
      downloadUrl: chunk.downloadUrl
    };
  });
}

export function ReaderPage({ documents, onGeneratedScope }: ReaderPageProps) {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>(documents[0]?.document.id ?? "");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("all");
  const [audioChunks, setAudioChunks] = useState<PlayableAudioChunk[]>([]);
  const [resumePositionMs, setResumePositionMs] = useState(0);
  const [seekMs, setSeekMs] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generationMode, setGenerationMode] = useState<"all" | "selected">("all");
  const [selectedGenerationChapterIds, setSelectedGenerationChapterIds] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [generationJobState, setGenerationJobState] = useState<JobState | null>(null);
  const [generationJobProgress, setGenerationJobProgress] = useState(0);
  const [playerReloadToken, setPlayerReloadToken] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const latestSeekMsRef = useRef(0);
  const lastSavedResumeMsRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (documents.length === 0) {
      setSelectedDocumentId("");
      return;
    }

    const hasSelectedDocument = documents.some((entry) => entry.document.id === selectedDocumentId);
    if (!hasSelectedDocument) {
      setSelectedDocumentId(documents[0]?.document.id ?? "");
    }
  }, [documents, selectedDocumentId]);

  useEffect(() => {
    latestSeekMsRef.current = seekMs;
  }, [seekMs]);

  useEffect(() => {
    if (!selectedDocumentId) {
      setAudioChunks([]);
      setResumePositionMs(0);
      setSeekMs(0);
      setErrorMessage(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);
    setIsPlaying(false);

    async function loadPlayer() {
      try {
        const player = await getPlayer(selectedDocumentId);
        if (!isMounted) {
          return;
        }

        setAudioChunks(toPlayableAudioChunks(player.audio));
        setResumePositionMs(player.resumePositionMs);
        setSeekMs(player.resumePositionMs);
        lastSavedResumeMsRef.current = player.resumePositionMs;
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (!(error instanceof Error)) {
          throw error;
        }

        setAudioChunks([]);
        setResumePositionMs(0);
        setSeekMs(0);
        setErrorMessage(`Unable to load reader audio: ${error.message}`);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPlayer();

    return () => {
      isMounted = false;
    };
  }, [playerReloadToken, selectedDocumentId]);

  const chapterIdsFromAudio = useMemo(
    () => [...new Set(audioChunks.map((chunk) => chunk.chapterId))],
    [audioChunks]
  );

  const selectedDocument = useMemo(
    () => documents.find((entry) => entry.document.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  const chapterOptions = useMemo(
    () => toChapterOptions(selectedDocument, chapterIdsFromAudio),
    [chapterIdsFromAudio, selectedDocument]
  );

  useEffect(() => {
    const knownChapterIdSet = new Set(chapterOptions.map((chapter) => chapter.id));
    setSelectedGenerationChapterIds((current) => {
      const filtered = current.filter((chapterId) => knownChapterIdSet.has(chapterId));
      if (filtered.length > 0) {
        return filtered;
      }

      return chapterOptions.map((chapter) => chapter.id);
    });
  }, [chapterOptions]);

  const generationChapterScope = useMemo(
    () => buildChapterScope(chapterOptions, generationMode, selectedGenerationChapterIds),
    [chapterOptions, generationMode, selectedGenerationChapterIds]
  );

  const canEstimate =
    selectedDocumentId.length > 0 &&
    !isLoading &&
    !isEstimating &&
    !isGenerating &&
    (generationChapterScope.mode === "all" || generationChapterScope.chapterIds.length > 0);

  useEffect(() => {
    if (selectedChapterId === "all") {
      return;
    }

    const chapterStillAvailable = chapterOptions.some((chapter) => chapter.id === selectedChapterId);
    if (!chapterStillAvailable) {
      setSelectedChapterId("all");
    }
  }, [chapterOptions, selectedChapterId]);

  useEffect(() => {
    setEstimate(null);
  }, [generationChapterScope.chapterIds, generationChapterScope.mode, selectedDocumentId]);

  const playbackSegments = useMemo(
    () => buildPlaybackSegments(audioChunks, selectedChapterId),
    [audioChunks, selectedChapterId]
  );

  const totalDurationMs = useMemo(() => getTotalDurationMs(playbackSegments), [playbackSegments]);
  const cursor = useMemo(
    () => resolvePlaybackCursor(playbackSegments, seekMs),
    [playbackSegments, seekMs]
  );
  const activeSegment = cursor.segmentIndex >= 0 ? playbackSegments[cursor.segmentIndex] : null;

  async function persistResumePosition(positionMs: number): Promise<void> {
    if (!selectedDocumentId) {
      return;
    }

    const normalizedPositionMs = Math.max(0, Math.round(positionMs));
    const lastSaved = lastSavedResumeMsRef.current;
    if (lastSaved !== null && Math.abs(lastSaved - normalizedPositionMs) < 1000) {
      return;
    }

    const chapterId = selectedChapterId === "all" ? activeSegment?.chapterId : selectedChapterId;
    if (!chapterId) {
      return;
    }

    const response = await savePlayerResume(selectedDocumentId, {
      chapterId,
      profileHash: DEFAULT_PROFILE_HASH,
      playbackPositionMs: normalizedPositionMs
    });

    if (!response.saved) {
      throw new Error("Failed to save resume position");
    }

    lastSavedResumeMsRef.current = response.resumePositionMs;
    setResumePositionMs(response.resumePositionMs);
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeSegment) {
      return;
    }

    if (!audio.src.endsWith(activeSegment.url)) {
      audio.src = activeSegment.url;
      audio.load();
    }

    const targetSeconds = cursor.offsetMs / 1000;
    if (Math.abs(audio.currentTime - targetSeconds) > 0.3) {
      audio.currentTime = targetSeconds;
    }

    if (isPlaying) {
      void audio.play().catch((error) => {
        setIsPlaying(false);

        const message = getErrorMessage(error);
        if (isMountedRef.current) {
          setErrorMessage(`Unable to start playback: ${message}`);
          return;
        }

        console.error(`Unable to start playback: ${message}`);
      });
      return;
    }

    audio.pause();
  }, [activeSegment, cursor.offsetMs, isPlaying]);

  useEffect(() => {
    if (!selectedDocumentId) {
      return;
    }

    const interval = window.setInterval(() => {
      if (!isPlaying) {
        return;
      }

      void persistResumePosition(latestSeekMsRef.current).catch((error) => {
        const message = getErrorMessage(error);

        if (isMountedRef.current) {
          setErrorMessage(`Unable to save resume position: ${message}`);
          return;
        }

        console.error(`Unable to save resume position: ${message}`);
      });
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isPlaying, selectedDocumentId]);

  useEffect(() => {
    return () => {
      if (!selectedDocumentId) {
        return;
      }

      void persistResumePosition(latestSeekMsRef.current).catch((error) => {
        const message = getErrorMessage(error);

        if (isMountedRef.current) {
          setErrorMessage(`Unable to save resume position: ${message}`);
          return;
        }

        console.error(`Unable to save resume position: ${message}`);
      });
    };
  }, [selectedDocumentId]);

  function handleDocumentChange(documentId: string) {
    setSelectedDocumentId(documentId);
    setSelectedChapterId("all");
    setResumePositionMs(0);
    setSeekMs(0);
    setGenerationMode("all");
    setSelectedGenerationChapterIds([]);
    setEstimate(null);
    setGenerationJobId(null);
    setGenerationJobState(null);
    setGenerationJobProgress(0);
    setErrorMessage(null);
  }

  function handleChapterChange(chapterId: string) {
    setSelectedChapterId(chapterId);
    setIsPlaying(false);
    setSeekMs(0);
  }

  function handleTogglePlay() {
    if (playbackSegments.length === 0) {
      return;
    }

    setIsPlaying((current) => !current);
  }

  function handleSeek(positionMs: number) {
    setSeekMs(positionMs);
  }

  function handleSeekRelative(deltaMs: number) {
    setSeekMs((current) => Math.max(0, Math.min(totalDurationMs, current + deltaMs)));
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || !activeSegment) {
      return;
    }

    setSeekMs(activeSegment.startMs + Math.round(audio.currentTime * 1000));
  }

  function handleAudioEnded() {
    const nextStartMs = getNextSegmentStart(playbackSegments, cursor.segmentIndex);
    if (nextStartMs === null) {
      setIsPlaying(false);
      setSeekMs(totalDurationMs);
      return;
    }

    setSeekMs(nextStartMs);
  }

  async function handlePauseAndSave() {
    setIsPlaying(false);

    try {
      await persistResumePosition(latestSeekMsRef.current);
    } catch (error) {
      setErrorMessage(`Unable to save resume position: ${getErrorMessage(error)}`);
    }
  }

  function handleGenerationModeChange(mode: "all" | "selected") {
    setGenerationMode(mode);
    setGenerationJobId(null);
    setGenerationJobState(null);
    setGenerationJobProgress(0);
  }

  function handleGenerationChapterToggle(chapterId: string) {
    setSelectedGenerationChapterIds((current) => {
      if (current.includes(chapterId)) {
        return current.filter((id) => id !== chapterId);
      }

      return [...current, chapterId];
    });
  }

  function handleSelectAllGenerationChapters() {
    setSelectedGenerationChapterIds(chapterOptions.map((chapter) => chapter.id));
  }

  function handleClearGenerationChapters() {
    setSelectedGenerationChapterIds([]);
  }

  async function handleEstimateGeneration() {
    if (!selectedDocumentId) {
      return;
    }

    setIsEstimating(true);
    setGenerationJobId(null);
    setGenerationJobState(null);
    setGenerationJobProgress(0);

    try {
      const response = await estimateGeneration({
        documentId: selectedDocumentId,
        chapterScope: generationChapterScope,
        profile: DEFAULT_GENERATION_PROFILE
      });
      setEstimate(response);
      setErrorMessage(null);
    } catch (error) {
      setEstimate(null);
      setErrorMessage(`Unable to estimate generation: ${getErrorMessage(error)}`);
    } finally {
      setIsEstimating(false);
    }
  }

  async function handleGenerateAudio() {
    if (!selectedDocumentId || estimate === null || isGenerating) {
      return;
    }

    setIsGenerating(true);
    setGenerationJobState("queued");
    setGenerationJobProgress(0);

    try {
      const response = await generateAudio({
        documentId: selectedDocumentId,
        chapterScope: generationChapterScope,
        profile: DEFAULT_GENERATION_PROFILE,
        confirmedEstimate: true
      });
      setGenerationJobId(response.jobId);
      setGenerationJobState(response.state);

      const pollStartedAt = Date.now();
      while (Date.now() - pollStartedAt < JOB_POLL_TIMEOUT_MS) {
        const status = await getGenerationJob(response.jobId);
        setGenerationJobState(status.state);
        setGenerationJobProgress(status.progress);

        if (status.state === "done") {
          onGeneratedScope(selectedDocumentId, generationChapterScope.chapterIds);
          setPlayerReloadToken((current) => current + 1);
          setErrorMessage(null);
          return;
        }

        if (status.state === "failed") {
          setErrorMessage(`Generation job ${status.jobId} failed`);
          return;
        }

        await wait(JOB_POLL_INTERVAL_MS);
      }

      setErrorMessage(`Generation job ${response.jobId} timed out while polling`);
    } catch (error) {
      setErrorMessage(`Unable to generate audio: ${getErrorMessage(error)}`);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="stack" aria-labelledby="reader-title">
      <h2 id="reader-title">Reader</h2>
      <div className="card stack">
        <label htmlFor="reader-document-selection">
          <strong>Document</strong>
        </label>
        <select
          id="reader-document-selection"
          aria-label="Document selection"
          value={selectedDocumentId}
          disabled={documents.length === 0 || isLoading}
          onChange={(event) => handleDocumentChange(event.target.value)}
        >
          {documents.length === 0 ? <option value="">No documents available</option> : null}
          {documents.map((entry) => (
            <option key={entry.document.id} value={entry.document.id}>
              {entry.document.title}
            </option>
          ))}
        </select>
      </div>
      <ChapterPicker
        chapters={chapterOptions}
        value={selectedChapterId}
        onChange={handleChapterChange}
        disabled={isLoading || playbackSegments.length === 0}
      />
      <div className="card stack" aria-live="polite">
        <strong>Generate audio</strong>
        <fieldset className="generation-scope" disabled={isLoading || isEstimating || isGenerating}>
          <legend>Chapter scope</legend>
          <label className="row">
            <input
              type="radio"
              name="generation-scope"
              value="all"
              checked={generationMode === "all"}
              onChange={() => handleGenerationModeChange("all")}
            />
            <span>All chapters</span>
          </label>
          <label className="row">
            <input
              type="radio"
              name="generation-scope"
              value="selected"
              checked={generationMode === "selected"}
              onChange={() => handleGenerationModeChange("selected")}
            />
            <span>Selected chapters</span>
          </label>
        </fieldset>
        {generationMode === "selected" ? (
          <div className="stack">
            <div className="row">
              <button type="button" onClick={handleSelectAllGenerationChapters} disabled={chapterOptions.length === 0}>
                Select all
              </button>
              <button type="button" onClick={handleClearGenerationChapters} disabled={chapterOptions.length === 0}>
                Clear
              </button>
            </div>
            <ul className="chapter-list">
              {chapterOptions.map((chapter) => {
                const isChecked = selectedGenerationChapterIds.includes(chapter.id);
                return (
                  <li key={chapter.id}>
                    <label className="chapter-option">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleGenerationChapterToggle(chapter.id)}
                      />
                      <span>
                        {chapter.index + 1}. {chapter.title}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        <div className="row">
          <button type="button" onClick={handleEstimateGeneration} disabled={!canEstimate}>
            {isEstimating ? "Estimating..." : "Estimate"}
          </button>
          <button type="button" onClick={() => void handleGenerateAudio()} disabled={estimate === null || isGenerating}>
            {isGenerating ? "Generating..." : "Confirm + generate"}
          </button>
        </div>
        {estimate ? (
          <div className="estimate-grid" role="status">
            <p>Chars: {estimate.estimatedChars.toLocaleString()}</p>
            <p>Tokens: {estimate.estimatedTokens.toLocaleString()}</p>
            <p>Cost: ${estimate.estimatedCostUsd.toFixed(4)}</p>
            <p>Cache hit: {estimate.cacheHitPercent}%</p>
            {estimate.warnings.length > 0 ? <p>Warnings: {estimate.warnings.join(" | ")}</p> : null}
          </div>
        ) : null}
      </div>
      <PlayerControls
        isPlaying={isPlaying}
        disabled={isLoading || playbackSegments.length === 0}
        seekMs={cursor.positionMs}
        totalDurationMs={totalDurationMs}
        playbackRate={playbackRate}
        onTogglePlay={isPlaying ? handlePauseAndSave : handleTogglePlay}
        onSeek={handleSeek}
        onSeekRelative={handleSeekRelative}
        onPlaybackRateChange={setPlaybackRate}
      />
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleAudioEnded}
        onPause={() => {
          if (isPlaying) {
            void handlePauseAndSave();
          }
        }}
      />
      <div className="card stack" aria-live="polite">
        <strong>Downloads</strong>
        {playbackSegments.length === 0 ? (
          <p>No generated audio is available for this selection.</p>
        ) : (
          <ul className="chapter-list">
            {playbackSegments.map((segment) => (
              <li key={segment.chunkId}>
                <a href={segment.downloadUrl} download>
                  Download {segment.chunkId}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <JobProgress state={generationJobState ?? (isLoading ? "processing" : "done")} />
      {generationJobId ? <p>Job ID: {generationJobId}</p> : null}
      {generationJobState === "processing" ? <p>Job progress: {generationJobProgress}%</p> : null}
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <p className="reader-resume">Resume position: {Math.floor(resumePositionMs / 1000)}s</p>
      <A11yCueManager cue="reader_loaded" />
    </section>
  );
}
