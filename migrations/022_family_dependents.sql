-- 022_family_dependents.sql — Phase 2A: Family & Team.
--
-- NB: families and teams are ALREADY modelled as rows in `teams` (kind='family'
-- vs 'team') with kin roles on team_members (see migration in server.js / FAMILY_ROLES).
-- We do NOT add parallel family_groups/family_members/teams/team_members tables —
-- that would create two competing family systems. This migration only adds the
-- genuinely-new pieces:
--   1. dependent_profiles — children / dependents who are NOT platform users
--      (no account): name, sex, birth_date OR expected_due_date, diagnoses, etc.
--   2. team_invites — shareable invite tokens for join-by-link (family + team).
--   3. journey_events.dependent_id — so tool-side logging can attribute an event
--      to a dependent (Phase 2B); GET /evolution?subject=dependent:<id> reads it.
--
-- The migrate runner splits on semicolons and strips line comments, so keep each
-- statement self-contained and free of inline ';' inside strings.

CREATE TABLE IF NOT EXISTS dependent_profiles (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  sex TEXT,
  birth_date DATE,
  expected_due_date DATE,
  track_from DATE,
  relation TEXT,
  diagnoses_ids INTEGER[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT dependent_has_date CHECK (birth_date IS NOT NULL OR expected_due_date IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_dependents_owner ON dependent_profiles(owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dependents_family ON dependent_profiles(family_id);

CREATE TABLE IF NOT EXISTS team_invites (
  token TEXT PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'member',
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_invites_team ON team_invites(team_id);

ALTER TABLE journey_events ADD COLUMN IF NOT EXISTS dependent_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_journey_events_dependent ON journey_events(dependent_id) WHERE dependent_id IS NOT NULL;
