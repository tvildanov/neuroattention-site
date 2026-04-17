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
  // 7) Image stack — click to bring layer to front
  // ───────────────────────────────────────
  document.querySelectorAll('.img-stack').forEach(function (stack) {
    var layers = stack.querySelectorAll('.stack-layer');
    layers.forEach(function (layer) {
      layer.addEventListener('click', function () {
        layers.forEach(function (l) { l.classList.remove('front'); });
        layer.classList.add('front');
      });
    });
  });
})();
