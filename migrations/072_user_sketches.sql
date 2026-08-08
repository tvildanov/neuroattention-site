-- Migration 072: Sketch tool — per-user freehand sketches
CREATE TABLE IF NOT EXISTS user_sketches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  strokes JSONB NOT NULL DEFAULT '[]'::jsonb,
  png_data_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_sketches_user ON user_sketches(user_id, updated_at DESC);
