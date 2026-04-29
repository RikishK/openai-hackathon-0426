export interface ChunkedTextSegment {
  chunkIndex: number;
  text: string;
  charStart: number;
  charEnd: number;
}

const DEFAULT_MAX_CHARS_PER_CHUNK = 1200;

interface Range {
  start: number;
  end: number;
}

function splitIntoSentenceRanges(text: string): Range[] {
  const ranges: Range[] = [];
  const matcher = /[^.!?]+[.!?]*\s*/g;

  let match = matcher.exec(text);
  while (match) {
    const value = match[0];
    ranges.push({
      start: match.index,
      end: match.index + value.length
    });
    match = matcher.exec(text);
  }

  if (ranges.length === 0 && text.length > 0) {
    ranges.push({ start: 0, end: text.length });
  }

  return ranges;
}

function pushChunk(chunks: ChunkedTextSegment[], text: string, start: number, end: number): void {
  const value = text.slice(start, end);
  if (value.trim().length === 0) {
    return;
  }

  chunks.push({
    chunkIndex: chunks.length,
    text: value,
    charStart: start,
    charEnd: end
  });
}

export function chunkNormalizedText(text: string, maxCharsPerChunk = DEFAULT_MAX_CHARS_PER_CHUNK): ChunkedTextSegment[] {
  if (text.length === 0) {
    return [];
  }

  const chunks: ChunkedTextSegment[] = [];
  const sentenceRanges = splitIntoSentenceRanges(text);
  let currentStart: number | null = null;
  let currentEnd = 0;

  for (const sentenceRange of sentenceRanges) {
    const sentenceLength = sentenceRange.end - sentenceRange.start;

    if (sentenceLength > maxCharsPerChunk) {
      if (currentStart !== null) {
        pushChunk(chunks, text, currentStart, currentEnd);
        currentStart = null;
      }

      let splitStart = sentenceRange.start;
      while (splitStart < sentenceRange.end) {
        const splitEnd = Math.min(sentenceRange.end, splitStart + maxCharsPerChunk);
        pushChunk(chunks, text, splitStart, splitEnd);
        splitStart = splitEnd;
      }

      continue;
    }

    if (currentStart === null) {
      currentStart = sentenceRange.start;
      currentEnd = sentenceRange.end;
      continue;
    }

    const nextLength = sentenceRange.end - currentStart;
    if (nextLength <= maxCharsPerChunk) {
      currentEnd = sentenceRange.end;
      continue;
    }

    pushChunk(chunks, text, currentStart, currentEnd);
    currentStart = sentenceRange.start;
    currentEnd = sentenceRange.end;
  }

  if (currentStart !== null) {
    pushChunk(chunks, text, currentStart, currentEnd);
  }

  return chunks;
}
