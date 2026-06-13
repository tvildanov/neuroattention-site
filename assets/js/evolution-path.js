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
      try { openMiniNeuromap(container, ev, lang); }   // rework: mini-neuromap, same as tunnel
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
    var hasMods = st.modules && st.modules.length;
    // #8: 21 modules across a fixed width pile their labels on top of each other.
    // Show every Nth label so each gets ≥MIN_SLOT px, and truncate to the label's
    // own slot width. Divider lines stay for every section (they're faint).
    var slotW = secs.length ? (x1 - x0) / secs.length : (x1 - x0);
    var MIN_SLOT = 128;                                   // px each shown label needs
    var step = Math.max(1, Math.ceil(MIN_SLOT / Math.max(1, slotW)));
    var charPx = 6.6;                                     // ~px per char at this font
    var prefixChars = hasMods ? (String(secs.length).length + 3) : 0; // "21 · "
    // chars available within the inter-label spacing, minus the index prefix
    var maxChars = Math.max(4, Math.floor((slotW * step - 16) / charPx) - prefixChars);
    secs.forEach(function (s, i) {
      var sx0 = x0 + (x1 - x0) * s.frac0, sx1 = x0 + (x1 - x0) * s.frac1, mid = (sx0 + sx1) / 2;
      if (i > 0) g.appendChild(el('line', { x1: sx0, y1: yTop, x2: sx0, y2: H - 30,
        stroke: 'var(--myc-line-faint)', 'stroke-width': '1' }));
      // Always show first + last; otherwise thin to every `step`-th label.
      var show = (i % step === 0) || (i === secs.length - 1);
      if (!show) return;
      var t = el('text', { x: mid.toFixed(1), y: (yTop - 14).toFixed(1), 'text-anchor': 'middle', 'class': 'evo-mod-num' });
      // D п.20: real names when present; «Модуль N» fallback for empty/placeholder.
      var nm = truncate(s.label, maxChars);
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

  /* ── view: PATH OF DEVELOPMENT (rework) ───────────────────────────────────
     One white light-spine runs left→right through time (registration → now).
     Every instrument entry is a mycelium branch off the spine on the day it
     happened; Y of the tip is a soft hint by type (emotions up, sensations down,
     practices far below w/ green glow, insights highest). Real journey_links are
     drawn as glowing chains between node tips — no decorative filler. Infinite
     horizontal pan (wheel / drag), ctrl+wheel zooms the time scale, period
     buttons just recentre on a window. Clicking a node opens a mini-neuromap. */

  // soft Y-offset of a branch tip from the spine, as a fraction of the half-field
  var BRANCH_DY = { insight: -0.86, emotion: -0.58, thought: -0.34, event: -0.05,
                    sensation: 0.40, practice: 0.72, xp_gain: -0.20 };
  // days covered by each period preset (controls the default zoom, not a crop)
  var PERIOD_DAYS = { day: 1, week: 7, month: 30, '3months': 90, year: 365, all: 1460 };
  var DAY_MS = 864e5;

  function nodeShape(layer, cx, cy, r) {
    if (layer === 'practice') {
      var s = r * 1.0;
      return el('rect', { x: (cx - s).toFixed(1), y: (cy - s).toFixed(1), width: (s * 2).toFixed(1), height: (s * 2).toFixed(1), rx: 1.4 });
    }
    if (layer === 'insight') {
      // 4-point star
      var R = r * 1.5, rr = r * 0.55, d = '';
      for (var k = 0; k < 8; k++) {
        var ang = Math.PI * k / 4 - Math.PI / 2, rad = (k % 2 === 0) ? R : rr;
        d += (k === 0 ? 'M' : 'L') + (cx + Math.cos(ang) * rad).toFixed(1) + ' ' + (cy + Math.sin(ang) * rad).toFixed(1);
      }
      return el('path', { d: d + 'Z' });
    }
    return el('circle', { cx: cx.toFixed(1), cy: cy.toFixed(1), r: r.toFixed(1) });
  }
  function layerFill(layer, valence) {
    if (layer === 'emotion') return valStyle(valence).c;
    if (layer === 'insight') return 'var(--myc-cyan)';
    if (layer === 'practice') return '#8DFFC8';
    if (layer === 'thought') return 'rgb(200,180,240)';
    if (layer === 'sensation') return 'rgb(140,180,255)';
    if (layer === 'event') return 'rgb(100,220,180)';
    return valStyle(valence).c;
  }

  // compute / persist the pan-zoom view on st.view
  function ensureView(st, data, x0, x1) {
    var dom = domain(data);
    // origin = registration (if known) else earliest event else range.from
    var reg = st.user && st.user.createdAt ? tms(st.user.createdAt) : 0;
    var evs = allEvents(data);
    var earliest = evs.length ? evs[0].t : dom.from;
    var originT = Math.min(reg || earliest, earliest, dom.from);
    var nowT = Math.max(dom.to, evs.length ? evs[evs.length - 1].t : dom.to);
    if (!st.view || st.view._fieldW == null) {
      var days = PERIOD_DAYS[st.period] || 30;
      var pxPerDay = (x1 - x0) / days;
      // place "now" near the right edge
      var v = { originT: originT, nowT: nowT, pxPerDay: pxPerDay, panX: 0, _fieldW: (x1 - x0) };
      var wxNow = (nowT - originT) / DAY_MS * pxPerDay;
      v.panX = (x1 - 40) - wxNow; // now sits ~40px from the right edge
      st.view = v;
    } else {
      st.view.originT = originT; st.view.nowT = nowT; st.view._fieldW = (x1 - x0);
    }
    return st.view;
  }

  function renderTunnel(svg, W, data, container, lang, st) {
    var padL = 168, padR = 150, padTop = 50, padBot = 34;
    var x0 = padL, x1 = W - padR;
    var fieldTop = padTop, fieldBot = H - padBot, fieldH = fieldBot - fieldTop, cy = (fieldTop + fieldBot) / 2;
    var half = fieldH / 2 - 10;
    var view = ensureView(st, data, x0, x1);
    var hidden = st.hidden || {};

    // world X for a time (before pan). The world <g> is translated by panX.
    var wx = function (t) { return (tms(t) - view.originT) / DAY_MS * view.pxPerDay; };
    var spineY = function (worldX) { return cy + 4 * Math.sin(worldX * 0.012); };
    var tipY = function (layer, i) {
      var dy = (BRANCH_DY[layer] != null ? BRANCH_DY[layer] : 0) * half;
      return cy + dy + (jit(i) - 0.5) * half * 0.20;
    };

    var wxOrigin = wx(view.originT), wxNow = wx(view.nowT);

    // clip so panned content never spills over the side panels
    var clipId = 'evoClip' + (st._isOverlay ? 'O' : 'E');
    var defs = svg.querySelector('defs') || svg.insertBefore(el('defs'), svg.firstChild);
    var clip = el('clipPath', { id: clipId });
    clip.appendChild(el('rect', { x: x0 - 6, y: 0, width: (x1 - x0) + 12, height: H }));
    defs.appendChild(clip);

    var viewport = el('g', { 'clip-path': 'url(#' + clipId + ')' });
    svg.appendChild(viewport);
    var world = el('g', { 'class': 'evo-world myc-fade', transform: 'translate(' + view.panX.toFixed(1) + ',0)' });
    viewport.appendChild(world);

    // faint depth grid across the world (vertical day-ish ticks)
    var grid = el('g', { opacity: '0.5' });
    var gridStep = Math.max(60, view.pxPerDay * 2);
    for (var gx = wxOrigin; gx <= wxNow + gridStep; gx += gridStep)
      grid.appendChild(el('line', { x1: gx.toFixed(1), y1: fieldTop, x2: gx.toFixed(1), y2: fieldBot, stroke: 'var(--myc-line-faint)', 'stroke-width': '1' }));
    world.appendChild(grid);

    // module headers across the world (spread over the full time range)
    drawModuleHeaders(world, st, { from: view.originT, to: view.nowT, span: (view.nowT - view.originT) }, lang, wxOrigin, wxNow, fieldTop);

    // ── the spine: base + bright "lived" tract + soft glow, breathing slightly ──
    function spinePath(a, b) {
      var d = '', f = true;
      for (var px = a; px <= b; px += 10) { d += (f ? 'M' : 'L') + px.toFixed(1) + ' ' + spineY(px).toFixed(1); f = false; }
      d += 'L' + b.toFixed(1) + ' ' + spineY(b).toFixed(1);
      return d;
    }
    world.appendChild(el('path', { d: spinePath(wxOrigin, wxNow), fill: 'none', stroke: 'var(--myc-line-secondary)', 'stroke-width': '1.4', 'stroke-linecap': 'round', opacity: '0.45' }));
    world.appendChild(el('path', { d: spinePath(wxOrigin, wxNow), fill: 'none', stroke: 'rgba(255,255,255,0.88)', 'stroke-width': '2', 'stroke-linecap': 'round', filter: 'url(#evoGlow)' }));

    var events = allEvents(data).filter(function (e) { return !hidden[e.layer]; });
    indexEvents(events);

    // ── XP light filament above the spine ──
    if (!hidden.xp_gain) {
      var xp = data.layers.xp_gain || [];
      if (xp.length) {
        var maxC = xp[xp.length - 1].cumulative || 1, dd = '', ff = true;
        xp.forEach(function (pt) { var X = wx(pt.t), y = spineY(X) - 12 - 28 * (pt.cumulative / maxC); dd += (ff ? 'M' : 'L') + X.toFixed(1) + ' ' + y.toFixed(1); ff = false; });
        world.appendChild(el('path', { d: dd, fill: 'none', stroke: 'url(#evoXp)', 'stroke-width': '1.6', 'stroke-linecap': 'round', opacity: '0.85' }));
      }
    }

    // ── branches + nodes ──
    POS = {};
    // label visibility threshold scales with zoom: tighter zoom → more labels
    var labelEvery = view.pxPerDay > 60 ? 1 : (view.pxPerDay > 26 ? 3 : 7);
    var branchG = el('g', { 'class': 'evo-branches' });
    var nodeLayer = el('g', { 'class': 'evo-nodes' });
    events.forEach(function (e, i) {
      var X = wx(e.t);
      var sy = spineY(X);
      var ty = tipY(e.layer, i);
      var fill = layerFill(e.layer, e.valence);
      var glow = e.layer === 'insight' || e.layer === 'practice' || e.valence === 'positive';
      var r = e.layer === 'insight' ? 4.2 : (e.layer === 'practice' ? 3.8 : (2.6 + Math.min(2.4, Math.log(1 + (e.weight || 1)))));
      // organic branch from spine to tip
      var cxp = X + (jit(i) - 0.5) * 10;
      var bd = 'M' + X.toFixed(1) + ' ' + sy.toFixed(1) +
               ' Q' + (X + (cxp - X) * 0.4).toFixed(1) + ' ' + ((sy + ty) / 2).toFixed(1) +
               ' ' + cxp.toFixed(1) + ' ' + ty.toFixed(1);
      branchG.appendChild(el('path', { d: bd, fill: 'none', stroke: fill, 'stroke-width': '0.9', opacity: '0.32', 'stroke-linecap': 'round' }));
      // node at the tip
      var shape = nodeShape(e.layer, cxp, ty, r);
      shape.setAttribute('fill', fill);
      shape.setAttribute('opacity', String(e.layer === 'emotion' ? valStyle(e.valence).o : 0.95));
      if (glow) shape.setAttribute('filter', 'url(#evoGlow)');
      shape.appendChild(titleNode(e, lang));
      registerNode(e.id, cxp, ty);
      // label on bright/zoomed nodes
      var showLabel = (e.layer === 'insight') || (i % labelEvery === 0) || (view.pxPerDay > 60);
      var wrap = el('g', { 'class': 'evo-node', tabindex: '0' });
      wrap.style.cursor = 'pointer';
      wrap.appendChild(el('circle', { 'class': 'evo-hit', cx: cxp.toFixed(1), cy: ty.toFixed(1), r: 16, fill: 'transparent', 'pointer-events': 'all' }));
      wrap.appendChild(shape);
      if (showLabel) {
        var lbl = el('text', { x: cxp.toFixed(1), y: (ty - r - 5).toFixed(1), 'text-anchor': 'middle', 'class': 'evo-node-label' });
        lbl.textContent = truncate(prettyTitle(e, lang), 18);
        wrap.appendChild(lbl);
      }
      (function (ev) {
        function open(domEv) { if (domEv) domEv.stopPropagation(); if (window._evolNavLock) return; window._evolNavLock = true; try { openMiniNeuromap(container, ev, lang, st); } finally { setTimeout(function () { window._evolNavLock = false; }, 120); } }
        wrap.addEventListener('click', open);
        wrap.addEventListener('keydown', function (k) { if (k.key === 'Enter' || k.key === ' ') open(k); });
      })(e);
      nodeLayer.appendChild(wrap);
    });

    // ── real journey_links as glowing mycelium chains (no filler) ──
    var chains = el('g', { 'class': 'evo-chains' });
    (data.links || []).forEach(function (lk) {
      var a = POS[String(lk.a)], b = POS[String(lk.b)];
      if (!a || !b) return;
      chains.appendChild(chainPath(a, b, lk.kind === 'correlation' ? 'var(--myc-cyan)' : 'rgba(255,255,255,0.5)', lk.kind === 'correlation' ? 0.4 : 0.22));
    });

    world.appendChild(branchG);
    world.appendChild(chains);
    world.appendChild(nodeLayer);

    // ── "now" terminator + time axis (inside world so they pan) ──
    nowMarker(world, wxNow, spineY(wxNow));
    drawWorldTimeAxis(world, view, lang, wxOrigin, wxNow);

    // ── pan / zoom interaction (attached to the svg) ──
    wirePanZoom(svg, world, st, container, lang, x0, x1);
  }

  // smooth Bezier chain between two node tips
  function chainPath(a, b, stroke, op) {
    var midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2 - Math.min(50, Math.abs(b.x - a.x) * 0.25 + 14);
    var d;
    if (window.d3 && window.d3.line && window.d3.curveCatmullRom) {
      d = window.d3.line().curve(window.d3.curveCatmullRom.alpha(0.7))([[a.x, a.y], [midX, midY], [b.x, b.y]]);
    } else {
      d = 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ' Q' + midX.toFixed(1) + ' ' + midY.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
    }
    return el('path', { d: d, fill: 'none', stroke: stroke, 'stroke-width': '1', opacity: String(op), filter: 'url(#evoGlow)' });
  }

  // date ticks along the bottom, in world coords
  function drawWorldTimeAxis(g, view, lang, wxA, wxB) {
    var y = H - 16;
    var span = view.nowT - view.originT, n = 7;
    for (var i = 0; i <= n; i++) {
      var t = view.originT + span * (i / n), X = (t - view.originT) / DAY_MS * view.pxPerDay;
      g.appendChild(el('line', { x1: X.toFixed(1), y1: y - 11, x2: X.toFixed(1), y2: y - 5, stroke: 'var(--myc-line-muted)', 'stroke-width': '1' }));
      var tx = el('text', { x: X.toFixed(1), y: y.toFixed(1), 'text-anchor': 'middle', 'class': 'evo-axis-label' });
      tx.textContent = fmtAxis(t, lang);
      g.appendChild(tx);
    }
  }

  // wheel = horizontal pan, drag = pan, ctrl/⌘+wheel = zoom (keep time-under-cursor fixed)
  function wirePanZoom(svg, world, st, container, lang, x0, x1) {
    var view = st.view;
    function applyPan() {
      // clamp so you can't drag the whole spine off-screen
      var minPan = (x1 - 40) - (view.nowT - view.originT) / DAY_MS * view.pxPerDay - (x1 - x0);
      var maxPan = x0 + (x1 - x0) * 0.5;
      view.panX = Math.max(minPan, Math.min(maxPan, view.panX));
      world.setAttribute('transform', 'translate(' + view.panX.toFixed(1) + ',0)');
    }
    svg.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        var rect = svg.getBoundingClientRect();
        var scaleR = (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width) ? (svg.viewBox.baseVal.width / rect.width) : 1;
        var localX = (e.clientX - rect.left) * scaleR;            // svg-space x under cursor
        var worldXUnder = (localX - view.panX);                   // world x under cursor
        var tUnder = view.originT + worldXUnder / view.pxPerDay * DAY_MS;
        var factor = e.deltaY < 0 ? 1.12 : 0.89;
        view.pxPerDay = Math.max(0.4, Math.min(140, view.pxPerDay * factor));
        // re-render at new scale, then keep tUnder under the cursor
        var newWorldXUnder = (tUnder - view.originT) / DAY_MS * view.pxPerDay;
        view.panX = localX - newWorldXUnder;
        paint(container, st, lang);
      } else {
        e.preventDefault();
        view.panX -= (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
        applyPan();
      }
    }, { passive: false });
    var panning = false, sx = 0, sp = 0, moved = false;
    svg.addEventListener('mousedown', function (e) {
      if (e.target.closest('.evo-node')) return;
      panning = true; moved = false; sx = e.clientX; sp = view.panX; svg.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', function (e) {
      if (!panning) return;
      var rect = svg.getBoundingClientRect();
      var scaleR = (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width) ? (svg.viewBox.baseVal.width / rect.width) : 1;
      view.panX = sp + (e.clientX - sx) * scaleR; if (Math.abs(e.clientX - sx) > 3) moved = true; applyPan();
    });
    window.addEventListener('mouseup', function () { panning = false; svg.style.cursor = ''; });
  }

  function titleNode(e, lang) {
    var t = el('title');
    t.textContent = prettyTitle(e, lang) + (e.valence && e.valence !== 'neutral' ? ' · ' + e.valence : '');
    return t;
  }

  /* ── mini-neuromap embed ──────────────────────────────────────────────────
     Clicking a node opens a small graph overlay (the clicked event + everything
     it links to via journey_links) rendered in the neuromap visual language —
     a fresh tiny renderer (the full neuromap is a non-reusable monolith). The
     "Открыть в нейромапе" button hands off to the full tool. */
  var MINI_STR = {
    chain:   { ru: 'Цепочка', en: 'Chain', es: 'Cadena' },
    single:  { ru: 'Событие', en: 'Event', es: 'Evento' },
    openNm:  { ru: 'Открыть в нейромапе', en: 'Open in NeuroMap', es: 'Abrir en NeuroMapa' },
    noLinks: { ru: 'Связей нет — отдельная запись на спине.', en: 'No links — a standalone entry on the spine.', es: 'Sin enlaces.' }
  };
  function closeMiniNeuromap(container) {
    var ex = container.querySelector('.evo-mini-nm'); if (ex) ex.remove();
    if (container.__miniNmOutside) { document.removeEventListener('mousedown', container.__miniNmOutside, true); container.__miniNmOutside = null; }
  }
  function openMiniNeuromap(container, ev, lang, st) {
    closeMiniNeuromap(container);
    closeDetailCard(container);
    var canvas = container.querySelector('.myc-evo-canvas');
    if (!canvas) return;

    // gather the clicked event + its 1-hop linked neighbours (real journey_links)
    var center = ev;
    var neighbours = (ev.links || []).map(function (lk) { return EVENT_INDEX[String(lk.to != null ? lk.to : lk)]; }).filter(Boolean);
    // dedupe
    var seen = {}; neighbours = neighbours.filter(function (n) { if (seen[n.id]) return false; seen[n.id] = 1; return true; }).slice(0, 8);

    var box = document.createElement('div');
    box.className = 'evo-mini-nm';
    var W = 460, Hm = 380;
    var title = neighbours.length ? L(MINI_STR.chain, lang) : L(MINI_STR.single, lang);
    box.innerHTML =
      '<div class="evo-mini-head"><span class="evo-mini-title">🧠 ' + escapeHtml(title) + '</span>' +
      '<button class="evo-mini-x" title="' + L(CARD_STR.close, lang) + '">✕</button></div>' +
      '<div class="evo-mini-body"></div>' +
      '<div class="evo-mini-foot">' +
        '<span class="evo-mini-note">' + (neighbours.length ? '' : escapeHtml(L(MINI_STR.noLinks, lang))) + '</span>' +
        '<button class="evo-mini-open">' + L(MINI_STR.openNm, lang) + ' →</button>' +
      '</div>';
    canvas.appendChild(box);

    var body = box.querySelector('.evo-mini-body');
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + Hm, width: '100%', height: '100%', style: 'display:block;' });
    svg.insertAdjacentHTML('afterbegin', defsMarkup());
    body.appendChild(svg);

    var cx = W / 2, cyc = Hm / 2 - 6;
    // radial placement: center node + neighbours on a ring
    var positions = {}; positions[String(center.id)] = { x: cx, y: cyc, e: center, center: true };
    var R = Math.min(W, Hm) * 0.34;
    neighbours.forEach(function (n, i) {
      var ang = (Math.PI * 2 * i / Math.max(1, neighbours.length)) - Math.PI / 2;
      positions[String(n.id)] = { x: cx + Math.cos(ang) * R, y: cyc + Math.sin(ang) * R, e: n, center: false };
    });

    // links: center↔neighbour, plus neighbour↔neighbour if they link each other
    var linkG = el('g');
    function drawLink(a, b, kind) {
      var pa = positions[String(a)], pb = positions[String(b)];
      if (!pa || !pb) return;
      var midX = (pa.x + pb.x) / 2, midY = (pa.y + pb.y) / 2 - 18;
      linkG.appendChild(el('path', { d: 'M' + pa.x.toFixed(1) + ' ' + pa.y.toFixed(1) + ' Q' + midX.toFixed(1) + ' ' + midY.toFixed(1) + ' ' + pb.x.toFixed(1) + ' ' + pb.y.toFixed(1),
        fill: 'none', stroke: kind === 'correlation' ? 'rgba(120,220,255,0.5)' : 'rgba(255,255,255,0.35)', 'stroke-width': '1.2', filter: 'url(#evoGlow)' }));
    }
    (center.links || []).forEach(function (lk) { drawLink(center.id, lk.to != null ? lk.to : lk, lk.kind); });
    neighbours.forEach(function (n) { (n.links || []).forEach(function (lk) { var to = lk.to != null ? lk.to : lk; if (positions[String(to)] && String(to) !== String(center.id)) drawLink(n.id, to, lk.kind); }); });
    svg.appendChild(linkG);

    // nodes
    Object.keys(positions).forEach(function (k) {
      var p = positions[k], e = p.e;
      var r = p.center ? 16 : 11;
      var fill = layerFill(e.layer, e.valence);
      var node = nodeShape(e.layer, p.x, p.y, r);
      node.setAttribute('fill', fill);
      node.setAttribute('filter', 'url(#evoGlow)');
      node.setAttribute('opacity', e.layer === 'emotion' ? String(valStyle(e.valence).o) : '0.96');
      if (p.center) node.setAttribute('stroke', 'rgba(255,255,255,0.8)'), node.setAttribute('stroke-width', '1.4');
      svg.appendChild(node);
      var lbl = el('text', { x: p.x.toFixed(1), y: (p.y + r + 13).toFixed(1), 'text-anchor': 'middle', 'class': 'evo-mini-label' });
      lbl.textContent = truncate(prettyTitle(e, lang), 20);
      svg.appendChild(lbl);
      var typ = el('text', { x: p.x.toFixed(1), y: (p.y + 4).toFixed(1), 'text-anchor': 'middle', 'class': 'evo-mini-type' });
      typ.textContent = humanLabel(e.kind || e.layer, lang).slice(0, 3);
      svg.appendChild(typ);
    });

    box.querySelector('.evo-mini-x').addEventListener('click', function () { closeMiniNeuromap(container); });
    box.querySelector('.evo-mini-open').addEventListener('click', function () { closeMiniNeuromap(container); openInSource(center); });
    // outside-click closes
    container.__miniNmOutside = function (e) { if (!box.contains(e.target) && !e.target.closest('.evo-node')) closeMiniNeuromap(container); };
    setTimeout(function () { document.addEventListener('mousedown', container.__miniNmOutside, true); }, 0);
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
      // Load a WIDE window once (the spine spans registration→now); the period
      // buttons re-zoom this pool client-side instead of refetching/cropping.
      jget('/api/users/me/evolution?period=year'),
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
      createdAt: (cu && (cu.created_at || cu.createdAt)) || null, // spine starts at registration
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
    var expandBtn = (!st._isOverlay && typeof window.mountFullscreenOverlay === 'function')
      ? '<button class="myc-evo-expand" title="Раскрыть на весь экран" style="margin-left:0.5rem;background:rgba(20,24,30,0.7);border:1px solid rgba(255,255,255,0.12);color:var(--myc-text,#cdd);border-radius:8px;height:30px;padding:0 0.7rem;font-size:12px;cursor:pointer;">⤢ Раскрыть</button>'
      : '';
    // #8: in the fullscreen overlay the title is already shown by the overlay
    // chrome — don't render a second <h3> here (it stacked two "Путь развития").
    var titleBlock = st._isOverlay
      ? ''
      : '<div><h3 class="myc-evo-title">' + L(STR.title, lang) + '</h3>' +
        '<p class="myc-evo-sub">' + L(STR.sub, lang) + '</p></div>';
    return '<div class="myc-evo-head"' + (st._isOverlay ? ' style="justify-content:flex-end;"' : '') + '>' +
      titleBlock +
      '<div class="myc-controls">' + seg(MODES, st.mode, 'mode') + seg(PERIODS, st.period, 'period') + expandBtn + '</div></div>';
  }

  // Open the path in a shared fullscreen overlay, reusing already-fetched data.
  function openEvolutionOverlay(parentSt, lang) {
    if (typeof window.mountFullscreenOverlay !== 'function') return;
    var ost = { mode: parentSt.mode, period: parentSt.period, cursor: parentSt.cursor,
                hidden: Object.assign({}, parentSt.hidden || {}), user: parentSt.user,
                modules: parentSt.modules, data: parentSt.data, isDemo: parentSt.isDemo, _isOverlay: true };
    window.mountFullscreenOverlay(function (body) {
      body.classList.add('myc-root');
      body.style.padding = '20px 24px';
      var container = document.createElement('div');
      container.__evo = ost;
      body.appendChild(container);
      container.innerHTML = buildChrome(ost, lang) +
        '<div class="myc-evo-canvas" style="position:relative;min-height:' + H + 'px;"></div>';
      wireChrome(container, ost, lang, function () { mountEvolutionPath(container, { lang: lang }); });
      requestAnimationFrame(function () { if (ost.data) paint(container, ost, lang); });
      // #9: repaint once the overlay reaches its real size (and on later resizes)
      // so the field fills the fullscreen height instead of the first-frame 380.
      if (typeof ResizeObserver === 'function') {
        var ro = new ResizeObserver(function () {
          if (!ost.data) return;
          var w = measureW(container.querySelector('.myc-evo-canvas'), container);
          var h = computeH(container, ost);
          if (Math.abs(w - (ost._w || 0)) > 40 || Math.abs(h - (H || 0)) > 24) paint(container, ost, lang);
        });
        try { ro.observe(body); } catch (e) {}
      }
    }, { title: L(STR.title, lang), accent: '#56F2A6' });
  }

  function wireChrome(container, st, lang, rerender) {
    var exp = container.querySelector('.myc-evo-expand');
    if (exp) exp.addEventListener('click', function () { openEvolutionOverlay(st, lang); });
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
            // Period is now a NAVIGATION zoom, not a crop: data is loaded wide
            // (registration→now) once; switching period just re-fits the view and
            // recentres on "now" without refetching. — rework
            st.period = val; st.cursor = 1;
            if (st.data) {
              segEl.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-active', x === b); });
              st.view = null;            // force ensureView() to recompute zoom/centre
              paint(container, st, lang); return;
            }
          }
          rerender();
        });
      });
    });
  }

  // #9: the logical SVG height. 380 in the embedded card; in the fullscreen
  // overlay it grows to fill the available vertical space so the field, panels and
  // module headers actually use the screen instead of staying letterboxed. All
  // render fns read this module-level H, so recomputing it here rescales them all.
  var H_BASE = 380;
  function computeH(container, st) {
    if (!st._isOverlay) return H_BASE;
    var bodyEl = (container.closest && container.closest('.na-fs-body')) || container.parentElement;
    var head = container.querySelector('.myc-evo-head');
    var avail = 0;
    try {
      avail = (bodyEl ? bodyEl.clientHeight : 0) - (head ? head.offsetHeight : 0) - 36;
    } catch (e) {}
    if (!avail || avail < H_BASE) return Math.max(H_BASE, Math.min(960, (typeof window !== 'undefined' ? window.innerHeight - 150 : H_BASE)));
    return Math.max(H_BASE, Math.min(960, avail));
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
    // recompute the logical height for this paint (fullscreen → taller field)
    H = computeH(container, st);
    canvas.style.minHeight = H + 'px';
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
      '<div class="evo-user-xp">' + (u.xp || 0) + ' / ' + (u.xpNext || 100) + ' XP</div></div>' +
      '<button class="evo-char-profile evo-user-profile">' + L(STR.openProfile, lang) + '</button>';
    canvas.appendChild(panel);
    var pb = panel.querySelector('.evo-user-profile');
    if (pb) pb.addEventListener('click', function () { if (typeof window.switchTab === 'function') window.switchTab('profile'); });
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
