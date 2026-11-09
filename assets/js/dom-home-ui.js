/* Homepage disclosures. Hover preview never resizes the surrounding section. */
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
    var expanded = false, peeking = false, conceal = null, leave = null, frame = null;
    var measuredHeight = 0, resizeFrame = null;
    function targetHeight() { return expanded ? measuredHeight : peeking ? measuredHeight * .5 : 0; }
    function render() {
      clearTimeout(conceal); cancelAnimationFrame(frame);
      if (expanded) root.classList.remove('is-previewing');
      else if (peeking) root.classList.add('is-previewing');
      root.classList.toggle('is-open', expanded);
      root.classList.toggle('is-peeking', peeking);
      toggle.setAttribute('aria-expanded', String(expanded));
      panel.inert = !expanded;
      if (expanded) panel.removeAttribute('aria-hidden'); else panel.setAttribute('aria-hidden','true');
      if (expanded || peeking) {
        var wasHidden = panel.hidden;
        panel.hidden = false;
        measuredHeight = content.offsetHeight;
        if (wasHidden && peeking) void panel.offsetHeight;
        frame = requestAnimationFrame(function () { panel.style.height = targetHeight() + 'px'; });
      } else {
        panel.style.height = '0px';
        conceal = setTimeout(function () {
          if (!expanded && !peeking) { panel.hidden = true; root.classList.remove('is-previewing'); }
        }, root.classList.contains('is-previewing') && !reduce.matches ? 220 : 0);
      }
    }
    toggle.hidden = false; fallback.hidden = true;
    panel.style.height = '0px'; panel.hidden = true; panel.inert = true;
    panel.setAttribute('aria-hidden','true');
    toggle.addEventListener('click',function () {
      clearTimeout(leave); expanded = !expanded; peeking = false;
      if (!expanded && panel.contains(document.activeElement)) toggle.focus({preventScroll:true});
      render();
    });
    root.addEventListener('pointerenter',function (event) {
      clearTimeout(leave);
      if (!expanded && !peeking && event.pointerType !== 'touch' && fine.matches && !reduce.matches) {
        peeking = true; render();
      }
    });
    root.addEventListener('pointerleave',function () {
      clearTimeout(leave);
      leave = setTimeout(function () { if (peeking) { peeking = false; render(); } },120);
    });
    root.addEventListener('keydown',function (event) {
      if (event.key === 'Escape' && (expanded || peeking)) {
        event.preventDefault(); clearTimeout(leave); expanded = peeking = false;
        toggle.focus({preventScroll:true}); render();
      }
    });
    if ('ResizeObserver' in window) new ResizeObserver(function (entries) {
      var next = entries[0].target.offsetHeight;
      if (Math.abs(next - measuredHeight) < 1) return;
      measuredHeight = next;
      if ((expanded || peeking) && resizeFrame === null) resizeFrame = requestAnimationFrame(function () {
        resizeFrame = null;
        if (expanded || peeking) panel.style.height = targetHeight() + 'px';
      });
    }).observe(content);
    function motionChanged() {
      clearTimeout(leave);
      if (peeking && (reduce.matches || !fine.matches)) { peeking = false; render(); }
    }
    if (reduce.addEventListener) reduce.addEventListener('change',motionChanged);
    if (fine.addEventListener) fine.addEventListener('change',motionChanged);
  }
  document.querySelectorAll('[data-fold-magnet]').forEach(function (button) {
    var box = null, motionFrame = null, pointerX = 0, pointerY = 0;
    function reset() {
      cancelAnimationFrame(motionFrame); motionFrame = null; box = null;
      button.style.setProperty('--fold-dx','0px'); button.style.setProperty('--fold-dy','0px');
    }
    button.addEventListener('pointerenter',function () { box = button.getBoundingClientRect(); });
    button.addEventListener('pointermove',function (event) {
      if (!fine.matches || reduce.matches || event.pointerType === 'touch') return;
      pointerX = event.clientX; pointerY = event.clientY;
      if (motionFrame !== null) return;
      motionFrame = requestAnimationFrame(function () {
        motionFrame = null;
        if (!box) box = button.getBoundingClientRect();
        var x = Math.max(-1,Math.min(1,((pointerX-box.left)/box.width-.5)*2));
        var y = Math.max(-1,Math.min(1,((pointerY-box.top)/box.height-.5)*2));
        button.style.setProperty('--fold-dx',(x*4).toFixed(2)+'px');
        button.style.setProperty('--fold-dy',(y*1).toFixed(2)+'px');
      });
    },{passive:true});
    button.addEventListener('pointerleave',reset); button.addEventListener('blur',reset);
    window.addEventListener('scroll',reset,{passive:true}); window.addEventListener('resize',reset,{passive:true});
    if (reduce.addEventListener) reduce.addEventListener('change',reset);
  });
})();
