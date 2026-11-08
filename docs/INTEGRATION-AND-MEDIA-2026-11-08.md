# Site integration and media diagnosis — 2026-11-08

## Monad
- Railway neuroattention-api and monad-server deployments are SUCCESS.
- Public GET /health on site API returns ok:true, monad_configured:true. Source shows configured only checks presence of MONAD_API_KEY; this is not an authenticated connectivity check.
- Public GET on Monad /api/persona/health returns HTTP 200, ok:true, hosted:true, enabled:true, llm:true.
- Site runtime logs show Unauthorized from mcpCall for architecture, inbox sync and message plant_seed, including 2026-11-06. Latest post-release authenticated user round trip has not been reproduced.
- Site sends X-API-Key from its server-side MONAD_API_KEY. Monad supports this header and checks env credentials or registered agent keys; OAuth credentials also have validity/binding checks.
- Leading hypothesis: stale/invalid site credential (or registered agent status). Cannot distinguish rotation, agent status or other key mismatch without an authenticated read test.
- Railway OAuth connector redacts variable values; confirmed MONAD_API_KEY exists but did not retrieve or modify secrets. No account impersonation, key rotation or auth changes performed.
- Next: owner/Monad administrator validates the site integration credential in neuroattention-api, updates it securely if stale, then checks an authenticated architecture read and the correct human/persona mapping. Chat send is a separate explicit functional test.

## External images
All eight index.html CloudFront image URLs return HTTP 403. Response body for a lab image is S3-style AccessDenied / Access Denied. This proves storage access refusal; expiration vs deletion vs policy change is unconfirmed.
No matching originals exist in the current repository tree. Public markup still references the images; they were not removed by the homepage rebrand.
Affected: XR platform, three lab images, founder Nick Ivanov, Takhir Kennedy, Sia Ivanova, Yegor Kondratev.
Next: recover originals from the original asset owner/export, then serve stable repository-owned assets or controlled public storage. Do not replace real team portraits with invented images.

## Header tab draft
36px bar (was 48px), existing 13–22px font sizing preserved, font-family now existing hero font Unbounded; RU/EN/ES title case. Checked Chromium at 320/375/768/1440. No deployment in this turn.
