-- Additive partner schema. No client/role/health changes.
CREATE TABLE IF NOT EXISTS partner_email_challenges (
 id UUID PRIMARY KEY, email TEXT NOT NULL, display_name TEXT NOT NULL, code_hash TEXT NOT NULL,
 ip_hash TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, expires_at TIMESTAMPTZ NOT NULL,
 consumed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_challenges_email_created ON partner_email_challenges (email, created_at DESC);

CREATE INDEX IF NOT EXISTS partner_challenges_ip_created ON partner_email_challenges (ip_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_email_proofs (
 user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, email TEXT NOT NULL,
 verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_applications (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 client_request_id UUID NOT NULL, display_name TEXT NOT NULL, contact_email TEXT NOT NULL,
 directions JSONB NOT NULL DEFAULT '[]'::jsonb, custom_direction TEXT NOT NULL DEFAULT '',
 interest TEXT NOT NULL DEFAULT 'collaboration', research_topic TEXT NOT NULL DEFAULT '',
 country TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', competence TEXT NOT NULL,
 proposal TEXT NOT NULL, portfolio_url TEXT NOT NULL DEFAULT '', consent_version TEXT NOT NULL,
 consent_at TIMESTAMPTZ NOT NULL DEFAULT now(), marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
 status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','in_review','needs_information','accepted','closed')),
 version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (user_id,client_request_id)
);

CREATE INDEX IF NOT EXISTS partner_applications_owner ON partner_applications (user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS partner_application_permissions (
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 permission TEXT NOT NULL CHECK (permission IN ('partner_applications.read','partner_applications.manage')),
 granted_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (user_id,permission)
);

CREATE TABLE IF NOT EXISTS partner_application_audit (
 id BIGSERIAL PRIMARY KEY, application_id UUID NOT NULL REFERENCES partner_applications(id) ON DELETE CASCADE,
 actor_id UUID NOT NULL REFERENCES users(id), action TEXT NOT NULL,
 previous_status TEXT, next_status TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_rate_limits (key_hash TEXT PRIMARY KEY,hits INTEGER NOT NULL DEFAULT 1,window_started TIMESTAMPTZ NOT NULL DEFAULT now());

ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS payload_digest TEXT NOT NULL DEFAULT '';
