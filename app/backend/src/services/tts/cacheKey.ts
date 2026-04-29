import type { VoiceProfile } from "@tts-reader/shared";
import { createHash } from "node:crypto";

const CHUNKING_VERSION = "v1";

export function toSha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function createProfileHash(profile: VoiceProfile): string {
  return toSha256Hex(`${profile.model}:${profile.voice}:${profile.speed}`);
}

export function createChunkCacheKey(input: {
  documentId: string;
  chapterId: string;
  profileHash: string;
  chunkText: string;
}): string {
  const contentHash = toSha256Hex(`${input.documentId}:${input.chapterId}:${input.chunkText}`);
  return `ac_${toSha256Hex(`${contentHash}:${input.profileHash}:${CHUNKING_VERSION}`)}`;
}
