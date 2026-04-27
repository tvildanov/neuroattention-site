-- Migration 011: User stats for RPG-style dashboard
-- Stores 13 personality stats + world model coherence level per user

CREATE TABLE IF NOT EXISTS user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  world_model_coherence SMALLINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_user ON user_stats(user_id);
