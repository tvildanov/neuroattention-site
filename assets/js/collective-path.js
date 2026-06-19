/* ============================================================================
   collective-path.js — PR7: Collective Path of Development.

   Every registered user as a parallel light "spine" on one shared time axis,
   each starting at their registration date and branching to the right.

   Built for scale from the start (per Nick):
   • Per-spine COMFORTABLE fixed height (default 44px); the viewport shows only
     as many spines as fit — the rest are reached by VERTICAL SCROLL. We never
     squash everyone to fit.
   • VIRTUALISED render: only the spines inside the viewport (± a buffer) are
     drawn, so it stays at 60fps even with 1000+ users.
   • Canvas + a single requestAnimationFrame render loop (wheel/scroll/zoom are
     coalesced into one draw per frame); momentum/inertia on vertical scroll.
   • Vertical zoom (density): ctrl/⌘ + vertical wheel, anchored under the cursor.
   • Quick-zoom buttons (10 / 100 / 1000) set the density so that many users fit,
     centred on the anchor; you can still scroll/zoom freely afterwards.
   • Time zoom: period buttons + ctrl/⌘ + horizontal wheel. Sticky bottom axis.

   Public: window.mountCollectivePath(container)
   ============================================================================ */
(function () {
  'use strict';

  var DAY = 864e5, MIN_PXPD = 0.04, MAX_PXPD = 800;
  // E1: raise the density cap so a single spine can be zoomed tall enough to read
  // individual nodes (personal-path level of detail), not just the fit-to-view band.
  var SPINE_DEFAULT = 44, SPINE_MIN = 18, SPINE_MAX = 260, BUFFER = 20;
  var LAYER_COLOR = { emotion: '#ff8aa0', event: '#a78bfa', thought: '#7fd0ff',
    sensation: '#67e3c0', practice: '#8fe39b', insight: '#ffd76a', xp_gain: '#cfd6e6' };
  var EXT_LAYERS = ['sun', 'moon', 'earth', 'weather', 'cosmos', 'social', 'experimental'];
  var EXT_ICON = { sun: '☀', moon: '☾', earth: '⊕', weather: '🌦', cosmos: '✦', social: '🌐', experimental: '⚡' };
  var DATA_LAYERS = ['event', 'emotion', 'thought', 'sensation', 'practice', 'insight'];
  var PERIODS = [['day', 1], ['week', 7], ['month', 30], ['3months', 90], ['year', 365]];

  function T(k, f) { return (typeof window.t === 'function') ? window.t(k, f) : f; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tms(t) { var d = new Date(t); return isNaN(d) ? 0 : d.getTime(); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function cpJit(s) { s = String(s); var h = 2166136261; for (var i = 0; i < s.length; i++) { h = (h ^ s.charCodeAt(i)) >>> 0; h = (h * 16777619) >>> 0; } return (h % 1000) / 1000; }
  function extColor(layer, sev) {
    var s = String(sev || '').toUpperCase();
    if (layer === 'sun') { if (s[0] === 'X') return '#ff5a5a'; if (s[0] === 'M') return '#ffcf4d'; if (s[0] === 'C') return '#6fe39b'; return '#8fd0ff'; }
    if (layer === 'earth') { var kp = parseFloat(s); if (isFinite(kp)) { if (kp >= 7) return '#ff5a5a'; if (kp >= 5) return '#ffcf4d'; if (kp >= 4) return '#ffe08a'; return '#6fe39b'; } }
    if (s === 'HIGH' || s === 'SEVERE') return '#ff5a5a';
    if (s === 'MED' || s === 'MEDIUM' || s === 'MODERATE') return '#ffcf4d';
    return '#8fd0ff';
  }

  window.mountCollectivePath = function (container) {
    if (!container) return;
    var lang = (typeof window.getLang === 'function') ? window.getLang() : 'ru';
    var apiBase = window.AUTH_API || '';
    var token = (typeof localStorage !== 'undefined') ? localStorage.getItem('na_token') : '';
    var S = container.__cp || { hiddenLayers: {}, extOn: {}, view: null, spineH: SPINE_DEFAULT, scrollY: 0, velY: 0, anchorRow: 0 };
    container.__cp = S; S._lang = lang; S._container = container;
    // 1.4: every (re)entry to the collective view (tab switch / return from ЛК)
    // starts un-zoomed. A stale _focusUser would otherwise make the next click
    // open the profile directly, skipping the zoom-in step.
    if (S._focusUser) { if (S._focusPrev) { S.spineH = S._focusPrev.spineH; S.scrollY = S._focusPrev.scrollY; } S._focusUser = null; S._focusPrev = null; }

    container.innerHTML =
      '<div class="cp-toolbar" style="display:flex;flex-wrap:wrap;gap:0.5rem 1.25rem;align-items:center;margin-bottom:0.7rem;"></div>' +
      '<div class="cp-wrap" style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;">' +
        '<div class="cp-canvas-host" style="position:relative;flex:1;min-width:280px;height:540px;background:rgba(6,9,14,0.6);border:1px solid rgba(255,255,255,0.07);border-radius:14px;overflow:hidden;"></div>' +
        '<div class="cp-side" style="width:190px;flex:none;"></div>' +
      '</div>';
    var host = container.querySelector('.cp-canvas-host');
    S._host = host; S._side = container.querySelector('.cp-side'); S._toolbar = container.querySelector('.cp-toolbar');
    host.innerHTML = '<div style="padding:2rem;color:var(--text-muted,#89a);font-size:13px;">' + esc(T('a.evo.loading', 'Собираем коллективный путь…')) + '</div>';

    var hdr = token ? { 'Authorization': 'Bearer ' + token } : {};
    // 1.3: always fetch ALL layers' overlay data up front so toggling a layer
    // on/off is an instant redraw (flip S.extOn → requestDraw) with no re-fetch
    // and no canvas rebuild. draw() already filters by S.extOn each frame.
    var url = apiBase + '/api/admin/collective-path?period=year&overlay=' + EXT_LAYERS.join(',');
    fetch(url, { headers: hdr }).then(function (r) { return r.json(); }).then(function (data) {
      if (!data || data.error) { host.innerHTML = '<div style="padding:2rem;color:#f99;font-size:13px;">' + esc((data && data.error) || 'error') + '</div>'; return; }
      S.data = data;
      layout(S);
      renderToolbar(S); renderSide(S);
      build(S);
    }).catch(function () { host.innerHTML = '<div style="padding:2rem;color:#f99;">network error</div>'; });
  };

  // ── layout: order users top→bottom as BLOCKS (PR10 geo-clustering):
  //   families → teams → loners, and WITHIN each tier by real-world proximity to
  //   the caller (server-provided Haversine `dist`). Members of a family/team stay
  //   adjacent; users with no location fall to the end. ──
  function layout(S) {
    // Client-side safeguard: never render soft-deleted accounts even if the API
    // ever leaks one (server already filters deleted_at IS NULL).
    var users = (S.data.users || []).filter(function (u) { return !u.deleted_at; }), teams = S.data.teams || [];
    var byId = {}; users.forEach(function (u) { byId[u.id] = u; });
    // 3.2: build each user's chain components ONCE with the shared personal-path
    // engine, so collective spines render the SAME lightning chains (not pips).
    // Attach the flat journey_links list to each user's events first.
    if (window.EvolutionPath && window.EvolutionPath.buildSpine) {
      var linksByEv = {};
      (S.data.links || []).forEach(function (l) {
        var a = String(l.a != null ? l.a : l.event_a);
        (linksByEv[a] = linksByEv[a] || []).push({ to: String(l.b != null ? l.b : l.event_b), kind: l.kind, weight: l.weight });
      });
      users.forEach(function (u) {
        if (u._comps) return;                       // cache: events don't change within a mount
        var evs = (u.events || []).map(function (e) {
          return { id: String(e.id), layer: e.layer, t: tms(e.t || e.occurred_at), valence: e.valence, weight: e.weight, label: e.label, links: linksByEv[String(e.id)] || [] };
        });
        u._comps = window.EvolutionPath.buildSpine(evs, 22);
      });
    }
    var teamOf = {};
    teams.forEach(function (tm) { tm.members.forEach(function (m) {
      var cur = teamOf[m.user_id];
      if (!cur || (tm.kind === 'family' && cur.kind !== 'family')) teamOf[m.user_id] = { teamId: tm.id, kind: tm.kind };
    }); });
    function distOf(u) { return (u && u.dist != null && isFinite(u.dist)) ? u.dist : Infinity; }
    function catRank(kind) { return kind === 'family' ? 0 : kind === 'team' ? 1 : 2; }
    var blocks = [], seen = {};
    teams.forEach(function (tm) {
      // a user belongs to THIS block only if their resolved team is this one
      // (so someone in both a family and a team appears under the family)
      var mem = tm.members.map(function (m) { return byId[m.user_id]; })
        .filter(function (u) { return u && teamOf[u.id] && teamOf[u.id].teamId === tm.id; });
      if (!mem.length) return;
      mem.forEach(function (u) { seen[u.id] = 1; });
      mem.sort(function (a, b) { return distOf(a) - distOf(b) || tms(a.created_at) - tms(b.created_at); });
      var ds = mem.map(distOf).filter(isFinite);
      var centroid = ds.length ? ds.reduce(function (s, d) { return s + d; }, 0) / ds.length : Infinity;
      blocks.push({ cat: catRank(tm.kind), dist: centroid, teamId: tm.id, kind: tm.kind, name: tm.name, users: mem });
    });
    users.forEach(function (u) { if (!seen[u.id]) blocks.push({ cat: 2, dist: distOf(u), teamId: 0, users: [u] }); });
    blocks.sort(function (a, b) { return (a.cat - b.cat) || (a.dist - b.dist) || (Number(a.teamId) - Number(b.teamId)); });
    var sorted = []; blocks.forEach(function (bk) { bk.users.forEach(function (u) { sorted.push(u); }); });
    S.order = sorted; S.teamOf = teamOf;

    // ── PR12: groups. family/team blocks are groups; loners are bucketed by
    // country (no-location → its own group), preserving the geo order. ──
    var groups = [], cbuckets = {};
    blocks.forEach(function (bk) {
      if (bk.teamId) {
        groups.push({ key: 't' + bk.teamId, kind: bk.kind, label: bk.name || (bk.kind === 'family' ? 'Family' : 'Team'),
          icon: bk.kind === 'family' ? '🏠' : '👥', users: bk.users });
      } else {
        var u = bk.users[0], ckey = u.country ? ('c' + u.country) : 'noloc';
        if (!cbuckets[ckey]) { cbuckets[ckey] = { key: ckey, kind: 'country', label: u.country || T('a.evo.no_location', 'Без локации'), icon: u.country ? '📍' : '∅', users: [] }; groups.push(cbuckets[ckey]); }
        cbuckets[ckey].users.push(u);
      }
    });
    groups.forEach(function (g) { g.count = g.users.length; g.eventCount = g.users.reduce(function (s, u) { return s + ((u.events || []).length); }, 0); });
    S.groups = groups;
    var meId = (window.currentUser && window.currentUser.id) ? String(window.currentUser.id) : null;
    S._meId = meId;
    // default expansion: anchor's group + the few most active groups; user
    // overrides are persisted per-group in localStorage.
    var ranked = groups.slice().sort(function (a, b) { return b.eventCount - a.eventCount; });
    var topKeys = {}; ranked.slice(0, 6).forEach(function (g) { topKeys[g.key] = 1; });
    groups.forEach(function (g) {
      var has = g.users.some(function (u) { return String(u.id) === meId; });
      var def = has || !!topKeys[g.key];
      var ov = null; try { ov = localStorage.getItem('cp_grp_' + g.key); } catch (e) {}
      g.expanded = ov == null ? def : (ov === '1');
    });
    buildRows(S);
  }
  // Flatten groups into display rows. ≤50 users → no headers (all spines flat).
  function buildRows(S) {
    var groups = S.groups || [], total = (S.order || []).length;
    var rows = [];
    S.collapsible = total > 50;
    if (!S.collapsible) {
      (S.order || []).forEach(function (u) { rows.push({ type: 'spine', user: u }); });
    } else {
      groups.forEach(function (g) {
        rows.push({ type: 'header', group: g });
        if (g.expanded) g.users.forEach(function (u) { rows.push({ type: 'spine', user: u, group: g }); });
      });
    }
    S.rows = rows;
    S.rowOf = {};
    rows.forEach(function (r, i) { if (r.type === 'spine') S.rowOf[r.user.id] = i; });
    var meId = S._meId;
    var anchor = (meId != null && S.rowOf[meId] != null) ? S.rowOf[meId] : null;
    if (anchor == null) { // anchor's group collapsed → point at its header
      for (var i = 0; i < rows.length; i++) { if (rows[i].type === 'header' && rows[i].group.users.some(function (u) { return String(u.id) === meId; })) { anchor = i; break; } }
    }
    S.anchorRow = anchor == null ? 0 : anchor;
  }
  function toggleGroup(S, key) {
    var g = (S.groups || []).filter(function (x) { return x.key === key; })[0]; if (!g) return;
    g.expanded = !g.expanded;
    try { localStorage.setItem('cp_grp_' + key, g.expanded ? '1' : '0'); } catch (e) {}
    buildRows(S); requestDraw(S);
  }

  function ensureView(S, x0, x1) {
    if (S.view) { S.view._x0 = x0; S.view._x1 = x1; return S.view; }
    var users = S.order || [], minT = Infinity, maxT = -Infinity;
    users.forEach(function (u) { var c = tms(u.created_at); if (c < minT) minT = c; (u.events || []).forEach(function (e) { var t = tms(e.t); if (t > maxT) maxT = t; }); });
    if (!isFinite(minT)) minT = Date.now() - 365 * DAY;
    var nowT = Date.now(); if (maxT < nowT) maxT = nowT;
    var spanDays = Math.max(1, (nowT - minT) / DAY);
    var basePxPerDay = (x1 - x0) / (spanDays * 1.04);
    // _basePxPerDay = the fit-to-view zoom baseline; the live time-zoom factor is
    // pxPerDay/_basePxPerDay (3.1 inheritance — drives per-spine Y-zoom in draw()).
    S.view = { originT: minT, nowT: nowT, pxPerDay: basePxPerDay, _basePxPerDay: basePxPerDay, panX: 0, _x0: x0, _x1: x1 };
    return S.view;
  }

  // ── render scheduling: coalesce all input into ONE draw per frame ──
  function requestDraw(S) { if (S._raf) return; S._raf = requestAnimationFrame(function () { S._raf = null; draw(S); }); }
  function startMomentum(S) {
    if (S._mraf) return;
    var tick = function () {
      S._mraf = null;
      var moving = false;
      if (Math.abs(S.velY) > 0.35) { S.scrollY += S.velY; clampScroll(S); S.velY *= 0.90; moving = true; }
      draw(S);
      if (moving) S._mraf = requestAnimationFrame(tick); else S.velY = 0;
    };
    S._mraf = requestAnimationFrame(tick);
  }
  function contentH(S) { return (S.rows || S.order || []).length * S.spineH; }
  function spinesViewH(S) { return S._spinesBot - S._padTop; }
  function clampScroll(S) { var max = Math.max(0, contentH(S) - spinesViewH(S)); S.scrollY = clamp(S.scrollY, 0, max); }

  function build(S) {
    var host = S._host; host.innerHTML = '';
    var cv = document.createElement('canvas'); cv.style.cssText = 'display:block;width:100%;height:100%;cursor:grab;touch-action:none;';
    host.appendChild(cv);
    host.appendChild(buildMiniMap(S));
    var card = document.createElement('div'); card.className = 'cp-card'; host.appendChild(card);
    S._cv = cv; S._card = card;
    sizeAndDraw(S);
    if (!S._ro && typeof ResizeObserver === 'function') {
      S._ro = new ResizeObserver(function () { clearTimeout(S._rt); S._rt = setTimeout(function () { S.view = null; sizeAndDraw(S); }, 140); });
      try { S._ro.observe(host); } catch (e) {}
    }
    wire(S);
    if (!S._esc) {
      S._esc = function (e) { if (e.key !== 'Escape') return; if (S._focusUser) exitFocus(S); else if (S._container && S._container.classList.contains('cp-fullscreen')) toggleFullscreen(S); };
      document.addEventListener('keydown', S._esc);
    }
  }
  // ── PR11: mini-map — an overview of ALL spines with a draggable viewport box ──
  function buildMiniMap(S) {
    var wrap = document.createElement('div'); wrap.className = 'cp-minimap';
    wrap.innerHTML = '<button class="cp-mini-toggle" title="mini-map">▭</button>' +
      '<div class="cp-mini-body"><canvas class="cp-mini-cv"></canvas><div class="cp-mini-vp"></div></div>';
    S._mini = wrap;
    wrap.querySelector('.cp-mini-toggle').addEventListener('click', function (e) { e.stopPropagation(); wrap.classList.toggle('collapsed'); });
    var body = wrap.querySelector('.cp-mini-body'), dragging = false;
    function jumpTo(clientY) { var r = body.getBoundingClientRect(); var frac = clamp((clientY - r.top) / r.height, 0, 1); S.scrollY = frac * contentH(S) - spinesViewH(S) / 2; clampScroll(S); requestDraw(S); }
    body.addEventListener('pointerdown', function (e) { dragging = true; jumpTo(e.clientY); try { body.setPointerCapture(e.pointerId); } catch (er) {} e.stopPropagation(); });
    body.addEventListener('pointermove', function (e) { if (dragging) { jumpTo(e.clientY); e.stopPropagation(); } });
    body.addEventListener('pointerup', function () { dragging = false; });
    return wrap;
  }
  function drawMiniMap(S) {
    var wrap = S._mini; if (!wrap) return;
    if (S._isMobile) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';
    var cv = wrap.querySelector('.cp-mini-cv'), body = wrap.querySelector('.cp-mini-body');
    var mw = body.clientWidth || 148, mh = body.clientHeight || 110, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(mw * dpr); cv.height = Math.round(mh * dpr); cv.style.width = mw + 'px'; cv.style.height = mh + 'px';
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, mw, mh);
    var rowsArr = S.rows || [], n = rowsArr.length || 1, v = S.view; if (!v) return;
    var minT = v.originT, span = Math.max(1, v.nowT - minT), lw = Math.max(0.5, mh / n);
    for (var i = 0; i < n; i++) {
      var r = rowsArr[i], y = (i + 0.5) / n * mh;
      if (r.type === 'header') { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(mw, y); ctx.strokeStyle = 'rgba(120,200,255,0.25)'; ctx.lineWidth = Math.max(0.6, lw); ctx.stroke(); continue; }
      var u = r.user, xm = (tms(u.created_at) - minT) / span * mw;
      var col = 'rgba(180,200,220,0.45)', tm = S.teamOf[u.id];
      if (tm) col = tm.kind === 'family' ? 'rgba(255,170,120,0.7)' : 'rgba(120,200,255,0.6)';
      ctx.beginPath(); ctx.moveTo(Math.max(0, xm), y); ctx.lineTo(mw, y); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
    }
    S._miniH = mh; updateMiniViewport(S);
  }
  function updateMiniViewport(S) {
    var wrap = S._mini; if (!wrap || S._isMobile) return;
    var vp = wrap.querySelector('.cp-mini-vp'), mh = S._miniH || 110, ch = contentH(S), vh = spinesViewH(S);
    if (ch <= vh) { vp.style.display = 'none'; return; }
    vp.style.display = ''; vp.style.top = ((S.scrollY / ch) * mh) + 'px'; vp.style.height = Math.max(6, (vh / ch) * mh) + 'px';
  }

  function sizeAndDraw(S) {
    var host = S._host, cv = S._cv;
    var W = Math.max(280, host.clientWidth || 600);
    var H = Math.max(360, host.clientHeight || 540);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    S._W = W; S._H = H; S._dpr = dpr;
    draw(S);
    drawMiniMap(S);
  }

  function draw(S) {
    var cv = S._cv; if (!cv) return;
    var ctx = cv.getContext('2d'), W = S._W, H = S._H, dpr = S._dpr;
    var isMobile = W <= 560;
    var padL = isMobile ? 8 : 130, padR = 14, padTop = 16, padBot = 26;
    var x0 = padL, x1 = W - padR;
    var view = ensureView(S, x0, x1);
    var activeExt = EXT_LAYERS.filter(function (k) { return S.extOn[k] && (S.data.external_overlays || {})[k]; });
    var hasOv = activeExt.length > 0;
    var fullBot = H - padBot;
    var spinesBot = hasOv ? Math.round(padTop + (fullBot - padTop) * 0.72) : fullBot;
    S._padTop = padTop; S._spinesBot = spinesBot; S._x0 = x0; S._x1 = x1; S._isMobile = isMobile;
    clampScroll(S);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var sx = function (t) { return (tms(t) - view.originT) / DAY * view.pxPerDay + view.panX + x0; };
    S._sx = sx;
    // 3.1 inheritance: live time-zoom factor (how far we've zoomed past the fit
    // baseline), clamped like the personal path. Drives per-spine Y-zoom below.
    var timeZoom = clamp(view.pxPerDay / (view._basePxPerDay || view.pxPerDay), 0.6, 6);

    var rowsArr = S.rows || [], n = rowsArr.length, sh = S.spineH;
    var rowY = function (i) { return padTop + i * sh + sh / 2 - S.scrollY; };
    S._rowY = rowY;
    // VIRTUALISATION: only rows whose band intersects the viewport (± buffer)
    var first = Math.max(0, Math.floor(S.scrollY / sh) - BUFFER);
    var last = Math.min(n, Math.ceil((S.scrollY + (spinesBot - padTop)) / sh) + BUFFER);
    S._visFirst = first; S._visLast = last;

    // clip the spines zone so scrolled content can't paint over the axis/overlays
    ctx.save(); ctx.beginPath(); ctx.rect(0, padTop - 2, W, spinesBot - padTop + 2); ctx.clip();

    // connection nerves (only between members that are currently expanded/visible)
    (S.data.teams || []).forEach(function (tm) {
      var rws = tm.members.map(function (m) { return S.rowOf[m.user_id]; }).filter(function (r) { return r != null; }).sort(function (a, b) { return a - b; });
      var col = tm.kind === 'family' ? 'rgba(255,170,120,0.5)' : 'rgba(120,200,255,0.32)';
      var lw = tm.kind === 'family' ? 1.4 : 1;
      for (var i = 0; i < rws.length - 1; i++) {
        if (rws[i + 1] < first || rws[i] > last) continue;
        var ya = rowY(rws[i]), yb = rowY(rws[i + 1]), xx = x0 + 6;
        ctx.beginPath(); ctx.moveTo(xx, ya); ctx.bezierCurveTo(xx - 10, (ya + yb) / 2, xx - 10, (ya + yb) / 2, xx, yb);
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
      }
    });

    var hov = S._hoverRow;
    S._nodes = [];
    var nameH = sh >= 26;
    for (var ri = first; ri < last; ri++) {
      var row = rowsArr[ri]; if (!row) continue;
      var y = rowY(ri), dim = (hov != null && hov !== ri) ? 0.35 : 1;
      if (row.type === 'header') {
        var g = row.group;
        ctx.fillStyle = 'rgba(120,200,255,' + (hov === ri ? 0.10 : 0.05) + ')';
        ctx.fillRect(x0 - (isMobile ? 6 : 124), y - sh / 2 + 1, (x1 - x0) + (isMobile ? 12 : 130), sh - 2);
        ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#cfe3f5';
        ctx.fillText((g.expanded ? '▼ ' : '▶ ') + g.icon + ' ' + g.label + '  (' + g.count + ')', isMobile ? 4 : (x0 - 120), y);
        ctx.textBaseline = 'alphabetic';
        continue;
      }
      var u = row.user;
      var cs = sx(u.created_at), ce = Math.min(x1, sx(view.nowT));
      // PR FIX #9: each spine is a mini personal-path. Detail scales with height:
      //   ≥60px → full (wave + lightning branches + XP aura + glowing nodes),
      //   ≥30px → spine + branches, <30px → thin spine + dots.
      var detail = sh >= 60 ? 2 : sh >= 30 ? 1 : 0;
      var amp = detail >= 1 ? Math.min(sh * 0.12, 6) : 0, x0s = Math.max(x0, cs);
      var yAt = function (px) { return amp ? y + amp * Math.sin((px - cs) * 0.016) : y; };
      var spineStep = detail ? 6 : (ce - x0s) || 1;
      // XP aura — soft lived-band (full detail only)
      if (detail >= 2 && (u.events || []).length) {
        ctx.save(); ctx.globalAlpha = 0.16 * dim; ctx.strokeStyle = 'rgba(120,200,180,0.9)'; ctx.lineWidth = Math.min(sh * 0.5, 18); ctx.shadowColor = 'rgba(120,200,180,0.5)'; ctx.shadowBlur = 8;
        ctx.beginPath(); for (var pa = x0s; pa <= ce; pa += 10) { var ya = yAt(pa); if (pa === x0s) ctx.moveTo(pa, ya); else ctx.lineTo(pa, ya); } ctx.stroke(); ctx.restore();
      }
      // spine
      ctx.globalAlpha = 0.5 * dim; ctx.beginPath();
      for (var ps = x0s; ps <= ce; ps += spineStep) { var ys = yAt(ps); if (ps === x0s) ctx.moveTo(ps, ys); else ctx.lineTo(ps, ys); }
      ctx.lineTo(ce, yAt(ce));
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = hov === ri ? 2 : (detail >= 2 ? 1.6 : 1.1); ctx.stroke();
      ctx.globalAlpha = 1;
      if (cs >= x0 - 4 && cs <= x1) { ctx.beginPath(); ctx.arc(cs, yAt(cs), detail >= 2 ? 3.2 : 2.4, 0, 6.283); ctx.fillStyle = 'rgba(150,220,255,0.9)'; ctx.globalAlpha = dim; ctx.fill(); ctx.globalAlpha = 1; }
      // 3.2: render this spine's chains via the shared personal-path engine —
      // real lightning branches with nodes in chain order (same visual language),
      // instead of the old per-event up/down pips. vScale maps the component's
      // local layout (built with half=22) into this row's slim band.
      if (window.EvolutionPath && window.EvolutionPath.drawSlimSpine && u._comps) {
        // bandHalf caps each spine's vertical spread to < half the row height so
        // adjacent spines never collide; drawSlimSpine fills it adaptively (sparse
        // stretch, crowded fan + horizontal compress + priority sampling).
        var bandHalf = Math.min(sh * 0.40, detail >= 2 ? 44 : 11);
        window.EvolutionPath.drawSlimSpine(ctx, u._comps, {
          sx: sx, cy: y, x0: x0, x1: x1, zoom: detail >= 2 ? 0.75 : 0.55, bandHalf: bandHalf,
          rZ: detail >= 2 ? 0.95 : 0.65, timeZoom: timeZoom,
          hidden: S.hiddenLayers, dim: dim, nodesOut: S._nodes, row: ri
        });
      }
      if (!isMobile && nameH) {
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        var indent = S.collapsible ? 0 : 0;
        var place = (sh >= 36 && (u.city || u.country)) ? [u.city, u.country].filter(Boolean).join(', ') : '';
        var nameY = place ? y - 6 : y;
        ctx.font = '9px Inter, system-ui, sans-serif';
        ctx.fillStyle = hov === ri ? '#eaf6ff' : 'rgba(160,175,195,' + (0.7 * dim) + ')';
        var tname = (u.name || '—'); if (tname.length > 16) tname = tname.slice(0, 15) + '…';
        ctx.fillText((S.collapsible ? '· ' : '') + tname, x0 - 6, nameY);
        if (place) { ctx.font = '8px Inter, system-ui, sans-serif'; ctx.fillStyle = 'rgba(140,155,175,' + (0.55 * dim) + ')'; if (place.length > 18) place = place.slice(0, 17) + '…'; ctx.fillText(place, x0 - 6, y + 6); }
      }
    }
    ctx.textBaseline = 'alphabetic';
    ctx.restore();   // end spines clip

    // scrollbar hint (right edge)
    var ch = contentH(S), vh = spinesBot - padTop;
    if (ch > vh) {
      var th = Math.max(24, vh * vh / ch), ty = padTop + (S.scrollY / (ch - vh)) * (vh - th);
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(W - 4, ty, 3, th);
    }

    // External Field overlay tracks (sticky — outside the scroll clip)
    S._ovNodes = [];
    if (hasOv) {
      var ovTop = spinesBot + 10;
      ctx.beginPath(); ctx.moveTo(x0 - 6, ovTop - 6); ctx.lineTo(x1 + 6, ovTop - 6); ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.stroke();
      var tH = (fullBot - ovTop) / activeExt.length;
      activeExt.forEach(function (lk, li) {
        var cyT = ovTop + tH * li + tH / 2;
        ctx.beginPath(); ctx.moveTo(x0, cyT); ctx.lineTo(x1, cyT); ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.stroke();
        // 1.2 inheritance: sticky left-gutter icon + label with a faint backing
        // chip (mirrors the personal path's drawOverlayIcons). Drawn outside the
        // scroll clip → never scrolls off; left-anchored → never pans away.
        ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        var lblTxt = EXT_ICON[lk] + (isMobile ? '' : ' ' + T('tab.' + lk, lk)), lblX = isMobile ? 2 : (x0 - 120);
        if (!isMobile) { var lblW = ctx.measureText(lblTxt).width; ctx.fillStyle = 'rgba(6,9,14,0.72)'; ctx.fillRect(lblX - 3, cyT - 8, lblW + 6, 16); }
        ctx.fillStyle = 'rgba(160,175,195,0.85)';
        ctx.fillText(lblTxt, lblX, cyT);
        (S.data.external_overlays[lk] || []).forEach(function (ev) {
          var mx = sx(ev.t); if (mx < x0 - 3 || mx > x1 + 3) return;
          var col = ({ yellow: '#ffcf4d', orange: '#ff9d3c', red: '#ff5a5a' })[ev.severity_color] || extColor(lk, ev.severity);
          ctx.beginPath(); ctx.arc(mx, cyT, 3, 0, 6.283); ctx.fillStyle = col; ctx.fill();
          S._ovNodes.push({ x: mx, y: cyT, ev: ev, layer: lk, color: col });
        });
      });
      ctx.textBaseline = 'alphabetic';
    }

    // sticky bottom time axis (always visible)
    drawTimeAxis(ctx, view, x0, x1, H - padBot + 4, S._lang);
    updateMiniViewport(S);
  }

  function drawTimeAxis(ctx, view, x0, x1, y, lang) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.font = '9px Inter, system-ui, sans-serif'; ctx.fillStyle = 'rgba(150,165,185,0.8)'; ctx.textAlign = 'center';
    var span = (x1 - x0) / view.pxPerDay;
    var stepDays = span > 720 ? 180 : span > 180 ? 30 : span > 40 ? 7 : 1;
    var loc = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'ru-RU';
    for (var gx = x0; gx <= x1; gx += Math.max(60, view.pxPerDay * stepDays)) {
      var t = view.originT + (gx - view.panX - x0) / view.pxPerDay * DAY;
      var lab = ''; try { lab = new Date(t).toLocaleDateString(loc, { day: 'numeric', month: 'short' }); } catch (e) {}
      ctx.fillText(lab, gx, y + 12);
    }
  }

  // ── toolbar: time-period row + visible-users (vertical density) row ──
  function renderToolbar(S) {
    var tb = S._toolbar; if (!tb) return;
    var per = PERIODS.map(function (p) { return '<button class="cp-pbtn" data-period="' + p[0] + '">' + esc(T('a.evo.period_' + p[0], p[0])) + '</button>'; }).join('');
    var dens = [10, 100, 1000].map(function (nn) { return '<button class="cp-dbtn" data-density="' + nn + '">' + nn + '</button>'; }).join('');
    tb.innerHTML =
      '<div style="display:flex;align-items:center;gap:0.4rem;"><span class="cp-tb-label">' + esc(T('a.evo.period', 'Период')) + '</span><div class="cp-seg">' + per + '</div></div>' +
      '<div style="display:flex;align-items:center;gap:0.4rem;"><span class="cp-tb-label">' + esc(T('a.evo.visible_users', 'Видно пользователей')) + '</span><div class="cp-seg">' + dens + '</div></div>' +
      '<button class="cp-fs-btn" style="margin-left:auto;">⤢ ' + esc(T('a.tools.fullscreen', 'Раскрыть')) + '</button>';
    tb.querySelectorAll('.cp-pbtn').forEach(function (b) { b.addEventListener('click', function () { applyPeriod(S, b.getAttribute('data-period')); }); });
    tb.querySelectorAll('.cp-dbtn').forEach(function (b) { b.addEventListener('click', function () { applyDensity(S, parseInt(b.getAttribute('data-density'), 10)); }); });
    var fs = tb.querySelector('.cp-fs-btn'); if (fs) fs.addEventListener('click', function () { toggleFullscreen(S); });
  }
  // PR FIX #11: expand the collective path to a full-viewport overlay; Esc closes.
  function toggleFullscreen(S) {
    var c = S._container; if (!c) return;
    var on = !c.classList.contains('cp-fullscreen');
    c.classList.toggle('cp-fullscreen', on);
    document.body.style.overflow = on ? 'hidden' : '';
    setTimeout(function () { S.view = S.view; sizeAndDraw(S); }, 30);
  }
  function applyPeriod(S, period) {
    var days = ({ day: 1, week: 7, month: 30, '3months': 90, year: 365 })[period] || 30;
    var v = S.view; if (!v) return;
    v.pxPerDay = clamp((S._x1 - S._x0) / days, MIN_PXPD, MAX_PXPD);
    v.panX = (S._x1 - S._x0) - (v.nowT - v.originT) / DAY * v.pxPerDay;   // 'now' at right edge
    requestDraw(S);
  }
  function applyDensity(S, count) {
    // make `count` spines fit the spines viewport, centred on the anchor row
    var vh = spinesViewH(S) || ((S._H || 540) - 42);
    S.spineH = clamp(vh / count, SPINE_MIN, SPINE_MAX);
    var anchorCenter = (S.anchorRow + 0.5) * S.spineH;
    S.scrollY = anchorCenter - vh / 2;
    clampScroll(S); requestDraw(S);
  }

  function renderSide(S) {
    var side = S._side; if (!side) return;
    var chk = function (on) { return on ? 'checked' : ''; };
    var dataRows = DATA_LAYERS.map(function (k) { return '<label class="cp-lyr"><input type="checkbox" data-layer="' + k + '" ' + chk(!S.hiddenLayers[k]) + '> ' + esc(T('a.evo.layer_' + k, k)) + '</label>'; }).join('');
    var ovAvail = S.data.external_overlays || {};
    var extRows = EXT_LAYERS.map(function (k) { var has = (ovAvail[k] && ovAvail[k].length); return '<label class="cp-lyr" style="' + (has ? '' : 'opacity:0.5;') + '"><input type="checkbox" data-ext="' + k + '" ' + chk(!!S.extOn[k]) + '> ' + EXT_ICON[k] + ' ' + esc(T('tab.' + k, k)) + '</label>'; }).join('');
    var pub = '';
    if (S.data.is_superadmin) pub = '<div style="margin-top:0.9rem;padding-top:0.7rem;border-top:1px solid rgba(255,255,255,0.08);"><label class="cp-lyr" style="font-weight:600;"><input type="checkbox" id="cp-publish" ' + chk(S.data.published) + '> ' + esc(T('a.evo.publish', 'Опубликовать для всех пользователей')) + '</label></div>';
    side.innerHTML =
      '<div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim,#89a);margin-bottom:0.5rem;">' + esc(T('a.evo.layers', 'Слои')) + '</div>' +
      dataRows + '<div style="height:0.5rem;"></div>' + extRows + pub +
      '<div style="margin-top:0.8rem;font-size:11px;color:var(--text-muted,#789);">' + esc(T('a.evo.users_count', 'Участников')) + ': ' + ((S.data.users || []).length) + '</div>';
    side.querySelectorAll('input[data-layer]').forEach(function (cb) { cb.addEventListener('change', function () { S.hiddenLayers[cb.getAttribute('data-layer')] = !cb.checked; requestDraw(S); }); });
    // 1.3: toggling a layer is a pure redraw — flip its flag and requestDraw.
    // All layers' data is already loaded, draw() filters by S.extOn each frame,
    // so no re-fetch / no canvas rebuild (keeps scroll, zoom and focus state).
    side.querySelectorAll('input[data-ext]').forEach(function (cb) { cb.addEventListener('change', function () { S.extOn[cb.getAttribute('data-ext')] = cb.checked; requestDraw(S); }); });
    var pubCb = side.querySelector('#cp-publish');
    if (pubCb) pubCb.addEventListener('change', function () {
      var token = localStorage.getItem('na_token');
      fetch((window.AUTH_API || '') + '/api/admin/collective-path/publish', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ published: pubCb.checked }) })
        .then(function (r) { return r.json(); }).then(function (d) { if (d && d.ok) S.data.published = d.published; }).catch(function () {});
    });
  }

  // ── interactions ──
  function wire(S) {
    var cv = S._cv, st = { drag: false, lastX: 0, lastY: 0, moved: false };
    function rl(cx) { var r = cv.getBoundingClientRect(); return cx - r.left; }
    function rt(cy) { var r = cv.getBoundingClientRect(); return cy - r.top; }

    cv.addEventListener('wheel', function (e) {
      e.preventDefault(); var v = S.view; if (!v) return;
      var dY = e.deltaY, dX = e.deltaX;
      if (e.ctrlKey || e.metaKey) {
        if (Math.abs(dY) >= Math.abs(dX)) {                 // ctrl + vertical → density zoom (anchored)
          var my = rt(e.clientY);
          var rowUnder = (S.scrollY + (my - S._padTop)) / S.spineH;
          S.spineH = clamp(S.spineH * Math.pow(1.0016, -dY), SPINE_MIN, SPINE_MAX);
          S.scrollY = rowUnder * S.spineH - (my - S._padTop);
          clampScroll(S);
        } else {                                            // ctrl + horizontal → time zoom (anchored)
          var ax = rl(e.clientX), tU = v.originT + (ax - v.panX - S._x0) / v.pxPerDay * DAY;
          v.pxPerDay = clamp(v.pxPerDay * Math.pow(1.0015, -dX), MIN_PXPD, MAX_PXPD);
          v.panX = ax - S._x0 - (tU - v.originT) / DAY * v.pxPerDay;
        }
      } else {
        // plain wheel → vertical scroll (+ horizontal pan from a trackpad)
        S.scrollY += dY; S.velY = dY * 0.5; clampScroll(S); startMomentum(S);
        if (Math.abs(dX) > 0.5) v.panX -= dX;
      }
      requestDraw(S);
    }, { passive: false });

    cv.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') return; st.drag = true; st.moved = false; st.lastX = e.clientX; st.lastY = e.clientY; S.velY = 0; cv.style.cursor = 'grabbing'; try { cv.setPointerCapture(e.pointerId); } catch (er) {} });
    cv.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      if (st.drag) { var dx = e.clientX - st.lastX, dy = e.clientY - st.lastY; st.lastX = e.clientX; st.lastY = e.clientY; if (Math.abs(dx) + Math.abs(dy) > 2) st.moved = true; if (S.view) S.view.panX += dx; S.scrollY -= dy; S.velY = -dy; clampScroll(S); requestDraw(S); return; }
      var lx = rl(e.clientX), ly = rt(e.clientY);
      var row = laneAt(S, ly), changed = row !== S._hoverRow; S._hoverRow = row;
      cv.style.cursor = row != null ? 'pointer' : 'grab';
      // 3.2: node hover tooltip — reuse the personal path's shared tip component
      // (same DOM/style + same prettyTitle text source), no duplication.
      nodeHoverTip(S, lx, ly, e.clientX, e.clientY);
      if (changed) requestDraw(S);
    });
    function endDrag(e) { if (e.pointerType === 'touch') return; if (!st.drag) return; st.drag = false; cv.style.cursor = 'grab'; startMomentum(S); if (!st.moved) hitTest(S, rl(e.clientX), rt(e.clientY)); }
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointerleave', function () { if (window.EvolutionPath && window.EvolutionPath.hideTip) window.EvolutionPath.hideTip(); if (S._hoverRow != null) { S._hoverRow = null; requestDraw(S); } });

    // touch: 1-finger pan/scroll, 2-finger pinch (vertical focus → density, else time)
    var tg = { mode: null, lastX: 0, lastY: 0, startDist: 0, startDistX: 0, startDistY: 0, startPx: 0, startSh: 0, lastMid: 0, anchorRow: 0, anchorMy: 0, moved: false };
    function tDist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    cv.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        e.preventDefault(); var r = cv.getBoundingClientRect();
        tg.mode = 'pinch'; tg.startDist = tDist(e.touches) || 1;
        tg.startDistX = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
        tg.startDistY = Math.abs(e.touches[0].clientY - e.touches[1].clientY);
        tg.startPx = S.view.pxPerDay; tg.startSh = S.spineH;
        tg.lastMid = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        tg.anchorMy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
        tg.anchorRow = (S.scrollY + (tg.anchorMy - S._padTop)) / S.spineH;
      } else if (e.touches.length === 1) { tg.mode = 'pan'; tg.lastX = e.touches[0].clientX; tg.lastY = e.touches[0].clientY; tg.moved = false; S.velY = 0; }
    }, { passive: false });
    cv.addEventListener('touchmove', function (e) {
      var v = S.view; if (!v) return;
      if (tg.mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        var dx = Math.abs(e.touches[0].clientX - e.touches[1].clientX), dy = Math.abs(e.touches[0].clientY - e.touches[1].clientY);
        if (dy >= dx) {                                     // vertical pinch → density zoom
          S.spineH = clamp(tg.startSh * ((dy || 1) / (tg.startDistY || 1)), SPINE_MIN, SPINE_MAX);
          S.scrollY = tg.anchorRow * S.spineH - (tg.anchorMy - S._padTop); clampScroll(S);
        } else {                                            // horizontal pinch → time zoom
          var r = cv.getBoundingClientRect(), mid = (e.touches[0].clientX + e.touches[1].clientX) / 2, ax = mid - r.left;
          var tU = v.originT + (ax - v.panX - S._x0) / v.pxPerDay * DAY;
          v.pxPerDay = clamp(tg.startPx * ((dx || 1) / (tg.startDistX || 1)), MIN_PXPD, MAX_PXPD);
          v.panX = ax - S._x0 - (tU - v.originT) / DAY * v.pxPerDay; v.panX += (mid - tg.lastMid); tg.lastMid = mid;
        }
        requestDraw(S);
      } else if (tg.mode === 'pan' && e.touches.length === 1) {
        e.preventDefault(); var x = e.touches[0].clientX, y = e.touches[0].clientY, mx = x - tg.lastX, my = y - tg.lastY; tg.lastX = x; tg.lastY = y;
        if (Math.abs(mx) + Math.abs(my) > 2) tg.moved = true;
        v.panX += mx; S.scrollY -= my; S.velY = -my; clampScroll(S); requestDraw(S);
      }
    }, { passive: false });
    cv.addEventListener('touchend', function (e) {
      if (tg.mode === 'pan' && !tg.moved) { var ct = e.changedTouches && e.changedTouches[0]; if (ct) { var r = cv.getBoundingClientRect(); hitTest(S, ct.clientX - r.left, ct.clientY - r.top); } }
      else if (tg.mode === 'pan') startMomentum(S);
      if (e.touches.length === 0) tg.mode = null;
    }, { passive: false });
  }

  // 3.2: hover hit-test over the spine nodes drawn this frame (S._nodes, filled by
  // EvolutionPath.drawSlimSpine). Shows the shared tooltip; drag suppresses it.
  function nodeHoverTip(S, lx, ly, clientX, clientY) {
    var EP = window.EvolutionPath;
    if (!EP || !EP.showTip) return;
    var nodes = S._nodes || [], best = null, bd = 1e9;
    if (ly >= S._padTop && ly <= S._spinesBot) {
      for (var i = 0; i < nodes.length; i++) { var nd = nodes[i], d = Math.hypot(nd.x - lx, nd.y - ly), hit = Math.max(10, nd.r + 7); if (d < hit && d < bd) { bd = d; best = nd; } }
    }
    if (!best) { EP.hideTip(); return; }
    var e = best.e, col = LAYER_COLOR[e.layer] || '#8fd0ff';
    EP.showTip(clientX, clientY, EP.tipText(e, S._lang), col);
  }
  function laneAt(S, ly) {
    if (ly == null || ly < S._padTop || ly > S._spinesBot) return null;
    var row = Math.floor((S.scrollY + (ly - S._padTop)) / S.spineH);
    if (row < 0 || row >= (S.rows || S.order || []).length) return null;
    return row;
  }
  function hitTest(S, lx, ly) {
    var ov = S._ovNodes || [];
    for (var o = 0; o < ov.length; o++) { if (Math.hypot(ov[o].x - lx, ov[o].y - ly) < 12) { showCard(S, ov[o]); return; } }
    var row = laneAt(S, ly); if (row == null) return;
    var r = (S.rows || [])[row]; if (!r) return;
    if (r.type === 'header') { toggleGroup(S, r.group.key); return; }   // PR12: header toggles its group
    var u = r.user; if (!u) return;
    S.anchorRow = row;
    // E2: explicit click rules, keyed on the per-spine zoom state (S._focusUser):
    //   • single click while NOT zoomed → zoom into the spine
    //   • single click while ALREADY zoomed on it → no-op (stay put)
    //   • DOUBLE click → open the user's profile
    // (Nick: single-click-opens-profile was the bug; profile is double-click only.)
    var now = Date.now();
    var isDouble = S._lastClick && S._lastClick.row === row && (now - S._lastClick.t) < 350;
    S._lastClick = { row: row, t: now };
    if (isDouble) {
      S._lastClick = null;                 // consume so a 3rd click starts fresh
      openProfile(S, u);
      return;
    }
    if (S._focusUser !== String(u.id)) focusUser(S, u, row);
    // else: already zoomed on this spine — a single click does nothing.
  }
  function openProfile(S, u) {
    if (S.data && S.data.is_superadmin) {
      try { window.open('/account.html?tab=profile&userId=' + encodeURIComponent(u.id), '_blank'); } catch (e) {}
    } else {
      showUserCard(S, u);
    }
  }
  function focusUser(S, u, row) {
    S._focusPrev = { spineH: S.spineH, scrollY: S.scrollY };
    S._focusUser = String(u.id);
    S.spineH = Math.max(120, spinesViewH(S));      // one spine fills the chains zone
    S.scrollY = row * S.spineH;
    clampScroll(S); renderBreadcrumb(S); requestDraw(S);
  }
  function exitFocus(S) {
    if (!S._focusUser) return;
    if (S._focusPrev) { S.spineH = S._focusPrev.spineH; S.scrollY = S._focusPrev.scrollY; }
    S._focusUser = null; S._focusPrev = null; clampScroll(S); renderBreadcrumb(S); requestDraw(S);
  }
  function renderBreadcrumb(S) {
    var host = S._host; if (!host) return;
    var bc = host.querySelector('.cp-breadcrumb');
    if (!S._focusUser) { if (bc) bc.remove(); return; }
    var u = (S.order || []).filter(function (x) { return String(x.id) === S._focusUser; })[0];
    if (!bc) { bc = document.createElement('div'); bc.className = 'cp-breadcrumb'; host.appendChild(bc); }
    bc.innerHTML = '<button class="cp-bc-root">' + esc(T('a.evo.collective_path', 'Коллективный путь')) + '</button> <span style="opacity:0.5;">/</span> <b>' + esc(u ? u.name : '') + '</b>';
    bc.querySelector('.cp-bc-root').addEventListener('click', function () { exitFocus(S); });
  }

  function showCard(S, marker) {
    var host = S._host; var old = host.querySelector('.cp-pop'); if (old) old.remove();
    var ev = marker.ev, lang = S._lang;
    var when = ''; try { when = new Date(ev.t).toLocaleString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
    var d = document.createElement('div'); d.className = 'cp-pop';
    d.style.cssText = 'position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:20;max-width:300px;background:rgba(12,15,20,0.97);border:1px solid ' + marker.color + '55;border-radius:10px;padding:0.7rem 0.9rem;';
    d.innerHTML = '<div style="font-size:11px;text-transform:uppercase;color:' + marker.color + ';">' + (EXT_ICON[marker.layer] || '') + ' ' + esc(marker.layer) + (ev.severity ? ' · ' + esc(String(ev.severity)) : '') + '</div>' +
      '<div style="font-size:13px;color:#cdd;font-weight:600;margin:0.3rem 0 0.2rem;">' + esc(ev.title || marker.layer) + '</div>' +
      '<div style="font-size:11px;color:#789;font-family:monospace;">' + esc(when) + '</div>' +
      '<button class="cp-x" style="position:absolute;top:6px;right:8px;background:none;border:none;color:#89a;cursor:pointer;">✕</button>';
    host.appendChild(d); d.querySelector('.cp-x').addEventListener('click', function () { d.remove(); });
  }
  function showUserCard(S, u) {
    var host = S._host; var old = host.querySelector('.cp-pop'); if (old) old.remove();
    var d = document.createElement('div'); d.className = 'cp-pop';
    d.style.cssText = 'position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:20;background:rgba(12,15,20,0.97);border:1px solid rgba(120,200,255,0.4);border-radius:10px;padding:0.6rem 0.9rem;';
    d.innerHTML = '<div style="font-size:13px;color:#cdd;font-weight:600;">' + esc(u.name || '—') + '</div><div style="font-size:11px;color:#789;">' + ((u.events || []).length) + ' ' + esc(T('a.evo.events', 'событий')) + '</div>';
    host.appendChild(d); setTimeout(function () { if (d.parentNode) d.remove(); }, 2200);
  }
})();
