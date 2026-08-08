/* Corsi Block-Tapping — visuospatial short-term memory. Corsi 1972.
 * Cubes light up in a sequence; reproduce the order by clicking. The span
 * grows after each correct reproduction; two misses at a span ends the test. */
(function () {
  var R = window.NAExercises;
  // classic irregular 9-block layout (normalized 0..1)
  var LAYOUT = [
    [0.18, 0.22], [0.55, 0.14], [0.82, 0.30], [0.30, 0.44], [0.68, 0.48],
    [0.12, 0.66], [0.46, 0.70], [0.80, 0.72], [0.34, 0.88]
  ];
  var CTRL = {
    ru: 'Сейчас загорятся кубики по очереди. Запомните порядок и повторите его — нажимайте на те же кубики в том же порядке. После каждой верной серии длина вырастет.',
    en: 'Cubes will light up one by one. Memorise the order, then tap the same cubes in the same order. The sequence grows after each correct run.',
    es: 'Los cubos se iluminarán uno a uno. Memoriza el orden y tócalos en el mismo orden. La secuencia crece tras cada acierto.'
  };
  R.register('corsi', {
    controls: CTRL,
    mount: function (host, opts, onComplete) {
      var lang = opts.lang;
      var span = R.clamp(2 + Math.floor((opts.level - 1) / 2), 2, 6);

      host.innerHTML = '';
      var cv = document.createElement('canvas');
      cv.style.cssText = 'width:100%;height:400px;display:block;border-radius:12px;background:#0d1117;cursor:pointer';
      host.appendChild(cv);
      var f = R.fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;

      var size = Math.min(w, h) * 0.11;
      var blocks = LAYOUT.map(function (p) {
        return { x: p[0] * w, y: 40 + p[1] * (h - 60), s: size };
      });
      var alive = true, phase = 'idle', seq = [], input = [], lit = -1, timers = [], t0 = 0, stopReady = null;
      var fails = 0, maxSpan = 0, total = 0, correctSeq = 0;

      function drawCube(b, hi) {
        var s = b.s, x = b.x, y = b.y;
        var depth = s * 0.28;
        var face = hi ? '#58a6ff' : '#2a3340';
        var top = hi ? '#79b8ff' : '#3a4454';
        var side = hi ? '#3d8fd6' : '#1c232c';
        var stroke = hi ? '#9ecbff' : '#4a5564';
        // top face (parallelogram)
        ctx.beginPath();
        ctx.moveTo(x - s / 2, y - s / 2);
        ctx.lineTo(x - s / 2 + depth, y - s / 2 - depth);
        ctx.lineTo(x + s / 2 + depth, y - s / 2 - depth);
        ctx.lineTo(x + s / 2, y - s / 2);
        ctx.closePath();
        ctx.fillStyle = top; ctx.fill();
        // right face
        ctx.beginPath();
        ctx.moveTo(x + s / 2, y - s / 2);
        ctx.lineTo(x + s / 2 + depth, y - s / 2 - depth);
        ctx.lineTo(x + s / 2 + depth, y + s / 2 - depth);
        ctx.lineTo(x + s / 2, y + s / 2);
        ctx.closePath();
        ctx.fillStyle = side; ctx.fill();
        // front face
        ctx.beginPath();
        ctx.rect(x - s / 2, y - s / 2, s, s);
        ctx.fillStyle = face; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke();
        // soft edge highlight on front
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeRect(x - s / 2 + 2, y - s / 2 + 2, s - 4, s - 4);
      }

      function drawBoard(hi) {
        R.clear(ctx, w, h);
        R.hud(ctx, w, h, (lang === 'ru' ? 'Длина: ' : 'Span: ') + span, 'Corsi');
        blocks.forEach(function (b, i) { drawCube(b, i === hi); });
        if (phase === 'recall') {
          R.text(ctx, lang === 'ru' ? 'Повторите порядок' : 'Reproduce the order', w / 2, h - 18, { size: 15, color: '#9aa4b2', weight: '400' });
        }
      }
      function hitTest(mx, my) {
        for (var i = 0; i < blocks.length; i++) {
          var b = blocks[i], s = b.s;
          // front face + a bit of the top/right extrusion
          if (mx >= b.x - s / 2 && mx <= b.x + s / 2 + s * 0.28 &&
              my >= b.y - s / 2 - s * 0.28 && my <= b.y + s / 2) return i;
        }
        return -1;
      }
      function playSeq() {
        phase = 'show'; input = []; seq = [];
        var pool = R.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, span);
        seq = R.shuffle(pool);
        drawBoard(-1);
        var step = 0;
        function flashNext() {
          if (!alive) return;
          if (step >= seq.length) { phase = 'recall'; drawBoard(-1); return; }
          lit = seq[step]; drawBoard(lit);
          timers.push(setTimeout(function () { lit = -1; drawBoard(-1); timers.push(setTimeout(flashNext, 220)); }, 620));
          step++;
        }
        timers.push(setTimeout(flashNext, 500));
      }
      function click(ev) {
        if (!alive || phase !== 'recall') return;
        var rect = cv.getBoundingClientRect();
        var mx = (ev.clientX - rect.left), my = (ev.clientY - rect.top);
        var i = hitTest(mx, my);
        if (i >= 0) registerTap(i);
      }
      function registerTap(i) {
        input.push(i);
        var prev = phase; drawBoard(i); timers.push(setTimeout(function () { if (phase === prev) drawBoard(-1); }, 140));
        if (input[input.length - 1] !== seq[input.length - 1]) return resolve(false);
        if (input.length === seq.length) return resolve(true);
      }
      function resolve(ok) {
        phase = 'idle'; total++;
        if (ok) {
          correctSeq++; maxSpan = Math.max(maxSpan, span); fails = 0; span++;
          flash('#2ea043');
          if (span > 9) return finish();
        } else {
          fails++; flash('#f85149');
          if (fails >= 2) return finish();
        }
        timers.push(setTimeout(playSeq, 700));
      }
      function flash(c) { cv.style.boxShadow = '0 0 0 3px ' + c; setTimeout(function () { cv.style.boxShadow = ''; }, 200); }
      function finish() {
        alive = false; cleanup();
        var acc = total ? correctSeq / total : 0;
        onComplete({
          score: R.round(maxSpan * 12 + acc * 20, 1),
          accuracy: acc, reaction_time_avg: null,
          duration_ms: Math.round(performance.now() - t0),
          raw_data: { max_span: maxSpan, sequences: total, correct: correctSeq }
        });
      }
      function cleanup() {
        timers.forEach(clearTimeout); timers = [];
        if (stopReady) { try { stopReady(); } catch (e) {} stopReady = null; }
        cv.removeEventListener('pointerdown', click);
      }
      cv.addEventListener('pointerdown', click);

      stopReady = R.awaitReady(host, ctx, w, h, lang === 'ru' ? 'Кубики Корси' : 'Corsi',
        [R.L(CTRL, lang)], lang, function () { t0 = performance.now(); playSeq(); });
      return function () { alive = false; cleanup(); };
    }
  });
})();
