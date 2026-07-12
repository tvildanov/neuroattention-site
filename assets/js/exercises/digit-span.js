/* Digit Span — verbal short-term / working memory. Wechsler.
 * Digits are shown one at a time; then type them back. Forward at low levels,
 * REVERSE order at level ≥6. Span grows on success; two misses ends it. */
(function () {
  var R = window.NAExercises;
  var CTRL = {
    ru: 'Запомните цифры, затем введите их. С уровня 6 — в ОБРАТНОМ порядке.',
    en: 'Memorise the digits, then type them. From level 6 — in REVERSE order.',
    es: 'Memoriza los dígitos y escríbelos. Desde el nivel 6 — en orden INVERSO.'
  };
  R.register('digit-span', {
    controls: CTRL,
    mount: function (host, opts, onComplete) {
      var lang = opts.lang;
      var reverse = opts.level >= 6;
      var span = R.clamp(3 + Math.floor((opts.level - 1) / 3), 3, 6);

      host.innerHTML = '';
      var cv = document.createElement('canvas');
      cv.style.cssText = 'width:100%;height:300px;display:block;border-radius:12px;background:#0d1117';
      host.appendChild(cv);
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:10px;justify-content:center;margin-top:12px;visibility:hidden';
      var inp = document.createElement('input');
      inp.type = 'text'; inp.inputMode = 'numeric'; inp.autocomplete = 'off';
      inp.style.cssText = 'flex:1;max-width:280px;padding:.7rem 1rem;font-size:1.4rem;letter-spacing:.3em;text-align:center;border-radius:10px;border:1px solid #30363d;background:#161b22;color:#e6edf3';
      var ok = document.createElement('button'); ok.className = 'btn btn-primary'; ok.textContent = 'OK';
      ok.style.cssText = 'padding:.7rem 1.4rem';
      wrap.appendChild(inp); wrap.appendChild(ok); host.appendChild(wrap);

      var f = R.fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;
      var alive = true, phase = 'idle', seq = [], timers = [], t0 = 0;
      var fails = 0, maxSpan = 0, total = 0, correct = 0;

      function showPrompt() {
        R.clear(ctx, w, h);
        R.hud(ctx, w, h, (lang === 'ru' ? 'Длина: ' : 'Span: ') + span, reverse ? (lang === 'ru' ? 'Обратный' : 'Reverse') : (lang === 'ru' ? 'Прямой' : 'Forward'));
        R.text(ctx, lang === 'ru' ? (reverse ? 'Введите в обратном порядке' : 'Введите цифры') : (reverse ? 'Type in reverse' : 'Type the digits'), w / 2, h / 2, { size: 22, color: '#c9d1d9' });
      }
      function playSeq() {
        phase = 'show'; seq = []; wrap.style.visibility = 'hidden';
        for (var i = 0; i < span; i++) seq.push(R.randInt(0, 9));
        var step = 0;
        function showNext() {
          if (!alive) return;
          if (step >= seq.length) { askInput(); return; }
          R.clear(ctx, w, h);
          R.hud(ctx, w, h, (lang === 'ru' ? 'Длина: ' : 'Span: ') + span, 'Digit Span');
          R.text(ctx, String(seq[step]), w / 2, h / 2, { size: 120, weight: '800' });
          step++;
          timers.push(setTimeout(function () {
            R.clear(ctx, w, h); R.hud(ctx, w, h, (lang === 'ru' ? 'Длина: ' : 'Span: ') + span, 'Digit Span');
            timers.push(setTimeout(showNext, 280));
          }, 800));
        }
        timers.push(setTimeout(showNext, 500));
      }
      function askInput() {
        phase = 'input'; showPrompt(); inp.value = '';
        wrap.style.visibility = 'visible'; inp.focus();
      }
      function submit() {
        if (!alive || phase !== 'input') return;
        var digits = (inp.value.match(/\d/g) || []).map(Number);
        var target = reverse ? seq.slice().reverse() : seq;
        var good = digits.length === target.length && digits.every(function (d, i) { return d === target[i]; });
        total++; wrap.style.visibility = 'hidden'; phase = 'idle';
        if (good) { correct++; maxSpan = Math.max(maxSpan, span); fails = 0; span++; flash('#2ea043'); if (span > 9) return finish(); }
        else { fails++; flash('#f85149'); if (fails >= 2) return finish(); }
        timers.push(setTimeout(playSeq, 650));
      }
      function flash(c) { cv.style.boxShadow = '0 0 0 3px ' + c; setTimeout(function () { cv.style.boxShadow = ''; }, 200); }
      function finish() {
        alive = false; cleanup();
        var acc = total ? correct / total : 0;
        onComplete({
          score: R.round(maxSpan * 12 + acc * 20 + (reverse ? 10 : 0), 1),
          accuracy: acc, reaction_time_avg: null,
          duration_ms: Math.round(performance.now() - t0),
          raw_data: { max_span: maxSpan, mode: reverse ? 'reverse' : 'forward', sequences: total, correct: correct }
        });
      }
      function onKey(e) { if (e.key === 'Enter') submit(); }
      function cleanup() { timers.forEach(clearTimeout); timers = []; ok.removeEventListener('click', submit); inp.removeEventListener('keydown', onKey); }
      ok.addEventListener('click', submit); inp.addEventListener('keydown', onKey);

      R.splash(ctx, w, h, 'Digit Span', [R.L(CTRL, lang)], lang === 'ru' ? 'Начинаем…' : 'Starting…');
      timers.push(setTimeout(function () { R.countdown(ctx, w, h, 3, function () { t0 = performance.now(); playSeq(); }); }, 1700));
      return function () { alive = false; cleanup(); };
    }
  });
})();
