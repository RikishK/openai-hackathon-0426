# Scope Requirements (V1)

- Local-first app: browser UI + local server, no cloud backend.
- User provides OpenAI API key in local config file.
- Inputs: PDF upload, pasted/typed text, article URL.
- URL extraction uses Mozilla Readability only; on fetch/extraction failure, show error and ask user to paste text manually.
- PDF support is text-based PDFs only (no OCR in v1).
- PDF chapter splitting when chapter labels are detectable; users can process/read entire document or selected chapters.
- Processing model: explicit `Generate` action; no live streaming during generation; users can queue/process multiple items for later listening.
- Audio features: in-app playback and downloadable files.
- Reader controls: play/pause/seek/speed and per-source resume (timestamp restore).
- Voice scope: multiple English voices.
- Cost UX: estimate usage/cost before generation and require user confirmation.
- Cache: local audio cache reused for same source/settings; manual clear only.
- Accessibility: keyboard navigation and generated spoken UI cues (for example `next_button.mp3`) for orientation.

# Non-Goals (V1)

- OCR for scanned/image PDFs.
- Dialogue-aware voice switching.
- Sentence-highlight viewer synced during playback (planned later).
- URL extraction fallbacks beyond Readability.

# Architecture Direction (High-Level)

- Frontend (local web app)
  - Library view (uploaded/processed items)
  - Ingest forms (PDF/text/URL)
  - Chapter picker for PDFs when chapters are detected
  - Generate workflow (estimate -> confirm -> process)
  - Accessible player (keyboard-first controls + resume)
  - Settings (API key, cache clear, voice defaults)
- Local backend (Node/TypeScript)
  - Ingestion adapters: PDF extractor, Readability URL extractor, plain text input
  - PDF chapter detector (TOC/bookmarks/headings heuristics)
  - Text normalization + chunking service
  - Cost estimator
  - OpenAI audio generation orchestrator
  - Cache manager + file storage
  - Metadata store + job state manager
  - Static audio serving for playback/download/UI cue sounds
- Storage
  - SQLite (documents, chapters, jobs, resume, cache index)
  - Local filesystem (audio binaries + source artifacts)

# Core Data Model (Future-Proofed)

- `SourceDocument`: id, type (`pdf|text|url`), source_hash, title, raw_text_hash, created_at.
- `DocumentChapter`: id, doc_id, chapter_index, title, start_char, end_char, start_page, end_page, detection_method.
- `GenerationProfile`: voice, model, speed/options, prompt_style, profile_hash.
- `TextChunk`: doc_id, chapter_id (nullable), chunk_index, text, char_start, char_end, sentence_refs (optional).
- `AudioChunk`: doc_id, chapter_id (nullable), profile_hash, chunk_index, file_path, duration_ms, status, checksum.
- `GenerationJob`: doc_id, chapter_scope (`all|selected`), chapter_ids, profile_hash, estimated_chars, estimated_cost, state, error, timestamps.
- `ResumeState`: doc_id, chapter_id (nullable), profile_hash, playback_position_ms, updated_at.
- `UiCueAudio`: cue_name, file_path, voice/profile, checksum.

Future hooks for sentence-sync viewer and dialogue splitting (not implemented in v1):

- `sentence_id`, `sentence_start_char`, `sentence_end_char`
- optional `audio_start_ms`, `audio_end_ms`
- optional `speaker_hint`, `voice_hint`

# Cache Key Strategy

- Reuse audio when `content_hash + generation_profile_hash + chunking_version` matches.
- Include chapter scope in content hash input so per-chapter generations are independently cacheable.
- Manual clear deletes audio files and cache index rows together.
