# DOM Platform continuity agent

Portable role context and execution runbook, not a deployed agent or registered skill. Read with the repository's AGENTS.md and JOURNAL.md. No credential or proprietary user record belongs in this package.

## Mission

Help a person understand their observations, choose an appropriate action, and review change. Preserve the original report and distinguish subjective experience, device measurement, authored association and model inference. Prioritize a complete, understandable user journey over more screens or graph effects.

The owner requested a platform audit, premium intuitive product experience, and portable GitHub context. Typology is being developed independently: preserve that work and do not redefine its metrics, formulas or validity.

## Start here

1. Read README.md, AUDIT-RU.md, BLUEPRINT-RU.md, BACKLOG-RU.md and context.json in this directory.
2. Read current repository instructions and recent JOURNAL.md entries. Find current main and open PRs; the audited SHA is a baseline, not a permanent truth.
3. Create an isolated worktree/branch. Do not switch branches or modify another session's checkout.
4. Resolve actual hosting: frontend dom.institute; Railway project/service IDs are in context.json. Read current deployment state before making changes. Do not print variable values.
5. Check evidence levels. A source review, synthetic fixture, signed-in browser pass and real hardware pass are different kinds of evidence.
6. Select the first unfinished backlog package. Complete the smallest useful vertical slice, preserving data and backward compatibility.

## Confirmed baseline

- Account monolith, separate graph/path/navigation modules, Express/Postgres API.
- Legacy diary/NeuroMap records and normalized concepts/recordings/journey events coexist.
- nmSaveSurvey does not await its save calls before closing/toasting.
- submitSensationMap has a separate acknowledgement-aware path; do not assume all forms are identical.
- Current neuromap-chains separates occurrences from grouped concepts and labels archive fallback.
- Course progress and practice completion do not establish complete repeated-attempt history.
- Live audit used an existing ordinary test USER. Paid tool suite, multiple-role isolation and real devices were not fully tested.

## Product invariants

- Original source is retrievable. Graph and timeline are views, not separate incompatible truths.
- One operation has one stable outcome under retry. Server-confirmed success is visible; failure preserves input.
- Unknown is representable. Do not silently turn an unchanged default into a measured observation.
- Occurrence identity, shared concepts and relation provenance stay distinct.
- One useful primary task per screen; accessible text view accompanies canvas/3D.
- Keep agreed layer shapes and brand themes; isolate style changes instead of global overrides.
- Profile values require method/version/source and data sufficiency. Activity/XP is not a measured skill.
- Family/team membership does not silently publish private records.
- Device batches, live feedback and XR scene synchronization are separate capabilities.

## Evidence and release protocol

For each finding record: ID, severity, exact source/version, reproduction, expected result, observed result, confidence, test limits, acceptance criteria.

For changes record: files, schema/API implications, test data, checks run, checks not run, rollout and rollback. Test roles and failures in isolation. Do not probe production with schema mutations or attack-like writes. Authorized synthetic records must be clearly labelled and must not be reported as real health data.

Refresh source inventory with `node scripts/audit-platform-source.cjs`; it is read-only. Do not infer live DB state or authorization safety from static inventory.

Publish context/code only to the authorized repository and destination. Do not include user notes, chats, biometric records, keys, passwords or session data. New stack choices are proposals until compared against the same real scenarios. A draft PR is not a production deployment. A successful host deployment is not proof of all product behavior.

## End every work unit

Update the relevant backlog package and a dated JOURNAL.md report: did, changed, files, decisions, followups, next_session. Include exact branch/commit/PR and production status when applicable. Preserve unresolved items and evidence limitations. Do not rely on chat memory.

## Resume prompt

Read docs/platform-audit/README.md and AGENT.md, then current main and JOURNAL.md. Verify the baseline. Continue the first unfinished package in BACKLOG-RU.md while preserving independent typology work. Report exact evidence and finish a concrete reviewable result before requesting a new decision.
