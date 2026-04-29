-- Migration 015: Create consent_log table for Stripe checkout consent tracking
-- Safe: CREATE TABLE IF NOT EXISTS, no existing data affected

CREATE TABLE IF NOT EXISTS consent_log (
  id SERIAL PRIMARY KEY,
  stripe_session_id TEXT,
  stripe_customer_id TEXT,
  product TEXT NOT NULL,
  email TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  consent_tos BOOLEAN DEFAULT false,
  consent_privacy BOOLEAN DEFAULT false,
  consent_digital BOOLEAN DEFAULT false,
  consent_rehab BOOLEAN,
  amount_total INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  payment_status TEXT DEFAULT 'pending',
  consent_timestamp TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_log_product ON consent_log(product);
CREATE INDEX IF NOT EXISTS idx_consent_log_email ON consent_log(email);
CREATE INDEX IF NOT EXISTS idx_consent_log_created ON consent_log(created_at DESC);
