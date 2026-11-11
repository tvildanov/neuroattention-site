# Matrix logo and XR cue fix — 2026-11-11

Restored the original 1.2-second alternating logo hover motion using green glow, with keyboard-focus and reduced-motion support. Added a single 3.6-second sequential XR object cue timer. Rotation pauses during pointer/keyboard targeting, open explanations, offscreen/background state and reduced motion. It resumes at the next object after closing. Mobile rotation is limited to the visible image frame and does not switch frames automatically.

Validation: JavaScript syntax; browser-observed automatic cue changes; open-card pause; close/resume at next object; logo animation computed as domMatrixLogoPulse; mobile hands frame retains nerve cue and group frame resumes visible objects. Cache versions refreshed. No backend, sensor or data changes.

Publication retry: the initial Pages run 43097206532 failed before creating any jobs with a GitHub internal startup error. Retried through a fresh commit and refreshed the shared interaction script version on the homepage.
