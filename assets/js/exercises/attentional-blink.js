/* Attentional Blink — temporal attention. Raymond, Shapiro & Arnell 1992.
 * A rapid stream (RSVP) of black letters contains a WHITE target (T1) and,
 * sometimes, an X (T2) shortly after. Reporting T2 fails when it lands ~200-500 ms
 * after T1 — the "blink". Identify T1, then say whether an X appeared. */
(function () {
  var R = window.NAExercises;
  var POOL = 'ABCDEFGHJKLMNPRSTUVWZ'.split('');
  var CTRL = {
    ru: 'Смотрите на поток букв. Запомните БЕЛУЮ букву и заметьте, была ли «X» после неё.',
    en: 'Watch the letter stream. Note the WHITE letter, and whether an "X" followed it.',
    es: 'Observa el flujo. Fíjate en la letra BLANCA y si apareció una «X» después.'
  };
  R.register('attentional-blink', {
    controls: CTRL,
    mount: function (host, opts, onComplete) {
      var lang = opts.lang;
      var rounds = 8 + Math.floor(opts.level / 2);
      var soa = Math.round(130 - opts.level * 6); // ms per item (faster = harder)

      host.innerHTML = '';
      var cv = document.createElement('canvas');
      cv.style.cssText = 'width:100%;height:340px;display:block;border-radius:12px;background:#0d1117';
      host.appendChild(cv);
      var pad = document.createElement('div'); pad.style.cssText = 'margin-top:12px;text-align:center';
      host.appendChild(pad);

      var f = R.fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;
      var alive = true, timers = [], t0 = 0, round = 0;
      var t1correct = 0, t2attempts = 0, t2correct = 0, byLag = { short: { n: 0, ok: 0 }, long: { n: 0, ok: 0 } };
      var cur = null;

      function clearPad() { pad.innerHTML = ''; }
      function btn(txt, cb, primary) { var b = document.createElement('button'); b.className = 'btn ' + (primary ? 'btn-primary' : 'btn-ghost'); b.textContent = txt; b.style.cssText = 'margin:4px;min-width:64px;padding:.55rem .9rem;font-size:1.05rem'; b.addEventListener('click', cb); pad.appendChild(b); return b; }

      function buildStream() {
        var len = 16;
        var t1pos = R.randInt(4, 8);
        var hasX = R.coin(0.6);
        var lag = R.randInt(1, 7);
        var xpos = t1pos + lag;
        if (xpos >= len - 1) { hasX = false; }
        var items = [];
        for (var i = 0; i < len; i++) {
          if (i === t1pos) items.push({ ch: R.pick(POOL), color: '#ffffff', t1: true });
          else if (hasX && i === xpos) items.push({ ch: 'X', color: '#e6edf3', t2: true });
          else { var c; do { c = R.pick(POOL); } while (c === 'X'); items.push({ ch: c, color: '#8b949e' }); }
        }
        return { items: items, t1: items[t1pos].ch, hasX: hasX, lag: lag };
      }
      function runStream() {
        clearPad(); cur = buildStream();
        var i = 0;
        function step() {
          if (!alive) return;
          if (i >= cur.items.length) { askT1(); return; }
          var it = cur.items[i];
          R.clear(ctx, w, h);
          R.hud(ctx, w, h, (lang === 'ru' ? 'Раунд ' : 'Round ') + (round + 1) + '/' + rounds, 'Attentional Blink');
          R.text(ctx, it.ch, w / 2, h / 2, { size: 96, weight: '800', color: it.color });
          i++;
          timers.push(setTimeout(step, soa));
        }
        R.clear(ctx, w, h); R.text(ctx, '+', w / 2, h / 2, { size: 40, color: '#8b949e' });
        timers.push(setTimeout(step, 500));
      }
      function askT1() {
        R.clear(ctx, w, h);
        R.text(ctx, lang === 'ru' ? 'Какая была БЕЛАЯ буква?' : 'Which was the WHITE letter?', w / 2, h / 2 - 20, { size: 22, color: '#c9d1d9' });
        clearPad();
        // 4 options incl. correct
        var opts4 = R.shuffle([cur.t1].concat(R.shuffle(POOL.filter(function (c) { return c !== cur.t1; })).slice(0, 3)));
        opts4.forEach(function (ch) { btn(ch, function () { chooseT1(ch); }, true); });
      }
      function chooseT1(ch) {
        if (ch === cur.t1) t1correct++;
        askT2();
      }
      function askT2() {
        R.clear(ctx, w, h);
        R.text(ctx, lang === 'ru' ? 'Была ли «X» после белой буквы?' : 'Was there an "X" after it?', w / 2, h / 2, { size: 22, color: '#c9d1d9' });
        clearPad();
        btn(lang === 'ru' ? 'Да' : lang === 'es' ? 'Sí' : 'Yes', function () { chooseT2(true); }, true);
        btn(lang === 'ru' ? 'Нет' : 'No', function () { chooseT2(false); }, false);
      }
      function chooseT2(saidYes) {
        t2attempts++;
        var ok = saidYes === cur.hasX;
        if (ok) t2correct++;
        if (cur.hasX) { var bucket = cur.lag <= 3 ? byLag.short : byLag.long; bucket.n++; if (saidYes) bucket.ok++; }
        round++;
        if (round >= rounds) return finish();
        clearPad();
        R.clear(ctx, w, h); R.text(ctx, ok ? '✓' : '✗', w / 2, h / 2, { size: 60, color: ok ? '#3fb950' : '#f85149' });
        timers.push(setTimeout(runStream, 700));
      }
      function finish() {
        alive = false; cleanup();
        var acc = rounds ? (t1correct / rounds) : 0;
        var t2acc = t2attempts ? t2correct / t2attempts : 0;
        var blink = (byLag.short.n && byLag.long.n) ? R.round((byLag.long.ok / byLag.long.n) - (byLag.short.ok / byLag.short.n), 2) : null;
        onComplete({
          score: R.round((acc * 0.5 + t2acc * 0.5) * 100, 1),
          accuracy: R.round((acc + t2acc) / 2, 3), reaction_time_avg: null,
          duration_ms: Math.round(performance.now() - t0),
          raw_data: { rounds: rounds, t1_accuracy: R.round(acc, 2), t2_accuracy: R.round(t2acc, 2), blink_effect: blink }
        });
      }
      function cleanup() { timers.forEach(clearTimeout); timers = []; }

      R.splash(ctx, w, h, 'Attentional Blink', [R.L(CTRL, lang)], lang === 'ru' ? 'Начинаем…' : 'Starting…');
      timers.push(setTimeout(function () { R.countdown(ctx, w, h, 3, function () { t0 = performance.now(); runStream(); }); }, 1900));
      return function () { alive = false; cleanup(); };
    }
  });
})();
