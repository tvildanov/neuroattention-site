'use strict';
// External-calendar orchestration: provider registry, the sync engine (refresh →
// fetch → upsert → log), the 6-hour cron, and the EXTERNAL_CALENDARS feature flag.
//
// Feature flag: EXTERNAL_CALENDARS must be 'true' for endpoints to act and the cron
// to run. Default OFF so the whole feature is inert until Nick sets provider
// credentials and flips the flag on Railway. Rollback = unset the var.

const google = require('./google');
const microsoft = require('./microsoft');
const apple = require('./apple');
const store = require('./store');
const cryptoUtil = require('./crypto');

const PROVIDERS = { google, microsoft, apple };
const OAUTH_PROVIDERS = ['google', 'microsoft'];          // redirect-based
const SYNC_MONTHS_BACK = 6;
const SYNC_MONTHS_FWD = 6;
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;               // every 6 hours

function enabled() { return process.env.EXTERNAL_CALENDARS === 'true'; }
function getProvider(name) { return PROVIDERS[name] || null; }
function init({ sql }) { store.setSql(sql); }

// What the UI needs to render the section: which providers are usable right now.
function providerStatus() {
  return {
    enabled: enabled(),
    encryption_ready: cryptoUtil.haveKey(),
    providers: {
      google: { configured: google.configured() },
      microsoft: { configured: microsoft.configured() },
      apple: { configured: true }, // needs only a user-supplied app-specific password
    },
  };
}

function syncWindow() {
  const now = Date.now();
  const back = new Date(now); back.setMonth(back.getMonth() - SYNC_MONTHS_BACK);
  const fwd = new Date(now); fwd.setMonth(fwd.getMonth() + SYNC_MONTHS_FWD);
  return { timeMin: back.toISOString(), timeMax: fwd.toISOString() };
}

// Ensure a usable access token for an OAuth provider, refreshing if it is expired
// or within 2 minutes of expiry. Persists the refreshed token. Throws w/ needsReauth
// when the grant is dead so the caller can flag the account.
async function ensureAccessToken(tokenRow) {
  const provider = getProvider(tokenRow.provider);
  if (!OAUTH_PROVIDERS.includes(tokenRow.provider)) return tokenRow.access_token;
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

// Fetch events from the provider for one connected account.
async function fetchProviderEvents(tokenRow, win) {
  const provider = getProvider(tokenRow.provider);
  if (!provider) throw new Error('unknown provider ' + tokenRow.provider);
  if (tokenRow.provider === 'apple') {
    return provider.fetchEvents({
      email: tokenRow.account_email,
      appPassword: tokenRow.refresh_token,               // app-specific password lives here
      homeUrl: tokenRow.extra && tokenRow.extra.home,
      timeMin: win.timeMin, timeMax: win.timeMax,
    });
  }
  const accessToken = await ensureAccessToken(tokenRow);
  return provider.fetchEvents({ accessToken, timeMin: win.timeMin, timeMax: win.timeMax });
}

// Sync ONE connected account end to end. Never throws — returns a result summary and
// records a calendar_sync_log row.
async function syncToken(tokenRow) {
  const started = Date.now();
  const res = { provider: tokenRow.provider, account_email: tokenRow.account_email, added: 0, updated: 0, error: null };
  try {
    const win = syncWindow();
    const events = await fetchProviderEvents(tokenRow, win);
    for (const ev of (events || [])) {
      if (!ev || !ev.id || !ev.start) continue;
      try {
        const outcome = await store.upsertImportedEvent({
          userId: tokenRow.user_id, provider: tokenRow.provider,
          accountEmail: tokenRow.account_email, event: ev,
        });
        if (outcome === 'added') res.added++; else res.updated++;
      } catch (e) { /* one bad event must not abort the batch */ }
    }
    await store.markSynced(tokenRow.id);
  } catch (e) {
    res.error = e.message;
    if (e.needsReauth || e.authFailed || e.status === 401) {
      try { await store.markNeedsReauth(tokenRow.id); } catch (_) {}
    }
    console.warn('[calendar/sync ' + tokenRow.provider + ']', e.message);
  }
  res.duration_ms = Date.now() - started;
  await store.logSync({
    userId: tokenRow.user_id, provider: tokenRow.provider,
    added: res.added, updated: res.updated, deleted: 0,
    durationMs: res.duration_ms, error: res.error,
  });
  return res;
}

// Sync every connected account for one user (on-demand Refresh button / after connect).
async function syncUser(userId, provider) {
  const rows = provider
    ? await store.tokensForUserProvider(userId, provider)
    : (await store.allActiveTokens()).filter(t => t.user_id === userId);
  const results = [];
  for (const row of rows) results.push(await syncToken(row));
  return results;
}

// Cron work list: every active token, sequentially (gentle on rate limits).
async function syncAll() {
  if (!enabled()) return { skipped: 'disabled' };
  let tokens = [];
  try { tokens = await store.allActiveTokens(); } catch (e) { return { error: e.message }; }
  let added = 0, updated = 0, accounts = 0;
  for (const row of tokens) {
    const r = await syncToken(row);
    added += r.added; updated += r.updated; accounts++;
  }
  if (accounts) console.log(`[calendar] cron synced ${accounts} account(s): +${added} / ~${updated}`);
  return { accounts, added, updated };
}

let cronTimer = null;
function startCron() {
  if (cronTimer) return;
  if (!enabled()) { console.log('[calendar] EXTERNAL_CALENDARS off — cron not started'); return; }
  if (!process.env.DATABASE_URL) return;
  // first pass 90s after boot (let migrations settle), then every 6h
  setTimeout(() => { syncAll().catch(() => {}); }, 90 * 1000);
  cronTimer = setInterval(() => { syncAll().catch(() => {}); }, SYNC_INTERVAL_MS);
  console.log('[calendar] sync cron started (every 6h), key=' + (cryptoUtil.keyFingerprint() || 'none'));
}

module.exports = {
  enabled, init, getProvider, providerStatus, syncWindow,
  syncToken, syncUser, syncAll, startCron,
  OAUTH_PROVIDERS, store, providers: PROVIDERS,
};
