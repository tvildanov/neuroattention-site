-- Link Nastya's cabinet email to Monad human `nastya` and grant tab access.
-- Nick 2026-08-08: nilta95@mail.ru → nastya (other Monad emails later).

UPDATE users
SET monad_human_id = 'nastya',
    monad_access = TRUE
WHERE lower(email) = 'nilta95@mail.ru';
