/* English heading style only. Never rewrite user content, data, or other languages. */
(function () {
  'use strict';
  var headingSelector = 'h1,h2,h3,h4,h5,h6,[role="heading"],.dom-section-subtitle,.dom-intro-world';
  var minor = new Set('a an and as at but by for from if in nor of on or per so the to via vs with yet'.split(' '));
  var pending = new Set(), scheduled = false;

  function titleCase(value) {
    var words = Array.from(value.matchAll(/[A-Za-z][A-Za-z0-9]*(?:[’'][A-Za-z]+)?/g));
    return value.replace(/[A-Za-z][A-Za-z0-9]*(?:[’'][A-Za-z]+)?/g, function (word, index) {
      var lower = word.toLowerCase();
      var first = words.length && index === words[0].index;
      var last = words.length && index === words[words.length - 1].index;
      var afterBreak = /[:—–]\s*$/.test(value.slice(0, index));
      if (minor.has(lower)) return first || last || afterBreak ? lower[0].toUpperCase() + lower.slice(1) : lower;
      // Keep DOM, XR, AI, NeuroAttention, iPhone, and authored scientific names intact.
      if (/[A-Z]/.test(word.slice(1))) return word;
      return word[0].toUpperCase() + word.slice(1);
    });
  }

  function formatHeading(el) {
    if (document.documentElement.lang !== 'en' || el.closest('[data-title-case-skip],[contenteditable="true"]')) return;
    var nodes = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      var node = walker.currentNode;
      var excluded = node.parentElement.closest('svg,script,style,code,pre,kbd,samp,[aria-hidden="true"],[contenteditable="true"]');
      if (!excluded || !el.contains(excluded)) nodes.push(node);
    }
    var original = nodes.map(function (node) { return node.data; }).join('');
    var result = titleCase(original), offset = 0;
    // Case conversion keeps node lengths, markup, event handlers, icons, and links unchanged.
    nodes.forEach(function (node) {
      var part = result.slice(offset, offset + node.data.length);
      offset += node.data.length;
      if (node.data !== part) node.data = part;
    });
  }

  function collect(root) {
    if (document.documentElement.lang !== 'en') return;
    var element = root.nodeType === 1 ? root : root.parentElement;
    if (!element) return;
    var ancestor = element.closest(headingSelector);
    if (ancestor) pending.add(ancestor);
    element.querySelectorAll(headingSelector).forEach(function (heading) { pending.add(heading); });
    if (scheduled || !pending.size) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      var work = Array.from(pending); pending.clear();
      work.forEach(function (heading) { if (heading.isConnected) formatHeading(heading); });
    });
  }

  function start() {
    collect(document.body);
    document.addEventListener('langchange', function () { collect(document.body); });
    // Account dialogs and other dynamically inserted headings follow the same English style.
    new MutationObserver(function (records) {
      records.forEach(function (record) {
        if (record.type === 'characterData') collect(record.target);
        else record.addedNodes.forEach(collect);
      });
    }).observe(document.body, { childList:true, characterData:true, subtree:true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
