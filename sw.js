// NeuroAttention Service Worker — offline audio practices
var CACHE_NAME = 'na-practices-v1';

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(self.clients.claim());
});

// Cache audio files on fetch
self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  // Cache audio/media files for offline playback
  if (url.match(/\.(mp3|wav|ogg|m4a|mp4)(\?|$)/i) && url.includes('practices')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          if (cached) return cached;
          return fetch(e.request).then(function(response) {
            if (response.ok) {
              cache.put(e.request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }
  // For everything else, network first
  e.respondWith(
    fetch(e.request).catch(function() {
      return caches.match(e.request);
    })
  );
});

// Listen for messages to pre-cache specific files
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'CACHE_PRACTICES') {
    var urls = e.data.urls || [];
    caches.open(CACHE_NAME).then(function(cache) {
      urls.forEach(function(url) {
        cache.match(url).then(function(cached) {
          if (!cached) {
            fetch(url).then(function(resp) {
              if (resp.ok) cache.put(url, resp);
            }).catch(function(){});
          }
        });
      });
    });
  }
});
