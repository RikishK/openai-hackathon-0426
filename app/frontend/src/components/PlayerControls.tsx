import type { KeyboardEvent } from "react";

interface PlayerControlsProps {
  isPlaying: boolean;
  disabled: boolean;
  seekMs: number;
  totalDurationMs: number;
  playbackRate: number;
  onTogglePlay(): void;
  onSeek(positionMs: number): void;
  onSeekRelative(deltaMs: number): void;
  onPlaybackRateChange(rate: number): void;
}

const PLAYBACK_SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PlayerControls({
  isPlaying,
  disabled,
  seekMs,
  totalDurationMs,
  playbackRate,
  onTogglePlay,
  onSeek,
  onSeekRelative,
  onPlaybackRateChange
}: PlayerControlsProps) {
  function handleKeyboardShortcuts(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      onTogglePlay();
      return;
    }

    if (event.code === "ArrowRight") {
      event.preventDefault();
      onSeekRelative(10000);
      return;
    }

    if (event.code === "ArrowLeft") {
      event.preventDefault();
      onSeekRelative(-10000);
    }
  }

  return (
    <div
      className="card stack"
      role="group"
      aria-label="Playback controls"
      tabIndex={0}
      onKeyDown={handleKeyboardShortcuts}
    >
      <strong>Playback</strong>
      <div className="row">
        <button type="button" onClick={onTogglePlay} disabled={disabled}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={() => onSeekRelative(-10000)} disabled={disabled}>
          -10s
        </button>
        <button type="button" onClick={() => onSeekRelative(10000)} disabled={disabled}>
          +10s
        </button>
      </div>
      <div className="stack">
        <label htmlFor="reader-seek">Position</label>
        <input
          id="reader-seek"
          type="range"
          min={0}
          max={totalDurationMs}
          value={seekMs}
          disabled={disabled || totalDurationMs === 0}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <p className="player-time" aria-live="polite">
          {formatDuration(seekMs)} / {formatDuration(totalDurationMs)}
        </p>
      </div>
      <div className="stack">
        <label htmlFor="reader-speed">Speed</label>
        <select
          id="reader-speed"
          value={String(playbackRate)}
          disabled={disabled}
          onChange={(event) => onPlaybackRateChange(Number(event.target.value))}
        >
          {PLAYBACK_SPEED_OPTIONS.map((value) => (
            <option key={value} value={String(value)}>
              {value}x
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
