/* Homepage-only retractable DOM cover. Russian copy is awaiting editorial approval. */
(function () {
  'use strict';
  var root = document.getElementById('dom-intro');
  if (!root) return;
  var toggle = root.querySelector('.dom-intro-toggle');
  var panel = document.getElementById('dom-intro-panel');
  var action = root.querySelector('[data-intro-action]');
  var skip = root.querySelector('.dom-intro-skip');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var expanded = true, autoAllowed = true, timer = null, concealTimer = null, frame = null;
  var remaining = 2500, startedAt = 0;
  var signalTimer = null, signalUntil = 0;
  function stopSignal() {
    window.clearTimeout(signalTimer); signalTimer = null;
    if (!root.classList.contains('is-signalling')) return;
    root.classList.remove('is-signalling'); signalUntil = 0;
    if (navigator.vibrate) { try { navigator.vibrate(0); } catch (e) {} }
  }
  function vibrateSignal() {
    if (!root.classList.contains('is-signalling') || reduce.matches ||
        !window.matchMedia('(pointer: coarse)').matches || !navigator.vibrate) return;
    var left = Math.max(0,signalUntil - Date.now()), pattern = [];
    while (left > 0) {
      var pulse = Math.min(10,left); pattern.push(pulse); left -= pulse;
      if (left > 0) { var gap = Math.min(70,left); pattern.push(gap); left -= gap; }
    }
    try { navigator.vibrate(pattern); } catch (e) {}
  }
  function startSignal() {
    if (reduce.matches) return;
    var duration = Math.min(2500,remaining);
    signalUntil = Date.now() + duration;
    root.classList.add('is-signalling');
    vibrateSignal();
    signalTimer = window.setTimeout(stopSignal,duration);
  }
  document.addEventListener('pointerup',vibrateSignal,{passive:true});

  function stopAuto() {
    stopSignal();
    autoAllowed = false;
    window.clearTimeout(timer); timer = null;
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
  }
  function pauseAuto() {
    stopSignal();
    if (timer !== null) {
      remaining = Math.max(0, remaining - (Date.now() - startedAt));
      window.clearTimeout(timer); timer = null;
    }
  }
  function setExpanded(next, manual) {
    if (manual) stopAuto();
    window.clearTimeout(concealTimer);
    root.classList.remove('is-peeking');
    expanded = next;
    if (!next && panel.contains(document.activeElement)) toggle.focus({ preventScroll: true });
    toggle.setAttribute('aria-expanded', String(next));
    action.textContent = next ? 'Свернуть' : 'Развернуть';
    if (next) {
      panel.hidden = false;
      panel.inert = false;
      panel.removeAttribute('aria-hidden');
      // Flush the collapsed layout before transitioning back to full height.
      void panel.offsetHeight;
      root.classList.add('is-expanded');
    } else {
      stopSignal();
      root.classList.remove('is-expanded');
      panel.inert = true;
      panel.setAttribute('aria-hidden', 'true');
      concealTimer = window.setTimeout(function () {
        if (!expanded) panel.hidden = true;
      }, reduce.matches ? 0 : 470);
    }
  }
  function setPeek(next) {
    if (expanded) return;
    window.clearTimeout(concealTimer);
    root.classList.toggle('is-peeking',next);
    panel.hidden = !next;
    panel.inert = true;
    panel.setAttribute('aria-hidden','true');
  }
  toggle.addEventListener('pointerenter',function (event) {
    if (!expanded && event.pointerType !== 'touch' && fine.matches && !reduce.matches) setPeek(true);
  });
  root.addEventListener('pointerleave',function () { if (!expanded && root.classList.contains('is-peeking')) setPeek(false); });
  function beginCountdown() {
    if (!autoAllowed || !expanded || timer !== null || document.hidden) return;
    // Do not spend reading time while the existing i18n flash guard hides the page.
    if (parseFloat(window.getComputedStyle(document.body).opacity) < .99) {
      if (frame === null) frame = window.requestAnimationFrame(function () {
        frame = null; beginCountdown();
      });
      return;
    }
    startedAt = Date.now();
    startSignal();
    timer = window.setTimeout(function () {
      timer = null; autoAllowed = false;
      setExpanded(false, false);
    }, remaining);
  }

  toggle.hidden = false;
  toggle.addEventListener('click', function () { setExpanded(!expanded, true); });
  skip.addEventListener('click', function (event) {
    event.preventDefault();
    // The shared anchor handler must not start a second smooth scroll.
    event.stopImmediatePropagation();
    setExpanded(false, true);
    // Summary focus stays at the new top; no smooth scroll during the curtain animation.
    toggle.focus({ preventScroll: true });
  });
  root.addEventListener('focusin', stopAuto);
  root.addEventListener('pointerdown', stopAuto);
  root.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && expanded) {
      event.preventDefault(); setExpanded(false, true);
      toggle.focus({ preventScroll: true });
    }
  });
  // A user who has begun scrolling is in control; do not move the page underneath them.
  window.addEventListener('scroll', function () {
    if (window.scrollY > 8) stopAuto();
  }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pauseAuto(); else beginCountdown();
  });
  window.addEventListener('pagehide', stopAuto);
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) { stopAuto(); setExpanded(false, false); }
  });
  function motionChanged() {
    if (reduce.matches) { stopAuto(); setPeek(false); setExpanded(false, false); }
  }
  if (reduce.addEventListener) reduce.addEventListener('change', motionChanged);
  if (window.location.hash || window.scrollY > 8 || reduce.matches) {
    stopAuto(); setExpanded(false, false);
  } else {
    document.addEventListener('langchange', beginCountdown);
    beginCountdown();
  }
})();

