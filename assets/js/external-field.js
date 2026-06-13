/* ============================================================================
   External Field — objective external events & environmental parameters.
   Sun / Moon / Earth / Weather / Cosmos / Social / Experimental.
   MVP: raw observational data, time-series, NO medical/psychological inference.
   Tone: factual, scientific, calm. Public APIs (NOAA, NASA, USGS, GraceDB,
   GDELT, Open-Meteo) + a pure-JS lunar calc. Weather/AQ/sunrise are fetched
   client-side from Open-Meteo using the user's saved location.

   window.mountExternalField(container)
   ============================================================================ */
(function () {
  'use strict';

  var LAYERS = [
    { key: 'sun',          icon: '☀', label: 'Sun' },
    { key: 'moon',         icon: '☾', label: 'Moon' },
    { key: 'earth',        icon: '⊕', label: 'Earth' },
    { key: 'weather',      icon: '🌦', label: 'Weather' },
    { key: 'cosmos',       icon: '✦', label: 'Cosmos' },
    { key: 'social',       icon: '🌐', label: 'Social Events' },
    { key: 'experimental', icon: '⚡', label: 'Experimental' }
  ];

  var S = { active: 'sun', config: {}, user: null, container: null };

  function api(path, opts) {
    var token = localStorage.getItem('na_token');
    return fetch((window.AUTH_API || '') + path, Object.assign({
      headers: Object.assign({ 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, (opts && opts.headers) || {})
    }, opts || {})).then(function (r) { return r.json(); });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtTime(t) { var d = new Date(t); if (isNaN(d)) return ''; try { return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return d.toISOString().slice(0, 16).replace('T', ' '); } }
  function hasLocation() { return S.user && S.user.location_lat != null && S.user.location_lon != null; }

  /* ── shell ─────────────────────────────────────────────────────────────── */
  function shell() {
    var tabs = LAYERS.map(function (l) {
      return '<button class="ef-tab" data-ef="' + l.key + '"><span class="ef-tab-ic">' + l.icon + '</span>' + l.label + '</button>';
    }).join('');
    return '' +
      '<div class="ef-root">' +
        '<div class="ef-head">' +
          '<div><h3 class="ef-title">External Field</h3>' +
          '<p class="ef-sub">Objective external events & environmental parameters. Observational data — no interpretation.</p></div>' +
          '<div class="ef-head-actions">' +
            '<button class="ef-loc-btn" id="ef-loc-btn"></button>' +
            '<button class="ef-gear" id="ef-gear" title="Subscriptions">⚙</button>' +
          '</div>' +
        '</div>' +
        '<div class="ef-tabs">' + tabs + '</div>' +
        '<div class="ef-body" id="ef-body"></div>' +
        '<div class="ef-foot">Sources: NOAA SWPC · NASA DONKI · USGS · LIGO/Virgo/KAGRA · GDELT · Open-Meteo. Times in your local timezone.</div>' +
      '</div>';
  }

  function mountExternalField(container) {
    if (!container) return;
    S.container = container;
    container.innerHTML = shell();
    container.querySelectorAll('.ef-tab').forEach(function (b) {
      b.addEventListener('click', function () { selectTab(b.getAttribute('data-ef')); });
    });
    container.querySelector('#ef-gear').addEventListener('click', openSubscriptions);
    container.querySelector('#ef-loc-btn').addEventListener('click', openLocationModal);
    loadUser().then(function () { renderLocBtn(); selectTab(S.active); });
    loadConfig();
  }

  function loadUser() {
    return api('/api/auth/me').then(function (d) { if (d && d.user) S.user = d.user; }).catch(function () {});
  }
  function loadConfig() { api('/api/external/subscriptions').then(function (d) { if (d && d.config) S.config = d.config; }).catch(function () {}); }

  function renderLocBtn() {
    var b = S.container.querySelector('#ef-loc-btn'); if (!b) return;
    b.innerHTML = hasLocation() ? '📍 ' + esc(S.user.location_city || (S.user.location_lat.toFixed(2) + ', ' + S.user.location_lon.toFixed(2))) : '📍 Set location';
  }

  function selectTab(key) {
    S.active = key;
    S.container.querySelectorAll('.ef-tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-ef') === key); });
    var body = S.container.querySelector('#ef-body');
    body.innerHTML = '<div class="ef-loading">Loading ' + key + ' data…</div>';
    var fn = ({ sun: renderSun, moon: renderMoon, earth: renderEarth, weather: renderWeather, cosmos: renderCosmos, social: renderSocial, experimental: renderExperimental })[key];
    if (fn) fn(body);
  }

  /* ── shared list/dashboard builders ─────────────────────────────────────── */
  function timeline(events) {
    if (!events || !events.length) return '<div class="ef-empty">No recent events recorded yet. The poller ingests new data automatically.</div>';
    return '<div class="ef-timeline">' + events.map(function (e) {
      var sev = e.severity ? '<span class="ef-sev">' + esc(e.severity) + '</span>' : '';
      var src = e.source_url ? '<a href="' + esc(e.source_url) + '" target="_blank" rel="noopener" class="ef-src">' + esc(e.source) + ' ↗</a>' : '<span class="ef-src">' + esc(e.source) + '</span>';
      return '<div class="ef-item">' +
        '<div class="ef-item-top">' + sev + '<span class="ef-item-title">' + esc(e.title) + '</span></div>' +
        (e.description ? '<div class="ef-item-desc">' + esc(e.description) + '</div>' : '') +
        '<div class="ef-item-meta">' + esc(fmtTime(e.timestamp)) + ' · ' + src + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }
  function statRow(items) {
    return '<div class="ef-stats">' + items.map(function (it) {
      return '<div class="ef-stat"><div class="ef-stat-k">' + esc(it[0]) + '</div><div class="ef-stat-v">' + esc(it[1]) + '</div></div>';
    }).join('') + '</div>';
  }
  function latestOf(events, type) { for (var i = 0; i < events.length; i++) if (events[i].event_type === type) return events[i]; return null; }

  function loadLayer(layer, cb) {
    api('/api/external/events?layer=' + layer + '&limit=120').then(function (d) { cb((d && d.events) || []); }).catch(function () { cb([]); });
  }

  /* ── Sun ────────────────────────────────────────────────────────────────── */
  function renderSun(body) {
    loadLayer('sun', function (events) {
      var xray = latestOf(events, 'xray_flux'), sw = latestOf(events, 'solar_wind'), cme = latestOf(events, 'cme'), flr = latestOf(events, 'flare');
      var stats = [
        ['X-ray flux', xray ? xray.severity : '—'],
        ['Solar wind', sw ? sw.severity : '—'],
        ['Last flare', flr ? (flr.severity || '—') : '—'],
        ['Last CME', cme ? fmtTime(cme.timestamp) : '—']
      ];
      var sun = hasLocation() ? sunWindow() : '<div class="ef-need-loc">Sunrise / sunset available after you set a location.</div>';
      body.innerHTML = statRow(stats) + sun + '<h4 class="ef-h4">Recent solar events</h4>' + timeline(events);
      if (hasLocation()) fillSunWindow();
    });
  }
  function sunWindow() { return '<div class="ef-suntimes" id="ef-suntimes"><span>☀ Sunrise: <b>—</b></span><span>🌇 Sunset: <b>—</b></span></div>'; }
  function fillSunWindow() {
    var u = S.user;
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + u.location_lat + '&longitude=' + u.location_lon + '&daily=sunrise,sunset&timezone=auto&forecast_days=1')
      .then(function (r) { return r.json(); }).then(function (d) {
        var box = S.container.querySelector('#ef-suntimes'); if (!box || !d.daily) return;
        var sr = d.daily.sunrise && d.daily.sunrise[0], ss = d.daily.sunset && d.daily.sunset[0];
        box.innerHTML = '<span>☀ Sunrise: <b>' + (sr ? new Date(sr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—') + '</b></span>' +
          '<span>🌇 Sunset: <b>' + (ss ? new Date(ss).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—') + '</b></span>';
      }).catch(function () {});
  }

  /* ── Moon ───────────────────────────────────────────────────────────────── */
  function renderMoon(body) {
    loadLayer('moon', function (events) {
      var ph = events[0];
      var rp = ph && ph.raw_payload || {};
      var stats = [
        ['Phase', ph ? (ph.severity || '—') : '—'],
        ['Illumination', rp.illumination != null ? Math.round(rp.illumination * 100) + '%' : '—'],
        ['Lunar age', rp.age != null ? rp.age.toFixed(1) + ' d' : '—'],
        ['Moonrise', hasLocation() ? '—' : 'set location']
      ];
      var moon = hasLocation() ? '' : '<div class="ef-need-loc">Moonrise / moonset available after you set a location.</div>';
      body.innerHTML = statRow(stats) + moon + '<h4 class="ef-h4">Lunar timeline</h4>' + timeline(events);
    });
  }

  /* ── Earth ──────────────────────────────────────────────────────────────── */
  function renderEarth(body) {
    loadLayer('earth', function (events) {
      var kp = latestOf(events, 'kp_index'), quake = latestOf(events, 'earthquake'), storm = latestOf(events, 'geomagnetic_storm');
      var stats = [
        ['Planetary Kp', kp ? (kp.severity || '—').replace('Kp', '') : '—'],
        ['Geomagnetic', storm ? 'storm active' : 'quiet'],
        ['Last quake', quake ? (quake.severity || '—') : '—'],
        ['Scope', 'global + regional']
      ];
      body.innerHTML = statRow(stats) + '<h4 class="ef-h4">Geomagnetic & seismic events</h4>' + timeline(events);
    });
  }

  /* ── Weather / Local Environment (client-side Open-Meteo) ───────────────── */
  function renderWeather(body) {
    if (!hasLocation()) {
      body.innerHTML = '<div class="ef-prompt"><div class="ef-prompt-ic">📍</div>' +
        '<p>Enter your address or coordinates to see local weather and air quality.</p>' +
        '<button class="btn btn-solid ef-prompt-btn" id="ef-prompt-loc">Set location</button></div>';
      var b = body.querySelector('#ef-prompt-loc'); if (b) b.addEventListener('click', openLocationModal);
      return;
    }
    var u = S.user;
    body.innerHTML = '<div class="ef-loading">Loading local environment…</div>';
    Promise.all([
      fetch('https://api.open-meteo.com/v1/forecast?latitude=' + u.location_lat + '&longitude=' + u.location_lon + '&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,uv_index,weather_code&timezone=auto').then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + u.location_lat + '&longitude=' + u.location_lon + '&current=pm2_5,pm10,ozone,nitrogen_dioxide,carbon_monoxide&timezone=auto').then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) {
      var w = res[0] && res[0].current, aq = res[1] && res[1].current;
      var stats = [
        ['Temperature', w ? Math.round(w.temperature_2m) + '°C' : '—'],
        ['Pressure', w ? Math.round(w.surface_pressure) + ' hPa' : '—'],
        ['Humidity', w ? Math.round(w.relative_humidity_2m) + '%' : '—'],
        ['Wind', w ? Math.round(w.wind_speed_10m) + ' km/h' : '—'],
        ['UV index', w && w.uv_index != null ? w.uv_index : '—'],
        ['PM2.5', aq ? aq.pm2_5 + ' µg/m³' : '—'],
        ['PM10', aq ? aq.pm10 + ' µg/m³' : '—'],
        ['Ozone', aq ? aq.ozone + ' µg/m³' : '—'],
        ['NO₂', aq ? aq.nitrogen_dioxide + ' µg/m³' : '—'],
        ['CO', aq ? aq.carbon_monoxide + ' µg/m³' : '—']
      ];
      body.innerHTML = '<div class="ef-loc-line">📍 ' + esc(u.location_city || (u.location_lat.toFixed(2) + ', ' + u.location_lon.toFixed(2))) + '</div>' +
        statRow(stats) + '<div class="ef-foot-inline">Weather & air quality by Open-Meteo. Snapshot at load time.</div>';
    });
  }

  /* ── Cosmos ─────────────────────────────────────────────────────────────── */
  function renderCosmos(body) {
    loadLayer('cosmos', function (events) {
      body.innerHTML = '<div class="ef-note">Public gravitational-wave alerts from the LIGO/Virgo/KAGRA collaboration. Biological relevance is not assumed.</div>' +
        '<h4 class="ef-h4">Gravitational-wave candidates</h4>' + timeline(events);
    });
  }

  /* ── Social Events ──────────────────────────────────────────────────────── */
  function renderSocial(body) {
    loadLayer('social', function (events) {
      body.innerHTML = '<div class="ef-note">A filtered layer of high-impact world events (conflict, disaster, elections, crises) from GDELT — not a media feed.</div>' +
        '<h4 class="ef-h4">World events</h4>' + timeline(events);
    });
  }

  /* ── Experimental Signals ───────────────────────────────────────────────── */
  function renderExperimental(body) {
    loadLayer('experimental', function (events) {
      body.innerHTML = '<div class="ef-warn">⚠ Experimental signal. Data source and biological relevance require validation.</div>' +
        statRow([['Schumann resonance', '7.83 Hz (nominal)'], ['EMF', '—'], ['Status', 'awaiting validated source']]) +
        '<h4 class="ef-h4">Experimental timeline</h4>' + timeline(events);
    });
  }

  /* ── Location modal (geocode via Open-Meteo) ────────────────────────────── */
  function openLocationModal() {
    var ov = modalShell('Set your location',
      '<p class="ef-modal-p">Used for local weather, air quality and sunrise/sunset. Search a city or enter coordinates.</p>' +
      '<input id="ef-geo-q" class="ef-input" placeholder="City or place (e.g. Berlin)" autocomplete="off">' +
      '<div id="ef-geo-results" class="ef-geo-results"></div>' +
      '<div class="ef-or">or coordinates</div>' +
      '<div class="ef-coords"><input id="ef-lat" class="ef-input" placeholder="latitude"><input id="ef-lon" class="ef-input" placeholder="longitude"></div>' +
      '<button class="btn btn-solid ef-modal-save" id="ef-loc-save">Save location</button>');
    var q = ov.querySelector('#ef-geo-q'), results = ov.querySelector('#ef-geo-results');
    var t;
    q.addEventListener('input', function () {
      clearTimeout(t); var v = q.value.trim(); if (v.length < 2) { results.innerHTML = ''; return; }
      t = setTimeout(function () {
        fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(v) + '&count=6&language=en&format=json')
          .then(function (r) { return r.json(); }).then(function (d) {
            results.innerHTML = ((d && d.results) || []).map(function (r) {
              var name = r.name + (r.admin1 ? ', ' + r.admin1 : '') + (r.country ? ', ' + r.country : '');
              return '<button class="ef-geo-r" data-lat="' + r.latitude + '" data-lon="' + r.longitude + '" data-city="' + esc(name) + '">' + esc(name) + '</button>';
            }).join('') || '<div class="ef-geo-none">No matches.</div>';
            results.querySelectorAll('.ef-geo-r').forEach(function (b) {
              b.addEventListener('click', function () { saveLocation(+b.getAttribute('data-lat'), +b.getAttribute('data-lon'), b.getAttribute('data-city'), ov); });
            });
          }).catch(function () {});
      }, 350);
    });
    ov.querySelector('#ef-loc-save').addEventListener('click', function () {
      var lat = parseFloat(ov.querySelector('#ef-lat').value), lon = parseFloat(ov.querySelector('#ef-lon').value);
      if (!isFinite(lat) || !isFinite(lon)) { alert('Enter valid coordinates or pick a city.'); return; }
      saveLocation(lat, lon, lat.toFixed(2) + ', ' + lon.toFixed(2), ov);
    });
  }
  function saveLocation(lat, lon, city, ov) {
    api('/api/users/me/location', { method: 'POST', body: JSON.stringify({ lat: lat, lon: lon, city: city }) })
      .then(function (d) {
        if (d && d.ok) { S.user.location_lat = lat; S.user.location_lon = lon; S.user.location_city = city; renderLocBtn(); if (ov) ov.remove(); selectTab(S.active); }
        else alert((d && d.error) || 'Could not save location.');
      }).catch(function () { alert('Network error.'); });
  }

  /* ── Subscriptions modal ────────────────────────────────────────────────── */
  function openSubscriptions() {
    var rows = LAYERS.map(function (l) {
      var c = S.config[l.key] || {};
      return '<div class="ef-sub-row" data-layer="' + l.key + '">' +
        '<div class="ef-sub-name">' + l.icon + ' ' + l.label + '</div>' +
        '<label class="ef-chk"><input type="checkbox" data-k="enabled"' + (c.enabled ? ' checked' : '') + '> show</label>' +
        '<label class="ef-chk"><input type="checkbox" data-k="showOnPath"' + (c.showOnPath ? ' checked' : '') + '> on Path</label>' +
        '<label class="ef-chk"><input type="checkbox" data-k="notify"' + (c.notify ? ' checked' : '') + '> notify</label>' +
      '</div>';
    }).join('');
    var ov = modalShell('External Field subscriptions',
      '<p class="ef-modal-p">Choose which layers you track, which appear on your Path of Development, and which send notifications.</p>' +
      rows + '<button class="btn btn-solid ef-modal-save" id="ef-sub-save">Save</button>');
    ov.querySelector('#ef-sub-save').addEventListener('click', function () {
      var cfg = {};
      ov.querySelectorAll('.ef-sub-row').forEach(function (r) {
        var layer = r.getAttribute('data-layer'); cfg[layer] = {};
        r.querySelectorAll('input[type=checkbox]').forEach(function (cb) { cfg[layer][cb.getAttribute('data-k')] = cb.checked; });
      });
      api('/api/external/subscriptions', { method: 'POST', body: JSON.stringify({ config: cfg }) })
        .then(function (d) { if (d && d.ok) { S.config = cfg; ov.remove(); } else alert('Could not save.'); });
    });
  }

  function modalShell(title, inner) {
    var ov = document.createElement('div');
    ov.className = 'ef-modal-ov';
    ov.innerHTML = '<div class="ef-modal"><div class="ef-modal-head"><b>' + esc(title) + '</b><button class="ef-modal-x">✕</button></div><div class="ef-modal-body">' + inner + '</div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.ef-modal-x').addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) ov.remove(); });
    return ov;
  }

  window.mountExternalField = mountExternalField;
})();
