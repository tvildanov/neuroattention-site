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
  var DEFAULT_LANG = 'ru';
  var SUPPORTED = ['ru', 'en', 'es'];
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
    // 2. Auto-detect from OS / browser language settings
    var browserLangs = navigator.languages || [navigator.language || 'en'];
    for (var i = 0; i < browserLangs.length; i++) {
      var code = browserLangs[i].toLowerCase().slice(0, 2);
      if (SUPPORTED.indexOf(code) !== -1) return code;
    }
    return 'en'; // international fallback
  }

  /* ── init ── */
  function init() {
    currentLang = detectInitialLang();

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
      } else {
        loadDict(currentLang, function (dict) {
          applyTranslations(dict);
          ready = true;
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
