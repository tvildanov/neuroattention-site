-- Migration 013: Add rehabilitation flow columns to test_results
-- Safe: ALTER TABLE ADD COLUMN with defaults, no data loss
-- Replaces previous neuro_deg_flag/neuro_deg_detail (never deployed)

ALTER TABLE test_results
  ADD COLUMN IF NOT EXISTS rehab_flag BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rehab_conditions TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rehab_other_description TEXT DEFAULT '';
