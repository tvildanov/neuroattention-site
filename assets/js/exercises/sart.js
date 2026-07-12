/* SART — Sustained Attention to Response Task. Robertson 1997.
 * Digits 1-9 stream. Respond (SPACE / click) to EVERY digit EXCEPT 3.
 * The habitual "keep responding" set makes withholding on the rare 3 hard. */
(function () {
  var R = window.NAExercises;
  var CTRL = {
    ru: 'Нажимайте ПРОБЕЛ на каждую цифру, КРОМЕ 3. На «3» — не реагируйте.',
    en: 'Press SPACE for every digit EXCEPT 3. Withhold on "3".',
    es: 'Pulsa ESPACIO en cada dígito EXCEPTO el 3. No reacciones ante el «3».'
  };
  R.register('sart', {
    controls: CTRL,
    mount: function (host, opts, onComplete) {
      var lang = opts.lang;
      var trials = 40 + opts.level * 6;
      var isi = Math.round(1150 - opts.level * 35);
      var show = Math.round(isi * 0.22);

      host.innerHTML = '';
      var cv = document.createElement('canvas');
      cv.style.cssText = 'width:100%;height:340px;display:block;border-radius:12px;background:#0d1117;cursor:pointer';
      host.appendChild(cv);
      var bar = document.createElement('div'); bar.style.cssText = 'text-align:center;margin-top:12px';
      var btn = document.createElement('button'); btn.className = 'btn btn-primary';
      btn.textContent = lang === 'ru' ? 'Реакция (ПРОБЕЛ)' : lang === 'es' ? 'Responder (ESPACIO)' : 'Respond (SPACE)';
      btn.style.cssText = 'min-width:220px;padding:.7rem 1.4rem;font-size:1.05rem'; bar.appendChild(btn); host.appendChild(bar);

      var f = R.fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;
      var idx = -1, alive = true, cur = 0, isTarget = false, awaiting = false, responded = false, stimAt = 0;
      var timers = [], t0 = 0, hits = 0, comm = 0, omit = 0, correctNo = 0, rts = [], seq = [];
      // font size varies (classic SART) to stress the digit MEANING not shape
      var sizes = [64, 80, 100, 120, 140];

      for (var i = 0; i < trials; i++) { seq.push(R.coin(1 / 9) ? 3 : R.pick([1, 2, 4, 5, 6, 7, 8, 9])); }

      function drawDigit() {
        R.clear(ctx, w, h);
        R.hud(ctx, w, h, (lang === 'ru' ? 'Проба ' : 'Trial ') + (idx + 1) + '/' + trials, 'SART');
        R.text(ctx, String(cur), w / 2, h / 2, { size: R.pick(sizes), weight: '800', color: '#e6edf3' });
      }
      function drawMask() { R.clear(ctx, w, h); R.hud(ctx, w, h, (lang === 'ru' ? 'Проба ' : 'Trial ') + (idx + 1) + '/' + trials, 'SART'); R.text(ctx, '✳', w / 2, h / 2, { size: 60, color: '#30363d' }); }
      function next() {
        if (!alive) return;
        idx++;
        if (idx >= trials) return finish();
        cur = seq[idx]; isTarget = cur === 3; awaiting = true; responded = false; stimAt = performance.now();
        drawDigit();
        timers.push(setTimeout(function () { if (alive) drawMask(); }, show));
        timers.push(setTimeout(function () {
          if (!alive) return;
          if (awaiting && !responded) { if (isTarget) correctNo++; else omit++; }
          awaiting = false; next();
        }, isi));
      }
      function respond() {
        if (!alive || !awaiting || responded) return;
        responded = true;
        if (isTarget) { comm++; flash('#f85149'); }
        else { hits++; rts.push(performance.now() - stimAt); }
      }
      function flash(c) { cv.style.boxShadow = '0 0 0 3px ' + c; setTimeout(function () { cv.style.boxShadow = ''; }, 130); }
      function finish() {
        alive = false; cleanup();
        var acc = trials ? (hits + correctNo) / trials : 0;
        var rt = R.mean(rts);
        onComplete({
          score: R.compositeScore(acc, rt, 220, 800),
          accuracy: acc, reaction_time_avg: rt == null ? null : R.round(rt, 0),
          duration_ms: Math.round(performance.now() - t0),
          raw_data: { trials: trials, targets: seq.filter(function (d) { return d === 3; }).length, hits: hits, commission_errors: comm, omission_errors: omit, correct_withholds: correctNo }
        });
      }
      function onKey(e) { if (e.code === 'Space') { e.preventDefault(); respond(); } }
      function cleanup() { timers.forEach(clearTimeout); timers = []; window.removeEventListener('keydown', onKey); }
      window.addEventListener('keydown', onKey); btn.addEventListener('click', respond); cv.addEventListener('pointerdown', respond);

      R.splash(ctx, w, h, 'SART', [R.L(CTRL, lang)], lang === 'ru' ? 'Начинаем…' : 'Starting…');
      timers.push(setTimeout(function () { R.countdown(ctx, w, h, 3, function () { t0 = performance.now(); next(); }); }, 1600));
      return function () { alive = false; cleanup(); };
    }
  });
})();
