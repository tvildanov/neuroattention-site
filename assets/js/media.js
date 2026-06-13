/* ============================================================================
   media.js — make muted autoplay videos actually play everywhere.

   Several browsers (esp. mobile Safari/Chrome under data-saver, and any tab that
   wasn't focused when the video mounted) leave a `<video autoplay muted playsinline>`
   PAUSED on its first frame — so it looks like a static image (the "Земля не
   играет" bug). This nudges every such video to play: once on load, again when it
   scrolls into view, and once more on the first user interaction. All calls are
   guarded so a rejected play() promise never throws.
   ============================================================================ */
(function () {
  'use strict';

  function kick(v) {
    if (!v || v.dataset.naNoAutoplay === '1') return;
    // Ensure the attributes the autoplay policy needs are really set.
    v.muted = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    if (v.paused) {
      var p = v.play();
      if (p && typeof p.catch === 'function') p.catch(function () { /* ignore */ });
    }
  }

  function kickAll() {
    var vids = document.querySelectorAll('video[autoplay]');
    for (var i = 0; i < vids.length; i++) kick(vids[i]);
  }

  function init() {
    kickAll();

    // Replay when a video enters the viewport (handles below-the-fold videos that
    // the browser parked, and tab/visibility changes).
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) kick(e.target); });
      }, { threshold: 0.1 });
      document.querySelectorAll('video[autoplay]').forEach(function (v) { io.observe(v); });
    }

    // First user gesture unblocks any video still held back by autoplay policy.
    var once = function () {
      kickAll();
      window.removeEventListener('pointerdown', once);
      window.removeEventListener('touchstart', once);
      window.removeEventListener('keydown', once);
    };
    window.addEventListener('pointerdown', once, { passive: true });
    window.addEventListener('touchstart', once, { passive: true });
    window.addEventListener('keydown', once);

    document.addEventListener('visibilitychange', function () { if (!document.hidden) kickAll(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
