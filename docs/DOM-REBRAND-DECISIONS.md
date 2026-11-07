# DOM homepage decisions — 2026-11-07

- Work branch: codex/dom-institute-rebrand. Main/live publication awaits the agreed release approval.
- Existing logo asset and logoPulse hover are retained.
- Header: DOM Institute, smaller readable for Human Adaptation on the next line.
- Existing hero narrative (world/new era, adaptation, health and quality of life), accent line, orbit video and all three CTA links remain.
- Hero eyebrow: Research / Education / Rehabilitation / Ecosystem (localized keys already prepared).
- User requested a retractable institute cover above the hero. On normal fresh loads it starts open, auto-collapses after 3500ms of visible reading time, leaves a manually reopenable 44px bar under the navbar. Interacting cancels automatic dismissal. Skip and Escape close it.
- Russian cover copy: DOM Institute / Институт адаптации человека / В быстро меняющемся мире. Small direction line above; Сознание · Человечество · Технологии · Эволюция below.
- Reduced motion or a deep link starts collapsed; manual opening remains possible. No scroll lock. No-JS cover remains readable and the main page is reachable.
- Current user sequence: review all pages in Russian first; EN/ES translation is a subsequent explicit pass. New cover intentionally contains Russian copy without changing the site's saved/default language behavior.
- Old backlog remains deferred; no unrelated fixes or automatic merges of existing PRs.
- Browser checks passed locally in Chromium at 320/375/768/1024/1440. Safari and physical-phone checks remain.
