'use strict';
// Wearable-integration orchestration: provider registry, the sync engine (refresh →
// fetch → upsert → log), the 6-hour cron, and the WEARABLES_ENABLED feature flag.
//
// Feature flag: WEARABLES_ENABLED must be 'true' for endpoints to act and the cron
// to run. Default OFF so the whole feature is inert until Nick registers Oura +
// WHOOP OAuth apps, sets their credentials, and flips the flag on Railway. Rollback
// = unset the var. Mirrors the P7 external-calendar service architecture.

const oura = require('./oura');
const whoop = require('./whoop');
const store = require('./store');
const cryptoUtil = require('./crypto');

const PROVIDERS = { oura, whoop };
const PROVIDER_NAMES = ['oura', 'whoop'];
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;               // every 6 hours
const SYNC_OVERLAP_MS = 6 * 60 * 60 * 1000;                // re-fetch a 6h overlap to catch late scores

function enabled() { return process.env.WEARABLES_ENABLED === 'true'; }
function getProvider(name) { return PROVIDERS[name] || null; }
function init({ sql }) { store.setSql(sql); }

// What the UI needs to render the section: which providers are usable right now.
function providerStatus() {
  return {
    enabled: enabled(),
    encryption_ready: cryptoUtil.haveKey(),
    providers: {
      oura: { configured: oura.configured() },
      whoop: { configured: whoop.configured() },
    },
  };
}

// Ensure a usable access token, refreshing if expired or within 2 min of expiry.
// Persists the refreshed token. Throws w/ needsReauth when the grant is dead.
async function ensureAccessToken(tokenRow) {
  const provider = getProvider(tokenRow.provider);
  const exp = tokenRow.token_expires_at ? new Date(tokenRow.token_expires_at).getTime() : 0;
  const fresh = exp && exp - Date.now() > 120 * 1000;
  if (fresh && tokenRow.access_token) return tokenRow.access_token;
  const refreshed = await provider.refresh({ refreshToken: tokenRow.refresh_token });
  await store.updateTokenAfterRefresh(tokenRow.id, {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken || null,
    expiresAt: refreshed.expiresAt,
  });
  return refreshed.accessToken;
}

// Sync ONE connected account end to end. Never throws — returns a summary and
// records a wearable_sync_log row.
async function syncToken(tokenRow) {
  const started = Date.now();
  const res = { provider: tokenRow.provider, account_email: tokenRow.account_email, added: 0, updated: 0, error: null };
  try {
    const provider = getProvider(tokenRow.provider);
    if (!provider) throw new Error('unknown provider ' + tokenRow.provider);
    const accessToken = await ensureAccessToken(tokenRow);
    // Since last successful sync (minus overlap) or a 14-day backfill on first sync.
    const since = tokenRow.last_sync_at
      ? new Date(new Date(tokenRow.last_sync_at).getTime() - SYNC_OVERLAP_MS).toISOString()
      : null;
    const metrics = await provider.fetchMetrics({ accessToken, since });
    for (const m of (metrics || [])) {
      if (!m || m.value == null || !m.measured_at) continue;
      try {
        const outcome = await store.upsertMetric({
          userId: tokenRow.user_id, provider: tokenRow.provider,
          metricKind: m.metric_kind, value: m.value, measuredAt: m.measured_at,
          externalId: m.external_id, raw: m.raw,
        });
        if (outcome === 'added') res.added++; else res.updated++;
      } catch (e) { /* one bad metric must not abort the batch */ }
    }
    await store.markSynced(tokenRow.id);
  } catch (e) {
    res.error = e.message;
    if (e.needsReauth || e.status === 401) {
      try { await store.markNeedsReauth(tokenRow.id); } catch (_) {}
    }
    console.warn('[wearables/sync ' + tokenRow.provider + ']', e.message);
  }
  res.duration_ms = Date.now() - started;
  await store.logSync({
    userId: tokenRow.user_id, provider: tokenRow.provider,
    added: res.added, updated: res.updated, durationMs: res.duration_ms, error: res.error,
  });
  return res;
}

// Sync every connected account for one user (on-demand Refresh / after connect).
async function syncUser(userId, provider) {
  const rows = provider
    ? await store.tokensForUserProvider(userId, provider)
    : (await store.allActiveTokens()).filter(t => t.user_id === userId);
  const results = [];
  for (const row of rows) results.push(await syncToken(row));
  return results;
}

// Cron work list: every active wearable token, sequentially (gentle on rate limits).
async function syncAll() {
  if (!enabled()) return { skipped: 'disabled' };
  let tokens = [];
  try { tokens = await store.allActiveTokens(); } catch (e) { return { error: e.message }; }
  let added = 0, updated = 0, accounts = 0;
  for (const row of tokens) {
    const r = await syncToken(row);
    added += r.added; updated += r.updated; accounts++;
  }
  if (accounts) console.log(`[wearables] cron synced ${accounts} account(s): +${added} / ~${updated}`);
  return { accounts, added, updated };
}

let cronTimer = null;
function startCron() {
  if (cronTimer) return;
  if (!enabled()) { console.log('[wearables] WEARABLES_ENABLED off — cron not started'); return; }
  if (!process.env.DATABASE_URL) return;
  setTimeout(() => { syncAll().catch(() => {}); }, 120 * 1000);      // 2 min after boot
  cronTimer = setInterval(() => { syncAll().catch(() => {}); }, SYNC_INTERVAL_MS);
  console.log('[wearables] sync cron started (every 6h), key=' + (cryptoUtil.keyFingerprint() || 'none'));
}

// ── Pure helper: fold flat metric rows into one snapshot per calendar day (UTC).
// Consumed by BOTH the Personal Path recovery band and the NeuroMap physical-state
// panel. `recovery` prefers WHOOP's recovery score, falling back to Oura readiness.
function dailyDigest(rows) {
  const byDay = {};
  const kinds = ['recovery', 'readiness', 'hrv', 'rhr', 'sleep_score', 'strain', 'sleep_duration_min', 'deep_sleep_min', 'rem_min'];
  for (const r of (rows || [])) {
    const day = new Date(r.measured_at).toISOString().slice(0, 10);
    const d = byDay[day] || (byDay[day] = { day, _at: {}, provider: r.provider });
    const k = r.metric_kind;
    if (!kinds.includes(k)) continue;
    // Keep the latest sample per (day, kind).
    const t = new Date(r.measured_at).getTime();
    if (d._at[k] == null || t >= d._at[k]) { d[k] = Number(r.value); d._at[k] = t; d.provider = r.provider; }
  }
  return Object.values(byDay).map(d => {
    const recovery = (d.recovery != null) ? d.recovery : (d.readiness != null ? d.readiness : null);
    return {
      day: d.day,
      provider: d.provider,
      recovery: recovery != null ? Math.round(recovery) : null,
      hrv: d.hrv != null ? Math.round(d.hrv) : null,
      rhr: d.rhr != null ? Math.round(d.rhr) : null,
      sleep_score: d.sleep_score != null ? Math.round(d.sleep_score) : null,
      strain: d.strain != null ? Math.round(d.strain * 10) / 10 : null,
      sleep_duration_min: d.sleep_duration_min != null ? Math.round(d.sleep_duration_min) : null,
      deep_sleep_min: d.deep_sleep_min != null ? Math.round(d.deep_sleep_min) : null,
      rem_min: d.rem_min != null ? Math.round(d.rem_min) : null,
    };
  }).sort((a, b) => a.day < b.day ? -1 : 1);
}

module.exports = {
  enabled, init, getProvider, providerStatus,
  syncToken, syncUser, syncAll, startCron,
  dailyDigest, PROVIDER_NAMES, store, providers: PROVIDERS,
};
