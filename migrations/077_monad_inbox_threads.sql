-- Monad LK inbox threads — cached from monad-server get_inbox / human inbox HTTP (PR #28+)

CREATE TABLE IF NOT EXISTS monad_inbox_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'message',
  agent_id TEXT,
  from_agent TEXT,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  message_type TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  monad_created_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_monad_inbox_user ON monad_inbox_threads(user_id, monad_created_at DESC NULLS LAST, synced_at DESC);
