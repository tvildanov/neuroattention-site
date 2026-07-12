'use strict';
// DB layer for external calendars. Holds the injected neon `sql` (set once at
// startup via setSql). Tokens are encrypted at rest; this module never returns
// decrypted secrets to callers except the internal sync/refresh path (getFullToken).

const { encrypt, decrypt } = require('./crypto');

let sql = null;
function setSql(s) { sql = s; }

// ---- oauth_tokens ----

// Insert or refresh a connected account. Encrypts tokens. UNIQUE(user_id, provider,
// account_email) → reconnecting the same account updates it in place.
async function saveToken({ userId, provider, accessToken, refreshToken, expiresAt, scope, accountEmail, extra }) {
  const rows = await sql`
    INSERT INTO oauth_tokens
      (user_id, provider, access_token, refresh_token, token_expires_at, scope, account_email, extra, needs_reauth, last_sync_at)
    VALUES
      (${userId}, ${provider}, ${encrypt(accessToken)}, ${encrypt(refreshToken)},
       ${expiresAt || null}, ${scope || null}, ${accountEmail || null},
       ${extra ? JSON.stringify(extra) : null}::jsonb, false, NULL)
    ON CONFLICT (user_id, provider, account_email) DO UPDATE SET
      access_token = COALESCE(${encrypt(accessToken)}, oauth_tokens.access_token),
      refresh_token = COALESCE(${encrypt(refreshToken)}, oauth_tokens.refresh_token),
      token_expires_at = ${expiresAt || null},
      scope = COALESCE(${scope || null}, oauth_tokens.scope),
      extra = COALESCE(${extra ? JSON.stringify(extra) : null}::jsonb, oauth_tokens.extra),
      needs_reauth = false
    RETURNING id`;
  return rows[0] ? rows[0].id : null;
}

// Safe list for the UI — NO tokens. One row per connected account.
async function listForUser(userId) {
  const rows = await sql`
    SELECT id, provider, account_email, scope, needs_reauth, created_at, last_sync_at
    FROM oauth_tokens WHERE user_id = ${userId}
    ORDER BY created_at ASC`;
  return rows;
}

// Full row incl. decrypted secrets — internal sync/disconnect use only.
async function getFullToken(id, userId) {
  const rows = userId
    ? await sql`SELECT * FROM oauth_tokens WHERE id = ${id} AND user_id = ${userId}`
    : await sql`SELECT * FROM oauth_tokens WHERE id = ${id}`;
  if (!rows.length) return null;
  return hydrate(rows[0]);
}

async function tokensForUserProvider(userId, provider) {
  const rows = await sql`SELECT * FROM oauth_tokens WHERE user_id = ${userId} AND provider = ${provider}`;
  return rows.map(hydrate);
}

// Every active (not needing re-auth) token — the cron's work list.
async function allActiveTokens() {
  const rows = await sql`SELECT * FROM oauth_tokens WHERE needs_reauth = false`;
  return rows.map(hydrate);
}

function hydrate(row) {
  return Object.assign({}, row, {
    access_token: decrypt(row.access_token),
    refresh_token: decrypt(row.refresh_token),
    extra: row.extra || null,
  });
}

async function updateTokenAfterRefresh(id, { accessToken, refreshToken, expiresAt }) {
  await sql`
    UPDATE oauth_tokens SET
      access_token = COALESCE(${encrypt(accessToken)}, access_token),
      refresh_token = COALESCE(${encrypt(refreshToken)}, refresh_token),
      token_expires_at = ${expiresAt || null},
      needs_reauth = false
    WHERE id = ${id}`;
}

async function markSynced(id) {
  await sql`UPDATE oauth_tokens SET last_sync_at = now() WHERE id = ${id}`;
}

async function markNeedsReauth(id) {
  await sql`UPDATE oauth_tokens SET needs_reauth = true WHERE id = ${id}`;
}

// Disconnect: remove the token + (optionally) the events it imported.
async function deleteToken(id, userId) {
  const rows = await sql`SELECT provider, account_email FROM oauth_tokens WHERE id = ${id} AND user_id = ${userId}`;
  if (!rows.length) return { ok: false };
  const { provider, account_email } = rows[0];
  await deleteImportedEvents(userId, provider, account_email);
  await sql`DELETE FROM oauth_tokens WHERE id = ${id} AND user_id = ${userId}`;
  return { ok: true, provider, account_email };
}

// ---- calendar_sync_log ----

async function logSync({ userId, provider, added, updated, deleted, durationMs, error }) {
  try {
    await sql`
      INSERT INTO calendar_sync_log (user_id, provider, events_added, events_updated, events_deleted, duration_ms, error)
      VALUES (${userId}, ${provider}, ${added || 0}, ${updated || 0}, ${deleted || 0}, ${durationMs || 0}, ${error || null})`;
  } catch (e) { console.warn('calendar logSync:', e.message); }
}

async function recentSyncLog(userId, limit) {
  const n = Math.min(parseInt(limit, 10) || 20, 100);
  return await sql`
    SELECT provider, ran_at, events_added, events_updated, events_deleted, duration_ms, error
    FROM calendar_sync_log WHERE user_id = ${userId}
    ORDER BY ran_at DESC LIMIT ${n}`;
}

// ---- imported events → journey_events (Path) + calendar_events (Calendar view) ----

// Upsert one imported event. Dedup key = (user_id, oauth_provider, imported_event_id).
// Mirrors P6's dual-write pattern: structured columns AND payload keys, so both the
// current Path/Calendar readers and the future unified model see the same data.
// Returns 'added' | 'updated'.
async function upsertImportedEvent({ userId, provider, accountEmail, event }) {
  const occurredAt = new Date(event.start);
  const whenIso = isNaN(occurredAt.getTime()) ? new Date().toISOString() : occurredAt.toISOString();
  const label = '📥 ' + (event.title || '(no title)');
  const payload = {
    label,
    title: event.title || '(no title)',
    source: 'imported_calendar',
    provider,
    account_email: accountEmail || null,
    imported_event_id: event.id,
    all_day: !!event.allDay,
    ends_at: event.end || null,
    description: (event.description || '').slice(0, 2000),
    imported: true,
  };
  const je = await sql`
    INSERT INTO journey_events
      (user_id, kind, layer, payload, occurred_at, source, title, oauth_provider, imported_event_id, oauth_account_email)
    VALUES
      (${userId}, 'imported_calendar', 'event', ${JSON.stringify(payload)}::jsonb, ${whenIso},
       'imported_calendar', ${event.title || '(no title)'}, ${provider}, ${event.id}, ${accountEmail || null})
    ON CONFLICT (user_id, oauth_provider, imported_event_id) WHERE imported_event_id IS NOT NULL
    DO UPDATE SET
      payload = ${JSON.stringify(payload)}::jsonb,
      occurred_at = ${whenIso},
      title = ${event.title || '(no title)'},
      oauth_account_email = ${accountEmail || null}
    RETURNING (xmax = 0) AS inserted`;
  const inserted = je[0] ? je[0].inserted : true;

  // Mirror into calendar_events so the month grid shows it too. date_key = YYYY-MM-DD.
  const dateKey = whenIso.slice(0, 10);
  const time = event.allDay ? '' : whenIso.slice(11, 16);
  try {
    await sql`
      INSERT INTO calendar_events
        (user_id, date_key, time, title, event_type, oauth_provider, imported_event_id)
      VALUES
        (${userId}, ${dateKey}, ${time}, ${event.title || '(no title)'}, 'imported', ${provider}, ${event.id})
      ON CONFLICT (user_id, oauth_provider, imported_event_id) WHERE imported_event_id IS NOT NULL
      DO UPDATE SET date_key = ${dateKey}, time = ${time}, title = ${event.title || '(no title)'}`;
  } catch (e) { /* calendar mirror is best-effort */ }

  return inserted ? 'added' : 'updated';
}

// Remove all events imported for one connected account (disconnect / cleanup).
async function deleteImportedEvents(userId, provider, accountEmail) {
  let deleted = 0;
  try {
    const r = await sql`
      DELETE FROM journey_events
      WHERE user_id = ${userId} AND oauth_provider = ${provider}
        AND (${accountEmail}::text IS NULL OR oauth_account_email = ${accountEmail})
        AND source = 'imported_calendar'`;
    deleted = r.count || 0;
  } catch (e) { console.warn('deleteImportedEvents(je):', e.message); }
  try {
    await sql`
      DELETE FROM calendar_events
      WHERE user_id = ${userId} AND oauth_provider = ${provider} AND event_type = 'imported'`;
  } catch (e) { console.warn('deleteImportedEvents(cal):', e.message); }
  return deleted;
}

module.exports = {
  setSql,
  saveToken, listForUser, getFullToken, tokensForUserProvider, allActiveTokens,
  updateTokenAfterRefresh, markSynced, markNeedsReauth, deleteToken,
  logSync, recentSyncLog,
  upsertImportedEvent, deleteImportedEvents,
};
