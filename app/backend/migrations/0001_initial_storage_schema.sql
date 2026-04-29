CREATE TABLE IF NOT EXISTS source_documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'text', 'url')),
  title TEXT NOT NULL,
  source_hash TEXT,
  raw_text_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_chapters (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  chapter_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  start_char INTEGER,
  end_char INTEGER,
  start_page INTEGER,
  end_page INTEGER,
  detection_method TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (doc_id) REFERENCES source_documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS document_chapters_doc_id_idx
  ON document_chapters (doc_id, chapter_index);

CREATE TABLE IF NOT EXISTS generation_profiles (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  voice TEXT NOT NULL,
  speed REAL NOT NULL,
  prompt_style TEXT,
  profile_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  chapter_scope TEXT NOT NULL CHECK (chapter_scope IN ('all', 'selected')),
  chapter_ids_json TEXT NOT NULL,
  profile_hash TEXT NOT NULL,
  estimated_chars INTEGER NOT NULL,
  estimated_cost REAL NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  state TEXT NOT NULL CHECK (state IN ('queued', 'processing', 'done', 'failed')),
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (doc_id) REFERENCES source_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_hash) REFERENCES generation_profiles(profile_hash)
);

CREATE INDEX IF NOT EXISTS generation_jobs_doc_id_idx
  ON generation_jobs (doc_id, created_at DESC);

CREATE TABLE IF NOT EXISTS text_chunks (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  chapter_id TEXT,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  char_start INTEGER NOT NULL,
  char_end INTEGER NOT NULL,
  sentence_id TEXT,
  audio_start_ms INTEGER,
  audio_end_ms INTEGER,
  speaker_hint TEXT,
  voice_hint TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (doc_id) REFERENCES source_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES document_chapters(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS text_chunks_doc_chapter_idx
  ON text_chunks (doc_id, chapter_id, chunk_index);

CREATE TABLE IF NOT EXISTS audio_chunks (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  profile_hash TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  duration_ms INTEGER,
  checksum TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'failed')),
  sentence_id TEXT,
  audio_start_ms INTEGER,
  audio_end_ms INTEGER,
  speaker_hint TEXT,
  voice_hint TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (doc_id) REFERENCES source_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES document_chapters(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_hash) REFERENCES generation_profiles(profile_hash)
);

CREATE INDEX IF NOT EXISTS audio_chunks_doc_profile_idx
  ON audio_chunks (doc_id, profile_hash, chunk_index);

CREATE TABLE IF NOT EXISTS resume_states (
  doc_id TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  profile_hash TEXT NOT NULL,
  playback_position_ms INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (doc_id, chapter_id, profile_hash),
  FOREIGN KEY (doc_id) REFERENCES source_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (chapter_id) REFERENCES document_chapters(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_hash) REFERENCES generation_profiles(profile_hash)
);

CREATE TABLE IF NOT EXISTS ui_cue_audio (
  cue_name TEXT NOT NULL,
  profile_hash TEXT NOT NULL,
  file_path TEXT NOT NULL,
  checksum TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (cue_name, profile_hash),
  FOREIGN KEY (profile_hash) REFERENCES generation_profiles(profile_hash)
);
