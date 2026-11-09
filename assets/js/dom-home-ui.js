/* Homepage-only disclosure: closed on arrival; hover previews, click pins open. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var fine = matchMedia('(hover: hover) and (pointer: fine)');
  var root = document.getElementById('dom-facts-disclosure');
  if (root) {
    var toggle = root.querySelector('.dom-facts-toggle');
    var panel = root.querySelector('.dom-facts-panel');
    var content = root.querySelector('.dom-facts-panel-content');
    var fallback = root.querySelector('[data-facts-fallback]');
    var expanded = false, peeking = false, conceal = null, frame = null;
    function render() {
      clearTimeout(conceal); cancelAnimationFrame(frame);
      root.classList.toggle('is-open', expanded);
      root.classList.toggle('is-peeking', peeking && !expanded);
      toggle.setAttribute('aria-expanded', String(expanded));
      panel.inert = !expanded;
      if (expanded) panel.removeAttribute('aria-hidden'); else panel.setAttribute('aria-hidden','true');
      if (expanded || peeking) { panel.hidden = false; void panel.offsetHeight; }
      var height = expanded ? content.scrollHeight : peeking ? Math.min(72,content.scrollHeight) : 0;
      if (height) {
        panel.hidden = false; void panel.offsetHeight;
        frame = requestAnimationFrame(function () { panel.style.height = height + 'px'; });
      } else {
        panel.style.height = '0px';
        conceal = setTimeout(function () { if (!expanded && !peeking) panel.hidden = true; },reduce.matches ? 0 : 380);
      }
    }
    toggle.hidden = false; fallback.hidden = true;
    panel.style.height = '0px'; panel.hidden = true; panel.inert = true;
    panel.setAttribute('aria-hidden','true');
    toggle.addEventListener('click',function () {
      expanded = !expanded; peeking = false;
      if (!expanded && panel.contains(document.activeElement)) toggle.focus({preventScroll:true});
      render();
    });
    root.addEventListener('pointerenter',function (event) {
      if (!expanded && event.pointerType !== 'touch' && fine.matches && !reduce.matches) { peeking = true; render(); }
    });
    root.addEventListener('pointerleave',function () { if (peeking) { peeking = false; render(); } });
    root.addEventListener('keydown',function (event) {
      if (event.key === 'Escape' && (expanded || peeking)) {
        event.preventDefault(); expanded = peeking = false; toggle.focus({preventScroll:true}); render();
      }
    });
    if ('ResizeObserver' in window) new ResizeObserver(function () {
      if (expanded) panel.style.height = content.scrollHeight + 'px';
    }).observe(content);
    function motionChanged() { if (reduce.matches && peeking) { peeking = false; render(); } }
    if (reduce.addEventListener) reduce.addEventListener('change',motionChanged);
  }
  document.querySelectorAll('[data-fold-magnet]').forEach(function (button) {
    function reset() {
      button.style.setProperty('--fold-dx','0px'); button.style.setProperty('--fold-dy','0px');
    }
    button.addEventListener('pointermove',function (event) {
      if (!fine.matches || reduce.matches || event.pointerType === 'touch') return;
      var box = button.getBoundingClientRect();
      var x = Math.max(-1,Math.min(1,((event.clientX-box.left)/box.width-.5)*2));
      var y = Math.max(-1,Math.min(1,((event.clientY-box.top)/box.height-.5)*2));
      button.style.setProperty('--fold-dx',(x*6).toFixed(2)+'px');
      button.style.setProperty('--fold-dy',(y*2).toFixed(2)+'px');
      button.style.setProperty('--fold-x',((x+1)*50).toFixed(1)+'%');
      button.style.setProperty('--fold-y',((y+1)*50).toFixed(1)+'%');
    },{passive:true});
    button.addEventListener('pointerleave',reset); button.addEventListener('blur',reset);
    if (reduce.addEventListener) reduce.addEventListener('change',reset);
  });
})();
