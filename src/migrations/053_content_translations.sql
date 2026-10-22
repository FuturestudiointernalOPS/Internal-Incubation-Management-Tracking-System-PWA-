-- =============================================================================
-- CONTENT TRANSLATION MEMORY
--
-- Venture work (milestone, activity and deliverable titles, their definitions
-- of done, the names of the Journey stage they sit in) is written in ONE
-- language and displayed in the reader's. Translating it at render time, per
-- field, means hundreds of provider calls for one screen and a dead free quota
-- by lunchtime.
--
-- This table remembers each distinct text per language pair, so:
--   • the same word printed on nine rows is translated once;
--   • the second visit reaches the provider for nothing at all;
--   • an edit needs no invalidation — the key is a hash of the TEXT, so new
--     wording is a new key and the old translation is simply never asked for.
--
-- Purely additive — no existing table is modified, and a missing row only means
-- "translate this once", never an error.
-- =============================================================================

CREATE TABLE IF NOT EXISTS content_translations (
  id SERIAL PRIMARY KEY,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  source_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  provider TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- The lookup key: one row per (from, to, text). Also what makes the batched
-- upsert idempotent, so a retry can never duplicate or overwrite a translation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_translations_key
  ON content_translations (source_lang, target_lang, source_hash);

-- Which Venture was last warmed, so the scheduled sweep rotates across the whole
-- portfolio instead of re-checking the same first page on every run.
CREATE TABLE IF NOT EXISTS content_translation_sweeps (
  venture_ref TEXT PRIMARY KEY,
  swept_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
