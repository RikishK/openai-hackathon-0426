export interface ChapterDetectionInput {
  text: string;
  outlineTitles: string[];
  pageCount: number;
}

export interface DetectedChapter {
  index: number;
  title: string;
  startPage?: number;
  endPage?: number;
}

export interface ChapterDetectionResult {
  detectionMethod: "outline" | "heading-heuristic" | "fallback";
  chapters: DetectedChapter[];
}

const CHAPTER_HEADING_PATTERN = /^(chapter\s+(?:\d+|[ivxlcdm]+)\b.*|(?:part|section)\s+(?:\d+|[ivxlcdm]+)\b.*|\d{1,2}\.\s+.+)$/i;

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 140);
}

function fromOutlines(outlineTitles: string[], pageCount: number): DetectedChapter[] {
  const normalizedTitles = outlineTitles.map((title) => normalizeTitle(title)).filter((title) => title.length > 0);

  return normalizedTitles.map((title, index) => {
    const chapter: DetectedChapter = {
      index,
      title
    };

    if (pageCount > 0) {
      const approxStart = Math.floor((index * pageCount) / normalizedTitles.length) + 1;
      const approxEnd =
        index === normalizedTitles.length - 1
          ? pageCount
          : Math.floor(((index + 1) * pageCount) / normalizedTitles.length);
      chapter.startPage = approxStart;
      chapter.endPage = Math.max(approxStart, approxEnd);
    }

    return chapter;
  });
}

function fromHeadings(text: string): DetectedChapter[] {
  const lines = text
    .split("\n")
    .map((line) => normalizeTitle(line))
    .filter((line) => line.length > 0);

  const seen = new Set<string>();
  const chapters: DetectedChapter[] = [];

  for (const line of lines) {
    if (!CHAPTER_HEADING_PATTERN.test(line)) {
      continue;
    }

    if (seen.has(line)) {
      continue;
    }

    chapters.push({
      index: chapters.length,
      title: line
    });
    seen.add(line);

    if (chapters.length >= 30) {
      break;
    }
  }

  return chapters;
}

export function detectPdfChapters(input: ChapterDetectionInput): ChapterDetectionResult {
  const chaptersFromOutline = fromOutlines(input.outlineTitles, input.pageCount);
  if (chaptersFromOutline.length > 0) {
    return {
      detectionMethod: "outline",
      chapters: chaptersFromOutline
    };
  }

  const chaptersFromHeadings = fromHeadings(input.text);
  if (chaptersFromHeadings.length > 0) {
    return {
      detectionMethod: "heading-heuristic",
      chapters: chaptersFromHeadings
    };
  }

  return {
    detectionMethod: "fallback",
    chapters: [
      {
        index: 0,
        title: "Full document"
      }
    ]
  };
}
