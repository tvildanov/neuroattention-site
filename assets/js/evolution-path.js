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
    { key: 'day',     label: { ru: 'Сутки',  en: 'Day',   es: 'Día' } },
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
    emptyPeriod: { ru: 'Нет событий за выбранный период', en: 'No events in the selected period', es: 'Sin eventos en el periodo' },
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
  // Robust width measurement. PR #81: the field now lives in the centre `.evo-stage`
  // cell of a 3-column flex layout (left profile rail · stage · right layers rail),
  // so we must measure the STAGE's own width — NOT the max of every ancestor, which
  // would return the full layout width and make the canvas overflow under the rails.
  // The stage is a flex item with min-width:0, so its rect is the true centre width.
  // A momentary 0 (tab display:none→block) self-heals: the ResizeObserver repaints
  // once the container gains real width. Container/ parent only seed a fallback.
  function measureW(el, container) {
    var w = 0;
    try { w = Math.round((el && el.getBoundingClientRect().width) || 0); } catch (e) {}
    if (!w && el) w = Math.round(el.clientWidth || 0);
    if (!w && container) {
      try { w = Math.round(container.getBoundingClientRect().width || 0); } catch (e) {}
      if (!w) w = Math.round(container.clientWidth || 0);
    }
    return Math.max(360, w || 1100);
  }
  // Resolve the centre stage element that hosts the canvas/svg/overlays. Falls back
  // to the legacy `.myc-evo-canvas` box (and the container) so the empty/loading
  // states — which never build the rail skeleton — keep working.
  function stageOf(container) {
    return (container && (container.querySelector('.evo-stage') ||
            container.querySelector('.myc-evo-canvas'))) || container;
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
      '<filter id="evoHalo" x="-60%" y="-200%" width="220%" height="500%"><feGaussianBlur stdDeviation="16"/></filter>' +
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
  // Layers view crops to the selected period (anchored at "now"), so Day/Week/
  // Month/3mo/Year actually change what's shown. The tunnel mode re-zooms via
  // ensureView() instead; the layers SVG has no pan/zoom, so it windows the
  // domain here. 'all' falls back to the full registration→now range.
  var PERIOD_DAYS = { day: 1, week: 7, month: 30, '3months': 90, year: 365 };
  function layersDomain(data, st) {
    var full = domain(data);
    var pd = PERIOD_DAYS[st && st.period];
    if (!pd) return full;                       // 'all' (or unknown) → full span
    var to = full.to;
    var from = Math.max(full.from, to - pd * 864e5);
    if (to <= from) to = from + 1;
    return { from: from, to: to, span: to - from };
  }
  function inWindow(t, dom) { var ms = tms(t); return ms >= dom.from && ms <= dom.to; }
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
    var canvas = stageOf(container);
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
  var DAY_MS = 864e5, HOUR_MS = 36e5, MIN_MS = 6e4;
  // ── PR5: External Field overlay layers (bottom-zone tracks) ──
  var OVERLAY_ORDER = ['sun', 'moon', 'earth', 'weather', 'cosmos', 'social', 'experimental'];
  var OVERLAY_ICON = { sun: '☀', moon: '☾', earth: '⊕', weather: '🌦', cosmos: '✦', social: '🌐', experimental: '⚡' };
  var OVERLAY_LABEL = {
    sun:    { ru: 'Солнце',  en: 'Sun',     es: 'Sol' },
    moon:   { ru: 'Луна',    en: 'Moon',    es: 'Luna' },
    earth:  { ru: 'Земля',   en: 'Earth',   es: 'Tierra' },
    weather:{ ru: 'Погода',  en: 'Weather', es: 'Clima' },
    cosmos: { ru: 'Космос',  en: 'Cosmos',  es: 'Cosmos' },
    social: { ru: 'Социум',  en: 'Social',  es: 'Social' },
    experimental: { ru: 'Эксп.', en: 'Exp.', es: 'Exp.' }
  };
  // Marker colour by layer + severity. Sun flares B/C/M/X; Earth Kp storm levels;
  // everything else by a generic low/med/high band. Falls back to a calm cyan.
  // PR FIX #2: server-provided severity_color word → hex.
  var SEV_WORD = { yellow: '#ffcf4d', orange: '#ff9d3c', red: '#ff5a5a' };
  function overlaySeverityColor(layer, severity) {
    var s = String(severity || '').toUpperCase();
    if (layer === 'sun') {
      if (s[0] === 'X') return '#ff5a5a';
      if (s[0] === 'M') return '#ffcf4d';
      if (s[0] === 'C') return '#6fe39b';
      if (s[0] === 'B') return '#7fb8ff';
      return '#8fd0ff';
    }
    if (layer === 'earth') {                       // geomagnetic Kp (numeric severity)
      var kp = parseFloat(s); if (isFinite(kp)) { if (kp >= 7) return '#ff5a5a'; if (kp >= 5) return '#ffcf4d'; if (kp >= 4) return '#ffe08a'; return '#6fe39b'; }
    }
    if (s === 'HIGH' || s === 'SEVERE' || s === 'X') return '#ff5a5a';
    if (s === 'MED' || s === 'MEDIUM' || s === 'MODERATE') return '#ffcf4d';
    if (s === 'LOW' || s === 'MINOR') return '#6fe39b';
    return '#8fd0ff';
  }
  // zoom limits (px per day): MIN ≈ multi-year overview, MAX ≈ ~30-min resolution
  // (at 7200 px/day one hour ≈ 300px and a 30-min slot ≈ 150px). — 2.2
  var MIN_PXPD = 0.4, MAX_PXPD = 7200;

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
  // aura colour by mean emotional valence in a time slice: calm cyan at 0,
  // green toward +1 (positive), wine/red toward -1 (heavy). — 2.7
  function valenceColor(score) {
    var calm = [120, 200, 230], green = [86, 242, 166], wine = [200, 80, 90];
    var s = Math.max(-1, Math.min(1, score)), to = s >= 0 ? green : wine, k = Math.abs(s);
    var c = [0, 1, 2].map(function (j) { return Math.round(calm[j] + (to[j] - calm[j]) * k); });
    return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
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
    var reg = st.user && st.user.createdAt ? tms(st.user.createdAt) : 0;
    var evs = allEvents(data);
    var earliest = evs.length ? evs[0].t : dom.from;
    // #2: the spine spans the ACTUAL journey — registration→now (or first-event→now),
    // NOT the data-fetch window. Pulling originT back to the fetch range start made
    // everything cluster near "now" with a long empty left tail.
    var originT = reg ? Math.min(reg, earliest) : earliest;
    var nowT = Math.max(dom.to, evs.length ? evs[evs.length - 1].t : dom.to);
    if (nowT <= originT) nowT = originT + DAY_MS;
    var spanDays = (nowT - originT) / DAY_MS;
    if (!st.view || st.view._fieldW == null) {
      // period = how far to zoom out, but never wider than the real span (+10%) —
      // so a 2-week-old account doesn't render its events squished at the right.
      var days = Math.min(PERIOD_DAYS[st.period] || 30, Math.max(1, spanDays * 1.1));
      var pxPerDay = (x1 - x0) / days;
      // _basePxPerDay = the period's fit-to-view zoom; the live zoom factor Z used
      // by the renderer (3.1) is pxPerDay / _basePxPerDay, so the branch geometry,
      // node radius and label size grow when you zoom IN, not just the time axis.
      var v = { originT: originT, nowT: nowT, pxPerDay: pxPerDay, _basePxPerDay: pxPerDay, panX: 0, _fieldW: (x1 - x0) };
      var wxNow = (nowT - originT) / DAY_MS * pxPerDay;
      v.panX = (x1 - 40) - wxNow; // now sits ~40px from the right edge
      st.view = v;
    } else {
      st.view.originT = originT; st.view.nowT = nowT; st.view._fieldW = (x1 - x0);
    }
    return st.view;
  }

  /* ── v4: CANVAS tunnel renderer ────────────────────────────────────────────
     The SVG version translated one enormous <g> (the spine alone had ~1 point /
     10 world-px → 100k+ points at deep zoom) and the browser re-rasterised that
     giant filtered layer every pan frame → the stutter. Canvas redraws ONLY the
     visible viewport each frame (spine capped to ~150 points regardless of zoom,
     off-screen nodes skipped) — inherently 60fps. SVG stays only for the
     mini-neuromap overlay + the chrome. */

  var CV_COLORS = null;
  function cvColors() {
    if (CV_COLORS) return CV_COLORS;
    var cs = getComputedStyle(document.documentElement);
    var g = function (n, fb) { var v = (cs.getPropertyValue(n) || '').trim(); return v || fb; };
    CV_COLORS = { cyan: g('--myc-cyan', '#5ee0ff'), green: g('--myc-green', '#56F2A6'),
      lineSecondary: 'rgba(255,255,255,0.45)', lineFaint: 'rgba(255,255,255,0.06)',
      lineMuted: 'rgba(255,255,255,0.16)', textDim: g('--myc-text-dim', '#8c98a6'),
      textMono: g('--myc-text-mono', '#5b6b7a') };
    return CV_COLORS;
  }
  function cvLayerFill(layer, valence) {
    var C = cvColors();
    if (layer === 'emotion') return valence === 'positive' ? C.green : (valence === 'negative' ? 'rgb(220,90,90)' : C.lineSecondary);
    if (layer === 'insight') return C.cyan;
    if (layer === 'practice') return '#8DFFC8';
    if (layer === 'thought') return 'rgb(200,180,240)';
    if (layer === 'sensation') return 'rgb(140,180,255)';
    if (layer === 'event') return 'rgb(100,220,180)';
    return C.lineSecondary;
  }
  function rgbaFromRgb(rgb, a) { var m = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/); return m ? 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' + a + ')' : rgb; }

  function renderTunnel(W, data, container, lang, st) {
    var host = stageOf(container);
    var oldSvg = host.querySelector('svg'); if (oldSvg) oldSvg.remove();
    var cv = host.querySelector('canvas.evo-2d');
    if (!cv) { cv = document.createElement('canvas'); cv.className = 'evo-2d'; cv.style.cssText = 'display:block;width:100%;'; host.insertBefore(cv, host.firstChild); }
    var dpr = Math.min(2, window.devicePixelRatio || 1);   // retina, but never >2 (no double-render)
    var isMobile = W <= 560;
    // PR: padL/padR used to reserve 168/150px inside the canvas for the profile +
    // layer-toggle cards that floated OVER the field. Since PR #81 those cards live
    // in the flanking rails (.evo-rail-l / -r), so that reservation is now dead
    // space — the snake was stranded in a narrow central band with black corridors
    // either side. Drop it to a small symmetric gutter so the spine fills the stage
    // wall-to-wall between the rails.
    var padL = isMobile ? 14 : 28, padR = isMobile ? 14 : 28, padTop = isMobile ? 64 : 28, padBot = 34;
    var x0 = padL, x1 = W - padR, fieldTop = padTop;
    // ── PR5: split the viewport into a chains zone (top ~70%) and an External
    // Field overlay zone (bottom ~30%). Overlay layers are only those the user
    // marked showOnPath (server returns them in data.overlays). With no enabled
    // layer the overlay zone collapses and chains use the full height. ──
    var ovData = (data && data.overlays) || {};
    var ovLayers = [];
    var ovHidden = st.hidden || {};
    OVERLAY_ORDER.forEach(function (k) { var evs = ovData[k]; if (evs && evs.length && !ovHidden[k]) ovLayers.push({ key: k, icon: OVERLAY_ICON[k], events: evs }); });
    if (isMobile && ovLayers.length > 3) ovLayers = ovLayers.slice(0, 3);   // mobile: cap visible tracks
    var fullBot = H - padBot, hasOverlay = ovLayers.length > 0;
    var fieldBot = hasOverlay ? Math.round(fieldTop + (fullBot - fieldTop) * 0.70) : fullBot;
    var cy = (fieldTop + fieldBot) / 2, half = (fieldBot - fieldTop) / 2 - 10;
    var ovZone = hasOverlay ? { top: fieldBot + 10, bot: fullBot, layers: ovLayers } : null;
    var view = ensureView(st, data, x0, x1);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var hidden = st.hidden || {};
    var events = allEvents(data).filter(function (e) { return !hidden[e.layer]; });
    indexEvents(events);
    window.__evoEventsX = events.map(function (e) { return (tms(e.t) - view.originT) / DAY_MS * view.pxPerDay; });
    st._tunnel = { cv: cv, ctx: cv.getContext('2d'), dpr: dpr, W: W, x0: x0, x1: x1,
      fieldTop: fieldTop, fieldBot: fieldBot, cy: cy, half: half, isMobile: isMobile,
      lang: lang, data: data, events: events, container: container, overlay: ovZone,
      components: buildTunnelComponents(events, half) };
    drawTunnel(st);
    wireCanvasPanZoom(container, st, lang);
  }

  // ── v6: group events into connected components (real journey_links) and lay
  // each out as ONE lightning branch with its nodes strung ALONG it in chain
  // order. Real sub-branches appear only at genuine graph forks; isolated events
  // become a single branch with one node at the tip. Layout is in LOCAL px
  // (offsets from the spine anchor) so it's computed once and just translated by
  // the live pan/zoom each frame. ──
  function nodeR(e) { return e.layer === 'insight' ? 4.2 : (e.layer === 'practice' ? 3.8 : (2.6 + Math.min(2.4, Math.log(1 + (e.weight || 1))))); }
  function strHash(s) { s = String(s); var h = 2166136261; for (var i = 0; i < s.length; i++) { h = (h ^ s.charCodeAt(i)) >>> 0; h = (h * 16777619) >>> 0; } return h; }
  function jit2(s) { var v = Math.sin(strHash(s) * 0.000013 + 1.13) * 43758.5453; return v - Math.floor(v); }
  function distToSeg(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    var u = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
    return Math.hypot(px - (x1 + u * dx), py - (y1 + u * dy));
  }
  // v7: a branch is ONE real chain, not the whole history. Two safety bounds keep
  // a single component from running away into a "spine":
  // v8: one chain ≈ one layer-sequence (emotion → sensation → event → thought),
  // so cap branches near 4 nodes — Nick was still seeing 8-10 node "spines".
  var MAX_CHAIN_NODES = 4;                  // hard cap on nodes per branch
  var MAX_CHAIN_GAP_MS = 60 * 60 * 1000;    // cut the chain on a >1h gap between steps
  var MIN_LINK_WEIGHT = 0.5;                // links weaker than this don't define structure
  // Links carry { to, kind, weight }. 'correlation' (a sensation bound to many
  // emotions/thoughts — see server linkJourney 'correlation') is a WEAK hub: it
  // used to transitively fuse separate sequence-chains into one giant branch.
  // Only 'sequence' / legacy links (no kind) and links with weight ≥ MIN_LINK_WEIGHT
  // define the structural chain now.
  function isStrongLink(lk) {
    if (lk && typeof lk === 'object') {
      if (lk.kind === 'correlation') return false;
      if (lk.weight != null && lk.weight < MIN_LINK_WEIGHT) return false;
    }
    return true;
  }
  // Split a connected component's ids into time-ordered sub-chains. Cut on a big
  // time gap, when the node cap is reached, or before a SECOND emotion — every
  // emotion should start its own chain rather than continue someone else's.
  // Returns arrays of id strings.
  function splitComponent(ids, byId) {
    var evs = ids.map(function (id) { return byId[id]; }).filter(Boolean)
                 .sort(function (a, b) { return a.t - b.t; });
    var groups = [], cur = [], curHasEmotion = false;
    for (var i = 0; i < evs.length; i++) {
      var isEmo = evs[i].layer === 'emotion';
      if (cur.length) {
        var gap = evs[i].t - evs[i - 1].t;
        var emoBreak = isEmo && curHasEmotion;     // a second emotion begins a new chain
        if (gap > MAX_CHAIN_GAP_MS || cur.length >= MAX_CHAIN_NODES || emoBreak) {
          groups.push(cur); cur = []; curHasEmotion = false;
        }
      }
      cur.push(evs[i]);
      if (isEmo) curHasEmotion = true;
    }
    if (cur.length) groups.push(cur);
    return groups.map(function (g) { return g.map(function (e) { return String(e.id); }); });
  }
  function buildTunnelComponents(events, half) {
    var byId = {}; events.forEach(function (e) { if (e.id != null) byId[String(e.id)] = e; });
    var adj = {};
    function addEdge(a, b) { if (a == null || b == null) return; a = String(a); b = String(b); if (a === b || !byId[a] || !byId[b]) return; (adj[a] = adj[a] || {})[b] = 1; (adj[b] = adj[b] || {})[a] = 1; }
    // strong links only — correlation hubs no longer merge chains
    events.forEach(function (e) { (e.links || []).forEach(function (lk) { if (!isStrongLink(lk)) return; addEdge(e.id, lk && lk.to != null ? lk.to : lk); }); });
    var seen = {}, out = [];
    events.forEach(function (e) {
      var id = String(e.id); if (seen[id]) return;
      var stack = [id], ids = []; seen[id] = 1;
      while (stack.length) { var u = stack.pop(); ids.push(u); Object.keys(adj[u] || {}).forEach(function (v) { if (!seen[v]) { seen[v] = 1; stack.push(v); } }); }
      // Defensive split: bound branch length + cut on big time gaps. For genuine
      // short chains (the common case) this returns the component unchanged.
      var subs = splitComponent(ids, byId);
      subs.forEach(function (sub) {
        // When we actually split, rebuild a linear adjacency over the sub-chain so
        // layout stays connected (the original cross-edge may span the cut point).
        var subAdj = adj;
        if (subs.length > 1) {
          subAdj = {};
          for (var k = 0; k < sub.length - 1; k++) {
            var x = sub[k], y = sub[k + 1];
            (subAdj[x] = subAdj[x] || {})[y] = 1; (subAdj[y] = subAdj[y] || {})[x] = 1;
          }
        }
        var laid = layoutComponent(sub, subAdj, byId, half);
        if (laid) out.push(laid);
      });
    });
    return out;
  }
  function layoutComponent(ids, adj, byId, half) {
    var evs = ids.map(function (id) { return byId[id]; }).filter(Boolean).sort(function (a, b) { return a.t - b.t; });
    if (!evs.length) return null;
    var rootId = String(evs[0].id), anchorT = evs[0].t;
    // spanning tree from the earliest event; neighbours visited in time order so
    // the main trunk follows the temporal flow of the chain.
    var visited = {}, parent = {}, order = [], q = [rootId]; visited[rootId] = 1;
    while (q.length) {
      var u = q.shift(); order.push(u);
      var nb = Object.keys(adj[u] || {}).filter(function (v) { return !visited[v]; }).sort(function (a, b) { return (byId[a].t || 0) - (byId[b].t || 0); });
      nb.forEach(function (v) { visited[v] = 1; parent[v] = u; q.push(v); });
    }
    var children = {}; order.forEach(function (id) { var p = parent[id]; if (p != null) { (children[p] = children[p] || []).push(id); } });
    var meanDy = evs.reduce(function (s, e) { return s + (BRANCH_DY[e.layer] != null ? BRANCH_DY[e.layer] : 0); }, 0) / evs.length;
    var sign = meanDy <= 0 ? -1 : 1;                 // upper layers drift up, lower drift down
    var SEG = order.length > 8 ? 32 : 42;
    var pos = {}, edges = [], maxX = 0;
    var rootX = 54 + jit2(rootId) * 26, rootY = sign * (16 + Math.abs(meanDy) * half * 0.04 + jit2(rootId + 'r') * 10);
    pos[rootId] = { x: rootX, y: rootY }; maxX = rootX;
    edges.push({ a: null, ax: 0, ay: 0, b: rootId });           // stem from the spine to the root
    (function place(id, dirAng) {
      var px = pos[id].x, py = pos[id].y, kids = children[id] || [];
      kids.forEach(function (kid, kidi) {
        var spread = kids.length > 1 ? (kidi - (kids.length - 1) / 2) : 0;
        var ang = dirAng + spread * (24 * Math.PI / 180) + (jit2(kid) - 0.5) * 0.14;
        ang = Math.max(-1.15, Math.min(1.15, ang));            // keep it forward-ish
        var nx = px + Math.cos(ang) * SEG, ny = py + Math.sin(ang) * SEG;
        if (nx <= px + 6) nx = px + SEG * 0.5;                  // guarantee forward (+X)
        pos[kid] = { x: nx, y: ny }; if (nx > maxX) maxX = nx;
        edges.push({ a: id, b: kid });
        place(kid, ang * 0.55);                                 // damp toward horizontal each step
      });
    })(rootId, sign * 0.32);
    var nodes = order.map(function (id) { return { id: id, e: byId[id], lx: pos[id].x, ly: pos[id].y, r: nodeR(byId[id]) }; });
    var segs = edges.map(function (ed) {
      var a = ed.a == null ? { x: ed.ax, y: ed.ay } : pos[ed.a], b = pos[ed.b], le = byId[ed.b];
      return { pts: lightningPts(a.x, a.y, b.x, b.y, 3, (strHash(ed.b) % 9999) + 1), layer: le && le.layer, val: le && le.valence };
    });
    return { anchorT: anchorT, rootId: rootId, rootEvent: byId[rootId], nodes: nodes, segs: segs, maxX: maxX };
  }

  function drawTunnel(st) {
    var T = st._tunnel; if (!T) return;
    var ctx = T.ctx, view = st.view, C = cvColors(), gesturing = !!st._gesturing, hidden = st.hidden || {}, lang = T.lang;
    var x0 = T.x0, x1 = T.x1, cy = T.cy, half = T.half;
    ctx.setTransform(T.dpr, 0, 0, T.dpr, 0, 0);
    ctx.clearRect(0, 0, T.W, H);
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 6, 0, (x1 - x0) + 12, H); ctx.clip();
    ctx.lineCap = 'round';

    var sx = function (t) { return (tms(t) - view.originT) / DAY_MS * view.pxPerDay + view.panX; };
    var syAt = function (scrX) { return cy + 4 * Math.sin((scrX - view.panX) * 0.012); };
    // 3.1 real zoom: a single factor derived from how far we've zoomed past the
    // period's fit-to-view scale. Drives branch length, node spacing/radius,
    // tooltip size and (capped to the zone) the parallel-branch spread.
    var Z = Math.max(0.6, Math.min(3.5, view.pxPerDay / (view._basePxPerDay || view.pxPerDay)));
    st._zoomScale = Z;
    var rZ = Math.max(0.85, Math.min(2.2, Z));         // node-radius scale (gentler)
    var labelPx = Math.round(Math.max(10, Math.min(18, 10 * Z)));
    var sOrigin = sx(view.originT), sNow = sx(view.nowT);
    var a = Math.max(x0 - 20, sOrigin), b = Math.min(x1 + 20, sNow);

    // grid (visible only)
    ctx.strokeStyle = C.lineFaint; ctx.lineWidth = 1;
    var gp = Math.max(60, view.pxPerDay * 2);
    var firstG = sOrigin + Math.ceil((x0 - sOrigin) / gp) * gp;
    for (var gx = firstG; gx <= x1; gx += gp) { ctx.beginPath(); ctx.moveTo(gx, T.fieldTop); ctx.lineTo(gx, T.fieldBot); ctx.stroke(); }

    // #2: dim veil over the empty pre-activity stretch (registration → first event)
    var firstEvX = T.events.length ? sx(T.events[0].t) : sNow;
    if (firstEvX > x0 + 8) {
      var fade = ctx.createLinearGradient(x0, 0, Math.min(firstEvX, x1), 0);
      fade.addColorStop(0, 'rgba(3,6,10,0.5)'); fade.addColorStop(1, 'rgba(3,6,10,0)');
      ctx.fillStyle = fade; ctx.fillRect(x0, 0, Math.min(firstEvX, x1) - x0, H);
    }

    // halo (the XP layer) — gradient band, skipped mid-gesture (shadowBlur is dear)
    if (!hidden.xp_gain && !gesturing && b > a) drawHaloCv(ctx, st, sx, syAt, a, b, T);

    // spine: dim base + bright lived tract, breathing — capped point count
    if (b > a) {
      var step = Math.max(6, (b - a) / 180);
      ctx.beginPath();
      for (var p = a; p <= b; p += step) { var y = syAt(p); if (p === a) ctx.moveTo(p, y); else ctx.lineTo(p, y); }
      ctx.lineTo(b, syAt(b));
      ctx.strokeStyle = C.lineSecondary; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.45; ctx.stroke(); ctx.globalAlpha = 1;
      if (!gesturing) { ctx.save(); ctx.shadowColor = 'rgba(255,255,255,0.6)'; ctx.shadowBlur = 6; }
      ctx.beginPath();
      for (var p2 = a; p2 <= b; p2 += step) { var y2 = syAt(p2); if (p2 === a) ctx.moveTo(p2, y2); else ctx.lineTo(p2, y2); }
      ctx.lineTo(b, syAt(b));
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
      if (!gesturing) ctx.restore();
    }

    // #2: "начало" marker at the registration point
    if (sOrigin >= x0 - 30 && sOrigin <= x1) {
      var oy = syAt(sOrigin);
      ctx.beginPath(); ctx.arc(sOrigin, oy, 3.2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
      ctx.beginPath(); ctx.arc(sOrigin, oy, 7, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
      if (!gesturing) {
        ctx.font = '9px Inter, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = C.textMono;
        var reg = st.user && st.user.createdAt ? new Date(st.user.createdAt) : null;
        var lab = (lang === 'en' ? 'start' : lang === 'es' ? 'inicio' : 'начало') + (reg && !isNaN(reg) ? ' · ' + fmtTick(reg.getTime(), DAY_MS, lang) : '');
        ctx.fillText(lab, sOrigin + 10, oy - 10);
      }
    }

    // ── branches v6: ONE lightning branch per connected component (a real
    // journey_links chain). Nodes sit ALONG the branch in chain order; real
    // sub-branches appear only at genuine graph forks. No decorative sub-forks,
    // no separate chain curves — the branch IS the chain. ──
    st._nodes = []; st._visComps = [];
    var comps = T.components || [];
    // ── PR5 smart auto-expand: when several chains crowd the same time-slice,
    // spread their branches vertically (use more of the chains zone); when sparse,
    // stay compact. Density = max visible anchors inside any 50px time bucket. The
    // scale is capped so branches never leave the zone, so it tracks zoom live. ──
    if (T._maxAbsLy == null) { var mly = 0; comps.forEach(function (cp) { cp.nodes.forEach(function (n) { var a = Math.abs(n.ly); if (a > mly) mly = a; }); }); T._maxAbsLy = mly || 1; }
    var bkt = {}, dens = 1;
    for (var di = 0; di < comps.length; di++) { var axd = sx(comps[di].anchorT); if (axd < x0 - 30 || axd > x1 + 30) continue; var bk = Math.floor(axd / 40); bkt[bk] = (bkt[bk] || 0) + 1; if (bkt[bk] > dens) dens = bkt[bk]; }
    // PR FIX #6: spread as soon as TWO chains share a time-slice (was 3+), and
    // spread harder, so zoom-in visibly fans crowded slots apart.
    var wantS = dens > 4 ? 2.6 : dens > 2 ? 2.0 : dens > 1 ? 1.6 : 1.0;
    var vS = Math.min(wantS, Math.max(1.0, (half - 8) / T._maxAbsLy));
    // 3.1: let zoom-in widen the parallel-branch spread too, but never past the
    // chains zone — at deep zoom branches fan out to fill the available height.
    var vCombined = Math.min((half - 6) / T._maxAbsLy, vS * Math.max(1, Z * 0.7));
    st._vScale = vCombined;
    for (var ci = 0; ci < comps.length; ci++) {
      var comp = comps[ci];
      var ax = sx(comp.anchorT);
      if (ax + comp.maxX * Z < x0 - 30 || ax > x1 + 30) continue;     // virtualize whole branch (scaled extent)
      var ay = syAt(ax);
      st._visComps.push({ comp: comp, ax: ax, ay: ay });
      // edges — white nerve-fibre base + thin coloured stripe over it
      for (var si = 0; si < comp.segs.length; si++) {
        var sg = comp.segs[si], fillS = cvLayerFill(sg.layer, sg.val), spts = sg.pts, scr = [];
        for (var pi = 0; pi < spts.length; pi++) scr.push({ x: ax + spts[pi].x * Z, y: ay + spts[pi].y * vCombined });
        strokePolyline(ctx, scr, 'rgba(255,255,255,0.6)', 2.2 * Math.min(1.6, rZ), 0.5);
        strokePolyline(ctx, scr, fillS, 1 * Math.min(1.6, rZ), 0.85);
      }
      // nodes strung along the branch
      for (var ni = 0; ni < comp.nodes.length; ni++) {
        var nd = comp.nodes[ni], e = nd.e, nx = ax + nd.lx * Z, ny = ay + nd.ly * vCombined, ndr = nd.r * rZ;
        var fillN = cvLayerFill(e.layer, e.valence);
        var glow = !gesturing && (e.layer === 'insight' || e.layer === 'practice' || e.valence === 'positive');
        drawNodeCv(ctx, e.layer, nx, ny, ndr, fillN, glow);
        st._nodes.push({ x: nx, y: ny, r: ndr, e: e });
        // PR FIX #8: labels are hidden by default (they overlapped on zoom-in).
        // Only the hovered/tapped node shows its label, and it's highlighted.
        var isHover = st._hoverNodeId != null && String(e.id) === st._hoverNodeId;
        if (isHover) {
          ctx.save(); ctx.beginPath(); ctx.arc(nx, ny, ndr + 3, 0, 6.283); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
          ctx.font = labelPx + 'px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,9,14,0.92)'; ctx.fillStyle = '#eaf2ff';
          var txt = truncate(prettyTitle(e, lang), 22);
          ctx.strokeText(txt, nx, ny - ndr - 6); ctx.fillText(txt, nx, ny - ndr - 6);
        }
      }
    }

    // ── PR5: External Field overlay tracks (bottom zone) ──
    st._overlayNodes = [];
    if (T.overlay) drawOverlayTracks(ctx, st, T, sx, view, C, gesturing, lang);

    // module headers (top), now marker, time axis (bottom)
    drawModuleHeadersCv(ctx, st, sx, x0, x1, T.fieldTop, C, lang, gesturing);
    if (sNow >= x0 && sNow <= x1 + 4) {
      var ny = syAt(sNow);
      if (!gesturing) { ctx.save(); ctx.shadowColor = C.cyan; ctx.shadowBlur = 8; }
      ctx.beginPath(); ctx.arc(sNow, ny, 4, 0, Math.PI * 2); ctx.fillStyle = C.cyan; ctx.fill();
      if (!gesturing) ctx.restore();
    }
    drawTimeAxisCv(ctx, view, lang, x0, x1, C);
    ctx.restore();
    // Sticky External Field layer icons — drawn OUTSIDE the scroll clip so they
    // hang in the leftmost part of the visible area at any zoom/scroll (1.2),
    // mirroring the collective path's "sticky — outside the scroll clip" tracks.
    if (T.overlay) drawOverlayIcons(ctx, T, C, lang);
  }

  // ── 1.2: sticky left-gutter icons for each External Field overlay layer. Kept
  // out of drawOverlayTracks (which is clipped) and rendered after the clip is
  // restored, so the glyphs never scroll off or get clipped. A faint backing
  // chip keeps them legible over the track baselines/markers on desktop. ──
  function drawOverlayIcons(ctx, T, C, lang) {
    var ov = T.overlay; if (!ov || !ov.layers.length) return;
    var n = ov.layers.length, zoneTop = ov.top, zoneBot = ov.bot, trackH = (zoneBot - zoneTop) / n;
    ctx.textBaseline = 'middle';
    ctx.font = '12px Inter, system-ui, sans-serif';
    // PR #82: ICON-ONLY left-pinned glyph (no "☀ Sun" word label). Since PR #81 the
    // status cards live in the left/right RAILS (outside the canvas), so the left
    // gutter is free again and the labels no longer collide. The full Sun/Moon/Earth
    // names already live in the right-rail layer-toggle card; drawing them again on
    // the canvas read as a duplicate list sitting next to that card. Keeping just the
    // ☀/☾/⊕ track glyph identifies each overlay track without the repetition.
    ctx.textAlign = 'left';
    var lx = 2;
    for (var li = 0; li < n; li++) {
      var L = ov.layers[li], cy = zoneTop + trackH * li + trackH / 2;
      ctx.fillStyle = C.textDim;
      ctx.fillText(L.icon, lx, cy);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // ── PR5: draw the External Field overlay tracks in the bottom zone. One thin
  // horizontal track per showOnPath layer; markers sit on the SAME time axis as
  // the chains (shared sx). Severity drives marker colour. Populates
  // st._overlayNodes for hover/click hit-testing. ──
  function drawOverlayTracks(ctx, st, T, sx, view, C, gesturing, lang) {
    var ov = T.overlay; if (!ov || !ov.layers.length) return;
    var x0 = T.x0, x1 = T.x1, n = ov.layers.length;
    var zoneTop = ov.top, zoneBot = ov.bot, trackH = (zoneBot - zoneTop) / n;
    // zone divider line between personal chains and environmental context
    ctx.beginPath(); ctx.moveTo(x0 - 6, zoneTop - 6); ctx.lineTo(x1 + 6, zoneTop - 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1; ctx.stroke();
    for (var li = 0; li < n; li++) {
      var L = ov.layers[li], cyT = zoneTop + trackH * li + trackH / 2;
      // faint track baseline
      ctx.beginPath(); ctx.moveTo(x0, cyT); ctx.lineTo(x1, cyT);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.stroke();
      // NB: layer icons are drawn separately by drawOverlayIcons() AFTER the
      // scroll clip is restored, so they stay pinned to the left edge of the
      // visible area instead of being clipped out of the [x0-6, x1+6] band (1.2).
      // markers
      for (var ei = 0; ei < L.events.length; ei++) {
        var ev = L.events[ei], mx = sx(ev.t);
        if (mx < x0 - 4 || mx > x1 + 4) continue;
        var col = SEV_WORD[ev.severity_color] || overlaySeverityColor(L.key, ev.severity);
        if (!gesturing) { ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 5; }
        ctx.beginPath(); ctx.arc(mx, cyT, 3.4, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
        if (!gesturing) ctx.restore();
        st._overlayNodes.push({ x: mx, y: cyT, r: 3.4, ev: ev, layer: L.key, color: col });
      }
    }
    ctx.textBaseline = 'alphabetic';
  }

  // ── PR5: detail card for an External Field overlay marker (click/tap). ──
  // PR FIX #3: short human phrase for a hover tooltip (severity → plain words +
  // a tiny impact hint). Localised RU/EN/ES.
  function buildOverlayPhrase(ev, layer, lang) {
    function pick(ru, en, es) { return lang === 'en' ? en : lang === 'es' ? es : ru; }
    var sev = String(ev.severity || ''), title = String(ev.title || '');
    if (layer === 'sun') {
      var fm = sev.match(/([CMX])\s*([\d.]*)/i);
      if (fm) { var c = fm[1].toUpperCase(); var strong = c === 'X' ? pick('очень сильная', 'very strong', 'muy fuerte') : c === 'M' ? pick('сильная', 'strong', 'fuerte') : pick('умеренная', 'moderate', 'moderada');
        return pick('Вспышка ' + c + fm[2] + ' — ' + strong, 'Flare ' + c + fm[2] + ' — ' + strong, 'Llamarada ' + c + fm[2] + ' — ' + strong); }
      var kp = sev.match(/Kp\s*([\d.]+)/i);
      if (kp) return pick('Магнитная буря Kp ' + kp[1] + ' — возможны головные боли', 'Geomagnetic storm Kp ' + kp[1] + ' — headaches possible', 'Tormenta geomagnética Kp ' + kp[1] + ' — posibles dolores de cabeza');
    }
    if (layer === 'earth') {
      var mg = sev.match(/M\s*([\d.]+)/i);
      if (mg) return pick('Землетрясение M' + mg[1], 'Earthquake M' + mg[1], 'Terremoto M' + mg[1]) + (title && title.length < 40 ? ' — ' + title : '');
    }
    if (layer === 'moon') {
      if (/full|полнолун/i.test(title + sev)) return pick('Полнолуние', 'Full moon', 'Luna llena');
      if (/new|новолун/i.test(title + sev)) return pick('Новолуние', 'New moon', 'Luna nueva');
    }
    if (layer === 'weather') {
      var uv = sev.match(/UV\s*([\d.]+)/i) || title.match(/UV\s*([\d.]+)/i);
      if (uv) return pick('UV ' + uv[1] + ' — ожог за ~10 мин', 'UV ' + uv[1] + ' — sunburn in ~10 min', 'UV ' + uv[1] + ' — quemadura en ~10 min');
    }
    if (layer === 'cosmos') return pick('Гравитационная волна', 'Gravitational wave', 'Onda gravitacional');
    return title || (OVERLAY_LABEL[layer] ? (OVERLAY_LABEL[layer][lang] || OVERLAY_LABEL[layer].ru) : layer);
  }
  function hideOverlayTip() { var tp = document.getElementById('evo-ov-tip'); if (tp) tp.style.display = 'none'; }
  // 3.2: ONE tooltip element + show/hide, shared by the personal overlay markers
  // AND the collective path's node hover (via window.EvolutionPath). No duplicate
  // DOM/style — both paths render the visually-identical chip.
  function showSharedTip(clientX, clientY, text, color) {
    var tip = document.getElementById('evo-ov-tip');
    if (!tip) { tip = document.createElement('div'); tip.id = 'evo-ov-tip'; tip.style.cssText = 'position:fixed;z-index:10050;pointer-events:none;background:rgba(10,14,20,0.97);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:4px 9px;font:11px Inter,system-ui,sans-serif;color:#dfe;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,0.5);'; document.body.appendChild(tip); }
    tip.style.borderColor = (color || '#8fd0ff') + '66';
    tip.textContent = text;
    tip.style.left = (clientX + 12) + 'px'; tip.style.top = (clientY - 10) + 'px'; tip.style.display = 'block';
  }
  // PR FIX #8: track the hovered node so only its label is drawn.
  function nodeHover(S, lx, ly) {
    var st = S.st, nodes = (st && st._nodes) || [], best = null, bd = 1e9;
    for (var i = 0; i < nodes.length; i++) { var n = nodes[i], d = Math.hypot(n.x - lx, n.y - ly), hit = Math.max(20, n.r + 10); if (d < hit && d < bd) { bd = d; best = n; } }
    var id = best ? String(best.e.id) : null;
    if (id !== st._hoverNodeId) { st._hoverNodeId = id; try { drawTunnel(st); } catch (e) {} }
  }
  function overlayHover(S, lx, ly, clientX, clientY, lang) {
    var st = S.st, nodes = (st && st._overlayNodes) || [], hit = null;
    for (var i = 0; i < nodes.length; i++) { if (Math.hypot(nodes[i].x - lx, nodes[i].y - ly) < 9) { hit = nodes[i]; break; } }
    if (!hit) { hideOverlayTip(); return; }
    showSharedTip(clientX, clientY, buildOverlayPhrase(hit.ev, hit.layer, lang), hit.color);
  }
  function showOverlayCard(container, marker, lang) {
    var host = stageOf(container);
    var old = host.querySelector('.evo-ov-card'); if (old) old.remove();
    var ev = marker.ev, lab = OVERLAY_LABEL[marker.layer] ? (OVERLAY_LABEL[marker.layer][lang] || OVERLAY_LABEL[marker.layer].ru) : marker.layer;
    var icon = OVERLAY_ICON[marker.layer] || '•';
    var when = '';
    try { when = new Date(ev.t).toLocaleString(lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
    var sev = ev.severity ? '<span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:6px;font-size:10px;background:' + marker.color + '22;color:' + marker.color + ';border:1px solid ' + marker.color + '55;">' + escapeHtml(String(ev.severity)) + '</span>' : '';
    var src = ev.source_url ? '<a href="' + escapeHtml(ev.source_url) + '" target="_blank" rel="noopener" style="color:var(--accent-cyan,#5cf);font-size:11px;text-decoration:none;">' + escapeHtml(ev.source || 'source') + ' ↗</a>' : (ev.source ? '<span style="color:var(--myc-text-dim,#89a);font-size:11px;">' + escapeHtml(ev.source) + '</span>' : '');
    var card = document.createElement('div');
    card.className = 'evo-ov-card';
    card.style.cssText = 'position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:30;max-width:340px;width:calc(100% - 32px);background:rgba(12,15,20,0.97);border:1px solid ' + marker.color + '55;border-radius:12px;padding:0.85rem 1rem;backdrop-filter:blur(10px);box-shadow:0 8px 30px rgba(0,0,0,0.5);';
    card.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">' +
        '<div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:' + marker.color + ';">' + icon + ' ' + escapeHtml(lab) + sev + '</div>' +
        '<button class="evo-ov-x" style="background:none;border:none;color:var(--myc-text-dim,#89a);font-size:15px;cursor:pointer;line-height:1;">✕</button>' +
      '</div>' +
      '<div style="font-size:13px;color:var(--myc-text,#cdd);font-weight:600;margin:0.35rem 0 0.2rem;">' + escapeHtml(ev.title || lab) + '</div>' +
      (ev.description ? '<div style="font-size:12px;color:var(--myc-text-dim,#9ab);line-height:1.5;margin-bottom:0.35rem;">' + escapeHtml(String(ev.description).slice(0, 220)) + '</div>' : '') +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:0.3rem;">' +
        '<span style="font-size:11px;color:var(--myc-text-dim,#789);font-family:\'JetBrains Mono\',monospace;">' + escapeHtml(when) + '</span>' + src +
      '</div>';
    host.appendChild(card);
    var x = card.querySelector('.evo-ov-x'); if (x) x.addEventListener('click', function () { card.remove(); });
  }

  // jagged forward-biased polyline (lightning). X advances monotonically forward
  // (the per-step Y jitter is bounded well under the X advance → never doubles back).
  function lightningPts(x0, y0, x1, y1, segN, seed) {
    var pts = [{ x: x0, y: y0 }], dx = x1 - x0, dy = y1 - y0;
    for (var s = 1; s < segN; s++) {
      var f = s / segN;
      var jx = (jit(seed * 7 + s) - 0.5) * (dx / segN) * 0.5;   // |jx| < ½ the step → monotonic
      var jy = (jit(seed * 13 + s) - 0.5) * Math.min(Math.abs(dx) * 0.18, 22);
      pts.push({ x: x0 + dx * f + jx, y: y0 + dy * f + jy });
    }
    pts.push({ x: x1, y: y1 });
    return pts;
  }
  function strokePolyline(ctx, pts, color, w, alpha) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.globalAlpha = alpha; ctx.stroke(); ctx.globalAlpha = 1;
  }

  function drawNodeCv(ctx, layer, cx, cy, r, fill, glow) {
    if (glow) { ctx.save(); ctx.shadowColor = fill; ctx.shadowBlur = 8; }
    ctx.beginPath();
    if (layer === 'practice') { ctx.rect(cx - r, cy - r, r * 2, r * 2); }
    else if (layer === 'insight') {
      var R = r * 1.5, rr = r * 0.55;
      for (var k = 0; k < 8; k++) { var ang = Math.PI * k / 4 - Math.PI / 2, rad = (k % 2 === 0) ? R : rr; var px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad; if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      ctx.closePath();
    } else { ctx.arc(cx, cy, r, 0, Math.PI * 2); }
    ctx.fillStyle = (layer === 'insight') ? fill : 'rgba(255,255,255,0.92)'; ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = fill; ctx.stroke();
    if (glow) ctx.restore();
  }

  function drawHaloCv(ctx, st, sx, syAt, a, b, T) {
    var view = st.view, data = T.data;
    var tA = view.originT + (a - view.panX) / view.pxPerDay * DAY_MS;
    var tB = view.originT + (b - view.panX) / view.pxPerDay * DAY_MS;
    var allEv = allEvents(data), NB = 10;
    var grad = ctx.createLinearGradient(a, 0, b, 0);
    for (var k = 0; k <= NB; k++) {
      var t0 = tA + (tB - tA) * (k / NB), win = Math.abs((tB - tA) / NB) || DAY_MS;
      var slice = allEv.filter(function (e) { return e.layer === 'emotion' && Math.abs(e.t - t0) <= win; });
      var pos = slice.filter(function (e) { return e.valence === 'positive'; }).length;
      var neg = slice.filter(function (e) { return e.valence === 'negative'; }).length;
      var score = slice.length ? (pos - neg) / slice.length : 0;
      grad.addColorStop(Math.min(1, Math.max(0, k / NB)), rgbaFromRgb(valenceColor(score), slice.length ? 0.42 : 0.24));
    }
    var xp = data.layers.xp_gain || [], xpTotal = xp.length ? (xp[xp.length - 1].cumulative || 0) : 0;
    var haloW = 20 + Math.min(52, xpTotal / 22), step = Math.max(8, (b - a) / 120);
    ctx.save(); ctx.shadowColor = 'rgba(120,200,180,0.45)'; ctx.shadowBlur = 22;
    ctx.beginPath();
    for (var p = a; p <= b; p += step) { var y = syAt(p); if (p === a) ctx.moveTo(p, y); else ctx.lineTo(p, y); }
    ctx.strokeStyle = grad; ctx.lineWidth = haloW; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1; ctx.restore();
  }

  function drawModuleHeadersCv(ctx, st, sx, x0, x1, yTop, C, lang, gesturing) {
    if (gesturing) return;
    var view = st.view;
    var secs = moduleSections(st, { from: view.originT, to: view.nowT, span: (view.nowT - view.originT) }, lang);
    var hasMods = st.modules && st.modules.length;
    ctx.font = '10px JetBrains Mono, ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = C.textDim;
    var sLeft = sx(view.originT), sRight = sx(view.nowT), span = sRight - sLeft;
    var slotPx = secs.length ? span / secs.length : span;
    var step = Math.max(1, Math.ceil(128 / Math.max(1, slotPx)));
    secs.forEach(function (s, i) {
      if (!((i % step === 0) || i === secs.length - 1)) return;
      var mid = sLeft + span * (s.frac0 + s.frac1) / 2;
      if (mid < x0 - 40 || mid > x1 + 40) return;
      var nm = truncate(s.label, 16);
      ctx.fillText(hasMods ? (nm ? ((i + 1) + ' · ' + nm) : ((lang === 'en' ? 'Module ' : lang === 'es' ? 'Módulo ' : 'Модуль ') + (i + 1))) : nm, mid, yTop - 14);
    });
  }

  function drawTimeAxisCv(ctx, view, lang, x0, x1, C) {
    var y = H - 16;
    var visibleSpan = (x1 - x0) / view.pxPerDay * DAY_MS;
    var step = pickAxisStep(visibleSpan), labelStep = Math.max(step, HOUR_MS);
    var tStart = view.originT + (x0 - view.panX) / view.pxPerDay * DAY_MS;
    var tEnd = view.originT + (x1 - view.panX) / view.pxPerDay * DAY_MS;
    tStart = Math.max(tStart, view.originT); tEnd = Math.min(tEnd, view.nowT + step);
    var first = Math.ceil(tStart / step) * step, count = 0;
    ctx.font = '9px JetBrains Mono, ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = C.textMono;
    for (var t = first; t <= tEnd && count < 200; t += step, count++) {
      var X = (t - view.originT) / DAY_MS * view.pxPerDay + view.panX;
      if (X < x0 - 2 || X > x1 + 2) continue;
      var isLabel = (step >= labelStep) || (t % labelStep < step);
      ctx.strokeStyle = isLabel ? C.lineMuted : C.lineFaint; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(X, y - (isLabel ? 11 : 7)); ctx.lineTo(X, y - 5); ctx.stroke();
      if (isLabel) ctx.fillText(fmtTick(t, labelStep, lang), X, y);
    }
  }

  // ── canvas pan/zoom: just update the view and redraw the (cheap) visible slice ──
  function wireCanvasPanZoom(container, st, lang) {
    var target = stageOf(container);
    if (target._evoCZ) { var s = target._evoCZ; s.st = st; s.lang = lang; return; }
    var S = { st: st, lang: lang, panVel: 0, raf: null, dragging: false, lastX: 0, moved: false, cursorX: null, hapticAcc: 0, gestIdle: null };
    target._evoCZ = S;
    function T() { return S.st._tunnel; }
    function rectL(clientX) { var t = T(); if (!t) return clientX; return clientX - t.cv.getBoundingClientRect().left; }
    function rectT(clientY) { var t = T(); if (!t) return clientY; return clientY - t.cv.getBoundingClientRect().top; }
    function bounds() { var t = T(); return { x0: t ? t.x0 : 0, x1: t ? t.x1 : 0 }; }
    function clampPan() {
      var v = S.st.view, bb = bounds();
      var minPan = (bb.x1 - 40) - (v.nowT - v.originT) / DAY_MS * v.pxPerDay - (bb.x1 - bb.x0);
      var maxPan = bb.x0 + (bb.x1 - bb.x0) * 0.5;
      v.panX = Math.max(minPan, Math.min(maxPan, v.panX));
    }
    function draw() { drawTunnel(S.st); }
    function gestureOn() { S.st._gesturing = true; if (S.gestIdle) clearTimeout(S.gestIdle); S.gestIdle = setTimeout(function () { S.st._gesturing = false; draw(); }, 150); }
    function haptic(dxAbs) {
      if (!navigator.vibrate) return; var v = S.st.view;
      var notch = Math.max(6, 1400 / Math.max(1, v.pxPerDay) * 2);
      S.hapticAcc += dxAbs; if (S.hapticAcc < notch) return; S.hapticAcc = 0;
      var dur = 4; try { if (S.cursorX != null && Array.isArray(window.__evoEventsX)) { var wxC = S.cursorX - v.panX, n = 0; for (var i = 0; i < window.__evoEventsX.length; i++) { if (Math.abs(window.__evoEventsX[i] - wxC) < 18) n++; if (n > 6) break; } dur = 3 + Math.min(14, n * 3); } } catch (e) {} try { navigator.vibrate(dur); } catch (e) {}
    }
    function panBy(dx) { gestureOn(); S.st.view.panX += dx; clampPan(); haptic(Math.abs(dx)); draw(); }
    function zoomBy(deltaY, atX) {
      gestureOn(); var v = S.st.view;
      var tUnder = v.originT + (atX - v.panX) / v.pxPerDay * DAY_MS;
      v.pxPerDay = Math.max(MIN_PXPD, Math.min(MAX_PXPD, v.pxPerDay * Math.pow(1.0015, -deltaY)));
      v.panX = atX - (tUnder - v.originT) / DAY_MS * v.pxPerDay;
      clampPan(); draw();
    }
    function loop() { S.raf = null; if (!S.dragging && Math.abs(S.panVel) > 0.3) { gestureOn(); S.st.view.panX += S.panVel; clampPan(); haptic(Math.abs(S.panVel)); draw(); S.panVel *= 0.92; S.raf = requestAnimationFrame(loop); } else S.panVel = 0; }
    function kick() { if (!S.raf) S.raf = requestAnimationFrame(loop); }

    target.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) { zoomBy(e.deltaY, rectL(e.clientX)); }
      else { S.cursorX = rectL(e.clientX); var d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY); panBy(-d); S.panVel = -d * 0.5; kick(); }
    }, { passive: false });
    // mouse / pen go through pointer events; touch is owned by the touch handlers
    // below (pointer events can't track two-finger pinch reliably).
    target.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      S.dragging = true; S.moved = false; S.lastX = e.clientX; S.panVel = 0;
      try { target.setPointerCapture(e.pointerId); } catch (er) {}
      target.style.cursor = 'grabbing';
    });
    target.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      S.cursorX = rectL(e.clientX);
      if (!S.dragging) { overlayHover(S, rectL(e.clientX), rectT(e.clientY), e.clientX, e.clientY, lang); nodeHover(S, rectL(e.clientX), rectT(e.clientY)); return; }
      var dx = e.clientX - S.lastX; S.lastX = e.clientX;
      if (Math.abs(dx) > 2) S.moved = true;
      panBy(dx); S.panVel = dx;
    });
    target.addEventListener('pointerleave', function () { hideOverlayTip(); if (S.st && S.st._hoverNodeId != null) { S.st._hoverNodeId = null; try { drawTunnel(S.st); } catch (e) {} } });
    function up(e) {
      if (e.pointerType === 'touch') return;
      if (!S.dragging) return; S.dragging = false; target.style.cursor = ''; kick();
      if (!S.moved) hitTest(rectL(e.clientX), rectT(e.clientY));
    }
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', function (e) { if (e.pointerType === 'touch') return; S.dragging = false; target.style.cursor = ''; });

    // ── touch: 1-finger pan, 2-finger pinch-zoom (anchored at the finger midpoint),
    // tap → hitTest. Owns the touch path entirely so pinch produces real zoom. ──
    var TG = { mode: null, lastMid: 0, startDist: 0, startPxPerDay: 0, moved: false };
    function tRect() { var t = T(); return t ? t.cv.getBoundingClientRect() : { left: 0, top: 0 }; }
    function tMid(tt) { var r = tRect(); return (tt[0].clientX + tt[1].clientX) / 2 - r.left; }
    function tDist(tt) { return Math.hypot(tt[0].clientX - tt[1].clientX, tt[0].clientY - tt[1].clientY); }
    target.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        e.preventDefault(); S.dragging = false; S.panVel = 0;
        TG.mode = 'pinch'; TG.startDist = tDist(e.touches) || 1;
        TG.startPxPerDay = S.st.view.pxPerDay; TG.lastMid = tMid(e.touches);
      } else if (e.touches.length === 1) {
        TG.mode = 'pan'; TG.lastMid = e.touches[0].clientX; TG.moved = false; S.panVel = 0;
      }
    }, { passive: false });
    target.addEventListener('touchmove', function (e) {
      if (TG.mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        var d = tDist(e.touches) || 1, mid = tMid(e.touches), v = S.st.view;
        gestureOn();
        var tUnder = v.originT + (mid - v.panX) / v.pxPerDay * DAY_MS;     // anchor world-time
        v.pxPerDay = Math.max(MIN_PXPD, Math.min(MAX_PXPD, TG.startPxPerDay * (d / TG.startDist)));
        v.panX = mid - (tUnder - v.originT) / DAY_MS * v.pxPerDay;          // keep it under the midpoint
        v.panX += (mid - TG.lastMid); TG.lastMid = mid;                     // + two-finger pan
        clampPan(); draw();
      } else if (TG.mode === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        var x = e.touches[0].clientX, dx = x - TG.lastMid; TG.lastMid = x;
        S.cursorX = rectL(x);
        if (Math.abs(dx) > 2) TG.moved = true;
        panBy(dx); S.panVel = dx;
      }
    }, { passive: false });
    function touchEnd(e) {
      if (TG.mode === 'pan' && !TG.moved) {
        var ct = (e.changedTouches && e.changedTouches[0]) || null, r = tRect();
        if (ct) hitTest(ct.clientX - r.left, ct.clientY - r.top);
      }
      if (e.touches.length === 0) { TG.mode = null; kick(); }
      else if (e.touches.length === 1) { TG.mode = 'pan'; TG.lastMid = e.touches[0].clientX; TG.moved = true; }
    }
    target.addEventListener('touchend', touchEnd, { passive: false });
    target.addEventListener('touchcancel', function () { TG.mode = null; });

    function hitTest(lx, ly) {
      // PR5: External Field overlay marker hit (bottom zone) → detail card
      var ovn = S.st._overlayNodes || [], ob = null, obd = 1e9;
      for (var oi = 0; oi < ovn.length; oi++) { var m = ovn[oi], od = Math.hypot(m.x - lx, m.y - ly); if (od < 14 && od < obd) { obd = od; ob = m; } }
      if (ob) { showOverlayCard(S.st._tunnel.container, ob, S.lang); return; }
      // node hit — fixed 24px target per node (independent of the branch line)
      var nodes = S.st._nodes || [], best = null, bd = 1e9;
      for (var i = 0; i < nodes.length; i++) { var n = nodes[i], d = Math.hypot(n.x - lx, n.y - ly), hit = Math.max(24, n.r + 12); if (d < hit && d < bd) { bd = d; best = n; } }
      if (best) { openMiniNeuromap(S.st._tunnel.container, best.e, S.lang, S.st); return; }
      // branch hit — proximity to any edge of a visible component → open the chain
      var vc = S.st._visComps || [], vSc = S.st._vScale || 1;
      for (var c = 0; c < vc.length; c++) {
        var comp = vc[c].comp, ax = vc[c].ax, ay = vc[c].ay;
        for (var s = 0; s < comp.segs.length; s++) {
          var pts = comp.segs[s].pts;
          for (var p = 1; p < pts.length; p++) {
            if (distToSeg(lx, ly, ax + pts[p - 1].x, ay + pts[p - 1].y * vSc, ax + pts[p].x, ay + pts[p].y * vSc) < 9) {
              if (comp.rootEvent) openMiniNeuromap(S.st._tunnel.container, comp.rootEvent, S.lang, S.st);
              return;
            }
          }
        }
      }
    }
  }

  // smooth Bezier chain path string between two node tips
  function chainD(a, b) {
    var midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2 - Math.min(50, Math.abs(b.x - a.x) * 0.25 + 14);
    if (window.d3 && window.d3.line && window.d3.curveCatmullRom) {
      return window.d3.line().curve(window.d3.curveCatmullRom.alpha(0.7))([[a.x, a.y], [midX, midY], [b.x, b.y]]);
    }
    return 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ' Q' + midX.toFixed(1) + ' ' + midY.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
  }

  // date ticks along the bottom, in world coords
  // ── 2.2: adaptive time axis — picks a "nice" tick interval for the current zoom
  // (month → week → day → hours → 30/15-min) so labels stay ~100px apart. Sub-hour
  // ticks render as faint grid only; the smallest LABELLED unit is the hour. Ticks
  // are drawn only across the visible window (+1 screen margin) for perf at deep zoom.
  var AXIS_STEPS = [ // milliseconds, small → large
    15 * MIN_MS, 30 * MIN_MS, HOUR_MS, 3 * HOUR_MS, 6 * HOUR_MS, 12 * HOUR_MS,
    DAY_MS, 2 * DAY_MS, 5 * DAY_MS, 7 * DAY_MS, 14 * DAY_MS, 30 * DAY_MS, 60 * DAY_MS, 90 * DAY_MS
  ];
  // 3.2: choose the tick interval from the VISIBLE TIME SPAN (not the densest that
  // fits a pixel budget — that wrongly showed hours on the week view). Aim for
  // ≤ ~13 ticks across the window: week→days, month→~5-day, year→months, day→hours,
  // deep zoom→30-min. (smallest step that keeps the tick count reasonable)
  function pickAxisStep(visibleSpanMs) {
    for (var i = 0; i < AXIS_STEPS.length; i++) {
      if (visibleSpanMs / AXIS_STEPS[i] <= 13) return AXIS_STEPS[i];
    }
    return AXIS_STEPS[AXIS_STEPS.length - 1];
  }
  function fmtTick(t, step, lang) {
    var d = new Date(t); if (isNaN(d)) return '';
    var loc = lang === 'ru' ? 'ru-RU' : (lang === 'es' ? 'es-ES' : 'en-US');
    try {
      if (step >= 25 * DAY_MS) return d.toLocaleDateString(loc, { month: 'short', year: '2-digit' });
      if (step >= 20 * HOUR_MS) return d.toLocaleDateString(loc, { day: 'numeric', month: 'short' });
      return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return d.toISOString().slice(5, 16).replace('T', ' '); }
  }
  function drawWorldTimeAxis(g, view, lang, x0, x1) {
    var y = H - 16;
    var visibleSpan = (x1 - x0) / view.pxPerDay * DAY_MS;    // time visible on screen now
    var step = pickAxisStep(visibleSpan);
    var labelStep = Math.max(step, HOUR_MS);                 // never label below the hour
    // visible time window (world is translated by panX)
    var visStartX = (x0 - view.panX), visEndX = (x1 - view.panX);
    var pad = (x1 - x0);                                     // 1 extra screen each side for panning
    var tStart = view.originT + (visStartX - pad) / view.pxPerDay * DAY_MS;
    var tEnd = view.originT + (visEndX + pad) / view.pxPerDay * DAY_MS;
    tStart = Math.max(tStart, view.originT); tEnd = Math.min(tEnd, view.nowT + step);
    var first = Math.ceil(tStart / step) * step;
    var count = 0;
    for (var t = first; t <= tEnd && count < 400; t += step, count++) {
      var X = (t - view.originT) / DAY_MS * view.pxPerDay;
      var isLabel = (step >= labelStep) || (t % labelStep < step);
      g.appendChild(el('line', { x1: X.toFixed(1), y1: y - (isLabel ? 11 : 7), x2: X.toFixed(1), y2: y - 5,
        stroke: isLabel ? 'var(--myc-line-muted)' : 'var(--myc-line-faint)', 'stroke-width': '1' }));
      if (isLabel) {
        var tx = el('text', { x: X.toFixed(1), y: y.toFixed(1), 'text-anchor': 'middle', 'class': 'evo-axis-label' });
        tx.textContent = fmtTick(t, labelStep, lang);
        g.appendChild(tx);
      }
    }
  }

  /* ── 2.1: luxury pan + zoom ────────────────────────────────────────────────
     Wired ONCE to the persistent container (paints recreate the <svg>/<g>, so we
     look them up fresh each frame). A single rAF loop integrates:
       • pan   — translate-only on the world <g> (GPU), with release momentum
       • zoom  — exponential factor with velocity decay, time-under-cursor pinned;
                 re-renders are coalesced to ≤1 paint per frame.
     Two-finger trackpad scroll (wheel, no ctrl) pans and works independently of
     ctrl/⌘+wheel zoom. navigator.vibrate gives a soft mobile "tick" while panning,
     denser at higher zoom and over node clusters (2.4). */
  function wirePanZoom(svg, world, st, container, lang, x0, x1) {
    // attach gestures to the canvas (the path area), not the whole chrome/panels.
    var target = stageOf(container);
    if (target._evoPZ) { var s = target._evoPZ; s.x0 = x0; s.x1 = x1; s.lang = lang; s.st = st; s.renderedPPD = st.view.pxPerDay; s.targetPPD = st.view.pxPerDay; s.liveScale = 1; applyWorldTransform2(s); return; }
    var S = { x0: x0, x1: x1, lang: lang, st: st, panVel: 0, cursorX: null, raf: null,
              dragging: false, lastClientX: 0, hapticAcc: 0,
              renderedPPD: st.view.pxPerDay, targetPPD: st.view.pxPerDay, liveScale: 1, zoomIdle: null };
    target._evoPZ = S;

    function curWorld() { return container.querySelector('.evo-world'); }
    function curSvg() { return container.querySelector('svg'); }
    function svgScale() {
      var sv = curSvg(); if (!sv) return 1;
      var r = sv.getBoundingClientRect();
      return (sv.viewBox && sv.viewBox.baseVal && sv.viewBox.baseVal.width && r.width) ? (sv.viewBox.baseVal.width / r.width) : 1;
    }
    function localX(clientX) { var sv = curSvg(); if (!sv) return clientX; return (clientX - sv.getBoundingClientRect().left) * svgScale(); }
    function clampPanFor(ppd) {
      var view = S.st.view;
      var minPan = (S.x1 - 40) - (view.nowT - view.originT) / DAY_MS * ppd - (S.x1 - S.x0);
      var maxPan = S.x0 + (S.x1 - S.x0) * 0.5;
      view.panX = Math.max(minPan, Math.min(maxPan, view.panX));
    }
    // 3.1: GPU-composited transform — translate3d for pan, scaleX(liveScale) for the
    // mid-zoom preview. NO SVG path recompute during a gesture; transitions off so
    // they never fight the rAF/wheel updates.
    function applyWorldTransform() { applyWorldTransform2(S); }
    function applyWorldTransform2(s) {
      var w = container.querySelector('.evo-world'); if (!w) return;
      var sx = s.liveScale || 1;
      w.style.transition = 'none';
      w.style.willChange = 'transform';
      w.style.transformOrigin = '0 0';
      w.style.transform = 'translate3d(' + s.st.view.panX.toFixed(2) + 'px,0,0)' + (Math.abs(sx - 1) > 1e-4 ? ' scaleX(' + sx.toFixed(5) + ')' : '');
    }

    // soft haptic tick while moving — denser at higher zoom & over node clusters
    function haptic(dxAbs) {
      if (!navigator.vibrate) return;
      var view = S.st.view;
      var notch = Math.max(6, 1400 / Math.max(1, view.pxPerDay) * 2);
      S.hapticAcc += dxAbs;
      if (S.hapticAcc < notch) return;
      S.hapticAcc = 0;
      var dur = 4;
      try {
        if (S.cursorX != null && Array.isArray(window.__evoEventsX)) {
          var worldX = (S.cursorX - view.panX) / (S.liveScale || 1), win = 18;
          var n = 0; for (var i = 0; i < window.__evoEventsX.length; i++) { if (Math.abs(window.__evoEventsX[i] - worldX) < win) n++; if (n > 6) break; }
          dur = 3 + Math.min(14, n * 3);
        }
      } catch (e) {}
      try { navigator.vibrate(dur); } catch (e) {}
    }

    function effPPD() { return (Math.abs((S.liveScale || 1) - 1) > 1e-4) ? S.targetPPD : S.st.view.pxPerDay; }
    // after panning stops, refresh axis/grid for the newly-revealed region (one
    // repaint, debounced — the pan itself stays transform-only / lag-free).
    function schedulePanRepaint() {
      if (S.panIdle) clearTimeout(S.panIdle);
      S.panIdle = setTimeout(function () { S.panIdle = null; if (!S.dragging) { paint(container, S.st, S.lang); applyWorldTransform(); } }, 200);
    }
    // #3: during a gesture, drop SVG filters (glow/halo blur) on the moving world.
    // Filtered content re-rasterises every frame when its <g> is transformed — the
    // real cause of the stutter. They snap back ~160ms after motion stops.
    function gesture() {
      var sv = curSvg();
      if (sv && !sv._gesturing) { sv.classList.add('evo-gesturing'); sv._gesturing = true; }
      if (S.gestIdle) clearTimeout(S.gestIdle);
      S.gestIdle = setTimeout(function () { var s = curSvg(); if (s) { s.classList.remove('evo-gesturing'); s._gesturing = false; } }, 160);
    }
    function panBy(dx) { gesture(); S.st.view.panX += dx; clampPanFor(effPPD()); applyWorldTransform(); haptic(Math.abs(dx)); schedulePanRepaint(); }

    // ── zoom: live CSS scale (instant, GPU) + ONE crisp repaint when the gesture
    // goes idle (~110ms). No per-frame SVG rebuild → no "тык-тык-тык". ──
    function zoomWheel(deltaY, atX) {
      gesture();
      S.cursorX = atX;
      var view = S.st.view;
      var sx0 = S.liveScale || 1;
      var renderedWorldXUnder = (atX - view.panX) / sx0;                 // world-x (rendered scale) under cursor
      S.targetPPD = Math.max(MIN_PXPD, Math.min(MAX_PXPD, (S.targetPPD || view.pxPerDay) * Math.pow(1.0015, -deltaY)));
      var sx = S.targetPPD / S.renderedPPD;
      S.liveScale = sx;
      view.panX = atX - sx * renderedWorldXUnder;                        // pin time-under-cursor
      clampPanFor(S.targetPPD);
      applyWorldTransform();
      if (S.zoomIdle) clearTimeout(S.zoomIdle);
      S.zoomIdle = setTimeout(commitZoom, 110);
    }
    function commitZoom() {
      S.zoomIdle = null;
      var view = S.st.view;
      view.pxPerDay = S.targetPPD;     // panX already maps correctly at the new scale w/ liveScale=1
      S.renderedPPD = S.targetPPD;
      S.liveScale = 1;
      clampPanFor(view.pxPerDay);
      paint(container, S.st, S.lang);  // single crisp rebuild
      applyWorldTransform();
    }

    function loop() {
      S.raf = null;
      // pan momentum only (translate-only, no repaint) → buttery glide
      if (!S.dragging && Math.abs(S.panVel) > 0.3) {
        S.st.view.panX += S.panVel; clampPanFor(effPPD()); applyWorldTransform(); haptic(Math.abs(S.panVel));
        S.panVel *= 0.92;
        S.raf = requestAnimationFrame(loop);
      } else { S.panVel = 0; }
    }
    function kick() { if (!S.raf) S.raf = requestAnimationFrame(loop); }

    // wheel: ctrl/⌘ → zoom, otherwise two-finger pan (independent of zoom)
    target.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        zoomWheel(e.deltaY, localX(e.clientX));
      } else {
        S.cursorX = localX(e.clientX);
        var d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
        panBy(-d);
        S.panVel = -d * 0.5;       // a little glide after the stream stops
        kick();
      }
    }, { passive: false });

    // pointer drag pan (mouse + touch) with release momentum
    target.addEventListener('pointerdown', function (e) {
      if (e.target.closest && (e.target.closest('.evo-node') || e.target.closest('.evo-chain'))) return;
      S.dragging = true; S.lastClientX = e.clientX; S.panVel = 0;
      try { target.setPointerCapture(e.pointerId); } catch (er) {}
      target.style.cursor = 'grabbing';
    });
    target.addEventListener('pointermove', function (e) {
      S.cursorX = localX(e.clientX);
      if (!S.dragging) return;
      var dx = (e.clientX - S.lastClientX) * svgScale();
      S.lastClientX = e.clientX;
      panBy(dx);
      S.panVel = dx;
    });
    function endDrag() { if (!S.dragging) return; S.dragging = false; target.style.cursor = ''; kick(); }
    target.addEventListener('pointerup', endDrag);
    target.addEventListener('pointercancel', endDrag);
    target.addEventListener('pointerleave', function () { S.hapticAcc = 0; });
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
    var canvas = stageOf(container);
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
    // 5.3: open the FULL neuromap in a NEW TAB, deep-linked to this node + its chain,
    // so the embedded path stays put. account.html reads ?focus / ?chain on load.
    box.querySelector('.evo-mini-open').addEventListener('click', function () {
      var chainIds = [center.id].concat(neighbours.map(function (n) { return n.id; }));
      var url = '/account.html?tab=tools&subtab=neuromap' +
                '&focus=' + encodeURIComponent(center.id) +
                '&chain=' + encodeURIComponent(chainIds.join(','));
      window.open(url, '_blank', 'noopener,noreferrer');
    });
    // outside-click closes
    container.__miniNmOutside = function (e) { if (!box.contains(e.target) && !e.target.closest('.evo-node')) closeMiniNeuromap(container); };
    setTimeout(function () { document.addEventListener('mousedown', container.__miniNmOutside, true); }, 0);
  }

  /* ── view: LAYERS (horizontal lanes, wavy baselines) ────────────────────── */
  function renderLayers(svg, W, data, lang, container, st) {
    var dom = layersDomain(data, st);
    // PR: keep just enough left gutter for the lane labels (drawn at x:10); drop the
    // old 150px right reservation so the lanes span the stage between the rails.
    var padL = 64, padR = 28, padTop = 46, padBot = 30;
    var x0 = padL, x1 = W - padR;
    var hidden = st.hidden || {};
    var lanes = LAYERS.filter(function (l) { return !hidden[l.key]; });
    if (!lanes.length) lanes = LAYERS.slice();
    var laneH = (H - padTop - padBot) / lanes.length;
    var xOf = function (t) { return x0 + clamp01((tms(t) - dom.from) / dom.span) * (x1 - x0); };
    var g = el('g', { 'class': 'myc-fade' });

    // module sections across the top
    drawModuleHeaders(g, st, dom, lang, x0, x1, padTop);

    // only events inside the selected period window — so period buttons crop the view
    var allEv = allEvents(data).filter(function (e) { return inWindow(e.t, dom); });
    indexEvents(allEv);
    var windowCount = 0;

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
        if (!inWindow(e.t, dom)) return;          // crop to the selected period window
        windowCount++;
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
    // empty-in-window hint: lanes still render (so the structure is visible) but
    // tell the user nothing landed in this period rather than leaving it blank.
    if (!windowCount) {
      var note = el('text', { x: ((x0 + x1) / 2).toFixed(1), y: (padTop + (H - padTop - padBot) / 2).toFixed(1),
        'text-anchor': 'middle', 'class': 'evo-axis-label', opacity: '0.7' });
      note.textContent = L(STR.emptyPeriod, lang);
      g.appendChild(note);
    }
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

    // #2: load the FULL journey (registration→now) once, not just the last year —
    // the period buttons only re-zoom this pool client-side. Bounded by account age.
    var cu = (typeof window.currentUser !== 'undefined' && window.currentUser) ? window.currentUser : null;
    var regIso = cu && (cu.created_at || cu.createdAt);
    var evoUrl = regIso
      ? '/api/users/me/evolution?from=' + encodeURIComponent(new Date(regIso).toISOString()) + '&to=' + encodeURIComponent(new Date().toISOString())
      : '/api/users/me/evolution?period=all';
    // PR91: optional subject scope (dependent:<id> | team:<id>) for child/team path view
    if (opts.subject) evoUrl += '&subject=' + encodeURIComponent(opts.subject);
    Promise.all([
      jget(evoUrl),
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
      // Repaint when the canvas width actually changes (layout race, tab/window
      // resize, mobile mount, orientation change). Debounced ~120ms so it never
      // fires per-pixel during a drag-resize (#1 + #3). On width change the view
      // is rebuilt against the new field width so phones don't get a narrow strip.
      if (!st._ro) {
        var debounced = function () {
          clearTimeout(st._roTimer);
          st._roTimer = setTimeout(function () {
            var cv = stageOf(container);
            if (!cv || !st.data) return;
            var w = measureW(cv, container);
            if (Math.abs(w - (st._w || 0)) > 24) { st.view = null; paint(container, st, lang); }
          }, 120);
        };
        if (typeof ResizeObserver === 'function') {
          st._ro = new ResizeObserver(debounced);
          try { st._ro.observe(container); } catch (e) {}
        }
        window.addEventListener('orientationchange', debounced);
        if (window.visualViewport) window.visualViewport.addEventListener('resize', debounced);
        st._roBound = true;
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
      ? '<button class="myc-evo-expand" title="'+(window.t?window.t('a.tools.fullscreen_tooltip','Раскрыть на весь экран'):'Раскрыть на весь экран')+'" style="margin-left:0.5rem;background:rgba(20,24,30,0.7);border:1px solid rgba(255,255,255,0.12);color:var(--myc-text,#cdd);border-radius:8px;height:30px;padding:0 0.7rem;font-size:12px;cursor:pointer;">⤢ '+(window.t?window.t('a.tools.fullscreen','Раскрыть'):'Раскрыть')+'</button>'
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
          var w = measureW(stageOf(container), container);
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
    var box = container.querySelector('.myc-evo-canvas');
    // PR: the header (title + mode/period controls) is relocated INTO the centre
    // stage so the framed panel reads as one dark rectangle — title · snake · axis —
    // filling the gap between the profile rail and the layers rail. Before clearing
    // the box, pull the head back out to the container so neither innerHTML reset
    // below destroys it (its wired listeners survive the move). Skipped for the
    // fullscreen overlay, whose own chrome already shows the title.
    var headEl = (!st._isOverlay) ? container.querySelector('.myc-evo-head') : null;
    if (headEl && headEl.parentNode !== container) container.insertBefore(headEl, box);
    box.innerHTML = '';
    POS = {};
    var data = st.data;
    var totalEvents = Object.keys(data.totals || {}).reduce(function (s, k) { return k === 'xp_total' ? s : s + (data.totals[k] || 0); }, 0);
    if (!totalEvents) {
      box.innerHTML = '<div class="myc-empty"><div class="myc-empty-glyph">✦</div><div class="myc-empty-text">' + L(STR.empty, lang) + '</div></div>';
      return;
    }
    // recompute the logical height for this paint (fullscreen → taller field)
    H = computeH(container, st);
    box.style.minHeight = H + 'px';
    // PR #81: 3-column flex skeleton — profile/stats rail · centre stage · layers
    // rail. The field renders into `.evo-stage` (the 1fr centre cell) so it fills
    // the gap between the rails at every width instead of overlapping them with
    // absolutely-positioned cards. Rails go empty in modes that have no cards.
    box.innerHTML =
      '<div class="evo-rail evo-rail-l"></div>' +
      '<div class="evo-stage" style="position:relative;min-height:' + H + 'px;"></div>' +
      '<div class="evo-rail evo-rail-r"></div>';
    var stage = box.querySelector('.evo-stage');
    var railL = box.querySelector('.evo-rail-l');
    var railR = box.querySelector('.evo-rail-r');
    var W = measureW(stage, container);
    st._w = W;

    if (st.mode === 'layers') {
      var svg = newSvg(W);
      stage.appendChild(svg);
      renderLayers(svg, W, data, lang, container, st);
      addLayerToggles(container, railR, st, lang);
    } else {
      renderTunnel(W, data, container, lang, st);   // renders into `.evo-stage`
      addUserPanel(railL, st, lang);
      // D п.17: stat-card (Уровень / Рост XP / Эмоция / Состояние / Активность)
      // relocated here from the removed «Персонаж» mode.
      addCharacterStats(railL, st, data, data.aggregates || {}, lang);
      addLayerToggles(container, railR, st, lang);
    }
    if (st.isDemo) addDemoBadge(stage, lang);
    // drop the relocated header in at the top of the framed stage (above the snake)
    if (headEl) stage.insertBefore(headEl, stage.firstChild);
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
    // PR FIX #7: External Field layers the server returned (showOnPath=true) get
    // their own quick-toggle here, alongside the personal layers — a session-local
    // override of overlay visibility (doesn't change the External Field setting).
    var ovData = (st.data && st.data.overlays) || {};
    var extKeys = OVERLAY_ORDER.filter(function (k) { return ovData[k] && ovData[k].length; });
    var extRows = extKeys.map(function (k) {
      var on = !st.hidden[k];
      var nm = OVERLAY_LABEL[k] ? (OVERLAY_LABEL[k][lang] || OVERLAY_LABEL[k].ru) : k;
      return '<label class="evo-lt-row"><input type="checkbox" data-layer="' + k + '"' + (on ? ' checked' : '') + '>' +
        '<span>' + OVERLAY_ICON[k] + ' ' + nm + '</span></label>';
    }).join('');
    box.innerHTML = '<div class="evo-lt-title">' + L(STR.layersTitle, lang) + '</div>' +
      LAYERS.map(function (l) {
        var on = !st.hidden[l.key];
        return '<label class="evo-lt-row"><input type="checkbox" data-layer="' + l.key + '"' + (on ? ' checked' : '') + '>' +
          '<span>' + L(l.label, lang) + '</span></label>';
      }).join('') +
      (extRows ? '<div class="evo-lt-sep" style="height:1px;background:rgba(255,255,255,0.08);margin:0.4rem 0;"></div>' + extRows : '');
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

  // ── 3.2: reusable spine engine shared with the collective path. Defined inside
  // the IIFE so it reuses the private chain builders + node painters. The personal
  // path keeps its own drawTunnel (untouched); the collective calls these to get
  // the SAME lightning-chain branches + nodes, so the two read identically. ──
  window.EvolutionPath = {
    // group a user's events (numeric t, links attached as e.links) into chain
    // components laid out in local px (offsets from the spine anchor).
    buildSpine: function (events, half) { return buildTunnelComponents(events || [], half || 22); },
    nodeR: nodeR,
    // 3.2: tooltip text for a node — same source (prettyTitle) as the personal
    // path's hover label, plus the date, so the two read identically.
    tipText: function (e, lang) {
      var ttl = prettyTitle(e, lang || 'ru'), dt = '';
      try { dt = fmtAxis(e.t, lang || 'ru'); } catch (_) {}
      return dt ? (ttl + ' · ' + dt) : ttl;
    },
    showTip: showSharedTip,
    hideTip: hideOverlayTip,
    // render pre-built components into a horizontal band centred at o.cy. Slim
    // layout for the collective: no per-node glow (perf across many spines).
    // o = { sx, cy, x0, x1, zoom?, bandHalf?, rZ?, timeZoom?, hidden?, dim?,
    //       nodesOut?, row? }
    //   • bandHalf  — vertical half-height available to this spine (anti-collision
    //     cap; branches never spread past it into the neighbouring spine).
    //   • timeZoom  — PACK 3.1 zoom factor inherited from the time axis: zoom-in
    //     lengthens branches, fans them taller (toward bandHalf) and grows nodes.
    drawSlimSpine: function (ctx, comps, o) {
      if (!comps || !comps.length) return;
      var sx = o.sx, cy = o.cy, x0 = o.x0, x1 = o.x1;
      var hidden = o.hidden || {}, dim = o.dim == null ? 1 : o.dim;
      var tZ = o.timeZoom || 1;
      var bandHalf = o.bandHalf || (22 * (o.vScale || 1));
      // local vertical extent of this user's branches (cache on the comps array)
      if (comps._maxLy == null) {
        var mly = 0;
        for (var c0 = 0; c0 < comps.length; c0++) { var nn0 = comps[c0].nodes; for (var n0 = 0; n0 < nn0.length; n0++) { var a0 = Math.abs(nn0[n0].ly); if (a0 > mly) mly = a0; } }
        comps._maxLy = mly || 1;
      }
      // STEP 2 adaptive density — measure crowding as the max number of visible
      // chains sharing a ~40px time-bucket on THIS spine.
      var bkt = {}, dens = 1, visN = 0;
      for (var d0 = 0; d0 < comps.length; d0++) { var axd = sx(comps[d0].anchorT); if (axd < x0 - 30 || axd > x1 + 30) continue; visN++; var bk = Math.floor(axd / 40); bkt[bk] = (bkt[bk] || 0) + 1; if (bkt[bk] > dens) dens = bkt[bk]; }
      // vertical fill: map the tallest branch to a fraction of the band that grows
      // with crowding AND with zoom-in, but never past the band (anti-collision).
      // Sparse spines (base ≈0.58) leave headroom; crowded/zoomed ones fan to fill.
      var fit = bandHalf / comps._maxLy;
      var base = dens > 4 ? 0.92 : dens > 2 ? 0.82 : dens > 1 ? 0.70 : 0.58;
      var vS = Math.min(fit, fit * base * Math.max(1, tZ));
      // horizontal: compress crowded spines so branches stay tidy; lengthen on
      // zoom-in (3.1 inheritance).
      var hAdj = dens > 4 ? 0.68 : dens > 2 ? 0.84 : 1.0;
      var hZ = (o.zoom || 1) * hAdj * Math.max(1, tZ * 0.7);
      var rZ = (o.rZ || 1) * Math.min(1.8, Math.max(1, tZ));
      // priority sampling: at extreme crowding drop filler singleton chains (a lone
      // low-weight, non-insight/practice event) so the key branches stay readable.
      var dropFiller = dens > 5 && visN > 14;
      for (var ci = 0; ci < comps.length; ci++) {
        var comp = comps[ci], ax = sx(comp.anchorT);
        if (ax + comp.maxX * hZ < x0 - 30 || ax > x1 + 30) continue;
        if (dropFiller && comp.nodes.length === 1) {
          var fe = comp.nodes[0].e;
          if (fe && fe.layer !== 'insight' && fe.layer !== 'practice' && fe.valence !== 'positive' && (fe.weight || 1) <= 2) continue;
        }
        for (var si = 0; si < comp.segs.length; si++) {
          var sg = comp.segs[si]; if (sg.layer && hidden[sg.layer]) continue;
          var spts = sg.pts, scr = [];
          for (var pi = 0; pi < spts.length; pi++) scr.push({ x: ax + spts[pi].x * hZ, y: cy + spts[pi].y * vS });
          ctx.globalAlpha = 0.55 * dim; strokePolyline(ctx, scr, 'rgba(255,255,255,0.5)', 1.4, 0.5);
          strokePolyline(ctx, scr, cvLayerFill(sg.layer, sg.val), 1, 0.85); ctx.globalAlpha = 1;
        }
        for (var ni = 0; ni < comp.nodes.length; ni++) {
          var nd = comp.nodes[ni], e = nd.e; if (e.layer && hidden[e.layer]) continue;
          var nx = ax + nd.lx * hZ, ny = cy + nd.ly * vS, ndr = nd.r * rZ;
          ctx.globalAlpha = dim; drawNodeCv(ctx, e.layer, nx, ny, ndr, cvLayerFill(e.layer, e.valence), false); ctx.globalAlpha = 1;
          if (o.nodesOut) o.nodesOut.push({ x: nx, y: ny, r: ndr, e: e, row: o.row });
        }
      }
    }
  };
})();
