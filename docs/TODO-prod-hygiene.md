# TODO — prod hygiene

## Test-user cleanup needs a non-interactive superadmin path

**Problem.** QA/verification harnesses (e.g. `scripts/atlas-verify-engine.mjs`,
the mobile-layout check) register throwaway users against the **prod** API via
`POST /api/auth/register` to reach the auth-gated dashboard. These users:

- get `role='user'` (the two superadmin slots are taken by founders, and the
  `SUPERADMIN_EMAILS` + `SUPERADMIN_LIMIT=2` rule means new `*@test.local`
  registrations do **not** auto-escalate — so no privilege risk today), **but**
- **cannot be deleted by the harness itself.** Every delete path
  (`POST /api/admin/users/:id/soft-delete`, `DELETE /api/admin/user`) requires a
  **superadmin** caller (`requireSuperadmin` — strictly `superadmin`, not even
  `founder`). The harness only holds the throwaway's own `user` token, and there
  is no self-delete endpoint.

Result: every harness run leaves an un-deletable test user on prod that a human
superadmin must clean up by hand (admin UI → search `atlas-mobile` / `test.local`
→ soft-delete).

**Proposed fixes (pick one, daylight decision — Tahir):**

1. **Dedicated QA superadmin** (e.g. `qa-bot@…`) whose token is stored as a
   Railway secret the harness can read, used only to soft-delete its own
   throwaways at end of run. Keeps prod clean automatically.
2. **Self-purge for `*@test.local`**: a small endpoint (or cron) that lets a
   `*@test.local` user soft-delete *itself*, or a cron that hard-deletes
   `*@test.local` users older than N hours. Scoped strictly to the test domain.
3. **Ephemeral test env / seeded DB** so QA never touches the prod users table.

Until then: leftover throwaway users accumulate and need manual cleanup.

**Known leftovers awaiting manual soft-delete (role=user, harmless):**
- `atlas-mobile-1782110107189@test.local` (id `e7fe8ff0-deec-4800-bb1f-807ec42a419f`)
- `atlas-mobile-1782110607406@test.local` (id `62b171ea-8935-4979-9a61-5e7fb0bbd341`)

Verify cleared: `GET /api/admin/users?search=atlas-mobile` → empty (superadmin token).

## Atlas: female anatomy model (separate issue)

The Male/Female toggle was removed (#68) — the Z-Anatomy GLBs are male-only
(`assets/3d/body/body-male.glb`; `atlas.setSex()` is a documented no-op stub).
To re-introduce sex switching we need a **female GLB source** (per-layer:
muscles/skeleton/nervous/vessels/organs + brain-detail), normalized to the same
atlas frame, then wire `setSex()` to swap layer URLs in `anatomy-models.json`.
Until that asset exists, keep the toggle removed.
