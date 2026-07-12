/* Go/No-Go — response inhibition. Donders; Cook & Rausch.
 * Click on the GREEN circle (Go), withhold on the RED circle (No-Go).
 * Level speeds the stream and tightens the response deadline. */
(function () {
  var R = window.NAExercises;
  var CTRL = {
    ru: 'Кликните по ЗЕЛЁНОМУ кругу. На КРАСНЫЙ — не реагируйте.',
    en: 'Click the GREEN circle. Do NOT click the RED one.',
    es: 'Haz clic en el círculo VERDE. NO hagas clic en el ROJO.'
  };
  R.register('go-no-go', {
    controls: CTRL,
    mount: function (host, opts, onComplete) {
      var lang = opts.lang;
      var trials = 22 + opts.level * 3;
      var isi = Math.round(1700 - opts.level * 80);
      var show = Math.round(isi * 0.62);

      host.innerHTML = '';
      var cv = document.createElement('canvas');
      cv.style.cssText = 'width:100%;height:360px;display:block;border-radius:12px;background:#0d1117;cursor:pointer';
      host.appendChild(cv);
      var f = R.fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;

      var idx = -1, alive = true, isGo = false, visible = false, responded = false, stimAt = 0;
      var timers = [], t0 = 0, hits = 0, comm = 0, omit = 0, correctNo = 0, rts = [];

      function drawBlank(msg) { R.clear(ctx, w, h); R.hud(ctx, w, h, (lang === 'ru' ? 'Проба ' : 'Trial ') + Math.max(idx + 1, 1) + '/' + trials, 'Go / No-Go'); if (msg) R.text(ctx, msg, w / 2, h / 2, { size: 40, color: '#30363d' }); }
      function drawStim() {
        drawBlank();
        ctx.save();
        ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = isGo ? '#3fb950' : '#f85149'; ctx.fill();
        ctx.restore();
      }
      function next() {
        if (!alive) return;
        idx++;
        if (idx >= trials) return finish();
        isGo = R.coin(0.7); visible = false; responded = false; drawBlank('+');
        timers.push(setTimeout(function () {
          if (!alive) return; visible = true; stimAt = performance.now(); drawStim();
          timers.push(setTimeout(function () {
            if (!alive) return;
            if (visible && !responded) { if (isGo) { omit++; } else { correctNo++; } }
            visible = false; next();
          }, show));
        }, Math.round(isi - show)));
      }
      function click() {
        if (!alive || !visible || responded) return;
        responded = true;
        if (isGo) { hits++; rts.push(performance.now() - stimAt); flash('#2ea043'); }
        else { comm++; flash('#f85149'); }
      }
      function flash(c) { cv.style.boxShadow = '0 0 0 3px ' + c; setTimeout(function () { cv.style.boxShadow = ''; }, 130); }
      function finish() {
        alive = false; cleanup();
        var nGo = hits + omit, nNo = comm + correctNo;
        var acc = trials ? (hits + correctNo) / trials : 0;
        var rt = R.mean(rts);
        onComplete({
          score: R.compositeScore(acc, rt, 250, 900),
          accuracy: acc, reaction_time_avg: rt == null ? null : R.round(rt, 0),
          duration_ms: Math.round(performance.now() - t0),
          raw_data: { trials: trials, go: nGo, nogo: nNo, hits: hits, commission_errors: comm, omission_errors: omit, correct_rejections: correctNo }
        });
      }
      function cleanup() { timers.forEach(clearTimeout); timers = []; cv.removeEventListener('pointerdown', click); }
      cv.addEventListener('pointerdown', click);

      R.splash(ctx, w, h, 'Go / No-Go', [R.L(CTRL, lang)], lang === 'ru' ? 'Начинаем…' : 'Starting…');
      timers.push(setTimeout(function () { R.countdown(ctx, w, h, 3, function () { t0 = performance.now(); next(); }); }, 1500));
      return function () { alive = false; cleanup(); };
    }
  });
})();
