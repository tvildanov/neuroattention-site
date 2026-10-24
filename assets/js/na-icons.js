/* NeuroAttention icon set — stroke SVGs in the pre-login (index) glass style.
 * Replaces phone-emoji chrome in LK tools / exercises / External Field.
 * Usage: NAIcons.svg('sun', { size: 18, color: 'currentColor' })
 *        NAIcons.html('corsi')  // ready-to-inject markup
 */
(function (global) {
  var PATHS = {
    // categories
    attention: 'M12 5a7 7 0 0 1 7 7c0 3.5-2.5 6.5-7 9-4.5-2.5-7-5.5-7-9a7 7 0 0 1 7-7zm0 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
    memory: 'M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8zm2-3h12l1 3H5l1-3zm3 7h6',
    executive: 'M7 7h4v4H7zm6 0h4v4h-4zM7 13h4v4H7zm6 6 4-4 4 4',
    inhibition: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm-4.2 4.2 8.4 8.4',
    speed: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
    screening: 'M9 3h6v4H9zm-1 4h8l1 14H7L8 7zm4 4v6m-3-3h6',
    brain: 'M9.5 4A3.5 3.5 0 0 1 13 7.5v9a3.5 3.5 0 0 1-6.9.6 3.5 3.5 0 0 1-2.8-4.3 4 4 0 0 1-.3-5.5A3.5 3.5 0 0 1 9.5 4zm5 0A3.5 3.5 0 0 0 11 7.5v9a3.5 3.5 0 0 0 6.9.6 3.5 3.5 0 0 0 2.8-4.3 4 4 0 0 0 .3-5.5A3.5 3.5 0 0 0 14.5 4z',
    warn: 'M12 3 2 20h20L12 3zm0 6v5m0 3h.01',
    // exercises
    'n-back': 'M4 7h6l-1 3h4l-1 3h6M8 17h8',
    stroop: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0v18M3 12h18',
    ant: 'M5 12h12m-4-5 5 5-5 5M3 7v10',
    sart: 'M12 6v6l4 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    corsi: 'M4 10h6v6H4zm7-3h6v6h-6zm3 7h6v6h-6z',
    'digit-span': 'M7 4h4v16H7zm6 0h4v10h-4z',
    'go-no-go': 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm-3 9h6',
    'task-switching': 'M7 7h7l-2-2m2 2-2 2M17 17H10l2 2m-2-2 2-2M7 17V7m10 0v10',
    'trail-making': 'M5 19c4-8 6-8 10-2 2 3 3 3 4 2M8 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm8 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    'attentional-blink': 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    'phq-9': 'M12 4v4m0 12a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-3.5-6.5c.5 1.5 2 2.5 3.5 2.5s3-1 3.5-2.5',
    'gad-7': 'M12 3 3 20h18L12 3zm0 6v5m0 3h.01',
    'asrs-v1-1': 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
    'pcl-5': 'M12 3 4 6v6c0 5 3.5 8.5 8 9.5 4.5-1 8-4.5 8-9.5V6l-8-3z',
    mdq: 'M3 12c2-6 4-8 9-8s7 2 9 8c-2 6-4 8-9 8s-7-2-9-8zm9-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    'aq-10': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-1 5h2v2h-2zm0 4h2v6h-2z',
    // external field / chrome
    sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-4v2m0 14v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4m12.8-12.8 1.4-1.4',
    moon: 'M15 3.5A8.5 8.5 0 1 0 20.5 15 7 7 0 0 1 15 3.5z',
    earth: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM2 12h20M12 3c2.5 2.8 4 6 4 9s-1.5 6.2-4 9c-2.5-2.8-4-6-4-9s1.5-6.2 4-9z',
    weather: 'M7 16a4 4 0 1 1 1.2-7.8A5.5 5.5 0 0 1 20 11a3.5 3.5 0 0 1-1 6.9H7zm1 3v2m4-1v2m4-2v2',
    social: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM2 12h20M12 3c3 3 5.5 4 5.5 9S15 21 12 21 6.5 17 6.5 12 9 3 12 3z',
    cosmos: 'M12 2l1.4 4.2L18 7.5l-3.6 2.8L15.5 15 12 12.6 8.5 15l1.1-4.7L6 7.5l4.6-1.3L12 2z',
    experimental: 'M13 2 4 14h7l-1 8 9-12h-7l1-8z',
    gear: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 2v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4m12.8-12.8 1.4-1.4',
    calendar: 'M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    sunset: 'M4 18h16M6 14a6 6 0 0 1 12 0M12 4v4m-5 1 1.5 1.5M17 9l-1.5 1.5',
    check: 'M20 6 9 17l-5-5',
    party: 'M12 3v4m0 10v4M4.5 7.5l2.5 2.5m10 0 2.5-2.5M3 14h4m10 0h4M8 18l2-6 2 3 2-5 2 8',
    // Internal Field / atlas chrome
    anatomy: 'M12 3c2 2 3 4.5 3 7.5S14 17 12 21c-2-4-3-7.5-3-10.5S10 5 12 3zm0 7.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    heart: 'M12 21s-7-4.4-9.5-8.2C.4 9.6 2.1 5.5 6 5c2 0 3.4 1.2 4 2.2C10.6 6.2 12 5 14 5c3.9.5 5.6 4.6 3.5 7.8C19 16.6 12 21 12 21z',
    conditions: 'M9 3h6v4H9zm-1 4h8l1 14H7L8 7zm4 4v6m-3-3h6',
    pills: 'M8.5 8.5a4 4 0 0 1 5.7 5.7L9.3 19a4 4 0 1 1-5.7-5.7l5-5zm2.1 2.1 5 5',
    diet: 'M12 3c-2 3-4 5-4 8a4 4 0 0 0 8 0c0-3-2-5-4-8zm-5 16h10',
    pin: 'M12 22s7-5.5 7-12a7 7 0 1 0-14 0c0 6.5 7 12 7 12zm0-9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    skeleton: 'M12 3a3 3 0 0 1 1 5.8V11h2v2h-2v2h2v2h-2v3h-2v-3H9v-2h2v-2H9v-2h2V8.8A3 3 0 0 1 12 3z',
    muscles: 'M7 8c0-2 1.5-4 5-4s5 2 5 4c0 2-1 3-2 4l2 2v4h-3v-3l-2-2-2 2v3H7v-4l2-2c-1-1-2-2-2-4z',
    library: 'M4 4h5v16H4zm7 0h9v16h-9zM8 8h1M8 12h1M15 8h3M15 12h3',
    sport: 'M6.5 6.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM4 22l3-8 3 3 4-9 4 2'
  };

  function svg(name, opts) {
    opts = opts || {};
    var size = opts.size || 20;
    var color = opts.color || 'currentColor';
    var path = PATHS[name] || PATHS.brain;
    var cls = opts.className ? ' class="' + opts.className + '"' : '';
    return '<svg' + cls + ' width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color +
      '" stroke-width="' + (opts.strokeWidth || 1.75) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="' + path + '"/></svg>';
  }

  function html(name, opts) {
    opts = opts || {};
    var wrapCls = opts.wrapClass || 'na-ic';
    return '<span class="' + wrapCls + '" data-ic="' + name + '">' + svg(name, opts) + '</span>';
  }

  global.NAIcons = { paths: PATHS, svg: svg, html: html };
})(typeof window !== 'undefined' ? window : globalThis);
