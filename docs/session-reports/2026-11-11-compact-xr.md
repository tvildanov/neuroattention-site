# Compact stationary DOM XR walkthrough

Owner requested performance fixes, one-screen height, stronger cues and centered headings. Removed scripted XR auto-scroll. Each substep now replaces the preceding form inside equal-height windows; editable answer chips retain choices. Canonical vocabulary and body selector retained. Centered XR and practice headings. Opacity cue1.65s replaces animated shadow repaint and pauses outside viewport. WebGL context/atlas initialize only on opening. Native pointer in XR; global cursor loop sleeps when idle. Account data/API/scoring unchanged.

Validated: JS syntax; full browser mobile flow375x740, section660px, both graph states332px with no internal overflow; desktop1363x936 section842px and equal570px cards. Deployment success and public hashes required before completion.
