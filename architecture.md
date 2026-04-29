# TTS Reader Architecture (V1)

## 1) Goals and Constraints

- Local-only deployment: browser UI and local server on the same machine.
- User-managed OpenAI API key stored in local config.
- Inputs: PDF, text, URL (Readability extraction only for URL).
- No OCR in v1.
- Generation is an explicit batch step (`Generate`), then playback/download.
- Cache generated audio locally and avoid duplicate API calls.
- Accessibility-first baseline: keyboard navigation and spoken UI cues.
- PDF chapter-level generation/playback when chapter labels can be detected.

## 2) System Overview

```text
Browser UI (React)
  -> Local API Server (Node/TypeScript)
      -> Ingestion Layer (PDF/Text/URL+Readability)
      -> Chapter Detection (PDF only)
      -> Normalization + Chunking
      -> Estimator (token/char + cost)
      -> Generation Orchestrator (OpenAI audio model)
      -> Cache Manager
      -> Storage Layer (SQLite + local files)
```

## 3) Recommended Tech Stack

- Frontend: React + TypeScript + Vite.
- Backend: Node.js + TypeScript + Fastify (or Express).
- DB: SQLite via Prisma or Drizzle.
- Queue/jobs: simple SQLite-backed job table + worker loop (single-process initially).
- PDF parsing: `pdfjs-dist` (text extraction + outlines/bookmarks when available).
- URL readability: `@mozilla/readability` + `jsdom`.
- Audio playback: native HTML audio + custom accessible controls.

## 4) Directory Structure

```text
.
├── architecture.md
├── scope.md
├── app/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── LibraryPage.tsx
│   │   │   │   ├── IngestPage.tsx
│   │   │   │   ├── ReaderPage.tsx
│   │   │   │   └── SettingsPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── ChapterPicker.tsx
│   │   │   │   ├── PlayerControls.tsx
│   │   │   │   ├── JobProgress.tsx
│   │   │   │   └── A11yCueManager.tsx
│   │   │   ├── api/client.ts
│   │   │   ├── state/
│   │   │   └── styles/
│   │   └── package.json
│   ├── backend/
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── routes/
│   │   │   │   ├── ingest.ts
│   │   │   │   ├── estimate.ts
│   │   │   │   ├── generate.ts
│   │   │   │   ├── jobs.ts
│   │   │   │   ├── library.ts
│   │   │   │   ├── player.ts
│   │   │   │   ├── settings.ts
│   │   │   │   └── cache.ts
│   │   │   ├── services/
│   │   │   │   ├── ingestion/
│   │   │   │   │   ├── pdfExtractor.ts
│   │   │   │   │   ├── chapterDetector.ts
│   │   │   │   │   ├── urlExtractor.ts
│   │   │   │   │   └── textIngest.ts
│   │   │   │   ├── chunking/
│   │   │   │   │   ├── normalizer.ts
│   │   │   │   │   └── chunker.ts
│   │   │   │   ├── tts/
│   │   │   │   │   ├── estimator.ts
│   │   │   │   │   ├── generator.ts
│   │   │   │   │   └── cacheKey.ts
│   │   │   │   ├── jobs/
│   │   │   │   │   ├── scheduler.ts
│   │   │   │   │   └── worker.ts
│   │   │   │   ├── a11y/
│   │   │   │   │   └── cueAudio.ts
│   │   │   │   └── storage/
│   │   │   │       ├── db.ts
│   │   │   │       ├── repositories/
│   │   │   │       └── fileStore.ts
│   │   │   └── types/
│   │   └── package.json
│   └── shared/
│       └── src/contracts.ts
├── data/
│   ├── app.db
│   ├── documents/
│   ├── audio/
│   ├── cues/
│   └── temp/
└── config/
    └── local.json
```

## 5) Key Domain Objects

- `SourceDocument`
  - `id`, `type` (`pdf|text|url`), `title`, `source_hash`, `raw_text_hash`, `created_at`
- `DocumentChapter`
  - `id`, `doc_id`, `chapter_index`, `title`, `start_char`, `end_char`, `start_page`, `end_page`, `detection_method`
- `GenerationProfile`
  - `id`, `model`, `voice`, `speed`, `prompt_style`, `profile_hash`
- `GenerationJob`
  - `id`, `doc_id`, `chapter_scope` (`all|selected`), `chapter_ids_json`, `profile_hash`, `estimated_chars`, `estimated_cost`, `state`, `error`, `created_at`, `updated_at`
- `TextChunk`
  - `id`, `doc_id`, `chapter_id`, `chunk_index`, `text`, `char_start`, `char_end`
- `AudioChunk`
  - `id`, `doc_id`, `chapter_id`, `profile_hash`, `chunk_index`, `file_path`, `duration_ms`, `checksum`, `status`
- `ResumeState`
  - `doc_id`, `chapter_id`, `profile_hash`, `playback_position_ms`, `updated_at`
- `UiCueAudio`
  - `cue_name`, `profile_hash`, `file_path`, `checksum`

Future-ready (nullable, not used in v1): `sentence_id`, `audio_start_ms`, `audio_end_ms`, `speaker_hint`, `voice_hint`.

## 6) Chapter Detection Strategy (PDF)

Run in this order:

1. PDF outline/bookmark parsing (best signal).
2. Heading heuristic from extracted text (patterns like `Chapter 1`, `CHAPTER I`, numbered top-level headings).
3. Page-based fallback: no chapters found -> expose single "Full Document" option.

Detection output is stored as `DocumentChapter[]` so user can choose specific chapters before estimating/generating.

## 7) Processing Pipeline

1. Ingest source (`pdf|text|url`).
2. Extract normalized text.
3. For PDFs, detect chapter boundaries.
4. User selects generation scope (`all` or selected chapters).
5. Estimate characters/tokens/cost and show confirmation.
6. Create `GenerationJob`.
7. Worker chunks selected text, checks cache, generates missing chunks with OpenAI audio model.
8. Persist chunk metadata and final playable manifest.
9. Reader page loads audio, supports playback/download/resume.

## 8) API Contracts (V1)

All endpoints are local (for example `http://localhost:4310/api`).

### `POST /api/ingest/pdf`

- Request: multipart file upload.
- Response:

```json
{
  "document": {
    "id": "doc_123",
    "title": "My Book",
    "type": "pdf"
  },
  "chapters": [
    {"id": "ch_1", "index": 1, "title": "Chapter 1", "startPage": 5, "endPage": 22}
  ],
  "warnings": ["Large file: generation may be slow"]
}
```

### `POST /api/ingest/text`

- Request:

```json
{
  "title": "Custom Text",
  "text": "..."
}
```

- Response: `document` object, no chapters by default.

### `POST /api/ingest/url`

- Request:

```json
{
  "url": "https://example.com/article"
}
```

- Behavior: fetch + Readability extraction only.
- Failure response example:

```json
{
  "error": "READABILITY_EXTRACTION_FAILED",
  "message": "Could not extract readable text. Please copy and paste the article text."
}
```

### `POST /api/estimate`

- Request:

```json
{
  "documentId": "doc_123",
  "chapterScope": {"mode": "selected", "chapterIds": ["ch_1", "ch_2"]},
  "profile": {"model": "gpt-audio-1.5", "voice": "alloy", "speed": 1.0}
}
```

- Response:

```json
{
  "estimatedChars": 74210,
  "estimatedTokens": 19500,
  "estimatedCostUsd": 1.48,
  "cacheHitPercent": 35,
  "warnings": ["Long generation time expected"]
}
```

### `POST /api/generate`

- Request: same payload as estimate + `confirmedEstimate: true`.
- Response:

```json
{
  "jobId": "job_987",
  "state": "queued"
}
```

### `GET /api/jobs/:jobId`

- Response:

```json
{
  "jobId": "job_987",
  "state": "running",
  "progress": {"completedChunks": 18, "totalChunks": 42},
  "error": null
}
```

### `GET /api/library`

- Lists documents, available chapters, and generation states.

### `GET /api/library/:documentId/audio-manifest?profileHash=...&chapterId=...`

- Returns ordered chunk files and durations for player.

### `POST /api/player/resume`

- Request:

```json
{
  "documentId": "doc_123",
  "chapterId": "ch_1",
  "profileHash": "prof_abc",
  "playbackPositionMs": 91234
}
```

### `GET /api/player/resume?documentId=...&chapterId=...&profileHash=...`

- Returns last saved position.

### `POST /api/settings/api-key`

- Stores API key in `config/local.json`.

### `POST /api/cache/clear`

- Clears generated audio and cache index (manual only).

### `GET /api/a11y/cues`

- Returns available spoken UI cue files.

## 9) Local Storage Layout

- `data/documents/<docId>/source.*` original source snapshot.
- `data/audio/<docId>/<profileHash>/chapter-<n>/chunk-<m>.mp3` generated audio chunks.
- `data/audio/<docId>/<profileHash>/manifest.json` ordered playback metadata.
- `data/cues/<cueName>.mp3` generated accessibility cue audio.

## 10) Caching Rules

- Cache key: `sha256(content_hash + profile_hash + chunking_version + model_version)`.
- For chapter generation, `content_hash` is based on selected chapter text ranges only.
- If all required chunk keys exist, job can complete without OpenAI calls.

## 11) Accessibility Baseline

- Fully keyboard-navigable controls for ingest, chapter selection, generation, and playback.
- Clear focus order and visible focus indicators.
- ARIA labels for all controls.
- Spoken cue audio files for key actions and navigation landmarks.

## 12) Error Handling and UX Guarantees

- URL extraction failures return actionable guidance (paste text fallback).
- Soft limits produce warnings (large file, high estimated cost, long generation time) but do not block.
- Job failures keep partial progress and allow retry for missing chunks.

## 13) Planned Extension Points (Post-V1)

- Sentence-level timing map for sync viewer.
- Dialogue-aware multi-voice rendering.
- Optional OCR pipeline for scanned PDFs.
- Stronger API key storage (OS keychain) as a future security upgrade.
