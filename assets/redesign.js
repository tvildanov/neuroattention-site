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

  var authScreen=document.getElementById('auth-screen');
  if(authScreen){
    var authCss=document.createElement('link');authCss.rel='stylesheet';authCss.href='assets/dom-auth-matrix.css?v=2';document.head.appendChild(authCss);
    var authLogo=document.querySelector('.navbar .nav-logo'),originalLogo=authLogo?authLogo.innerHTML:'';
    function authTheme(){var shown=authScreen.style.display==='block';document.body.classList.toggle('dom-auth-matrix',shown);if(authLogo){if(shown)authLogo.innerHTML='<img src="assets/dom-logo-matrix.svg" alt="" class="nav-logo-icon">DOM Institute';else if(authLogo.innerHTML!==originalLogo)authLogo.innerHTML=originalLogo;}}
    new MutationObserver(authTheme).observe(authScreen,{attributes:true,attributeFilter:['style']});authTheme();
    if(new URLSearchParams(location.search).get('from')==='xr-map'){
      var entry=document.createElement('p');entry.className='dom-auth-entry';entry.textContent=({ru:'Создайте личную карту, чтобы сохранять наблюдения и возвращаться к ним. Пример на главной странице не сохраняется автоматически.',en:'Create a personal map to save observations and return to them. The homepage example is not saved automatically.',es:'Crea tu mapa personal para guardar observaciones y volver a ellas. El ejemplo de la página principal no se guarda automáticamente.'})[document.documentElement.lang]||'Create a personal map to save observations and return to them.';authScreen.prepend(entry);
    }
  }
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

    // Track modern mouse/pen events in capture phase: widgets can stop bubbling
    // mousemove, and some input bridges emit pointermove without mousemove.
    // Keep native cursor until we have actually received a position.
    stylus.setAttribute('aria-hidden', 'true');
    dot.setAttribute('aria-hidden', 'true');
    var cursorActive = false;
    function hideCursor() {
      cursorActive = false;
      document.documentElement.classList.remove('na-custom-cursor-active');
      stylus.style.opacity = '0';
      dot.style.opacity = '0';
    }
    function trackCursor(e) {
      if (e.target.closest && e.target.closest('#dom-xr-platform, #dom-xr-practice')) { hideCursor(); return; }
      if (e.pointerType === 'touch') { hideCursor(); return; }
      if (!Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
      mx = e.clientX; my = e.clientY;
      if (cursorFrame === null) cursorFrame=requestAnimationFrame(tick);
      if (!cursorActive) {
        // No flight from the middle of the page on first movement/re-entry.
        stylusX = dx = mx; stylusY = dy = my;
        cursorActive = true;
        document.documentElement.classList.add('na-custom-cursor-active');
        stylus.style.opacity = '1';
        dot.style.opacity = '1';
      }
    }
    hideCursor();
    window.addEventListener('pointermove', trackCursor, { passive: true, capture: true });
    window.addEventListener('mousemove', trackCursor, { passive: true, capture: true });
    window.addEventListener('mouseleave', hideCursor);
    window.addEventListener('pointerout', function (e) {
      if (!e.relatedTarget) hideCursor();
    }, { passive: true, capture: true });
    window.addEventListener('blur', hideCursor);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) hideCursor();
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

    var cursorFrame = null;
    function tick() {
      cursorFrame = null;
      if (!cursorActive) return;
      // stylus: near-instant (tiny smoothing for feel)
      stylusX += (mx - stylusX) * 0.9;
      stylusY += (my - stylusY) * 0.9;
      stylus.style.transform = 'translate3d(' + stylusX + 'px,' + stylusY + 'px,0) translate(-50%,-50%)';

      // dot: follows with real delay (the "attention point")
      dx += (mx - dx) * 0.14;
      dy += (my - dy) * 0.14;
      dot.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) translate(-50%,-50%)';

      if (Math.abs(mx-dx)+Math.abs(my-dy)>.1) cursorFrame=requestAnimationFrame(tick);
    }
  }

  // ───────────────────────────────────────
  // 2) FlipLink — wrap nav-link text so hover slides it
  // ───────────────────────────────────────
  function refreshNavFlip() {
    document.querySelectorAll('.nav-link').forEach(function (link) {
      if (link.querySelector('.flip-inner')) return;
      var label = link.textContent.trim();
      if (!label) return;
      var inner = document.createElement('span');
      inner.className = 'flip-inner';
      inner.setAttribute('data-label', label);
      var text = document.createElement('span');
      text.textContent = label;
      inner.appendChild(text);
      link.replaceChildren(inner);
      link.setAttribute('aria-label', label);
    });
  }
  refreshNavFlip();
  // Translation replaces link contents; rebuild the effect with the current label.
  document.addEventListener('langchange', refreshNavFlip);

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

  // Keep the hover target stable while its logo follows the pointer.
  var homeLogo = document.querySelector('body.home-matrix .navbar .nav-logo-dom');
  if (homeLogo) {
    var logoBounds = null, logoFrame = null, logoX = 0, logoY = 0;
    var logoMotion = matchMedia('(prefers-reduced-motion: reduce)');
    function resetLogo() {
      if (logoFrame !== null) cancelAnimationFrame(logoFrame);
      logoFrame = null; logoBounds = null;
      homeLogo.style.removeProperty('--logo-x');
      homeLogo.style.removeProperty('--logo-y');
    }
    homeLogo.addEventListener('pointerenter', function(e) {
      if (e.pointerType === 'touch' || logoMotion.matches) return;
      logoBounds = homeLogo.getBoundingClientRect();
    });
    homeLogo.addEventListener('pointermove', function(e) {
      if (!logoBounds || e.pointerType === 'touch' || logoMotion.matches) return;
      logoX = Math.max(-6, Math.min(6, (e.clientX - logoBounds.left - logoBounds.width / 2) * .12));
      logoY = Math.max(-4, Math.min(4, (e.clientY - logoBounds.top - logoBounds.height / 2) * .18));
      if (logoFrame !== null) return;
      logoFrame = requestAnimationFrame(function() {
        logoFrame = null;
        homeLogo.style.setProperty('--logo-x', logoX + 'px');
        homeLogo.style.setProperty('--logo-y', logoY + 'px');
      });
    });
    homeLogo.addEventListener('pointerleave', resetLogo);
    homeLogo.addEventListener('pointercancel', resetLogo);
    window.addEventListener('resize', resetLogo);
    window.addEventListener('blur', resetLogo);
    logoMotion.addEventListener('change', resetLogo);
  }

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
  if (canVibrate && !document.getElementById('dom-intro')) {
    setTimeout(function () { haptic([12, 40, 12]); }, 600);
  }

  // 8b) Sync vibration with drop-ripple.mp4 loop
  //     Video is 6s. Drop impacts surface at ~3.0s (verified via frame extraction).
  //     We fire a soft pulse at impact and a secondary ripple pulse at ~3.6s.
  var dropVideo = document.querySelector('#screen-4 video');
  if (dropVideo && canVibrate) {
    var dropVisible = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (entries) {
      dropVisible = entries[0].isIntersecting;
    }, {threshold: 0}).observe(dropVideo);
    var dropImpactFired = false;
    var dropRippleFired = false;
    dropVideo.addEventListener('timeupdate', function () {
      if (!dropVisible || document.hidden) return;
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
