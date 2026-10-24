-- Migration 070: link NeuroAttention user profile → Monad human_id
-- Applied also via POST /api/run-migrations (idempotent).
ALTER TABLE users ADD COLUMN IF NOT EXISTS monad_human_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_monad_human ON users(monad_human_id) WHERE monad_human_id IS NOT NULL;
