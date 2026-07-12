/* Stroop Task — inhibitory control / selective attention. Stroop 1935.
 * A colour word is printed in a (usually mismatched) ink colour. Respond to
 * the INK colour, not the word. Level adds trials and a tighter deadline. */
(function () {
  var R = window.NAExercises;
  var COLORS = [
    { key: 'red', hex: '#f85149', ru: 'красный', en: 'red', es: 'rojo' },
    { key: 'green', hex: '#3fb950', ru: 'зелёный', en: 'green', es: 'verde' },
    { key: 'blue', hex: '#58a6ff', ru: 'синий', en: 'blue', es: 'azul' },
    { key: 'yellow', hex: '#e3b341', ru: 'жёлтый', en: 'yellow', es: 'amarillo' }
  ];
  var CTRL = {
    ru: 'Нажимайте кнопку ЦВЕТА, которым написано слово (не читайте само слово).',
    en: 'Click the button matching the INK colour of the word (ignore what it says).',
    es: 'Pulsa el botón del COLOR de la tinta de la palabra (ignora lo que dice).'
  };

  R.register('stroop', {
    controls: CTRL,
    mount: function (host, opts, onComplete) {
      var lang = opts.lang;
      var trials = 16 + opts.level * 2;
      var deadline = Math.round(2600 - opts.level * 150);

      host.innerHTML = '';
      var cv = document.createElement('canvas');
      cv.style.cssText = 'width:100%;height:300px;display:block;border-radius:12px;background:#0d1117';
      host.appendChild(cv);
      var pad = document.createElement('div');
      pad.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:12px';
      host.appendChild(pad);
      var btns = COLORS.map(function (c) {
        var b = document.createElement('button');
        b.textContent = c[lang] || c.en;
        b.style.cssText = 'flex:1 1 120px;max-width:170px;padding:.75rem;border:none;border-radius:10px;' +
          'font-weight:700;font-size:1.05rem;color:#fff;cursor:pointer;background:' + c.hex;
        b.disabled = true;
        b.addEventListener('click', function () { answer(c.key); });
        pad.appendChild(b); return b;
      });

      var f = R.fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;
      var idx = -1, alive = true, awaiting = false, stimAt = 0, dTimer = 0, timers = [];
      var t0 = 0, correct = 0, rtC = [], rtI = [], nInc = 0, errors = 0, order = [];

      for (var i = 0; i < trials; i++) {
        var word = R.pick(COLORS);
        var incong = R.coin(0.6);
        var ink = incong ? R.pick(COLORS.filter(function (c) { return c.key !== word.key; })) : word;
        if (incong) nInc++;
        order.push({ word: word, ink: ink, incong: incong });
      }

      function paint() {
        var o = order[idx];
        R.clear(ctx, w, h);
        R.hud(ctx, w, h, (lang === 'ru' ? 'Проба ' : 'Trial ') + (idx + 1) + '/' + trials, 'Stroop');
        R.text(ctx, (o.word[lang] || o.word.en).toUpperCase(), w / 2, h / 2, { size: 72, weight: '800', color: o.ink.hex });
      }
      function answer(key) {
        if (!alive || !awaiting) return;
        awaiting = false; clearTimeout(dTimer);
        var o = order[idx], rt = performance.now() - stimAt;
        if (key === o.ink.key) { correct++; (o.incong ? rtI : rtC).push(rt); flash('#2ea043'); }
        else { errors++; flash('#f85149'); }
        timers.push(setTimeout(next, 380));
      }
      function timeout() {
        if (!alive || !awaiting) return;
        awaiting = false; errors++; flash('#8b949e'); timers.push(setTimeout(next, 300));
      }
      function flash(col) { cv.style.boxShadow = '0 0 0 3px ' + col; setTimeout(function () { cv.style.boxShadow = ''; }, 160); }
      function next() {
        if (!alive) return;
        idx++;
        if (idx >= trials) return finish();
        paint(); awaiting = true; stimAt = performance.now();
        dTimer = setTimeout(timeout, deadline); timers.push(dTimer);
      }
      function finish() {
        alive = false; cleanup();
        var total = trials, acc = correct / total;
        var rtAll = rtC.concat(rtI), rt = R.mean(rtAll);
        var effect = (R.mean(rtI) != null && R.mean(rtC) != null) ? R.round(R.mean(rtI) - R.mean(rtC), 0) : null;
        onComplete({
          score: R.compositeScore(acc, rt, 400, 1800),
          accuracy: acc, reaction_time_avg: rt == null ? null : R.round(rt, 0),
          duration_ms: Math.round(performance.now() - t0),
          raw_data: { trials: trials, correct: correct, errors: errors, incongruent: nInc, stroop_effect_ms: effect }
        });
      }
      function cleanup() { timers.forEach(clearTimeout); timers = []; btns.forEach(function (b) { b.disabled = true; }); }

      R.splash(ctx, w, h, 'Stroop', [R.L(CTRL, lang)], lang === 'ru' ? 'Начинаем…' : 'Starting…');
      timers.push(setTimeout(function () {
        R.countdown(ctx, w, h, 3, function () { t0 = performance.now(); btns.forEach(function (b) { b.disabled = false; }); next(); });
      }, 1600));

      return function () { alive = false; cleanup(); };
    }
  });
})();
