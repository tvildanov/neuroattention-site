-- Egor email → Monad human persona + LK tab access
ALTER TABLE users ADD COLUMN IF NOT EXISTS monad_human_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monad_access BOOLEAN NOT NULL DEFAULT false;
UPDATE users
SET monad_human_id = 'egor', monad_access = TRUE
WHERE lower(email) = 'mysolopoetry@proton.me';
