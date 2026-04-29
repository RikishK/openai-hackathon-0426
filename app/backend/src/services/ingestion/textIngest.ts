import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getStorageContext } from "../storage/db.js";

const SOURCE_TEXT_EXTENSION = "txt";

export async function persistDocumentSourceText(documentId: string, text: string): Promise<void> {
  const storage = getStorageContext();
  const sourcePath = storage.fileStore.getDocumentSourcePath(documentId, SOURCE_TEXT_EXTENSION);
  await mkdir(dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, text, "utf8");
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
