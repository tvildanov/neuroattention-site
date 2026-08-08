/**
 * Sketch tool — freehand canvas in Tools.
 * Defaults (Nick traveling; brief unanswered): Tools mode, pen/eraser/colors,
 * save to profile API, all logged-in users, touch enabled.
 */
(function () {
  'use strict';

  var COLORS = ['#e8edf2', '#0ef', '#0e9', '#fc0', '#f6a', '#a8f', '#f44', '#222'];
  var state = {
    mounted: false,
    tool: 'pen',
    color: COLORS[0],
    size: 3,
    drawing: false,
    strokes: [],
    current: null,
    sketches: [],
    currentId: null,
    dirty: false,
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

  function canvas() { return document.getElementById('sketch-canvas'); }
  function ctx2d() {
    var c = canvas();
    return c ? c.getContext('2d') : null;
  }

  function resizeCanvas() {
    var c = canvas();
    if (!c) return;
    var wrap = c.parentElement;
    var w = Math.max(280, wrap.clientWidth || 320);
    var h = Math.max(280, Math.min(520, Math.round(w * 0.72)));
    var ratio = window.devicePixelRatio || 1;
    c.width = Math.floor(w * ratio);
    c.height = Math.floor(h * ratio);
    c.style.width = w + 'px';
    c.style.height = h + 'px';
    var ctx = c.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    redraw();
  }

  function redraw() {
    var c = canvas();
    var ctx = ctx2d();
    if (!c || !ctx) return;
    var w = c.clientWidth, h = c.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b1016';
    ctx.fillRect(0, 0, w, h);
    (state.strokes || []).forEach(drawStroke);
    if (state.current) drawStroke(state.current);
  }

  function drawStroke(s) {
    var ctx = ctx2d();
    if (!ctx || !s || !s.points || s.points.length < 1) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = s.size || 3;
    if (s.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = s.color || '#fff';
    }
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (var i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
    if (s.points.length === 1) {
      ctx.arc(s.points[0].x, s.points[0].y, (s.size || 3) / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.stroke();
    }
    ctx.restore();
  }

  function posFromEvent(e) {
    var c = canvas();
    var r = c.getBoundingClientRect();
    var src = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }

  function startDraw(e) {
    e.preventDefault();
    state.drawing = true;
    var p = posFromEvent(e);
    state.current = { tool: state.tool, color: state.color, size: state.size, points: [p] };
    redraw();
  }
  function moveDraw(e) {
    if (!state.drawing || !state.current) return;
    e.preventDefault();
    state.current.points.push(posFromEvent(e));
    redraw();
  }
  function endDraw(e) {
    if (!state.drawing) return;
    e.preventDefault();
    state.drawing = false;
    if (state.current && state.current.points.length) {
      state.strokes.push(state.current);
      state.dirty = true;
      setStatus(t('a.sketch.unsaved', 'Не сохранено'));
    }
    state.current = null;
    redraw();
  }

  function setStatus(msg) {
    var el = document.getElementById('sketch-status');
    if (el) el.textContent = msg || '';
  }

  function clearBoard() {
    if (state.strokes.length && !window.confirm(t('a.sketch.clear_confirm', 'Очистить холст?'))) return;
    state.strokes = [];
    state.current = null;
    state.currentId = null;
    state.dirty = true;
    redraw();
    setStatus(t('a.sketch.cleared', 'Очищено'));
  }

  function undo() {
    if (!state.strokes.length) return;
    state.strokes.pop();
    state.dirty = true;
    redraw();
  }

  async function saveSketch() {
    var titleEl = document.getElementById('sketch-title');
    var title = (titleEl && titleEl.value.trim()) || t('a.sketch.untitled', 'Без названия');
    var c = canvas();
    if (!c) return;
    var png = null;
    try { png = c.toDataURL('image/png'); } catch (e) {}
    var body = {
      id: state.currentId || undefined,
      title: title,
      strokes: state.strokes,
      png_data_url: png && png.length < 2.5e6 ? png : null,
    };
    setStatus(t('a.sketch.saving', 'Сохраняю…'));
    try {
      var res = await fetch(apiBase() + '/api/sketches', {
        method: 'POST',
        headers: headers(true),
        body: JSON.stringify(body),
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
      state.currentId = data.sketch && data.sketch.id;
      state.dirty = false;
      setStatus(t('a.sketch.saved', 'Сохранено'));
      loadList();
    } catch (err) {
      setStatus((err && err.message) || 'error');
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
        return '<button type="button" class="sketch-list-item" data-id="' + s.id + '">' +
          '<span class="sketch-list-title">' + esc(s.title || '—') + '</span>' +
          '<span class="sketch-list-meta">' + esc(when) + '</span></button>';
      }).join('');
      host.querySelectorAll('.sketch-list-item').forEach(function (btn) {
        btn.addEventListener('click', function () { openSketch(btn.getAttribute('data-id')); });
      });
    } catch (err) {
      host.innerHTML = '<p class="monad-warn">' + esc(err.message) + '</p>';
    }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function openSketch(id) {
    try {
      var res = await fetch(apiBase() + '/api/sketches/' + encodeURIComponent(id), { headers: headers(false) });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || 'open failed');
      var s = data.sketch;
      state.currentId = s.id;
      state.strokes = Array.isArray(s.strokes) ? s.strokes : [];
      state.dirty = false;
      var titleEl = document.getElementById('sketch-title');
      if (titleEl) titleEl.value = s.title || '';
      redraw();
      setStatus(t('a.sketch.loaded', 'Открыто'));
    } catch (err) {
      setStatus(err.message);
    }
  }

  async function deleteCurrent() {
    if (!state.currentId) { clearBoard(); return; }
    if (!window.confirm(t('a.sketch.delete_confirm', 'Удалить этот скетч?'))) return;
    try {
      var res = await fetch(apiBase() + '/api/sketches/' + encodeURIComponent(state.currentId), {
        method: 'DELETE',
        headers: headers(false),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'delete failed');
      state.currentId = null;
      state.strokes = [];
      redraw();
      setStatus(t('a.sketch.deleted', 'Удалено'));
      loadList();
    } catch (err) {
      setStatus(err.message);
    }
  }

  function wireToolbar() {
    document.querySelectorAll('[data-sketch-tool]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.tool = b.getAttribute('data-sketch-tool');
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
          state.tool = 'pen';
          document.querySelectorAll('[data-sketch-tool]').forEach(function (x) {
            x.classList.toggle('active', x.getAttribute('data-sketch-tool') === 'pen');
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
      size.addEventListener('input', function () { state.size = parseInt(size.value, 10) || 3; });
    }
    var map = {
      'sketch-undo': undo,
      'sketch-clear': clearBoard,
      'sketch-save': saveSketch,
      'sketch-new': function () {
        state.currentId = null;
        state.strokes = [];
        state.dirty = false;
        var titleEl = document.getElementById('sketch-title');
        if (titleEl) titleEl.value = '';
        redraw();
        setStatus('');
      },
      'sketch-delete': deleteCurrent,
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', map[id]);
    });
  }

  function wireCanvas() {
    var c = canvas();
    if (!c || c.dataset.wired) return;
    c.dataset.wired = '1';
    c.addEventListener('mousedown', startDraw);
    c.addEventListener('mousemove', moveDraw);
    window.addEventListener('mouseup', endDraw);
    c.addEventListener('touchstart', startDraw, { passive: false });
    c.addEventListener('touchmove', moveDraw, { passive: false });
    c.addEventListener('touchend', endDraw, { passive: false });
  }

  function mount(host) {
    if (!host) return;
    if (!state.mounted) {
      wireToolbar();
      wireCanvas();
      state.mounted = true;
      window.addEventListener('resize', function () {
        if (host.style.display === 'none') return;
        resizeCanvas();
      });
    }
    resizeCanvas();
    loadList();
  }

  window.mountSketchTool = mount;
  window.SketchTool = { mount: mount, resize: resizeCanvas };
})();
