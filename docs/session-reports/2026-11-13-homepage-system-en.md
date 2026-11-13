# Homepage composition and English localization — review version

Status: owner explicitly approved publication, including the touch fixes below.

The homepage now introduces three complementary parts: DOM Platform (digital self-observation and profiles), DOM XR (shared presence), and DOM Campus (a physical campus concept). The experience/method section leads into these parts. Lab, community, team, and ecosystem follow them.

Changes:
- Shared heading scale, content gutters, section rhythm, and viewport-aware spacing.
- More space for metric captions and a taller founder portrait; founder name is Nick Ivanov in RU and EN.
- XR composition has the scene and shared-presence explanation on the left, with the title, methods, protocols, programs, and actions on the right.
- Brighter sequential hotspot glow, retaining second-click close, reduced-motion behavior, and the existing image.
- Intro question no longer has the unrelated arrow. Its spacing adapts to available viewport height.
- New homepage prose and the guided demo are localized in English, including dynamic profile labels, body areas, emotions, thoughts, statuses, and map output. Switching language preserves selected data and map state. Custom thoughts retain their original wording.
- The existing legacy problem heading is synchronized at 40 years in RU and EN.
- Campus copy explicitly describes a concept in development. No campus render, location claim, or availability claim has been invented.

Validation: JavaScript syntax checks; all homepage translation keys present in RU and EN; no Cyrillic in new English dictionary values; complete English sensation-to-map flow; RU/EN switching preserves choices; hotspot opens and closes on repeat click. Responsive inspection covers 1280×720, 1366×768, 1024×768, 768×1024, 390×844, and 320×740. No horizontal overflow observed. No backend or account storage changes.

Follow-up: owner approval of names/composition and campus text; campus presentation imagery; Spanish editorial pass. Publication is authorized.

## Touch fixes included in the approved release
- Phone/touch layouts use natural-height demo cards and normal page scroll chaining rather than internal contained scrolling. Body diagrams, graph nodes and anatomy canvas allow vertical page gestures.
- Body diagrams are 290–380px tall on phones/touch tablets, with 44px detail targets.
- Selecting a body area keeps the person on the body step. A separate localized Confirm area and continue button advances to context.
- XR scene instructions are constant: select highlighted objects in the image. The footer only says values and signals are illustrative (RU/EN/ES).
- Browser validation at 390×844: body diagram 312px, inner overflow visible, overscroll auto, page scroll changed when scrolling over the diagram, selected area stayed at step 1 and the confirmation button advanced to step 2.
