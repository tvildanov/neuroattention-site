/* N-back — working-memory updating. Kirchner 1958; Jaeggi 2008.
 * Letters stream one at a time; respond when the current letter matches
 * the one N steps back. Level raises N and speeds the stream. */
(function () {
  var R = window.NAExercises;
  var LETTERS = ['C', 'H', 'K', 'L', 'Q', 'R', 'S', 'T', 'B', 'F', 'M', 'N', 'P', 'W', 'X', 'Z'];
  var CTRL = {
    ru: 'Нажмите ПРОБЕЛ (или кнопку «Совпадение»), когда буква совпадает с той, что была N шагов назад.',
    en: 'Press SPACE (or the "Match" button) when the letter matches the one N steps back.',
    es: 'Pulsa ESPACIO (o el botón «Coincide») cuando la letra coincida con la de N pasos atrás.'
  };

  R.register('n-back', {
    controls: CTRL,
    mount: function (host, opts, onComplete) {
      var lang = opts.lang, n = R.clamp(1 + Math.floor((opts.level - 1) / 2), 1, 4);
      var trials = 14 + opts.level * 2;
      var isi = Math.round(2600 - opts.level * 120); // ms per stimulus
      var show = Math.round(isi * 0.65);

      host.innerHTML = '';
      var cv = document.createElement('canvas');
      cv.style.cssText = 'width:100%;height:340px;display:block;border-radius:12px;background:#0d1117';
      host.appendChild(cv);
      var bar = document.createElement('div');
      bar.style.cssText = 'text-align:center;margin-top:12px';
      var btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = lang === 'ru' ? 'Совпадение (ПРОБЕЛ)' : lang === 'es' ? 'Coincide (ESPACIO)' : 'Match (SPACE)';
      btn.style.cssText = 'min-width:220px;font-size:1.05rem;padding:.7rem 1.4rem';
      bar.appendChild(btn); host.appendChild(bar);

      var f = R.fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;
      var seq = [], responded = false, idx = -1, alive = true;
      var timers = [], t0 = 0, stimAt = 0;
      var hits = 0, miss = 0, fa = 0, cr = 0, rts = [];

      // build sequence with ~30% targets
      for (var i = 0; i < trials; i++) {
        if (i >= n && R.coin(0.3)) seq.push(seq[i - n]);
        else {
          var c; do { c = R.pick(LETTERS); } while (i >= n && c === seq[i - n]);
          seq.push(c);
        }
      }
      function isTarget(i) { return i >= n && seq[i] === seq[i - n]; }

      function draw(letter, sub) {
        R.clear(ctx, w, h);
        R.hud(ctx, w, h, (lang === 'ru' ? 'Проба ' : 'Trial ') + (idx + 1) + '/' + trials, n + '-back');
        if (letter) R.text(ctx, letter, w / 2, h / 2, { size: 120, weight: '700', color: '#e6edf3' });
        if (sub) R.text(ctx, sub, w / 2, h - 34, { size: 15, color: '#9aa4b2', weight: '400' });
      }

      function respond() {
        if (!alive || idx < 0 || responded) return;
        responded = true;
        var t = isTarget(idx);
        if (t) { hits++; rts.push(performance.now() - stimAt); flash('#2ea043'); }
        else { fa++; flash('#f85149'); }
      }
      function flash(col) {
        cv.style.boxShadow = '0 0 0 3px ' + col; setTimeout(function () { cv.style.boxShadow = ''; }, 180);
      }

      function next() {
        if (!alive) return;
        // score previous trial's non-response
        if (idx >= 0 && !responded) { if (isTarget(idx)) miss++; else cr++; }
        idx++;
        if (idx >= trials) { finish(); return; }
        responded = false; stimAt = performance.now();
        draw(seq[idx], '');
        timers.push(setTimeout(function () { if (alive) draw('', lang === 'ru' ? '…' : '…'); }, show));
        timers.push(setTimeout(next, isi));
      }

      function finish() {
        alive = false; cleanup();
        var total = hits + miss + fa + cr;
        var acc = total ? (hits + cr) / total : 0;
        var rt = R.mean(rts);
        onComplete({
          score: R.compositeScore(acc, rt, 300, 1500),
          accuracy: acc, reaction_time_avg: rt == null ? null : R.round(rt, 0),
          duration_ms: Math.round(performance.now() - t0),
          raw_data: { n: n, trials: trials, hits: hits, misses: miss, false_alarms: fa, correct_rejections: cr }
        });
      }

      function onKey(e) { if (e.code === 'Space') { e.preventDefault(); respond(); } }
      btn.addEventListener('click', respond);
      cv.addEventListener('pointerdown', respond);
      window.addEventListener('keydown', onKey);
      function cleanup() {
        timers.forEach(clearTimeout); timers = [];
        window.removeEventListener('keydown', onKey);
      }

      // instructions → countdown → run
      R.splash(ctx, w, h, n + '-back',
        [R.L(CTRL, lang)],
        lang === 'ru' ? 'Начинаем…' : 'Starting…');
      var stopCd;
      timers.push(setTimeout(function () {
        stopCd = R.countdown(ctx, w, h, 3, function () { t0 = performance.now(); next(); });
      }, 1400));

      return function () { alive = false; if (stopCd) stopCd(); cleanup(); };
    }
  });
})();
