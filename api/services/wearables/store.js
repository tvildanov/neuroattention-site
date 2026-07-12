'use strict';
// DB layer for wearables. Holds the injected neon `sql` (set once at startup via
// setSql). OAuth tokens live in the SHARED `oauth_tokens` table (created by mig065
// here, or by the calendar feature's mig063 — IF NOT EXISTS, either order). Every
// query here is SCOPED to wearable providers (oura|whoop) so calendar rows in the
// same table are never touched. Tokens are encrypted at rest; decrypted secrets are
// only returned to the internal sync/refresh path (getFullToken / *ActiveTokens).

const { encrypt, decrypt } = require('./crypto');

const WEARABLE_PROVIDERS = ['oura', 'whoop'];

let sql = null;
function setSql(s) { sql = s; }

// ---- oauth_tokens (wearable rows only) ----

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

// Safe list for the UI — NO tokens. Wearable providers only.
async function listForUser(userId) {
  return await sql`
    SELECT id, provider, account_email, scope, needs_reauth, created_at, last_sync_at
    FROM oauth_tokens
    WHERE user_id = ${userId} AND provider = ANY(${WEARABLE_PROVIDERS})
    ORDER BY created_at ASC`;
}

// Full row incl. decrypted secrets — internal sync/disconnect use only.
async function getFullToken(id, userId) {
  const rows = userId
    ? await sql`SELECT * FROM oauth_tokens WHERE id = ${id} AND user_id = ${userId} AND provider = ANY(${WEARABLE_PROVIDERS})`
    : await sql`SELECT * FROM oauth_tokens WHERE id = ${id} AND provider = ANY(${WEARABLE_PROVIDERS})`;
  if (!rows.length) return null;
  return hydrate(rows[0]);
}

async function tokensForUserProvider(userId, provider) {
  const rows = await sql`SELECT * FROM oauth_tokens WHERE user_id = ${userId} AND provider = ${provider}`;
  return rows.map(hydrate);
}

// Every active wearable token — the cron's work list (scoped to oura|whoop).
async function allActiveTokens() {
  const rows = await sql`
    SELECT * FROM oauth_tokens
    WHERE needs_reauth = false AND provider = ANY(${WEARABLE_PROVIDERS})`;
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

// Disconnect: remove the token + all health metrics it produced.
async function deleteToken(id, userId) {
  const rows = await sql`
    SELECT provider, account_email FROM oauth_tokens
    WHERE id = ${id} AND user_id = ${userId} AND provider = ANY(${WEARABLE_PROVIDERS})`;
  if (!rows.length) return { ok: false };
  const { provider } = rows[0];
  try {
    await sql`DELETE FROM health_metrics WHERE user_id = ${userId} AND provider = ${provider}`;
  } catch (e) { console.warn('wearables deleteToken(metrics):', e.message); }
  await sql`DELETE FROM oauth_tokens WHERE id = ${id} AND user_id = ${userId}`;
  return { ok: true, provider };
}

// ---- health_metrics ----

// Upsert one metric. Dedup key = (user_id, provider, metric_kind, measured_at, external_id).
// Returns 'added' | 'updated'.
async function upsertMetric({ userId, provider, metricKind, value, measuredAt, externalId, raw }) {
  const r = await sql`
    INSERT INTO health_metrics
      (user_id, provider, metric_kind, value, measured_at, external_id, raw_data, synced_at)
    VALUES
      (${userId}, ${provider}, ${metricKind}, ${value}, ${measuredAt},
       ${externalId || null}, ${raw ? JSON.stringify(raw) : null}::jsonb, now())
    ON CONFLICT (user_id, provider, metric_kind, measured_at, external_id) DO UPDATE SET
      value = ${value},
      raw_data = ${raw ? JSON.stringify(raw) : null}::jsonb,
      synced_at = now()
    RETURNING (xmax = 0) AS inserted`;
  return (r[0] && r[0].inserted) ? 'added' : 'updated';
}

// Raw metrics for the API (optional kind + from/to window).
async function getMetrics(userId, { kind, from, to }) {
  const fromTs = from || '1970-01-01';
  const toTs = to || '2999-01-01';
  if (kind) {
    return await sql`
      SELECT provider, metric_kind, value, measured_at, external_id
      FROM health_metrics
      WHERE user_id = ${userId} AND metric_kind = ${kind}
        AND measured_at >= ${fromTs} AND measured_at <= ${toTs}
      ORDER BY measured_at ASC`;
  }
  return await sql`
    SELECT provider, metric_kind, value, measured_at, external_id
    FROM health_metrics
    WHERE user_id = ${userId}
      AND measured_at >= ${fromTs} AND measured_at <= ${toTs}
    ORDER BY measured_at ASC`;
}

// ---- wearable_sync_log ----

async function logSync({ userId, provider, added, updated, durationMs, error }) {
  try {
    await sql`
      INSERT INTO wearable_sync_log (user_id, provider, metrics_added, metrics_updated, duration_ms, error)
      VALUES (${userId}, ${provider}, ${added || 0}, ${updated || 0}, ${durationMs || 0}, ${error || null})`;
  } catch (e) { console.warn('wearables logSync:', e.message); }
}

async function recentSyncLog(userId, limit) {
  const n = Math.min(parseInt(limit, 10) || 20, 100);
  return await sql`
    SELECT provider, ran_at, metrics_added, metrics_updated, duration_ms, error
    FROM wearable_sync_log WHERE user_id = ${userId}
    ORDER BY ran_at DESC LIMIT ${n}`;
}

module.exports = {
  setSql, WEARABLE_PROVIDERS,
  saveToken, listForUser, getFullToken, tokensForUserProvider, allActiveTokens,
  updateTokenAfterRefresh, markSynced, markNeedsReauth, deleteToken,
  upsertMetric, getMetrics,
  logSync, recentSyncLog,
};
