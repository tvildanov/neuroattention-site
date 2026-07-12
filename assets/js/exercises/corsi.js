/* Corsi Block-Tapping — visuospatial short-term memory. Corsi 1972.
 * Blocks light up in a sequence; reproduce the order by clicking. The span
 * grows after each correct reproduction; two misses at a span ends the test. */
(function () {
  var R = window.NAExercises;
  // classic irregular 9-block layout (normalized 0..1)
  var LAYOUT = [
    [0.18, 0.22], [0.55, 0.14], [0.82, 0.30], [0.30, 0.44], [0.68, 0.48],
    [0.12, 0.66], [0.46, 0.70], [0.80, 0.72], [0.34, 0.88]
  ];
  var CTRL = {
    ru: 'Запомните порядок вспышек, затем повторите его, кликая по кубам.',
    en: 'Memorise the flash order, then reproduce it by clicking the blocks.',
    es: 'Memoriza el orden de los destellos y reprodúcelo haciendo clic.'
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

      var blocks = LAYOUT.map(function (p) { return { x: p[0] * w, y: 40 + p[1] * (h - 60), r: Math.min(w, h) * 0.07 }; });
      var alive = true, phase = 'idle', seq = [], input = [], lit = -1, timers = [], t0 = 0;
      var fails = 0, maxSpan = 0, seqDone = 0, total = 0, correctSeq = 0;

      function drawBoard(hi) {
        R.clear(ctx, w, h);
        R.hud(ctx, w, h, (lang === 'ru' ? 'Длина: ' : 'Span: ') + span, 'Corsi');
        blocks.forEach(function (b, i) {
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fillStyle = (i === hi) ? '#58a6ff' : '#21262d';
          ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#30363d'; ctx.stroke();
        });
        if (phase === 'recall') R.text(ctx, lang === 'ru' ? 'Повторите порядок' : 'Reproduce the order', w / 2, h - 18, { size: 15, color: '#9aa4b2', weight: '400' });
      }
      function playSeq() {
        phase = 'show'; input = []; seq = [];
        var pool = R.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, span);
        // random order of the chosen blocks
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
        for (var i = 0; i < blocks.length; i++) {
          var b = blocks[i], dx = mx - b.x, dy = my - b.y;
          if (dx * dx + dy * dy <= b.r * b.r) { registerTap(i); break; }
        }
      }
      function registerTap(i) {
        input.push(i);
        // flash the tapped block
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
      function cleanup() { timers.forEach(clearTimeout); timers = []; cv.removeEventListener('pointerdown', click); }
      cv.addEventListener('pointerdown', click);

      R.splash(ctx, w, h, 'Corsi', [R.L(CTRL, lang)], lang === 'ru' ? 'Начинаем…' : 'Starting…');
      timers.push(setTimeout(function () { R.countdown(ctx, w, h, 3, function () { t0 = performance.now(); playSeq(); }); }, 1700));
      return function () { alive = false; cleanup(); };
    }
  });
})();
