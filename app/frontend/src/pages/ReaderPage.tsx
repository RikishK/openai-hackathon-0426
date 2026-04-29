import { A11yCueManager } from "../components/A11yCueManager";
import { ChapterPicker } from "../components/ChapterPicker";
import { JobProgress } from "../components/JobProgress";
import { PlayerControls } from "../components/PlayerControls";

export function ReaderPage() {
  return (
    <section className="stack" aria-labelledby="reader-title">
      <h2 id="reader-title">Reader</h2>
      <ChapterPicker
        chapters={[
          { id: "all", index: 0, title: "Full document" },
          { id: "ch1", index: 1, title: "Chapter 1" }
        ]}
      />
      <PlayerControls />
      <JobProgress state="queued" />
      <A11yCueManager cue="reader_loaded" />
    </section>
  );
}
