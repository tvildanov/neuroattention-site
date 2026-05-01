-- Migration 016: Create practices table for audio practices management
-- Safe: CREATE TABLE IF NOT EXISTS, no existing data affected

CREATE TABLE IF NOT EXISTS practices (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL,
  block_id TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT 'ru',
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  order_idx INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practices_block_lang ON practices(block_id, lang);
CREATE INDEX IF NOT EXISTS idx_practices_slug ON practices(slug);
CREATE INDEX IF NOT EXISTS idx_practices_order ON practices(block_id, lang, order_idx);
