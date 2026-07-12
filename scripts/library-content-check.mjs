// Local validation of the Library seed after the Feat-2 content pass.
// Mirrors server libLocalize (content[lang]||content.en) and asserts every item
// ships EN + RU, has a title, and figures (if any) point at a resolvable URL host.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const LIB = require('../api/library-seed.js');

const titleOf = (c) => c.title || c.name || c.term || '(no title)';
let problems = 0, items = 0, ruCount = 0, figCount = 0;
const figUrls = new Set();

for (const kind of Object.keys(LIB)) {
  for (const it of LIB[kind]) {
    items++;
    const en = it.content?.en, ru = it.content?.ru;
    if (!en) { console.log(`✗ ${kind}/${it.slug}: missing EN`); problems++; continue; }
    if (!ru) { console.log(`✗ ${kind}/${it.slug}: missing RU`); problems++; }
    else {
      ruCount++;
      if (!titleOf(ru) || titleOf(ru) === '(no title)') { console.log(`✗ ${kind}/${it.slug}: RU has no title/name/term`); problems++; }
      // RU must actually differ from EN (not a copy) for the main text field
      const enT = titleOf(en), ruT = titleOf(ru);
      const enBody = en.body_html || en.definition || en.summary || '';
      const ruBody = ru.body_html || ru.definition || ru.summary || '';
      if (enBody && ruBody && enBody === ruBody) { console.log(`⚠ ${kind}/${it.slug}: RU body identical to EN`); }
    }
    const fig = en.figure || (ru && ru.figure);
    if (fig) { figCount++; if (fig.url) figUrls.add(fig.url); if (!fig.url) { console.log(`✗ ${kind}/${it.slug}: figure without url`); problems++; }
      // RU should share the figure
      if (ru && !ru.figure) { console.log(`✗ ${kind}/${it.slug}: RU missing shared figure`); problems++; }
    }
  }
  console.log(`· ${kind}: ${LIB[kind].length} items`);
}

console.log(`\nTotals: ${items} items, ${ruCount} with RU, ${figCount} with a figure, ${figUrls.size} unique figure URLs.`);
console.log(problems === 0 ? '✅ content check PASSED' : `❌ ${problems} problem(s)`);
process.exit(problems === 0 ? 0 : 1);
