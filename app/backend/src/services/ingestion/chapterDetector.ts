import type { ExtractedPdfPage } from "./pdfExtractor.js";

const CHAPTER_HEADING_PATTERN = /^(chapter|section|part)\s+[\p{L}\p{N}][\p{L}\p{N}\s:.-]{0,120}$/iu;
const NUMBERED_HEADING_PATTERN = /^\d{1,2}(\.\d{1,2})*\s+[\p{L}][\p{L}\p{N}\s:.-]{2,120}$/u;

export interface ChapterDetectionResult {
  chapters: Array<{
    index: number;
    title: string;
    startPage: number;
    endPage: number;
    detectionMethod: string;
  }>;
  warnings: string[];
}

interface ChapterCandidate {
  title: string;
  startPage: number;
}

function isChapterHeading(line: string): boolean {
  return CHAPTER_HEADING_PATTERN.test(line) || NUMBERED_HEADING_PATTERN.test(line);
}

function getChapterCandidates(pages: ExtractedPdfPage[]): ChapterCandidate[] {
  const candidates: ChapterCandidate[] = [];

  for (const page of pages) {
    const pageLines = page.text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 12);

    for (const line of pageLines) {
      if (!isChapterHeading(line)) {
        continue;
      }

      const previousCandidate = candidates.at(-1);
      if (previousCandidate && previousCandidate.title === line) {
        continue;
      }

      candidates.push({
        title: line,
        startPage: page.pageNumber
      });
      break;
    }
  }

  return candidates;
}

export function detectPdfChapters(pages: ExtractedPdfPage[]): ChapterDetectionResult {
  if (pages.length === 0) {
    throw new Error("Cannot detect chapters from an empty page list");
  }

  const chapterCandidates = getChapterCandidates(pages);
  if (chapterCandidates.length === 0) {
    return {
      chapters: [],
      warnings: ["No chapter headings were detected in the PDF"]
    };
  }

  const chapters = chapterCandidates.map((candidate, index) => {
    const nextChapter = chapterCandidates[index + 1];
    return {
      index,
      title: candidate.title,
      startPage: candidate.startPage,
      endPage: nextChapter ? Math.max(candidate.startPage, nextChapter.startPage - 1) : pages.length,
      detectionMethod: "heading_heuristic"
    };
  });

  return {
    chapters,
    warnings: []
  };
}
