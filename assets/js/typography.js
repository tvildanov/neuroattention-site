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

  // Replace the space following any short word with NBSP, within a single string.
  function glueShort(text) {
    // \b(word)\s+  → word + NBSP. Unicode-aware-ish (handles cyrillic via the set).
    return text.replace(/(\S+)(\s+)/g, function (m, w, sp) {
      // only collapse a SINGLE inter-word space (leave intentional gaps/newlines)
      if (sp.length !== 1 || sp === '\n') return m;
      return SHORT_SET[w.toLowerCase()] ? (w + NBSP) : m;
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
    // 2) orphan control: glue the last two words of the element together
    var last = nodes[nodes.length - 1];
    last.nodeValue = last.nodeValue.replace(/(\S+)\s+(\S+\s*)$/, function (m, a, b) {
      return a + NBSP + b;
    });
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
