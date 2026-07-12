'use strict';
// WHOOP provider — OAuth 2.0 Authorization Code flow + WHOOP API v2.
// Dependency-free: native fetch (Node 20). Authoritative refs (verified 2026-07-12):
//   Authorize: https://api.prod.whoop.com/oauth/oauth2/auth
//   Token:     https://api.prod.whoop.com/oauth/oauth2/token
//   API base:  https://api.prod.whoop.com/developer/v2/*
//   Scopes:    read:recovery read:cycles read:sleep read:workout read:profile offline
//   Docs:      https://developer.whoop.com/docs/developing/oauth  /api
//
// The brief referenced the retired v1 paths; WHOOP's live API is v2 (verified
// against developer.whoop.com/api) so we target v2. `offline` scope is REQUIRED to
// receive a refresh token. `state` must be ≥8 chars (our signed JWT always is).
// Env: WHOOP_OAUTH_CLIENT_ID, WHOOP_OAUTH_CLIENT_SECRET.

const AUTH_ENDPOINT = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const TOKEN_ENDPOINT = 'https://api.prod.whoop.com/oauth/oauth2/token';
const API_BASE = 'https://api.prod.whoop.com/developer/v2';
const SCOPES = ['read:recovery', 'read:cycles', 'read:sleep', 'read:workout', 'read:profile', 'offline'];

function clientId() { return process.env.WHOOP_OAUTH_CLIENT_ID || ''; }
function clientSecret() { return process.env.WHOOP_OAUTH_CLIENT_SECRET || ''; }
function configured() { return !!(clientId() && clientSecret()); }

function authUrl({ state, redirectUri }) {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: clientId(),
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    state: state || '',
  });
  return AUTH_ENDPOINT + '?' + q.toString();
}

async function tokenRequest(params) {
  const r = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

async function exchangeCode({ code, redirectUri }) {
  const { ok, j } = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId(),
    client_secret: clientSecret(),
  });
  if (!ok) throw new Error('whoop token exchange failed: ' + (j.error_description || j.error || 'unknown'));
  let accountEmail = null;
  try {
    const prof = await fetchJson('/user/profile/basic', j.access_token);
    accountEmail = (prof && prof.email ? String(prof.email).toLowerCase() : null);
  } catch (e) { /* profile scope may be absent */ }
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token || null,
    expiresAt: j.expires_in ? new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString() : null,
    scope: j.scope || SCOPES.join(' '),
    accountEmail,
  };
}

async function refresh({ refreshToken }) {
  if (!refreshToken) throw new Error('whoop refresh: no refresh_token');
  const { ok, status, j } = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId(),
    client_secret: clientSecret(),
    scope: 'offline',
  });
  if (!ok) {
    const err = new Error('whoop refresh failed: ' + (j.error_description || j.error || status));
    err.needsReauth = (status === 400 || status === 401 || j.error === 'invalid_grant');
    throw err;
  }
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token || null, // WHOOP rotates the refresh token
    expiresAt: j.expires_in ? new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString() : null,
  };
}

async function fetchJson(path, accessToken, query) {
  const url = API_BASE + path + (query ? '?' + new URLSearchParams(query).toString() : '');
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
  if (!r.ok) {
    const err = new Error('whoop ' + path + ' failed: ' + r.status);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

// Page through a v2 collection endpoint (records[] + next_token). limit max 25.
async function fetchAll(path, accessToken, win) {
  const out = [];
  let next = null, guard = 0;
  do {
    const q = { start: win.start, end: win.end, limit: '25' };
    if (next) q.nextToken = next;
    const j = await fetchJson(path, accessToken, q);
    for (const rec of (j.records || [])) out.push(rec);
    next = j.next_token || null;
  } while (next && ++guard < 60);
  return out;
}

function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

// Fetch normalized health metrics since `sinceIso`. Returns a flat array of
// { metric_kind, value, measured_at, external_id, raw }.
async function fetchMetrics({ accessToken, since }) {
  const startIso = (since ? new Date(since) : new Date(Date.now() - 14 * 864e5)).toISOString();
  const endIso = new Date(Date.now() + 864e5).toISOString();
  const win = { start: startIso, end: endIso };
  const out = [];
  const push = (kind, value, at, id, raw) => {
    const v = num(value);
    if (v == null || !at) return;
    out.push({ metric_kind: kind, value: v, measured_at: new Date(at).toISOString(), external_id: String(id), raw: raw || null });
  };

  // recovery → recovery score, hrv, rhr
  try {
    for (const r of await fetchAll('/recovery', accessToken, win)) {
      if (r.score_state !== 'SCORED' || !r.score) continue;
      const at = r.created_at || r.updated_at;
      const id = r.cycle_id != null ? r.cycle_id : r.sleep_id;
      push('recovery', r.score.recovery_score, at, id, { cycle_id: r.cycle_id });
      push('hrv', r.score.hrv_rmssd_milli, at, id, { cycle_id: r.cycle_id });
      push('rhr', r.score.resting_heart_rate, at, id, { cycle_id: r.cycle_id });
    }
  } catch (e) { if (e.status === 401) throw e; }

  // sleep → sleep_score, sleep/deep/rem durations
  try {
    for (const s of await fetchAll('/activity/sleep', accessToken, win)) {
      if (s.score_state !== 'SCORED' || !s.score) continue;
      const at = s.end || s.created_at;
      const ss = s.score.stage_summary || {};
      push('sleep_score', s.score.sleep_performance_percentage, at, s.id, { nap: s.nap });
      const asleep = (num(ss.total_light_sleep_time_milli) || 0) + (num(ss.total_slow_wave_sleep_time_milli) || 0) + (num(ss.total_rem_sleep_time_milli) || 0);
      if (asleep > 0) push('sleep_duration_min', asleep / 60000, at, s.id, { nap: s.nap });
      if (num(ss.total_slow_wave_sleep_time_milli) != null) push('deep_sleep_min', ss.total_slow_wave_sleep_time_milli / 60000, at, s.id, { nap: s.nap });
      if (num(ss.total_rem_sleep_time_milli) != null) push('rem_min', ss.total_rem_sleep_time_milli / 60000, at, s.id, { nap: s.nap });
    }
  } catch (e) { if (e.status === 401) throw e; }

  // cycle → day strain
  try {
    for (const c of await fetchAll('/cycle', accessToken, win)) {
      if (c.score_state !== 'SCORED' || !c.score) continue;
      push('strain', c.score.strain, c.start || c.created_at, c.id, { end: c.end });
    }
  } catch (e) { if (e.status === 401) throw e; }

  return out;
}

module.exports = { configured, authUrl, exchangeCode, refresh, fetchMetrics, SCOPES };
