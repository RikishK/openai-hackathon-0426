import type { DocumentChapter } from "@tts-reader/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPlayer, savePlayerResume } from "../api/client";
import { A11yCueManager } from "../components/A11yCueManager";
import { ChapterPicker } from "../components/ChapterPicker";
import { JobProgress } from "../components/JobProgress";
import { PlayerControls } from "../components/PlayerControls";
import type { LibraryDocumentEntry } from "./libraryState";
import {
  buildPlaybackSegments,
  getNextSegmentStart,
  getTotalDurationMs,
  type PlayableAudioChunk,
  resolvePlaybackCursor
} from "./readerState";

interface ReaderPageProps {
  documents: LibraryDocumentEntry[];
}

const DEFAULT_PROFILE_HASH = "default";

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

export function ReaderPage({ documents }: ReaderPageProps) {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>(documents[0]?.document.id ?? "");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("all");
  const [audioChunks, setAudioChunks] = useState<PlayableAudioChunk[]>([]);
  const [resumePositionMs, setResumePositionMs] = useState(0);
  const [seekMs, setSeekMs] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
  }, [selectedDocumentId]);

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
    if (selectedChapterId === "all") {
      return;
    }

    const chapterStillAvailable = chapterOptions.some((chapter) => chapter.id === selectedChapterId);
    if (!chapterStillAvailable) {
      setSelectedChapterId("all");
    }
  }, [chapterOptions, selectedChapterId]);

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

    const chapterId = selectedChapterId === "all" ? activeSegment?.chapterId ?? "all" : selectedChapterId;
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
      void audio.play().catch(() => {
        setIsPlaying(false);
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
        if (error instanceof Error) {
          if (isMountedRef.current) {
            setErrorMessage(`Unable to save resume position: ${error.message}`);
            return;
          }

          console.error(`Unable to save resume position: ${error.message}`);
        }
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
        if (error instanceof Error) {
          if (isMountedRef.current) {
            setErrorMessage(`Unable to save resume position: ${error.message}`);
            return;
          }

          console.error(`Unable to save resume position: ${error.message}`);
        }
      });
    };
  }, [selectedDocumentId]);

  function handleDocumentChange(documentId: string) {
    setSelectedDocumentId(documentId);
    setSelectedChapterId("all");
    setResumePositionMs(0);
    setSeekMs(0);
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
      if (error instanceof Error) {
        setErrorMessage(`Unable to save resume position: ${error.message}`);
      }
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
      <JobProgress state={isLoading ? "processing" : "done"} />
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      <p className="reader-resume">Resume position: {Math.floor(resumePositionMs / 1000)}s</p>
      <A11yCueManager cue="reader_loaded" />
    </section>
  );
}
