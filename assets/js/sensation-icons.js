/* ============================================================================
   sensation-icons.js — PR4 (4.2 / 4.3)

   Minimalist, monochrome (currentColor), thin-line inline SVG icons for the
   Sensation Map: one per sensation family and one per body region. Plus the
   body-part hierarchy (4.3) used to expand a region into detailed sub-parts.

   Exposes (on window):
     SENS_ICON(slug)        → svg string for a sensation
     BODY_ICON(slug)        → svg string for a body location
     ICON_BY_KEY(key)       → svg string for an icon key (user-add picker)
     SENS_ICON_KEYS         → [keys] offered in the add-sensation icon picker
     BODY_HIERARCHY         → { parentSlug: { icon, children:[{slug,ru,en,es}] } }
   All svgs are 18×18, stroke=currentColor, fill=none — they inherit text colour.
   ============================================================================ */
(function () {
  'use strict';

  function svg(inner) {
    return '<svg class="sm-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" style="flex:none;vertical-align:middle;">' + inner + '</svg>';
  }

  // ── icon library (by key) ────────────────────────────────────────────────
  var ICONS = {
    flame:   svg('<path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C9 11 12 9 12 3z"/>'),
    snow:    svg('<path d="M12 3v18M5 7l14 10M19 7L5 17"/>'),
    pressure:svg('<path d="M5 9l7-5 7 5"/><path d="M5 15l7-5 7 5"/>'),
    weight:  svg('<path d="M8 4h8l2 16H6z"/><path d="M9 8h6"/>'),
    light:   svg('<path d="M12 21V8"/><path d="M7 12l5-5 5 5"/><path d="M6 4h12"/>'),
    pulse:   svg('<path d="M2 12h4l2-6 4 12 2-6h8"/>'),
    bolt:    svg('<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>'),
    spark:   svg('<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4"/>'),
    expand:  svg('<path d="M8 8L3 3M3 8V3h5M16 16l5 5M21 16v5h-5"/><circle cx="12" cy="12" r="3"/>'),
    contract:svg('<path d="M4 4l5 5M9 4H4v5M20 20l-5-5M15 20h5v-5"/><circle cx="12" cy="12" r="2"/>'),
    dots:    svg('<circle cx="6" cy="8" r="1"/><circle cx="12" cy="6" r="1"/><circle cx="18" cy="9" r="1"/><circle cx="8" cy="15" r="1"/><circle cx="15" cy="16" r="1"/><circle cx="12" cy="12" r="1"/>'),
    wave:    svg('<path d="M2 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>'),
    drop:    svg('<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>'),
    deepen:  svg('<path d="M12 3v14M7 12l5 5 5-5"/><path d="M5 21h14"/>'),
    soft:    svg('<path d="M5 14c0-5 3-8 7-8s7 3 7 8c0 2-2 3-4 3H9c-2 0-4-1-4-3z"/>'),
    dry:     svg('<path d="M4 12h4l1-3 2 6 2-9 2 6 1-0h4"/>'),
    // body regions
    head:    svg('<circle cx="12" cy="8" r="5"/><path d="M8 20c0-3 1.8-5 4-5s4 2 4 5"/>'),
    neck:    svg('<path d="M9 4v4c0 2-1 3-3 4M15 4v4c0 2 1 3 3 4"/><path d="M8 20h8"/>'),
    arm:     svg('<path d="M7 4l3 7-1 9"/><path d="M10 11l5 2 3 7"/>'),
    hand:    svg('<path d="M8 13V5M11 13V4M14 13V5M17 14v-3"/><path d="M8 13c-2 1-2 4 0 6l2 2h5c2 0 3-2 3-4v-3"/>'),
    leg:     svg('<path d="M10 3l-1 9 1 9"/><path d="M14 3l1 9-2 9"/>'),
    foot:    svg('<path d="M9 4v9"/><path d="M9 13c-3 0-4 3-1 5l3 2h4c2 0 2-2 1-4l-3-3"/>'),
    chest:   svg('<path d="M4 7c3-2 13-2 16 0v4c0 4-3 7-8 9-5-2-8-5-8-9z"/>'),
    belly:   svg('<circle cx="12" cy="12" r="8"/><path d="M12 8c-2 1-2 3 0 4s2 3 0 4"/>'),
    back:    svg('<path d="M12 3v18"/><path d="M9 6h6M8 10h8M8 14h8M9 18h6"/>'),
    pelvis:  svg('<path d="M4 7c2 6 6 7 8 7s6-1 8-7"/><path d="M4 7v3M20 7v3"/>'),
    organ:   svg('<path d="M12 6c-2-3-7-2-7 3 0 4 7 9 7 9s7-5 7-9c0-5-5-6-7-3z"/>'),
    body:    svg('<circle cx="12" cy="5" r="2.5"/><path d="M12 8v8M7 11l5-2 5 2M9 21l3-5 3 5"/>'),
    pin:     svg('<path d="M12 21s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>')
  };

  // ── sensation slug → icon key ─────────────────────────────────────────────
  var SENS_MAP = {
    heat: 'flame', warmth: 'flame',
    coolness: 'snow', cold: 'snow',
    pressure: 'pressure', heaviness: 'weight', weight: 'weight', density: 'weight', hardness: 'weight',
    lightness: 'light',
    pulsation: 'pulse', vibration: 'pulse', electric_like: 'bolt', tingling: 'dots', tickling: 'dots',
    pain: 'spark',
    swelling: 'expand', expanding: 'expand', broadening: 'expand',
    shrinking: 'contract', narrowing: 'contract',
    flowing: 'wave', seeping: 'drop', moisture: 'drop', permeability: 'wave',
    deepening: 'deepen', softness: 'soft', dryness: 'dry'
  };

  // ── body slug → icon key ─────────────────────────────────────────────────
  var BODY_MAP = {
    head: 'head', crown: 'head', face: 'head', eyes: 'head', ears: 'head', mouth: 'head', teeth: 'head', chin: 'head',
    brain: 'head', mid_brain: 'head', brain_surface: 'head', above_head: 'head',
    neck: 'neck',
    right_arm: 'arm', left_arm: 'arm',
    right_palm: 'hand', left_palm: 'hand', right_hand_fingers: 'hand', left_hand_fingers: 'hand', hand_fingertips: 'hand',
    right_leg: 'leg', left_leg: 'leg', thighs: 'leg', shins: 'leg', knees: 'leg',
    right_foot_toes: 'foot', left_foot_toes: 'foot', foot_fingertips: 'foot', under_feet: 'foot',
    chest: 'chest', lungs: 'chest', heart: 'organ',
    belly: 'belly', stomach: 'belly',
    back: 'back', spine: 'back', sacrum: 'back', coccyx: 'back', behind_back: 'back',
    pelvis: 'pelvis', perineum: 'pelvis',
    body: 'body', whole_body: 'body', front_body: 'body'
  };

  // ── body-part hierarchy (4.3) — region → detailed sub-parts ───────────────
  // Slugs are namespaced parent__child so detailed entries never collide with
  // the flat seeded vocab. The backend stores them verbatim (loc_labels carries
  // the RU label). Children are localized RU/EN/ES.
  function legKids(p) {
    return [
      { slug: p + '__foot',  ru: 'Стопа',  en: 'Foot',  es: 'Pie' },
      { slug: p + '__toes',  ru: 'Пальцы ног', en: 'Toes', es: 'Dedos del pie' },
      { slug: p + '__shin',  ru: 'Голень', en: 'Shin',  es: 'Espinilla' },
      { slug: p + '__knee',  ru: 'Колено', en: 'Knee',  es: 'Rodilla' },
      { slug: p + '__thigh', ru: 'Бедро',  en: 'Thigh', es: 'Muslo' },
      { slug: p + '__hip',   ru: 'Тазобедренный сустав', en: 'Hip joint', es: 'Articulación de la cadera' }
    ];
  }
  function armKids(p) {
    return [
      { slug: p + '__hand',     ru: 'Кисть',   en: 'Hand',     es: 'Mano' },
      { slug: p + '__fingers',  ru: 'Пальцы',  en: 'Fingers',  es: 'Dedos' },
      { slug: p + '__wrist',    ru: 'Запястье', en: 'Wrist',   es: 'Muñeca' },
      { slug: p + '__forearm',  ru: 'Предплечье', en: 'Forearm', es: 'Antebrazo' },
      { slug: p + '__elbow',    ru: 'Локоть',  en: 'Elbow',    es: 'Codo' },
      { slug: p + '__upperarm', ru: 'Плечо',   en: 'Upper arm', es: 'Brazo' },
      { slug: p + '__shoulder', ru: 'Плечевой сустав', en: 'Shoulder joint', es: 'Articulación del hombro' }
    ];
  }
  // hand fingers — parent label already says which hand (right/left)
  function handFingerKids(p) {
    return [
      { slug: p + '__thumb',  ru: 'Большой',      en: 'Thumb',  es: 'Pulgar' },
      { slug: p + '__index',  ru: 'Указательный', en: 'Index',  es: 'Índice' },
      { slug: p + '__middle', ru: 'Средний',      en: 'Middle', es: 'Medio' },
      { slug: p + '__ring',   ru: 'Безымянный',   en: 'Ring',   es: 'Anular' },
      { slug: p + '__pinky',  ru: 'Мизинец',      en: 'Pinky',  es: 'Meñique' }
    ];
  }
  // foot toes — parent label already says which foot (right/left)
  function footToeKids(p) {
    return [
      { slug: p + '__big',    ru: 'Большой палец', en: 'Big toe',    es: 'Dedo gordo' },
      { slug: p + '__second', ru: 'Второй',        en: 'Second toe', es: 'Segundo dedo' },
      { slug: p + '__middle', ru: 'Средний',       en: 'Middle toe', es: 'Dedo medio' },
      { slug: p + '__fourth', ru: 'Четвёртый',     en: 'Fourth toe', es: 'Cuarto dedo' },
      { slug: p + '__little', ru: 'Мизинец',       en: 'Little toe', es: 'Dedo pequeño' }
    ];
  }
  var BODY_HIERARCHY = {
    head: { icon: 'head', children: [
      { slug: 'head__forehead', ru: 'Лоб',     en: 'Forehead', es: 'Frente' },
      { slug: 'head__temples',  ru: 'Виски',   en: 'Temples',  es: 'Sienes' },
      { slug: 'head__occiput',  ru: 'Затылок', en: 'Occiput',  es: 'Occipucio' },
      { slug: 'head__crown',    ru: 'Темя',    en: 'Crown',    es: 'Coronilla' },
      { slug: 'head__face',     ru: 'Лицо',    en: 'Face',     es: 'Rostro' },
      { slug: 'head__jaw',      ru: 'Челюсть', en: 'Jaw',      es: 'Mandíbula' },
      { slug: 'head__neck',     ru: 'Шея',     en: 'Neck',     es: 'Cuello' }
    ] },
    right_leg: { icon: 'leg', children: legKids('right_leg') },
    left_leg:  { icon: 'leg', children: legKids('left_leg') },
    right_arm: { icon: 'arm', children: armKids('right_arm') },
    left_arm:  { icon: 'arm', children: armKids('left_arm') },
    back: { icon: 'back', children: [
      { slug: 'back__cervical',   ru: 'Шейный отдел',     en: 'Cervical spine',  es: 'Zona cervical' },
      { slug: 'back__thoracic',   ru: 'Грудной отдел',    en: 'Thoracic spine',  es: 'Zona torácica' },
      { slug: 'back__lumbar',     ru: 'Поясничный отдел', en: 'Lumbar spine',    es: 'Zona lumbar' },
      { slug: 'back__scapula_l',  ru: 'Лопатка (левая)',  en: 'Left scapula',    es: 'Escápula izquierda' },
      { slug: 'back__scapula_r',  ru: 'Лопатка (правая)', en: 'Right scapula',   es: 'Escápula derecha' },
      { slug: 'back__sacrum',     ru: 'Крестец',          en: 'Sacrum',          es: 'Sacro' }
    ] },
    chest: { icon: 'chest', children: [
      { slug: 'chest__ribcage_l', ru: 'Грудная клетка (лево)', en: 'Ribcage (left)',  es: 'Caja torácica (izq.)' },
      { slug: 'chest__ribcage_r', ru: 'Грудная клетка (право)', en: 'Ribcage (right)', es: 'Caja torácica (der.)' },
      { slug: 'chest__solar',     ru: 'Солнечное сплетение', en: 'Solar plexus', es: 'Plexo solar' },
      { slug: 'chest__belly_up',  ru: 'Живот (верх)',    en: 'Upper belly',  es: 'Vientre (arriba)' },
      { slug: 'chest__belly_mid', ru: 'Живот (середина)', en: 'Mid belly',   es: 'Vientre (medio)' },
      { slug: 'chest__belly_low', ru: 'Живот (низ)',     en: 'Lower belly',  es: 'Vientre (abajo)' },
      { slug: 'chest__side_l',    ru: 'Бок (левый)',     en: 'Side (left)',  es: 'Costado (izq.)' },
      { slug: 'chest__side_r',    ru: 'Бок (правый)',    en: 'Side (right)', es: 'Costado (der.)' },
      { slug: 'chest__heart',     ru: 'Сердце',  en: 'Heart',     es: 'Corazón' },
      { slug: 'chest__lungs',     ru: 'Лёгкие',  en: 'Lungs',     es: 'Pulmones' },
      { slug: 'chest__stomach',   ru: 'Желудок', en: 'Stomach',   es: 'Estómago' },
      { slug: 'chest__intestine', ru: 'Кишечник', en: 'Intestines', es: 'Intestinos' }
    ] },
    body: { icon: 'body', children: [
      { slug: 'body__front', ru: 'Передняя сторона', en: 'Front',      es: 'Lado frontal' },
      { slug: 'body__back',  ru: 'Задняя сторона',   en: 'Back',       es: 'Lado posterior' },
      { slug: 'body__left',  ru: 'Левая сторона',    en: 'Left side',  es: 'Lado izquierdo' },
      { slug: 'body__right', ru: 'Правая сторона',   en: 'Right side', es: 'Lado derecho' },
      { slug: 'body__upper', ru: 'Верх',             en: 'Upper',      es: 'Parte superior' },
      { slug: 'body__lower', ru: 'Низ',              en: 'Lower',      es: 'Parte inferior' }
    ] },
    belly: { icon: 'belly', children: [
      { slug: 'belly__solar', ru: 'Верх (солнечное сплетение)', en: 'Upper (solar plexus)', es: 'Arriba (plexo solar)' },
      { slug: 'belly__mid',   ru: 'Середина',      en: 'Middle',     es: 'Medio' },
      { slug: 'belly__low',   ru: 'Низ',           en: 'Lower',      es: 'Abajo' },
      { slug: 'belly__left',  ru: 'Левая сторона', en: 'Left side',  es: 'Lado izquierdo' },
      { slug: 'belly__right', ru: 'Правая сторона', en: 'Right side', es: 'Lado derecho' }
    ] },
    neck: { icon: 'neck', children: [
      { slug: 'neck__front', ru: 'Передняя', en: 'Front', es: 'Frente' },
      { slug: 'neck__back',  ru: 'Задняя',   en: 'Back',  es: 'Nuca' },
      { slug: 'neck__left',  ru: 'Левая',    en: 'Left',  es: 'Izquierda' },
      { slug: 'neck__right', ru: 'Правая',   en: 'Right', es: 'Derecha' },
      { slug: 'neck__base',  ru: 'Основание (плечевой пояс)', en: 'Base (shoulders)', es: 'Base (hombros)' }
    ] },
    brain: { icon: 'head', children: [
      { slug: 'brain__frontal',    ru: 'Лобная область',    en: 'Frontal',          es: 'Frontal' },
      { slug: 'brain__temporal_l', ru: 'Височная (лево)',   en: 'Temporal (left)',  es: 'Temporal (izq.)' },
      { slug: 'brain__temporal_r', ru: 'Височная (право)',  en: 'Temporal (right)', es: 'Temporal (der.)' },
      { slug: 'brain__occipital',  ru: 'Затылочная',        en: 'Occipital',        es: 'Occipital' },
      { slug: 'brain__parietal',   ru: 'Теменная',          en: 'Parietal',         es: 'Parietal' }
    ] },
    right_hand_fingers: { icon: 'hand', children: handFingerKids('right_hand_fingers') },
    left_hand_fingers:  { icon: 'hand', children: handFingerKids('left_hand_fingers') },
    right_foot_toes:    { icon: 'foot', children: footToeKids('right_foot_toes') },
    left_foot_toes:     { icon: 'foot', children: footToeKids('left_foot_toes') }
  };

  // icon keys offered to the user when adding a custom sensation
  var SENS_ICON_KEYS = ['flame','snow','pressure','weight','light','pulse','bolt','spark','expand','contract','dots','wave','drop','deepen','soft','dry'];

  window.SENS_ICON = function (slug) { return ICONS[SENS_MAP[slug]] || ICONS.dots; };
  window.BODY_ICON = function (slug) {
    if (BODY_MAP[slug]) return ICONS[BODY_MAP[slug]];
    var parent = String(slug || '').split('__')[0];
    return ICONS[(BODY_HIERARCHY[parent] && BODY_HIERARCHY[parent].icon)] || ICONS.pin;
  };
  window.ICON_BY_KEY = function (key) { return ICONS[key] || ICONS.dots; };
  window.SENS_ICON_KEYS = SENS_ICON_KEYS;
  window.BODY_HIERARCHY = BODY_HIERARCHY;
})();
