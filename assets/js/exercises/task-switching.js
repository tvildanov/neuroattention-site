/* Task Switching — cognitive flexibility / set-shifting. Monsell 2003.
 * A cue («ЦВЕТ»/«ФОРМА») says which rule to apply to a coloured shape.
 * The rule switches unpredictably; switch-cost (RT delta) is the key measure. */
(function () {
  var R = window.NAExercises;
  var CTRL = {
    ru: 'Подсказка «ЦВЕТ» → нажмите цвет фигуры. «ФОРМА» → нажмите форму. Правило меняется.',
    en: 'Cue "COLOUR" → pick the shape\'s colour. "SHAPE" → pick its shape. The rule switches.',
    es: 'Pista «COLOR» → elige el color. «FORMA» → elige la forma. La regla cambia.'
  };
  var T = {
    color: { ru: 'ЦВЕТ', en: 'COLOUR', es: 'COLOR' },
    shape: { ru: 'ФОРМА', en: 'SHAPE', es: 'FORMA' },
    red: { ru: 'Красный', en: 'Red', es: 'Rojo' }, blue: { ru: 'Синий', en: 'Blue', es: 'Azul' },
    circle: { ru: 'Круг', en: 'Circle', es: 'Círculo' }, square: { ru: 'Квадрат', en: 'Square', es: 'Cuadrado' }
  };
  R.register('task-switching', {
    controls: CTRL,
    mount: function (host, opts, onComplete) {
      var lang = opts.lang;
      var trials = 20 + opts.level * 2;
      var deadline = Math.round(3000 - opts.level * 160);

      host.innerHTML = '';
      var cv = document.createElement('canvas');
      cv.style.cssText = 'width:100%;height:320px;display:block;border-radius:12px;background:#0d1117';
      host.appendChild(cv);
      var pad = document.createElement('div'); pad.style.cssText = 'display:flex;gap:12px;justify-content:center;margin-top:12px';
      function mk(side) { var b = document.createElement('button'); b.className = 'btn btn-primary'; b.style.cssText = 'min-width:150px;font-size:1.1rem;padding:.65rem 1rem'; b.disabled = true; b.addEventListener('click', function () { answer(side); }); pad.appendChild(b); return b; }
      var bA = mk('A'), bB = mk('B'); host.appendChild(pad);

      var f = R.fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;
      var idx = -1, alive = true, awaiting = false, responded = false, stimAt = 0, dTimer = 0, timers = [], t0 = 0;
      var cfg = [], correct = 0, errors = 0, rtSwitch = [], rtRepeat = [];

      for (var i = 0; i < trials; i++) {
        cfg.push({ task: R.pick(['color', 'shape']), color: R.pick(['red', 'blue']), shape: R.pick(['circle', 'square']) });
      }

      function labels(task) {
        // map option A/B for current task
        if (task === 'color') return { A: 'red', B: 'blue' };
        return { A: 'circle', B: 'square' };
      }
      function drawStim(c) {
        R.clear(ctx, w, h);
        R.hud(ctx, w, h, (lang === 'ru' ? 'Проба ' : 'Trial ') + (idx + 1) + '/' + trials, 'Task Switch');
        R.text(ctx, R.L(T[c.task], lang), w / 2, 46, { size: 24, weight: '800', color: '#e3b341' });
        var cx = w / 2, cy = h / 2 + 10, s = 46, col = c.color === 'red' ? '#f85149' : '#58a6ff';
        ctx.save(); ctx.fillStyle = col;
        if (c.shape === 'circle') { ctx.beginPath(); ctx.arc(cx, cy, s, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.fillRect(cx - s, cy - s, s * 2, s * 2); }
        ctx.restore();
      }
      function next() {
        if (!alive) return;
        idx++; if (idx >= trials) return finish();
        var c = cfg[idx], lab = labels(c.task);
        bA.textContent = R.L(T[lab.A], lang); bB.textContent = R.L(T[lab.B], lang);
        responded = false; drawStim(c); awaiting = true; stimAt = performance.now();
        dTimer = setTimeout(timeout, deadline); timers.push(dTimer);
      }
      function answer(side) {
        if (!alive || !awaiting || responded) return;
        responded = true; awaiting = false; clearTimeout(dTimer);
        var c = cfg[idx], lab = labels(c.task);
        var chosen = side === 'A' ? lab.A : lab.B;
        var target = c.task === 'color' ? c.color : c.shape;
        var ok = chosen === target, rt = performance.now() - stimAt;
        var isSwitch = idx > 0 && cfg[idx - 1].task !== c.task;
        if (ok) { correct++; (isSwitch ? rtSwitch : rtRepeat).push(rt); flash('#2ea043'); }
        else { errors++; flash('#f85149'); }
        timers.push(setTimeout(next, 320));
      }
      function timeout() { if (!alive || !awaiting) return; awaiting = false; errors++; flash('#8b949e'); timers.push(setTimeout(next, 300)); }
      function flash(c) { cv.style.boxShadow = '0 0 0 3px ' + c; setTimeout(function () { cv.style.boxShadow = ''; }, 140); }
      function finish() {
        alive = false; cleanup();
        var acc = trials ? correct / trials : 0;
        var rt = R.mean(rtSwitch.concat(rtRepeat));
        var cost = (R.mean(rtSwitch) != null && R.mean(rtRepeat) != null) ? R.round(R.mean(rtSwitch) - R.mean(rtRepeat), 0) : null;
        onComplete({
          score: R.compositeScore(acc, rt, 450, 2200),
          accuracy: acc, reaction_time_avg: rt == null ? null : R.round(rt, 0),
          duration_ms: Math.round(performance.now() - t0),
          raw_data: { trials: trials, correct: correct, errors: errors, switch_cost_ms: cost }
        });
      }
      function cleanup() { timers.forEach(clearTimeout); timers = []; bA.disabled = bB.disabled = true; }

      R.splash(ctx, w, h, 'Task Switching', [R.L(CTRL, lang)], lang === 'ru' ? 'Начинаем…' : 'Starting…');
      timers.push(setTimeout(function () { R.countdown(ctx, w, h, 3, function () { t0 = performance.now(); bA.disabled = bB.disabled = false; next(); }); }, 1800));
      return function () { alive = false; cleanup(); };
    }
  });
})();
