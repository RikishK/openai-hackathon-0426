import type { DocumentChapter } from "@tts-reader/shared";

interface ChapterPickerProps {
  chapters: DocumentChapter[];
}

export function ChapterPicker({ chapters }: ChapterPickerProps) {
  return (
    <div className="card stack">
      <strong>Chapter scope</strong>
      <select aria-label="Chapter selection" defaultValue={chapters[0]?.id}>
        {chapters.map((chapter) => (
          <option key={chapter.id} value={chapter.id}>
            {chapter.index}. {chapter.title}
          </option>
        ))}
      </select>
    </div>
  );
}
