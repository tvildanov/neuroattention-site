# DOM v0.3 — implementation checkpoint

Date: 2026-11-16. Source received **in full in the chat**, including final section O. Package 03 overrides historical alternatives. User explicitly authorises implementation, commits and deployment after checks; old 'do not edit production now' collection notes are superseded by the current request.

Base main: `687f60703fb54d70536534ef39e95b8ee0a5a0e7`.
Branch: `codex/home-master-v03-20261116`.
Parallel typology branch head: `26c9b18cb1b4ba3a0b9ef81f47ced13e1f403ebb`; 23 commits ahead / 1 behind main, documentation/audit only. Do not merge or overwrite it.

## Sources and recovery

Canonical master attachment: `DOM_Institute_Site_Changes_Master_v0.3_2026-11-16.md`, Library ID `libfile_9d027dc078d4819189be94055a3cf5a8`; TXT equivalent `libfile_579d3b24896081919322ab9d4adb225e`. Quickstart `libfile_9cd127bcb9cc8191ab2531c79b146f84`. The user pasted both the Quickstart and full master into this chat after execution environment failed. The files remain intact; this registry is an implementation map, not a replacement source specification.

## Actual findings

- Local execution unavailable (`No usable execution environment is available`). GitHub and Railway connectors work. Never claim local/browser/backend tests ran until actual evidence exists. Prepare branch CI for remote execution; do not deploy unchecked code.
- Auth registration creates unverified accounts and requires location coordinates. Partner flow must not reuse that endpoint blindly. SMTP variables are present (names-only check; values not exposed).
- `requireAuth` accepts a MONAD read-only service principal mapped to a privileged human. Partner personal-data routes must explicitly reject `req.monadReadonly` and read real user roles/permissions from DB.
- Frontend uses GitHub Pages; Railway `neuroattention-api`: project `1dd157e4-547e-4b08-9ba3-0be4202bfab3`, environment `502fd87d-1730-4c7b-bc36-efc96f082065`, service `90c8e681-c84e-4b59-8074-942afde84f7a`, repo main. Current latest deployment SUCCESS `650b1c4e-154e-412f-a0ea-6f3ba967d1fc` (existing release, not v0.3).

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
| XR-01 | Pending | Preserve both XR image halves, all 12 hotspots and existing scale; fit laptop viewports without cropping. |
| XR-02 | Pending | XR label under title; unchanged distance slogan centred over right half. |
| XR-03 | Pending | Use compact draft A without treating wording or method terms as author-approved final copy. |
| XR-04 | Pending | One scene-level concept/demo disclosure; verify atlas availability before availability claims. |
| XR-05 | Pending | Demo avatar/name/profile, pulse 72 bpm and EEG peak 10.2 Hz; no XP or real sensitive values. |
| XR-06 | Pending | Brain atlas value: anatomy, functions, lessons and practice; personalised model remains future. |
| XR-07 | Pending | Compatible devices as one system; integrated DOM kit in development; no arbitrary device/LLM support. |
| XR-08 | Pending | Attention point: chosen focus, no localisation of neural activation. |
| XR-09 | Pending | Sphere: internal sensations, interoceptive map as methodological hypothesis. |
| XR-10 | Pending | Field: body position/movement and surrounding space; preserve three separate controls. |
| XR-11 | Pending | Presence across distance; no fixed camera hardware specification or permission prompt. |
| XR-12 | Pending | Hand superficial radial sensory territory; verify projection rather than claiming exact individual nerve course. |
| XR-13 | Pending | Hand sensations self-reported manually/voice in concept; distinguish reported/measured/inferred. |
| XR-14 | Pending | Personal time map: observations, sensor signals and context; no causal proof claims. |
| XR-15 | Pending | EEG rhythmic electrical activity, Hz; no whole-brain localisation from simple sensor. |
| XR-16 | Pending | Pulse changes with breathing/load/experience; no direct stress or attention measurement. |
| HOME-17 | Pending | Preserve profile demo and Methods/Protocols/Programs; defer canonical typology sync to separate branch; educational example label. |
| HOME-18 | Pending | Russian ecosystem heading three lines; subtitle offset through layout, not spaces; natural EN/ES/mobile. |
| HOME-19 | Pending | Larger wheel and adjacent panels without increasing desktop section height. |
| HOME-20 | Pending | Central DOM card causal ecosystem mechanism, superseded by HOME-39 synthesis. |
| HOME-21 | Pending | Keep six named sectors; targeted factual/editorial fixes only. |
| HOME-22 | Pending | Physical space has four complementary dimensions, broader than residential restoration. |
| HOME-23 | Pending | Four switches and existing concept image; not another circular diagram; approved by package 03. |
| HOME-24 | Pending | Four perspective copy preserved and superseded by HOME-46. |
| HOME-25 | Pending | Optional nested participant path: request/state, plan, residence, review, transfer to everyday life. |
| HOME-26 | Pending | Routes for participants, students, researchers, engineers, partners and community. |
| HOME-27 | Pending | Keep project zones including spa, Dark Retreat, family/children, workshops, landscape; no built-infrastructure claims. |
| HOME-28 | Pending | Community/projects beyond visit; certification, funding, membership remain future. |
| HOME-29 | Pending | First planned space USA; Chile suppressed by HOME-50. |
| HOME-30 | Pending | DOM Space working display name, not final legal brand. |
| HOME-31 | Pending | Institute/Lab institutional directions and research agenda; do not repeat methods triad. |
| HOME-32 | Pending | Six public forming directions plus complete future catalogue, no accreditation or ready faculty claims. |
| HOME-33 | Pending | Earlier research candidates superseded by four pilot topics. |
| HOME-34 | Pending | International invitation to co-create directions/research; real partner route. |
| HOME-35 | Pending | Research and education feedback cycle, voluntary research separate from services. |
| HOME-36 | Pending | Fresh-main separate branch, shared file preservation, both themes/locales/accessibility/viewport checks. |
| HOME-37 | Pending | Seven numbered controls: research, education, rehabilitation, technology, community, economy/projects, central DOM. |
| HOME-38 | Pending | Visited/selected/suggestedNext/finalReached; staged SVG arrows; arbitrary order and repeat-close; six nodes required for full contour. |
| HOME-39 | Pending | Compact central synthesis of A+B+C: knowledge/practice feedback, person-to-society scale, evolving ecosystem, physical embodiment. |
| HOME-40 | Pending | Real link from DOM card to #dom-campus with future-tense bridge. |
| HOME-41 | Pending | Keep enlarged composition and original six texts where sound; no desktop height growth. |
| HOME-42 | Pending | DOM Space / One space. Four dimensions. Planned first physical space in USA. |
| HOME-43 | Pending | Remove old four guest steps from main canvas; preserve as optional nested path. |
| HOME-44 | Pending | Four visible numbered perspective controls; one expanded card; concept image remains. |
| HOME-45 | Pending | Suggested 01→04, direct access, persisted visited, static reduced-motion and viewport-only pulse. |
| HOME-46 | Pending | Four copy themes: reproducible model of environment; integrated residential development; institute/education/research; NeuroAttention-designed environment. |
| HOME-47 | Pending | Zone programme preserved; optional compact secondary list; 12 houses/8 cabins are unapproved concept counts. |
| HOME-48 | Pending | NeuroAttention applies equally to team preparation and architecture/light/sound/materials/routes/privacy/rhythm. |
| HOME-49 | Pending | Different participation routes beyond buying a retreat, including creating/research/engineering/partnership/community. |
| HOME-50 | Pending | USA only publicly; searching/negotiating/designing, not open campus. |
| HOME-51 | Pending | Institute/Lab two linked parts and shared invitation beneath both. |
| HOME-52 | Pending | Six forming directions with descriptions; names editorial working clusters. |
| HOME-53 | Pending | Complete catalogue; distinguish school/research_track/pilot/method/campus_activity and many-to-many links. |
| HOME-54 | Pending | Read direction first; separate visible cooperation action with preselected direction, hover/focus/touch parity. |
| HOME-55 | Pending | Partner form multiselect/custom/name/email/optional location/competence/proposal/portfolio; consent; verified-email account link/create; real submission/idempotency/draft-on-error. |
| HOME-56 | Pending | Partner application/status in cabinet; client functions retained; only superadmin or explicit read/manage permission sees queue; audit changes. |
| HOME-57 | Pending | Cancel/back/forward returns to original Institute/Lab state/scroll; safe local returnTo only. |
| HOME-58 | Pending | Shared prominent co-creation CTA beneath Institute and Lab; no promised role/funding. |
| HOME-59 | Pending | Four initial pilots, not entire agenda, no proven outcome/open enrolment claims. |
| HOME-60 | Pending | Four questions visible, one detail; longevity first; optional sequential suggestions. |
| HOME-61 | Pending | Quality longevity: cognition, mobility, independence, engagement incl care homes; no proven cell anti-aging. |
| HOME-62 | Pending | Youth transition from school/family/care to autonomous life; abilities/goals/self-regulation/technology, no ideological prescription. |
| HOME-63 | Pending | Human–AI partnership research, autonomy and effects on attention/thinking/relationships; AI consciousness/species not fact. |
| HOME-64 | Pending | Business adaptation at founder/team/product levels; AI tool rather than purpose, no guaranteed revenue. |
| HOME-65 | Pending | Pilots cross disciplines; cooperation preselects research interest/topic. |
| HOME-66 | Pending | Subtle side progress rail, one-time completed flash, mobile compact; no XP/gates. |
| HOME-67 | Pending | Actual homepage order; distinguish seen/explored/completed; passive sections progress without forced clicks. |
| HOME-68 | Pending | Optional individual/social observations, multiselect/Other/Skip; no assumption of pathology; free text local-only. |
| HOME-69 | Pending | Versioned local anonymous progress with TTL, not IP; history/session restores form return and open panels. |
| HOME-70 | Pending | Optional consent-gated aggregate events only if existing infrastructure fits; never email/name/proposals/health/free text/IP in analytics. |
| HOME-71 | Pending | Matrix green/electric blue, one suggested control per active screen; keyboard/aria/focus/touch/reduced-motion. |
| HOME-72 | Pending | Final CTA/anchor audit after route assembled; preserve working links until replacement verified. |
| HOME-73 | Pending | QA all steps, RU/EN/ES, dark/light, 1440×900/1366×768/1280×720/320/375px, history, permissions, true backend submission, terminal deployments/live check. |
