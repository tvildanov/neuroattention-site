/* NeuroAttention — Exercises & Tests engine (shared helpers).
 *
 * Registry + small toolkit shared by the 10 canvas exercises. Each exercise
 * module calls NAExercises.register(slug, def) where:
 *
 *   def = {
 *     slug,
 *     controls: { ru, en, es },       // one-line control hint (optional)
 *     mount(host, opts, onComplete)   // host = a DOM element to fill
 *   }
 *
 *   opts        = { level:int(1..10), lang:'ru'|'en'|'es', t:function }
 *   onComplete(result) where result = {
 *     score:number, accuracy:0..1|null, reaction_time_avg:ms|null,
 *     duration_ms:int, raw_data:object
 *   }
 *   mount returns a dispose() function (stop timers / RAF / listeners).
 *
 * The outer launcher (account.html) owns the card chrome: title, clinical
 * citations, mini-atlas, level selector, Start button, and the result screen
 * that POSTs to /api/exercises/result. Modules own ONLY the gameplay: their
 * own instructions/countdown on the canvas and the trial loop.
 */
(function () {
  var R = (window.NAExercises = window.NAExercises || {});
  R.modules = R.modules || {};
  R.register = function (slug, def) { def.slug = slug; R.modules[slug] = def; };
  R.get = function (slug) { return R.modules[slug]; };

  /* ---- RNG + array helpers ---------------------------------------- */
  R.randInt = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  R.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  R.shuffle = function (arr) {
    arr = arr.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  R.coin = function (p) { return Math.random() < (p == null ? 0.5 : p); };

  /* ---- stats ------------------------------------------------------- */
  R.mean = function (xs) {
    if (!xs || !xs.length) return null;
    var s = 0; for (var i = 0; i < xs.length; i++) s += xs[i];
    return s / xs.length;
  };
  R.stdev = function (xs) {
    if (!xs || xs.length < 2) return 0;
    var m = R.mean(xs), s = 0;
    for (var i = 0; i < xs.length; i++) s += (xs[i] - m) * (xs[i] - m);
    return Math.sqrt(s / (xs.length - 1));
  };
  R.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  R.round = function (v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; };

  /* ---- DPI-aware canvas -------------------------------------------- */
  R.fitCanvas = function (canvas) {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h, dpr: dpr };
  };

  /* ---- drawing helpers --------------------------------------------- */
  R.clear = function (ctx, w, h, bg) {
    ctx.fillStyle = bg || '#0d1117';
    ctx.fillRect(0, 0, w, h);
  };
  R.text = function (ctx, str, x, y, opts) {
    opts = opts || {};
    ctx.save();
    ctx.fillStyle = opts.color || '#e6edf3';
    ctx.font = (opts.weight || '600') + ' ' + (opts.size || 20) + 'px ' +
      (opts.font || 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = opts.baseline || 'middle';
    ctx.fillText(str, x, y);
    ctx.restore();
  };
  R.wrapText = function (ctx, str, x, y, maxW, lineH, opts) {
    opts = opts || {};
    ctx.save();
    ctx.fillStyle = opts.color || '#9aa4b2';
    ctx.font = (opts.weight || '400') + ' ' + (opts.size || 15) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var words = String(str).split(/\s+/), line = '', yy = y;
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy); line = words[i]; yy += lineH;
      } else { line = test; }
    }
    if (line) ctx.fillText(line, x, yy);
    ctx.restore();
    return yy;
  };

  /* ---- HUD (score / time / progress) ------------------------------- */
  R.hud = function (ctx, w, h, left, right) {
    ctx.save();
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.textBaseline = 'top';
    if (left != null) { ctx.textAlign = 'left'; ctx.fillStyle = '#9aa4b2'; ctx.fillText(left, 14, 12); }
    if (right != null) { ctx.textAlign = 'right'; ctx.fillStyle = '#9aa4b2'; ctx.fillText(right, w - 14, 12); }
    ctx.restore();
  };

  /* ---- 3-2-1 countdown, then cb() ---------------------------------- */
  R.countdown = function (ctx, w, h, seconds, cb, opts) {
    opts = opts || {};
    var n = seconds || 3, alive = true, raf = 0, t0 = performance.now();
    function frame(now) {
      if (!alive) return;
      var elapsed = (now - t0) / 1000;
      var remain = Math.ceil(n - elapsed);
      R.clear(ctx, w, h, opts.bg);
      if (remain <= 0) { cb(); return; }
      var pulse = 1 - (elapsed - Math.floor(elapsed));
      R.text(ctx, String(remain), w / 2, h / 2, { size: 90 + pulse * 20, color: '#58a6ff', weight: '700' });
      if (opts.hint) R.text(ctx, opts.hint, w / 2, h / 2 + 90, { size: 16, color: '#9aa4b2', weight: '400' });
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return function () { alive = false; cancelAnimationFrame(raf); };
  };

  /* ---- instruction splash screen (canvas) -------------------------- */
  R.splash = function (ctx, w, h, title, lines, footer) {
    R.clear(ctx, w, h);
    R.text(ctx, title, w / 2, h / 2 - 70, { size: 26, weight: '700' });
    var y = h / 2 - 24;
    (lines || []).forEach(function (ln) {
      y = R.wrapText(ctx, ln, w / 2, y, w - 80, 24, { size: 16, color: '#c9d1d9' }) + 30;
    });
    if (footer) R.text(ctx, footer, w / 2, h - 40, { size: 15, color: '#58a6ff', weight: '600' });
  };

  /* ---- localized string helper (module-local dicts) ---------------- */
  R.L = function (dict, lang) {
    return (dict && (dict[lang] || dict.en || dict.ru)) || '';
  };

  /* ---- reaction-time accuracy scoring convenience ------------------ */
  // Classic cognitive score: accuracy% weighted, penalize slow RT.
  R.compositeScore = function (accuracy, rtAvg, rtFloor, rtCeil) {
    var acc = R.clamp(accuracy == null ? 0 : accuracy, 0, 1);
    if (rtAvg == null) return R.round(acc * 100, 1);
    var f = rtFloor || 250, c = rtCeil || 1200;
    var speed = R.clamp((c - rtAvg) / (c - f), 0, 1); // 1=fast .. 0=slow
    return R.round((acc * 0.7 + speed * 0.3) * 100, 1);
  };
})();
