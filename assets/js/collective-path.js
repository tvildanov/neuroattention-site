/* ============================================================================
   collective-path.js — PR7: Collective Path of Development.

   Every registered user as a parallel light "spine" on one shared time axis,
   each starting at their registration date and branching to the right. Spines
   stack top→bottom; team/family members sit adjacent (MVP2/3 grouping is light —
   see TODOs). A bottom zone carries External Field overlay tracks, toggled from
   the same layer list as the personal-data layers.

   Public: window.mountCollectivePath(container)
   ============================================================================ */
(function () {
  'use strict';

  var DAY = 864e5, MIN_PXPD = 0.04, MAX_PXPD = 400;
  var LAYER_COLOR = { emotion: '#ff8aa0', event: '#a78bfa', thought: '#7fd0ff',
    sensation: '#67e3c0', practice: '#8fe39b', insight: '#ffd76a', xp_gain: '#cfd6e6' };
  var EXT_LAYERS = ['sun', 'moon', 'earth', 'weather', 'cosmos', 'social', 'experimental'];
  var EXT_ICON = { sun: '☀', moon: '☾', earth: '⊕', weather: '🌦', cosmos: '✦', social: '🌐', experimental: '⚡' };
  var DATA_LAYERS = ['event', 'emotion', 'thought', 'sensation', 'practice', 'insight'];

  function T(k, f) { return (typeof window.t === 'function') ? window.t(k, f) : f; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tms(t) { var d = new Date(t); return isNaN(d) ? 0 : d.getTime(); }
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
    var S = container.__cp || { hiddenLayers: {}, extOn: {}, view: null };
    container.__cp = S;

    container.innerHTML =
      '<div class="cp-wrap" style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;">' +
        '<div class="cp-canvas-host" style="position:relative;flex:1;min-width:280px;min-height:420px;background:rgba(6,9,14,0.6);border:1px solid rgba(255,255,255,0.07);border-radius:14px;overflow:hidden;"></div>' +
        '<div class="cp-side" style="width:190px;flex:none;"></div>' +
      '</div>';
    var host = container.querySelector('.cp-canvas-host');
    var side = container.querySelector('.cp-side');
    host.innerHTML = '<div style="padding:2rem;color:var(--text-muted,#89a);font-size:13px;">' + esc(T('a.evo.loading', 'Собираем коллективный путь…')) + '</div>';

    var hdr = token ? { 'Authorization': 'Bearer ' + token } : {};
    var activeExt = EXT_LAYERS.filter(function (k) { return S.extOn[k]; });
    var url = apiBase + '/api/admin/collective-path?period=year' + (activeExt.length ? '&overlay=' + activeExt.join(',') : '');
    fetch(url, { headers: hdr }).then(function (r) { return r.json(); }).then(function (data) {
      if (!data || data.error) { host.innerHTML = '<div style="padding:2rem;color:#f99;font-size:13px;">' + esc((data && data.error) || 'error') + '</div>'; return; }
      S.data = data;
      renderSide(side, S, container, lang);
      layout(S);
      build(host, S, container, lang);
    }).catch(function () { host.innerHTML = '<div style="padding:2rem;color:#f99;">network error</div>'; });
  };

  // ── layout: order users top→bottom. Priority (MVP): keep team/family members
  // adjacent (grouped by team, families first), then the rest by registration.
  // Geo-proximity ordering for the ungrouped tail is a TODO. ──
  function layout(S) {
    var users = S.data.users || [], teams = S.data.teams || [];
    var teamOf = {};                       // user_id → {teamId, kind, idx}
    teams.forEach(function (tm) { tm.members.forEach(function (m) {
      var cur = teamOf[m.user_id];
      // family beats team; otherwise first team wins
      if (!cur || (tm.kind === 'family' && cur.kind !== 'family')) teamOf[m.user_id] = { teamId: tm.id, kind: tm.kind };
    }); });
    // group key: families first (kind a), then teams (b), then loners (c) by reg date
    function rank(u) { var t = teamOf[u.id]; if (!t) return 'c'; return t.kind === 'family' ? 'a' : 'b'; }
    var sorted = users.slice().sort(function (a, b) {
      var ra = rank(a), rb = rank(b); if (ra !== rb) return ra < rb ? -1 : 1;
      var ta = teamOf[a.id], tb = teamOf[b.id];
      if (ta && tb && ta.teamId !== tb.teamId) return ta.teamId < tb.teamId ? -1 : 1;
      return tms(a.created_at) - tms(b.created_at);
    });
    S.order = sorted;
    S.teamOf = teamOf;
    // index lookup for connection drawing
    S.rowOf = {}; sorted.forEach(function (u, i) { S.rowOf[u.id] = i; });
  }

  function ensureView(S, x0, x1) {
    if (S.view) return S.view;
    var users = S.order || [];
    var minT = Infinity, maxT = -Infinity;
    users.forEach(function (u) { var c = tms(u.created_at); if (c < minT) minT = c; (u.events || []).forEach(function (e) { var t = tms(e.t); if (t > maxT) maxT = t; }); });
    if (!isFinite(minT)) minT = Date.now() - 365 * DAY;
    var nowT = Date.now(); if (maxT < nowT) maxT = nowT;
    var spanDays = Math.max(1, (nowT - minT) / DAY);
    var pxPerDay = (x1 - x0) / (spanDays * 1.04);
    S.view = { originT: minT, nowT: nowT, pxPerDay: pxPerDay, panX: 0 };
    return S.view;
  }

  function build(host, S, container, lang) {
    host.innerHTML = '';
    var cv = document.createElement('canvas'); cv.style.cssText = 'display:block;width:100%;cursor:grab;';
    host.appendChild(cv);
    var card = document.createElement('div'); card.className = 'cp-card'; host.appendChild(card);
    S._cv = cv; S._host = host; S._card = card;
    sizeAndDraw(S, container, lang);
    if (!S._ro && typeof ResizeObserver === 'function') {
      S._ro = new ResizeObserver(function () { clearTimeout(S._rt); S._rt = setTimeout(function () { S.view = null; sizeAndDraw(S, container, lang); }, 140); });
      try { S._ro.observe(host); } catch (e) {}
    }
    wire(cv, S, container, lang);
  }

  function sizeAndDraw(S, container, lang) {
    var host = S._host, cv = S._cv;
    var W = Math.max(280, host.clientWidth || 600);
    var H = Math.max(360, Math.min(720, (S.order || []).length * 16 + 120));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    S._W = W; S._H = H; S._dpr = dpr;
    draw(S, container, lang);
  }

  function draw(S, container, lang) {
    var cv = S._cv, ctx = cv.getContext('2d'), W = S._W, H = S._H, dpr = S._dpr;
    var isMobile = W <= 560;
    var padL = isMobile ? 8 : 130, padR = 14, padTop = 16, padBot = 26;
    var x0 = padL, x1 = W - padR;
    var view = ensureView(S, x0, x1);
    var activeExt = EXT_LAYERS.filter(function (k) { return S.extOn[k] && (S.data.external_overlays || {})[k]; });
    var hasOv = activeExt.length > 0;
    var fullBot = H - padBot;
    var spinesBot = hasOv ? Math.round(padTop + (fullBot - padTop) * 0.72) : fullBot;
    var ovTop = spinesBot + 10;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var sx = function (t) { return (tms(t) - view.originT) / DAY * view.pxPerDay + view.panX + x0; };

    var order = S.order || [], n = order.length || 1;
    var laneH = (spinesBot - padTop) / n;
    var rowY = function (i) { return padTop + laneH * (i + 0.5); };
    S._sx = sx; S._rowY = rowY; S._laneH = laneH; S._x0 = x0; S._x1 = x1; S._spinesBot = spinesBot;

    // team/family connection nerves (thin glowing threads between adjacent members)
    ctx.save();
    (S.data.teams || []).forEach(function (tm) {
      var rows = tm.members.map(function (m) { return S.rowOf[m.user_id]; }).filter(function (r) { return r != null; }).sort(function (a, b) { return a - b; });
      var col = tm.kind === 'family' ? 'rgba(255,170,120,0.5)' : 'rgba(120,200,255,0.32)';
      var lw = tm.kind === 'family' ? 1.4 : 1;
      for (var i = 0; i < rows.length - 1; i++) {
        var ya = rowY(rows[i]), yb = rowY(rows[i + 1]), xx = x0 + 6;
        ctx.beginPath(); ctx.moveTo(xx, ya); ctx.bezierCurveTo(xx - 10, (ya + yb) / 2, xx - 10, (ya + yb) / 2, xx, yb);
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
      }
    });
    ctx.restore();

    var hov = S._hoverRow;
    S._nodes = []; S._lanes = [];
    for (var i = 0; i < n; i++) {
      var u = order[i]; if (!u) continue;
      var y = rowY(i), cs = sx(u.created_at), ce = Math.min(x1, sx(view.nowT));
      if (cs > x1 || ce < x0) { /* still register lane for hit, skip heavy draw */ }
      var dim = (hov != null && hov !== i) ? 0.35 : 1;
      // spine
      ctx.globalAlpha = 0.5 * dim;
      ctx.beginPath(); ctx.moveTo(Math.max(x0, cs), y); ctx.lineTo(ce, y);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = hov === i ? 2 : 1.1; ctx.stroke();
      ctx.globalAlpha = 1;
      // registration dot
      if (cs >= x0 - 4 && cs <= x1) { ctx.beginPath(); ctx.arc(cs, y, 2.4, 0, 6.283); ctx.fillStyle = 'rgba(150,220,255,0.9)'; ctx.globalAlpha = dim; ctx.fill(); ctx.globalAlpha = 1; }
      // events as nodes with a tiny branch
      (u.events || []).forEach(function (e) {
        if (S.hiddenLayers[e.layer]) return;
        var ex = sx(e.t); if (ex < x0 - 3 || ex > x1 + 3) return;
        var dy = (e.layer === 'emotion' || e.layer === 'insight' || e.layer === 'thought') ? -Math.min(laneH * 0.36, 6) : Math.min(laneH * 0.36, 6);
        var ny = y + dy, col = LAYER_COLOR[e.layer] || '#cfd6e6';
        ctx.globalAlpha = 0.4 * dim; ctx.beginPath(); ctx.moveTo(ex, y); ctx.lineTo(ex, ny); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
        ctx.globalAlpha = dim; ctx.beginPath(); ctx.arc(ex, ny, 2, 0, 6.283); ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
        S._nodes.push({ x: ex, y: ny, r: 2, e: e, row: i });
      });
      S._lanes.push({ row: i, y: y, user: u, cs: cs, ce: ce });
      // name gutter (desktop) / leader-only could be added on mobile
      if (!isMobile && laneH >= 10) {
        ctx.font = '9px Inter, system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillStyle = hov === i ? '#eaf6ff' : 'rgba(160,175,195,' + (0.7 * dim) + ')';
        var tname = (u.name || '—'); if (tname.length > 16) tname = tname.slice(0, 15) + '…';
        ctx.fillText(tname, x0 - 6, y);
      }
    }
    ctx.textBaseline = 'alphabetic';

    // External Field overlay tracks
    S._ovNodes = [];
    if (hasOv) {
      ctx.beginPath(); ctx.moveTo(x0 - 6, ovTop - 6); ctx.lineTo(x1 + 6, ovTop - 6); ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.stroke();
      var tH = (fullBot - ovTop) / activeExt.length;
      activeExt.forEach(function (lk, li) {
        var cyT = ovTop + tH * li + tH / 2;
        ctx.beginPath(); ctx.moveTo(x0, cyT); ctx.lineTo(x1, cyT); ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(160,175,195,0.8)';
        ctx.fillText(EXT_ICON[lk] + '', isMobile ? 2 : (x0 - 120), cyT);
        (S.data.external_overlays[lk] || []).forEach(function (ev) {
          var mx = sx(ev.t); if (mx < x0 - 3 || mx > x1 + 3) return;
          var col = extColor(lk, ev.severity);
          ctx.beginPath(); ctx.arc(mx, cyT, 3, 0, 6.283); ctx.fillStyle = col; ctx.fill();
          S._ovNodes.push({ x: mx, y: cyT, ev: ev, layer: lk, color: col });
        });
      });
      ctx.textBaseline = 'alphabetic';
    }

    // bottom time axis
    drawTimeAxis(ctx, view, sx, x0, x1, H - padBot + 4, lang);
  }

  function drawTimeAxis(ctx, view, sx, x0, x1, y, lang) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.font = '9px Inter, system-ui, sans-serif'; ctx.fillStyle = 'rgba(150,165,185,0.8)'; ctx.textAlign = 'center';
    var span = (x1 - x0) / view.pxPerDay;           // days visible
    var stepDays = span > 720 ? 180 : span > 180 ? 30 : span > 40 ? 7 : 1;
    var loc = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'ru-RU';
    var startT = view.originT + (x0 - view.panX - x0) / view.pxPerDay * DAY;
    var t0 = Math.ceil((view.originT - startT) / (stepDays * DAY)) * 0; // simple ticks across range
    for (var gx = x0; gx <= x1; gx += Math.max(60, view.pxPerDay * stepDays)) {
      var t = view.originT + (gx - view.panX - x0) / view.pxPerDay * DAY;
      var lab = ''; try { lab = new Date(t).toLocaleDateString(loc, { day: 'numeric', month: 'short' }); } catch (e) {}
      ctx.fillText(lab, gx, y + 12);
    }
  }

  // ── side panel: combined visibility layers (personal + External Field) +
  // (superadmin) publish toggle. ──
  function renderSide(side, S, container, lang) {
    if (!side) return;
    var chk = function (on) { return on ? 'checked' : ''; };
    var dataRows = DATA_LAYERS.map(function (k) {
      return '<label class="cp-lyr"><input type="checkbox" data-layer="' + k + '" ' + chk(!S.hiddenLayers[k]) + '> ' + esc(T('a.evo.layer_' + k, k)) + '</label>';
    }).join('');
    var ovAvail = S.data.external_overlays || {};
    var extRows = EXT_LAYERS.map(function (k) {
      var has = (ovAvail[k] && ovAvail[k].length);
      return '<label class="cp-lyr" style="' + (has ? '' : 'opacity:0.5;') + '"><input type="checkbox" data-ext="' + k + '" ' + chk(!!S.extOn[k]) + '> ' + EXT_ICON[k] + ' ' + esc(T('tab.' + k, k)) + '</label>';
    }).join('');
    var pub = '';
    if (S.data.is_superadmin) {
      pub = '<div style="margin-top:0.9rem;padding-top:0.7rem;border-top:1px solid rgba(255,255,255,0.08);">' +
        '<label class="cp-lyr" style="font-weight:600;"><input type="checkbox" id="cp-publish" ' + chk(S.data.published) + '> ' + esc(T('a.evo.publish', 'Опубликовать для всех пользователей')) + '</label></div>';
    }
    side.innerHTML =
      '<div style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim,#89a);margin-bottom:0.5rem;">' + esc(T('a.evo.layers', 'Слои')) + '</div>' +
      dataRows +
      '<div style="height:0.5rem;"></div>' + extRows + pub +
      '<div style="margin-top:0.8rem;font-size:11px;color:var(--text-muted,#789);">' + esc(T('a.evo.users_count', 'Участников')) + ': ' + ((S.data.users || []).length) + '</div>';

    side.querySelectorAll('input[data-layer]').forEach(function (cb) { cb.addEventListener('change', function () { S.hiddenLayers[cb.getAttribute('data-layer')] = !cb.checked; draw(S, container, lang); }); });
    side.querySelectorAll('input[data-ext]').forEach(function (cb) { cb.addEventListener('change', function () {
      S.extOn[cb.getAttribute('data-ext')] = cb.checked; S.view = S.view; // keep view
      // need overlay data for newly-enabled layer → refetch
      window.mountCollectivePath(container);
    }); });
    var pubCb = side.querySelector('#cp-publish');
    if (pubCb) pubCb.addEventListener('change', function () {
      var token = localStorage.getItem('na_token');
      fetch((window.AUTH_API || '') + '/api/admin/collective-path/publish', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ published: pubCb.checked }) })
        .then(function (r) { return r.json(); }).then(function (d) { if (d && d.ok) S.data.published = d.published; }).catch(function () {});
    });
  }

  // ── interactions: ctrl+wheel zoom, wheel/drag pan, hover, click drill-down ──
  function wire(cv, S, container, lang) {
    var st = { drag: false, lastX: 0, lastY: 0, moved: false };
    function rl(cx) { var r = cv.getBoundingClientRect(); return cx - r.left; }
    function rt(cy) { var r = cv.getBoundingClientRect(); return cy - r.top; }
    function clampPan() { var v = S.view; if (!v) return; if (v.panX > (S._x1 - S._x0) * 0.4) v.panX = (S._x1 - S._x0) * 0.4; }
    cv.addEventListener('wheel', function (e) {
      e.preventDefault(); var v = S.view; if (!v) return;
      if (e.ctrlKey || e.metaKey) {
        var ax = rl(e.clientX), tU = v.originT + (ax - v.panX - S._x0) / v.pxPerDay * DAY;
        v.pxPerDay = Math.max(MIN_PXPD, Math.min(MAX_PXPD, v.pxPerDay * Math.pow(1.0015, -e.deltaY)));
        v.panX = ax - S._x0 - (tU - v.originT) / DAY * v.pxPerDay;
      } else { v.panX -= (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY); }
      clampPan(); draw(S, container, lang);
    }, { passive: false });
    cv.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') return; st.drag = true; st.moved = false; st.lastX = e.clientX; st.lastY = e.clientY; cv.style.cursor = 'grabbing'; try { cv.setPointerCapture(e.pointerId); } catch (er) {} });
    cv.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      if (st.drag) { var dx = e.clientX - st.lastX, dy = e.clientY - st.lastY; st.lastX = e.clientX; st.lastY = e.clientY; if (Math.abs(dx) + Math.abs(dy) > 2) st.moved = true; if (S.view) S.view.panX += dx; clampPan(); draw(S, container, lang); return; }
      // hover lane
      var ly = rt(e.clientY), row = laneAt(S, ly), changed = row !== S._hoverRow; S._hoverRow = row;
      cv.style.cursor = row != null ? 'pointer' : 'grab';
      if (changed) draw(S, container, lang);
    });
    function endDrag(e) { if (e.pointerType === 'touch') return; if (!st.drag) return; st.drag = false; cv.style.cursor = 'grab'; if (!st.moved) hitTest(rl(e.clientX), rt(e.clientY)); }
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointerleave', function () { if (S._hoverRow != null) { S._hoverRow = null; draw(S, container, lang); } });
    // touch
    var tg = { mode: null, lastMid: 0, startDist: 0, startPx: 0, moved: false, lastX: 0 };
    function tDist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    cv.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) { e.preventDefault(); tg.mode = 'pinch'; tg.startDist = tDist(e.touches) || 1; tg.startPx = S.view.pxPerDay; tg.lastMid = (e.touches[0].clientX + e.touches[1].clientX) / 2; }
      else if (e.touches.length === 1) { tg.mode = 'pan'; tg.lastX = e.touches[0].clientX; tg.moved = false; }
    }, { passive: false });
    cv.addEventListener('touchmove', function (e) {
      var v = S.view; if (!v) return;
      if (tg.mode === 'pinch' && e.touches.length === 2) { e.preventDefault(); var d = tDist(e.touches) || 1, mid = (e.touches[0].clientX + e.touches[1].clientX) / 2; var r = cv.getBoundingClientRect(); var ax = mid - r.left; var tU = v.originT + (ax - v.panX - S._x0) / v.pxPerDay * DAY; v.pxPerDay = Math.max(MIN_PXPD, Math.min(MAX_PXPD, tg.startPx * (d / tg.startDist))); v.panX = ax - S._x0 - (tU - v.originT) / DAY * v.pxPerDay; v.panX += (mid - tg.lastMid); tg.lastMid = mid; clampPan(); draw(S, container, lang); }
      else if (tg.mode === 'pan' && e.touches.length === 1) { e.preventDefault(); var x = e.touches[0].clientX, dx = x - tg.lastX; tg.lastX = x; if (Math.abs(dx) > 2) tg.moved = true; v.panX += dx; clampPan(); draw(S, container, lang); }
    }, { passive: false });
    cv.addEventListener('touchend', function (e) {
      if (tg.mode === 'pan' && !tg.moved) { var ct = e.changedTouches && e.changedTouches[0]; if (ct) { var r = cv.getBoundingClientRect(); hitTest(ct.clientX - r.left, ct.clientY - r.top); } }
      if (e.touches.length === 0) tg.mode = null;
    }, { passive: false });

    function hitTest(lx, ly) {
      // External Field marker → detail card
      var ov = S._ovNodes || [];
      for (var o = 0; o < ov.length; o++) { if (Math.hypot(ov[o].x - lx, ov[o].y - ly) < 12) { showCard(S, ov[o], lang); return; } }
      // lane → drill-down (superadmin opens that user's profile)
      var row = laneAt(S, ly); if (row == null) return;
      var u = (S.order || [])[row]; if (!u) return;
      if (S.data.is_superadmin) {
        try { window.open('/account.html?tab=profile&userId=' + encodeURIComponent(u.id), '_blank'); } catch (e) {}
      } else { showUserCard(S, u, lang); }
    }
  }

  function laneAt(S, ly) {
    if (ly == null || S._laneH == null || ly < 16 || ly > S._spinesBot) return null;
    var row = Math.floor((ly - 16) / S._laneH);
    if (row < 0 || row >= (S.order || []).length) return null;
    return row;
  }

  function showCard(S, marker, lang) {
    var host = S._host; var old = host.querySelector('.cp-pop'); if (old) old.remove();
    var ev = marker.ev;
    var when = ''; try { when = new Date(ev.t).toLocaleString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
    var d = document.createElement('div'); d.className = 'cp-pop';
    d.style.cssText = 'position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:20;max-width:300px;background:rgba(12,15,20,0.97);border:1px solid ' + marker.color + '55;border-radius:10px;padding:0.7rem 0.9rem;';
    d.innerHTML = '<div style="font-size:11px;text-transform:uppercase;color:' + marker.color + ';">' + (EXT_ICON[marker.layer] || '') + ' ' + esc(marker.layer) + (ev.severity ? ' · ' + esc(String(ev.severity)) : '') + '</div>' +
      '<div style="font-size:13px;color:#cdd;font-weight:600;margin:0.3rem 0 0.2rem;">' + esc(ev.title || marker.layer) + '</div>' +
      '<div style="font-size:11px;color:#789;font-family:monospace;">' + esc(when) + '</div>' +
      '<button class="cp-x" style="position:absolute;top:6px;right:8px;background:none;border:none;color:#89a;cursor:pointer;">✕</button>';
    host.appendChild(d); d.querySelector('.cp-x').addEventListener('click', function () { d.remove(); });
  }
  function showUserCard(S, u, lang) {
    var host = S._host; var old = host.querySelector('.cp-pop'); if (old) old.remove();
    var d = document.createElement('div'); d.className = 'cp-pop';
    d.style.cssText = 'position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:20;background:rgba(12,15,20,0.97);border:1px solid rgba(120,200,255,0.4);border-radius:10px;padding:0.6rem 0.9rem;';
    d.innerHTML = '<div style="font-size:13px;color:#cdd;font-weight:600;">' + esc(u.name || '—') + '</div>' +
      '<div style="font-size:11px;color:#789;">' + ((u.events || []).length) + ' ' + esc(T('a.evo.events', 'событий')) + '</div>';
    host.appendChild(d); setTimeout(function () { if (d.parentNode) d.remove(); }, 2200);
  }

  window.mountCollectivePath = window.mountCollectivePath; // exported above
})();
