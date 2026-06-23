/* ============================================================================
   body-picker.js — PR6: interactive body graphic for the Sensation Map.

   Two side-by-side blueprint silhouettes (front + back). Hovering (desktop) or
   tapping (mobile) a region highlights it (glow + slight scale), shows its label,
   and opens a floating list of sub-part buttons. Clicking a sub-button calls
   onSelect(slug, {ru,en,es}).

   Public: window.mountBodyPicker(container, onSelect, opts)
     opts.gender : 'male' | 'female' | … (MVP renders the male silhouette)
     opts.lang   : 'ru' | 'en' | 'es'

   MVP scope (per Nick): male front+back, base regions head/neck/chest/belly/
   lower-back/arms/legs + a general internal-organs region. Female silhouette and
   per-finger detail are a follow-up.
   ============================================================================ */
(function () {
  'use strict';

  function L(o, lang) { return (o && (o[lang] || o.ru)) || ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // sub-part dictionaries (slugs are namespaced bp__view__region__part so they
  // never collide with the seeded flat vocab; labels carried for the save path)
  function P(slug, ru, en, es) { return { slug: slug, ru: ru, en: en, es: es }; }

  // ── FRONT regions ──────────────────────────────────────────────────────────
  var FRONT = {
    head: { label: { ru: 'Голова', en: 'Head', es: 'Cabeza' }, sub: [
      P('bp_head_f_forehead', 'Лоб', 'Forehead', 'Frente'),
      P('bp_head_f_eyes', 'Глаза', 'Eyes', 'Ojos'),
      P('bp_head_f_nose', 'Нос', 'Nose', 'Nariz'),
      P('bp_head_f_mouth', 'Рот', 'Mouth', 'Boca'),
      P('bp_head_f_lips', 'Губы', 'Lips', 'Labios'),
      P('bp_head_f_tongue', 'Язык', 'Tongue', 'Lengua'),
      P('bp_head_f_teeth', 'Зубы', 'Teeth', 'Dientes'),
      P('bp_head_f_jaw_up', 'Верхняя челюсть', 'Upper jaw', 'Mandíbula superior'),
      P('bp_head_f_jaw_lo', 'Нижняя челюсть', 'Lower jaw', 'Mandíbula inferior'),
      P('bp_head_f_brain', 'Мозг (общее)', 'Brain (general)', 'Cerebro (general)') ] },
    neck: { label: { ru: 'Шея', en: 'Neck', es: 'Cuello' }, sub: [
      P('bp_neck_f_throat', 'Горло', 'Throat', 'Garganta'),
      P('bp_neck_f_front', 'Передняя часть шеи', 'Front of neck', 'Frente del cuello'),
      P('bp_neck_f_clavicle', 'Ключицы', 'Collarbones', 'Clavículas') ] },
    chest: { label: { ru: 'Грудная клетка', en: 'Chest', es: 'Pecho' }, sub: [
      P('bp_chest_f_upper', 'Верх (под ключицами)', 'Upper (under collarbones)', 'Arriba (bajo clavículas)'),
      P('bp_chest_f_sternum', 'Середина (грудина)', 'Middle (sternum)', 'Centro (esternón)'),
      P('bp_chest_f_under', 'Под грудью', 'Under chest', 'Bajo el pecho'),
      P('bp_chest_f_left', 'Левая половина', 'Left half', 'Mitad izquierda'),
      P('bp_chest_f_right', 'Правая половина', 'Right half', 'Mitad derecha') ] },
    belly: { label: { ru: 'Живот', en: 'Belly', es: 'Vientre' }, sub: [
      P('bp_belly_f_solar', 'Верх (солнечное сплетение)', 'Upper (solar plexus)', 'Arriba (plexo solar)'),
      P('bp_belly_f_navel', 'Середина (пупок)', 'Middle (navel)', 'Centro (ombligo)'),
      P('bp_belly_f_lower', 'Низ', 'Lower', 'Abajo'),
      P('bp_belly_f_left', 'Левый бок', 'Left side', 'Costado izquierdo'),
      P('bp_belly_f_right', 'Правый бок', 'Right side', 'Costado derecho') ] },
    organs: { label: { ru: 'Внутренние органы', en: 'Internal organs', es: 'Órganos internos' }, sub: [
      P('bp_org_heart', 'Сердце', 'Heart', 'Corazón'),
      P('bp_org_lungs', 'Лёгкие', 'Lungs', 'Pulmones'),
      P('bp_org_stomach', 'Желудок', 'Stomach', 'Estómago'),
      P('bp_org_intestine', 'Кишечник', 'Intestines', 'Intestinos'),
      P('bp_org_liver', 'Печень', 'Liver', 'Hígado'),
      P('bp_org_kidneys', 'Почки', 'Kidneys', 'Riñones') ] },
    pelvis: { label: { ru: 'Таз', en: 'Pelvis', es: 'Pelvis' }, sub: [
      P('bp_pelvis_f_pubic', 'Лобковая область', 'Pubic area', 'Zona púbica'),
      P('bp_pelvis_f_hip_l', 'Тазобедренный сустав (лево)', 'Hip joint (left)', 'Cadera (izq.)'),
      P('bp_pelvis_f_hip_r', 'Тазобедренный сустав (право)', 'Hip joint (right)', 'Cadera (der.)') ] },
    arm_l: { label: { ru: 'Левая рука', en: 'Left arm', es: 'Brazo izquierdo' }, sub: [
      P('bp_arm_l_shoulder', 'Плечевой сустав', 'Shoulder joint', 'Hombro'),
      P('bp_arm_l_upper', 'Плечо', 'Upper arm', 'Brazo'),
      P('bp_arm_l_elbow', 'Локоть', 'Elbow', 'Codo'),
      P('bp_arm_l_forearm', 'Предплечье', 'Forearm', 'Antebrazo'),
      P('bp_arm_l_wrist', 'Запястье', 'Wrist', 'Muñeca'),
      P('bp_arm_l_hand', 'Кисть', 'Hand', 'Mano'),
      P('bp_arm_l_fingers', 'Пальцы', 'Fingers', 'Dedos') ] },
    arm_r: { label: { ru: 'Правая рука', en: 'Right arm', es: 'Brazo derecho' }, sub: [
      P('bp_arm_r_shoulder', 'Плечевой сустав', 'Shoulder joint', 'Hombro'),
      P('bp_arm_r_upper', 'Плечо', 'Upper arm', 'Brazo'),
      P('bp_arm_r_elbow', 'Локоть', 'Elbow', 'Codo'),
      P('bp_arm_r_forearm', 'Предплечье', 'Forearm', 'Antebrazo'),
      P('bp_arm_r_wrist', 'Запястье', 'Wrist', 'Muñeca'),
      P('bp_arm_r_hand', 'Кисть', 'Hand', 'Mano'),
      P('bp_arm_r_fingers', 'Пальцы', 'Fingers', 'Dedos') ] },
    leg_l: { label: { ru: 'Левая нога', en: 'Left leg', es: 'Pierna izquierda' }, sub: [
      P('bp_leg_l_thigh', 'Бедро', 'Thigh', 'Muslo'),
      P('bp_leg_l_knee', 'Колено', 'Knee', 'Rodilla'),
      P('bp_leg_l_shin', 'Голень', 'Shin', 'Espinilla'),
      P('bp_leg_l_ankle', 'Лодыжка', 'Ankle', 'Tobillo'),
      P('bp_leg_l_foot', 'Стопа', 'Foot', 'Pie'),
      P('bp_leg_l_toes', 'Пальцы ног', 'Toes', 'Dedos del pie') ] },
    leg_r: { label: { ru: 'Правая нога', en: 'Right leg', es: 'Pierna derecha' }, sub: [
      P('bp_leg_r_thigh', 'Бедро', 'Thigh', 'Muslo'),
      P('bp_leg_r_knee', 'Колено', 'Knee', 'Rodilla'),
      P('bp_leg_r_shin', 'Голень', 'Shin', 'Espinilla'),
      P('bp_leg_r_ankle', 'Лодыжка', 'Ankle', 'Tobillo'),
      P('bp_leg_r_foot', 'Стопа', 'Foot', 'Pie'),
      P('bp_leg_r_toes', 'Пальцы ног', 'Toes', 'Dedos del pie') ] }
  };
  // ── BACK regions ───────────────────────────────────────────────────────────
  var BACK = {
    head: { label: { ru: 'Затылок', en: 'Back of head', es: 'Nuca' }, sub: [
      P('bp_head_b_occiput', 'Затылок', 'Occiput', 'Occipucio'),
      P('bp_head_b_crown', 'Темя', 'Crown', 'Coronilla'),
      P('bp_head_b_ears', 'Область за ушами', 'Behind the ears', 'Detrás de las orejas'),
      P('bp_head_b_cervocc', 'Шейно-затылочный переход', 'Cervico-occipital junction', 'Unión cervico-occipital') ] },
    neck: { label: { ru: 'Шея (сзади)', en: 'Neck (back)', es: 'Cuello (atrás)' }, sub: [
      P('bp_neck_b_back', 'Задняя часть шеи', 'Back of neck', 'Nuca'),
      P('bp_neck_b_skullbase', 'Основание черепа', 'Skull base', 'Base del cráneo') ] },
    upper_back: { label: { ru: 'Верхняя часть спины', en: 'Upper back', es: 'Espalda alta' }, sub: [
      P('bp_uback_top', 'Верхняя часть спины', 'Upper back', 'Espalda alta'),
      P('bp_uback_scap_l', 'Лопатка (левая)', 'Scapula (left)', 'Escápula (izq.)'),
      P('bp_uback_scap_r', 'Лопатка (правая)', 'Scapula (right)', 'Escápula (der.)'),
      P('bp_uback_inter', 'Межлопаточная область', 'Interscapular area', 'Zona interescapular') ] },
    lower_back: { label: { ru: 'Поясница', en: 'Lower back', es: 'Zona lumbar' }, sub: [
      P('bp_lback_upper', 'Верхняя поясница', 'Upper lumbar', 'Lumbar alta'),
      P('bp_lback_lower', 'Нижняя поясница', 'Lower lumbar', 'Lumbar baja'),
      P('bp_lback_sacrum', 'Крестец', 'Sacrum', 'Sacro') ] },
    // Spinal column by segment — Nick's request; aligned with the 3D atlas
    // spine regions (cervical/thoracic/lumbar/sacral). New slugs = additive,
    // existing saved sensations are untouched.
    spine: { label: { ru: 'Позвоночник', en: 'Spine', es: 'Columna' }, sub: [
      P('bp_spine_b_cervical', 'Шейный отдел (C1–C7)', 'Cervical spine (C1–C7)', 'Columna cervical (C1–C7)'),
      P('bp_spine_b_thoracic', 'Грудной отдел (T1–T12)', 'Thoracic spine (T1–T12)', 'Columna torácica (T1–T12)'),
      P('bp_spine_b_lumbar', 'Поясничный отдел (L1–L5)', 'Lumbar spine (L1–L5)', 'Columna lumbar (L1–L5)'),
      P('bp_spine_b_sacral', 'Крестцовый отдел', 'Sacral spine', 'Columna sacra'),
      P('bp_spine_b_cord', 'Спинной мозг', 'Spinal cord', 'Médula espinal') ] },
    pelvis: { label: { ru: 'Таз (сзади)', en: 'Pelvis (back)', es: 'Pelvis (atrás)' }, sub: [
      P('bp_pelvis_b_glute_l', 'Ягодица (левая)', 'Buttock (left)', 'Glúteo (izq.)'),
      P('bp_pelvis_b_glute_r', 'Ягодица (правая)', 'Buttock (right)', 'Glúteo (der.)'),
      P('bp_pelvis_b_coccyx', 'Копчик', 'Tailbone', 'Cóccix') ] },
    arm_l: FRONT.arm_r, arm_r: FRONT.arm_l,           // mirrored when viewed from behind
    leg_l: { label: { ru: 'Левая нога (сзади)', en: 'Left leg (back)', es: 'Pierna izq. (atrás)' }, sub: [
      P('bp_leg_lb_thigh', 'Задняя поверхность бедра', 'Back of thigh', 'Parte posterior del muslo'),
      P('bp_leg_lb_knee', 'Подколенная область', 'Back of knee', 'Hueco poplíteo'),
      P('bp_leg_lb_calf', 'Икра', 'Calf', 'Pantorrilla'),
      P('bp_leg_lb_heel', 'Пятка', 'Heel', 'Talón') ] },
    leg_r: { label: { ru: 'Правая нога (сзади)', en: 'Right leg (back)', es: 'Pierna der. (atrás)' }, sub: [
      P('bp_leg_rb_thigh', 'Задняя поверхность бедра', 'Back of thigh', 'Parte posterior del muslo'),
      P('bp_leg_rb_knee', 'Подколенная область', 'Back of knee', 'Hueco poplíteo'),
      P('bp_leg_rb_calf', 'Икра', 'Calf', 'Pantorrilla'),
      P('bp_leg_rb_heel', 'Пятка', 'Heel', 'Talón') ] }
  };

  // Region hit-shapes over the silhouette (viewBox 0 0 120 300). Each is an SVG
  // path 'd' covering that body area; the wireframe outline is drawn underneath.
  var SHAPES = {
    head:       'M60 8 C72 8 78 18 78 30 C78 44 70 52 60 52 C50 52 42 44 42 30 C42 18 48 8 60 8 Z',
    neck:       'M52 52 H68 V64 H52 Z',
    chest:      'M40 64 H80 L82 110 H38 Z',
    belly:      'M40 110 H82 L80 150 H42 Z',
    organs:     'M52 78 H68 V140 H52 Z',
    pelvis:     'M42 150 H80 L74 178 H48 Z',
    upper_back: 'M40 64 H80 L82 112 H38 Z',
    lower_back: 'M42 112 H80 L78 152 H44 Z',
    arm_l:      'M34 66 L40 66 L36 150 L26 150 Z',
    arm_r:      'M80 66 L86 66 L94 150 L84 150 Z',
    leg_l:      'M48 178 H60 L56 292 H44 Z',
    leg_r:      'M60 178 H74 L78 292 H66 Z',
    // central vertical strip over the back — the spinal column (C4)
    spine:      'M56 62 H64 V160 H56 Z'
  };
  // draw order so smaller overlays (organs / spine) sit above the torso
  var FRONT_ORDER = ['arm_l', 'arm_r', 'leg_l', 'leg_r', 'chest', 'belly', 'pelvis', 'organs', 'neck', 'head'];
  var BACK_ORDER  = ['arm_l', 'arm_r', 'leg_l', 'leg_r', 'upper_back', 'lower_back', 'pelvis', 'spine', 'neck', 'head'];

  // wireframe humanoid outline (thin blueprint strokes)
  function silhouette() {
    return '<path d="M60 6 C73 6 80 17 80 31 C80 41 75 49 68 52 L70 60 ' +
      'C80 62 86 66 88 76 L96 150 L86 152 L80 96 L82 150 L80 182 ' +
      'L84 250 L80 294 L66 294 L62 200 L58 200 L54 294 L40 294 L36 250 ' +
      'L40 182 L38 150 L40 96 L34 152 L24 150 L32 76 C34 66 40 62 50 60 ' +
      'L52 52 C45 49 40 41 40 31 C40 17 47 6 60 6 Z" ' +
      'fill="none" stroke="rgba(120,210,255,0.55)" stroke-width="1.1"/>' +
      '<line x1="60" y1="60" x2="60" y2="180" stroke="rgba(120,210,255,0.18)" stroke-width="0.8"/>';
  }

  function buildView(viewKey, regions, order, lang) {
    var svg = '<svg viewBox="0 0 120 300" class="bp-svg" data-view="' + viewKey + '" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;overflow:visible;">';
    svg += '<g class="bp-wire">' + silhouette() + '</g>';
    order.forEach(function (rk) {
      if (!regions[rk] || !SHAPES[rk]) return;
      svg += '<path class="bp-region" data-region="' + rk + '" data-view="' + viewKey + '" d="' + SHAPES[rk] + '" ' +
        'fill="rgba(120,210,255,0.04)" stroke="rgba(120,210,255,0.25)" stroke-width="0.8" />';
    });
    svg += '</svg>';
    var title = viewKey === 'front'
      ? { ru: 'Спереди', en: 'Front', es: 'Frente' }
      : { ru: 'Сзади', en: 'Back', es: 'Atrás' };
    return '<div class="bp-view" data-view="' + viewKey + '">' +
      '<div class="bp-view-title">' + esc(L(title, lang)) + '</div>' +
      '<div class="bp-stage">' + svg + '<div class="bp-label" data-view="' + viewKey + '"></div>' +
      '<div class="bp-panel" data-view="' + viewKey + '"></div></div></div>';
  }

  window.mountBodyPicker = function (container, onSelect, opts) {
    opts = opts || {};
    var lang = opts.lang || (typeof window.getLang === 'function' ? window.getLang() : 'ru');
    var isTouch = window.matchMedia && window.matchMedia('(hover: none)').matches;
    container.classList.add('bp-root');
    container.innerHTML =
      '<div class="bp-grid">' +
        buildView('front', FRONT, FRONT_ORDER, lang) +
        buildView('back', BACK, BACK_ORDER, lang) +
      '</div>';

    function regionsFor(view) { return view === 'front' ? FRONT : BACK; }

    function closePanels(except) {
      container.querySelectorAll('.bp-panel.open').forEach(function (p) { if (p !== except) { p.classList.remove('open'); p.innerHTML = ''; } });
      container.querySelectorAll('.bp-region.active').forEach(function (r) { r.classList.remove('active'); });
      container.querySelectorAll('.bp-label.show').forEach(function (l) { l.classList.remove('show'); l.textContent = ''; });
    }

    // Track selected slugs (zone-level + sub-level) so the visual .picked state and
    // the re-opened panel buttons stay in sync across hover / open cycles.
    var pickedSet = {};

    // Hover (desktop): show the zone label near the region centroid. Crucially this
    // does NOT open the sub-region panel — that was the source of the cascade where
    // moving the mouse toward a far-below popup crossed neighbouring regions and
    // re-triggered them (B п.B). The CSS :hover glow gives the highlight feedback
    // (B п.C); the label just names what a click would select.
    function showLabel(regionEl) {
      var view = regionEl.getAttribute('data-view'), rk = regionEl.getAttribute('data-region');
      var reg = regionsFor(view)[rk]; if (!reg) return;
      var stage = regionEl.closest('.bp-stage');
      var label = stage.querySelector('.bp-label');
      label.textContent = L(reg.label, lang); label.classList.add('show');
      var bb = regionEl.getBBox(), svg = regionEl.ownerSVGElement, sr = svg.getBoundingClientRect(), str = stage.getBoundingClientRect();
      var cx = (bb.x + bb.width / 2) / 120 * sr.width + (sr.left - str.left);
      var cyTop = bb.y / 300 * sr.height + (sr.top - str.top);
      label.style.left = cx + 'px'; label.style.top = Math.max(2, cyTop - 18) + 'px';
    }
    function hideLabel(stage) { if (!stage) return; var l = stage.querySelector('.bp-label'); if (l) { l.classList.remove('show'); l.textContent = ''; } }

    // Single click → toggle the WHOLE zone as one selection (B п.B). Emits a synthetic
    // zone slug ('bp_zone_<view>_<region>') so the save path records the coarse area
    // without forcing the user through the sub-region list.
    function selectZone(regionEl) {
      var view = regionEl.getAttribute('data-view'), rk = regionEl.getAttribute('data-region');
      var reg = regionsFor(view)[rk]; if (!reg) return;
      var slug = 'bp_zone_' + view + '_' + rk;
      var picked = !regionEl.classList.contains('picked');
      regionEl.classList.toggle('picked', picked);
      if (picked) pickedSet[slug] = 1; else delete pickedSet[slug];
      if (typeof onSelect === 'function') onSelect(slug, { ru: reg.label.ru, en: reg.label.en, es: reg.label.es }, picked);
    }

    // Double-click / long-press → open the sub-region list right AT the cursor, so
    // reaching it never crosses another region (B п.B). The panel flips above the
    // pointer if it would overflow the bottom of the stage.
    function openSubs(regionEl, clientX, clientY) {
      var view = regionEl.getAttribute('data-view'), rk = regionEl.getAttribute('data-region');
      var reg = regionsFor(view)[rk]; if (!reg) return;
      closePanels();
      regionEl.classList.add('active');
      var stage = regionEl.closest('.bp-stage'); var str = stage.getBoundingClientRect();
      var panel = stage.querySelector('.bp-panel');
      panel.innerHTML = reg.sub.map(function (s) {
        var on = pickedSet[s.slug] ? ' picked' : '';
        return '<button type="button" class="bp-sub' + on + '" data-slug="' + esc(s.slug) + '">' + esc(L(s, lang)) + '</button>';
      }).join('');
      var px = (clientX != null) ? (clientX - str.left + 6) : (str.width / 2 - 70);
      var py = (clientY != null) ? (clientY - str.top + 6) : 20;
      panel.style.left = Math.min(Math.max(6, px), Math.max(6, str.width - 156)) + 'px';
      panel.style.top = Math.max(4, py) + 'px';
      panel.classList.add('open');
      var ph = panel.offsetHeight || 0;
      if (py + ph > str.height && py - ph > 0) panel.style.top = Math.max(4, py - ph - 12) + 'px';
      panel.querySelectorAll('.bp-sub').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var slug = btn.getAttribute('data-slug');
          var sub = reg.sub.filter(function (x) { return x.slug === slug; })[0];
          var on = btn.classList.toggle('picked');
          if (on) pickedSet[slug] = 1; else delete pickedSet[slug];
          if (typeof onSelect === 'function' && sub) onSelect(slug, { ru: sub.ru, en: sub.en, es: sub.es }, on);
        });
      });
    }

    // event delegation
    container.querySelectorAll('.bp-svg').forEach(function (svg) {
      var clickTimer = null;   // desktop: debounce single-click vs double-click
      var press = null;        // touch: long-press timer
      var suppressClick = false; // touch: swallow the click that ends a long-press
      svg.addEventListener('click', function (e) {
        var r = e.target.closest('.bp-region');
        if (!r) { closePanels(); return; }
        if (isTouch) {
          e.stopPropagation();
          if (suppressClick) { suppressClick = false; return; }
          selectZone(r);
          return;
        }
        // desktop: wait briefly so a double-click opens subs instead of toggling twice
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
        var rr = r;
        clickTimer = setTimeout(function () { clickTimer = null; selectZone(rr); }, 200);
      });
      svg.addEventListener('dblclick', function (e) {
        var r = e.target.closest('.bp-region'); if (!r) return;
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
        e.preventDefault();
        openSubs(r, e.clientX, e.clientY);
      });
      if (!isTouch) {
        svg.addEventListener('mouseover', function (e) { var r = e.target.closest('.bp-region'); if (r) showLabel(r); });
        svg.addEventListener('mouseout', function (e) { var r = e.target.closest('.bp-region'); if (r) hideLabel(r.closest('.bp-stage')); });
      } else {
        svg.addEventListener('touchstart', function (e) {
          var t0 = e.touches && e.touches[0]; var r = e.target.closest('.bp-region'); if (!r || !t0) return;
          var cx = t0.clientX, cy = t0.clientY;
          press = setTimeout(function () { press = null; suppressClick = true; openSubs(r, cx, cy); }, 500);
        }, { passive: true });
        svg.addEventListener('touchend', function () { if (press) { clearTimeout(press); press = null; } });
        svg.addEventListener('touchmove', function () { if (press) { clearTimeout(press); press = null; } }, { passive: true });
      }
    });
    // click outside closes the sub panel (does NOT clear selected zones)
    if (!container.__bpOutside) {
      container.__bpOutside = function (e) { if (!e.target.closest('.bp-stage')) closePanels(); };
      document.addEventListener('click', container.__bpOutside);
    }
    return { close: closePanels };
  };
})();
