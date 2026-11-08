# DOM homepage decisions — 2026-11-07

- Work branch: codex/dom-institute-rebrand. User explicitly authorized publication on 2026-11-07; deploy this release after verification.
- Existing logo asset and logoPulse hover are retained.
- Header: logo + DOM Institute only. The disclosure bar below is centered with a 700-weight Space Grotesk label (18–22px) and centered arrow directly below. RU: Для человеческой адаптации; EN: For Human Adaptation; ES: Para la adaptación humana. No repeated institute name or visible expand/collapse label.
- Existing hero narrative (world/new era, adaptation, health and quality of life), accent line, orbit video and all three CTA links remain.
- Hero eyebrow: Research / Education / Rehabilitation / Ecosystem (localized keys already prepared).
- User requested a retractable institute cover above the hero. On normal fresh loads it starts open, auto-collapses after 2500ms of visible reading time, leaves a manually reopenable 72px bar under the navbar. Interacting cancels automatic dismissal. Skip and Escape close it.
- Russian cover copy: DOM Institute / Институт человеческой адаптации / В быстро меняющемся мире. Small direction line above; Сознание · Человечество · Технологии · Эволюция below.
- Reduced motion or a deep link starts collapsed; manual opening remains possible. No scroll lock. No-JS cover remains readable and the main page is reachable.
- Current user sequence: review all pages in Russian first; EN/ES translation is a subsequent explicit pass. New cover intentionally contains Russian copy without changing the site's saved/default language behavior.
- Old backlog remains deferred; no unrelated fixes or automatic merges of existing PRs.
- Browser checks passed locally in Chromium at 320/375/768/1024/1440. Safari and physical-phone checks remain.

- User reverted the Krona One trial: the cover title again uses the existing Unbounded/hero font. Remove trial font assets; typography review deferred until content is final.
- Cursor now tracks pointermove and mousemove in capture phase, keeps the trailing dot, and restores the native pointer until movement and on blur/touch. Local Chromium reproduced pointer-only and stopped-bubble failures in the old implementation and passed both with the fix. Exact cause on the user's device remains unconfirmed.

- Follow-up requested by Nick: countdown 2.5s, curtain transition .45s (about 3s total), centered purpose disclosure distinct from the header wordmark. Main hero/CTAs unchanged.

- Pending batch (not deployed): RU disclosure reads Институт человеческой адаптации; EN/ES labels unchanged. Compact 48px single-row tab, arrow immediately after label, slow cyan text-glow pulse with reduced-motion opt-out. Expanded state hides the purpose label and leaves the accessible collapse arrow. Cover order: logo, directions, DOM Institute, purpose, world, themes, skip.
- Nick explicitly requested no deployment until further changes are grouped. Keep these changes in the work branch. Problem/Facts/Solution edits are proposals only, pending discussion.

- Approved grouped release 2026-11-08: publish pending compact tab/cover order plus the Russian institute question linking to dom.html. Keep current Hero CTA links, 30-year problem wording and subsequent sections unchanged. Merge Problem and Facts into one section, label it Проблема и факты in RU, demote facts title to ordinary text, compact the four existing rows, preserve their text/media/animation classes and the final adaptation CTA. User is still considering programs/approach changes; do not reorder these sections.

- 2026-11-08 typography draft: collapsed purpose bar 36px instead of 48px, same responsive font sizes, existing hero Unbounded font family. Title case: Институт Человеческой Адаптации / For Human Adaptation / Para La Adaptación Humana. General light/dark theme remains discussion only. Pending publication.
