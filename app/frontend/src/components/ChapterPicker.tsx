import type { DocumentChapter } from "@tts-reader/shared";

interface ChapterPickerProps {
  chapters: DocumentChapter[];
  value: string;
  onChange(chapterId: string): void;
  disabled?: boolean;
}

export function ChapterPicker({ chapters, value, onChange, disabled = false }: ChapterPickerProps) {
  return (
    <div className="card stack">
      <label htmlFor="reader-chapter-selection">
        <strong>Chapter scope</strong>
      </label>
      <select
        id="reader-chapter-selection"
        aria-label="Chapter selection"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="all">All chapters</option>
        {chapters.map((chapter) => (
          <option key={chapter.id} value={chapter.id}>
            {chapter.index + 1}. {chapter.title}
          </option>
        ))}
      </select>
    </div>
  );
}
