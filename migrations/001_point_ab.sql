-- ══════════════════════════════════════════
-- Migration 001: Точка А → Точка B module
-- MVP version — user_id is TEXT (no auth yet)
-- Tables already created via Neon API (2026-04-25)
-- This file kept for reference / re-run safety
-- ══════════════════════════════════════════

-- Main entries for Точка А → Точка B
CREATE TABLE IF NOT EXISTS point_ab_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT NOT NULL,
  point_a               JSONB DEFAULT '{}',
  change_a              JSONB DEFAULT '{}',
  point_b               JSONB DEFAULT '{}',
  reasons               JSONB DEFAULT '[]',
  corrections           JSONB DEFAULT '[]',
  share_with_specialist BOOLEAN DEFAULT false,
  reminder_frequency    TEXT DEFAULT '3_week',
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entries_user ON point_ab_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_date ON point_ab_entries(created_at DESC);

-- Audio recordings
CREATE TABLE IF NOT EXISTS point_ab_audio (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      UUID REFERENCES point_ab_entries(id) ON DELETE CASCADE,
  audio_data    BYTEA,
  duration_sec  INTEGER,
  mime_type     TEXT DEFAULT 'audio/webm',
  size_bytes    INTEGER,
  created_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT audio_size_limit CHECK (size_bytes <= 3670016),
  CONSTRAINT audio_duration_limit CHECK (duration_sec <= 180)
);

CREATE INDEX IF NOT EXISTS idx_audio_entry ON point_ab_audio(entry_id);

-- Calendar reminders
CREATE TABLE IF NOT EXISTS calendar_reminders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  entry_id      UUID REFERENCES point_ab_entries(id) ON DELETE SET NULL,
  reminder_date DATE NOT NULL,
  task_type     TEXT DEFAULT 'listen_program',
  done          BOOLEAN DEFAULT false,
  done_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, reminder_date, task_type)
);

CREATE INDEX IF NOT EXISTS idx_reminders_user ON calendar_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_date ON calendar_reminders(reminder_date);
