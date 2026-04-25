-- Migration 007: NeuroMap graph tables — nm_nodes + nm_links
-- These tables store deduplicated graph nodes and links for the NeuroMap instrument.
-- Each node is unique per (user_id, type, normalized_label, valence).
-- Links connect nodes and accumulate counts.

CREATE TABLE IF NOT EXISTS nm_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                          -- emotion, area, cause, thought, practice, event
  label TEXT NOT NULL,                         -- original label as entered
  normalized_label TEXT NOT NULL,              -- lowercase trimmed for dedup
  valence TEXT NOT NULL DEFAULT 'neutral',     -- positive, negative, neutral
  count INT NOT NULL DEFAULT 1,               -- how many times this node appeared
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}',                -- emoji, color overrides, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, type, normalized_label, valence)
);

CREATE INDEX IF NOT EXISTS idx_nm_nodes_user ON nm_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_nm_nodes_user_type ON nm_nodes(user_id, type);
CREATE INDEX IF NOT EXISTS idx_nm_nodes_last_seen ON nm_nodes(user_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS nm_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_node_id UUID NOT NULL REFERENCES nm_nodes(id) ON DELETE CASCADE,
  to_node_id UUID NOT NULL REFERENCES nm_nodes(id) ON DELETE CASCADE,
  count INT NOT NULL DEFAULT 1,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, from_node_id, to_node_id)
);

CREATE INDEX IF NOT EXISTS idx_nm_links_user ON nm_links(user_id);
CREATE INDEX IF NOT EXISTS idx_nm_links_from ON nm_links(from_node_id);
CREATE INDEX IF NOT EXISTS idx_nm_links_to ON nm_links(to_node_id);
