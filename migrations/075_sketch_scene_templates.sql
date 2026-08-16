-- Sketch scene JSON + templates + public publish + one-shot delivery ledger
ALTER TABLE user_sketches ADD COLUMN IF NOT EXISTS scene JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE user_sketches ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_sketches ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_user_sketches_public ON user_sketches(is_public, updated_at DESC) WHERE is_public = true;

CREATE TABLE IF NOT EXISTS site_one_shots (
  id TEXT PRIMARY KEY,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivered_at TIMESTAMPTZ DEFAULT now()
);
