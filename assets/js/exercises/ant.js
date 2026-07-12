/* Attention Network Test (ANT) — alerting, orienting, executive attention.
 * Fan et al. 2002. A cue (none / center / spatial) precedes a row of 5 arrows
 * above or below fixation; respond to the CENTRE arrow's direction. Flankers
 * are congruent or incongruent. Network scores are derived in raw_data. */
(function () {
  var R = window.NAExercises;
  var CTRL = {
    ru: 'Определите направление ЦЕНТРАЛЬНОЙ стрелки: ← или →. Крайние стрелки — помеха.',
    en: 'Report the CENTRE arrow direction: ← or →. The outer arrows are distractors.',
    es: 'Indica la dirección de la flecha CENTRAL: ← o →. Las flechas externas distraen.'
  };
  R.register('ant', {
    controls: CTRL,
    mount: function (host, opts, onComplete) {
      var lang = opts.lang;
      var trials = 18 + opts.level * 2;
      var deadline = Math.round(2200 - opts.level * 120);

      host.innerHTML = '';
      var cv = document.createElement('canvas');
      cv.style.cssText = 'width:100%;height:340px;display:block;border-radius:12px;background:#0d1117';
      host.appendChild(cv);
      var pad = document.createElement('div'); pad.style.cssText = 'display:flex;gap:14px;justify-content:center;margin-top:12px';
      function mk(txt, dir) { var b = document.createElement('button'); b.className = 'btn btn-primary'; b.textContent = txt; b.style.cssText = 'min-width:120px;font-size:1.5rem;padding:.5rem 1.4rem'; b.disabled = true; b.addEventListener('click', function () { answer(dir); }); pad.appendChild(b); return b; }
      var bL = mk('←', 'L'), bR = mk('→', 'R'); host.appendChild(pad);

      var f = R.fitCanvas(cv), ctx = f.ctx, w = f.w, h = f.h;
      var idx = -1, alive = true, awaiting = false, responded = false, stimAt = 0, dTimer = 0, timers = [], t0 = 0;
      var cfg = [], correct = 0, errors = 0, rows = {};
      var CUES = ['none', 'center', 'spatial'], FL = ['cong', 'incong'];

      for (var i = 0; i < trials; i++) {
        cfg.push({ cue: R.pick(CUES), fl: R.pick(FL), up: R.coin(), dir: R.coin() ? 'L' : 'R' });
      }

      function arrow(cx, cy, dir, s) {
        ctx.save(); ctx.strokeStyle = '#e6edf3'; ctx.fillStyle = '#e6edf3'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        var d = dir === 'L' ? -1 : 1;
        ctx.beginPath(); ctx.moveTo(cx - s * d, cy); ctx.lineTo(cx + s * d, cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + s * d, cy); ctx.lineTo(cx + s * d - 8 * d, cy - 7); ctx.lineTo(cx + s * d - 8 * d, cy + 7); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      function fixation(cueDot) {
        R.clear(ctx, w, h);
        R.hud(ctx, w, h, (lang === 'ru' ? 'Проба ' : 'Trial ') + (idx + 1) + '/' + trials, 'ANT');
        R.text(ctx, '+', w / 2, h / 2, { size: 40, color: '#8b949e' });
        if (cueDot) { ctx.save(); ctx.fillStyle = '#e3b341'; ctx.beginPath(); ctx.arc(cueDot.x, cueDot.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      }
      function drawTarget(c) {
        R.clear(ctx, w, h);
        R.hud(ctx, w, h, (lang === 'ru' ? 'Проба ' : 'Trial ') + (idx + 1) + '/' + trials, 'ANT');
        R.text(ctx, '+', w / 2, h / 2, { size: 30, color: '#8b949e' });
        var cy = c.up ? h / 2 - 70 : h / 2 + 70, cx = w / 2, gap = 46, s = 16;
        for (var k = -2; k <= 2; k++) {
          var d = (k === 0) ? c.dir : (c.fl === 'cong' ? c.dir : (c.dir === 'L' ? 'R' : 'L'));
          arrow(cx + k * gap, cy, d, s);
        }
      }
      function next() {
        if (!alive) return;
        idx++; if (idx >= trials) return finish();
        var c = cfg[idx]; responded = false; awaiting = false;
        fixation(null);
        // cue at 500ms
        timers.push(setTimeout(function () {
          if (!alive) return;
          if (c.cue === 'center') fixation({ x: w / 2, y: h / 2 });
          else if (c.cue === 'spatial') fixation({ x: w / 2, y: c.up ? h / 2 - 70 : h / 2 + 70 });
          else fixation(null);
          // target at cue+400ms
          timers.push(setTimeout(function () {
            if (!alive) return;
            drawTarget(c); awaiting = true; stimAt = performance.now();
            dTimer = setTimeout(timeout, deadline); timers.push(dTimer);
          }, 400));
        }, 500));
      }
      function answer(dir) {
        if (!alive || !awaiting || responded) return;
        responded = true; awaiting = false; clearTimeout(dTimer);
        var c = cfg[idx], rt = performance.now() - stimAt, ok = dir === c.dir;
        if (ok) { correct++; var key = c.cue + '|' + c.fl; (rows[key] = rows[key] || []).push(rt); }
        else errors++;
        flash(ok ? '#2ea043' : '#f85149');
        timers.push(setTimeout(next, 350));
      }
      function timeout() { if (!alive || !awaiting) return; awaiting = false; errors++; flash('#8b949e'); timers.push(setTimeout(next, 300)); }
      function flash(c) { cv.style.boxShadow = '0 0 0 3px ' + c; setTimeout(function () { cv.style.boxShadow = ''; }, 140); }
      function avg(keys) { var all = []; keys.forEach(function (k) { if (rows[k]) all = all.concat(rows[k]); }); return R.mean(all); }
      function finish() {
        alive = false; cleanup();
        var acc = trials ? correct / trials : 0, rt = avg(Object.keys(rows));
        var noCue = avg(['none|cong', 'none|incong']), center = avg(['center|cong', 'center|incong']);
        var alerting = (noCue != null && center != null) ? R.round(noCue - center, 0) : null;
        var cong = avg(['none|cong', 'center|cong', 'spatial|cong']), incong = avg(['none|incong', 'center|incong', 'spatial|incong']);
        var conflict = (cong != null && incong != null) ? R.round(incong - cong, 0) : null;
        onComplete({
          score: R.compositeScore(acc, rt, 350, 1600),
          accuracy: acc, reaction_time_avg: rt == null ? null : R.round(rt, 0),
          duration_ms: Math.round(performance.now() - t0),
          raw_data: { trials: trials, correct: correct, errors: errors, alerting_ms: alerting, conflict_ms: conflict }
        });
      }
      function onKey(e) { if (e.key === 'ArrowLeft') answer('L'); else if (e.key === 'ArrowRight') answer('R'); }
      function cleanup() { timers.forEach(clearTimeout); timers = []; window.removeEventListener('keydown', onKey); bL.disabled = bR.disabled = true; }
      window.addEventListener('keydown', onKey);

      R.splash(ctx, w, h, 'ANT', [R.L(CTRL, lang)], lang === 'ru' ? 'Начинаем…' : 'Starting…');
      timers.push(setTimeout(function () { R.countdown(ctx, w, h, 3, function () { t0 = performance.now(); bL.disabled = bR.disabled = false; next(); }); }, 1700));
      return function () { alive = false; cleanup(); };
    }
  });
})();
