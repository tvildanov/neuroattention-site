/* ============================================================================
   CoursePathView — Stage 1 of the Mycelium light-map layer.

   Renders a course not as a list of blocks but as a left→right light path:
   a white central "spine" through the course, modules as large nodes, lessons
   and practices as small nodes, completed elements glowing brighter, the
   current element in focus, locked/secret branches as thin dimmed side
   filaments, and a faint XP light-layer growing along the line.

   Pure vanilla JS + SVG. No dependencies. Mounts into an existing DOM node.

   Public API:
     window.mountCoursePathView(container, source, opts)
       container : DOM element to render into
       source    : course slug (string → fetched) OR { course, blocks, progress }
       opts      : {
                     lang,        // 'ru' | 'en' | 'es'  (default 'ru')
                     currentIdx,  // index into blocks of the active block
                     onNavigate,  // (blockIndex, block) => void  (node click)
                     apiBase,     // API base url (default window.AUTH_API)
                     token        // bearer token (default localStorage.na_token)
                   }
   Degrades gracefully when parent_block_id / unlock_condition are absent.
   ============================================================================ */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  var H = 320;                 // logical svg height
  var SPINE_AMP = 16;          // vertical undulation amplitude
  var STEP_GAP = 120;          // x-gap between step nodes
  var MODULE_GAP = 170;        // x-gap around module nodes
  var PAD_X = 90;              // left/right padding
  var SPINE_K = 0.011;         // undulation frequency

  function el(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function spineY(x, cy) { return cy + SPINE_AMP * Math.sin(x * SPINE_K); }
  /* shape-aware node body: circle | square (practice) | diamond (tool_task) — C п.15 */
  function shapeNode(shape, cx, cy, r, attrs) {
    var n;
    if (shape === 'square') {
      var s = r * 0.92;
      n = el('rect', { x: cx - s, y: cy - s, width: s * 2, height: s * 2, rx: 1.6, ry: 1.6 });
    } else if (shape === 'diamond') {
      var d = r * 1.18;
      n = el('path', { d: 'M' + cx + ' ' + (cy - d) + ' L' + (cx + d) + ' ' + cy +
        ' L' + cx + ' ' + (cy + d) + ' L' + (cx - d) + ' ' + cy + ' Z' });
    } else {
      n = el('circle', { cx: cx, cy: cy, r: r });
    }
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function pick(o, base, lang) {
    return (o && (o[base + '_' + lang] || o[base + '_ru'] || o[base + '_en'] || o[base + '_es'])) || '';
  }

  var TYPE_LABEL = {
    section: 'Модуль', module: 'Модуль',
    practice: 'Практика', audio: 'Практика',
    text: 'Текст', video: 'Видео', image: 'Изображение',
    link: 'Ссылка', sensation_prompt: 'Запрос ощущений',
    question_branch: 'Ветвление', sound_cue: 'Сигнал', break: 'Пауза',
    student_audio: 'Голос', student_text: 'Ответ', tool_task: 'Задание из инструмента'
  };
  var STATUS_LABEL = { done: 'Пройдено', current: 'Текущий шаг', open: 'Доступно', locked: 'Закрыто' };
  var HERE_LABEL = { ru: 'Вы здесь', en: 'You are here', es: 'Aquí estás' };

  /* — classify a raw block into our node model — */
  function classify(blocks, progress, currentIdx) {
    var nodes = [];
    var firstOpen = -1;
    blocks.forEach(function (b, i) {
      if (firstOpen < 0 && !progress[b.id]) firstOpen = i;
    });
    var curIdx = (typeof currentIdx === 'number' && currentIdx >= 0) ? currentIdx : firstOpen;

    blocks.forEach(function (b, i) {
      var isModule = b.block_type === 'section' || b.block_type === 'module';
      var done = !!progress[b.id];
      // locked / secret: explicit unlock_condition still pending, or payload.secret
      var hasLock = !!(b.unlock_condition && Object.keys(b.unlock_condition).length);
      var secret = !!(b.payload && (b.payload.secret || b.payload.hidden));
      var locked = (hasLock || secret) && !done;
      var status = done ? 'done' : (i === curIdx ? 'current' : (locked ? 'locked' : 'open'));
      // shape: practice/audio → square, tool_task → diamond, else circle (C, п.15)
      var bt = b.block_type;
      var shape = (bt === 'practice' || bt === 'audio') ? 'square'
                : (bt === 'tool_task') ? 'diamond'
                : 'circle';
      nodes.push({
        i: i, block: b, isModule: isModule, secret: locked,
        status: status, shape: shape,
        points: parseInt(b.points, 10) || 0,
        title: pick(b, 'title', _LANG) || (TYPE_LABEL[b.block_type] || b.block_type)
      });
    });
    return { nodes: nodes, curIdx: curIdx };
  }

  var _LANG = 'ru';

  function render(container, data, opts) {
    _LANG = opts.lang || 'ru';
    var course = data.course || {};
    // Use the caller-provided reading order verbatim. The player already
    // linearizes (section → children) via cpLinearizeBlocks, so node index i
    // matches coursePlayer.blocks[i]. Only when raw/un-linearized blocks come in
    // (fetch-by-slug path) do we linearize here so node↔block indices stay aligned.
    var raw = (data.blocks || []).slice();
    var hasParents = raw.some(function (b) { return b.parent_block_id != null; });
    var blocks = (hasParents && typeof window.cpLinearizeBlocks === 'function')
      ? window.cpLinearizeBlocks(raw)
      : raw;
    var progress = {};
    (data.progress || []).forEach(function (p) { progress[p.block_id] = p; });

    container.innerHTML = '';
    container.classList.add('myc-root');

    if (!blocks.length) {
      container.innerHTML =
        '<div class="myc-empty"><div class="myc-empty-glyph">✦</div>' +
        '<div class="myc-empty-text">Путь курса появится здесь, когда в курсе будут шаги. ' +
        'Пока структура пуста.</div></div>';
      return;
    }

    var model = classify(blocks, progress, opts.currentIdx);
    var nodes = model.nodes;
    // Selected node = the one the user clicked / is viewing in the player (distinct
    // from "current" progress position, which carries the "Вы здесь" badge). C п.11.
    var selIdx = (typeof opts.selectedIdx === 'number') ? opts.selectedIdx : -1;

    /* — layout: assign x along the spine — */
    var x = PAD_X;
    nodes.forEach(function (n, idx) {
      if (idx > 0) x += nodes[idx - 1].isModule || n.isModule ? MODULE_GAP : STEP_GAP;
      n.x = x;
    });
    var contentW = x + PAD_X;
    var cy = H / 2;
    nodes.forEach(function (n) { n.y = spineY(n.x, cy); });

    /* — viewport + svg — */
    /* B1: a vertically-resizable shell wraps the scroll viewport. The SVG is
       rescaled to fill whatever height the user drags to (content scales, circles
       stay round); double-clicking the corner handle toggles a fullscreen mode. */
    var shell = document.createElement('div');
    shell.className = 'myc-resize-shell';
    shell.style.height = (opts.height || H) + 'px';
    container.appendChild(shell);

    var viewport = document.createElement('div');
    viewport.className = 'myc-viewport';
    viewport.style.height = '100%';
    viewport.style.overflowY = 'auto';
    shell.appendChild(viewport);

    var zoom = 1, fitScale = 1;
    var svg = el('svg', { 'class': 'myc-svg', viewBox: '0 0 ' + contentW + ' ' + H,
      width: contentW, height: H, preserveAspectRatio: 'xMinYMid meet' });
    viewport.appendChild(svg);

    function applySize() {
      var shellH = shell.clientHeight || H;
      fitScale = shellH / H;
      svg.setAttribute('width', Math.max(1, Math.round(contentW * fitScale * zoom)));
      svg.setAttribute('height', Math.max(1, Math.round(H * fitScale * zoom)));
    }
    if (typeof ResizeObserver === 'function') {
      try { new ResizeObserver(applySize).observe(shell); } catch (e) {}
    }

    /* corner handle: visual affordance + dbl-click fullscreen */
    var handle = document.createElement('div');
    handle.className = 'myc-resize-handle';
    handle.title = 'Потяните, чтобы изменить размер · двойной клик — на весь экран';
    handle.innerHTML = '<svg viewBox="0 0 12 12"><path d="M11 1 L1 11 M11 5 L5 11 M11 9 L9 11" ' +
      'stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>';
    handle.addEventListener('dblclick', function (e) {
      e.preventDefault();
      shell.classList.toggle('is-fullscreen');
      requestAnimationFrame(applySize);
    });
    shell.appendChild(handle);

    /* — defs: glow filters + gradients — */
    var defs = el('defs');
    defs.innerHTML =
      '<filter id="mycGlow" x="-80%" y="-80%" width="260%" height="260%">' +
      '<feGaussianBlur stdDeviation="3.2" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="mycGlowSoft" x="-150%" y="-150%" width="400%" height="400%">' +
      '<feGaussianBlur stdDeviation="7"/></filter>' +
      '<linearGradient id="mycXp" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="#56F2A6" stop-opacity="0.0"/>' +
      '<stop offset="12%" stop-color="#56F2A6" stop-opacity="0.85"/>' +
      '<stop offset="100%" stop-color="#8DFFC8" stop-opacity="0.9"/></linearGradient>';
    svg.appendChild(defs);

    var root = el('g', { 'class': 'myc-fade' });
    svg.appendChild(root);

    /* — background depth grid — */
    var grid = el('g', { opacity: '0.6' });
    for (var gx = PAD_X; gx < contentW - 20; gx += 64) {
      grid.appendChild(el('line', { x1: gx, y1: 24, x2: gx, y2: H - 24,
        stroke: 'var(--myc-line-faint)', 'stroke-width': '1' }));
    }
    for (var gy = 40; gy < H; gy += 56) {
      grid.appendChild(el('line', { x1: 20, y1: gy, x2: contentW - 20, y2: gy,
        stroke: 'var(--myc-line-faint)', 'stroke-width': '1' }));
    }
    root.appendChild(grid);

    /* — spine path string (smooth undulation) — */
    function spinePath(x0, x1) {
      var d = '', first = true;
      for (var px = x0; px <= x1; px += 8) {
        d += (first ? 'M' : 'L') + px.toFixed(1) + ' ' + spineY(px, cy).toFixed(1);
        first = false;
      }
      d += 'L' + x1.toFixed(1) + ' ' + spineY(x1, cy).toFixed(1);
      return d;
    }
    var startX = nodes[0].x, endX = nodes[nodes.length - 1].x;

    /* base spine (muted, full length) */
    root.appendChild(el('path', { d: spinePath(startX, endX), fill: 'none',
      stroke: 'var(--myc-line-secondary)', 'stroke-width': '1.4', 'stroke-linecap': 'round' }));

    /* — XP light layer: bright filament along the completed portion — */
    var lastDone = -1;
    nodes.forEach(function (n, i) { if (n.status === 'done') lastDone = i; });
    var totalPts = nodes.reduce(function (s, n) { return s + n.points; }, 0) || 1;
    var donePts = nodes.reduce(function (s, n) { return s + (n.status === 'done' ? n.points : 0); }, 0);
    if (lastDone >= 0) {
      var xpEnd = nodes[lastDone].x;
      var xpW = 1.6 + 3.2 * (donePts / totalPts);
      var xpY = function (px) { return spineY(px, cy) - 9; };
      var d = '', f = true;
      for (var px = startX; px <= xpEnd; px += 8) { d += (f ? 'M' : 'L') + px.toFixed(1) + ' ' + xpY(px).toFixed(1); f = false; }
      var xpGlow = el('path', { d: d, fill: 'none', stroke: 'var(--myc-green-deep)',
        'stroke-width': (xpW + 5), 'stroke-linecap': 'round', opacity: '0.18', filter: 'url(#mycGlowSoft)' });
      var xpLine = el('path', { d: d, fill: 'none', stroke: 'url(#mycXp)',
        'stroke-width': xpW, 'stroke-linecap': 'round' });
      root.appendChild(xpGlow); root.appendChild(xpLine);
    }

    /* bright spine over completed portion (white light tract) */
    if (lastDone >= 0) {
      root.appendChild(el('path', { d: spinePath(startX, nodes[lastDone].x), fill: 'none',
        stroke: 'var(--myc-line-primary)', 'stroke-width': '2', 'stroke-linecap': 'round',
        filter: 'url(#mycGlow)' }));
    }

    /* — faint mycelium filaments off completed nodes (field hint) — */
    var fil = el('g', { opacity: '0.5' });
    nodes.forEach(function (n, i) {
      if (n.status !== 'done') return;
      var dir = (i % 2 === 0) ? -1 : 1;
      var fx = n.x + 18, fy = n.y + dir * 10;
      var c = 'M' + n.x + ' ' + n.y +
        ' Q' + (fx) + ' ' + (fy) + ' ' + (n.x + 40) + ' ' + (n.y + dir * 34);
      fil.appendChild(el('path', { d: c, fill: 'none',
        stroke: (i % 3 === 0 ? 'var(--myc-cyan-deep)' : 'var(--myc-green-deep)'),
        'stroke-width': '0.8', opacity: '0.35' }));
    });
    root.appendChild(fil);

    /* — secret / locked side branches — */
    nodes.forEach(function (n, i) {
      if (!n.secret) return;
      var dir = (i % 2 === 0) ? -1 : 1;
      var bx = n.x - 26, by = n.y + dir * 64;
      root.appendChild(el('path', {
        d: 'M' + n.x + ' ' + n.y + ' Q' + (n.x - 30) + ' ' + (n.y + dir * 32) + ' ' + bx + ' ' + by,
        fill: 'none', stroke: 'var(--myc-line-muted)', 'stroke-width': '1',
        'stroke-dasharray': '2 5' }));
    });

    /* — nodes — */
    var nodeLayer = el('g');
    root.appendChild(nodeLayer);

    nodes.forEach(function (n) {
      var g = el('g', { 'class': 'myc-node' });
      var cx = n.secret ? (n.x - 26) : n.x;
      var ny = n.secret ? (n.y + ((n.i % 2 === 0) ? -1 : 1) * 64) : n.y;
      var r = n.isModule ? 11 : 6.5;
      if (n.secret) r = 5;

      var stroke, fill, coreOpacity = 1, glow = null;
      if (n.status === 'done') {
        stroke = 'var(--myc-green)'; fill = 'var(--myc-bg-2)'; glow = 'url(#mycGlow)';
      } else if (n.status === 'current') {
        stroke = 'var(--myc-cyan)'; fill = 'var(--myc-bg-2)'; glow = 'url(#mycGlow)';
      } else if (n.status === 'locked') {
        stroke = 'var(--myc-line-muted)'; fill = 'var(--myc-bg-1)'; coreOpacity = 0.55;
      } else {
        stroke = 'var(--myc-line-secondary)'; fill = 'var(--myc-bg-2)'; coreOpacity = 0.85;
      }

      /* module rib: short vertical mark (spine-of-body metaphor) */
      if (n.isModule && !n.secret) {
        g.appendChild(el('line', { x1: cx, y1: ny - 22, x2: cx, y2: ny + 22,
          stroke: stroke, 'stroke-width': '1', opacity: '0.4' }));
      }

      /* current-step pulsing halo */
      if (n.status === 'current') {
        var halo = el('circle', { cx: cx, cy: ny, r: r + 8, fill: 'none',
          stroke: 'var(--myc-cyan)', 'stroke-width': '1', opacity: '0.4', filter: 'url(#mycGlowSoft)' });
        halo.style.setProperty('--myc-pulse-r0', (r + 6) + 'px');
        halo.style.setProperty('--myc-pulse-r1', (r + 14) + 'px');
        halo.style.animation = 'myc-pulse 2.6s ease-in-out infinite';
        g.appendChild(halo);
      }

      /* selected-node highlight ring (distinct from "current" — C п.11) */
      if (n.i === selIdx && n.status !== 'locked') {
        var selR = r + 6;
        g.appendChild(shapeNode(n.shape, cx, ny, selR, {
          'class': 'myc-node-selected', fill: 'none',
          stroke: 'var(--course-accent, var(--myc-green))', 'stroke-width': '1.6',
          opacity: '0.95', 'stroke-dasharray': '3 3' }));
      }

      var core = shapeNode(n.shape, cx, ny, r, { 'class': 'myc-node-core',
        fill: fill, stroke: stroke, 'stroke-width': n.isModule ? '2' : '1.5', opacity: coreOpacity });
      if (glow) core.setAttribute('filter', glow);
      g.appendChild(core);

      /* lock glyph for secret/locked */
      if (n.secret || n.status === 'locked') {
        g.appendChild(el('circle', { cx: cx, cy: ny, r: 1.6, fill: 'var(--myc-line-secondary)' }));
      }
      /* inner dot for done */
      if (n.status === 'done') {
        g.appendChild(el('circle', { cx: cx, cy: ny, r: 2, fill: 'var(--myc-green)' }));
      }

      /* B4: invisible enlarged hit target (r=24) so hover-glow + clicks register
         within ~24px of the node centre, not just on the tiny visible core */
      g.appendChild(el('circle', { 'class': 'myc-hit', cx: cx, cy: ny, r: 24,
        fill: 'transparent', 'pointer-events': 'all' }));

      var clickable = (n.status !== 'locked') && typeof opts.onNavigate === 'function';
      if (clickable) {
        g.classList.add('is-clickable');
        g.addEventListener('click', function () { opts.onNavigate(n.i, n.block); });
      }

      /* hover card wiring */
      g.addEventListener('mouseenter', function () { showCard(n, cx, ny); });
      g.addEventListener('mouseleave', hideCard);

      nodeLayer.appendChild(g);
    });

    /* — B3: "Вы здесь" badge over the current node only — */
    var curNode = nodes[model.curIdx];
    if (curNode && curNode.status === 'current') {
      var hLabel = HERE_LABEL[_LANG] || HERE_LABEL.ru;
      var hr = curNode.isModule ? 11 : 6.5;
      // anchor on the node's *drawn* position (secret nodes sit on an offset branch)
      var anchorX = curNode.secret ? (curNode.x - 26) : curNode.x;
      var anchorY = curNode.secret ? (curNode.y + ((curNode.i % 2 === 0) ? -1 : 1) * 64) : curNode.y;
      var bw = hLabel.length * 6.2 + 16, bh = 16;
      // auto-offset so the badge never spills past the field edges
      var bx = Math.max(bw / 2 + 4, Math.min(contentW - bw / 2 - 4, anchorX));
      var bgTop = anchorY - hr - 12 - bh;
      var badge = el('g', { 'class': 'myc-here', opacity: '0' });
      badge.appendChild(el('line', { 'class': 'myc-here-pin',
        x1: anchorX, y1: anchorY - hr - 2, x2: bx, y2: bgTop + bh }));
      badge.appendChild(el('rect', { 'class': 'myc-here-bg',
        x: (bx - bw / 2).toFixed(1), y: bgTop.toFixed(1), width: bw.toFixed(1), height: bh,
        rx: 8, ry: 8 }));
      var ht = el('text', { 'class': 'myc-here-badge', x: bx.toFixed(1),
        y: (bgTop + bh / 2 + 3.2).toFixed(1), 'text-anchor': 'middle' });
      ht.textContent = hLabel;
      badge.appendChild(ht);
      badge.style.animation = 'myc-fade-in 1.2s ease 0.3s forwards';
      nodeLayer.appendChild(badge);
    }

    /* — chrome: legend + hint + hover card — */
    var legend = document.createElement('div');
    legend.className = 'myc-legend';
    legend.innerHTML =
      '<span><i style="background:var(--myc-green);box-shadow:0 0 6px var(--myc-green)"></i>пройдено</span>' +
      '<span><i style="background:var(--myc-cyan);box-shadow:0 0 6px var(--myc-cyan)"></i>текущий</span>' +
      '<span><i style="background:var(--myc-line-secondary)"></i>доступно</span>' +
      '<span><i style="background:var(--myc-line-muted)"></i>закрыто</span>';
    container.appendChild(legend);

    var hint = document.createElement('div');
    hint.className = 'myc-hint';
    hint.textContent = 'scroll · ctrl+scroll = zoom';
    container.appendChild(hint);

    var card = document.createElement('div');
    card.className = 'myc-card';
    container.appendChild(card);

    function showCard(n, cx, ny) {
      var st = n.status;
      card.innerHTML =
        '<div class="myc-card-title">' + escapeHtml(n.title) + '</div>' +
        '<div class="myc-card-meta">' + (n.isModule ? '◆ ' : '') +
          (TYPE_LABEL[n.block.block_type] || n.block.block_type) + '</div>' +
        '<div class="myc-card-row"><span class="myc-card-dot ' + st + '"></span>' +
          (STATUS_LABEL[st] || st) + '</div>' +
        (n.points ? '<div class="myc-card-row">✦ ' + n.points + ' XP</div>' : '');
      // position relative to container, accounting for zoom + scroll
      var scale = svg.clientWidth / contentW;
      var left = cx * scale - viewport.scrollLeft;
      var top = ny * scale;
      card.style.left = Math.max(8, Math.min(left + 14, container.clientWidth - 250)) + 'px';
      card.style.top = Math.max(8, top - 10) + 'px';
      card.classList.add('is-visible');
    }
    function hideCard() { card.classList.remove('is-visible'); }

    /* — interaction: wheel scroll + ctrl-zoom + drag pan — */
    viewport.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        var unit = contentW * fitScale * zoom;
        var before = (viewport.scrollLeft + e.offsetX) / unit;
        zoom = Math.max(0.6, Math.min(2.6, zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
        applySize();
        viewport.scrollLeft = before * contentW * fitScale * zoom - e.offsetX;
        hideCard();
      } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        viewport.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    var panning = false, startXp = 0, startScroll = 0;
    viewport.addEventListener('mousedown', function (e) {
      if (e.target.closest('.myc-node')) return; // let node clicks through
      panning = true; startXp = e.clientX; startScroll = viewport.scrollLeft;
      viewport.classList.add('is-panning');
    });
    window.addEventListener('mousemove', function (e) {
      if (!panning) return;
      viewport.scrollLeft = startScroll - (e.clientX - startXp);
    });
    window.addEventListener('mouseup', function () {
      panning = false; viewport.classList.remove('is-panning');
    });

    /* size the SVG to the shell, then center on the current step on first paint */
    applySize();
    var cur = nodes[model.curIdx];
    if (cur) {
      requestAnimationFrame(function () {
        viewport.scrollLeft = Math.max(0, cur.x - viewport.clientWidth / 2);
      });
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function mountCoursePathView(container, source, opts) {
    if (!container) return;
    opts = opts || {};
    var apiBase = opts.apiBase || window.AUTH_API || '';
    var lang = opts.lang || (typeof window.getLang === 'function' ? window.getLang() : 'ru');
    opts.lang = lang;

    // loading state
    container.classList.add('myc-root');
    container.innerHTML = '<div class="myc-empty"><div class="myc-empty-glyph">✦</div>' +
      '<div class="myc-empty-text">Загрузка световой карты курса…</div></div>';

    if (source && typeof source === 'object') {
      try { render(container, source, opts); }
      catch (e) { console.error('CoursePathView render:', e); fail(container); }
      return;
    }

    // fetch by slug
    var token = opts.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('na_token') : '');
    fetch(apiBase + '/api/courses/' + encodeURIComponent(source) + '?lang=' + encodeURIComponent(lang),
      { headers: token ? { 'Authorization': 'Bearer ' + token } : {} })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) throw new Error(d.error);
        render(container, d, opts);
      })
      .catch(function (e) { console.error('CoursePathView fetch:', e); fail(container); });
  }

  function fail(container) {
    container.innerHTML = '<div class="myc-empty"><div class="myc-empty-glyph">⊘</div>' +
      '<div class="myc-empty-text">Не удалось загрузить карту курса.</div></div>';
  }

  window.mountCoursePathView = mountCoursePathView;
})();
