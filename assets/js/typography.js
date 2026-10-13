/* ============================================================================
   typography.js — prevent hanging prepositions/articles & line-end orphans.

   Russian/Spanish typography rules forbid leaving a short preposition or
   conjunction at the end of a line ("висячие предлоги"); good English typography
   avoids a lone last word ("orphan"). This walks the TEXT NODES of headings and
   lead paragraphs (never the element HTML, so nested <span>/<strong> tags stay
   intact) and replaces the space AFTER a short word — and the final space — with
   a non-breaking space so the word stays attached to its neighbour.

   Re-runs on `langchange` (fired by i18n.js) so it works in RU/EN/ES.
   ============================================================================ */
(function () {
  'use strict';

  var NBSP = ' ';
  // 1–3 letter words that shouldn't end a line, across the three site languages.
  var SHORT = ('и в во на с со к ко о об от до по за из у не но а же бы ли что как ' +     // ru
    'a an the of to in on at by for and or is as be we ' +                                // en
    'y o e u de en el la lo un una con por para su al se no es')                          // es
    .split(/\s+/);
  var SHORT_SET = {};
  SHORT.forEach(function (w) { SHORT_SET[w.toLowerCase()] = 1; });

  var SELECTOR = '.heading-space, .hero-sub, .hero-desc, .sub-muted, p[data-i18n], h1, h2, h3, h4';

  // Cap an unbreakable run. Gluing every short word AND the final pair turned
  // "for human attention" / "para la atención humana" / "человеческого внимания"
  // into one min-content string, which stretched grid tracks past the container.
  // Short-word and orphan glue still apply when the whole run stays within the cap.
  var MAX_RUN = 12;

  function isBreakSpace(ch) {
    return ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r';
  }

  function lastWord(token) {
    var bits = String(token || '').split(NBSP);
    return bits[bits.length - 1] || '';
  }

  // Replace the space following any short word with NBSP, within a single string.
  function glueShort(text) {
    var parts = String(text).split(/([ \n\t\r]+)/);
    var out = '';
    var run = 0;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!p) continue;
      if (/^[ \n\t\r]+$/.test(p)) {
        var next = '';
        for (var k = i + 1; k < parts.length; k++) {
          if (parts[k] && !/^[ \n\t\r]+$/.test(parts[k])) { next = parts[k]; break; }
        }
        var prev = '';
        for (var j = i - 1; j >= 0; j--) {
          if (parts[j] && !/^[ \n\t\r]+$/.test(parts[j])) { prev = parts[j]; break; }
        }
        var prevWord = lastWord(prev).toLowerCase();
        if (p === ' ' && SHORT_SET[prevWord] && next && (run + next.length) <= MAX_RUN) {
          out += NBSP;
        } else {
          out += p;
          run = 0;
        }
      } else {
        if (!out || out.charAt(out.length - 1) !== NBSP) run = 0;
        out += p;
        run += p.length;
      }
    }
    return out;
  }

  // Orphan control, refused when it would extend an existing NBSP chain past MAX_RUN.
  function glueOrphan(text) {
    return String(text).replace(/(\S+)([ \t]+)(\S+\s*)$/, function (m, a, sp, b, offset, str) {
      if (sp !== ' ') return m;
      var i = offset;
      while (i > 0 && !isBreakSpace(str.charAt(i - 1))) i--;
      var run = str.slice(i, offset) + a + NBSP + b.trim();
      if (run.length > MAX_RUN) return m;
      return a + NBSP + b;
    });
  }

  function processEl(el) {
    if (el.dataset && el.dataset.naNoTypo === '1') return;
    // also skip if any ancestor opts out (lets a container exempt its whole subtree,
    // e.g. narrow program cards where NBSP runs would overflow the box)
    if (el.closest && el.closest('[data-na-no-typo="1"]')) return;
    // collect text nodes in document order
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = walker.nextNode())) { if (n.nodeValue && n.nodeValue.trim()) nodes.push(n); }
    if (!nodes.length) return;
    // 1) glue short prepositions/articles inside each text node
    nodes.forEach(function (tn) {
      var v = glueShort(tn.nodeValue);
      if (v !== tn.nodeValue) tn.nodeValue = v;
    });
    // 2) orphan control: glue the last two words when the run still fits the cap
    var last = nodes[nodes.length - 1];
    last.nodeValue = glueOrphan(last.nodeValue);
  }

  function run() {
    var els = document.querySelectorAll(SELECTOR);
    for (var i = 0; i < els.length; i++) {
      try { processEl(els[i]); } catch (e) { /* never break the page over typography */ }
    }
  }

  // run after i18n has applied (it dispatches `langchange`), and once on load.
  // setTimeout (not rAF) so it still fires in a backgrounded/throttled tab.
  function schedule() { setTimeout(run, 0); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();
  document.addEventListener('langchange', schedule);
})();
