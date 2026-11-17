# DOM v0.3 — implementation checkpoint

Date: 2026-11-16. Source received **in full in the chat**, including final section O. Package 03 overrides historical alternatives. User explicitly authorises implementation, commits and deployment after checks; old 'do not edit production now' collection notes are superseded by the current request.

Base main: `687f60703fb54d70536534ef39e95b8ee0a5a0e7`.
Branch: `codex/home-master-v03-20261116`.
Parallel typology branch head: `26c9b18cb1b4ba3a0b9ef81f47ced13e1f403ebb`; 23 commits ahead / 1 behind main, documentation/audit only. Do not merge or overwrite it.

## Sources and recovery

Canonical master attachment: `DOM_Institute_Site_Changes_Master_v0.3_2026-11-16.md`, Library ID `libfile_9d027dc078d4819189be94055a3cf5a8`; TXT equivalent `libfile_579d3b24896081919322ab9d4adb225e`. Quickstart `libfile_9cd127bcb9cc8191ab2531c79b146f84`. The user pasted both the Quickstart and full master into this chat after execution environment failed. The files remain intact; this registry is an implementation map, not a replacement source specification.

## Actual findings

- Local execution recovered. GitHub reads work; CLI pushes require credentials unavailable to this runtime. Small GitHub connector writes work. Large full-file writes hang, so apply a reviewable checked-in patch through a temporary narrowly scoped feature-branch workflow, then remove that workflow. No production deployment yet.
- Auth registration creates unverified accounts and requires location coordinates. Partner flow must not reuse that endpoint blindly. SMTP variables are present (names-only check; values not exposed).
- `requireAuth` accepts a MONAD read-only service principal mapped to a privileged human. Partner personal-data routes must explicitly reject `req.monadReadonly` and read real user roles/permissions from DB.
- Frontend uses GitHub Pages; Railway `neuroattention-api`: project `1dd157e4-547e-4b08-9ba3-0be4202bfab3`, environment `502fd87d-1730-4c7b-bc36-efc96f082065`, service `90c8e681-c84e-4b59-8074-942afde84f7a`, repo main. Current latest deployment SUCCESS `650b1c4e-154e-412f-a0ea-6f3ba967d1fc` (existing release, not v0.3).

## Current implementation checkpoint

Public UI, verified-email partner API, real form, cabinet tab and permission-gated review queue are implemented. Remote workflow 43994609013 passed the 30 public UI locale/theme/viewport cases and isolated PostgreSQL API tests for the previous frontend/backend checkpoint. Local browser form tests now pass all six RU/EN/ES × dark/light combinations, including history, failed submission/retry, real receipt and own-account rendering. They use an isolated API fixture; the separate backend suite uses real isolated PostgreSQL. This does not establish production SMTP delivery. Latest hardening adds payload-digest retry protection, removes unverified-email privilege grants in old signup, restores exact return scroll and prevents the optional residence prompt from interrupting partnership receipts. Final CI and release verification are still pending.

All registry rows below describe implemented code or an explicitly preserved/deferred concept. The final cross-browser/visual/production verification remains a release gate; do not interpret “Implemented” as a production claim. External anatomy accuracy and full atlas availability are not established: the public copy describes the concept and does not assert unrestricted availability. Remote analytics is intentionally not enabled; local-only progression works without consent to analytics.

## Delivery stages

1. Source/audit/checkpoint (this commit).
2. Ecosystem/Space/research/directions and XR copy, localized data, scoped CSS and behavior; preserve image scale/anatomy/canonical typology.
3. Anonymous local journey and optional observations, history restoration; no remote analytics without consent/infrastructure.
4. Partner verified-email auth, real application persistence, user cabinet and narrowly scoped admin; additive migration, no account-role escalation.
5. Remote CI: syntax, pure logic, DB-backed integration, Playwright layout/keyboard/history/locales/themes, security. Review evidence and fix before merge.
6. Refresh main, integrate concurrent changes, release in sequence, observe GitHub/Railway terminal success and actual domain.

## Pending editorial / conceptual items

DOM Space is working branding; six direction labels are editorial clusters, all forming. Pilot order is UX draft, not a formal scientific priority. XR-03 A is provisional copy; point/sphere/field method semantics require future methodological confirmation. No medical/academic accreditation, working cameras/hardware kits, personal anatomical measurement, automatic research enrolment or proven anti-aging claims. First physical site USA only, no public Chile. Typology is out of scope. No fake successful form submission.

## Requirement registry

| ID | Status | Implementation requirement |
|---|---|---|
| XR-01 | Implemented; final QA pending | Preserve both XR image halves, all 12 hotspots and existing scale; fit laptop viewports without cropping. |
| XR-02 | Implemented; final QA pending | XR label under title; unchanged distance slogan centred over right half. |
| XR-03 | Implemented; final QA pending | Use compact draft A without treating wording or method terms as author-approved final copy. |
| XR-04 | Implemented; final QA pending | One scene-level concept/demo disclosure; verify atlas availability before availability claims. |
| XR-05 | Implemented; final QA pending | Demo avatar/name/profile, pulse 72 bpm and EEG peak 10.2 Hz; no XP or real sensitive values. |
| XR-06 | Implemented; final QA pending | Brain atlas value: anatomy, functions, lessons and practice; personalised model remains future. |
| XR-07 | Implemented; final QA pending | Compatible devices as one system; integrated DOM kit in development; no arbitrary device/LLM support. |
| XR-08 | Implemented; final QA pending | Attention point: chosen focus, no localisation of neural activation. |
| XR-09 | Implemented; final QA pending | Sphere: internal sensations, interoceptive map as methodological hypothesis. |
| XR-10 | Implemented; final QA pending | Field: body position/movement and surrounding space; preserve three separate controls. |
| XR-11 | Implemented; final QA pending | Presence across distance; no fixed camera hardware specification or permission prompt. |
| XR-12 | Implemented; final QA pending | Hand superficial radial sensory territory; verify projection rather than claiming exact individual nerve course. |
| XR-13 | Implemented; final QA pending | Hand sensations self-reported manually/voice in concept; distinguish reported/measured/inferred. |
| XR-14 | Implemented; final QA pending | Personal time map: observations, sensor signals and context; no causal proof claims. |
| XR-15 | Implemented; final QA pending | EEG rhythmic electrical activity, Hz; no whole-brain localisation from simple sensor. |
| XR-16 | Implemented; final QA pending | Pulse changes with breathing/load/experience; no direct stress or attention measurement. |
| HOME-17 | Implemented; final QA pending | Preserve profile demo and Methods/Protocols/Programs; defer canonical typology sync to separate branch; educational example label. |
| HOME-18 | Implemented; final QA pending | Russian ecosystem heading three lines; subtitle offset through layout, not spaces; natural EN/ES/mobile. |
| HOME-19 | Implemented; final QA pending | Larger wheel and adjacent panels without increasing desktop section height. |
| HOME-20 | Implemented; final QA pending | Central DOM card causal ecosystem mechanism, superseded by HOME-39 synthesis. |
| HOME-21 | Implemented; final QA pending | Keep six named sectors; targeted factual/editorial fixes only. |
| HOME-22 | Implemented; final QA pending | Physical space has four complementary dimensions, broader than residential restoration. |
| HOME-23 | Implemented; final QA pending | Four switches and existing concept image; not another circular diagram; approved by package 03. |
| HOME-24 | Implemented; final QA pending | Four perspective copy preserved and superseded by HOME-46. |
| HOME-25 | Implemented; final QA pending | Optional nested participant path: request/state, plan, residence, review, transfer to everyday life. |
| HOME-26 | Implemented; final QA pending | Routes for participants, students, researchers, engineers, partners and community. |
| HOME-27 | Implemented; final QA pending | Keep project zones including spa, Dark Retreat, family/children, workshops, landscape; no built-infrastructure claims. |
| HOME-28 | Implemented; final QA pending | Community/projects beyond visit; certification, funding, membership remain future. |
| HOME-29 | Implemented; final QA pending | First planned space USA; Chile suppressed by HOME-50. |
| HOME-30 | Implemented; final QA pending | DOM Space working display name, not final legal brand. |
| HOME-31 | Implemented; final QA pending | Institute/Lab institutional directions and research agenda; do not repeat methods triad. |
| HOME-32 | Implemented; final QA pending | Six public forming directions plus complete future catalogue, no accreditation or ready faculty claims. |
| HOME-33 | Implemented; final QA pending | Earlier research candidates superseded by four pilot topics. |
| HOME-34 | Implemented; final QA pending | International invitation to co-create directions/research; real partner route. |
| HOME-35 | Implemented; final QA pending | Research and education feedback cycle, voluntary research separate from services. |
| HOME-36 | Implemented; final QA pending | Fresh-main separate branch, shared file preservation, both themes/locales/accessibility/viewport checks. |
| HOME-37 | Implemented; final QA pending | Seven numbered controls: research, education, rehabilitation, technology, community, economy/projects, central DOM. |
| HOME-38 | Implemented; final QA pending | Visited/selected/suggestedNext/finalReached; staged SVG arrows; arbitrary order and repeat-close; six nodes required for full contour. |
| HOME-39 | Implemented; final QA pending | Compact central synthesis of A+B+C: knowledge/practice feedback, person-to-society scale, evolving ecosystem, physical embodiment. |
| HOME-40 | Implemented; final QA pending | Real link from DOM card to #dom-campus with future-tense bridge. |
| HOME-41 | Implemented; final QA pending | Keep enlarged composition and original six texts where sound; no desktop height growth. |
| HOME-42 | Implemented; final QA pending | DOM Space / One space. Four dimensions. Planned first physical space in USA. |
| HOME-43 | Implemented; final QA pending | Remove old four guest steps from main canvas; preserve as optional nested path. |
| HOME-44 | Implemented; final QA pending | Four visible numbered perspective controls; one expanded card; concept image remains. |
| HOME-45 | Implemented; final QA pending | Suggested 01→04, direct access, persisted visited, static reduced-motion and viewport-only pulse. |
| HOME-46 | Implemented; final QA pending | Four copy themes: reproducible model of environment; integrated residential development; institute/education/research; NeuroAttention-designed environment. |
| HOME-47 | Implemented; final QA pending | Zone programme preserved; optional compact secondary list; 12 houses/8 cabins are unapproved concept counts. |
| HOME-48 | Implemented; final QA pending | NeuroAttention applies equally to team preparation and architecture/light/sound/materials/routes/privacy/rhythm. |
| HOME-49 | Implemented; final QA pending | Different participation routes beyond buying a retreat, including creating/research/engineering/partnership/community. |
| HOME-50 | Implemented; final QA pending | USA only publicly; searching/negotiating/designing, not open campus. |
| HOME-51 | Implemented; final QA pending | Institute/Lab two linked parts and shared invitation beneath both. |
| HOME-52 | Implemented; final QA pending | Six forming directions with descriptions; names editorial working clusters. |
| HOME-53 | Implemented; final QA pending | Complete catalogue; distinguish school/research_track/pilot/method/campus_activity and many-to-many links. |
| HOME-54 | Implemented; final QA pending | Read direction first; separate visible cooperation action with preselected direction, hover/focus/touch parity. |
| HOME-55 | Implemented; final QA pending | Partner form multiselect/custom/name/email/optional location/competence/proposal/portfolio; consent; verified-email account link/create; real submission/idempotency/draft-on-error. |
| HOME-56 | Implemented; final QA pending | Partner application/status in cabinet; client functions retained; only superadmin or explicit read/manage permission sees queue; audit changes. |
| HOME-57 | Implemented; final QA pending | Cancel/back/forward returns to original Institute/Lab state/scroll; safe local returnTo only. |
| HOME-58 | Implemented; final QA pending | Shared prominent co-creation CTA beneath Institute and Lab; no promised role/funding. |
| HOME-59 | Implemented; final QA pending | Four initial pilots, not entire agenda, no proven outcome/open enrolment claims. |
| HOME-60 | Implemented; final QA pending | Four questions visible, one detail; longevity first; optional sequential suggestions. |
| HOME-61 | Implemented; final QA pending | Quality longevity: cognition, mobility, independence, engagement incl care homes; no proven cell anti-aging. |
| HOME-62 | Implemented; final QA pending | Youth transition from school/family/care to autonomous life; abilities/goals/self-regulation/technology, no ideological prescription. |
| HOME-63 | Implemented; final QA pending | Human–AI partnership research, autonomy and effects on attention/thinking/relationships; AI consciousness/species not fact. |
| HOME-64 | Implemented; final QA pending | Business adaptation at founder/team/product levels; AI tool rather than purpose, no guaranteed revenue. |
| HOME-65 | Implemented; final QA pending | Pilots cross disciplines; cooperation preselects research interest/topic. |
| HOME-66 | Implemented; final QA pending | Subtle side progress rail, one-time completed flash, mobile compact; no XP/gates. |
| HOME-67 | Implemented; final QA pending | Actual homepage order; distinguish seen/explored/completed; passive sections progress without forced clicks. |
| HOME-68 | Implemented; final QA pending | Optional individual/social observations, multiselect/Other/Skip; no assumption of pathology; free text local-only. |
| HOME-69 | Implemented; final QA pending | Versioned local anonymous progress with TTL, not IP; history/session restores form return and open panels. |
| HOME-70 | Implemented; final QA pending | Optional consent-gated aggregate events only if existing infrastructure fits; never email/name/proposals/health/free text/IP in analytics. |
| HOME-71 | Implemented; final QA pending | Matrix green/electric blue, one suggested control per active screen; keyboard/aria/focus/touch/reduced-motion. |
| HOME-72 | CTA audit pending | Final CTA/anchor audit after route assembled; preserve working links until replacement verified. |
| HOME-73 | Implemented; final QA pending | QA all steps, RU/EN/ES, dark/light, 1440×900/1366×768/1280×720/320/375px, history, permissions, true backend submission, terminal deployments/live check. |

## Backend checkpoint

`api/partner.js` and additive `078_partner_applications.sql` provide verified-email challenge flow, existing identity reuse, real idempotent applications, owner-only reads, explicit read/manage reviewer grants and optimistic audited status changes. Raw roles/owners from the frontend are ignored; MONAD readonly identity is refused. SMTP absence/failure does not return successful verification/delivery. Production handler shares the existing JWT/SMTP context. PostgreSQL-backed integration tests added to branch CI; test mail is isolated, not sent to people. UI flow/cabinet remain the next stage. Tests not yet passed; no merge/deploy.

## Recovery after interrupted save

Remote checkpoint confirmed e3cbc41a3026de11d427a4fb3d32af1847275e5c. Form/cabinet files from the interrupted operation are not committed; restore these next. API integration job 133703979774 passed. Browser assertion found #dom-ecosystem 797.78px tall at 1366x768; test process failed to exit and hit job timeout. Fail-fast and selector-precedence fixes are now committed for another CI pass. Production untouched.

## Current local recovery state

The executor became available. Worktree: dom-v03-work; original checkout untouched. Form/cabinet code is safely in commit 67fb611. Public UI CI passed for 4f138b4; API CI passed for e3cbc41. Current work adds actual partner browser scenarios, account cache invalidation, signup privilege guards and idempotency-body protection. Verify this new commit's CI before release. Browser fixtures never send external emails or real submissions.
