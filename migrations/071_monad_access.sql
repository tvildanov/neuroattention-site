-- Migration 071: per-user Monad LK access flag (non-superadmins)
ALTER TABLE users ADD COLUMN IF NOT EXISTS monad_access BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_users_monad_access ON users(monad_access) WHERE monad_access = true;
