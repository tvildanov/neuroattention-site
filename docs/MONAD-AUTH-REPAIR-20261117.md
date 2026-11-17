# Monad cabinet authorization repair — 2026-11-17

## Incident
Authenticated cabinet requests reached neuroattention-api but failed in its downstream MCP call with Unauthorized. This is separate from website login. The existing API key in the website environment was not accepted by Monad. Credential values are redacted by Railway; the exact rotation event and cause of rotation were not independently audited.

## Repair
Production neuroattention-api MONAD_API_KEY now uses Railway's protected reference to monad-server.MONAD_API_KEY, in project monad-mcp / production. The deployed Monad MCP gate explicitly accepts that environment key. No master key was used and no credential value was read, printed, copied into GitHub, or sent to a browser. User roles and access flags were not changed.

The existing Human → own Persona path is preserved. Offline assertions cover Nikita, Egor, Nastya, explicit database identities, email fallbacks and unknown users. This checks route resolution, not a live user session or every database record. No messages were written into real chats.

## Source and checks
PR: https://github.com/tvildanov/neuroattention-site/pull/192
Merged source: 023940a9aceb0f2db52a40b58ae54690e2905bcd
Routing workflow: https://github.com/tvildanov/neuroattention-site/actions/runs/44126964924 — success
API/container workflow: https://github.com/tvildanov/neuroattention-site/actions/runs/44126964416 — success

Manual operator check: node api/scripts/check-monad-connection.js
Offline: add --offline. Live mode invokes only read-only get_architecture through the existing MCP client and prints status booleans, never returned data. It times out after 25 seconds and fails closed.

## Limits
Real authenticated user conversations and model-generated replies have not been exercised. Earlier Monad logs also contain Cursor provider HTTP 429 errors in the Telegram companion path; those are distinct from the cabinet bridge Unauthorized and were not used as evidence of current cabinet failure. No model/provider settings were changed. Parallel typology work is untouched.

## Production evidence

Deployment 87d937a0-7886-44e0-948a-d2a6bd145816 reached SUCCESS. At 2026-11-17T16:39:48Z, its read-only pre-deploy checks reported:

```json
{"routing":{"ok":true,"personas":3},"mcp":{"ok":true,"authenticated":true,"tool":"get_architecture"}}
```

The follow-up runtime-health probe deployment d88fb6a3-e469-4a8e-a23f-5ba7759a3572 is still BUILDING as of 2026-11-17T16:43Z; no runtime-health result is claimed yet. Current configured start command is restored to node server.js and temporary pre-deploy checks have been cleared for future deployments. The protected credential reference remains.
