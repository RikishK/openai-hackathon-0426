export interface ChunkedTextSegment {
  chunkIndex: number;
  text: string;
  charStart: number;
  charEnd: number;
}

const DEFAULT_MAX_CHARS_PER_CHUNK = 1200;

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function chunkNormalizedText(text: string, maxCharsPerChunk = DEFAULT_MAX_CHARS_PER_CHUNK): ChunkedTextSegment[] {
  if (text.length === 0) {
    return [];
  }

  const chunks: ChunkedTextSegment[] = [];
  const sentences = splitIntoSentences(text);
  let currentChunk = "";
  let chunkStart = 0;

  const commitCurrentChunk = (): void => {
    const value = currentChunk.trim();
    if (value.length === 0) {
      return;
    }

    const start = chunkStart;
    const end = chunkStart + value.length;
    chunks.push({
      chunkIndex: chunks.length,
      text: value,
      charStart: start,
      charEnd: end
    });
    chunkStart = end;
    currentChunk = "";
  };

  for (const sentence of sentences) {
    const candidate = currentChunk.length === 0 ? sentence : `${currentChunk} ${sentence}`;
    if (candidate.length <= maxCharsPerChunk) {
      currentChunk = candidate;
      continue;
    }

    commitCurrentChunk();

    if (sentence.length <= maxCharsPerChunk) {
      currentChunk = sentence;
      continue;
    }

    let offset = 0;
    while (offset < sentence.length) {
      const part = sentence.slice(offset, offset + maxCharsPerChunk).trim();
      if (part.length > 0) {
        chunks.push({
          chunkIndex: chunks.length,
          text: part,
          charStart: chunkStart,
          charEnd: chunkStart + part.length
        });
        chunkStart += part.length;
      }
      offset += maxCharsPerChunk;
    }
  }

  commitCurrentChunk();
  return chunks;
}
