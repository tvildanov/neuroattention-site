/* ============================================================================
   EvolutionPath — Stage 2 of the Mycelium light-map layer  (🅲️ reworked).

   The user's development as a living light topology — a dense organic mycelium
   FIELD, not a column of dots. Events are scattered across the whole field on
   two axes (X = time, Y = layer band), connected by glowing filaments
   (journey_links), with the course modules as time-sections across the top, a
   time axis along the bottom, a personal mini-panel on the left and per-layer
   toggles on the right.

   Three modes:
     • tunnel  — detailed personal field: spine + scattered events + filaments
     • layers  — horizontal lanes per data layer with wavy baselines
     • field   — single-character view: avatar portrait + organic energy field

   Pure vanilla JS + SVG. Reuses tokens from data/css/mycelium.css.

   Public API: window.mountEvolutionPath(container, opts)
     opts: { period, mode, apiBase, token, lang }
   ============================================================================ */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var H = 380;

  var LAYERS = [
    { key: 'practice',  label: { ru: 'Практики',  en: 'Practices',  es: 'Prácticas' } },
    { key: 'emotion',   label: { ru: 'Эмоции',    en: 'Emotions',   es: 'Emociones' } },
    { key: 'event',     label: { ru: 'События',   en: 'Events',     es: 'Eventos' } },
    { key: 'thought',   label: { ru: 'Мысли',     en: 'Thoughts',   es: 'Pensamientos' } },
    { key: 'sensation', label: { ru: 'Ощущения',  en: 'Sensations', es: 'Sensaciones' } },
    { key: 'insight',   label: { ru: 'Инсайты',   en: 'Insights',   es: 'Insights' } },
    { key: 'xp_gain',   label: { ru: 'XP и уровень', en: 'XP & level', es: 'XP y nivel' } }
  ];
  // vertical placement of each scatter layer inside the tunnel field (0=top..1=bottom)
  var LAYER_YFRAC = { insight: 0.16, thought: 0.32, emotion: 0.46, practice: 0.50, sensation: 0.64, event: 0.80 };

  // D п.17/18: «Персонаж» (field) mode removed; its stat-card moved into the
  // detailed «Путь развития» view (formerly «Тоннель»).
  var MODES = [
    { key: 'tunnel', label: { ru: 'Путь развития', en: 'Evolution path', es: 'Camino' } },
    { key: 'layers', label: { ru: 'Слои',          en: 'Layers',        es: 'Capas' } }
  ];
  var PERIODS = [
    { key: 'week',    label: { ru: 'Неделя', en: 'Week',  es: 'Semana' } },
    { key: 'month',   label: { ru: 'Месяц',  en: 'Month', es: 'Mes' } },
    { key: '3months', label: { ru: '3 мес',  en: '3 mo',  es: '3 m' } },
    { key: 'year',    label: { ru: 'Год',    en: 'Year',  es: 'Año' } }
  ];
  var STR = {
    title:   { ru: 'Путь развития', en: 'Evolution Path', es: 'Camino de evolución' },
    sub:     { ru: 'Твой путь развития по времени', en: 'Your development over time', es: 'Tu desarrollo en el tiempo' },
    empty:   { ru: 'Пока мало данных для карты. Проходите практики и отмечайте состояния — поле начнёт расти.',
               en: 'Not enough data yet. Do practices and log states — the field will start to grow.',
               es: 'Aún no hay suficientes datos. Haz prácticas y registra estados — el campo crecerá.' },
    loading: { ru: 'Собираем световое поле…', en: 'Assembling the light field…', es: 'Ensamblando el campo…' },
    fail:    { ru: 'Не удалось загрузить путь развития.', en: 'Could not load the evolution path.', es: 'No se pudo cargar el camino.' },
    now:     { ru: 'сейчас', en: 'now', es: 'ahora' },
    level:   { ru: 'Уровень', en: 'Level', es: 'Nivel' },
    module:  { ru: 'Модуль', en: 'Module', es: 'Módulo' },
    layersTitle: { ru: 'Слои', en: 'Layers', es: 'Capas' },
    openProfile: { ru: 'Открыть профиль', en: 'Open profile', es: 'Abrir perfil' },
    demoBadge: { ru: 'демо', en: 'demo', es: 'demo' }
  };
  // character stat-card labels
  var CHAR_STR = {
    level:    { ru: 'Уровень', en: 'Level', es: 'Nivel' },
    xpgrowth: { ru: 'Рост XP', en: 'XP growth', es: 'Crecimiento XP' },
    emotion:  { ru: 'Преобладающая эмоция', en: 'Dominant emotion', es: 'Emoción dominante' },
    state:    { ru: 'Текущее состояние', en: 'Current state', es: 'Estado actual' },
    last:     { ru: 'Последняя активность', en: 'Last activity', es: 'Última actividad' },
    none:     { ru: '—', en: '—', es: '—' }
  };
  var STATE_LABEL = {
    bright: { ru: 'Свет и рост', en: 'Bright & growing', es: 'Luz y crecimiento' },
    calm:   { ru: 'Спокойствие', en: 'Calm', es: 'Calma' },
    turbul: { ru: 'Турбулентность', en: 'Turbulence', es: 'Turbulencia' },
    neutral:{ ru: 'Ровное состояние', en: 'Steady', es: 'Estable' }
  };

  /* ── 🅲️ C6: human-readable labels for event kinds / sources ──────────────── */
  var EVENT_LABELS = {
    backfill_neuromap: { ru: 'Нейромап (импорт)', en: 'NeuroMap (import)', es: 'NeuroMapa (import.)' },
    neuromap:        { ru: 'Нейромап', en: 'NeuroMap', es: 'NeuroMapa' },
    neuromap_legacy: { ru: 'Нейромап', en: 'NeuroMap', es: 'NeuroMapa' },
    block_done:      { ru: 'Курс · блок завершён', en: 'Course · block done', es: 'Curso · bloque hecho' },
    practice_done:   { ru: 'Практика завершена', en: 'Practice done', es: 'Práctica hecha' },
    practice:        { ru: 'Практика', en: 'Practice', es: 'Práctica' },
    course_block:    { ru: 'Курс', en: 'Course', es: 'Curso' },
    emotion:         { ru: 'Эмоция', en: 'Emotion', es: 'Emoción' },
    event:           { ru: 'Событие', en: 'Event', es: 'Evento' },
    thought:         { ru: 'Мысль', en: 'Thought', es: 'Pensamiento' },
    sensation:       { ru: 'Ощущение', en: 'Sensation', es: 'Sensación' },
    insight:         { ru: 'Инсайт', en: 'Insight', es: 'Insight' },
    xp_gain:         { ru: 'XP получен', en: 'XP gained', es: 'XP ganado' },
    achievement:     { ru: 'Достижение', en: 'Achievement', es: 'Logro' },
    diary:           { ru: 'Дневник нейроресурса', en: 'Neuro-resource diary', es: 'Diario' },
    diary_legacy:    { ru: 'Дневник нейроресурса', en: 'Neuro-resource diary', es: 'Diario' },
    calendar:        { ru: 'Календарь', en: 'Calendar', es: 'Calendario' }
  };
  function humanLabel(key, lang) {
    var m = EVENT_LABELS[key];
    return m ? (m[lang] || m.ru) : (key || '');
  }

  function el(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function L(o, lang) { return (o && (o[lang] || o.ru)) || ''; }
  function clamp01(n) { return Math.max(0, Math.min(1, n)); }
  // deterministic 0..1 pseudo-random by index (stable across renders)
  function jit(i) { var s = Math.sin((i + 1) * 12.9898) * 43758.5453; return s - Math.floor(s); }
  function valStyle(v) {
    if (v === 'positive') return { c: 'var(--myc-green)', o: 0.95 };
    if (v === 'negative') return { c: 'var(--myc-line-secondary)', o: 0.5 };
    return { c: 'var(--myc-line-secondary)', o: 0.72 };
  }
  function tms(t) { var d = new Date(t); return isNaN(d) ? 0 : d.getTime(); }
  // Robust width measurement. The container is laid out before the inner canvas
  // settles, and on tab-activation (display:none→block) the canvas can briefly
  // measure ~0/narrow — which used to cram every event into a thin column at the
  // edge. Take the MAX of every width candidate so a momentary narrow canvas can
  // never win over the real container width.
  function measureW(canvas, container) {
    var cands = [];
    try { cands.push(canvas.getBoundingClientRect().width); } catch (e) {}
    cands.push(canvas.clientWidth || 0);
    if (container) {
      cands.push(container.clientWidth || 0);
      try { cands.push(container.getBoundingClientRect().width); } catch (e) {}
      if (container.parentElement) cands.push(container.parentElement.clientWidth || 0);
    }
    var w = Math.max.apply(null, cands.map(function (x) { return Math.round(x || 0); }).concat([0]));
    return Math.max(360, w || 1100);
  }
  function newSvg(W) {
    var s = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H,
      preserveAspectRatio: 'xMidYMid meet', style: 'max-width:100%;display:block;' });
    s.insertAdjacentHTML('afterbegin', defsMarkup());
    return s;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function initials(name) {
    var p = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '✦';
    return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }

  function defsMarkup() {
    return '<defs>' +
      '<filter id="evoGlow" x="-80%" y="-80%" width="260%" height="260%">' +
      '<feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="evoGlowSoft" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="9"/></filter>' +
      '<radialGradient id="evoField" cx="50%" cy="50%" r="50%">' +
      '<stop offset="0%" stop-color="#A8F7FF" stop-opacity="0.18"/>' +
      '<stop offset="45%" stop-color="#8DFFC8" stop-opacity="0.09"/>' +
      '<stop offset="100%" stop-color="#8DFFC8" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="evoXp" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="#56F2A6" stop-opacity="0"/>' +
      '<stop offset="15%" stop-color="#56F2A6" stop-opacity="0.85"/>' +
      '<stop offset="100%" stop-color="#8DFFC8" stop-opacity="0.9"/></linearGradient></defs>';
  }

  /* ── data helpers ───────────────────────────────────────────────────────── */
  function allEvents(data) {
    if (Array.isArray(data.events) && data.events.length) {
      return data.events.map(function (e) {
        return { id: e.id, layer: e.layer, t: tms(e.t || e.occurred_at), occurred_at: e.occurred_at,
                 label: e.label, valence: e.valence, weight: e.weight || 1, kind: e.kind,
                 source: e.source, payload: e.payload || {}, links: e.links || [] };
      }).sort(function (a, b) { return a.t - b.t; });
    }
    var out = [];
    LAYERS.forEach(function (ly) {
      if (ly.key === 'xp_gain') return;
      (data.layers[ly.key] || []).forEach(function (e) {
        out.push({ id: e.id, layer: ly.key, t: tms(e.t), occurred_at: e.occurred_at, label: e.label,
                   valence: e.valence, weight: e.weight || 1, kind: e.kind || ly.key,
                   source: e.source, payload: e.payload || {}, links: e.links || [] });
      });
    });
    return out.sort(function (a, b) { return a.t - b.t; });
  }
  function domain(data) {
    var from = tms(data.range.from), to = tms(data.range.to);
    if (to <= from) to = from + 1;
    return { from: from, to: to, span: to - from };
  }
  function recompute(events) {
    var emo = events.filter(function (e) { return e.layer === 'emotion'; });
    var pos = emo.filter(function (e) { return e.valence === 'positive'; }).length;
    var neg = emo.filter(function (e) { return e.valence === 'negative'; }).length;
    var positivity = emo.length ? pos / emo.length : 0.5;
    var turbulence = emo.length ? neg / emo.length : 0;
    var activity = events.length;
    var brightness = clamp01(0.35 + 0.40 * positivity + 0.20 - 0.30 * turbulence);
    var spread = clamp01(0.30 + 0.50 * positivity - 0.40 * turbulence);
    var density = clamp01(0.25 + 0.50 * turbulence + 0.30 * Math.min(1, activity / 60));
    return { positivity: positivity, turbulence: turbulence, activity: activity, brightness: brightness, spread: spread, density: density };
  }

  // ── node-position registry (id → {x,y}) for link drawing, rebuilt every paint ──
  var POS = {};
  function registerNode(id, x, y) { if (id != null) POS[String(id)] = { x: x, y: y }; }

  /* ── 🅲️ C4: interaction — enlarged hit target + re-entrancy lock ─────────── */
  // A visible dot plus an invisible r=24 hit circle wrapped in a <g>; clicks are
  // guarded by window._evolNavLock so a fast double-fire never "loses" a click.
  function interactiveNode(visible, ev, container, lang, hitR) {
    var g = el('g', { 'class': 'evo-node' });
    g.appendChild(el('circle', { 'class': 'evo-hit', cx: visible.getAttribute('cx'),
      cy: visible.getAttribute('cy'), r: hitR || 24, fill: 'transparent', 'pointer-events': 'all' }));
    g.appendChild(visible);
    g.style.cursor = 'pointer';
    g.setAttribute('tabindex', '0');
    function open(domEv) {
      if (domEv) domEv.stopPropagation();
      if (window._evolNavLock) return;
      window._evolNavLock = true;
      try { showDetailCard(container, ev, lang); }
      finally { setTimeout(function () { window._evolNavLock = false; }, 120); }
    }
    g.addEventListener('click', open);
    g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') open(e); });
    return g;
  }

  // 🅲️ C2 + C9: glowing filaments between linked events (real journey_links), plus
  // decorative filaments between near-in-time same-layer events when links are
  // sparse, so the field never looks empty.
  function drawFilaments(g, data, events) {
    var lg = el('g', { 'class': 'evo-links' });
    var drawn = 0;
    (data && data.links || []).forEach(function (lk) {
      var a = POS[String(lk.a)], b = POS[String(lk.b)];
      if (!a || !b) return;
      lg.appendChild(filament(a, b, lk.kind === 'correlation' ? 'var(--myc-cyan)' : 'var(--myc-green)', 0.5, '1'));
      drawn++;
    });
    // decorative filaments — connect each event to the next same-layer event
    var byLayer = {};
    (events || []).forEach(function (e) {
      if (e.decorative) return;
      (byLayer[e.layer] = byLayer[e.layer] || []).push(e);
    });
    Object.keys(byLayer).forEach(function (k) {
      var arr = byLayer[k];
      for (var i = 1; i < arr.length; i++) {
        var a = POS[String(arr[i - 1].id)], b = POS[String(arr[i].id)];
        if (!a || !b) continue;
        if (Math.abs(b.x - a.x) > 260) continue; // only nearby in time
        lg.appendChild(filament(a, b, 'var(--myc-line-secondary)', 0.14, '0.6'));
      }
    });
    g.insertBefore(lg, g.firstChild || null);
  }
  function filament(a, b, stroke, op, w) {
    var midX = (a.x + b.x) / 2;
    var midY = (a.y + b.y) / 2 - Math.min(46, Math.abs(b.x - a.x) * 0.22);
    var d;
    // D п.22: smooth Catmull-Rom curve through [a, lifted-mid, b] via d3-shape
    // when available; degrade to a quadratic bézier otherwise.
    if (window.d3 && window.d3.line && window.d3.curveCatmullRom) {
      d = window.d3.line().curve(window.d3.curveCatmullRom.alpha(0.7))(
        [[a.x, a.y], [midX, midY], [b.x, b.y]]);
    } else {
      d = 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) +
          ' Q' + midX.toFixed(1) + ' ' + midY.toFixed(1) +
          ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
    }
    return el('path', { d: d, fill: 'none', stroke: stroke, 'stroke-width': w || '0.8', opacity: String(op) });
  }
  // decorative background mycelium — long faint organic curves spanning the field
  function backgroundFilaments(g, x0, x1, yTop, yBot, n) {
    var bg = el('g', { 'class': 'evo-bg-fil', opacity: '0.9' });
    for (var i = 0; i < n; i++) {
      var baseY = yTop + (yBot - yTop) * ((i + 0.5) / n);
      var amp = 14 + jit(i) * 26, k = 0.006 + jit(i + 5) * 0.01, ph = jit(i + 9) * 6;
      var d = '', f = true;
      for (var px = x0; px <= x1; px += 12) {
        var y = baseY + Math.sin(px * k + ph) * amp + Math.sin(px * k * 2.3 + ph) * amp * 0.3;
        d += (f ? 'M' : 'L') + px.toFixed(1) + ' ' + y.toFixed(1); f = false;
      }
      bg.appendChild(el('path', { d: d, fill: 'none',
        stroke: (i % 3 === 0 ? 'var(--myc-green)' : 'var(--myc-cyan)'),
        'stroke-width': '0.6', opacity: (0.05 + jit(i + 2) * 0.06).toFixed(3) }));
    }
    g.appendChild(bg);
  }

  var LAYER_LABEL = {};
  LAYERS.forEach(function (l) { LAYER_LABEL[l.key] = l.label; });

  function fmtDate(t, lang) {
    var d = new Date(t); if (isNaN(d)) return '';
    try { return d.toLocaleString(lang === 'ru' ? 'ru-RU' : (lang === 'es' ? 'es-ES' : 'en-US'),
      { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return d.toISOString().slice(0, 16).replace('T', ' '); }
  }
  function fmtAxis(t, lang) {
    var d = new Date(t); if (isNaN(d)) return '';
    try { return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : (lang === 'es' ? 'es-ES' : 'en-US'),
      { day: 'numeric', month: 'short' }); }
    catch (e) { return d.toISOString().slice(5, 10); }
  }

  /* ── 🅲️ C5: event detail card ───────────────────────────────────────────── */
  var CARD_STR = {
    type:    { ru: 'Тип', en: 'Type', es: 'Tipo' },
    source:  { ru: 'Источник', en: 'Source', es: 'Fuente' },
    time:    { ru: 'Время', en: 'Time', es: 'Hora' },
    links:   { ru: 'Связи', en: 'Links', es: 'Enlaces' },
    open:    { ru: 'Открыть в источнике', en: 'Open in source', es: 'Abrir en la fuente' },
    close:   { ru: 'Закрыть', en: 'Close', es: 'Cerrar' },
    intensity:{ ru: 'Интенсивность', en: 'Intensity', es: 'Intensidad' },
    comment: { ru: 'Заметка', en: 'Note', es: 'Nota' },
    where:   { ru: 'Где', en: 'Where', es: 'Dónde' }
  };

  // a flat lookup of every event currently painted, by id — lets the card list
  // clickable related events (journey_links → jump to that event's card).
  var EVENT_INDEX = {};
  function indexEvents(events) { EVENT_INDEX = {}; (events || []).forEach(function (e) { if (e.id != null) EVENT_INDEX[String(e.id)] = e; }); }

  function showDetailCard(container, ev, lang) {
    closeDetailCard(container);
    var canvas = container.querySelector('.myc-evo-canvas');
    if (!canvas) return;
    var card = document.createElement('div');
    card.className = 'evo-detail-card';
    card.setAttribute('role', 'dialog');

    var p = ev.payload || {};
    var typeKey = ev.kind || ev.layer;
    var typeLabel = humanLabel(typeKey, lang) || L(LAYER_LABEL[ev.layer] || { ru: ev.layer }, lang);
    var srcLabel = humanLabel(ev.source || (p && p.source), lang);
    var rows = [];
    rows.push('<div class="evo-card-head"><span class="evo-card-dot" style="background:' + valStyle(ev.valence).c + '"></span>' +
      '<b>' + escapeHtml(prettyTitle(ev, lang)) + '</b></div>');
    rows.push(kv(L(CARD_STR.type, lang), escapeHtml(typeLabel)));
    rows.push(kv(L(CARD_STR.time, lang), escapeHtml(fmtDate(ev.t, lang))));
    if (srcLabel) rows.push(kv(L(CARD_STR.source, lang), escapeHtml(srcLabel)));
    if (p.intensity) rows.push(kv(L(CARD_STR.intensity, lang), String(p.intensity)));
    if (p.body_locations && p.body_locations.length) rows.push(kv(L(CARD_STR.where, lang), escapeHtml(p.body_locations.join(', '))));
    if (p.comment) rows.push(kv(L(CARD_STR.comment, lang), escapeHtml(p.comment)));
    if (p.text && ev.kind === 'insight') rows.push('<div class="evo-card-note">' + escapeHtml(String(p.text)) + '</div>');

    // related events (clickable)
    var rel = (ev.links || []).map(function (lk) { return EVENT_INDEX[String(lk.to != null ? lk.to : lk)]; }).filter(Boolean);
    if (rel.length) {
      var chips = rel.slice(0, 6).map(function (r) {
        return '<button class="evo-rel" data-id="' + escapeHtml(String(r.id)) + '">' +
          '<span class="evo-card-dot" style="background:' + valStyle(r.valence).c + '"></span>' +
          escapeHtml((prettyTitle(r, lang) || humanLabel(r.kind || r.layer, lang)).slice(0, 28)) + '</button>';
      }).join('');
      rows.push('<div class="evo-card-rel-title">' + L(CARD_STR.links, lang) + ' · ' + rel.length + '</div><div class="evo-card-rel">' + chips + '</div>');
    }

    var canOpen = canOpenSource(ev);
    var actions = '<div class="evo-card-actions">';
    if (canOpen) actions += '<button class="evo-open">' + L(CARD_STR.open, lang) + '</button>';
    actions += '<button class="evo-close">' + L(CARD_STR.close, lang) + '</button></div>';

    card.innerHTML = rows.join('') + actions;
    canvas.appendChild(card);
    var oc = card.querySelector('.evo-close'); if (oc) oc.addEventListener('click', function () { closeDetailCard(container); });
    var op = card.querySelector('.evo-open'); if (op) op.addEventListener('click', function () { openInSource(ev); });
    card.querySelectorAll('.evo-rel').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = EVENT_INDEX[String(b.getAttribute('data-id'))];
        if (r) showDetailCard(container, r, lang);
      });
    });
  }
  function prettyTitle(ev, lang) {
    var p = ev.payload || {};
    return ev.label || p.title || p.text || humanLabel(ev.kind || ev.layer, lang);
  }
  function kv(k, v) {
    return '<div class="evo-card-row"><span>' + escapeHtml(k) + '</span><span class="evo-card-v">' + v + '</span></div>';
  }
  function closeDetailCard(container) {
    var ex = container.querySelector('.evo-detail-card'); if (ex) ex.remove();
  }
  function canOpenSource(ev) {
    var s = (ev.source || '') + '';
    return s.indexOf('neuromap') === 0 || s === 'sensation' || s === 'practice' ||
      s === 'course_block' || s.indexOf('diary') === 0 || s === 'calendar' ||
      ev.kind === 'practice' || ev.kind === 'block_done' || ev.kind === 'xp_gain' || ev.kind === 'insight';
  }
  function openInSource(ev) {
    if (typeof window.evoOpenSource === 'function') { try { window.evoOpenSource(ev); return; } catch (e) {} }
    console.info('[EvolutionPath] open source for', ev);
  }

  /* ── module sections (🅲️ C3) ────────────────────────────────────────────── */
  // Returns [{label, frac0, frac1}] across the field width. Prefer real course
  // modules; otherwise fall back to evenly-spaced time sections.
  function moduleSections(st, dom, lang) {
    var mods = st.modules || [];
    if (mods.length) {
      return mods.map(function (m, i) {
        return { label: m, frac0: i / mods.length, frac1: (i + 1) / mods.length };
      });
    }
    // time sections: split the span into ~5 chunks labelled by their start date
    var n = 5, out = [];
    for (var i = 0; i < n; i++) {
      var t = dom.from + dom.span * (i / n);
      out.push({ label: fmtAxis(t, lang), frac0: i / n, frac1: (i + 1) / n });
    }
    return out;
  }
  function drawModuleHeaders(g, st, dom, lang, x0, x1, yTop) {
    var secs = moduleSections(st, dom, lang);
    secs.forEach(function (s, i) {
      var sx0 = x0 + (x1 - x0) * s.frac0, sx1 = x0 + (x1 - x0) * s.frac1, mid = (sx0 + sx1) / 2;
      if (i > 0) g.appendChild(el('line', { x1: sx0, y1: yTop, x2: sx0, y2: H - 30,
        stroke: 'var(--myc-line-faint)', 'stroke-width': '1' }));
      var t = el('text', { x: mid.toFixed(1), y: (yTop - 14).toFixed(1), 'text-anchor': 'middle', 'class': 'evo-mod-num' });
      // D п.20: real names when present; «Модуль N» fallback for empty/placeholder.
      var hasMods = st.modules && st.modules.length;
      var nm = truncate(s.label, 16);
      t.textContent = hasMods ? (nm ? ((i + 1) + ' · ' + nm) : (L(STR.module, lang) + ' ' + (i + 1))) : nm;
      g.appendChild(t);
    });
  }
  function truncate(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function drawTimeAxis(g, dom, lang, x0, x1) {
    var y = H - 16, n = 6;
    g.appendChild(el('line', { x1: x0, y1: y - 8, x2: x1, y2: y - 8, stroke: 'var(--myc-line-faint)', 'stroke-width': '1' }));
    for (var i = 0; i <= n; i++) {
      var f = i / n, px = x0 + (x1 - x0) * f, t = dom.from + dom.span * f;
      g.appendChild(el('line', { x1: px, y1: y - 11, x2: px, y2: y - 5, stroke: 'var(--myc-line-muted)', 'stroke-width': '1' }));
      var tx = el('text', { x: px.toFixed(1), y: y.toFixed(1), 'text-anchor': i === 0 ? 'start' : (i === n ? 'end' : 'middle'), 'class': 'evo-axis-label' });
      tx.textContent = fmtAxis(t, lang);
      g.appendChild(tx);
    }
  }
  // pulsing "now" marker
  function nowMarker(g, x, y) {
    var halo = el('circle', { cx: x, cy: y, r: 9, fill: 'none', stroke: 'var(--myc-cyan)', 'stroke-width': '1.2', opacity: '0.5', filter: 'url(#evoGlowSoft)' });
    halo.style.setProperty('--myc-pulse-r0', '8px');
    halo.style.setProperty('--myc-pulse-r1', '18px');
    halo.style.animation = 'myc-pulse 2.6s ease-in-out infinite';
    g.appendChild(halo);
    g.appendChild(el('circle', { cx: x, cy: y, r: 4, fill: 'var(--myc-cyan)', filter: 'url(#evoGlow)' }));
  }

  /* ── view: TUNNEL (hero — dense 2D mycelium field) ──────────────────────── */
  function renderTunnel(svg, W, data, container, lang, st) {
    var dom = domain(data);
    var padL = 168, padR = 150, padTop = 50, padBot = 34;
    var x0 = padL, x1 = W - padR;
    var fieldTop = padTop, fieldBot = H - padBot, fieldH = fieldBot - fieldTop, cy = (fieldTop + fieldBot) / 2;
    var xOf = function (t) { return x0 + (clamp01((tms(t) - dom.from) / dom.span)) * (x1 - x0); };
    var yOfLayer = function (layer, i) {
      var base = fieldTop + (LAYER_YFRAC[layer] != null ? LAYER_YFRAC[layer] : 0.5) * fieldH;
      return base + (jit(i) - 0.5) * fieldH * 0.16;
    };
    var g = el('g', { 'class': 'myc-fade' });

    // background depth grid + organic mycelium
    var grid = el('g', { opacity: '0.5' });
    for (var gx = x0; gx <= x1; gx += 70) grid.appendChild(el('line', { x1: gx, y1: fieldTop, x2: gx, y2: fieldBot, stroke: 'var(--myc-line-faint)', 'stroke-width': '1' }));
    for (var gy = fieldTop; gy <= fieldBot; gy += 52) grid.appendChild(el('line', { x1: x0, y1: gy, x2: x1, y2: gy, stroke: 'var(--myc-line-faint)', 'stroke-width': '1' }));
    g.appendChild(grid);
    backgroundFilaments(g, x0, x1, fieldTop + 8, fieldBot - 8, 9);

    // module sections across the top
    drawModuleHeaders(g, st, dom, lang, x0, x1, fieldTop);

    var hidden = st.hidden || {};
    var events = allEvents(data).filter(function (e) { return !hidden[e.layer]; });
    indexEvents(events);

    // central spine (course)
    g.appendChild(el('line', { x1: x0, y1: cy, x2: x1, y2: cy, stroke: 'var(--myc-line-primary)', 'stroke-width': '1.6', 'stroke-linecap': 'round', filter: 'url(#evoGlow)', opacity: '0.7' }));

    // XP filament above the spine
    if (!hidden.xp_gain) {
      var xp = data.layers.xp_gain || [];
      if (xp.length) {
        var maxC = xp[xp.length - 1].cumulative || 1, d = '', f = true;
        xp.forEach(function (pt) { var y = cy - 12 - 30 * (pt.cumulative / maxC); d += (f ? 'M' : 'L') + xOf(pt.t).toFixed(1) + ' ' + y.toFixed(1); f = false; });
        g.appendChild(el('path', { d: d, fill: 'none', stroke: 'url(#evoXp)', 'stroke-width': '2', 'stroke-linecap': 'round', filter: 'url(#evoGlowSoft)', opacity: '0.5' }));
        g.appendChild(el('path', { d: d, fill: 'none', stroke: 'url(#evoXp)', 'stroke-width': '1.6', 'stroke-linecap': 'round' }));
      }
    }

    // nodes — scattered across the whole field. D п.23: a short d3-force pass
    // spreads them on X=time / Y=layer-band with collision, so events never pile
    // into a single column when timestamps cluster. Practices ride the spine.
    var sim = events.map(function (e, i) {
      var isInsight = e.layer === 'insight';
      var onSpine = e.layer === 'practice';
      var r = isInsight ? 3.6 : (onSpine ? 3.8 : (2.2 + Math.min(2.6, Math.log(1 + e.weight))));
      var tx = xOf(e.t);
      var ty = onSpine ? cy : yOfLayer(e.layer, i);
      return { e: e, i: i, isInsight: isInsight, onSpine: onSpine, r: r,
               tx: tx, ty: ty, x: tx + (jit(i) - 0.5) * 6, y: ty };
    });
    if (window.d3 && window.d3.forceSimulation) {
      var fsim = window.d3.forceSimulation(sim)
        .force('x', window.d3.forceX(function (d) { return d.tx; }).strength(0.92)) // hug true time
        .force('y', window.d3.forceY(function (d) { return d.ty; }).strength(function (d) { return d.onSpine ? 0.9 : 0.16; }))
        .force('collide', window.d3.forceCollide(function (d) { return d.r + 1.6; }).iterations(2))
        .stop();
      for (var ti = 0; ti < 150; ti++) fsim.tick();
    }
    var nodeLayer = el('g');
    sim.forEach(function (d) {
      var e = d.e, st2 = valStyle(e.valence);
      var px = Math.max(x0, Math.min(x1, d.x));
      var yy = d.onSpine ? cy : Math.max(fieldTop + 4, Math.min(fieldBot - 4, d.y));
      var vis = el('circle', { cx: px.toFixed(1), cy: yy.toFixed(1), r: d.r.toFixed(1),
        fill: d.isInsight ? 'var(--myc-cyan)' : (d.onSpine ? 'var(--myc-bg-2)' : st2.c),
        stroke: d.onSpine ? 'var(--myc-line-primary)' : 'none', 'stroke-width': d.onSpine ? '1.4' : '0',
        opacity: d.isInsight ? 0.95 : st2.o });
      if (d.isInsight || d.onSpine || e.valence === 'positive') vis.setAttribute('filter', 'url(#evoGlow)');
      vis.appendChild(titleNode(e, lang));
      registerNode(e.id, px, parseFloat(yy.toFixed(1)));
      nodeLayer.appendChild(interactiveNode(vis, e, container, lang));
    });

    drawFilaments(g, data, events);   // filaments under nodes
    g.appendChild(nodeLayer);

    // "now" marker on the spine + time axis
    nowMarker(g, xOf(dom.to), cy);
    drawTimeAxis(g, dom, lang, x0, x1);

    svg.appendChild(g);
  }

  function titleNode(e, lang) {
    var t = el('title');
    t.textContent = prettyTitle(e, lang) + (e.valence && e.valence !== 'neutral' ? ' · ' + e.valence : '');
    return t;
  }

  /* ── view: LAYERS (horizontal lanes, wavy baselines) ────────────────────── */
  function renderLayers(svg, W, data, lang, container, st) {
    var dom = domain(data);
    var padL = 96, padR = 150, padTop = 46, padBot = 30;
    var x0 = padL, x1 = W - padR;
    var hidden = st.hidden || {};
    var lanes = LAYERS.filter(function (l) { return !hidden[l.key]; });
    if (!lanes.length) lanes = LAYERS.slice();
    var laneH = (H - padTop - padBot) / lanes.length;
    var xOf = function (t) { return x0 + clamp01((tms(t) - dom.from) / dom.span) * (x1 - x0); };
    var g = el('g', { 'class': 'myc-fade' });

    // module sections across the top
    drawModuleHeaders(g, st, dom, lang, x0, x1, padTop);

    var allEv = allEvents(data);
    indexEvents(allEv);

    lanes.forEach(function (ly, li) {
      var cyL = padTop + laneH * li + laneH / 2;
      // wavy baseline
      var d = '', f = true;
      for (var px = x0; px <= x1; px += 14) {
        var y = cyL + Math.sin(px * 0.012 + li) * 3.2;
        d += (f ? 'M' : 'L') + px.toFixed(1) + ' ' + y.toFixed(1); f = false;
      }
      g.appendChild(el('path', { d: d, fill: 'none', stroke: 'var(--myc-line-faint)', 'stroke-width': '1' }));
      var lab = el('text', { x: 10, y: (cyL + 3).toFixed(1), 'class': 'myc-lane-label' });
      lab.textContent = L(ly.label, lang);
      g.appendChild(lab);
      var baseY = function (px) { return cyL + Math.sin(px * 0.012 + li) * 3.2; };

      if (ly.key === 'xp_gain') {
        var xp = data.layers.xp_gain || [];
        if (xp.length) {
          var maxC = xp[xp.length - 1].cumulative || 1, dd = '', ff = true;
          xp.forEach(function (pt) { var y = cyL + laneH * 0.34 - (laneH * 0.62) * (pt.cumulative / maxC); dd += (ff ? 'M' : 'L') + xOf(pt.t).toFixed(1) + ' ' + y.toFixed(1); ff = false; });
          g.appendChild(el('path', { d: dd, fill: 'none', stroke: 'var(--myc-green-deep)', 'stroke-width': '1.8', 'stroke-linecap': 'round', filter: 'url(#evoGlow)' }));
          // level tag at the end
          var last = xp[xp.length - 1];
          var lvlTxt = el('text', { x: (xOf(last.t) - 4).toFixed(1), y: (cyL + laneH * 0.34 - (laneH * 0.62) - 4).toFixed(1), 'text-anchor': 'end', 'class': 'evo-axis-label' });
          lvlTxt.textContent = (st.user && st.user.level ? (L(STR.level, lang) + ' ' + st.user.level) : ('+' + (last.cumulative || 0) + ' XP'));
          g.appendChild(lvlTxt);
        }
        return;
      }
      var laneNodes = el('g');
      (data.layers[ly.key] || []).forEach(function (e, i) {
        var stl = ly.key === 'insight' ? { c: 'var(--myc-cyan)', o: 0.95 } : valStyle(e.valence);
        var r = (ly.key === 'practice') ? 3.0 : (2.2 + Math.min(2.6, Math.log(1 + (e.weight || 1))));
        var px = xOf(e.t);
        var ev = normEvent(e, ly.key);
        var vis = el('circle', { cx: px.toFixed(1), cy: baseY(px).toFixed(1), r: r.toFixed(1), fill: stl.c, opacity: stl.o });
        if (stl.c.indexOf('green') > -1 || stl.c.indexOf('cyan') > -1) vis.setAttribute('filter', 'url(#evoGlow)');
        vis.appendChild(titleNode(ev, lang));
        registerNode(e.id, px, parseFloat(baseY(px).toFixed(1)));
        laneNodes.appendChild(interactiveNode(vis, ev, container, lang, 18));
      });
      g.appendChild(laneNodes);
    });

    drawFilaments(g, data, allEv);
    drawTimeAxis(g, dom, lang, x0, x1);
    svg.appendChild(g);
  }

  function normEvent(p, layer) {
    return { id: p.id, layer: p.layer || layer, t: tms(p.t || p.occurred_at), occurred_at: p.occurred_at,
             label: p.label, valence: p.valence || 'neutral', weight: p.weight || 1, kind: p.kind || layer,
             source: p.source, payload: p.payload || {}, links: p.links || [] };
  }

  /* ── view: FIELD (single character — avatar + organic field, NO dartboard) ── */
  function renderField(svg, W, data, ag, st, lang) {
    var g = el('g', { 'class': 'myc-fade' });
    var fieldX0 = 250, cx = fieldX0 + (W - fieldX0) * 0.46, cy = H / 2;
    var minDim = Math.min(W - fieldX0, H);
    var R = (0.30 + 0.55 * ag.spread) * minDim * 0.72;

    // soft energy field (no concentric target rings — organic instead)
    g.appendChild(el('circle', { cx: cx, cy: cy, r: R, fill: 'url(#evoField)', opacity: (0.4 + 0.6 * ag.brightness).toFixed(2) }));

    // organic filaments radiating through the field
    var fil = el('g', { opacity: '0.9' });
    var strands = 14 + Math.round(10 * ag.density);
    for (var i = 0; i < strands; i++) {
      var a0 = jit(i) * Math.PI * 2, a1 = a0 + (jit(i + 3) - 0.5) * 1.2;
      var r0 = R * (0.15 + 0.2 * jit(i + 1)), r1 = R * (0.7 + 0.3 * jit(i + 7));
      var x0p = cx + Math.cos(a0) * r0, y0p = cy + Math.sin(a0) * r0;
      var x1p = cx + Math.cos(a1) * r1, y1p = cy + Math.sin(a1) * r1;
      var mx = cx + Math.cos((a0 + a1) / 2) * (r0 + r1) / 2 * (0.7 + 0.5 * jit(i + 11));
      var my = cy + Math.sin((a0 + a1) / 2) * (r0 + r1) / 2 * (0.7 + 0.5 * jit(i + 13));
      fil.appendChild(el('path', { d: 'M' + x0p.toFixed(1) + ' ' + y0p.toFixed(1) + ' Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + x1p.toFixed(1) + ' ' + y1p.toFixed(1),
        fill: 'none', stroke: (i % 3 === 0 ? 'var(--myc-green)' : 'var(--myc-cyan)'), 'stroke-width': '0.7', opacity: (0.08 + 0.10 * ag.brightness).toFixed(3) }));
    }
    g.appendChild(fil);

    // crisis tint only when turbulence is high
    if (ag.turbulence > 0.6) g.appendChild(el('circle', { cx: cx, cy: cy, r: R * 0.9, fill: 'none', stroke: 'var(--myc-wine)', 'stroke-width': '2', opacity: '0.5', filter: 'url(#evoGlowSoft)' }));

    // insight points floating
    (data.layers.insight || []).slice(-10).forEach(function (e, i) {
      var a = jit(i) * Math.PI * 2, rad = R * (0.3 + 0.6 * jit(i + 3));
      g.appendChild(el('circle', { cx: (cx + Math.cos(a) * rad).toFixed(1), cy: (cy + Math.sin(a) * rad).toFixed(1), r: 2.6, fill: 'var(--myc-cyan)', filter: 'url(#evoGlow)' }));
    });

    // pulsing "now" marker at the centre (small round, not a target)
    nowMarker(g, cx, cy);
    svg.appendChild(g);
  }

  /* ── chrome + orchestration ─────────────────────────────────────────────── */
  function mountEvolutionPath(container, opts) {
    if (!container) return;
    opts = opts || {};
    var lang = opts.lang || (typeof window.getLang === 'function' ? window.getLang() : 'ru');
    var apiBase = opts.apiBase || window.AUTH_API || '';
    var token = opts.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('na_token') : '');
    var st = container.__evo || { mode: opts.mode || 'tunnel', period: opts.period || 'month', cursor: 1, hidden: {} };
    if (st.mode === 'field') st.mode = 'tunnel'; // D п.17: «Персонаж» mode retired
    container.__evo = st;

    container.classList.add('myc-root');
    container.style.padding = '16px 16px 14px';
    container.innerHTML = buildChrome(st, lang) +
      '<div class="myc-evo-canvas" style="position:relative;min-height:' + H + 'px;"></div>';

    wireChrome(container, st, lang, function () { mountEvolutionPath(container, opts); });

    var canvas = container.querySelector('.myc-evo-canvas');
    canvas.innerHTML = '<div class="myc-empty"><div class="myc-empty-glyph">✦</div><div class="myc-empty-text">' + L(STR.loading, lang) + '</div></div>';

    // fetch evolution + user xp + (best-effort) course modules in parallel
    var hdr = token ? { 'Authorization': 'Bearer ' + token } : {};
    var jget = function (url) { return fetch(apiBase + url, { headers: hdr }).then(function (r) { return r.json(); }).catch(function () { return null; }); };

    Promise.all([
      jget('/api/users/me/evolution?period=' + encodeURIComponent(st.period)),
      st.user ? Promise.resolve(null) : jget('/api/users/me/xp'),
      st.modules ? Promise.resolve(null) : fetchModules(jget)
    ]).then(function (res) {
      var data = res[0];
      if (!data || data.error) throw new Error(data && data.error || 'no data');
      if (res[1]) st.user = buildUser(res[1]);
      if (!st.user) st.user = buildUser(null);
      if (res[2]) st.modules = res[2];
      st.data = maybeDemo(data, st, lang);
      requestAnimationFrame(function () { paint(container, st, lang); });
      // repaint once the canvas reaches its real width (handles the layout race
      // and later window/tab resizes) — guarded so it never loops.
      if (!st._ro && typeof ResizeObserver === 'function') {
        st._ro = new ResizeObserver(function () {
          var cv = container.querySelector('.myc-evo-canvas');
          if (!cv || !st.data) return;
          var w = measureW(cv, container);
          if (Math.abs(w - (st._w || 0)) > 40) paint(container, st, lang);
        });
        try { st._ro.observe(container); } catch (e) {}
      }
    }).catch(function (e) {
      console.warn('EvolutionPath:', e);
      canvas.innerHTML = '<div class="myc-empty"><div class="myc-empty-glyph">⊘</div><div class="myc-empty-text">' + L(STR.fail, lang) + '</div></div>';
    });
  }

  // pull modules from the user's active/first course (block_type section/module)
  function fetchModules(jget) {
    return jget('/api/courses').then(function (d) {
      var courses = (d && d.courses) || [];
      if (!courses.length) return null;
      var slug = courses[0].slug;
      // pick the course with the most progress if available
      courses.forEach(function (c) { if ((c.done_blocks || 0) > 0) slug = c.slug; });
      return jget('/api/courses/' + encodeURIComponent(slug)).then(function (cd) {
        var blocks = (cd && cd.blocks) || [];
        var lang = (typeof window.getLang === 'function') ? window.getLang() : 'ru';
        // D п.20: resolve the section title across languages and treat the
        // creation placeholders ('Новый раздел'/'Новый курс'/empty) as "no name"
        // so the header falls back to «Модуль N» instead of repeating the stub.
        var PLACEHOLDERS = { 'новый раздел': 1, 'новый курс': 1, 'new section': 1, 'new module': 1, '': 1 };
        var mods = blocks.filter(function (b) { return b.block_type === 'section' || b.block_type === 'module'; })
          .sort(function (a, b) { return (a.order_idx || 0) - (b.order_idx || 0); })
          .map(function (b) {
            var nm = (b['title_' + lang] || b.title_ru || b.title_en || b.title_es || '').trim();
            return PLACEHOLDERS[nm.toLowerCase()] ? '' : nm; // '' → drawn as «Модуль N»
          });
        // keep the array length (so module count/positions stay real) but only
        // return it when at least one section exists.
        return mods.length ? mods : null;
      });
    }).catch(function () { return null; });
  }

  function buildUser(xp) {
    var cu = (typeof window.currentUser !== 'undefined' && window.currentUser) ? window.currentUser : null;
    return {
      name: (cu && cu.name) || '',
      avatar: (cu && cu.avatar_url) || '',
      level: (xp && xp.current_level) || (cu && cu.current_level) || 1,
      xp: (xp && xp.total_xp) || 0,
      xpNext: (xp && xp.next_level_at) || 100,
      isAdmin: typeof window.naIsAdmin === 'function' ? window.naIsAdmin(cu) : false
    };
  }

  /* ── 🅲️ demo seed: when there is no data and the viewer is an admin (or ?demo=1),
     synthesize a full field so the layout can be reviewed. Synthetic events are
     clickable (so the detail card can be inspected) but tagged demo. ──────────── */
  function maybeDemo(data, st, lang) {
    var total = Object.keys(data.totals || {}).reduce(function (s, k) { return k === 'xp_total' ? s : s + (data.totals[k] || 0); }, 0);
    var wantDemo = /[?&]demo=1/.test(location.search) || (!total && st.user && st.user.isAdmin);
    if (total || !wantDemo) { st.isDemo = false; return data; }
    st.isDemo = true;
    return synthDemo(data.range, lang);
  }
  function synthDemo(range, lang) {
    var from = tms(range && range.from) || (Date.now() - 30 * 864e5);
    var to = tms(range && range.to) || Date.now();
    if (to <= from) to = from + 864e5;
    var span = to - from;
    var layers = { practice: [], emotion: [], event: [], thought: [], sensation: [], insight: [], xp_gain: [] };
    var events = [], links = [], id = 1;
    var plan = [
      ['emotion', 16, ['positive', 'negative', 'neutral']],
      ['practice', 10, ['neutral']],
      ['event', 9, ['neutral', 'negative']],
      ['thought', 11, ['neutral', 'positive']],
      ['sensation', 12, ['neutral', 'positive', 'negative']],
      ['insight', 6, ['positive']]
    ];
    var demoTitles = {
      emotion: ['Спокойствие', 'Тревога', 'Радость', 'Раздражение', 'Интерес'],
      practice: ['Дыхание 4-7-8', 'Сканирование тела', 'Фокус-сессия', 'Заземление'],
      event: ['Совещание', 'Звонок', 'Прогулка', 'Дедлайн'],
      thought: ['«Я справлюсь»', 'Сомнение', 'План на день', 'Анализ ситуации'],
      sensation: ['Тепло в груди', 'Напряжение в плечах', 'Лёгкость', 'Покалывание'],
      insight: ['Замечаю паттерн избегания', 'Связь стресса и сна', 'Опора на дыхание']
    };
    plan.forEach(function (row) {
      var layer = row[0], n = row[1], vals = row[2];
      for (var i = 0; i < n; i++) {
        var t = new Date(from + span * ((i + 0.5) / n) + (jit(id) - 0.5) * span * 0.05).toISOString();
        var titles = demoTitles[layer];
        var e = { id: 'demo_' + (id++), kind: layer, layer: layer, source: (layer === 'sensation' ? 'sensation' : (layer === 'insight' ? 'diary' : 'neuromap')),
          occurred_at: t, t: t, label: titles[i % titles.length], valence: vals[i % vals.length],
          weight: 1 + Math.round(jit(id) * 3), payload: { source: 'demo', comment: 'демо-данные', intensity: 1 + Math.round(jit(id) * 9) }, links: [], demo: true };
        layers[layer].push(e); events.push(e);
      }
    });
    // a cumulative xp curve
    var cum = 0;
    for (var k = 0; k < 12; k++) {
      cum += 20 + Math.round(jit(k + 40) * 40);
      layers.xp_gain.push({ t: new Date(from + span * (k / 12)).toISOString(), amount: 20, cumulative: cum });
    }
    // a few cross-layer links between near-in-time events
    events.sort(function (a, b) { return tms(a.t) - tms(b.t); });
    for (var j = 1; j < events.length; j += 4) {
      var a = events[j - 1], b = events[j];
      if (a.layer !== b.layer) {
        links.push({ a: a.id, b: b.id, kind: 'correlation', weight: 1 });
        a.links.push({ to: b.id, kind: 'correlation' }); b.links.push({ to: a.id, kind: 'correlation' });
      }
    }
    events.sort(function (a, b) { return tms(a.t) - tms(b.t); });
    var ag = recompute(events);
    return {
      ok: true, demo: true, range: { from: new Date(from).toISOString(), to: new Date(to).toISOString(), period: range && range.period || 'month' },
      layers: layers, events: events, links: links,
      aggregates: { positivity: ag.positivity, turbulence: ag.turbulence, activity: ag.activity, consistency: 0.5,
        brightness: ag.brightness, amplitude: 0.6, density: ag.density, spread: ag.spread },
      totals: { xp_total: cum, practices: layers.practice.length, emotions: layers.emotion.length, events: layers.event.length, thoughts: layers.thought.length, sensations: layers.sensation.length, insights: layers.insight.length }
    };
  }

  function buildChrome(st, lang) {
    function seg(items, active, attr) {
      return '<div class="myc-seg" data-seg="' + attr + '">' + items.map(function (it) {
        return '<button data-val="' + it.key + '"' + (it.key === active ? ' class="is-active"' : '') + '>' + L(it.label, lang) + '</button>';
      }).join('') + '</div>';
    }
    // 🅲️ C7: drop the technical subtitle; keep a short human one
    return '<div class="myc-evo-head">' +
      '<div><h3 class="myc-evo-title">' + L(STR.title, lang) + '</h3>' +
      '<p class="myc-evo-sub">' + L(STR.sub, lang) + '</p></div>' +
      '<div class="myc-controls">' + seg(MODES, st.mode, 'mode') + seg(PERIODS, st.period, 'period') + '</div></div>';
  }

  function wireChrome(container, st, lang, rerender) {
    container.querySelectorAll('.myc-seg').forEach(function (segEl) {
      var kind = segEl.getAttribute('data-seg');
      segEl.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          var val = b.getAttribute('data-val');
          if (kind === 'mode') {
            if (st.mode === val) return;
            st.mode = val;
            if (st.data) {
              segEl.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-active', x === b); });
              paint(container, st, lang); return;
            }
          } else {
            if (st.period === val) return;
            st.period = val; st.cursor = 1; st.data = null; // 🅲️ C8: refetch on period change
          }
          rerender();
        });
      });
    });
  }

  function paint(container, st, lang) {
    var canvas = container.querySelector('.myc-evo-canvas');
    canvas.innerHTML = '';
    POS = {};
    var data = st.data;
    var totalEvents = Object.keys(data.totals || {}).reduce(function (s, k) { return k === 'xp_total' ? s : s + (data.totals[k] || 0); }, 0);
    if (!totalEvents) {
      canvas.innerHTML = '<div class="myc-empty"><div class="myc-empty-glyph">✦</div><div class="myc-empty-text">' + L(STR.empty, lang) + '</div></div>';
      return;
    }
    var W = measureW(canvas, container);
    st._w = W;
    var svg = newSvg(W);
    canvas.appendChild(svg);

    if (st.mode === 'layers') {
      renderLayers(svg, W, data, lang, container, st);
      addLayerToggles(container, canvas, st, lang);
    } else {
      renderTunnel(svg, W, data, container, lang, st);
      addUserPanel(canvas, st, lang);
      // D п.17: stat-card (Уровень / Рост XP / Эмоция / Состояние / Активность)
      // relocated here from the removed «Персонаж» mode.
      addCharacterStats(canvas, st, data, data.aggregates || {}, lang);
      addLayerToggles(container, canvas, st, lang);
    }
    if (st.isDemo) addDemoBadge(canvas, lang);
  }

  // field mode adds a time-cursor + a character stat card; no module grid/axis
  function renderFieldMode(container, canvas, svg, W, data, lang, st) {
    var events = allEvents(data), dom = domain(data);
    function agAt(cur) {
      if (cur >= 1 || !events.length) return data.aggregates;
      var cutoff = dom.from + dom.span * cur;
      var sub = events.filter(function (e) { return e.t <= cutoff; });
      return sub.length ? recompute(sub) : data.aggregates;
    }
    renderField(svg, W, data, agAt(st.cursor), st, lang);
    addCharacterPanel(canvas, st, data, lang);
    addCharacterStats(canvas, st, data, agAt(st.cursor), lang);

    var scrub = document.createElement('div');
    scrub.className = 'myc-scrub';
    var pct = Math.round(st.cursor * 100);
    scrub.innerHTML = '<span>' + L(STR.now, lang) + '</span>' +
      '<input type="range" min="0" max="100" value="' + pct + '">' +
      '<span class="myc-scrub-val">' + (st.cursor >= 1 ? L(STR.now, lang) : pct + '%') + '</span>';
    canvas.appendChild(scrub);
    var input = scrub.querySelector('input');
    input.addEventListener('input', function () {
      st.cursor = (+input.value) / 100;
      var oldSvg = canvas.querySelector('svg'); if (oldSvg) oldSvg.remove();
      var W2 = measureW(canvas, container);
      var s2 = newSvg(W2);
      canvas.insertBefore(s2, canvas.firstChild);
      renderField(s2, W2, data, agAt(st.cursor), st, lang);
      var old = canvas.querySelector('.evo-char-stats'); if (old) old.remove();
      addCharacterStats(canvas, st, data, agAt(st.cursor), lang);
      scrub.querySelector('.myc-scrub-val').textContent = st.cursor >= 1 ? L(STR.now, lang) : Math.round(st.cursor * 100) + '%';
    });
  }

  /* ── overlays ───────────────────────────────────────────────────────────── */
  function avatarMarkup(user, size) {
    if (user && user.avatar) return '<img class="evo-avatar" src="' + escapeHtml(user.avatar) + '" style="width:' + size + 'px;height:' + size + 'px;">';
    return '<div class="evo-avatar evo-avatar-ph" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.36) + 'px;">' + escapeHtml(initials(user && user.name)) + '</div>';
  }
  function addUserPanel(canvas, st, lang) {
    var u = st.user || {};
    var panel = document.createElement('div');
    panel.className = 'evo-user-panel';
    panel.innerHTML =
      avatarMarkup(u, 44) +
      '<div class="evo-user-meta"><div class="evo-user-name">' + escapeHtml(u.name || '—') + '</div>' +
      '<div class="evo-user-lvl">' + L(STR.level, lang) + ' ' + (u.level || 1) + '</div>' +
      '<div class="evo-user-xp">' + (u.xp || 0) + ' / ' + (u.xpNext || 100) + ' XP</div></div>';
    canvas.appendChild(panel);
  }
  function addLayerToggles(container, canvas, st, lang) {
    st.hidden = st.hidden || {};
    var box = document.createElement('div');
    box.className = 'evo-layer-toggles';
    box.innerHTML = '<div class="evo-lt-title">' + L(STR.layersTitle, lang) + '</div>' +
      LAYERS.map(function (l) {
        var on = !st.hidden[l.key];
        return '<label class="evo-lt-row"><input type="checkbox" data-layer="' + l.key + '"' + (on ? ' checked' : '') + '>' +
          '<span>' + L(l.label, lang) + '</span></label>';
      }).join('');
    canvas.appendChild(box);
    box.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var key = cb.getAttribute('data-layer');
        if (cb.checked) delete st.hidden[key]; else st.hidden[key] = true;
        paint(container, st, lang);
      });
    });
  }
  function addCharacterPanel(canvas, st, data, lang) {
    var u = st.user || {};
    var panel = document.createElement('div');
    panel.className = 'evo-char-panel';
    panel.innerHTML =
      avatarMarkup(u, 96) +
      '<div class="evo-char-name">' + escapeHtml(u.name || '—') + '</div>' +
      '<div class="evo-char-sub">' + L(STR.level, lang) + ' ' + (u.level || 1) + ' · ' + (u.xp || 0) + ' XP</div>' +
      '<button class="evo-char-profile">' + L(STR.openProfile, lang) + '</button>';
    canvas.appendChild(panel);
    var pb = panel.querySelector('.evo-char-profile');
    if (pb) pb.addEventListener('click', function () { if (typeof window.switchTab === 'function') window.switchTab('profile'); });
  }
  function addCharacterStats(canvas, st, data, ag, lang) {
    var emo = (data.layers.emotion || []);
    var counts = {};
    emo.forEach(function (e) { var v = e.valence || 'neutral'; counts[v] = (counts[v] || 0) + 1; });
    var dom = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    var emoLabel = dom === 'positive' ? { ru: 'Позитив', en: 'Positive', es: 'Positivo' } :
                   dom === 'negative' ? { ru: 'Напряжение', en: 'Tension', es: 'Tensión' } :
                   { ru: 'Ровная', en: 'Neutral', es: 'Neutral' };
    var stateKey = ag.turbulence > 0.55 ? 'turbul' : (ag.brightness > 0.6 ? 'bright' : (ag.brightness > 0.45 ? 'calm' : 'neutral'));
    var allEv = allEvents(data);
    var last = allEv.length ? allEv[allEv.length - 1] : null;
    var box = document.createElement('div');
    box.className = 'evo-char-stats';
    function row(k, v) { return '<div class="evo-cs-row"><span>' + escapeHtml(k) + '</span><b>' + escapeHtml(v) + '</b></div>'; }
    box.innerHTML =
      row(L(CHAR_STR.level, lang), String((st.user && st.user.level) || 1)) +
      row(L(CHAR_STR.xpgrowth, lang), '+' + (data.totals.xp_total || 0) + ' XP') +
      row(L(CHAR_STR.emotion, lang), L(emoLabel, lang)) +
      row(L(CHAR_STR.state, lang), L(STATE_LABEL[stateKey], lang)) +
      row(L(CHAR_STR.last, lang), last ? fmtAxis(last.t, lang) : L(CHAR_STR.none, lang));
    canvas.appendChild(box);
  }
  function addDemoBadge(canvas, lang) {
    var b = document.createElement('div');
    b.className = 'evo-demo-badge';
    b.textContent = '◇ ' + L(STR.demoBadge, lang);
    canvas.appendChild(b);
  }

  window.mountEvolutionPath = mountEvolutionPath;
})();
