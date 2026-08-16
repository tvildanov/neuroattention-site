/**
 * Sketch / Скетч / Boceto — layers + drawing over BodyAtlas / screenshots.
 * Brief: docs/SKETCH-BRIEF.md · nick-handoff §6
 */
(function () {
  'use strict';

  var COLORS = ['#e8edf2', '#0ef', '#0e9', '#fc0', '#f6a', '#a8f', '#f44', '#222', '#fff', '#000'];
  var BRUSHES = [
    { id: 'pen', label: 'Ручка', size: 2.5, opacity: 1, kind: 'solid' },
    { id: 'marker', label: 'Фломастер', size: 10, opacity: 1, kind: 'solid' },
    { id: 'highlighter', label: 'Маркер', size: 18, opacity: 0.35, kind: 'solid' },
    { id: 'pencil', label: 'Карандаш', size: 3.5, opacity: 0.72, kind: 'pencil' },
    { id: 'eraser', label: 'Ластик', size: 16, opacity: 1, kind: 'eraser' }
  ];
  var UNDO_MAX = 50;
  var pendingOpen = null;

  var state = {
    mounted: false,
    host: null,
    tool: 'pen',
    color: COLORS[0],
    size: 2.5,
    opacity: 1,
    drawing: false,
    current: null,
    interaction: 'draw', // draw | orbit
    viewMode: '3d', // 3d | 2d
    activeDraw: 'd0',
    layerOrder: ['bg', 'media', 'd0', 'd1', 'd2'],
    layers: {
      bg: { id: 'bg', kind: 'bg', visible: true, opacity: 1, color: '#0b1016' },
      media: { id: 'media', kind: 'media', visible: true, opacity: 1, tint: null, imageDataUrl: null, maskStrokes: [] },
      d0: { id: 'd0', kind: 'draw', visible: true, opacity: 1, strokes: [] },
      d1: { id: 'd1', kind: 'draw', visible: true, opacity: 1, strokes: [] },
      d2: { id: 'd2', kind: 'draw', visible: true, opacity: 1, strokes: [] }
    },
    undoStack: [],
    redoStack: [],
    sketches: [],
    templates: [],
    currentId: null,
    dirty: false,
    atlas: null,
    atlasMounting: false,
    isSuperadmin: false
  };

  function t(k, f) {
    try { if (typeof window.t === 'function') return window.t(k, f); } catch (e) {}
    return f || k;
  }
  function apiBase() {
    return window.AUTH_API || window.API_BASE || 'https://neuroattention-api-production.up.railway.app';
  }
  function token() {
    if (typeof window.naGetToken === 'function') return window.naGetToken();
    try { return localStorage.getItem('na_token'); } catch (e) { return null; }
  }
  function headers(json) {
    var h = { Accept: 'application/json' };
    if (json) h['Content-Type'] = 'application/json';
    var tok = token();
    if (tok) h.Authorization = 'Bearer ' + tok;
    return h;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function deepClone(o) {
    try { return JSON.parse(JSON.stringify(o)); } catch (e) { return o; }
  }
  function setStatus(msg) {
    var el = document.getElementById('sketch-status');
    if (el) el.textContent = msg || '';
  }
  function isPrivilegedUser() {
    try {
      if (typeof currentUser !== 'undefined' && currentUser) {
        var r = currentUser.serverRole || currentUser.role;
        if (r === 'superadmin' || r === 'founder') return true;
      }
      var u = window.NA_USER || window.currentUser || null;
      if (u && (u.role === 'superadmin' || u.role === 'founder' || u.serverRole === 'superadmin')) return true;
      if (window.NA_IS_SUPERADMIN || window.isSuperadmin) return true;
    } catch (e) {}
    return !!state.isSuperadmin;
  }

  function stage() { return document.getElementById('sketch-stage'); }
  function drawCanvas(id) { return document.getElementById('sketch-cv-' + id); }
  function mediaMask() { return document.getElementById('sketch-cv-media-mask'); }
  function mediaImg() { return document.getElementById('sketch-media-img'); }

  function pushUndo() {
    var snap = {
      d0: deepClone(state.layers.d0.strokes),
      d1: deepClone(state.layers.d1.strokes),
      d2: deepClone(state.layers.d2.strokes),
      mask: deepClone(state.layers.media.maskStrokes)
    };
    state.undoStack.push(snap);
    if (state.undoStack.length > UNDO_MAX) state.undoStack.shift();
    state.redoStack = [];
  }

  function applySnap(snap) {
    if (!snap) return;
    state.layers.d0.strokes = deepClone(snap.d0) || [];
    state.layers.d1.strokes = deepClone(snap.d1) || [];
    state.layers.d2.strokes = deepClone(snap.d2) || [];
    state.layers.media.maskStrokes = deepClone(snap.mask) || [];
    redrawAll();
  }

  function undo() {
    if (!state.undoStack.length) return;
    var cur = {
      d0: deepClone(state.layers.d0.strokes),
      d1: deepClone(state.layers.d1.strokes),
      d2: deepClone(state.layers.d2.strokes),
      mask: deepClone(state.layers.media.maskStrokes)
    };
    state.redoStack.push(cur);
    applySnap(state.undoStack.pop());
    state.dirty = true;
    setStatus(t('a.sketch.unsaved', 'Не сохранено'));
  }

  function redo() {
    if (!state.redoStack.length) return;
    var cur = {
      d0: deepClone(state.layers.d0.strokes),
      d1: deepClone(state.layers.d1.strokes),
      d2: deepClone(state.layers.d2.strokes),
      mask: deepClone(state.layers.media.maskStrokes)
    };
    state.undoStack.push(cur);
    applySnap(state.redoStack.pop());
    state.dirty = true;
    setStatus(t('a.sketch.unsaved', 'Не сохранено'));
  }

  function brushMeta(id) {
    for (var i = 0; i < BRUSHES.length; i++) if (BRUSHES[i].id === id) return BRUSHES[i];
    return BRUSHES[0];
  }

  function hexToRgba(hex, a) {
    var h = String(hex || '#fff').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (!Number.isFinite(n)) return 'rgba(255,255,255,' + a + ')';
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function drawStrokeOnCtx(ctx, s) {
    if (!ctx || !s || !s.points || !s.points.length) return;
    var op = (s.opacity != null ? s.opacity : 1);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = s.size || 3;
    if (s.tool === 'eraser' || s.kind === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.globalAlpha = 1;
    } else if (s.kind === 'pencil') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = op;
      ctx.strokeStyle = hexToRgba(s.color || '#fff', 0.55);
      // textured: slightly jittered second pass
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (var i = 1; i < s.points.length; i++) {
        var jx = (Math.sin(i * 12.9898) * 0.6);
        var jy = (Math.cos(i * 78.233) * 0.6);
        ctx.lineTo(s.points[i].x + jx, s.points[i].y + jy);
      }
      ctx.stroke();
      ctx.strokeStyle = hexToRgba(s.color || '#fff', 0.85);
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = op;
      ctx.strokeStyle = s.color || '#fff';
    }
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (var k = 1; k < s.points.length; k++) ctx.lineTo(s.points[k].x, s.points[k].y);
    if (s.points.length === 1) {
      ctx.arc(s.points[0].x, s.points[0].y, (s.size || 3) / 2, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    } else {
      ctx.stroke();
    }
    ctx.restore();
  }

  function resizeOneCanvas(c, w, h) {
    if (!c) return;
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.floor(w * ratio);
    c.height = Math.floor(h * ratio);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    var ctx = c.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function stageSize() {
    var st = stage();
    if (!st) return { w: 640, h: 420 };
    var w = Math.max(280, st.clientWidth || 640);
    var h = Math.max(320, Math.min(640, Math.round(w * 0.68)));
    return { w: w, h: h };
  }

  function resizeAll() {
    var sz = stageSize();
    var st = stage();
    if (st) st.style.height = sz.h + 'px';
    ['d0', 'd1', 'd2'].forEach(function (id) { resizeOneCanvas(drawCanvas(id), sz.w, sz.h); });
    resizeOneCanvas(mediaMask(), sz.w, sz.h);
    var host3d = document.getElementById('sketch-3d-host');
    if (host3d) {
      host3d.style.width = '100%';
      host3d.style.height = sz.h + 'px';
    }
    redrawAll();
    if (state.atlas && state.atlas.renderer && state.atlas._onResize) {
      try { state.atlas._onResize(); } catch (e) {}
    } else if (state.atlas && state.atlas.renderer) {
      try {
        var r = state.atlas.renderer;
        var cam = state.atlas.camera;
        r.setSize(sz.w, sz.h, false);
        if (cam) { cam.aspect = sz.w / Math.max(1, sz.h); cam.updateProjectionMatrix(); }
        if (state.atlas._requestRender) state.atlas._requestRender();
      } catch (e2) {}
    }
    applyLayerVisibility();
  }

  function redrawLayer(id) {
    var c = drawCanvas(id);
    if (!c) return;
    var ctx = c.getContext('2d');
    var w = c.clientWidth, h = c.clientHeight;
    ctx.clearRect(0, 0, w, h);
    var layer = state.layers[id];
    if (!layer || !layer.visible) return;
    (layer.strokes || []).forEach(function (s) { drawStrokeOnCtx(ctx, s); });
    if (state.current && state.activeDraw === id) drawStrokeOnCtx(ctx, state.current);
    c.style.opacity = String(layer.opacity != null ? layer.opacity : 1);
  }

  function redrawMediaMask() {
    var c = mediaMask();
    if (!c) return;
    var ctx = c.getContext('2d');
    var w = c.clientWidth, h = c.clientHeight;
    ctx.clearRect(0, 0, w, h);
    (state.layers.media.maskStrokes || []).forEach(function (s) { drawStrokeOnCtx(ctx, s); });
    if (state.current && state.activeDraw === 'media') drawStrokeOnCtx(ctx, state.current);
  }

  function redrawAll() {
    redrawLayer('d0');
    redrawLayer('d1');
    redrawLayer('d2');
    redrawMediaMask();
    applyBg();
    applyMedia();
    applyLayerVisibility();
  }

  function applyBg() {
    var bg = document.getElementById('sketch-bg');
    var L = state.layers.bg;
    if (!bg || !L) return;
    bg.style.background = L.color || '#0b1016';
    bg.style.opacity = L.visible ? String(L.opacity != null ? L.opacity : 1) : '0';
  }

  function applyMedia() {
    var img = mediaImg();
    var wrap = document.getElementById('sketch-media-wrap');
    var L = state.layers.media;
    if (!wrap || !L) return;
    wrap.style.opacity = L.visible ? String(L.opacity != null ? L.opacity : 1) : '0';
    wrap.style.display = (L.imageDataUrl || state.viewMode === '2d') ? 'block' : (state.viewMode === '3d' ? 'none' : 'block');
    if (img) {
      if (L.imageDataUrl) {
        img.src = L.imageDataUrl;
        img.style.display = 'block';
      } else {
        img.removeAttribute('src');
        img.style.display = 'none';
      }
      if (L.tint) {
        img.style.filter = 'sepia(1) saturate(3) hue-rotate(' + (L.tint.hue || 160) + 'deg) opacity(0.85)';
      } else {
        img.style.filter = '';
      }
    }
    var host3d = document.getElementById('sketch-3d-host');
    if (host3d) {
      host3d.style.opacity = L.visible ? String(L.opacity != null ? L.opacity : 1) : '0';
      host3d.style.visibility = (state.viewMode === '3d') ? 'visible' : 'hidden';
      host3d.style.pointerEvents = (state.viewMode === '3d' && state.interaction === 'orbit') ? 'auto' : 'none';
    }
  }

  function applyLayerVisibility() {
    state.layerOrder.forEach(function (id, idx) {
      var z = 10 + idx;
      if (id === 'bg') {
        var bg = document.getElementById('sketch-bg');
        if (bg) bg.style.zIndex = String(z);
      } else if (id === 'media') {
        var mw = document.getElementById('sketch-media-wrap');
        var h3 = document.getElementById('sketch-3d-host');
        if (mw) mw.style.zIndex = String(z);
        if (h3) h3.style.zIndex = String(z);
        var mm = mediaMask();
        if (mm) {
          mm.style.zIndex = String(z + 1);
          mm.style.pointerEvents = (state.interaction === 'draw' && state.activeDraw === 'media') ? 'auto' : 'none';
          mm.style.visibility = state.layers.media.visible ? 'visible' : 'hidden';
        }
      } else {
        var c = drawCanvas(id);
        if (c) {
          c.style.zIndex = String(z + 2);
          c.style.visibility = state.layers[id].visible ? 'visible' : 'hidden';
          c.style.opacity = String(state.layers[id].opacity != null ? state.layers[id].opacity : 1);
          c.style.pointerEvents = (state.interaction === 'draw' && state.activeDraw === id) ? 'auto' : 'none';
        }
      }
    });
  }

  function posFromEvent(e, canvasEl) {
    var r = canvasEl.getBoundingClientRect();
    var src = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }

  function activeCanvas() {
    if (state.activeDraw === 'media') return mediaMask();
    return drawCanvas(state.activeDraw);
  }

  function startDraw(e) {
    if (state.interaction !== 'draw') return;
    var c = activeCanvas();
    if (!c) return;
    e.preventDefault();
    state.drawing = true;
    var bm = brushMeta(state.tool);
    var p = posFromEvent(e, c);
    state.current = {
      tool: state.tool,
      kind: bm.kind,
      color: state.color,
      size: state.size,
      opacity: state.opacity,
      points: [p]
    };
    if (state.activeDraw === 'media') redrawMediaMask();
    else redrawLayer(state.activeDraw);
  }

  function moveDraw(e) {
    if (!state.drawing || !state.current) return;
    var c = activeCanvas();
    if (!c) return;
    e.preventDefault();
    state.current.points.push(posFromEvent(e, c));
    if (state.activeDraw === 'media') redrawMediaMask();
    else redrawLayer(state.activeDraw);
  }

  function endDraw(e) {
    if (!state.drawing) return;
    if (e) e.preventDefault();
    state.drawing = false;
    if (state.current && state.current.points.length) {
      pushUndo();
      if (state.activeDraw === 'media') {
        // media eraser / tint strokes live on mask
        if (state.tool === 'eraser' || brushMeta(state.tool).kind === 'eraser') {
          state.layers.media.maskStrokes.push(state.current);
        } else {
          // tint brush on media: store as semi-transparent stroke on mask with source-over
          state.layers.media.maskStrokes.push(state.current);
        }
      } else {
        state.layers[state.activeDraw].strokes.push(state.current);
      }
      state.dirty = true;
      setStatus(t('a.sketch.unsaved', 'Не сохранено'));
    }
    state.current = null;
    redrawAll();
  }

  function destroyAtlas() {
    if (state.atlas && state.atlas.destroy) {
      try { state.atlas.destroy(); } catch (e) {}
    }
    state.atlas = null;
    state.atlasMounting = false;
    var host = document.getElementById('sketch-3d-host');
    if (host) host.innerHTML = '';
  }

  function ensureAtlas() {
    if (state.viewMode !== '3d') return Promise.resolve(null);
    if (state.atlas) return Promise.resolve(state.atlas);
    if (state.atlasMounting) return Promise.resolve(null);
    var host = document.getElementById('sketch-3d-host');
    if (!host || !window.BodyAtlas) {
      setStatus(t('a.sketch.no_atlas', '3D-Атлас недоступен'));
      return Promise.resolve(null);
    }
    state.atlasMounting = true;
    host.innerHTML = '';
    return window.BodyAtlas.init(host, { mode: 'sketch', preserveDrawingBuffer: true })
      .then(function (a) {
        state.atlas = a;
        state.atlasMounting = false;
        resizeAll();
        return a;
      })
      .catch(function (err) {
        state.atlasMounting = false;
        setStatus((err && err.message) || 'atlas error');
        return null;
      });
  }

  function setViewMode(mode) {
    state.viewMode = mode === '2d' ? '2d' : '3d';
    var b3 = document.getElementById('sketch-mode-3d');
    var b2 = document.getElementById('sketch-mode-2d');
    if (b3) b3.classList.toggle('active', state.viewMode === '3d');
    if (b2) b2.classList.toggle('active', state.viewMode === '2d');
    if (state.viewMode === '3d') ensureAtlas();
    else destroyAtlas();
    applyMedia();
    applyLayerVisibility();
  }

  function setInteraction(mode) {
    state.interaction = mode === 'orbit' ? 'orbit' : 'draw';
    var bd = document.getElementById('sketch-interact-draw');
    var bo = document.getElementById('sketch-interact-orbit');
    if (bd) bd.classList.toggle('active', state.interaction === 'draw');
    if (bo) bo.classList.toggle('active', state.interaction === 'orbit');
    applyMedia();
    applyLayerVisibility();
  }

  function scenePayload() {
    return {
      version: 1,
      viewMode: state.viewMode,
      layerOrder: state.layerOrder.slice(),
      layers: {
        bg: { visible: state.layers.bg.visible, opacity: state.layers.bg.opacity, color: state.layers.bg.color },
        media: {
          visible: state.layers.media.visible,
          opacity: state.layers.media.opacity,
          tint: state.layers.media.tint,
          imageDataUrl: state.layers.media.imageDataUrl,
          maskStrokes: state.layers.media.maskStrokes
        },
        d0: { visible: state.layers.d0.visible, opacity: state.layers.d0.opacity, strokes: state.layers.d0.strokes },
        d1: { visible: state.layers.d1.visible, opacity: state.layers.d1.opacity, strokes: state.layers.d1.strokes },
        d2: { visible: state.layers.d2.visible, opacity: state.layers.d2.opacity, strokes: state.layers.d2.strokes }
      }
    };
  }

  function loadScene(scene, strokesFallback) {
    var sc = scene || {};
    if (sc.viewMode) setViewMode(sc.viewMode);
    if (Array.isArray(sc.layerOrder) && sc.layerOrder.length === 5) state.layerOrder = sc.layerOrder.slice();
    var L = sc.layers || {};
    ['bg', 'media', 'd0', 'd1', 'd2'].forEach(function (id) {
      if (!L[id]) return;
      Object.keys(L[id]).forEach(function (k) {
        if (k === 'imageDataUrl' && L[id][k] && String(L[id][k]).length > 3_500_000) return;
        state.layers[id][k] = deepClone(L[id][k]);
      });
    });
    // legacy: flat strokes → d0
    if ((!state.layers.d0.strokes || !state.layers.d0.strokes.length) && Array.isArray(strokesFallback) && strokesFallback.length) {
      state.layers.d0.strokes = deepClone(strokesFallback);
    }
    state.undoStack = [];
    state.redoStack = [];
    redrawAll();
    renderLayersPanel();
  }

  function bakePng() {
    var sz = stageSize();
    var out = document.createElement('canvas');
    out.width = sz.w;
    out.height = sz.h;
    var ctx = out.getContext('2d');
    // bg
    if (state.layers.bg.visible) {
      ctx.globalAlpha = state.layers.bg.opacity != null ? state.layers.bg.opacity : 1;
      ctx.fillStyle = state.layers.bg.color || '#0b1016';
      ctx.fillRect(0, 0, sz.w, sz.h);
      ctx.globalAlpha = 1;
    }
    // media / atlas screenshot
    if (state.layers.media.visible) {
      ctx.globalAlpha = state.layers.media.opacity != null ? state.layers.media.opacity : 1;
      var drew = false;
      if (state.viewMode === '3d' && state.atlas && state.atlas.screenshot) {
        var shot = state.atlas.screenshot('image/png');
        if (shot) {
          // sync draw via temporary image is async — use WebGL canvas directly
          try {
            ctx.drawImage(state.atlas.renderer.domElement, 0, 0, sz.w, sz.h);
            drew = true;
          } catch (e) {}
        }
      }
      var img = mediaImg();
      if (!drew && img && img.complete && img.naturalWidth) {
        try { ctx.drawImage(img, 0, 0, sz.w, sz.h); drew = true; } catch (e2) {}
      }
      var mm = mediaMask();
      if (mm) try { ctx.drawImage(mm, 0, 0, sz.w, sz.h); } catch (e3) {}
      ctx.globalAlpha = 1;
    }
    state.layerOrder.forEach(function (id) {
      if (id === 'bg' || id === 'media') return;
      var L = state.layers[id];
      if (!L || !L.visible) return;
      var c = drawCanvas(id);
      if (!c) return;
      ctx.globalAlpha = L.opacity != null ? L.opacity : 1;
      try { ctx.drawImage(c, 0, 0, sz.w, sz.h); } catch (e4) {}
      ctx.globalAlpha = 1;
    });
    try {
      var png = out.toDataURL('image/png');
      if (png && png.length < 3_000_000) return png;
    } catch (e5) {}
    return null;
  }

  function flatStrokesForLegacy() {
    // keep API strokes field as merged draw layers for old clients
    return []
      .concat(state.layers.d0.strokes || [])
      .concat(state.layers.d1.strokes || [])
      .concat(state.layers.d2.strokes || []);
  }

  async function saveSketch(opts) {
    opts = opts || {};
    var titleEl = document.getElementById('sketch-title');
    var title = (titleEl && titleEl.value.trim()) || t('a.sketch.untitled', 'Без названия');
    var png = bakePng();
    var body = {
      id: state.currentId || undefined,
      title: title,
      strokes: flatStrokesForLegacy(),
      scene: scenePayload(),
      png_data_url: png,
      is_template: !!opts.asTemplate
    };
    setStatus(t('a.sketch.saving', 'Сохраняю…'));
    try {
      var res = await fetch(apiBase() + '/api/sketches', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify(body)
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
      state.currentId = data.sketch && data.sketch.id;
      state.dirty = false;
      setStatus(t('a.sketch.saved', 'Сохранено'));
      loadList();
      loadTemplates();
    } catch (err) {
      setStatus((err && err.message) || 'error');
    }
  }

  async function publishTemplate(id) {
    if (!id) id = state.currentId;
    if (!id) { setStatus(t('a.sketch.save_first', 'Сначала сохраните')); return; }
    try {
      var res = await fetch(apiBase() + '/api/sketches/' + encodeURIComponent(id) + '/publish', {
        method: 'POST',
        headers: headers(true),
        body: '{}'
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'publish failed');
      setStatus(t('a.sketch.published', 'Опубликовано в общие'));
      loadTemplates();
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function loadList() {
    var host = document.getElementById('sketch-list');
    if (!host) return;
    try {
      var res = await fetch(apiBase() + '/api/sketches', { headers: headers(false) });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'load failed');
      state.sketches = data.sketches || [];
      if (!state.sketches.length) {
        host.innerHTML = '<p class="monad-muted">' + t('a.sketch.empty', 'Пока нет сохранённых скетчей') + '</p>';
        return;
      }
      host.innerHTML = state.sketches.map(function (s) {
        var when = '';
        try { when = new Date(s.updated_at || s.created_at).toLocaleString(); } catch (e) {}
        var badge = s.is_public ? ' · public' : (s.is_template ? ' · template' : '');
        return '<button type="button" class="sketch-list-item" data-id="' + s.id + '">' +
          '<span class="sketch-list-title">' + esc(s.title || '—') + '</span>' +
          '<span class="sketch-list-meta">' + esc(when + badge) + '</span></button>';
      }).join('');
      host.querySelectorAll('.sketch-list-item').forEach(function (btn) {
        btn.addEventListener('click', function () { openSketch(btn.getAttribute('data-id')); });
      });
    } catch (err) {
      host.innerHTML = '<p class="monad-warn">' + esc(err.message) + '</p>';
    }
  }

  async function loadTemplates() {
    var host = document.getElementById('sketch-templates');
    if (!host) return;
    try {
      var res = await fetch(apiBase() + '/api/sketches/templates', { headers: headers(false) });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'templates failed');
      state.templates = data.templates || [];
      if (!state.templates.length) {
        host.innerHTML = '<p class="monad-muted">' + t('a.sketch.no_templates', 'Нет шаблонов') + '</p>';
        return;
      }
      host.innerHTML = state.templates.map(function (s) {
        var scope = s.is_public ? t('a.sketch.public', 'Общий') : t('a.sketch.mine', 'Мой');
        return '<button type="button" class="sketch-list-item" data-tid="' + s.id + '">' +
          '<span class="sketch-list-title">' + esc(s.title || '—') + '</span>' +
          '<span class="sketch-list-meta">' + esc(scope) + '</span></button>';
      }).join('');
      host.querySelectorAll('[data-tid]').forEach(function (btn) {
        btn.addEventListener('click', function () { openSketch(btn.getAttribute('data-tid'), { asCopy: true }); });
      });
    } catch (err) {
      host.innerHTML = '<p class="monad-warn">' + esc(err.message) + '</p>';
    }
  }

  async function openSketch(id, opts) {
    opts = opts || {};
    try {
      var res = await fetch(apiBase() + '/api/sketches/' + encodeURIComponent(id), { headers: headers(false) });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'open failed');
      var s = data.sketch;
      state.currentId = opts.asCopy ? null : s.id;
      loadScene(s.scene, s.strokes);
      if (state.viewMode === '3d') await ensureAtlas();
      var titleEl = document.getElementById('sketch-title');
      if (titleEl) titleEl.value = opts.asCopy ? ((s.title || '') + ' (копия)') : (s.title || '');
      state.dirty = !!opts.asCopy;
      setStatus(t('a.sketch.loaded', 'Открыто'));
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function deleteCurrent() {
    if (!state.currentId) { resetBoard(true); return; }
    if (!window.confirm(t('a.sketch.delete_confirm', 'Удалить этот скетч?'))) return;
    try {
      var res = await fetch(apiBase() + '/api/sketches/' + encodeURIComponent(state.currentId), {
        method: 'DELETE',
        headers: headers(false)
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'delete failed');
      state.currentId = null;
      resetBoard(false);
      setStatus(t('a.sketch.deleted', 'Удалено'));
      loadList();
    } catch (err) {
      setStatus(err.message);
    }
  }

  function resetBoard(ask) {
    if (ask && state.dirty && !window.confirm(t('a.sketch.clear_confirm', 'Очистить холст?'))) return;
    state.layers.d0.strokes = [];
    state.layers.d1.strokes = [];
    state.layers.d2.strokes = [];
    state.layers.media.maskStrokes = [];
    state.layers.media.imageDataUrl = null;
    state.layers.media.tint = null;
    state.current = null;
    state.currentId = null;
    state.undoStack = [];
    state.redoStack = [];
    state.dirty = false;
    var titleEl = document.getElementById('sketch-title');
    if (titleEl) titleEl.value = '';
    redrawAll();
  }

  function exportPng() {
    var png = bakePng();
    if (!png) { setStatus(t('a.sketch.export_fail', 'Не удалось экспортировать')); return; }
    var a = document.createElement('a');
    a.href = png;
    a.download = ((document.getElementById('sketch-title') || {}).value || 'sketch').replace(/[^\w\-]+/g, '_').slice(0, 40) + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus(t('a.sketch.exported', 'PNG скачан'));
  }

  function moveLayer(id, dir) {
    var order = state.layerOrder.slice();
    var i = order.indexOf(id);
    if (i < 0) return;
    var j = i + dir;
    if (j < 0 || j >= order.length) return;
    var tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
    state.layerOrder = order;
    applyLayerVisibility();
    renderLayersPanel();
    state.dirty = true;
  }

  function renderLayersPanel() {
    var host = document.getElementById('sketch-layers-panel');
    if (!host) return;
    var labels = {
      bg: t('a.sketch.layer_bg', '1 · Фон'),
      media: t('a.sketch.layer_model', '2 · Модель / изображение'),
      d0: t('a.sketch.layer_d1', '3 · Рисунок 1'),
      d1: t('a.sketch.layer_d2', '4 · Рисунок 2'),
      d2: t('a.sketch.layer_d3', '5 · Рисунок 3')
    };
    // display top-most first
    var order = state.layerOrder.slice().reverse();
    host.innerHTML = order.map(function (id) {
      var L = state.layers[id];
      var active = (id === state.activeDraw) || (id === 'media' && state.activeDraw === 'media');
      var selectable = id === 'media' || id === 'd0' || id === 'd1' || id === 'd2';
      return '<div class="sketch-layer-card' + (active && selectable ? ' active' : '') + '" data-layer="' + id + '">' +
        '<div class="sketch-layer-top">' +
          '<label><input type="checkbox" data-vis="' + id + '"' + (L.visible ? ' checked' : '') + '> ' + esc(labels[id] || id) + '</label>' +
          '<span class="sketch-layer-move">' +
            '<button type="button" data-up="' + id + '" title="Выше">↑</button>' +
            '<button type="button" data-down="' + id + '" title="Ниже">↓</button>' +
          '</span>' +
        '</div>' +
        (id === 'bg'
          ? '<label class="sketch-size-label">Цвет <input type="color" data-bgcolor value="' + esc(L.color || '#0b1016') + '"></label>'
          : '') +
        '<label class="sketch-size-label">Opacity <input type="range" min="0" max="100" data-op="' + id + '" value="' + Math.round((L.opacity != null ? L.opacity : 1) * 100) + '"></label>' +
        (selectable ? '<button type="button" class="btn btn-ghost sketch-layer-select" data-select="' + id + '">' + t('a.sketch.draw_here', 'Рисовать здесь') + '</button>' : '') +
      '</div>';
    }).join('');

    host.querySelectorAll('[data-vis]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = cb.getAttribute('data-vis');
        state.layers[id].visible = !!cb.checked;
        redrawAll();
        state.dirty = true;
      });
    });
    host.querySelectorAll('[data-op]').forEach(function (r) {
      r.addEventListener('input', function () {
        var id = r.getAttribute('data-op');
        state.layers[id].opacity = Math.max(0, Math.min(1, (parseInt(r.value, 10) || 0) / 100));
        redrawAll();
        state.dirty = true;
      });
    });
    host.querySelectorAll('[data-bgcolor]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        state.layers.bg.color = inp.value;
        applyBg();
        state.dirty = true;
      });
    });
    host.querySelectorAll('[data-up]').forEach(function (b) {
      b.addEventListener('click', function () { moveLayer(b.getAttribute('data-up'), 1); });
    });
    host.querySelectorAll('[data-down]').forEach(function (b) {
      b.addEventListener('click', function () { moveLayer(b.getAttribute('data-down'), -1); });
    });
    host.querySelectorAll('[data-select]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.activeDraw = b.getAttribute('data-select');
        setInteraction('draw');
        renderLayersPanel();
        applyLayerVisibility();
      });
    });

    var pub = document.getElementById('sketch-publish');
    if (pub) pub.style.display = isPrivilegedUser() ? '' : 'none';
  }

  function wireToolbar() {
    document.querySelectorAll('[data-sketch-tool]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.tool = b.getAttribute('data-sketch-tool');
        var bm = brushMeta(state.tool);
        state.size = bm.size;
        state.opacity = bm.opacity;
        var size = document.getElementById('sketch-size');
        var op = document.getElementById('sketch-opacity');
        if (size) size.value = String(state.size);
        if (op) op.value = String(Math.round(state.opacity * 100));
        document.querySelectorAll('[data-sketch-tool]').forEach(function (x) {
          x.classList.toggle('active', x === b);
        });
      });
    });
    var colors = document.getElementById('sketch-colors');
    if (colors) {
      colors.innerHTML = COLORS.map(function (c) {
        return '<button type="button" class="sketch-color' + (c === state.color ? ' active' : '') +
          '" data-color="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
      }).join('');
      colors.querySelectorAll('.sketch-color').forEach(function (b) {
        b.addEventListener('click', function () {
          state.color = b.getAttribute('data-color');
          if (state.tool === 'eraser') state.tool = 'pen';
          document.querySelectorAll('[data-sketch-tool]').forEach(function (x) {
            x.classList.toggle('active', x.getAttribute('data-sketch-tool') === state.tool);
          });
          colors.querySelectorAll('.sketch-color').forEach(function (x) {
            x.classList.toggle('active', x === b);
          });
        });
      });
    }
    var size = document.getElementById('sketch-size');
    if (size) {
      size.value = String(state.size);
      size.addEventListener('input', function () { state.size = parseFloat(size.value) || 3; });
    }
    var op = document.getElementById('sketch-opacity');
    if (op) {
      op.value = String(Math.round(state.opacity * 100));
      op.addEventListener('input', function () { state.opacity = Math.max(0.05, Math.min(1, (parseInt(op.value, 10) || 100) / 100)); });
    }

    var map = {
      'sketch-undo': undo,
      'sketch-redo': redo,
      'sketch-clear': function () { resetBoard(true); },
      'sketch-save': function () { saveSketch({}); },
      'sketch-save-template': function () { saveSketch({ asTemplate: true }); },
      'sketch-publish': function () { publishTemplate(); },
      'sketch-export': exportPng,
      'sketch-new': function () { resetBoard(true); if (state.viewMode === '3d') ensureAtlas(); },
      'sketch-delete': deleteCurrent,
      'sketch-mode-3d': function () { setViewMode('3d'); },
      'sketch-mode-2d': function () { setViewMode('2d'); },
      'sketch-interact-draw': function () { setInteraction('draw'); },
      'sketch-interact-orbit': function () { setInteraction('orbit'); }
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', map[id]);
    });
  }

  function wireCanvases() {
    ['d0', 'd1', 'd2'].forEach(function (id) {
      var c = drawCanvas(id);
      if (!c || c.dataset.wired) return;
      c.dataset.wired = '1';
      c.addEventListener('mousedown', startDraw);
      c.addEventListener('mousemove', moveDraw);
      c.addEventListener('touchstart', startDraw, { passive: false });
      c.addEventListener('touchmove', moveDraw, { passive: false });
      c.addEventListener('touchend', endDraw, { passive: false });
    });
    var mm = mediaMask();
    if (mm && !mm.dataset.wired) {
      mm.dataset.wired = '1';
      mm.addEventListener('mousedown', startDraw);
      mm.addEventListener('mousemove', moveDraw);
      mm.addEventListener('touchstart', startDraw, { passive: false });
      mm.addEventListener('touchmove', moveDraw, { passive: false });
      mm.addEventListener('touchend', endDraw, { passive: false });
    }
    if (!window.__sketchPointerUp) {
      window.__sketchPointerUp = true;
      window.addEventListener('mouseup', endDraw);
    }
  }

  function goToSketchTool() {
    try {
      if (typeof window.showTab === 'function') window.showTab('tools');
      else if (typeof window.setTab === 'function') window.setTab('tools');
    } catch (e) {}
    try {
      if (typeof window.setToolsMode === 'function') window.setToolsMode('sketch');
    } catch (e2) {}
  }

  function openWithPayload(payload) {
    payload = payload || {};
    goToSketchTool();
    var run = function () {
      if (payload.mode === '2d' || payload.imageDataUrl) setViewMode('2d');
      else setViewMode('3d');
      if (payload.imageDataUrl) {
        state.layers.media.imageDataUrl = payload.imageDataUrl;
        if (payload.mode === '3d') {
          // 3D from 2D: keep atlas + image as plane overlay
          setViewMode('3d');
          var wrap = document.getElementById('sketch-media-wrap');
          if (wrap) wrap.style.display = 'block';
        }
      }
      if (payload.title) {
        var titleEl = document.getElementById('sketch-title');
        if (titleEl) titleEl.value = payload.title;
      }
      state.currentId = null;
      state.dirty = true;
      setInteraction('draw');
      state.activeDraw = 'd0';
      redrawAll();
      renderLayersPanel();
      if (state.viewMode === '3d') ensureAtlas();
      setStatus(t('a.sketch.copy_ready', 'Копия открыта в Скетче'));
    };
    // mount may be async after setToolsMode
    setTimeout(run, 80);
  }

  function openFromCapture(payload) {
    if (!state.mounted) {
      pendingOpen = payload;
      goToSketchTool();
      return;
    }
    openWithPayload(payload);
  }

  function captureElementToDataUrl(el) {
    return new Promise(function (resolve, reject) {
      if (!el) return reject(new Error('no element'));
      // Prefer canvas direct
      if (el.tagName === 'CANVAS') {
        try { return resolve(el.toDataURL('image/png')); } catch (e) {}
      }
      var atlas = window._anatomyAtlas;
      if (atlas && atlas.screenshot && el.id === 'atlas-viewport') {
        var shot = atlas.screenshot();
        if (shot) return resolve(shot);
      }
      loadHtml2Canvas().then(function (h2c) {
        return h2c(el, {
          backgroundColor: null,
          useCORS: true,
          allowTaint: true,
          scale: Math.min(2, window.devicePixelRatio || 1)
        });
      }).then(function (canvas) {
        resolve(canvas.toDataURL('image/png'));
      }).catch(reject);
    });
  }

  function loadHtml2Canvas() {
    return new Promise(function (resolve, reject) {
      if (window.html2canvas) return resolve(window.html2canvas);
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload = function () { resolve(window.html2canvas); };
      s.onerror = function () { reject(new Error('html2canvas load failed')); };
      document.head.appendChild(s);
    });
  }

  function askCopyMode(then) {
    var choice = window.prompt(
      t('a.sketch.copy_prompt', 'Копия: введите 3d или 2d'),
      '2d'
    );
    if (choice == null) return;
    choice = String(choice).trim().toLowerCase();
    if (choice !== '3d' && choice !== '2d') choice = '2d';
    then(choice);
  }

  function fromAtlas(preferredMode) {
    var atlas = window._anatomyAtlas;
    function go(mode) {
      if (mode === '3d') {
        openFromCapture({ mode: '3d', title: t('a.sketch.from_atlas_3d', 'Копия Атласа (3D)') });
        return;
      }
      var shot = atlas && atlas.screenshot ? atlas.screenshot() : null;
      if (!shot) {
        var vp = document.getElementById('atlas-viewport');
        captureElementToDataUrl(vp || document.body).then(function (url) {
          openFromCapture({ mode: '2d', imageDataUrl: url, title: t('a.sketch.from_atlas_2d', 'Скрин Атласа') });
        }).catch(function (err) { setStatus(err.message); alert(err.message); });
        return;
      }
      openFromCapture({ mode: '2d', imageDataUrl: shot, title: t('a.sketch.from_atlas_2d', 'Скрин Атласа') });
    }
    if (preferredMode === '2d' || preferredMode === '3d') go(preferredMode);
    else askCopyMode(go);
  }

  function fromImageUrl(url, title, preferredMode) {
    function go(mode) {
      openFromCapture({
        mode: mode,
        imageDataUrl: url,
        title: title || t('a.sketch.from_image', 'Копия изображения')
      });
    }
    if (preferredMode === '2d' || preferredMode === '3d') go(preferredMode);
    else askCopyMode(go);
  }

  function fromElement(el, title) {
    setStatus(t('a.sketch.capturing', 'Делаю снимок…'));
    captureElementToDataUrl(el).then(function (url) {
      openFromCapture({ mode: '2d', imageDataUrl: url, title: title || t('a.sketch.screenshot', 'Скриншот') });
    }).catch(function (err) {
      alert(err.message || 'capture failed');
    });
  }

  function captureCabinet() {
    var root = document.getElementById('app') || document.getElementById('main') || document.body;
    // Prefer visible tools panel
    var tools = document.getElementById('tab-tools') || document.querySelector('.tab-panel.active') || root;
    fromElement(tools, t('a.sketch.lk_shot', 'Скрин ЛК'));
  }

  function ensureFab() {
    if (document.getElementById('sketch-capture-fab')) return;
    var fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'sketch-capture-fab';
    fab.className = 'sketch-fab';
    fab.title = t('a.sketch.fab_title', 'Скрин в Скетч');
    fab.innerHTML = '✎ <span data-i18n="a.sketch.fab">Скетч</span>';
    fab.addEventListener('click', function () { captureCabinet(); });
    document.body.appendChild(fab);
    // Show when logged-in cabinet is active
    function syncFab() {
      var on = !!document.getElementById('tab-tools') || !!document.querySelector('.dash-layout');
      fab.classList.toggle('sketch-fab-on', on);
    }
    syncFab();
    setInterval(syncFab, 2000);
  }

  function mount(host) {
    if (!host) return;
    state.host = host;
    if (!state.mounted) {
      wireToolbar();
      wireCanvases();
      state.mounted = true;
      window.addEventListener('resize', function () {
        if (host.style.display === 'none') return;
        resizeAll();
      });
      ensureFab();
    }
    resizeAll();
    renderLayersPanel();
    setViewMode(state.viewMode);
    setInteraction(state.interaction);
    loadList();
    loadTemplates();
    if (pendingOpen) {
      var p = pendingOpen;
      pendingOpen = null;
      openWithPayload(p);
    }
  }

  window.mountSketchTool = mount;
  window.SketchTool = {
    mount: mount,
    resize: resizeAll,
    openFromCapture: openFromCapture,
    fromAtlas: fromAtlas,
    fromImageUrl: fromImageUrl,
    fromElement: fromElement,
    captureCabinet: captureCabinet,
    ensureFab: ensureFab
  };

  // Auto-FAB when cabinet scripts load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(ensureFab, 400); });
  } else {
    setTimeout(ensureFab, 400);
  }
})();
