'use strict';
// Google Calendar provider — OAuth 2.0 Web Server flow + Calendar API v3 (readonly).
// Dependency-free: native fetch (Node 20). Authoritative refs:
//   https://developers.google.com/identity/protocols/oauth2/web-server
//   https://developers.google.com/calendar/api/v3/reference/events/list
//
// Env: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET.
// redirectUri is passed in by the server so it stays a single source of truth and
// must EXACTLY match an Authorized redirect URI in the Google Cloud OAuth client.

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const EVENTS_ENDPOINT = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly', 'openid', 'email'];

function clientId() { return process.env.GOOGLE_OAUTH_CLIENT_ID || ''; }
function clientSecret() { return process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''; }
function configured() { return !!(clientId() && clientSecret()); }

// Decode a JWT payload (id_token) without verifying signature — we only read the
// `email` claim, and the token came straight from Google's token endpoint over TLS.
function decodeJwtPayload(jwt) {
  try {
    const part = String(jwt).split('.')[1];
    if (!part) return {};
    const json = Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (e) { return {}; }
}

// Consent URL. `state` is our signed anti-CSRF + user reference (built by server).
function authUrl({ state, redirectUri }) {
  const q = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',      // request a refresh_token
    prompt: 'consent',           // force refresh_token even on re-auth
    include_granted_scopes: 'true',
    state: state || '',
  });
  return AUTH_ENDPOINT + '?' + q.toString();
}

async function exchangeCode({ code, redirectUri }) {
  const body = new URLSearchParams({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const r = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('google token exchange failed: ' + (j.error_description || j.error || r.status));
  const claims = decodeJwtPayload(j.id_token);
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token || null,
    expiresAt: j.expires_in ? new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString() : null,
    scope: j.scope || SCOPES.join(' '),
    accountEmail: (claims.email || '').toLowerCase() || null,
  };
}

async function refresh({ refreshToken }) {
  if (!refreshToken) throw new Error('google refresh: no refresh_token');
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: 'refresh_token',
  });
  const r = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error('google refresh failed: ' + (j.error_description || j.error || r.status));
    // invalid_grant ⇒ user revoked access / refresh token dead → needs re-auth
    err.needsReauth = (j.error === 'invalid_grant');
    throw err;
  }
  return {
    accessToken: j.access_token,
    expiresAt: j.expires_in ? new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString() : null,
  };
}

// Fetch events in [timeMin, timeMax] (ISO). singleEvents expands recurrences into
// concrete instances so the timeline gets real dated points, not RRULE templates.
async function fetchEvents({ accessToken, timeMin, timeMax }) {
  const out = [];
  let pageToken = null;
  let guard = 0;
  do {
    const q = new URLSearchParams({
      timeMin, timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      showDeleted: 'false',
    });
    if (pageToken) q.set('pageToken', pageToken);
    const r = await fetch(EVENTS_ENDPOINT + '?' + q.toString(), {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error('google events.list failed: ' + (j.error?.message || r.status));
      err.status = r.status;
      throw err;
    }
    for (const ev of (j.items || [])) {
      if (ev.status === 'cancelled') continue;
      const allDay = !!(ev.start && ev.start.date && !ev.start.dateTime);
      const start = ev.start && (ev.start.dateTime || ev.start.date);
      if (!start) continue;
      out.push({
        id: ev.id,
        title: ev.summary || '(no title)',
        start,
        end: ev.end && (ev.end.dateTime || ev.end.date) || null,
        allDay,
        description: ev.description || '',
      });
    }
    pageToken = j.nextPageToken || null;
  } while (pageToken && ++guard < 40);
  return out;
}

module.exports = { configured, authUrl, exchangeCode, refresh, fetchEvents, SCOPES };
