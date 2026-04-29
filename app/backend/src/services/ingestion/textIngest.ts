import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getStorageContext } from "../storage/db.js";
import type { FileStore } from "../storage/fileStore.js";

const SOURCE_TEXT_EXTENSION = "txt";

export interface TextIngestResult {
  title: string;
  text: string;
}

export class TextIngestValidationError extends Error {
  readonly code: "INVALID_TEXT_INPUT";

  constructor(message: string) {
    super(message);
    this.code = "INVALID_TEXT_INPUT";
    this.name = "TextIngestValidationError";
  }
}

export function normalizeIngestText(input: string): string {
  return input.replace(/\r\n?/g, "\n").trim();
}

export function prepareTextIngest(input: { title: string; text: string }): TextIngestResult {
  const normalizedTitle = input.title.trim();
  if (normalizedTitle.length === 0) {
    throw new TextIngestValidationError("Text title is required.");
  }

  const normalizedText = normalizeIngestText(input.text);
  if (normalizedText.length === 0) {
    throw new TextIngestValidationError("Text content is required.");
  }

  return {
    title: normalizedTitle,
    text: normalizedText
  };
}

export async function persistTextSource(fileStore: FileStore, documentId: string, text: string): Promise<void> {
  const sourcePath = fileStore.getDocumentSourcePath(documentId, SOURCE_TEXT_EXTENSION);
  await mkdir(dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, text, "utf8");
}

export async function persistDocumentSourceText(documentId: string, text: string): Promise<void> {
  const storage = getStorageContext();
  await persistTextSource(storage.fileStore, documentId, text);
}

export async function loadDocumentSourceText(documentId: string): Promise<string | null> {
  const storage = getStorageContext();
  const sourcePath = storage.fileStore.getDocumentSourcePath(documentId, SOURCE_TEXT_EXTENSION);

  try {
    return await readFile(sourcePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}
