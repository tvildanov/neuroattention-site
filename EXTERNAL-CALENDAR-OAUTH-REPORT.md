# External Calendar OAuth — morning report (Phase 3, parallel to P6's unified-events)

**Branch:** `feat/external-calendar-oauth` (worktree `/Users/tvildanov/Code/na-calendar-oauth`, off `origin/main` @ `c623b08`)
**Commit:** `feat(calendar): External Calendar OAuth — Google + Apple iCloud + Outlook (mig063)`
**Status:** Code-complete, **feature-flagged OFF** (`EXTERNAL_CALENDARS` unset). Not merged, not deployed. Waits on OAuth credentials from Nick + P6 merge.

---

## TL;DR

Google Calendar, Apple iCloud (CalDAV), and Outlook (Microsoft Graph) import into the app. Imported events land on the **Personal Path** (`journey_events`, `source='imported_calendar'`) and the **month Calendar** (`calendar_events`, `event_type='imported'`), tagged 📥. Auto-sync every 6 hours + on-demand Refresh. Everything is inert until you set provider credentials and flip `EXTERNAL_CALENDARS=true` on Railway.

**Nothing works until you create the OAuth apps** (Google + Microsoft) and set the env vars below. Apple needs no app registration — only the user's app-specific password. Instructions per provider are at the bottom.

---

## ⚠️ Important deviation from the brief — verified against P6's actual code

The brief said: *"Assume P6 added `journey_events.imported_event_id` + `oauth_provider`."* **P6 did NOT add those columns.** I read P6's committed `feat/unified-events-phase1` (mig062 + `createEvent`) directly rather than assume. P6 added a generic `source TEXT` column (which holds `'imported_calendar'`) plus `title/notes/valence_*/chain_id/…` — no dedicated import columns.

**What I did instead:** migration **063** adds `imported_event_id`, `oauth_provider`, `oauth_account_email` to `journey_events` myself (all `ADD COLUMN IF NOT EXISTS`, so zero conflict with P6's mig062 regardless of merge order). I use P6's `source='imported_calendar'` convention. My write path (`store.upsertImportedEvent`) is **self-contained** — it does NOT call P6's `createEvent`, so there is no code-level dependency and no rebase conflict on that function.

**Migration numbering:** P6 reserved **062**. I took **063** (as the brief predicted). The two are independent and idempotent; they can run in either order.

---

## What's done (code-complete)

### Database — migration 063 (inline in `POST /api/run-migrations`)
- `oauth_tokens` — per connected account; tokens **encrypted at rest**. `UNIQUE(user_id, provider, account_email)`.
- `calendar_sync_log` — per-sync counts + duration + error.
- `journey_events` += `source, title, imported_event_id, oauth_provider, oauth_account_email` (IF NOT EXISTS).
- `calendar_events` += `imported_event_id, oauth_provider` (IF NOT EXISTS).
- Partial-unique dedup indexes on `(user_id, oauth_provider, imported_event_id)` for both tables.
- Idempotent, best-effort per statement. Returns `mig063 = { tables, columns, indexes, skipped?, error? }`.

### Backend — `api/services/calendar/*` (dependency-free: native `fetch` + Node `crypto`, **no new npm packages**)
- `crypto.js` — AES-256-GCM. Key from `ENCRYPTION_KEY`, **fallback `JWT_SECRET`** (works out of the box; see key note below).
- `google.js` — OAuth 2.0 web flow, `calendar.readonly`, `singleEvents=true` (recurrences expanded), refresh, pagination.
- `microsoft.js` — Microsoft identity `common` tenant, `Calendars.Read`, Graph `calendarView` (recurrences expanded), refresh-token rotation handled.
- `apple.js` — CalDAV (RFC 4791) + minimal iCal parser. App-specific password only; principal → home-set → calendars → time-ranged REPORT.
- `store.js` — token CRUD (encrypt/decrypt), sync log, `upsertImportedEvent` (dual-write Path + Calendar, dedup), `deleteImportedEvents`.
- `index.js` — provider registry, sync engine (refresh → fetch → upsert → log), **6h cron**, `EXTERNAL_CALENDARS` flag, `providerStatus()`.

### Endpoints (server.js)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/me/calendars` | list connected accounts + provider availability (never returns tokens); always 200 |
| GET | `/api/me/calendars/sync-log` | recent sync rows |
| GET | `/api/oauth/:provider/authorize` | google\|microsoft → `{ url }` consent link (client opens popup) |
| GET | `/api/oauth/:provider/callback` | provider redirect target; exchanges code, saves token, postMessages popup closed |
| POST | `/api/calendars/apple/connect` | `{ email, app_password }` → CalDAV validate + save |
| POST | `/api/calendars/:provider/sync` | on-demand sync (owner-scoped); `:provider` or `all` |
| DELETE | `/api/me/calendars/:id` | disconnect + remove imported events |

All mutating endpoints 503 cleanly when the flag is off. OAuth state is a 10-min signed JWT (anti-CSRF + user reference through the redirect).

### Frontend (`account.html`)
Profile → **"Подключенные календари"** card: connect buttons (Google/Outlook/Apple), connected-account rows with per-account Refresh + Disconnect + last-sync + `⚠ needs re-auth` badge, Apple CalDAV connect modal, sync-history log. Trilingual via a local `T` map (ru/en/es) — deliberately avoids the `a.*` i18n footgun. **Card is hidden entirely unless `EXTERNAL_CALENDARS=true`.**

### Service worker
`na-practices-v54` → **`v55`** (purges stale `account.html`).

---

## What waits on Nick (activation checklist)

1. **Create Google OAuth app** → set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (steps below).
2. **Create Microsoft (Azure) app** → set `MS_OAUTH_CLIENT_ID`, `MS_OAUTH_CLIENT_SECRET` (steps below).
3. **Apple** needs nothing from you — each user supplies their own app-specific password.
4. (Recommended) set a dedicated `ENCRYPTION_KEY` (any long random string). If unset, token encryption falls back to `JWT_SECRET` — works, but rotating `JWT_SECRET` would then invalidate stored calendar tokens (users reconnect).
5. Merge P6's unified-events → main, then this branch (trivial reconcile — see below).
6. Deploy Railway API + GitHub Pages.
7. `POST /api/run-migrations` (creates the tables — check `mig063` in the response).
8. Set **`EXTERNAL_CALENDARS=true`** on Railway. The 6h cron starts on next boot; the Profile card appears.

**Env var summary (Railway):**
```
EXTERNAL_CALENDARS=true
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
MS_OAUTH_CLIENT_ID=...
MS_OAUTH_CLIENT_SECRET=...
ENCRYPTION_KEY=<long-random>        # optional but recommended
OAUTH_REDIRECT_BASE=https://neuroattention-api-production.up.railway.app   # optional; this is the default
```

---

## OAuth setup — step by step

### Google Calendar
1. https://console.cloud.google.com/apis/credentials → pick/create a project.
2. Enable **Google Calendar API** (APIs & Services → Library).
3. Configure the **OAuth consent screen** (External; add scope `.../auth/calendar.readonly`; add test users while unverified, or publish).
4. **Create credentials → OAuth client ID → Web application.**
5. **Authorized redirect URI** (exact):
   `https://neuroattention-api-production.up.railway.app/api/oauth/google/callback`
6. Copy Client ID + Client secret → Railway `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`.

### Microsoft / Outlook
1. https://portal.azure.com → **Microsoft Entra ID → App registrations → New registration.**
2. Supported account types: **"Accounts in any org directory and personal Microsoft accounts"** (this is why we use the `common` tenant).
3. **Redirect URI** (platform = Web):
   `https://neuroattention-api-production.up.railway.app/api/oauth/microsoft/callback`
4. **API permissions → Microsoft Graph → Delegated → `Calendars.Read`, `offline_access`, `User.Read`, `openid`, `email`** → Grant admin consent (optional; users consent otherwise).
5. **Certificates & secrets → New client secret** → copy the **Value** (not the ID).
6. Application (client) ID + secret Value → Railway `MS_OAUTH_CLIENT_ID` / `MS_OAUTH_CLIENT_SECRET`.

### Apple iCloud (no app to create)
There is **no consumer OAuth for iCloud** — an Apple limitation. Each user, in the connect modal, is told to:
1. Go to https://appleid.apple.com → **Sign-In & Security → App-Specific Passwords**.
2. Create one named "NeuroAttention", copy the `xxxx-xxxx-xxxx-xxxx` password.
3. Enter their Apple ID email + that password in the app. We validate against `https://caldav.icloud.com/` and store the password **encrypted**.

---

## Rollout / rollback / safety

- **Flag OFF by default.** Endpoints 503, cron doesn't start, UI card hidden. Zero effect on existing flows until you flip it.
- **Rollback** = unset `EXTERNAL_CALENDARS`. Data already imported stays (it's normal Path/Calendar rows); to purge, users hit Disconnect, or run a `DELETE FROM journey_events WHERE source='imported_calendar'`.
- **Encryption**: tokens + Apple passwords are AES-256-GCM at rest. We never log secrets (only an 8-char key fingerprint). The list endpoint never returns tokens.
- **Rate limits**: Google 1M/day, MS Graph 10k/10min — never approached at 1 sync/6h/user. Apple CalDAV is undocumented; we stay conservative at 6h.
- **Delete-propagation**: `oauth_tokens`/`calendar_sync_log` have `ON DELETE CASCADE (user_id)`; `hardDeleteUser` already deletes the `users` row, so they clean up. Imported Path events are removed by the existing `journey_events` per-user delete and by Disconnect.

## Rebase note (after P6 → main)
Only one likely conflict: the `res.json({ … mig… })` return line in `/api/run-migrations` (P6 has `…mig061, mig062`; I have `…mig061, mig063`). Resolve to `…mig061, mig062, mig063`. Optionally, once P6 is in, `store.upsertImportedEvent` can be switched to delegate to P6's `createEvent` — not required; current code is correct standalone.

---

## Known limitations / open questions

1. **Apple CalDAV is untested against a live account** — I have no app-specific password. The client + iCal parser pass unit smoke tests (UTC, all-day, TZID→wall-clock), but iCloud's exact multistatus shape should be smoke-tested with a real password before GA. If it's flaky, swapping in the `tsdav` npm package is a one-file change in `apple.js`. **Do you have an app-specific password I can test with?**
2. **Timezones (Apple only):** `DTSTART;TZID=…` is imported as wall-clock (no VTIMEZONE resolution). UTC and all-day are exact. Google/MS return UTC — exact. Acceptable for a timeline; flag if you need per-TZID offset precision.
3. **Recurring events:** Google & MS expand instances server-side (`singleEvents`/`calendarView`) — correct. Apple returns RRULE masters; we import the master once at its DTSTART (no client-side expansion). Fine for most; note if iCloud recurring events must appear on every occurrence.
4. **Which calendars?** Currently Google = `primary` only; Apple = all calendars under the home-set; MS = default calendarView. Do you want multi-calendar selection UI, or is primary/all correct for v1?
5. **Sync window** is ±6 months. Widen if users need older/further events.
6. **`ENCRYPTION_KEY` provisioning:** the brief suggested auto-generating + `railway variables --set` on first use. I did **not** do that (a running app writing its own Railway env is fragile and diverges across instances). Falls back to `JWT_SECRET` instead. Set a dedicated key when convenient.

---

## Verification done / not done
- ✅ `node --check` on server.js + all 6 service modules.
- ✅ All 12 inline `account.html` scripts syntax-validated.
- ✅ Unit smoke: crypto encrypt/decrypt roundtrip; iCal parser (UTC/all-day/TZID); `providerStatus`; consent-URL builders (scopes, `access_type=offline`, `offline_access`, state); 365-day sync window.
- ⛔ **No live end-to-end** — needs real OAuth credentials + prod origin (local `account.html` can't hit the API cross-origin, CORS). Screenshots are a UI fixture (`cal-fixture.html`), per the brief's "use fixtures if no credentials".
