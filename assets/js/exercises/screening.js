/* NeuroAttention — validated screening-test runner.
 *
 * Renders a validated self-report questionnaire (PHQ-9, GAD-7, ASRS-v1.1,
 * PCL-5, MDQ, AQ-10) from the data in window.NA_SCREENERS, auto-scores it,
 * and shows an interpretation band + a NOT-A-DIAGNOSIS disclaimer + citation.
 *
 * These are SCREENERS, not the canvas games — they mount through the same
 * launcher (kind='screening_test') but with their own module here. Contract:
 *
 *   NAScreeners.mount(host, {slug, lang, t}, onComplete)
 *   onComplete({ score, accuracy:null, band, positive, interpretation,
 *                raw_data:{responses, subscores...}, flags:[...], duration_ms })
 *
 * Scoring is data-driven (data.scoring.type ∈ sum|threshold|aq10|mdq|pcl5);
 * the exact thresholds / directions / clusters live in screening-data.js so
 * this file never hard-codes clinical values.
 */
(function () {
  var S = (window.NAScreeners = window.NAScreeners || {});
  function DATA() { return window.NA_SCREENERS || {}; }
  S.get = function (slug) { return DATA()[slug]; };
  S.all = function () { return DATA(); };

  function L(x, lang) { return x ? (x[lang] || x.en || x.ru) : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ── scoring ───────────────────────────────────────────────────────────────
  // responses: array aligned to data.items; each = selected option value (int).
  function score(data, responses) {
    var sc = data.scoring || { type: 'sum' };
    var total = 0, i;
    for (i = 0; i < responses.length; i++) total += (typeof responses[i] === 'number' ? responses[i] : 0);

    if (sc.type === 'sum') {
      return { score: total, positive: sc.cutoff != null ? (total >= sc.cutoff) : null, subscores: {} };
    }
    if (sc.type === 'threshold') {
      // ASRS: item i counts if response >= thresholds[i]; positive if count >= cutoffCount
      var count = 0;
      for (i = 0; i < responses.length; i++) if (responses[i] >= sc.thresholds[i]) count++;
      return { score: count, rawSum: total, positive: count >= sc.cutoffCount, subscores: { shaded: count } };
    }
    if (sc.type === 'aq10') {
      // each item scores 1 in its autism-direction; agree-items on index<=agreeMax,
      // disagree-items on index>=disagreeMin (scale is 0=Def.agree..3=Def.disagree)
      var s = 0;
      for (i = 0; i < responses.length; i++) {
        var dir = sc.directions[i]; var r = responses[i];
        if (dir === 'agree' && r <= sc.agreeMax) s++;
        else if (dir === 'disagree' && r >= sc.disagreeMin) s++;
      }
      return { score: s, positive: s >= sc.cutoff, subscores: {} };
    }
    if (sc.type === 'mdq') {
      // sections: q1 = 13 yes/no (1/0), q2 = yes/no, q3 = severity 0..3
      var q1 = 0;
      for (i = 0; i < sc.q1Count; i++) if (responses[i] === 1) q1++;
      var q2 = responses[sc.q2Index] === 1;
      var q3 = responses[sc.q3Index];
      var pos = (q1 >= sc.q1Cutoff) && q2 && (q3 >= sc.q3Cutoff);
      return { score: q1, positive: pos, subscores: { symptoms: q1, cooccur: q2 ? 1 : 0, impairment: q3 } };
    }
    if (sc.type === 'pcl5') {
      // sum 0..80 + DSM-5 cluster rule (item rated >= symMin counts)
      var clusters = {}, ok = true;
      (sc.clusters || []).forEach(function (cl) {
        var c = 0;
        for (i = cl.from; i <= cl.to; i++) if (responses[i] >= sc.symMin) c++;
        clusters[cl.key] = c;
        if (c < cl.need) ok = false;
      });
      return { score: total, positive: (total >= sc.cutoff) || ok, subscores: clusters, clusterRuleMet: ok };
    }
    return { score: total, positive: null, subscores: {} };
  }

  function bandFor(data, result) {
    // Graded instruments (PHQ-9/GAD-7/PCL-5) map a score range → severity band.
    if (data.bands && data.bands.length) {
      for (var i = 0; i < data.bands.length; i++)
        if (result.score >= data.bands[i].min && result.score <= data.bands[i].max) return data.bands[i];
      return null;
    }
    // Binary screeners (ASRS/AQ-10/MDQ) map the positive flag → pos/neg band.
    if (result.positive === true) return data.posBand || null;
    if (result.positive === false) return data.negBand || null;
    return null;
  }

  function collectFlags(data, responses, lang) {
    var out = [];
    (data.flags || []).forEach(function (f) {
      if (responses[f.itemIndex] != null && responses[f.itemIndex] >= f.minValue) {
        out.push({ crisis: !!f.crisis, message: L(f.message, lang) });
      }
    });
    return out;
  }

  // ── render ──────────────────────────────────────────────────────────────
  S.mount = function (host, opts, onComplete) {
    var lang = opts.lang || 'ru';
    var data = S.get(opts.slug);
    if (!data) { host.innerHTML = '<p style="color:#f85149">screener not found: ' + esc(opts.slug) + '</p>'; return function () {}; }
    var TT = {
      ru: { submit: 'Показать результат', answerAll: 'Ответьте на все пункты', of: 'из', progress: 'Отвечено' },
      en: { submit: 'See result', answerAll: 'Please answer every item', of: 'of', progress: 'Answered' },
      es: { submit: 'Ver resultado', answerAll: 'Responde todos los ítems', of: 'de', progress: 'Respondido' }
    };
    var W = TT[lang] || TT.en;
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    var responses = new Array(data.items.length).fill(null);

    var defScale = data.scale || [];
    function itemScale(it) { return it.scale || defScale; }

    var rows = data.items.map(function (it, idx) {
      var scale = itemScale(it);
      var opts2 = scale.map(function (o) {
        return '<label class="scr-opt"><input type="radio" name="scr-' + idx + '" value="' + o.v + '"><span>' + esc(L(o.label, lang)) + '</span></label>';
      }).join('');
      var secHdr = it.section ? '<div class="scr-section">' + esc(L(it.section, lang)) + '</div>' : '';
      return secHdr + '<div class="scr-item" data-idx="' + idx + '">' +
        '<div class="scr-q"><span class="scr-n">' + (idx + 1) + '.</span> ' + esc(L(it.text, lang)) + '</div>' +
        '<div class="scr-scale">' + opts2 + '</div></div>';
    }).join('');

    host.innerHTML =
      '<div class="scr-wrap">' +
        '<div class="scr-stem">' + esc(L(data.stem, lang)) + '</div>' +
        '<div class="scr-items">' + rows + '</div>' +
        '<div class="scr-foot">' +
          '<div class="scr-prog"><span class="scr-prog-t">' + W.progress + ' 0 ' + W.of + ' ' + data.items.length + '</span>' +
            '<div class="scr-prog-bar"><i style="width:0%"></i></div></div>' +
          '<button class="btn btn-primary scr-submit" disabled>' + esc(W.submit) + '</button>' +
        '</div>' +
      '</div>';

    var answered = 0, submit = host.querySelector('.scr-submit');
    var progT = host.querySelector('.scr-prog-t'), progBar = host.querySelector('.scr-prog-bar i');
    host.querySelectorAll('.scr-item').forEach(function (row) {
      var idx = parseInt(row.getAttribute('data-idx'), 10);
      row.querySelectorAll('input[type=radio]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          var was = responses[idx] != null;
          responses[idx] = parseInt(inp.value, 10);
          row.classList.add('scr-answered');
          if (!was) answered++;
          progT.textContent = W.progress + ' ' + answered + ' ' + W.of + ' ' + data.items.length;
          progBar.style.width = Math.round(answered / data.items.length * 100) + '%';
          submit.disabled = answered < data.items.length;
        });
      });
    });

    submit.addEventListener('click', function () {
      if (answered < data.items.length) { alert(W.answerAll); return; }
      var result = score(data, responses);
      var band = bandFor(data, result);
      var flags = collectFlags(data, responses, lang);
      onComplete({
        score: result.score, accuracy: null, reaction_time_avg: null,
        positive: result.positive, band: band ? L(band.label, lang) : null,
        interpretation: band ? L(band.detail, lang) : '',
        duration_ms: Math.round(((window.performance && performance.now) ? performance.now() : Date.now()) - t0),
        raw_data: {
          instrument: data.slug, responses: responses, subscores: result.subscores,
          positive: result.positive, band: band ? (band.key || L(band.label, 'en')) : null,
          cluster_rule_met: result.clusterRuleMet
        },
        flags: flags,
        band_obj: band, result_obj: result, data: data
      });
    });

    return function () { /* nothing async to tear down */ };
  };
})();
