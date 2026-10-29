/*
 * NeuroAttention — Redesign interactions
 * - Custom cursor: visible stylus arrow + trailing "attention point" dot (delay)
 * - FlipLink nav hover: word slides up, duplicate takes its place
 * - Scroll-linked drop→ripple transition
 * - Magnetic buttons on hover
 * Loaded after scripts.js. Safe to include on every page.
 */

(function () {
  'use strict';

  // ───────────────────────────────────────
  // 1) Custom cursor: stylus + trailing dot
  // ───────────────────────────────────────
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var stylus = document.createElement('div');
    stylus.className = 'cursor-stylus';
    stylus.innerHTML =
      '<svg viewBox="0 0 14 14" aria-hidden="true">' +
        '<path d="M1 1 L1 10 L4 7.5 L6 12 L7.5 11.3 L5.5 6.8 L9.5 6.6 Z" ' +
              'fill="rgba(255,255,255,0.9)" stroke="rgba(0,0,0,0.6)" stroke-width="0.6" stroke-linejoin="round"/>' +
      '</svg>';

    var dot = document.createElement('div');
    dot.className = 'cursor-dot';

    document.body.appendChild(stylus);
    document.body.appendChild(dot);

    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var dx = mx, dy = my;
    var stylusX = mx, stylusY = my;

    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
    }, { passive: true });

    window.addEventListener('mouseleave', function () {
      stylus.style.opacity = '0';
      dot.style.opacity = '0';
    });
    window.addEventListener('mouseenter', function () {
      stylus.style.opacity = '1';
      dot.style.opacity = '1';
    });

    window.addEventListener('mousedown', function () { dot.classList.add('down'); });
    window.addEventListener('mouseup',   function () { dot.classList.remove('down'); });

    // Enlarge attention dot on interactive elements
    var hoverSelector = 'a, button, .btn, .nav-link, [role="button"], input, textarea, .option-btn, .lang-btn';
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest && e.target.closest(hoverSelector)) dot.classList.add('hover');
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest(hoverSelector)) dot.classList.remove('hover');
    });

    function tick() {
      // stylus: near-instant (tiny smoothing for feel)
      stylusX += (mx - stylusX) * 0.9;
      stylusY += (my - stylusY) * 0.9;
      stylus.style.transform = 'translate3d(' + stylusX + 'px,' + stylusY + 'px,0) translate(-50%,-50%)';

      // dot: follows with real delay (the "attention point")
      dx += (mx - dx) * 0.14;
      dy += (my - dy) * 0.14;
      dot.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) translate(-50%,-50%)';

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ───────────────────────────────────────
  // 2) FlipLink — wrap nav-link text so hover slides it
  // ───────────────────────────────────────
  document.querySelectorAll('.nav-link').forEach(function (link) {
    if (link.querySelector('.flip-inner')) return;
    var label = link.textContent.trim();
    if (!label) return;
    link.innerHTML =
      '<span class="flip-inner" data-label="' + label.replace(/"/g, '&quot;') + '">' +
        '<span>' + label + '</span>' +
      '</span>';
  });

  // ───────────────────────────────────────
  // 3) Magnetic buttons — slight pull toward cursor
  // ───────────────────────────────────────
  document.querySelectorAll('.btn, .nav-login').forEach(function (el) {
    el.classList.add('magnetic');
    el.addEventListener('mousemove', function (e) {
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var dx = (e.clientX - cx) * 0.18;
      var dy = (e.clientY - cy) * 0.25;
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    });
    el.addEventListener('mouseleave', function () {
      el.style.transform = '';
    });
  });

  // ───────────────────────────────────────
  // 4) Scroll drop — compute drop opacity/scale from scroll progress within .scroll-drop-stage
  // ───────────────────────────────────────
  var stages = document.querySelectorAll('.scroll-drop-stage');
  if (stages.length) {
    function updateDrops() {
      var vh = window.innerHeight;
      stages.forEach(function (stage) {
        var r = stage.getBoundingClientRect();
        var total = r.height - vh;
        var progress = Math.min(1, Math.max(0, -r.top / Math.max(1, total)));
        stage.style.setProperty('--drop-opacity', String(Math.min(1, progress * 1.5)));
        stage.style.setProperty('--drop-scale', String(0.7 + progress * 0.6));
      });
    }
    window.addEventListener('scroll', updateDrops, { passive: true });
    window.addEventListener('resize', updateDrops);
    updateDrops();
  }

  // ───────────────────────────────────────
  // 5) Ensure videos try to play (Safari autoplay quirk)
  // ───────────────────────────────────────
  document.querySelectorAll('video').forEach(function (v) {
    v.muted = true;
    v.setAttribute('playsinline', '');
    var p = v.play();
    if (p && typeof p.catch === 'function') p.catch(function(){});
  });

  // ───────────────────────────────────────
  // 6) Fact cards — slide in from sides on scroll
  // ───────────────────────────────────────
  var factCards = document.querySelectorAll('.fact-slide-left, .fact-slide-right');
  if (factCards.length && 'IntersectionObserver' in window) {
    // Mark parent so CSS knows observer is active (fallback: cards stay visible)
    var factsParent = factCards[0].parentElement;
    if (factsParent) factsParent.classList.add('slide-ready');

    var factObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
        } else {
          e.target.classList.remove('in-view');
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    factCards.forEach(function (c) { factObs.observe(c); });
  }

  // ───────────────────────────────────────
  // 7) Image stack
  //    Wide: click brings a fanned layer to the front.
  //    Narrow (≤860px): the three photographs occupy one frame, so a tablist
  //    (and a tap on the visible frame) selects which one is shown.
  // ───────────────────────────────────────
  var stackQuery = window.matchMedia('(max-width: 860px)');
  function stackIsNarrow() { return stackQuery.matches; }

  document.querySelectorAll('.img-stack').forEach(function (stack) {
    var set = stack.closest('.img-stack-set') || stack;
    var layers = Array.prototype.slice.call(stack.querySelectorAll('.stack-layer'));
    var tabs = Array.prototype.slice.call(set.querySelectorAll('.img-stack-tab'));
    if (!layers.length) return;
    var index = 0;
    layers.forEach(function (layer, n) { if (layer.classList.contains('is-selected')) index = n; });

    function show(i, focusTab) {
      index = ((i % layers.length) + layers.length) % layers.length;
      var narrow = stackIsNarrow();
      layers.forEach(function (layer, n) {
        var on = n === index;
        layer.classList.toggle('is-selected', on);
        if (narrow) layer.setAttribute('aria-hidden', on ? 'false' : 'true');
        else layer.removeAttribute('aria-hidden');
      });
      tabs.forEach(function (tab, n) {
        var on = n === index;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
      });
      if (focusTab && tabs[index]) tabs[index].focus();
    }

    tabs.forEach(function (tab, n) {
      tab.addEventListener('click', function () { show(n, false); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = n + 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = n - 1;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        if (next === null) return;
        e.preventDefault();
        show(next, true);
      });
    });

    layers.forEach(function (layer, n) {
      layer.addEventListener('click', function () {
        if (stackIsNarrow()) show(index + 1, false);
        else {
          layers.forEach(function (l) { l.classList.remove('front'); });
          layer.classList.add('front');
          show(n, false);
        }
      });
    });

    if (stackQuery.addEventListener) stackQuery.addEventListener('change', function () { show(index, false); });
    else if (stackQuery.addListener) stackQuery.addListener(function () { show(index, false); });
    show(index, false);
  });

  // CloudFront marketing photos 403. Keep the real URL so a later ACL fix
  // shows the photograph; until then mark the reserved frame unavailable.
  // A placeholder is not the original portrait.
  document.querySelectorAll('[data-photo-frame]').forEach(function (frame) {
    var img = frame.querySelector('img');
    if (!img) return;
    var fail = function () {
      frame.classList.add('is-unavailable');
      img.setAttribute('aria-hidden', 'true');
    };
    var ok = function () {
      if (img.naturalWidth > 0) {
        frame.classList.remove('is-unavailable');
        img.removeAttribute('aria-hidden');
      } else {
        fail();
      }
    };
    img.addEventListener('error', fail);
    img.addEventListener('load', ok);
    if (img.complete) ok();
  });

  // ───────────────────────────────────────
  // 8) Haptic vibration (Android Chrome)
  //    - micropulse on page load
  //    - sync with drop-ripple.mp4 loop (Solution block)
  //    - subtle pulse on card/section appear
  //    - tap feedback on buttons
  // ───────────────────────────────────────
  var canVibrate = 'vibrate' in navigator;

  function haptic(pattern) {
    if (canVibrate) {
      try { navigator.vibrate(pattern); } catch(e) {}
    }
  }

  // 8a) Micropulse welcome — gentle double-tap on page load
  if (canVibrate) {
    setTimeout(function () { haptic([12, 40, 12]); }, 600);
  }

  // 8b) Sync vibration with drop-ripple.mp4 loop
  //     Video is 6s. Drop impacts surface at ~3.0s (verified via frame extraction).
  //     We fire a soft pulse at impact and a secondary ripple pulse at ~3.6s.
  var dropVideo = document.querySelector('#screen-4 video');
  if (dropVideo && canVibrate) {
    var dropImpactFired = false;
    var dropRippleFired = false;
    dropVideo.addEventListener('timeupdate', function () {
      var t = dropVideo.currentTime;
      // Primary impact pulse at 3.0s
      if (t >= 2.95 && t < 3.3 && !dropImpactFired) {
        haptic(18);
        dropImpactFired = true;
      }
      // Secondary softer ripple pulse at 3.6s
      if (t >= 3.55 && t < 3.9 && !dropRippleFired) {
        haptic(8);
        dropRippleFired = true;
      }
      // Reset flags when video loops back
      if (t < 1.0) {
        dropImpactFired = false;
        dropRippleFired = false;
      }
    });
  }

  // 8c) (removed — scroll vibration was too frequent)

  // 8.5) Close mobile menu on link tap
  var mobileMenu = document.querySelector('.mobile-menu');
  if (mobileMenu) {
    mobileMenu.querySelectorAll('.mobile-link').forEach(function(link) {
      link.addEventListener('click', function() {
        mobileMenu.classList.remove('open');
      });
    });
  }

  // 8d) Button / option tap feedback
  if (canVibrate) {
    document.addEventListener('pointerdown', function (e) {
      var tgt = e.target.closest && e.target.closest('.btn, .option-btn, .lang-btn, .nav-link, .card-hover');
      if (tgt) haptic(10);
    }, { passive: true });
  }
})();
