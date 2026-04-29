-- Migration 013: Add neurodegeneration filter columns to test_results
-- Safe: ALTER TABLE ADD COLUMN with defaults, no data loss

ALTER TABLE test_results
  ADD COLUMN IF NOT EXISTS neuro_deg_flag BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS neuro_deg_detail VARCHAR(50) DEFAULT '';
