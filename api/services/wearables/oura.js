'use strict';
// Oura Ring provider — OAuth 2.0 Authorization Code flow + Oura API v2.
// Dependency-free: native fetch (Node 20). Authoritative refs (verified 2026-07-12):
//   Authorize: https://cloud.ouraring.com/oauth/authorize
//   Token:     https://api.ouraring.com/oauth/token
//   API base:  https://api.ouraring.com/v2/usercollection/*
//   Scopes:    email personal daily heartrate workout tag session spo2
//   Docs:      https://cloud.ouraring.com/v2/docs   https://cloud.ouraring.com/docs
//
// Env: OURA_OAUTH_CLIENT_ID, OURA_OAUTH_CLIENT_SECRET.
// redirectUri is passed in by the server (single source of truth) and must EXACTLY
// match a Redirect URI registered at https://cloud.ouraring.com/oauth/applications.

const AUTH_ENDPOINT = 'https://cloud.ouraring.com/oauth/authorize';
const TOKEN_ENDPOINT = 'https://api.ouraring.com/oauth/token';
const API_BASE = 'https://api.ouraring.com/v2/usercollection';
// `daily` covers sleep/readiness/activity summaries; `heartrate` for time-series HR;
// `personal`+`email` give us the account label + resting-HR context.
const SCOPES = ['email', 'personal', 'daily', 'heartrate'];

function clientId() { return process.env.OURA_OAUTH_CLIENT_ID || ''; }
function clientSecret() { return process.env.OURA_OAUTH_CLIENT_SECRET || ''; }
function configured() { return !!(clientId() && clientSecret()); }

// Consent URL. `state` is our signed anti-CSRF + user reference (built by server).
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
  if (!ok) throw new Error('oura token exchange failed: ' + (j.error_description || j.error || 'unknown'));
  let accountEmail = null;
  try {
    const info = await fetchJson('/personal_info', j.access_token);
    accountEmail = (info && info.email ? String(info.email).toLowerCase() : null);
  } catch (e) { /* email scope may be absent — label falls back to provider name */ }
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token || null,
    expiresAt: j.expires_in ? new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString() : null,
    scope: j.scope || SCOPES.join(' '),
    accountEmail,
  };
}

async function refresh({ refreshToken }) {
  if (!refreshToken) throw new Error('oura refresh: no refresh_token');
  const { ok, status, j } = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId(),
    client_secret: clientSecret(),
  });
  if (!ok) {
    const err = new Error('oura refresh failed: ' + (j.error_description || j.error || status));
    err.needsReauth = (status === 400 || j.error === 'invalid_grant');
    throw err;
  }
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token || null, // Oura rotates the refresh token
    expiresAt: j.expires_in ? new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString() : null,
  };
}

async function fetchJson(path, accessToken, query) {
  const url = API_BASE + path + (query ? '?' + new URLSearchParams(query).toString() : '');
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
  if (!r.ok) {
    const err = new Error('oura ' + path + ' failed: ' + r.status);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

// Page through a v2 usercollection endpoint (data[] + next_token).
async function fetchAll(path, accessToken, query) {
  const out = [];
  let next = null, guard = 0;
  do {
    const q = Object.assign({}, query, next ? { next_token: next } : {});
    const j = await fetchJson(path, accessToken, q);
    for (const item of (j.data || [])) out.push(item);
    next = j.next_token || null;
  } while (next && ++guard < 50);
  return out;
}

function ymd(d) { return new Date(d).toISOString().slice(0, 10); }
function num(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

// Fetch normalized health metrics since `sinceIso`. Returns a flat array of
// { metric_kind, value, measured_at, external_id, raw }. Never throws for a single
// empty stream — a stream that 401s bubbles up so the sync engine can flag re-auth.
async function fetchMetrics({ accessToken, since }) {
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 14 * 864e5);
  const start = ymd(sinceDate);
  const end = ymd(Date.now() + 864e5); // through tomorrow (inclusive window)
  const range = { start_date: start, end_date: end };
  const out = [];
  const push = (kind, value, at, id, raw) => {
    const v = num(value);
    if (v == null || !at) return;
    out.push({ metric_kind: kind, value: v, measured_at: new Date(at).toISOString(), external_id: String(id), raw: raw || null });
  };

  // daily_readiness → readiness score (Oura's recovery analog)
  try {
    for (const d of await fetchAll('/daily_readiness', accessToken, range)) {
      push('readiness', d.score, d.timestamp || (d.day + 'T12:00:00Z'), d.id, { day: d.day, score: d.score });
    }
  } catch (e) { if (e.status === 401) throw e; }

  // daily_sleep → sleep_score
  try {
    for (const d of await fetchAll('/daily_sleep', accessToken, range)) {
      push('sleep_score', d.score, d.timestamp || (d.day + 'T09:00:00Z'), d.id, { day: d.day, score: d.score });
    }
  } catch (e) { if (e.status === 401) throw e; }

  // sleep (detailed) → hrv, rhr, sleep/deep/rem durations
  try {
    for (const s of await fetchAll('/sleep', accessToken, range)) {
      const at = s.bedtime_end || (s.day + 'T09:00:00Z');
      push('hrv', s.average_hrv, at, s.id, { day: s.day });
      push('rhr', s.lowest_heart_rate, at, s.id, { day: s.day });
      if (num(s.total_sleep_duration) != null) push('sleep_duration_min', s.total_sleep_duration / 60, at, s.id, { day: s.day });
      if (num(s.deep_sleep_duration) != null) push('deep_sleep_min', s.deep_sleep_duration / 60, at, s.id, { day: s.day });
      if (num(s.rem_sleep_duration) != null) push('rem_min', s.rem_sleep_duration / 60, at, s.id, { day: s.day });
    }
  } catch (e) { if (e.status === 401) throw e; }

  return out;
}

module.exports = { configured, authUrl, exchangeCode, refresh, fetchMetrics, SCOPES };
