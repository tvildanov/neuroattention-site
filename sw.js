// NeuroAttention Service Worker — offline audio practices
// v2: only intercept GET requests for same-origin audio files; pass everything else
//     through to the browser natively. This fixes "FetchEvent.respondWith received
//     an error: Returned response is null" that the old SW raised on POST uploads
//     (multipart audio) to the cross-origin Railway API, where caches.match returned
//     undefined and respondWith got null.
var CACHE_NAME = 'na-practices-v2';

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
