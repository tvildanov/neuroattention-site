-- Migration 014: Create rehab_applications table
-- Safe: CREATE TABLE IF NOT EXISTS, no existing data affected

CREATE TABLE IF NOT EXISTS rehab_applications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  city TEXT NOT NULL,
  phone TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age > 0 AND age < 120),
  description TEXT NOT NULL,
  rehab_conditions TEXT[] DEFAULT '{}',
  rehab_other_description TEXT DEFAULT '',
  status TEXT DEFAULT 'new',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rehab_app_status ON rehab_applications(status);
CREATE INDEX IF NOT EXISTS idx_rehab_app_created ON rehab_applications(created_at DESC);
