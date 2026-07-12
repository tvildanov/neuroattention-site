'use strict';
// Microsoft / Outlook provider — OAuth 2.0 (Microsoft identity platform, `common`
// tenant) + Microsoft Graph calendarView (readonly). Dependency-free native fetch.
// Authoritative refs:
//   https://learn.microsoft.com/azure/active-directory/develop/v2-oauth2-auth-code-flow
//   https://learn.microsoft.com/graph/api/user-list-calendarview
//
// Env: MS_OAUTH_CLIENT_ID, MS_OAUTH_CLIENT_SECRET. tenant=common (consumer + work).

const TENANT = 'common';
const AUTH_ENDPOINT = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`;
const TOKEN_ENDPOINT = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const CALVIEW_ENDPOINT = 'https://graph.microsoft.com/v1.0/me/calendarView';
const ME_ENDPOINT = 'https://graph.microsoft.com/v1.0/me';
// offline_access → refresh_token; Calendars.Read → read events; openid/email/User.Read → account email
const SCOPES = ['offline_access', 'openid', 'email', 'User.Read', 'Calendars.Read'];

function clientId() { return process.env.MS_OAUTH_CLIENT_ID || ''; }
function clientSecret() { return process.env.MS_OAUTH_CLIENT_SECRET || ''; }
function configured() { return !!(clientId() && clientSecret()); }

function authUrl({ state, redirectUri }) {
  const q = new URLSearchParams({
    client_id: clientId(),
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
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
  if (!r.ok) {
    const err = new Error('microsoft token failed: ' + (j.error_description || j.error || r.status));
    err.needsReauth = (j.error === 'invalid_grant' || j.error === 'interaction_required');
    throw err;
  }
  return j;
}

async function fetchAccountEmail(accessToken) {
  try {
    const r = await fetch(ME_ENDPOINT, { headers: { Authorization: 'Bearer ' + accessToken } });
    const j = await r.json().catch(() => ({}));
    return ((j.mail || j.userPrincipalName || '') + '').toLowerCase() || null;
  } catch (e) { return null; }
}

async function exchangeCode({ code, redirectUri }) {
  const j = await tokenRequest({
    client_id: clientId(),
    client_secret: clientSecret(),
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: SCOPES.join(' '),
  });
  const accountEmail = await fetchAccountEmail(j.access_token);
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token || null,
    expiresAt: j.expires_in ? new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString() : null,
    scope: j.scope || SCOPES.join(' '),
    accountEmail,
  };
}

async function refresh({ refreshToken }) {
  if (!refreshToken) throw new Error('microsoft refresh: no refresh_token');
  const j = await tokenRequest({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPES.join(' '),
  });
  return {
    accessToken: j.access_token,
    // MS may rotate the refresh token — surface it so the store can persist the new one.
    refreshToken: j.refresh_token || null,
    expiresAt: j.expires_in ? new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString() : null,
  };
}

// calendarView already expands recurrences into instances within the window.
async function fetchEvents({ accessToken, timeMin, timeMax }) {
  const out = [];
  const first = CALVIEW_ENDPOINT + '?' + new URLSearchParams({
    startDateTime: timeMin,
    endDateTime: timeMax,
    $select: 'id,subject,start,end,isAllDay,bodyPreview,isCancelled',
    $top: '200',
    $orderby: 'start/dateTime',
  }).toString();
  let url = first;
  let guard = 0;
  while (url && guard++ < 40) {
    const r = await fetch(url, {
      headers: {
        Authorization: 'Bearer ' + accessToken,
        Prefer: 'outlook.timezone="UTC"',
      },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error('microsoft calendarView failed: ' + (j.error?.message || r.status));
      err.status = r.status;
      throw err;
    }
    for (const ev of (j.value || [])) {
      if (ev.isCancelled) continue;
      const start = ev.start && ev.start.dateTime;
      if (!start) continue;
      // Graph returns naive UTC ('2026-01-02T09:00:00.0000000') with the Prefer header → append Z.
      const iso = (s) => s && !/[zZ]|[+\-]\d\d:?\d\d$/.test(s) ? s.replace(/\.\d+$/, '') + 'Z' : s;
      out.push({
        id: ev.id,
        title: ev.subject || '(no title)',
        start: iso(start),
        end: ev.end && ev.end.dateTime ? iso(ev.end.dateTime) : null,
        allDay: !!ev.isAllDay,
        description: ev.bodyPreview || '',
      });
    }
    url = j['@odata.nextLink'] || null;
  }
  return out;
}

module.exports = { configured, authUrl, exchangeCode, refresh, fetchEvents, SCOPES };
