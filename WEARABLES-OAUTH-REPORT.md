# Wearable OAuth — Oura Ring + WHOOP — morning report

**Branch:** `feat/wearables-oauth` (worktree `/Users/tvildanov/Code/na-wearables`, off `origin/main`)
**Migration:** `065` · **Feature flag:** `WEARABLES_ENABLED` (default **OFF**) · **SW:** `na-practices-v56`
**Status:** code-complete, syntax-checked, fixture-verified in the real `account.html`. Inert in prod until Nick registers both OAuth apps + flips the flag.

Built parallel to P6 (unified events, mig062/064), P7 (external-calendar OAuth, mig063), P8 (UX). Zero shared-symbol / shared-route / migration-number collisions — see **Merge safety** below.

---

## What shipped

A full OAuth wearable-integration layer mirroring the P7 external-calendar architecture:

- **Two providers, dependency-free** (native `fetch`, Node built-in `crypto` — no npm adds):
  - **Oura Ring** — API v2. OAuth authorize `cloud.ouraring.com/oauth/authorize`, token `api.ouraring.com/oauth/token`, scopes `email personal daily heartrate`. Pulls `daily_readiness` (→ readiness), `daily_sleep` (→ sleep score), `sleep` detailed (→ HRV, RHR, sleep/deep/REM minutes).
  - **WHOOP** — API **v2** (the brief cited the retired v1; I verified the live API is v2 on developer.whoop.com and targeted it). OAuth authorize `api.prod.whoop.com/oauth/oauth2/auth`, token `.../oauth2/token`, scopes `read:recovery read:cycles read:sleep read:workout read:profile offline` (`offline` is required for a refresh token). Pulls `/recovery` (→ recovery score, HRV, RHR), `/activity/sleep` (→ sleep score + durations), `/cycle` (→ day strain).
  - All external interfaces confirmed against authoritative docs (per the "never guess external interfaces" rule), not memory.
- **Encrypted at rest** — tokens AES-256-GCM encrypted (`api/services/wearables/crypto.js`), key = `ENCRYPTION_KEY` → falls back to `JWT_SECRET`. Same key source as P7 so ops sets **one** key.
- **6-hour cron + on-demand sync**, gentle on rate limits (sequential), 14-day backfill on first connect, 6-hour re-fetch overlap to catch late-scored nights. Auto token refresh; dead grants flag `needs_reauth` (UI shows a "Reconnect" button).
- **UI — Profile → «Подключенные устройства»** (ru/en/es): connect / 🔄 sync / 🗑 disconnect per device, last-sync-ago, re-auth warnings, expandable sync log. Card stays hidden until the flag is on (or a device is already connected).
- **Personal Path** — a **🫀 Восстановление / Recovery** layer toggle renders a 60-day ribbon: green (>70) / yellow (50–70) / red (<50), hover shows HRV · RHR · sleep.
- **NeuroMap** — clicking an emotion node adds a **«Physical state that day»** section (recovery %, HRV, resting HR, sleep) for that node's day — subjective ↔ objective in one place. Silent when there is no device data for the day.

### DB (migration 065, inline in `/api/run-migrations`, idempotent)
- `oauth_tokens` — **shared** with P7; `CREATE TABLE IF NOT EXISTS` with the identical schema, so whichever of mig063/mig065 runs first wins and the other is a no-op. All wearable queries are scoped `provider IN ('oura','whoop')` so calendar rows are never touched.
- `health_metrics` — `(user_id, provider, metric_kind, value, measured_at, synced_at, external_id, raw_data)`, dedup `UNIQUE(user_id, provider, metric_kind, measured_at, external_id)`, indexed for range + kind lookups.
- `wearable_sync_log` — per-run added/updated/duration/error.

### Files
```
api/services/wearables/crypto.js   token encryption (AES-256-GCM)
api/services/wearables/store.js    oauth_tokens (wearable-scoped) + health_metrics + sync log
api/services/wearables/oura.js     Oura v2 provider
api/services/wearables/whoop.js    WHOOP v2 provider
api/services/wearables/index.js    sync engine, 6h cron, WEARABLES_ENABLED flag, dailyDigest
api/server.js                      mig065, init, 8 endpoints, startCron
account.html                       Profile devices card, Path recovery ribbon, NeuroMap phys-state
data/i18n/{ru,en,es}.json          a.wearables.* (all three locales)
sw.js                              CACHE_NAME → na-practices-v56
scripts/wearables-shots.mjs        reproducible fixture screenshot harness
```

### Endpoints (all owner-scoped; namespaced under `/api/wearables/` to avoid P7's `/api/oauth/:provider`)
```
GET    /api/me/wearables                     list devices + provider availability (always 200)
GET    /api/me/wearables/sync-log            recent sync runs
GET    /api/me/health-metrics?kind=&from=&to=  raw metrics
GET    /api/me/health-metrics/daily?from=&to=  per-day digest (Path ribbon + NeuroMap panel)
GET    /api/wearables/:provider/authorize    → consent URL (popup)
GET    /api/wearables/:provider/callback     OAuth redirect target
POST   /api/wearables/:provider/sync         on-demand sync (:provider = oura|whoop|all)
DELETE /api/me/wearables/:id                 disconnect + delete its metrics
```

---

## ⚙️ Nick — OAuth setup (required before turning it on)

### 1. Register the Oura OAuth application
1. Sign in at **https://cloud.ouraring.com/oauth/applications** → **Create New Application**.
2. **Redirect URI** (exact): `https://neuroattention-api-production.up.railway.app/api/wearables/oura/callback`
3. Scopes to enable: `email`, `personal`, `daily`, `heartrate`.
4. Copy the **Client ID** and **Client Secret**.

### 2. Register the WHOOP OAuth application
1. Sign in at **https://developer.whoop.com** → developer dashboard → **Create App**.
2. **Redirect URI** (exact): `https://neuroattention-api-production.up.railway.app/api/wearables/whoop/callback`
3. Scopes: `read:recovery`, `read:cycles`, `read:sleep`, `read:workout`, `read:profile`, `offline`.
4. Copy the **Client ID** and **Client Secret**.

### 3. Set the Railway env vars (API service)
```
OURA_OAUTH_CLIENT_ID       = <from step 1>
OURA_OAUTH_CLIENT_SECRET   = <from step 1>
WHOOP_OAUTH_CLIENT_ID      = <from step 2>
WHOOP_OAUTH_CLIENT_SECRET  = <from step 2>
WEARABLES_ENABLED          = true
# recommended (decouples token encryption from JWT_SECRET rotation):
ENCRYPTION_KEY             = <any long random string>   # if unset, falls back to JWT_SECRET
# only if the API is not on the default Railway origin:
# OAUTH_REDIRECT_BASE      = https://<api-origin>
```
Never commit these — env only.

### 4. After deploy
1. `POST https://neuroattention-api-production.up.railway.app/api/run-migrations` → confirm `mig065: { tables: 3, indexes: 4 }`.
2. Open Profile → «Подключенные устройства», click **＋ Oura Ring** / **＋ WHOOP**, complete consent. First sync backfills ~14 days.

**Rollback:** unset `WEARABLES_ENABLED` (endpoints 503, cron stops, UI hides). Data + tables remain.

---

## Merge safety (P6 / P7 / P8 run in parallel)
- **Migration number 065** — free (main=061, P6=062–064, P7=063).
- **`oauth_tokens`** shared with P7 via `CREATE TABLE IF NOT EXISTS` (identical schema) — order-independent.
- **Routes** namespaced `/api/wearables/*` — no clash with P7's `/api/oauth/:provider/*`. **Helper symbols** all `wear*`-prefixed (`WEAR_REDIRECT_BASE`, `wearSignState`, `wearPopupHtml`, …) — no `const` redecl with P7.
- **SW** `v56` (P6=v54, P7=v55).
- **i18n / `run-migrations` return line** — likely trivial textual merge conflicts (append-only). Keep both sides.

### One follow-up for the P7↔P9 merge
P7's calendar cron (`allActiveTokens`) selects **all** `oauth_tokens` rows with no provider filter. Once both features share the table, that cron will pick up oura/whoop rows and log 2 harmless "unknown provider" errors per wearable token per cycle (it never mutates them). My wearables cron is correctly scoped and never touches calendar rows. Fix at merge time: add `AND provider = ANY(...)` to calendar's `allActiveTokens`. Not blocking.

---

## Verification
- `node --check` passes on `server.js` + all five service modules; all three i18n JSONs parse.
- Service logic smoke-tested standalone: `providerStatus`, `authUrl` (both providers), and `dailyDigest` (WHOOP recovery + Oura readiness fold into one per-day snapshot).
- **Real `account.html`** rendered via the fixture harness (`scripts/wearables-shots.mjs`, system Chrome) — no console errors. Screenshots:
  - (a) `wear-a-add.png` — add-device buttons (flag on, no devices)
  - (b) `wear-b-connected.png` — Oura + WHOOP connected + last-sync
  - (c) `wear-c-recovery-ribbon.png` — Path recovery ribbon green/yellow/red
  - (d) `wear-d-neuromap-physstate.png` — NeuroMap emotion node physical-state
  - (e) `wear-e-synclog.png` — sync log incl. an error row
- **Not done** (needs Nick's credentials): live OAuth round-trip + real device data. `account.html` can't hit the API locally (CORS) — this is the standard prod-after-flag verification.
