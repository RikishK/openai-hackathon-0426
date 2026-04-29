import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface AudioManifestEntry {
  id: string;
  chapterId: string;
  chunkIndex: number;
  filePath: string;
  durationMs: number;
}

export interface AudioManifest {
  documentId: string;
  profileHash: string;
  chunks: AudioManifestEntry[];
}

export interface FileStore {
  ensureStorageLayout(): Promise<void>;
  clearAudioCache(): Promise<void>;
  getDocumentDirectory(documentId: string): string;
  getDocumentSourcePath(documentId: string, extension: string): string;
  getAudioProfileDirectory(documentId: string, profileHash: string): string;
  getAudioChapterDirectory(documentId: string, profileHash: string, chapterIndex: number): string;
  getAudioChunkPath(documentId: string, profileHash: string, chapterIndex: number, chunkIndex: number): string;
  getAudioManifestPath(documentId: string, profileHash: string): string;
  readAudioManifest(documentId: string, profileHash: string): Promise<AudioManifest | null>;
  writeAudioManifest(manifest: AudioManifest): Promise<void>;
  getCueAudioPath(cueName: string): string;
}

export interface FileStoreOptions {
  dataRoot?: string;
}

function normalizeExtension(extension: string): string {
  return extension.startsWith(".") ? extension : `.${extension}`;
}

export function createFileStore(options: FileStoreOptions = {}): FileStore {
  const dataRoot = options.dataRoot ?? resolve(process.cwd(), "data");
  const documentsRoot = join(dataRoot, "documents");
  const audioRoot = join(dataRoot, "audio");
  const cuesRoot = join(dataRoot, "cues");
  const tempRoot = join(dataRoot, "temp");

  return {
    async ensureStorageLayout() {
      await mkdir(documentsRoot, { recursive: true });
      await mkdir(audioRoot, { recursive: true });
      await mkdir(cuesRoot, { recursive: true });
      await mkdir(tempRoot, { recursive: true });
    },
    async clearAudioCache() {
      await rm(audioRoot, { recursive: true, force: true });
      await mkdir(audioRoot, { recursive: true });
    },
    getDocumentDirectory(documentId) {
      return join(documentsRoot, documentId);
    },
    getDocumentSourcePath(documentId, extension) {
      return join(documentsRoot, documentId, `source${normalizeExtension(extension)}`);
    },
    getAudioProfileDirectory(documentId, profileHash) {
      return join(audioRoot, documentId, profileHash);
    },
    getAudioChapterDirectory(documentId, profileHash, chapterIndex) {
      return join(audioRoot, documentId, profileHash, `chapter-${String(chapterIndex).padStart(3, "0")}`);
    },
    getAudioChunkPath(documentId, profileHash, chapterIndex, chunkIndex) {
      return join(
        audioRoot,
        documentId,
        profileHash,
        `chapter-${String(chapterIndex).padStart(3, "0")}`,
        `chunk-${String(chunkIndex).padStart(4, "0")}.mp3`
      );
    },
    getAudioManifestPath(documentId, profileHash) {
      return join(audioRoot, documentId, profileHash, "manifest.json");
    },
    async readAudioManifest(documentId, profileHash) {
      const manifestPath = join(audioRoot, documentId, profileHash, "manifest.json");

      try {
        const source = await readFile(manifestPath, "utf8");
        return JSON.parse(source) as AudioManifest;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }
        throw error;
      }
    },
    async writeAudioManifest(manifest) {
      const manifestPath = join(audioRoot, manifest.documentId, manifest.profileHash, "manifest.json");
      await mkdir(join(audioRoot, manifest.documentId, manifest.profileHash), { recursive: true });
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    },
    getCueAudioPath(cueName) {
      return join(cuesRoot, `${cueName}.mp3`);
    }
  };
}
