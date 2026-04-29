export function PlayerControls() {
  return (
    <div className="card stack" role="group" aria-label="Playback controls">
      <strong>Playback</strong>
      <div>
        <button type="button">Play</button>{" "}
        <button type="button">Pause</button>{" "}
        <button type="button">Stop</button>
      </div>
    </div>
  );
}
