/**
 * NeuroAttention i18n — lightweight client-side internationalization
 * No external dependencies. Key-based dictionaries in /data/i18n/{lang}.json
 *
 * HTML usage:
 *   <span data-i18n="hero.title">Fallback RU text</span>
 *   <input data-i18n-placeholder="form.email" placeholder="Fallback">
 *   <img data-i18n-alt="hero.img_alt" alt="Fallback">
 *   <div data-i18n-title="tooltip.hint" title="Fallback"></div>
 *
 * JS API:
 *   setLang('en')  — switch language, persist in localStorage, re-render DOM
 *   t('key')       — return translated string synchronously (from cache)
 *   getLang()      — current language code ('ru'|'en'|'es')
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'na_lang';
  // DEFAULT_LANG is the *fallback dictionary* (HTML markup is authored in RU,
  // ru.json is the most complete catalogue). The default *displayed* language
  // for a fresh international visitor is English — see detectInitialLang().
  var DEFAULT_LANG = 'ru';
  var INITIAL_LANG = 'en'; // shown when no stored choice & no RU/ES signal
  var SUPPORTED = ['ru', 'en', 'es'];
  var GEO_KEY = 'na_geo_done'; // marks that the one-time geo-IP probe already ran
  var geoEligible = false; // set true only when detection fell through to the bare EN default
  var cache = {};
  var currentLang = DEFAULT_LANG;
  var ready = false;

  /* ── path helpers ── */
  function getBasePath() {
    var scripts = document.querySelectorAll('script[src*="i18n.js"]');
    if (scripts.length) {
      var src = scripts[0].getAttribute('src');
      var idx = src.indexOf('assets/');
      if (idx >= 0) return src.substring(0, idx);
    }
    return '';
  }
  var basePath = getBasePath();

  /* ── loader ── */
  function loadDict(lang, cb) {
    if (cache[lang]) { cb(cache[lang]); return; }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', basePath + 'data/i18n/' + lang + '.json?v=' + Date.now(), true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) {
        try { cache[lang] = JSON.parse(xhr.responseText); }
        catch (e) { console.warn('[i18n] parse error ' + lang, e); cache[lang] = {}; }
      } else {
        console.warn('[i18n] load failed ' + lang + ' (' + xhr.status + ')');
        cache[lang] = {};
      }
      cb(cache[lang]);
    };
    xhr.send();
  }

  /* ── DOM replacement ── */
  function applyTranslations(dict) {
    var fb = cache[DEFAULT_LANG] || {};

    // data-i18n  →  innerHTML
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-i18n');
      var v = dict[k] || fb[k];
      if (v !== undefined) els[i].innerHTML = v;
    }

    // data-i18n-placeholder
    els = document.querySelectorAll('[data-i18n-placeholder]');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-i18n-placeholder');
      var v = dict[k] || fb[k];
      if (v !== undefined) els[i].setAttribute('placeholder', v);
    }

    // data-i18n-alt
    els = document.querySelectorAll('[data-i18n-alt]');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-i18n-alt');
      var v = dict[k] || fb[k];
      if (v !== undefined) els[i].setAttribute('alt', v);
    }

    // data-i18n-title
    els = document.querySelectorAll('[data-i18n-title]');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-i18n-title');
      var v = dict[k] || fb[k];
      if (v !== undefined) els[i].setAttribute('title', v);
    }

    // data-i18n-aria-label
    els = document.querySelectorAll('[data-i18n-aria-label]');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-i18n-aria-label');
      var v = dict[k] || fb[k];
      if (v !== undefined) els[i].setAttribute('aria-label', v);
    }

    // <title> + meta description
    var titleVal = dict['meta.title'] || fb['meta.title'];
    if (titleVal) document.title = titleVal;

    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      var descVal = dict['meta.description'] || fb['meta.description'];
      if (descVal) metaDesc.setAttribute('content', descVal);
    }

    // html lang attribute
    document.documentElement.lang = currentLang;

    // highlight active lang button
    var btns = document.querySelectorAll('.lang-btn');
    for (var i = 0; i < btns.length; i++) {
      var bl = btns[i].textContent.trim().toLowerCase();
      btns[i].classList.toggle('active', bl === currentLang);
    }

    // fire custom event so dynamic JS can react
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: currentLang } }));

    // Remove FOUC-prevention style (added by inline <head> script)
    var flashStyle = document.getElementById('i18n-flash-prevent');
    if (flashStyle) flashStyle.remove();
    if (document.body) document.body.style.opacity = '';
  }

  /* ── public API ── */
  window.setLang = function (lang, isExplicit) {
    lang = (lang || '').toLowerCase();
    if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT_LANG;
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      if (isExplicit) localStorage.setItem(EXPLICIT_KEY, lang);
    } catch (e) {}

    loadDict(DEFAULT_LANG, function () {
      if (lang === DEFAULT_LANG) {
        applyTranslations(cache[DEFAULT_LANG]);
      } else {
        loadDict(lang, function (dict) {
          applyTranslations(dict);
        });
      }
    });
  };

  window.t = function (key, fallback) {
    var dict = cache[currentLang] || {};
    var fb = cache[DEFAULT_LANG] || {};
    return dict[key] || fb[key] || fallback || key;
  };

  window.getLang = function () {
    return currentLang;
  };

  /* ── auto-detect browser language from OS settings ── */
  var EXPLICIT_KEY = 'na_lang_explicit'; // only set when user clicks a lang button

  function detectInitialLang() {
    // 1. Honour explicit user choice (clicking a lang button)
    try {
      var explicit = localStorage.getItem(EXPLICIT_KEY);
      if (explicit && SUPPORTED.indexOf(explicit) !== -1) return explicit;
    } catch (e) {}
    // 2. Honour a previously persisted choice (browser- or geo-detected).
    //    This makes repeat visits instant — no flash, no re-probe.
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;
    } catch (e) {}
    // 3. No browser-language / geo detection. EN is always the default on a
    //    first visit — only an explicit click (step 1) or a persisted choice
    //    (step 2) deviates from English.
    return INITIAL_LANG;
  }

  /* ── one-time geo-IP override ──────────────────────────────────────────
   * Default display language is English. For visitors whose browser carries
   * no RU/ES signal, we run a single lightweight country lookup and, if they
   * are in a Russian- or Spanish-speaking region, switch through the very same
   * setLang() path a manual click uses (identical re-render + fade). The result
   * is persisted (STORAGE_KEY) so the probe never repeats. Fails silently and
   * leaves English in place on any network/parse error. */
  var GEO_LANG_BY_COUNTRY = {
    RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru', UA: 'ru', MD: 'ru', AM: 'ru', AZ: 'ru', UZ: 'ru', TJ: 'ru', TM: 'ru',
    ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', EC: 'es', GT: 'es', CU: 'es',
    BO: 'es', DO: 'es', HN: 'es', PY: 'es', SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es', PR: 'es'
  };

  function maybeGeoOverride() {
    // Only probe when detection fell through to the bare EN default (no explicit
    // choice, no prior stored value, no RU/ES browser signal) and we never have.
    if (!geoEligible || currentLang !== INITIAL_LANG) return;
    try {
      if (localStorage.getItem(EXPLICIT_KEY)) return;
      if (localStorage.getItem(GEO_KEY)) return;
    } catch (e) {}

    var done = false;
    var finish = function () {
      if (done) return; done = true;
      try { localStorage.setItem(GEO_KEY, '1'); } catch (e) {}
    };
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://ipapi.co/country/', true);
      xhr.timeout = 4000;
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        finish();
        if (xhr.status !== 200) return;
        var cc = (xhr.responseText || '').trim().toUpperCase().slice(0, 2);
        var geoLang = GEO_LANG_BY_COUNTRY[cc];
        // Only override if still on the untouched English default.
        if (geoLang && geoLang !== currentLang &&
            (function () { try { return !localStorage.getItem(EXPLICIT_KEY); } catch (e) { return true; } })()) {
          window.setLang(geoLang, false); // same animated re-render as a click; persists choice
        }
      };
      xhr.ontimeout = xhr.onerror = finish;
      xhr.send();
    } catch (e) { finish(); }
  }

  /* ── init ── */
  function init() {
    currentLang = detectInitialLang();
    // Persist the resolved language so subsequent visits apply it instantly
    // (the inline <head> script reads STORAGE_KEY to avoid a flash of RU).
    try {
      if (!localStorage.getItem(EXPLICIT_KEY)) localStorage.setItem(STORAGE_KEY, currentLang);
    } catch (e) {}

    // bind lang-switch buttons
    var btns = document.querySelectorAll('.lang-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        window.setLang(this.textContent.trim().toLowerCase(), true);
      });
    }

    // load dicts and apply
    loadDict(DEFAULT_LANG, function () {
      if (currentLang === DEFAULT_LANG) {
        applyTranslations(cache[DEFAULT_LANG]);
        ready = true;
        maybeGeoOverride();
      } else {
        loadDict(currentLang, function (dict) {
          applyTranslations(dict);
          ready = true;
          maybeGeoOverride();
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
