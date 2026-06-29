// NeuroAttention Service Worker — offline audio practices
// v2: only intercept GET requests for same-origin audio files; pass everything else
//     through to the browser natively. This fixes "FetchEvent.respondWith received
//     an error: Returned response is null" that the old SW raised on POST uploads
//     (multipart audio) to the cross-origin Railway API, where caches.match returned
//     undefined and respondWith got null.
// v22: cache-bust for PR#110 — External Field fixes: (1) Sun tab «Solar Flares» now
//      fed by NOAA SWPC xray-flares-7-day (KEYLESS — DONKI needed a NASA key it
//      didn't have, so flares + «Last flare» were empty); (2) Moon tab moonrise/
//      moonset computed astronomically via new suncalc-lite.js (Open-Meteo omits
//      them → were dashes), default Palm Springs CA when no location; (3) Evolution
//      Path lunar-phase day markers (🌑🌓🌕🌗) along the time axis.
// v19: cache-bust for PR#107 — (1) migration 039 label-sweeps any «всё тело» area
//      node that 038 (slug-only) missed + re-cleans orphan sensations; (2) a dragged
//      sensation bubble SNAPS BACK to its body part on release (can't be torn off);
//      (3) multi-anchor BRIDGE — a sensation logged on two body parts (e.g. left+right
//      hand) sits at their centroid and glues to both, visually bridging them.
// v18: cache-bust for PR#106 (NeuroMap clean slate + real sticky bubbles. (a) the
//      «всё тело» fallback is GONE — migration 038 deletes every whole_body node and
//      every orphan sensation (no real body-edge); the server now REJECTS (400) a
//      sensation logged without a body part instead of auto-anchoring it. (b) sticky
//      bubbles now actually touch & deform: high-stiffness direct-glue positioning
//      (rest = rA+rS−press, no gap, no overshoot on drag) + canvas clip against the
//      body sphere so the bubble's contact edge is squished against the body curve,
//      in BOTH main canvas and fullscreen draw loops)
// v17: cache-bust for PR#105 (NeuroMap sticky bubbles — REAL fix. (a) every
//      sensation↔body-part bond is now arrow-free in BOTH the main canvas AND the
//      fullscreen draw loop (fsTick was the un-patched path that still drew arrows);
//      a sensation felt on several parts glues to its strongest body part, the rest
//      are silent cohesion pulls — no more arrow-lines to non-anchor parts. (b) a
//      sensation logged with no body part is anchored to «всё тело» (backend default
//      + migration 037) so it can't float free)
// v16: cache-bust for PR#104 (NeuroMap — default «Всё» period so historical
//      sensations show; split overloaded 'area' into body→layer 1 / life-sphere→
//      layer 3 "Образы"; sticky sensation bubbles draw glued, no arrow line;
//      mobile «Заполнить эмоцию» live-graph restored as a floating 👁 inset)
// v15: cache-bust for PR#103 (NeuroMap mobile fixes — custom-painted layer
//      checkboxes, body-part anchors folded into layer 1, layer toggles stay
//      visible when all layers are off, hub mini-calendar keeps its 7-col grid)
// v11-v14: cache-bust for PR#102 (standalone NeuroMap — enable the «Ощущения»
//      layer-1 toggle + sticky sensation bubbles glued to body-location nodes)
// v10: cache-bust for PR#101 (global arc-radius clamp — kills the pre-existing
//      "IndexSizeError: arc radius is negative" console error; purge stale account.html)
// v9: cache-bust for PR#99 dual-layout fix (stacked spines)
// v8: cache-bust for PR#99 (Phase 2B — dual-timeline Personal Path + tool-side
//     "For: Me / [child]" target selector) — runtime behaviour unchanged; only the
//     CACHE_NAME bump, to purge any stale account.html.
// v7: cache-bust for PR#98 (Phase 3.6 — removed standalone Sensation Map & Diary
//     sub-tabs; both now live in the NeuroMap hub) — runtime behaviour unchanged;
//     only the CACHE_NAME bump, to purge any stale account.html.
// v6: cache-bust for PR#97 (NeuroMap live mini-graph inset, Phase 3.5) — runtime
//     behaviour unchanged; only the CACHE_NAME bump, to purge any stale account.html.
// v5: cache-bust for PR#96 (NeuroMap cross-link chains, Phase 3.2-3.4) — runtime
//     behaviour unchanged; only the CACHE_NAME bump, to purge any stale account.html.
// v4: cache-bust for PR#95 (NeuroMap hub right-panel) — runtime behaviour
//     unchanged from v3; only the CACHE_NAME bump, to purge any stale account.html.
// v3: same safe runtime behaviour as v2 — the only change is the CACHE_NAME bump.
//     The OLD v1 SW wrapped EVERY GET (incl. cross-origin) in
//     respondWith(fetch(req).catch(()=>caches.match(req))). For users still controlled
//     by v1, that mangled the cross-origin DRACO decoder (gstatic wasm/worker) and the
//     jsDelivr GLB streams, so the 3D atlas layers never finished decoding → the
//     layer-loaded event never fired → infinite spinner. Bumping the version (plus
//     register({updateViaCache:'none'}) + reg.update() + a one-time controllerchange
//     reload in account.html) forces those stale v1 clients to install THIS worker,
//     which skipWaiting()s, claim()s the page, and purges every old cache.
var CACHE_NAME = 'na-practices-v23';

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  // Drop any older cache versions
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if (k !== CACHE_NAME) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var req = e.request;

  // 1. Only handle GET — never intercept POST/PUT/DELETE/PATCH multipart, JSON, etc.
  if (req.method !== 'GET') return;

  // 2. Only same-origin URLs. Cross-origin (Railway API, GitHub, Stripe,
  //    Google Fonts, etc.) should hit the network without our involvement.
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  // 3. Audio files under /practices/ — cache-first for offline playback.
  if (/\.(mp3|wav|ogg|m4a|mp4)(\?|$)/i.test(url.pathname) && url.pathname.indexOf('practices') !== -1) {
    e.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(req).then(function(cached) {
          if (cached) return cached;
          return fetch(req).then(function(response) {
            if (response && response.ok) {
              cache.put(req, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // 4. Anything else (HTML, JS, CSS, images, JSON) — DO NOT call respondWith.
  //    Letting the event run without respondWith means the browser handles it
  //    natively; we never risk returning null.
});

// Pre-cache via postMessage from the page
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'CACHE_PRACTICES') {
    var urls = e.data.urls || [];
    caches.open(CACHE_NAME).then(function(cache) {
      urls.forEach(function(url) {
        cache.match(url).then(function(cached) {
          if (!cached) {
            fetch(url).then(function(resp) {
              if (resp && resp.ok) cache.put(url, resp);
            }).catch(function(){});
          }
        });
      });
    });
  }
});
