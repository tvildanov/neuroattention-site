/* ============================================================================
   EvolutionPath — Stage 2 of the Mycelium light-map layer.

   A new visual layer in the personal cabinet (NOT a replacement for the
   profile): the user's development as a light topology. The course is the
   central spine; life-data (emotions, events, thoughts, sensations, insights,
   XP) is the mycelium field around it.

   Three modes:
     • tunnel  — Personal Tunnel View: detailed path, spine + light field
     • layers  — Layer Structure View: horizontal lanes per data layer
     • field   — Single Character Field View: a character in the current field
                 with a time-cursor

   State effect (MVP rule): field amplitude / density / brightness / spread are
   driven by aggregates returned by GET /api/users/me/evolution. Stable / growth
   → wider, brighter, calmer field. Resistance / fatigue → narrower, denser,
   more turbulent. Insight → local bright points.

   Pure vanilla JS + SVG. Reuses tokens from data/css/mycelium.css.

   Public API: window.mountEvolutionPath(container, opts)
     opts: { period, mode, apiBase, token, lang }
   ============================================================================ */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var H = 360;

  var LAYERS = [
    { key: 'practice',  label: { ru: 'Практики',  en: 'Practices',  es: 'Prácticas' } },
    { key: 'emotion',   label: { ru: 'Эмоции',    en: 'Emotions',   es: 'Emociones' } },
    { key: 'event',     label: { ru: 'События',   en: 'Events',     es: 'Eventos' } },
    { key: 'thought',   label: { ru: 'Мысли',     en: 'Thoughts',   es: 'Pensamientos' } },
    { key: 'sensation', label: { ru: 'Ощущения',  en: 'Sensations', es: 'Sensaciones' } },
    { key: 'insight',   label: { ru: 'Инсайты',   en: 'Insights',   es: 'Insights' } },
    { key: 'xp_gain',   label: { ru: 'XP',        en: 'XP',         es: 'XP' } }
  ];
  var MODES = [
    { key: 'tunnel', label: { ru: 'Тоннель',  en: 'Tunnel',    es: 'Túnel' } },
    { key: 'layers', label: { ru: 'Слои',     en: 'Layers',    es: 'Capas' } },
    { key: 'field',  label: { ru: 'Персонаж', en: 'Character', es: 'Personaje' } }
  ];
  var PERIODS = [
    { key: 'week',    label: { ru: 'Неделя', en: 'Week',  es: 'Semana' } },
    { key: 'month',   label: { ru: 'Месяц',  en: 'Month', es: 'Mes' } },
    { key: '3months', label: { ru: '3 мес',  en: '3 mo',  es: '3 m' } },
    { key: 'year',    label: { ru: 'Год',    en: 'Year',  es: 'Año' } }
  ];
  var STR = {
    title:   { ru: 'Путь развития', en: 'Evolution Path', es: 'Camino de evolución' },
    sub:     { ru: 'Личная световая топология: курс — позвоночник, данные жизни — поле вокруг.',
               en: 'Your personal light topology: the course is the spine, life-data is the field around it.',
               es: 'Tu topología de luz personal: el curso es la columna, los datos de vida son el campo.' },
    empty:   { ru: 'Пока мало данных для карты. Проходите практики и отмечайте состояния — поле начнёт расти.',
               en: 'Not enough data yet. Do practices and log states — the field will start to grow.',
               es: 'Aún no hay suficientes datos. Haz prácticas y registra estados — el campo crecerá.' },
    loading: { ru: 'Собираем световое поле…', en: 'Assembling the light field…', es: 'Ensamblando el campo…' },
    fail:    { ru: 'Не удалось загрузить путь развития.', en: 'Could not load the evolution path.', es: 'No se pudo cargar el camino.' },
    moment:  { ru: 'момент', en: 'moment', es: 'momento' },
    now:     { ru: 'сейчас', en: 'now', es: 'ahora' },
    brightness: { ru: 'свет', en: 'brightness', es: 'brillo' },
    positivity: { ru: 'позитив', en: 'positivity', es: 'positivo' },
    turbulence: { ru: 'турбул.', en: 'turbulence', es: 'turbul.' },
    activity:   { ru: 'актив.', en: 'activity', es: 'activ.' }
  };

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
    if (v === 'negative') return { c: 'var(--myc-line-secondary)', o: 0.45 };
    return { c: 'var(--myc-line-secondary)', o: 0.72 };
  }
  function tms(t) { var d = new Date(t); return isNaN(d) ? 0 : d.getTime(); }
  // Real laid-out width of the canvas; viewBox is sized to match so there is no
  // letterboxing (circles stay round, content fills the container).
  function measureW(canvas, container) {
    var w = 0;
    try { w = Math.round(canvas.getBoundingClientRect().width); } catch (e) {}
    if (!w) w = canvas.clientWidth || (container && container.clientWidth) || 0;
    return Math.max(360, w || 1100);
  }
  function newSvg(W) {
    var s = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, preserveAspectRatio: 'xMidYMid meet', style: 'max-width:100%;' });
    s.insertAdjacentHTML('afterbegin', defsMarkup());
    return s;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function defsMarkup() {
    return '<defs>' +
      '<filter id="evoGlow" x="-80%" y="-80%" width="260%" height="260%">' +
      '<feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="evoGlowSoft" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="9"/></filter>' +
      '<radialGradient id="evoField" cx="50%" cy="50%" r="50%">' +
      '<stop offset="0%" stop-color="#A8F7FF" stop-opacity="0.20"/>' +
      '<stop offset="45%" stop-color="#8DFFC8" stop-opacity="0.10"/>' +
      '<stop offset="100%" stop-color="#8DFFC8" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="evoXp" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="#56F2A6" stop-opacity="0"/>' +
      '<stop offset="15%" stop-color="#56F2A6" stop-opacity="0.85"/>' +
      '<stop offset="100%" stop-color="#8DFFC8" stop-opacity="0.9"/></linearGradient></defs>';
  }

  /* ── data helpers ───────────────────────────────────────────────────────── */
  function allEvents(data) {
    var out = [];
    LAYERS.forEach(function (ly) {
      if (ly.key === 'xp_gain') return;
      (data.layers[ly.key] || []).forEach(function (e) { out.push({ layer: ly.key, t: tms(e.t), label: e.label, valence: e.valence, weight: e.weight || 1 }); });
    });
    return out.sort(function (a, b) { return a.t - b.t; });
  }
  function domain(data) {
    var from = tms(data.range.from), to = tms(data.range.to);
    if (to <= from) to = from + 1;
    return { from: from, to: to, span: to - from };
  }
  // recompute aggregates from a subset of events (for the time cursor)
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

  /* ── view: TUNNEL ───────────────────────────────────────────────────────── */
  function renderTunnel(svg, W, data) {
    var ag = data.aggregates, dom = domain(data);
    var cy = H / 2, padX = 40;
    var xOf = function (t) { return padX + (tms(t) - dom.from) / dom.span * (W - padX * 2); };
    var g = el('g', { 'class': 'myc-fade' });

    // field band around the spine — half-height from spread, wobble from density
    var half = (0.16 + 0.52 * ag.spread) * (H / 2);
    var wob = 6 + 26 * ag.density;
    var topPts = [], botPts = [];
    for (var px = padX; px <= W - padX; px += 10) {
      var ph = px / 60;
      var off = half + Math.sin(ph) * wob * 0.5 + Math.sin(ph * 2.3) * wob * 0.3;
      topPts.push([px, cy - off]); botPts.push([px, cy + off]);
    }
    function pathOf(pts) { return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L'); }
    var fillD = pathOf(topPts) + ' L' + botPts.slice().reverse().map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L') + ' Z';
    g.appendChild(el('path', { d: fillD, fill: 'url(#evoField)', opacity: (0.4 + 0.6 * ag.brightness).toFixed(2) }));
    g.appendChild(el('path', { d: pathOf(topPts), fill: 'none', stroke: 'var(--myc-line-muted)', 'stroke-width': '1' }));
    g.appendChild(el('path', { d: pathOf(botPts), fill: 'none', stroke: 'var(--myc-line-muted)', 'stroke-width': '1' }));

    // XP filament above the spine
    var xp = data.layers.xp_gain || [];
    if (xp.length) {
      var maxC = xp[xp.length - 1].cumulative || 1;
      var d = '', f = true;
      xp.forEach(function (p) {
        var y = cy - 10 - 26 * (p.cumulative / maxC);
        d += (f ? 'M' : 'L') + xOf(p.t).toFixed(1) + ' ' + y.toFixed(1); f = false;
      });
      g.appendChild(el('path', { d: d, fill: 'none', stroke: 'url(#evoXp)', 'stroke-width': '2', 'stroke-linecap': 'round', filter: 'url(#evoGlowSoft)', opacity: '0.5' }));
      g.appendChild(el('path', { d: d, fill: 'none', stroke: 'url(#evoXp)', 'stroke-width': '1.6', 'stroke-linecap': 'round' }));
    }

    // central spine (course)
    g.appendChild(el('line', { x1: padX, y1: cy, x2: W - padX, y2: cy, stroke: 'var(--myc-line-primary)', 'stroke-width': '2', 'stroke-linecap': 'round', filter: 'url(#evoGlow)' }));

    // practices = nodes on the spine
    (data.layers.practice || []).forEach(function (p, i) {
      g.appendChild(el('circle', { cx: xOf(p.t), cy: cy, r: 3.4, fill: 'var(--myc-bg-2)', stroke: 'var(--myc-line-primary)', 'stroke-width': '1.4', filter: 'url(#evoGlow)' }));
    });

    // life data scattered within the field band
    var fieldEvents = allEvents(data).filter(function (e) { return e.layer !== 'practice'; });
    fieldEvents.forEach(function (e, i) {
      var st = valStyle(e.valence);
      var yy = cy + (jit(i) - 0.5) * 2 * half * 0.92;
      var isInsight = e.layer === 'insight';
      var r = isInsight ? 3.2 : (1.6 + Math.min(2.4, Math.log(1 + e.weight)));
      var node = el('circle', { cx: xOf(e.t), cy: yy.toFixed(1), r: r.toFixed(1),
        fill: isInsight ? 'var(--myc-cyan)' : st.c, opacity: isInsight ? 0.95 : st.o });
      if (isInsight || e.valence === 'positive') node.setAttribute('filter', 'url(#evoGlow)');
      node.appendChild(titleNode(e));
      g.appendChild(node);
    });

    svg.appendChild(g);
  }

  function titleNode(e) {
    var t = el('title');
    t.textContent = (e.label || e.layer) + (e.valence && e.valence !== 'neutral' ? ' · ' + e.valence : '');
    return t;
  }

  /* ── view: LAYERS ───────────────────────────────────────────────────────── */
  function renderLayers(svg, W, data, lang) {
    var dom = domain(data), padL = 78, padR = 24;
    var xOf = function (t) { return padL + (tms(t) - dom.from) / dom.span * (W - padL - padR); };
    var laneH = H / LAYERS.length;
    var g = el('g', { 'class': 'myc-fade' });

    LAYERS.forEach(function (ly, li) {
      var cyL = laneH * li + laneH / 2;
      // baseline + label
      g.appendChild(el('line', { x1: padL, y1: cyL, x2: W - padR, y2: cyL, stroke: 'var(--myc-line-faint)', 'stroke-width': '1' }));
      var lab = el('text', { x: 10, y: cyL + 3, 'class': 'myc-lane-label' });
      lab.textContent = L(ly.label, lang);
      g.appendChild(lab);

      if (ly.key === 'xp_gain') {
        var xp = data.layers.xp_gain || [];
        if (xp.length) {
          var maxC = xp[xp.length - 1].cumulative || 1, d = '', f = true;
          xp.forEach(function (p) {
            var y = cyL + laneH * 0.32 - (laneH * 0.6) * (p.cumulative / maxC);
            d += (f ? 'M' : 'L') + xOf(p.t).toFixed(1) + ' ' + y.toFixed(1); f = false;
          });
          g.appendChild(el('path', { d: d, fill: 'none', stroke: 'var(--myc-green-deep)', 'stroke-width': '1.6', 'stroke-linecap': 'round', filter: 'url(#evoGlow)' }));
        }
        return;
      }
      (data.layers[ly.key] || []).forEach(function (e) {
        var st = ly.key === 'insight' ? { c: 'var(--myc-cyan)', o: 0.95 } : valStyle(e.valence);
        var r = (ly.key === 'practice') ? 2.8 : (1.8 + Math.min(2.6, Math.log(1 + (e.weight || 1))));
        var node = el('circle', { cx: xOf(e.t), cy: cyL, r: r.toFixed(1), fill: st.c, opacity: st.o });
        if (st.c.indexOf('green') > -1 || st.c.indexOf('cyan') > -1) node.setAttribute('filter', 'url(#evoGlow)');
        node.appendChild(titleNode({ label: e.label, layer: ly.key, valence: e.valence }));
        g.appendChild(node);
      });
    });
    svg.appendChild(g);
  }

  /* ── view: FIELD (single character) ─────────────────────────────────────── */
  function renderField(svg, W, data, ag) {
    var cy = H / 2, charX = Math.min(150, W * 0.2);
    var g = el('g', { 'class': 'myc-fade' });

    // light field to the right of the character
    var fcx = charX + (W - charX) * 0.52, minDim = Math.min(W - charX, H);
    var R = (0.22 + 0.6 * ag.spread) * minDim * 0.7;
    var fieldOpacity = (0.35 + 0.65 * ag.brightness).toFixed(2);
    g.appendChild(el('circle', { cx: fcx, cy: cy, r: R, fill: 'url(#evoField)', opacity: fieldOpacity }));
    // turbulence rings — count & jitter from density
    var rings = 2 + Math.round(3 * ag.density);
    for (var i = 1; i <= rings; i++) {
      var rr = R * (i / (rings + 1));
      var wob = ag.density * 6;
      g.appendChild(el('circle', { cx: fcx + (jit(i) - 0.5) * wob, cy: cy + (jit(i + 9) - 0.5) * wob,
        r: rr.toFixed(1), fill: 'none', stroke: 'var(--myc-line-muted)', 'stroke-width': '1',
        opacity: (0.5 - 0.06 * i).toFixed(2) }));
    }
    // crisis tint only when turbulence is high (rare, brand rule)
    if (ag.turbulence > 0.6) {
      g.appendChild(el('circle', { cx: fcx, cy: cy, r: R * 0.9, fill: 'none', stroke: 'var(--myc-wine)', 'stroke-width': '2', opacity: '0.5', filter: 'url(#evoGlowSoft)' }));
    }
    // bright insight points floating in the field
    var ins = data.layers.insight || [];
    ins.slice(-8).forEach(function (e, i) {
      var a = jit(i) * Math.PI * 2, rad = R * (0.3 + 0.6 * jit(i + 3));
      g.appendChild(el('circle', { cx: fcx + Math.cos(a) * rad, cy: cy + Math.sin(a) * rad, r: 2.6, fill: 'var(--myc-cyan)', filter: 'url(#evoGlow)' }));
    });

    // the character — simple luminous body (head + spine + shoulders)
    var ch = el('g', { opacity: '0.95' });
    var headR = 13, glow = 'url(#evoGlow)';
    ch.appendChild(el('circle', { cx: charX, cy: cy - 34, r: headR, fill: 'var(--myc-bg-2)', stroke: 'var(--myc-line-primary)', 'stroke-width': '2', filter: glow }));
    ch.appendChild(el('line', { x1: charX, y1: cy - 20, x2: charX, y2: cy + 36, stroke: 'var(--myc-line-primary)', 'stroke-width': '2', 'stroke-linecap': 'round', filter: glow }));
    ch.appendChild(el('line', { x1: charX - 20, y1: cy - 6, x2: charX + 20, y2: cy - 6, stroke: 'var(--myc-line-secondary)', 'stroke-width': '1.6', 'stroke-linecap': 'round' }));
    ch.appendChild(el('line', { x1: charX, y1: cy + 36, x2: charX - 16, y2: cy + 64, stroke: 'var(--myc-line-secondary)', 'stroke-width': '1.6', 'stroke-linecap': 'round' }));
    ch.appendChild(el('line', { x1: charX, y1: cy + 36, x2: charX + 16, y2: cy + 64, stroke: 'var(--myc-line-secondary)', 'stroke-width': '1.6', 'stroke-linecap': 'round' }));
    // heart-light whose intensity tracks brightness
    ch.appendChild(el('circle', { cx: charX, cy: cy + 2, r: (2 + 3 * ag.brightness).toFixed(1), fill: 'var(--myc-green)', filter: glow, opacity: (0.5 + 0.5 * ag.brightness).toFixed(2) }));
    g.appendChild(ch);

    // connective filaments from character into the field
    for (var k = 0; k < 5; k++) {
      var ty = cy + (jit(k + 20) - 0.5) * R, tx = fcx + (jit(k + 30) - 0.5) * R * 0.6;
      g.appendChild(el('path', { d: 'M' + (charX + 6) + ' ' + (cy) + ' Q' + ((charX + tx) / 2) + ' ' + (cy + (jit(k) - 0.5) * 60) + ' ' + tx + ' ' + ty,
        fill: 'none', stroke: 'var(--myc-cyan-deep)', 'stroke-width': '0.7', opacity: '0.22' }));
    }
    svg.appendChild(g);
  }

  /* ── chrome + orchestration ─────────────────────────────────────────────── */
  function mountEvolutionPath(container, opts) {
    if (!container) return;
    opts = opts || {};
    var lang = opts.lang || (typeof window.getLang === 'function' ? window.getLang() : 'ru');
    var apiBase = opts.apiBase || window.AUTH_API || '';
    var token = opts.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('na_token') : '');
    var st = container.__evo || { mode: opts.mode || 'tunnel', period: opts.period || 'month', cursor: 1 };
    container.__evo = st;

    container.classList.add('myc-root');
    container.style.padding = '16px 16px 14px';
    container.innerHTML = buildChrome(st, lang) +
      '<div class="myc-evo-canvas" style="position:relative;min-height:' + H + 'px;"></div>';

    wireChrome(container, st, lang, function () { mountEvolutionPath(container, opts); });

    var canvas = container.querySelector('.myc-evo-canvas');
    canvas.innerHTML = '<div class="myc-empty"><div class="myc-empty-glyph">✦</div><div class="myc-empty-text">' + L(STR.loading, lang) + '</div></div>';

    fetch(apiBase + '/api/users/me/evolution?period=' + encodeURIComponent(st.period),
      { headers: token ? { 'Authorization': 'Bearer ' + token } : {} })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || data.error) throw new Error(data && data.error || 'no data');
        st.data = data;
        paint(container, st, lang);
      })
      .catch(function (e) {
        console.warn('EvolutionPath:', e);
        canvas.innerHTML = '<div class="myc-empty"><div class="myc-empty-glyph">⊘</div><div class="myc-empty-text">' + L(STR.fail, lang) + '</div></div>';
      });
  }

  function buildChrome(st, lang) {
    function seg(items, active, attr) {
      return '<div class="myc-seg" data-seg="' + attr + '">' + items.map(function (it) {
        return '<button data-val="' + it.key + '"' + (it.key === active ? ' class="is-active"' : '') + '>' + L(it.label, lang) + '</button>';
      }).join('') + '</div>';
    }
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
            if (st.data) { // mode change needs no refetch
              segEl.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-active', x === b); });
              paint(container, st, lang); return;
            }
          } else { // period change → refetch
            if (st.period === val) return;
            st.period = val; st.cursor = 1; st.data = null;
          }
          rerender();
        });
      });
    });
  }

  function paint(container, st, lang) {
    var canvas = container.querySelector('.myc-evo-canvas');
    canvas.innerHTML = '';
    var data = st.data;
    var totalEvents = Object.keys(data.totals || {}).reduce(function (s, k) { return k === 'xp_total' ? s : s + (data.totals[k] || 0); }, 0);
    if (!totalEvents) {
      canvas.innerHTML = '<div class="myc-empty"><div class="myc-empty-glyph">✦</div><div class="myc-empty-text">' + L(STR.empty, lang) + '</div></div>';
      return;
    }
    var W = measureW(canvas, container);
    var svg = newSvg(W);
    canvas.appendChild(svg);

    if (st.mode === 'layers') {
      renderLayers(svg, W, data, lang);
    } else if (st.mode === 'field') {
      renderFieldMode(container, canvas, svg, W, data, lang, st);
    } else {
      renderTunnel(svg, W, data);
    }

    if (st.mode !== 'field') canvas.appendChild(statsRow(data.aggregates, lang));
  }

  // field mode adds a time-cursor that recomputes aggregates client-side
  function renderFieldMode(container, canvas, svg, W, data, lang, st) {
    var events = allEvents(data), dom = domain(data);
    function agAt(cur) {
      if (cur >= 1 || !events.length) return data.aggregates;
      var cutoff = dom.from + dom.span * cur;
      var sub = events.filter(function (e) { return e.t <= cutoff; });
      return sub.length ? recompute(sub) : data.aggregates;
    }
    renderField(svg, W, data, agAt(st.cursor));

    var stats = statsRow(agAt(st.cursor), lang);
    canvas.appendChild(stats);

    var scrub = document.createElement('div');
    scrub.className = 'myc-scrub';
    var pct = Math.round(st.cursor * 100);
    scrub.innerHTML = '<span>' + L(STR.moment, lang) + '</span>' +
      '<input type="range" min="0" max="100" value="' + pct + '">' +
      '<span class="myc-scrub-val">' + (st.cursor >= 1 ? L(STR.now, lang) : pct + '%') + '</span>';
    canvas.appendChild(scrub);
    var input = scrub.querySelector('input');
    input.addEventListener('input', function () {
      st.cursor = (+input.value) / 100;
      // repaint just the field + stats, keep chrome. Keep `stats` attached as
      // the insertion anchor until the replacements are in place.
      var oldSvg = canvas.querySelector('svg'); if (oldSvg) oldSvg.remove();
      var W2 = measureW(canvas, container);
      var s2 = newSvg(W2);
      canvas.insertBefore(s2, stats);
      renderField(s2, W2, data, agAt(st.cursor));
      var ns = statsRow(agAt(st.cursor), lang);
      canvas.insertBefore(ns, stats);
      stats.remove(); stats = ns;
      scrub.querySelector('.myc-scrub-val').textContent = st.cursor >= 1 ? L(STR.now, lang) : Math.round(st.cursor * 100) + '%';
    });
  }

  function statsRow(ag, lang) {
    var wrap = document.createElement('div');
    wrap.className = 'myc-stats';
    function stat(val, label) {
      return '<div class="myc-stat"><b>' + val + '</b><span>' + escapeHtml(label) + '</span></div>';
    }
    wrap.innerHTML =
      stat(Math.round(ag.brightness * 100) + '%', L(STR.brightness, lang)) +
      stat(Math.round(ag.positivity * 100) + '%', L(STR.positivity, lang)) +
      stat(Math.round(ag.turbulence * 100) + '%', L(STR.turbulence, lang)) +
      stat(ag.activity, L(STR.activity, lang));
    return wrap;
  }

  window.mountEvolutionPath = mountEvolutionPath;
})();
