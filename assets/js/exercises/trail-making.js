/* Trail Making Test A & B — processing speed, visual search, set-shifting.
 * Reitan (Halstead-Reitan). Connect targets in order by clicking: 1→2→3…
 * (Trail A) or 1→A→2→B→3… alternating numbers & letters (Trail B, level ≥6). */
(function () {
  var R = window.NAExercises;
  var LETTERS = { ru: ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З'], en: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], es: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] };
  var CTRL = {
    ru: 'Соединяйте кружки по порядку, кликая по ним. Ошибка — кружок мигнёт красным.',
    en: 'Connect the circles in order by clicking. A wrong click flashes red.',
    es: 'Conecta los círculos en orden haciendo clic. Un error parpadea en rojo.'
  };
  R.register('trail-making', {
    controls: CTRL,
    mount: function (host, opts, onComplete) {
      var lang = opts.lang;
      var trailB = opts.level >= 6;
      var count = R.clamp(6 + opts.level, 7, 16); // number of targets

      host.innerHTML = '';
      var cv = document.createElement('canvas');
      cv.style.cssText = 'width:100%;height:420px;display:block;border-radius:12px;background:#0d1117;cursor:pointer';
      host.appendChild(cv);
      var f = R.fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;

      // build ordered label sequence
      var labels = [], letters = LETTERS[lang] || LETTERS.en;
      if (trailB) { var n = Math.ceil(count / 2); for (var i = 0; i < n; i++) { labels.push(String(i + 1)); if (letters[i]) labels.push(letters[i]); } labels = labels.slice(0, count); }
      else { for (var j = 0; j < count; j++) labels.push(String(j + 1)); }

      // non-overlapping placement
      var rad = Math.min(w, h) * 0.055, nodes = [], tries = 0;
      while (nodes.length < labels.length && tries < 4000) {
        tries++;
        var x = rad + 20 + Math.random() * (w - 2 * rad - 40);
        var y = rad + 40 + Math.random() * (h - 2 * rad - 60);
        var okp = nodes.every(function (nd) { var dx = nd.x - x, dy = nd.y - y; return dx * dx + dy * dy > (rad * 2.6) * (rad * 2.6); });
        if (okp) nodes.push({ x: x, y: y, label: labels[nodes.length] });
      }

      var alive = true, cursor = 0, errors = 0, t0 = 0, started = false, timers = [], flashIdx = -1;
      function draw() {
        R.clear(ctx, w, h);
        R.hud(ctx, w, h, (trailB ? 'Trail B' : 'Trail A'), started ? ((lang === 'ru' ? 'Время ' : 'Time ') + ((performance.now() - t0) / 1000).toFixed(1) + 's') : '');
        // completed path
        ctx.save(); ctx.strokeStyle = '#3fb950'; ctx.lineWidth = 3; ctx.beginPath();
        for (var i = 0; i < cursor; i++) { var nd = nodes[i]; if (i === 0) ctx.moveTo(nd.x, nd.y); else ctx.lineTo(nd.x, nd.y); }
        ctx.stroke(); ctx.restore();
        nodes.forEach(function (nd, i) {
          ctx.beginPath(); ctx.arc(nd.x, nd.y, rad, 0, Math.PI * 2);
          ctx.fillStyle = i < cursor ? '#238636' : (i === flashIdx ? '#f85149' : (i === cursor ? '#1f6feb' : '#21262d'));
          ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#30363d'; ctx.stroke();
          R.text(ctx, nd.label, nd.x, nd.y, { size: rad * 0.9, weight: '700', color: '#fff' });
        });
      }
      function click(ev) {
        if (!alive) return;
        var rect = cv.getBoundingClientRect(), mx = ev.clientX - rect.left, my = ev.clientY - rect.top;
        for (var i = 0; i < nodes.length; i++) {
          var nd = nodes[i], dx = mx - nd.x, dy = my - nd.y;
          if (dx * dx + dy * dy <= rad * rad) {
            if (i === cursor) { if (!started) { started = true; t0 = performance.now(); tick(); } cursor++; if (cursor >= nodes.length) return finish(); draw(); }
            else if (i > cursor) { errors++; flashIdx = i; draw(); timers.push(setTimeout(function () { flashIdx = -1; draw(); }, 200)); }
            return;
          }
        }
      }
      var rafId = 0;
      function tick() { if (!alive || !started) return; draw(); rafId = requestAnimationFrame(tick); }
      function finish() {
        alive = false; cancelAnimationFrame(rafId); cleanup();
        var secs = (performance.now() - t0) / 1000;
        // score: faster + fewer errors → higher (100 at ~ideal, decays)
        var ideal = nodes.length * (trailB ? 1.6 : 1.1);
        var speed = R.clamp(ideal / Math.max(secs, 0.1), 0, 1.4);
        var score = R.round(R.clamp(speed * 80 - errors * 6 + (trailB ? 15 : 0), 0, 130), 1);
        onComplete({
          score: score, accuracy: nodes.length ? R.clamp(1 - errors / (nodes.length + errors), 0, 1) : 0,
          reaction_time_avg: nodes.length ? R.round(secs * 1000 / nodes.length, 0) : null,
          duration_ms: Math.round(secs * 1000),
          raw_data: { trail: trailB ? 'B' : 'A', targets: nodes.length, errors: errors, time_s: R.round(secs, 1) }
        });
      }
      function cleanup() { timers.forEach(clearTimeout); timers = []; cv.removeEventListener('pointerdown', click); }
      cv.addEventListener('pointerdown', click);

      R.splash(ctx, w, h, trailB ? 'Trail Making B' : 'Trail Making A',
        [R.L(CTRL, lang), trailB ? (lang === 'ru' ? 'Порядок: 1 → А → 2 → Б → 3 …' : '1 → A → 2 → B → 3 …') : (lang === 'ru' ? 'Порядок: 1 → 2 → 3 …' : '1 → 2 → 3 …')],
        lang === 'ru' ? 'Кликните «1», чтобы начать' : 'Click "1" to start');
      timers.push(setTimeout(draw, 2400));
      return function () { alive = false; cancelAnimationFrame(rafId); cleanup(); };
    }
  });
})();
