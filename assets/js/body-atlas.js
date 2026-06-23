/* ============================================================================
 * BodyAtlas — interactive 3D anatomy engine for neuroattention.org
 * ----------------------------------------------------------------------------
 * Vanilla JS + Three.js r128 (lazy-loaded from CDN on first use).
 *
 * Geometry sources (honest provenance — see assets/3d/CREDITS.md):
 *   • Skin layer  — REAL human mesh (body-male.glb), rendered with a
 *                   holographic x-ray wireframe shader.
 *   • Muscles / skeleton / nervous / vessels / organs / brain-detail — REAL
 *     Z-Anatomy (CC-BY-SA) meshes, streamed per-layer from a CDN and tagged so
 *     every named structure is its own hit-testable region. Each system loads
 *     lazily the first time its layer is toggled on; a spinner overlay covers
 *     the empty stage until the first GLB arrives. No procedural fallback.
 *
 * Public API (see window.BodyAtlas at bottom):
 *   BodyAtlas.init(container, options) -> Promise<Atlas>
 *   atlas.render(opts) / .toggleLayer(name,vis) / .setLayerOpacity(name,0..1)
 *   atlas.setRotation(yaw,pitch) / .resetView() / .hitTest(x,y)
 *   atlas.on(event, handler) / .setMode(mode) / .setSex('male'|'female')
 *   atlas.enterBrainDetail() / .exitBrainDetail() / .focusOrgan(id) / .destroy()
 * ==========================================================================*/
(function () {
  'use strict';

  // ── palette (mycelium tokens, no purple) ──────────────────────────────────
  var COLD_CYAN  = 0xA8F7FF;   // coldCyan #A8F7FF
  var NEURO_GREEN= 0x8DFFC8;   // neuroGreen #8DFFC8
  var WARM_CYAN  = 0x6FE9F0;
  var RIM_WHITE  = 0xFFFFFF;

  var THREE_R128 = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var ORBIT_URL  = 'https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js';
  var GLTF_URL   = 'https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js';
  var DRACO_URL  = 'https://unpkg.com/three@0.128.0/examples/js/loaders/DRACOLoader.js';
  var BODY_GLB   = 'assets/3d/body/body-male.glb';

  // Real Z-Anatomy (CC-BY-SA) systems are streamed per-layer from a CDN; URLs
  // live in this config so they can be rotated without a code change. Procedural
  // capsule layers remain as an instant fallback / preview until the GLB arrives.
  var MODELS_CFG_URL = 'data/config/anatomy-models.json';
  var _cfgPromise = null;
  function loadModelsConfig() {
    if (_cfgPromise) return _cfgPromise;
    _cfgPromise = fetch(MODELS_CFG_URL)
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
    return _cfgPromise;
  }

  // Lazy anatomy data: localized region names (ru/es) + the CNS exclusion list
  // for the nervous layer. Loaded once, the first time any real layer streams.
  var ANAT_I18N_RU = 'data/i18n/anatomy/ru.json';
  var ANAT_I18N_ES = 'data/i18n/anatomy/es.json';
  var NERVOUS_CNS  = 'data/anatomy/nervous-cns-meshes.json';
  var _anatPromise = null;
  function loadAnatomyData() {
    if (_anatPromise) return _anatPromise;
    function j(u) { return fetch(u).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
    _anatPromise = Promise.all([j(ANAT_I18N_RU), j(ANAT_I18N_ES), j(NERVOUS_CNS)])
      .then(function (res) {
        var cns = {};
        if (res[2] && res[2].cns_meshes) res[2].cns_meshes.forEach(function (n) { cns[n] = 1; });
        return { ru: res[0] || {}, es: res[1] || {}, cns: cns };
      });
    return _anatPromise;
  }

  // ── anatomical name parsing ────────────────────────────────────────────────
  // Mirrors tools/gen_regions_index.py parse_name() BYTE-FOR-BYTE so engine slugs
  // and the generated i18n keys always agree. Z-Anatomy laterality / attachment
  // markers are a trailing ".<token>" (l/r/j/i, el/er/ol/or, e1l…); side = last
  // char when l/r, else no laterality. Real names are already clean Latin/English.
  // THREE.GLTFLoader runs PropertyBinding.sanitizeNodeName on every node name:
  // spaces → "_", and reserved chars ([ ] . : /) are stripped. That destroys the
  // ".l/.r/.j" markers ("fascia.l" → "fascial"), so we recover the RAW node name
  // from gltf.parser.json.nodes via this same transform before parsing.
  function sanitizeNodeName(name) {
    return String(name).replace(/\s/g, '_').replace(/[\[\]\.:\/]/g, '');
  }

  var _ANAT_MARKER = /\.([a-z][a-z0-9]{0,2})$/;
  function parseAnatName(layer, name) {
    var s = (name || '').trim();
    var side = null;
    var m = _ANAT_MARKER.exec(s);
    if (m) {
      var marker = m[1];
      s = s.slice(0, m.index);
      if (marker.charAt(marker.length - 1) === 'l' && marker !== 'j') side = 'l';
      else if (marker.charAt(marker.length - 1) === 'r') side = 'r';
    }
    var displayEn = s.trim();
    var slug = displayEn.toLowerCase()
      .replace(/[''`’]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!slug) return { regionId: '', baseSlug: '', displayEn: '', side: null };
    var baseSlug = layer + '_' + slug;
    var regionId = baseSlug + (side === 'l' ? '_left' : side === 'r' ? '_right' : '');
    return { regionId: regionId, baseSlug: baseSlug, displayEn: displayEn, side: side };
  }
  // i18n dictionary for the ~124 named brain structures (slug → {en,ru,es}).
  var BRAIN_I18N_URL = 'data/i18n/anatomy-brain.json';
  var _brainI18nPromise = null;
  function loadBrainI18n() {
    if (_brainI18nPromise) return _brainI18nPromise;
    _brainI18nPromise = fetch(BRAIN_I18N_URL)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.regions) || {}; })
      .catch(function () { return {}; });
    return _brainI18nPromise;
  }

  // localized "(left)/(right)" suffix appended to a paired structure's name.
  var BRAIN_SIDE = {
    l: { en: ' (left)',  ru: ' (слева)',  es: ' (izq.)' },
    r: { en: ' (right)', ru: ' (справа)', es: ' (der.)' }
  };
  // last-resort humanizer if a slug is somehow missing from the dictionary.
  function humanizeSlug(slug) {
    var s = (slug || '').replace(/_/g, ' ').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Brain region';
  }
  // build the localized {en,ru,es} fine name for a mesh from its slug + side.
  function brainNames(dict, slug, side) {
    var rec = (dict && dict[slug]) || null;
    var base = rec || { en: humanizeSlug(slug), ru: humanizeSlug(slug), es: humanizeSlug(slug) };
    var sx = BRAIN_SIDE[side] || { en: '', ru: '', es: '' };
    return { en: base.en + sx.en, ru: (base.ru || base.en) + sx.ru, es: (base.es || base.en) + sx.es };
  }

  // per-layer x-ray styling for streamed real meshes (no purple; mycelium tokens
  // + warm accents to tell vessels/organs apart)
  // B6: each layer gets a distinct base colour so multiple open layers read
  // apart at a glance, while the x-ray rim/glow (cyan-ish) stays for the
  // holographic look. Palette per Nick's spec.
  var LAYER_STYLE = {
    skin:     { color: 0xA8F7FF, rim: 0xCFF6FF, opacity: 0.40, glow: 0.6, fresnelPower: 2.4 }, // light blue, translucent
    muscles:  { color: 0xFF6B6B, rim: 0xFFC2C2, opacity: 0.50, glow: 0.6, fresnelPower: 2.1 }, // coral
    skeleton: { color: 0xFFD700, rim: 0xFFF1A8, opacity: 0.70, glow: 1.0, fresnelPower: 1.8 }, // gold/yellow
    nervous:  { color: 0x7CFC00, rim: 0xCFFFB0, opacity: 0.60, glow: 1.0, fresnelPower: 1.7 }, // lawn green
    vessels:  { color: 0xFF0000, rim: 0xFF9A9A, opacity: 0.50, glow: 0.9, fresnelPower: 1.9 }, // red
    organs:   { color: 0x9B59B6, rim: 0xD9B8E8, opacity: 0.60, glow: 0.8, fresnelPower: 2.0 }, // purple
    brain:    { color: 0xFFFFFF, rim: 0xFFFFFF, opacity: 0.78, glow: 1.2, fresnelPower: 1.6 }  // bright white
  };

  // ── tiny script loader (sequential, cached) ───────────────────────────────
  var _loaded = {};
  function loadScript(src) {
    if (_loaded[src]) return _loaded[src];
    _loaded[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
    return _loaded[src];
  }
  var _threeReady = null;
  function ensureThree() {
    if (window.THREE && window.THREE.OrbitControls && window.THREE.GLTFLoader) return Promise.resolve();
    if (_threeReady) return _threeReady;
    _threeReady = loadScript(THREE_R128)
      .then(function () { return Promise.all([loadScript(ORBIT_URL), loadScript(GLTF_URL), loadScript(DRACO_URL)]); });
    return _threeReady;
  }

  // ── x-ray fresnel shader ───────────────────────────────────────────────────
  // Edge-glowing, center-transparent fill — the classic holographic x-ray look.
  function makeXrayMaterial(opts) {
    opts = opts || {};
    var col = new window.THREE.Color(opts.color != null ? opts.color : COLD_CYAN);
    var rim = new window.THREE.Color(opts.rim != null ? opts.rim : RIM_WHITE);
    return new window.THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: window.THREE.AdditiveBlending,
      side: window.THREE.DoubleSide,
      uniforms: {
        uColor:        { value: col },
        uRim:          { value: rim },
        uFresnelPower: { value: opts.fresnelPower != null ? opts.fresnelPower : 2.4 },
        uOpacity:      { value: opts.opacity != null ? opts.opacity : 0.55 },
        uGlow:         { value: opts.glow != null ? opts.glow : 0.6 },
        // PACK 8: 0 = holographic x-ray (edge-glow, see-through centre);
        // 1 = solid fill (opaque surface) for the 100%-opacity slider position.
        uSolid:        { value: 0.0 }
      },
      vertexShader: [
        'varying vec3 vN;', 'varying vec3 vV;',
        'void main(){',
        '  vec4 wp = modelMatrix * vec4(position,1.0);',
        '  vN = normalize(mat3(modelMatrix) * normal);',
        '  vV = normalize(cameraPosition - wp.xyz);',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor; uniform vec3 uRim;',
        'uniform float uFresnelPower; uniform float uOpacity; uniform float uGlow; uniform float uSolid;',
        'varying vec3 vN; varying vec3 vV;',
        'void main(){',
        '  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));',
        '  f = pow(clamp(f,0.0,1.0), uFresnelPower);',
        '  vec3 c = mix(uColor, uRim, f*0.65);',
        '  float a = clamp(f*uOpacity + uGlow*0.06, 0.0, 1.0);',
        '  vec3 xc = c * (0.4 + uGlow*f);',                 // holographic colour
        '  vec3 sc = mix(uColor*0.55, uRim, f*0.5);',        // solid-fill colour
        '  vec3 outC = mix(xc, sc, uSolid);',
        '  float outA = mix(a, 1.0, uSolid);',               // uSolid=1 → fully opaque
        // PERF-D: scale the final colour by uOpacity so the per-region opacity
        // slider actually goes to zero in additive-blended scenes (where alpha
        // alone barely dims). uOpacity=0 → outC=0 → no additive contribution →
        // mesh disappears even behind other meshes' glow.
        '  gl_FragColor = vec4(outC * uOpacity, outA);',
        '}'
      ].join('\n')
    });
  }

  // r128 has no CapsuleGeometry (added in r130) — approximate with a cylinder.
  // Signature mirrors CapsuleGeometry(radius, length, capSegs, radialSegs).
  function CapGeo(r, len, _capSegs, radialSegs) {
    return new window.THREE.CylinderGeometry(r, r, len + r, radialSegs || 12, 1, false);
  }

  // wireframe "net" overlay for a geometry
  function makeWireframe(geom, color, opacity) {
    var wf = new window.THREE.WireframeGeometry(geom);
    var mat = new window.THREE.LineBasicMaterial({
      color: color != null ? color : COLD_CYAN,
      transparent: true, opacity: opacity != null ? opacity : 0.22,
      depthWrite: false
    });
    return new window.THREE.LineSegments(wf, mat);
  }

  // ── brain region catalogue (i18n names + placeholder descriptions) ─────────
  // Positions are normalized inside the brain's local space (set later).
  var BRAIN_REGIONS = [
    { id:'frontal-lobe',   group:'cortex',  color:COLD_CYAN,
      ru:'Лобная доля', en:'Frontal lobe', es:'Lóbulo frontal' },
    { id:'parietal-lobe',  group:'cortex',  color:COLD_CYAN,
      ru:'Теменная доля', en:'Parietal lobe', es:'Lóbulo parietal' },
    { id:'temporal-lobe',  group:'cortex',  color:COLD_CYAN,
      ru:'Височная доля', en:'Temporal lobe', es:'Lóbulo temporal' },
    { id:'occipital-lobe', group:'cortex',  color:COLD_CYAN,
      ru:'Затылочная доля', en:'Occipital lobe', es:'Lóbulo occipital' },
    { id:'thalamus',       group:'limbic',  color:NEURO_GREEN,
      ru:'Таламус', en:'Thalamus', es:'Tálamo' },
    { id:'hypothalamus',   group:'limbic',  color:NEURO_GREEN,
      ru:'Гипоталамус', en:'Hypothalamus', es:'Hipotálamo' },
    { id:'hippocampus',    group:'limbic',  color:NEURO_GREEN,
      ru:'Гиппокамп', en:'Hippocampus', es:'Hipocampo' },
    { id:'amygdala',       group:'limbic',  color:NEURO_GREEN,
      ru:'Миндалина', en:'Amygdala', es:'Amígdala' },
    { id:'basal-ganglia',  group:'deep',    color:WARM_CYAN,
      ru:'Базальные ганглии', en:'Basal ganglia', es:'Ganglios basales' },
    { id:'cerebellum',     group:'cerebellum', color:WARM_CYAN,
      ru:'Мозжечок', en:'Cerebellum', es:'Cerebelo' },
    { id:'midbrain',       group:'brainstem', color:WARM_CYAN,
      ru:'Средний мозг', en:'Midbrain', es:'Mesencéfalo' },
    { id:'pons',           group:'brainstem', color:WARM_CYAN,
      ru:'Мост', en:'Pons', es:'Puente' },
    { id:'medulla',        group:'brainstem', color:WARM_CYAN,
      ru:'Продолговатый мозг', en:'Medulla oblongata', es:'Bulbo raquídeo' },
    // additional regions present in the real Z-Anatomy brain model
    { id:'insula',         group:'cortex',  color:COLD_CYAN,
      ru:'Островковая доля', en:'Insula', es:'Ínsula' },
    { id:'cingulate',      group:'limbic',  color:NEURO_GREEN,
      ru:'Поясная извилина', en:'Cingulate cortex', es:'Corteza cingulada' },
    { id:'corpus-callosum',group:'deep',    color:WARM_CYAN,
      ru:'Мозолистое тело', en:'Corpus callosum', es:'Cuerpo calloso' },
    { id:'fornix',         group:'limbic',  color:NEURO_GREEN,
      ru:'Свод мозга', en:'Fornix', es:'Fórnix' },
    { id:'ventricles',     group:'deep',    color:WARM_CYAN,
      ru:'Желудочки мозга', en:'Ventricles', es:'Ventrículos' }
  ];

  // ── Sensation-map alignment (C2) ────────────────────────────────────────────
  // Maps Atlas region ids → Sensation-Map sub-part slugs (body-picker.js). Keeps
  // the 3D atlas and the existing 2D picker on ONE id space so saved sensations
  // stay backward-compatible whichever picker is shown. Body-surface zones reuse
  // body-picker region keys directly (head/neck/chest/…); spine + organs map to
  // their concrete slugs here.
  var SENSATION_REGION_MAP = {
    // vertebral column (atlas spine segments → body-picker spine slugs)
    'cervical-spine': 'bp_spine_b_cervical',
    'thoracic-spine': 'bp_spine_b_thoracic',
    'lumbar-spine':   'bp_spine_b_lumbar',
    'sacral-spine':   'bp_spine_b_sacral',
    'spinal-cord':    'bp_spine_b_cord',
    // inset organs → general organ slugs
    'heart':   'bp_org_heart',
    'lungs':   'bp_org_lungs',
    'liver':   'bp_org_liver',
    'kidneys': 'bp_org_kidneys',
    'brain':   'bp_head_f_brain'
  };

  // ── Atlas instance ─────────────────────────────────────────────────────────
  function Atlas(container, options) {
    this.container = container;
    this.opts = options || {};
    this.mode = this.opts.mode || 'full';
    this.sex = this.opts.sex || 'male';
    this._handlers = {};       // event -> [fn]
    this._layers = {};         // name -> THREE.Group
    this._layerState = {};     // name -> {visible, opacity}
    this._regionStates = {};   // B8: regionId -> {visible, opacity} session overrides
    this._regionMeshes = [];   // hit-testable meshes (body regions + brain)
    this._raf = null;
    this._destroyed = false;
    this._frontView = true;    // sensation-picker front/back
    this._brainDetail = false;
    this._metrics = null;      // body proportions
  }

  Atlas.prototype.init = function () {
    var self = this;
    return ensureThree().then(function () { self._build(); return self; });
  };

  Atlas.prototype._build = function () {
    var T = window.THREE, c = this.container;
    var w = c.clientWidth || 600, h = c.clientHeight || 600;

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(38, w / h, 0.01, 100);
    this.camera.position.set(0, 0.1, 4.2);

    // QUALITY: keep antialias on always (MSAA is essential for the wireframe
    // edges to read clean), and let pixelRatio go up to native devicePixelRatio
    // (capped at 2.0 so 3× phones don't oversample). The on-demand render loop
    // (PR #34), cached wheel pivot (PR #37) and 15Hz hover throttle (PR #37)
    // already cut render frequency dramatically, so high-DPR frames are rare
    // enough that quality wins over the small fragment-rate cost.
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x000000, 0);
    c.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';

    // lights — subtle, the shader is mostly self-lit
    this.scene.add(new T.AmbientLight(0x6699aa, 0.6));
    var key = new T.DirectionalLight(0xA8F7FF, 0.8); key.position.set(2, 3, 4); this.scene.add(key);
    var fill = new T.DirectionalLight(0x8DFFC8, 0.3); fill.position.set(-3, 1, -2); this.scene.add(fill);

    // controls
    this.controls = new T.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;                 // B5: smooth interpolation
    // B5: wider zoom envelope so you can actually get in close (organ/region
    // detail) — min was 0.4 (too far). We own the wheel (B2 zoom-to-cursor), so
    // OrbitControls' native dolly is disabled; these clamp our custom dolly.
    this.controls.minDistance = 0.12;
    this.controls.maxDistance = 12;
    // enableZoom stays ON so touch pinch-zoom keeps working (toward target).
    // Desktop wheel goes through our _onWheel (which calls
    // stopImmediatePropagation) so OrbitControls' wheel dolly never runs on
    // desktop — only the touch dolly path runs on mobile pinch.
    this.controls.enableZoom = true;
    // B3: panning is allowed but only takes effect once zoomed in (>1.5x), gated
    // each frame in the render loop. screen-space panning feels natural here.
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.target.set(0, 0, 0);
    this._baseDist = this.camera.position.distanceTo(this.controls.target); // reference for "zoom factor"
    // default mouse map: left = rotate. Shift+drag temporarily becomes pan (B3).
    if (T.MOUSE) this.controls.mouseButtons = { LEFT: T.MOUSE.ROTATE, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.PAN };
    // Our custom touchstart/touchmove handlers own 2-finger pinch (DOLLY) — see
    // _bindEvents. OrbitControls' DOLLY_PAN had a first-event teleport bug, so
    // we send TWO touches to PAN only; one-finger rotate stays.
    if (T.TOUCH) this.controls.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.PAN };

    // root group (so everything rotates/centers together)
    this.root = new T.Group();
    this.scene.add(this.root);

    this.raycaster = new T.Raycaster();
    this._mouse = new T.Vector2();

    this._bindEvents();
    this._startLoop();
    // Empty stage + spinner until the first GLB (the body silhouette) arrives —
    // no procedural capsule is ever shown.
    this._showLoadingOverlay(loadingMsg());
    this._loadBody();
    this._applyMode(this.mode);
  };

  // ── loading overlay (shown until the first/body GLB streams in) ─────────────
  function loadingMsg() {
    var l = (window.getLang && window.getLang()) || (document.documentElement.lang || 'ru');
    l = String(l).slice(0, 2);
    return l === 'en' ? 'Loading model…' : l === 'es' ? 'Cargando modelo…' : 'Загружаем модель…';
  }
  Atlas.prototype._showLoadingOverlay = function (msg) {
    var c = this.container; if (!c) return;
    if (!document.getElementById('ba-spin-kf')) {
      var st = document.createElement('style'); st.id = 'ba-spin-kf';
      st.textContent = '@keyframes ba-spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }
    var o = this._loadingOverlay;
    if (!o) {
      try { if (getComputedStyle(c).position === 'static') c.style.position = 'relative'; } catch (e) {}
      o = document.createElement('div'); o.className = 'ba-loading';
      o.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;z-index:5;pointer-events:none;background:radial-gradient(60% 60% at 50% 45%,rgba(168,247,255,0.05),transparent);';
      o.innerHTML = '<div style="width:34px;height:34px;border-radius:50%;border:2.5px solid rgba(168,247,255,0.22);border-top-color:#A8F7FF;animation:ba-spin .8s linear infinite;"></div><div class="ba-loading-msg" style="font-size:13px;color:var(--text-muted,#9fb4bd);letter-spacing:.02em;"></div>';
      c.appendChild(o);
      this._loadingOverlay = o;
    }
    var m = o.querySelector('.ba-loading-msg'); if (m) m.textContent = msg || '';
    o.style.display = 'flex';
  };
  Atlas.prototype._hideLoadingOverlay = function () {
    if (this._loadingOverlay) this._loadingOverlay.style.display = 'none';
  };

  // ── body load ───────────────────────────────────────────────────────────────
  Atlas.prototype._loadBody = function () {
    var self = this, T = window.THREE;
    var loader = new T.GLTFLoader();
    loader.load(BODY_GLB, function (gltf) {
      self._mountBody(gltf.scene);
    }, undefined, function (err) {
      console.warn('[BodyAtlas] GLB load failed, using procedural body', err);
      self._mountBody(null);   // procedural fallback humanoid
    });
  };

  Atlas.prototype._mountBody = function (gltfScene) {
    var T = window.THREE, self = this;
    var skin = new T.Group(); skin.name = 'skin';

    var srcMeshes = [];
    if (gltfScene) {
      gltfScene.updateMatrixWorld(true);
      gltfScene.traverse(function (o) { if (o.isMesh && o.geometry) srcMeshes.push(o); });
    }

    if (srcMeshes.length) {
      // Real mesh → x-ray fill + wireframe net, baked to world space.
      srcMeshes.forEach(function (m) {
        var g = m.geometry.clone();
        g.applyMatrix4(m.matrixWorld);
        var fill = new T.Mesh(g, makeXrayMaterial({ color: COLD_CYAN, opacity: 0.5, glow: 0.7 }));
        skin.add(fill);
        skin.add(makeWireframe(g, COLD_CYAN, 0.18));
      });
    } else {
      // Procedural humanoid fallback (capsule torso + limbs) so the tool never
      // shows an empty stage if the asset is unavailable.
      var body = this._proceduralBody();
      skin.add(body);
    }

    // center + normalize scale so total height ≈ 2.0 units, centered at origin
    var box = new T.Box3().setFromObject(skin);
    var size = new T.Vector3(); box.getSize(size);
    var center = new T.Vector3(); box.getCenter(center);
    var targetH = 2.0;
    var s = size.y > 0.0001 ? targetH / size.y : 1;
    skin.scale.setScalar(s);
    // recompute after scale to re-center
    box = new T.Box3().setFromObject(skin); box.getCenter(center); box.getSize(size);
    skin.position.sub(center);

    this.root.add(skin);
    this._layers.skin = skin;
    // Skin layer is mounted for backwards-compat (_metrics computation) but
    // hidden by default: it's no longer a UI-toggleable layer.
    skin.visible = false;
    this._layerState.skin = { visible: true, opacity: 0.5 };

    // metrics for anatomy placement (in root space, body centered at origin)
    var bb = new T.Box3().setFromObject(skin);
    var H = bb.max.y - bb.min.y;
    this._metrics = {
      box: bb,
      height: H,
      yMin: bb.min.y, yMax: bb.max.y,
      // NB: raw bbox width is the ARM SPAN in a T-pose (~stature), useless as a
      // body-size unit. Use a stature-derived anatomical reference instead
      // (biacromial breadth ≈ 0.26·H → half torso unit ≈ 0.28·H works for our
      // proportional multipliers). armSpan kept for reference.
      armSpan: bb.max.x - bb.min.x,
      width: H * 0.28,
      depth: Math.max(bb.max.z - bb.min.z, H * 0.14),
      // anatomical landmark heights as fraction of stature, expressed as y-coords
      y: function (frac) { return bb.min.y + H * frac; }
    };

    // No procedural anatomy layers. Each real Z-Anatomy system (muscles /
    // skeleton / nervous / vessels / organs) streams in lazily the first time
    // its layer is toggled on (see _loadRealLayer). Until then the scene shows
    // only the body silhouette (skin GLB) — never a procedural capsule.
    this._applyLayerConfig();
    this._applyMode(this.mode);
    this._emit('ready', {});
    this._hideLoadingOverlay();   // first GLB is in — drop the spinner
  };

  Atlas.prototype._proceduralBody = function () {
    var T = window.THREE, g = new T.Group();
    function part(geo, x, y, z) {
      var m = new T.Mesh(geo, makeXrayMaterial({ opacity: 0.5, glow: 0.7 }));
      m.position.set(x, y, z); g.add(m);
      g.add((function () { var wf = makeWireframe(geo, COLD_CYAN, 0.18); wf.position.set(x, y, z); return wf; })());
    }
    part(new T.SphereGeometry(0.16, 24, 18), 0, 1.55, 0);            // head
    part(new T.CylinderGeometry(0.07, 0.09, 0.18, 16), 0, 1.38, 0);  // neck
    part(CapGeo(0.26, 0.55, 8, 16), 0, 1.0, 0);       // torso
    part(CapGeo(0.09, 0.55, 6, 12), -0.34, 1.05, 0);  // arm L
    part(CapGeo(0.09, 0.55, 6, 12), 0.34, 1.05, 0);   // arm R
    part(CapGeo(0.12, 0.7, 6, 12), -0.13, 0.4, 0);    // leg L
    part(CapGeo(0.12, 0.7, 6, 12), 0.13, 0.4, 0);     // leg R
    return g;
  };

  // ── real anatomical brain (Z-Anatomy) — lazy, streamed once ──────────────────
  // Replaces the 13 procedural capsules with ~228 individually-named meshes (124
  // distinct structures). Every mesh is its own hit-testable region: its slug +
  // side resolve to a localized {en,ru,es} name via the anatomy-brain dictionary,
  // and its coarseId picks the holographic colour + the region-panel description.
  // The procedural brain stays as an instant preview until the GLB swaps in.
  Atlas.prototype._loadBrainDetail = function () {
    if (this._brainDetailReq) return this._brainDetailReq;
    var self = this, T = window.THREE;
    function regionInfo(id) {
      for (var i = 0; i < BRAIN_REGIONS.length; i++) if (BRAIN_REGIONS[i].id === id) return BRAIN_REGIONS[i];
      return null;
    }
    this._brainDetailReq = Promise.all([loadModelsConfig(), loadBrainI18n()]).then(function (res) {
      var cfg = res[0], dict = res[1] || {};
      var url = cfg && cfg.brainDetail;
      if (!url) return null;                           // no real source → keep procedural
      return new Promise(function (resolve) {
        var loader = new T.GLTFLoader();
        try {
          if (T.DRACOLoader) {
            var draco = new T.DRACOLoader();
            draco.setDecoderPath(cfg.dracoDecoderPath || 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
            loader.setDRACOLoader(draco);
          }
        } catch (e) { /* draco optional */ }
        self._emit('brain-loading', {});
        loader.load(url, function (gltf) {
          if (self._destroyed) { resolve(null); return; }
          var grp = new T.Group(); grp.name = 'brain-real';
          var meshes = [];
          // each mesh carries its own anatomical tag in node.extras (→ userData):
          // { regionName, base, slug, side, coarseId }. Walk up only as a fallback
          // for multi-primitive nodes (Group keeps extras, child Meshes don't).
          function resolveTag(o) {
            var n = o;
            while (n) { if (n.userData && n.userData.slug) return n.userData; n = n.parent; }
            return null;
          }
          gltf.scene.traverse(function (o) {
            if (!o.isMesh || !o.geometry) return;
            var tag = (o.userData && o.userData.slug) ? o.userData : resolveTag(o);
            var coarseId = tag ? tag.coarseId : null;
            var info = coarseId ? regionInfo(coarseId) : null;     // coarse → colour + group
            o.material = makeXrayMaterial({ color: info ? info.color : COLD_CYAN, rim: RIM_WHITE, opacity: 0.5, glow: 0.7, fresnelPower: 2.2 });
            var slug = tag ? tag.slug : null, side = tag ? (tag.side || '') : '';
            o.userData = {
              regionId: slug ? (slug + (side ? '_' + side : '')) : 'brain',  // fine, per-mesh
              slug: slug, coarseId: coarseId,
              regionName: tag ? tag.regionName : o.name,
              names: brainNames(dict, slug, side),          // localized {en,ru,es} fine name
              // brain-detail is a permanent sub-layer of 'nervous': tag layer/organ
              // so layer toggling, focus and sub-layer filtering treat it correctly.
              group: info ? info.group : '', layer: 'nervous', organ: 'brain', brain: true, baseOpacity: 0.5
            };
            meshes.push(o);
          });
          grp.add(gltf.scene);
          self.root.add(grp);
          self._brainRealGroup = grp;
          self._brainRealMeshes = meshes;
          // frame the camera on the real brain's true bounding box
          var box = new T.Box3().setFromObject(grp);
          var c = box.getCenter(new T.Vector3());
          var size = box.getSize(new T.Vector3());
          self._brainCenter = c;
          self._brainRadius = Math.max(size.x, size.y, size.z) * 0.5 || self._brainRadius;
          // hide the procedural preview now that the real mesh is in
          if (self._brainGroup) self._brainGroup.visible = false;
          // brain-detail is a permanent sub-layer of nervous: visible whenever the
          // nervous layer is on. Hide the duplicate brain structures the nervous
          // GLB also carries so we never render two brains.
          var nervOn = !!(self._layerState['nervous'] && self._layerState['nervous'].visible);
          grp.visible = nervOn;
          self._hideNervousBrainDupes();
          self._emit('brain-loaded', { regions: meshes.length });
          // if a "brain detail" camera zoom was requested before the GLB landed, fit now
          if (self._brainDetail) self._frameBrain();
          resolve(grp);
        }, undefined, function (err) {
          console.warn('[BodyAtlas] brain-detail load failed', err);
          self._emit('brain-error', {});
          resolve(null);
        });
      });
    });
    return this._brainDetailReq;
  };

  // Hide the brain structures the nervous GLB carries that the brain-detail GLB
  // now provides in finer detail, so we never render two overlapping brains.
  // Precise (not regex): a nervous mesh is a duplicate only if its bare slug
  // EXACTLY matches a brain-detail mesh slug OR a brain-region whole-structure
  // alias (e.g. 'frontal_lobe','medulla_oblongata'). White-matter tracts
  // (spinothalamic/spinocerebellar) and peripheral nerves keep their own names,
  // so they are never matched and stay visible. Idempotent + reversible.
  Atlas.prototype._hideNervousBrainDupes = function () {
    var nerv = this._layers && this._layers['nervous'];
    var brainMeshes = this._brainRealMeshes;
    if (!nerv || !brainMeshes || !brainMeshes.length) return;
    var norm = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ''); };
    // keys = every brain-detail mesh slug + every brain-organ whole-structure alias
    var keys = {};
    brainMeshes.forEach(function (m) { var s = m.userData && m.userData.slug; if (s) keys[norm(s)] = 1; });
    Object.keys(SEED_REGION_INFO).forEach(function (id) {
      var info = SEED_REGION_INFO[id];
      if (!info || info.organ !== 'brain') return;
      keys[norm(id)] = 1;
      (info.aliases || []).forEach(function (a) { keys[norm(a)] = 1; });
    });
    var hidden = 0;
    nerv.traverse(function (o) {
      if (!o.isMesh || !o.userData) return;
      var ud = o.userData;
      if (ud.organ === 'brain') return;                 // never touch the brain-detail group
      var bare = (ud.layer && ud.baseSlug) ? String(ud.baseSlug).replace(new RegExp('^' + ud.layer + '_'), '') : ud.baseSlug;
      if (bare && keys[norm(bare)]) { o.visible = false; ud._brainDupeHidden = true; hidden++; }
    });
    if (hidden && window.console) console.log('[BodyAtlas] hid ' + hidden + ' nervous brain-duplicate meshes (brain-detail provides them)');
    if (this._requestRender) this._requestRender();
  };

  Atlas.prototype._frameBrain = function () {
    if (!this._brainCenter) return;
    var T = window.THREE;
    // fit the brain's bounding sphere to the vertical FOV (+ margin) so it fills
    // the view regardless of viewport aspect, instead of a fixed radius multiple.
    var fov = ((this.camera && this.camera.fov) || 38) * Math.PI / 180;
    var dist = (this._brainRadius / Math.sin(fov / 2)) * 1.35;
    this._tweenCamera(this._brainCenter.clone().add(new T.Vector3(0, 0, dist)), this._brainCenter.clone());
    if (this.controls) this.controls.minDistance = this._brainRadius * 1.1;
  };

  // Orbit-fit the camera onto the bounding box of an arbitrary mesh set (used by
  // the double-click "select whole region" gesture). Generalises _frameBrain.
  Atlas.prototype.focusCameraOnMeshes = function (meshes) {
    var T = window.THREE;
    if (!T || !this.controls || !meshes || !meshes.length) return;
    var box = new T.Box3();
    meshes.forEach(function (m) {
      if (!m.geometry) return;
      m.updateWorldMatrix(true, false);
      var b = new T.Box3().setFromObject(m);
      if (isFinite(b.min.x) && isFinite(b.max.x)) box.union(b);
    });
    if (box.isEmpty()) return;
    var c = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3());
    var radius = Math.max(size.x, size.y, size.z) * 0.5 || 0.3;
    var fov = ((this.camera && this.camera.fov) || 38) * Math.PI / 180;
    var dist = (radius / Math.sin(fov / 2)) * 1.6;
    this.controls.minDistance = Math.min(this.controls.minDistance || 0.4, radius * 0.5);
    // keep the current view DIRECTION, just re-centre on the region at `dist`.
    // Instant set + update() (OrbitControls recomputes its spherical from the new
    // position) — avoids the damping/tween fight that left off-centre targets stuck.
    var dir = new T.Vector3().subVectors(this.camera.position, this.controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize().multiplyScalar(dist);
    this.controls.target.copy(c);
    this.camera.position.copy(c).add(dir);
    this.camera.updateProjectionMatrix();
    this.controls.update();
    if (this._requestRender) this._requestRender();
  };

  // Nearest VISIBLE named mesh to a world point — used when a double-click misses
  // every mesh, so the gesture still zooms toward the closest region.
  Atlas.prototype._nearestVisibleMesh = function (worldPt) {
    var T = window.THREE; if (!T || !this.root) return null;
    function vis(o) { var n = o; while (n) { if (n.visible === false) return false; n = n.parent; } return true; }
    var best = null, bestD = Infinity, c = new T.Vector3();
    this.root.traverse(function (o) {
      if (!o.isMesh || !o.userData || !o.userData.regionId || !o.geometry || !vis(o)) return;
      if (!o.geometry.boundingSphere) { try { o.geometry.computeBoundingSphere(); } catch (e) { return; } }
      if (!o.geometry.boundingSphere) return;
      c.copy(o.geometry.boundingSphere.center); o.updateWorldMatrix(true, false); c.applyMatrix4(o.matrixWorld);
      var d = c.distanceTo(worldPt); if (d < bestD) { bestD = d; best = o; }
    });
    return best;
  };

  // Scale the camera+target about a world pivot (generic zoom-in fallback).
  Atlas.prototype._zoomTowardPivot = function (pivot, scale) {
    if (!this.controls) return;
    var cam = this.camera.position, tgt = this.controls.target, dist = cam.distanceTo(tgt);
    var newDist = Math.max(this.controls.minDistance || 0.4, Math.min(this.controls.maxDistance || 20, dist * scale));
    scale = dist > 1e-5 ? newDist / dist : 1;
    cam.sub(pivot).multiplyScalar(scale).add(pivot);
    tgt.sub(pivot).multiplyScalar(scale).add(pivot);
    this.controls.update();
    if (this._requestRender) this._requestRender();
  };

  // Toggle a sub-layer (organ group) within a layer — hides/shows only the meshes
  // tagged userData.layer===layer && userData.organ===organ, leaving the rest of
  // the layer untouched. Powers the layer-card subtoggles (Мозг / Спинной мозг /
  // Сердце / ЖКТ / …). For vessels, organ===null means "vessels proper" (no organ tag).
  Atlas.prototype.toggleSubLayer = function (layer, organ, on) {
    on = on !== false;
    this.root.traverse(function (o) {
      if (!o.isMesh || !o.userData || o.userData.layer !== layer) return;
      var og = o.userData.organ || null;
      if (og === organ) o.visible = on;
    });
    if (!this._subLayerState) this._subLayerState = {};
    this._subLayerState[layer + '/' + (organ || '')] = on;
    if (this._requestRender) this._requestRender();
    return this;
  };

  // ISOLATE semantics for the layer-card subtoggles: given the set of *checked*
  // organs, show only meshes of those organs (everything else in the layer hidden).
  // No organs checked → the whole layer is visible (default). Collision-hidden
  // nervous brain-duplicates stay hidden either way.
  Atlas.prototype.setSubLayerIsolation = function (layer, organs) {
    var set = {}, isolate = !!(organs && organs.length);
    (organs || []).forEach(function (o) { set[o] = 1; });
    this.root.traverse(function (o) {
      if (!o.isMesh || !o.userData || o.userData.layer !== layer) return;
      if (o.userData._brainDupeHidden) return;     // keep duplicates the brain-detail GLB replaces hidden
      o.visible = isolate ? !!set[o.userData.organ || ''] : true;
    });
    if (this._requestRender) this._requestRender();
    return this;
  };

  // The nearest registered (SEED_REGION_INFO) named region containing a mesh —
  // used by double-click to select the whole region from a fine sub-mesh
  // (e.g. a precentral-gyrus mesh → 'frontal-lobe'). Never returns empty.
  Atlas.prototype._meshNamedRegion = function (ud) {
    if (!ud) return null;
    var norm = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ''); };
    // 1) brain meshes carry coarseId = the seed slug ('frontal-lobe', 'medulla'…)
    if (ud.coarseId && SEED_REGION_INFO[ud.coarseId]) return ud.coarseId;
    // 2) match the layer-stripped slug against any seed key / alias / descendant
    var bare = (ud.layer && ud.baseSlug) ? String(ud.baseSlug).replace(new RegExp('^' + ud.layer + '_'), '') : (ud.baseSlug || ud.slug);
    if (bare) {
      var nb = norm(bare);
      for (var k in SEED_REGION_INFO) {
        if (norm(k) === nb) return k;
        var info = SEED_REGION_INFO[k];
        var al = info.aliases || [], de = info.descendants || [], i;
        for (i = 0; i < al.length; i++) if (norm(al[i]) === nb) return k;
        for (i = 0; i < de.length; i++) if (norm(de[i]) === nb) return k;
      }
    }
    // 3) fallback — never empty
    // sub-layer organ groups (muscle regions, spinal-cord …) are the named region
    // for meshes not in SEED_REGION_INFO — so double-click selects the whole group.
    if (ud.organ) return ud.organ;
    return ud.coarseId || ud.baseSlug || ud.regionId || null;
  };

  // ── layer config / visibility / opacity ────────────────────────────────────
  Atlas.prototype._applyLayerConfig = function () {
    var requested = this.opts.layers;
    // Skin and brain-placeholder layers removed — atlas opens with empty stage;
    // user toggles real anatomy layers (muscles/skeleton/nervous/vessels/organs)
    // and uses the dedicated "Brain Detail" button for real Z-Anatomy brain.
    var all = ['muscles', 'skeleton', 'nervous', 'vessels', 'organs'];
    var self = this;
    all.forEach(function (name) {
      var visible;
      if (requested) visible = requested.indexOf(name) !== -1;
      else visible = false;   // nothing visible by default
      self.toggleLayer(name, visible);
    });
    // Hide skin group if it was mounted from BODY_GLB, and sync state so
    // snapshot/restore in enterBrainDetail/exitBrainDetail doesn't revive it.
    if (self._layers.skin) self._layers.skin.visible = false;
    if (self._layerState.skin) self._layerState.skin.visible = false;
  };

  Atlas.prototype.toggleLayer = function (name, visible) {
    visible = !!visible;
    if (this._layerState[name]) this._layerState[name].visible = visible;
    else this._layerState[name] = { visible: visible, opacity: (LAYER_STYLE[name] && LAYER_STYLE[name].opacity) || 0.5 };
    var grp = this._layers[name];
    if (grp) grp.visible = visible;
    // Stream the real Z-Anatomy mesh the first time a layer is shown; the
    // procedural capsule (if any) stays visible until the GLB swaps in.
    if (visible) this._loadRealLayer(name);
    // brain-detail GLB is a permanent sub-layer of 'nervous': stream it eagerly the
    // first time nervous turns on, and tie the brain group's visibility to nervous.
    if (name === 'nervous') {
      if (visible) this._loadBrainDetail();
      if (this._brainRealGroup) this._brainRealGroup.visible = visible;
    }
    this._emit('layer-change', { layer: name, visible: visible });
    if (this._requestRender) this._requestRender();
  };

  // ── organ (sub-layer) tagging — single source of truth ──────────────────────
  // Maps a mesh's baseSlug + its layer to an organ group, by token match. Used for
  // EVERY GLB-layer mesh at load (not just brain-detail) so the layer-card
  // subtoggles isolate the WHOLE organ (all internal nuclei, every vertebra, both
  // lung lobes, kidneys+adrenals), not just the surface meshes. Token lists were
  // derived from the full mesh inventory (see /tmp/organ-tagging-report.md).
  // Returns null for meshes that belong to no named organ (generic bones,
  // peripheral nerves, plain vessels).
  function assignOrganTag(baseSlug, layer) {
    var n = String(baseSlug == null ? '' : baseSlug).toLowerCase();
    if (layer === 'nervous') {
      if (/spinal_cord/.test(n)) return 'spinal-cord';
      if (/brain|cortex|cerebrum|cerebell|medulla|\bpons\b|midbrain|thalamus|hypothalam|hippocamp|amygdal|fornix|callosum|cingulate|insula|putamen|caudate|frontal|parietal|temporal|occipital|basal_ganglia|globus_pallidus|gyrus|gyri|sulcus|\blobe\b|lobule|ventricle|olive|colliculus|substantia|red_nucleus|geniculate|mamillary|septal|septum_pellucidum|lentiform|pallidus|tegmentum|tectum|peduncle|commissure|optic_chiasm|optic_tract|habenula|cuneus|precuneus|operculum|uvula|lingula|culmen|declive|nodule|tonsil_of_cerebellum|vermis|flocculus|salivatory|ambiguus|solitary|aqueduct|interpeduncular|stria_|amygdaloid|paracentral|precentral|postcentral|angular_gyrus|supramarginal/.test(n)) return 'brain';
      return null;
    }
    if (layer === 'skeleton') {
      if (/vertebra|sacrum|coccyx|vertebral_column|intervertebral|cervical|atlas|axis|dens/.test(n)) return 'spine';
      if (/hip_bone|acetabul|head_of_femur|ala_of_ilium|body_of_ilium|\bilium\b|ischium|pubis|pelvic_girdle|bony_pelvis/.test(n)) return 'hip';
      return null;
    }
    if (layer === 'vessels') {
      if (/atrium|ventricle|\bheart\b|cardiac|coronary|myocard|aortic_valve|mitral|tricuspid|papillary_muscle|chordae|sinus_venarum|interventricular|interatrial|trabeculae/.test(n)) return 'heart';
      return null;
    }
    if (layer === 'organs') {
      if (/lung|pulmon/.test(n)) return 'lungs';
      if (/kidney|renal|suprarenal|adrenal/.test(n)) return 'kidneys';
      if (/liver|hepat/.test(n)) return 'liver';
      if (/pancreas|pancreat/.test(n)) return 'pancreas';
      if (/thyroid|parathyroid/.test(n)) return 'endocrine';
      if (/\bnose\b|nasal|nasopharynx|paranasal/.test(n)) return 'airway';
      if (/stomach|gastric|oesophag|esophag|duoden|jejun|ileum|intestin|colon|caecum|cecum|vermiform_appendix|rectum|pylor|\bcardia\b|bile|gallbladder|omentum|mesocolon|mesentery|taenia|haustr/.test(n)) return 'gi-tract';
      return null;
    }
    if (layer === 'muscles') {
      // skip pure connective tissue (fascia / retinaculum / bursa / septum /
      // aponeurosis / tendon …) — it stays untagged (shown in the whole-muscles
      // view, never isolated as a "muscle group").
      if (/fascia|retinaculum|bursa|septum|aponeurosis|ligament|tendon|sheath|raphe|trochlea|capsule|arch/.test(n)) return null;
      if (/pectoralis|intercostal|serratus_anterior|subclavius|transversus_thoracis/.test(n)) return 'chest-muscles';
      if (/trapezius|latissimus|rhomboid|erector_spinae|\bspinae\b|splenius|semispinalis|multifidus|levator_scapulae|infraspinatus|supraspinatus|teres_major|teres_minor/.test(n)) return 'back-muscles';
      if (/rectus_abdominis|external_oblique|internal_oblique|transversus_abdominis|quadratus_lumborum|psoas|iliacus|diaphragm/.test(n)) return 'core-muscles';
      if (/biceps_brachii|triceps_brachii|deltoid|brachialis|brachioradialis|coracobrachialis|anconeus|pronator|supinator|flexor_carpi|extensor_carpi|flexor_digitorum|extensor_digitorum|palmaris|flexor_pollicis|extensor_pollicis|abductor_pollicis/.test(n)) return 'arm-muscles';
      if (/vastus|rectus_femoris|biceps_femoris|semitendinosus|semimembranosus|gluteus|sartorius|gracilis|adductor_longus|adductor_brevis|adductor_magnus|gastrocnemius|soleus|tibialis|fibularis|peroneus|popliteus|plantaris/.test(n)) return 'leg-muscles';
      if (/masseter|temporalis_muscle|orbicularis|zygomatic|buccinator|sternocleidomastoid|platysma|mentalis|frontalis|occipitofrontalis|scalene|omohyoid|sternohyoid|sternothyroid|mylohyoid|digastric|stylohyoid|thyrohyoid|risorius|nasalis|levator_labii|depressor_(labii|anguli)|corrugator|procerus/.test(n)) return 'face-neck-muscles';
      return null;
    }
    return null;
  }

  // ── real model streaming (lazy, per layer) ─────────────────────────────────
  // GLBs are pre-normalized to the atlas frame (centered, height ≈ 2.0), so they
  // mount directly with no extra transform. Materials are replaced with the
  // holographic x-ray shader at load time.
  Atlas.prototype._loadRealLayer = function (name) {
    var self = this, T = window.THREE;
    if (!this._real) this._real = {};
    if (this._real[name]) return this._real[name];     // already loading/loaded
    this._real[name] = Promise.all([loadModelsConfig(), loadAnatomyData()]).then(function (arr) {
      var cfg = arr[0], anat = arr[1];
      if (anat) self._anat = anat;     // {ru, es, cns} cached for name resolution
      if (!cfg || !cfg.layers || !cfg.layers[name]) return null;   // no real source → keep procedural
      var url = cfg.layers[name];
      return new Promise(function (resolve) {
        var loader = new T.GLTFLoader();
        try {
          if (T.DRACOLoader) {
            var draco = new T.DRACOLoader();
            draco.setDecoderPath(cfg.dracoDecoderPath || 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
            loader.setDRACOLoader(draco);
          }
        } catch (e) { /* draco optional */ }
        self._emit('layer-loading', { layer: name });
        loader.load(url, function (gltf) {
          var grp = new T.Group(); grp.name = name + '-real';
          var style = LAYER_STYLE[name] || { color: COLD_CYAN, opacity: 0.5, glow: 0.7 };
          var cns = (self._anat && self._anat.cns) || {};
          var tagged = 0;
          // sanitized→raw node-name map, so we can undo GLTFLoader's name mangling
          var rawByClean = {};
          try {
            var nodes = gltf.parser && gltf.parser.json && gltf.parser.json.nodes;
            if (nodes) nodes.forEach(function (nd) { if (nd && nd.name) rawByClean[sanitizeNodeName(nd.name)] = nd.name; });
          } catch (e) { /* fall back to o.name below */ }
          gltf.scene.traverse(function (o) {
            // Z-Anatomy GLBs carry various non-mesh primitives (loose edges,
            // exported skeleton rig bones-as-mesh, helper points, etc.) that
            // render as bright thin "sticks" shooting out of the body. Hide
            // everything that isn't a real Mesh, and force wireframe off on
            // any mesh that came in with it.
            if (o.isLine || o.isLineSegments || o.isLineLoop || o.isPoints) {
              o.visible = false;
              return;
            }
            if (!o.isMesh || !o.geometry) {
              // Bone / SkeletonHelper / Group are fine — they don't render.
              return;
            }
            // Skip meshes whose geometry is a line set (mode 1/2/3 in glTF →
            // Three.js may still wrap as a Mesh in some loaders) or has no
            // index/position. Detect by checking for any non-degenerate face.
            var posAttr = o.geometry.attributes && o.geometry.attributes.position;
            if (!posAttr || posAttr.count < 3) {
              o.visible = false;
              return;
            }
            // Force-disable wireframe on the original material (will be replaced
            // by makeXrayMaterial below, but guard belt-and-braces).
            if (o.material && !Array.isArray(o.material) && o.material.wireframe) {
              o.material.wireframe = false;
            }
            o.material = makeXrayMaterial(style);
            // Tag every named mesh as an individual hit-testable region. Recover
            // the raw anatomical node name (with its .l/.r/.j marker) from the
            // parser json; fall back to the sanitized name or a named ancestor.
            var rawName = rawByClean[o.name] || (o.parent && rawByClean[o.parent.name]) || o.name || (o.parent && o.parent.name) || '';
            var p = parseAnatName(name, rawName);
            if (!p.baseSlug) return;     // garbage / unnamed mesh → not clickable
            o.userData.regionId = p.regionId;
            o.userData.baseSlug = p.baseSlug;
            o.userData.displayEn = p.displayEn;
            o.userData.side = p.side;
            o.userData.originalName = rawName;
            o.userData.layer = name;
            // tag the sub-layer (organ) from the registry so toggleSubLayer can
            // filter this mesh (e.g. organs_stomach → organ 'gi-tract'). Untagged
            // meshes (generic bones / peripheral nerves) stay in the layer default.
            var _organ = assignOrganTag(p.baseSlug, name); if (_organ) o.userData.organ = _organ;
            // nervous CNS (brain/brainstem/cerebellum/cord nuclei) is the parallel
            // brain-detail session's domain — render it, but don't hit-test it here.
            if (name === 'nervous' && cns[rawName]) o.userData.isBrain = true;
            tagged++;
          });
          console.log('[BodyAtlas] ' + name + ': ' + tagged + ' named regions');
          grp.add(gltf.scene);
          self._swapRealLayer(name, grp);
          self._emit('layer-loaded', { layer: name, regions: tagged });
          if (self._requestRender) self._requestRender();
          resolve(grp);
        }, undefined, function (err) {
          console.warn('[BodyAtlas] real layer load failed: ' + name, err);
          self._emit('layer-error', { layer: name });
          resolve(null);
        });
      });
    });
    return this._real[name];
  };

  Atlas.prototype._swapRealLayer = function (name, grp) {
    if (this._destroyed) return;
    var old = this._layers[name];
    if (old && old.parent) old.parent.remove(old);   // drop procedural capsule
    this.root.add(grp);
    this._layers[name] = grp;
    var st = this._layerState[name] || { visible: false, opacity: (LAYER_STYLE[name] && LAYER_STYLE[name].opacity) || 0.5 };
    grp.visible = !!st.visible;
    this.setLayerOpacity(name, st.opacity != null ? st.opacity : 0.5);
    // nervous GLB just landed — if the brain-detail GLB is already in, re-run the
    // duplicate-hide (it may have loaded first) and sync the brain group to nervous.
    if (name === 'nervous') {
      this._hideNervousBrainDupes();
      if (this._brainRealGroup) this._brainRealGroup.visible = !!st.visible;
    }
  };

  Atlas.prototype.setLayerOpacity = function (name, opacity) {
    var grp = this._layers[name]; if (!grp) return;
    var T = window.THREE;
    opacity = Math.max(0, Math.min(1, opacity));
    if (this._layerState[name]) this._layerState[name].opacity = opacity;
    // PACK 8: at the very top of the slider (100%) render the layer as a SOLID,
    // fully-opaque surface (normal blending + depth write so it occludes); below
    // 100% keep the holographic x-ray (additive, see-through).
    var solid = opacity >= 0.999;
    grp.traverse(function (o) {
      if (!o.material) return;
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(function (mt) {
        if (mt.uniforms && mt.uniforms.uOpacity) {
          mt.uniforms.uOpacity.value = opacity * ((o.userData && o.userData.baseOpacity) ? o.userData.baseOpacity * 2 : 1);
          if (mt.uniforms.uSolid) mt.uniforms.uSolid.value = solid ? 1.0 : 0.0;
          var wantBlend = solid ? T.NormalBlending : T.AdditiveBlending;
          if (mt.blending !== wantBlend) { mt.blending = wantBlend; mt.needsUpdate = true; }
          mt.depthWrite = solid;
          mt.transparent = !solid;
        } else {
          mt.opacity = opacity;
          mt.transparent = !solid;
        }
      });
    });
    if (this._requestRender) this._requestRender();
  };

  // ── modes ──────────────────────────────────────────────────────────────────
  Atlas.prototype.setMode = function (mode) { this.mode = mode; this._applyMode(mode); };

  Atlas.prototype._applyMode = function (mode) {
    if (!this.controls) return;
    if (mode === 'sensation-picker') {
      this.controls.enableRotate = false;
      this.controls.enableZoom = false;
      this.camera.position.set(0, 0.1, 3.2);
      this.controls.target.set(0, 0, 0);
      // sensation-picker legacy mode: skin layer is removed, hide all anatomy
      var self = this;
      if (self._layers.skin) self._layers.skin.visible = false;
      ['muscles', 'skeleton', 'nervous', 'vessels', 'organs'].forEach(function (n) { if (self._layers[n]) self.toggleLayer(n, false); });
    } else if (mode === 'brain-detail') {
      this.enterBrainDetail();
    } else { // full
      this.controls.enableRotate = true;
      this.controls.enableZoom = true;
    }
  };

  Atlas.prototype.setRotation = function (yawDeg, pitchDeg) {
    if (!this.root) return;
    this.root.rotation.y = (yawDeg || 0) * Math.PI / 180;
    this.root.rotation.x = (pitchDeg || 0) * Math.PI / 180;
  };

  // sensation-picker front/back toggle
  Atlas.prototype.flipView = function () {
    this._frontView = !this._frontView;
    this.setRotation(this._frontView ? 0 : 180, 0);
    return this._frontView;
  };

  Atlas.prototype.resetView = function () {
    if (!this.controls) return;
    this.root.rotation.set(0, 0, 0);
    this.camera.position.set(0, 0.1, 4.2);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.resetRegions();   // B8: "Reset view" also restores per-region overrides
  };

  // ── B8: per-region visibility / opacity overrides ──────────────────────────
  // Region ids are the per-mesh userData.regionId (e.g. 'frontal-lobe', 'heart',
  // 'biceps-l'). A region may be several meshes (left/right, sub-parts); all are
  // updated together. State lives in this._regionStates so it survives repaints
  // until resetRegions().
  Atlas.prototype._forEachRegionMesh = function (regionId, cb) {
    if (!this.root) return;
    // Skeleton/organs GLBs tag the region on parent Groups OR descendants OR
    // siblings with various id flavours (regionId / baseSlug / coarseId /
    // originalName). Match all of them and use the cheap normalised form so
    // case/separators differences don't bite us.
    function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[-_\s]+/g, ''); }
    // Expand a seed-id (e.g. 'heart','kidneys','lumbar-spine') into its real mesh
    // tokens via SEED_REGION_INFO so per-region ops (setRegionVisible/Opacity, the
    // mini-viewer) hit the same meshes focusRegions does. Unregistered ids match
    // only themselves.
    var targets = {};
    this._expandSeedIds([regionId]).forEach(function (t) { var k = norm(t); if (k) targets[k] = 1; });
    function udMatch(ud) {
      if (!ud) return false;
      if (targets[norm(ud.regionId)]) return true;
      if (targets[norm(ud.baseSlug)]) return true;
      if (targets[norm(ud.coarseId)]) return true;
      if (targets[norm(ud.originalName)]) return true;
      if (targets[norm(ud.organ)]) return true;   // sub-layer organ groups (muscles, spinal-cord)
      return false;
    }
    // First pass: collect every root node (Mesh or Group) whose own userData
    // matches the target — this includes "regionId on a parent Group" cases.
    var roots = [];
    this.root.traverse(function (o) {
      if (udMatch(o.userData)) roots.push(o);
    });
    // Then walk down each matched root and call cb for every Mesh descendant
    // (covers "regionId on parent" + Mesh leaves under it).
    var seen = new Set ? new Set() : null;
    function visitDown(node) {
      if (node.isMesh) {
        if (seen) {
          if (seen.has(node)) return;
          seen.add(node);
        }
        cb(node);
      }
      if (node.children && node.children.length) {
        for (var i = 0; i < node.children.length; i++) visitDown(node.children[i]);
      }
    }
    roots.forEach(visitDown);
    // Finally walk UP from each Mesh leaf (in case the named ancestor is several
    // levels above but the descendant pass above missed it because the matching
    // userData lives on a sibling-of-ancestor in some exotic GLB layout).
    this.root.traverse(function (o) {
      if (!o.isMesh) return;
      if (seen && seen.has(o)) return;
      var n = o.parent;
      while (n) {
        if (udMatch(n.userData)) {
          if (seen) seen.add(o);
          cb(o);
          return;
        }
        n = n.parent;
      }
    });
  };
  Atlas.prototype._regState = function (regionId) {
    if (!this._regionStates[regionId]) this._regionStates[regionId] = { visible: true, opacity: 1 };
    return this._regionStates[regionId];
  };
  Atlas.prototype.setRegionVisible = function (regionId, visible) {
    visible = visible !== false;
    this._regState(regionId).visible = visible;
    this._forEachRegionMesh(regionId, function (m) { m.visible = visible; });
    if (this._requestRender) this._requestRender();
    return this;
  };
  // opacity slider: k is the ABSOLUTE region opacity 0..1 (k=1 → fully opaque,
  // independent of the layer slider). uGlow still scales from its base so the
  // additive x-ray actually dims.
  Atlas.prototype.setRegionOpacity = function (regionId, k) {
    k = Math.max(0, Math.min(1, k == null ? 1 : k));
    this._regState(regionId).opacity = k;
    var T = window.THREE;
    // At the very top of the per-region slider render the region as a SOLID, fully
    // opaque surface (PACK 8 / PACK D) — the absolute uOpacity is k regardless of where
    // the LAYER slider sits, so a region can read 100% "плотно" even on a 50% layer.
    var solid = k >= 0.999;
    this._forEachRegionMesh(regionId, function (m) {
      var mat = m.material; if (!mat || !mat.uniforms) return;
      var ud = m.userData;
      // Cache the baseline values + the layer-driven render state on first touch so
      // resetRegions / clearRegionOverride can restore them exactly.
      if (mat.uniforms.uOpacity && ud._baseOpacity == null) ud._baseOpacity = mat.uniforms.uOpacity.value;
      if (mat.uniforms.uGlow && ud._baseGlow == null) ud._baseGlow = mat.uniforms.uGlow.value;
      if (ud._baseSolid == null) {
        ud._baseSolid = (mat.uniforms.uSolid ? mat.uniforms.uSolid.value : 0);
        ud._baseBlend = mat.blending;
        ud._baseDepthWrite = mat.depthWrite;
        ud._baseTransparent = mat.transparent;
      }
      // Absolute opacity (k=1 → 1.0). uGlow scales with k so the additive x-ray actually dims.
      if (mat.uniforms.uOpacity) mat.uniforms.uOpacity.value = k;
      if (mat.uniforms.uGlow)    mat.uniforms.uGlow.value    = ud._baseGlow * k;
      // Solid at the top → NormalBlending + depthWrite so it reads opaque, not see-through.
      if (mat.uniforms.uSolid) mat.uniforms.uSolid.value = solid ? 1.0 : 0.0;
      if (T) { var wantBlend = solid ? T.NormalBlending : T.AdditiveBlending; if (mat.blending !== wantBlend) { mat.blending = wantBlend; mat.needsUpdate = true; } }
      mat.depthWrite = solid;
      mat.transparent = !solid;
    });
    if (this._requestRender) this._requestRender();
    return this;
  };
  // Restore a single region's meshes to their layer-driven baseline (opacity, glow AND
  // render mode) and drop its override — used when the region sub-card closes so a
  // bumped-to-opaque region doesn't stay stuck above its layer.
  Atlas.prototype.clearRegionOverride = function (regionId) {
    var T = window.THREE;
    this._forEachRegionMesh(regionId, function (m) {
      var mat = m.material; if (!mat || !mat.uniforms) return;
      var ud = m.userData;
      if (mat.uniforms.uOpacity && ud._baseOpacity != null) mat.uniforms.uOpacity.value = ud._baseOpacity;
      if (mat.uniforms.uGlow && ud._baseGlow != null) mat.uniforms.uGlow.value = ud._baseGlow;
      if (ud._baseSolid != null) {
        if (mat.uniforms.uSolid) mat.uniforms.uSolid.value = ud._baseSolid;
        if (T && mat.blending !== ud._baseBlend) { mat.blending = ud._baseBlend; mat.needsUpdate = true; }
        mat.depthWrite = ud._baseDepthWrite;
        mat.transparent = ud._baseTransparent;
      }
    });
    if (this._regionStates) delete this._regionStates[regionId];
    if (this._requestRender) this._requestRender();
    return this;
  };
  Atlas.prototype.getRegionState = function (regionId) {
    var s = this._regionStates[regionId];
    return { visible: s ? s.visible : true, opacity: s ? s.opacity : 1 };
  };
  Atlas.prototype.resetRegions = function () {
    var self = this;
    Object.keys(this._regionStates).forEach(function (id) {
      self._forEachRegionMesh(id, function (m) {
        m.visible = true;
        var mat = m.material; var ud = m.userData; var T = window.THREE;
        if (mat && mat.uniforms) {
          if (mat.uniforms.uOpacity && ud._baseOpacity != null) mat.uniforms.uOpacity.value = ud._baseOpacity;
          if (mat.uniforms.uGlow && ud._baseGlow != null) mat.uniforms.uGlow.value = ud._baseGlow;
          // restore the layer-driven render mode a per-region "solid" bump may have changed
          if (ud._baseSolid != null) {
            if (mat.uniforms.uSolid) mat.uniforms.uSolid.value = ud._baseSolid;
            if (T && mat.blending !== ud._baseBlend) { mat.blending = ud._baseBlend; mat.needsUpdate = true; }
            mat.depthWrite = ud._baseDepthWrite;
            mat.transparent = ud._baseTransparent;
          }
        }
      });
    });
    this._regionStates = {};
    this._clearFocusState();   // also undo any focus isolate (visibility + opacity boost)
    if (this._requestRender) this._requestRender();
    return this;
  };
  // ── canonical seed-id registry ──────────────────────────────────────────────
  // Single source of truth mapping the human-readable seed ids stored in the API
  // (function.region_ids / condition.affected_region_ids) to the real Z-Anatomy
  // mesh tokens + the layer / organ (sub-layer) they live in, plus a region
  // hierarchy (parent / descendants). The engine — focusRegions, layersForSeedIds,
  // _forEachRegionMesh (→ mini-viewer) — all read from here, so the DB and
  // account.html stay free of any Z-Anatomy naming.
  //
  // Model: Layer → Sub-layer (organ) → Region.  e.g. nervous → brain → frontal-lobe.
  // `layer`        the GLB layer the region's meshes render in
  // `organ`        sub-layer grouping inside that layer (drives layer-panel subtoggles)
  // `parent`       parent seed-id in the hierarchy (null for a top-level region)
  // `aliases`      real mesh tokens to match (focusRegions normalises -/_/case)
  // `descendants`  child seed-ids; _expandSeedIds walks them recursively
  //
  // NOTE: the brain-detail GLB already tags every fine mesh with coarseId === the
  // seed slug (e.g. coarseId:'frontal-lobe'), so focusRegions matches those via the
  // coarseId candidate without per-mesh descendants — `descendants` here is the
  // seed-id hierarchy (for grouping / future tree-view), not a mesh list.
  var SEED_REGION_INFO = {
    // ── brain (sub-layer 'brain' of layer 'nervous') ──
    // descendants are real brain-detail GLB mesh slugs (coarseId-grouped), filled
    // statically from the mesh inventory — they give the Region→mesh hierarchy.
    'cortex':          { layer: 'nervous', organ: 'brain', parent: null, aliases: [], descendants: ['frontal-lobe', 'parietal-lobe', 'temporal-lobe', 'occipital-lobe', 'cingulate', 'insula'] },
    'frontal-lobe':    { layer: 'nervous', organ: 'brain', parent: 'cortex', aliases: ['frontal_lobe'], descendants: ['central_sulcus', 'inferior_frontal_sulcus', 'lat_fis_ant_horizont', 'lat_fis_ant_vertical', 'lat_fis_post', 'middle_frontal_gyrus', 'olfactory_sulcus', 'opercular_part_of_inferior_frontal_gyrus', 'orbital_gyri', 'orbital_gyri_frontomarginal_gyrus_and_sulcus', 'orbital_part_of_inferior_frontal_gyrus', 'orbital_sulci_h_shaped_orbital_sulci', 'orbital_sulci_lateral_orbital_sulcus', 'precentral_gyrus', 'precentral_sulcus_inferior_part', 'precentral_sulcus_superior_part', 'straight_gyrus_gyrus_rectus', 'sulcus_interm_prim_jensen', 'superior_frontal_gyrus', 'superior_frontal_sulcus', 'transverse_frontopolar_gyrus_and_sulcus', 'triangular_part_of_inferior_frontal_gyrus'] },
    'parietal-lobe':   { layer: 'nervous', organ: 'brain', parent: 'cortex', aliases: ['parietal_lobe'], descendants: ['angular_gyrus', 'intraparietal_sulcus', 'paracentral_gyrus_and_sulcus', 'paracentral_sulcus', 'postcentral_gyrus', 'postcentral_sulcus', 'precuneus', 'subparietal_sulcus', 'superior_parietal_lobule', 'supramarginal_gyrus'] },
    'temporal-lobe':   { layer: 'nervous', organ: 'brain', parent: 'cortex', aliases: ['temporal_lobe'], descendants: ['collateral_sulcus', 'inferior_temporal_gyrus', 'inferior_temporal_sulcus', 'lateral_occipitotemporal_gyrus', 'middle_temporal_gyrus', 'occipitotemporal_sulcus_lateral_part', 'posterior_transverse_collateral_sulcus', 'superior_temporal_gyrus_lateral_part', 'superior_temporal_sulcus', 'temporal_plane', 'temporal_pole', 'transverse_temporal_gyri'] },
    'occipital-lobe':  { layer: 'nervous', organ: 'brain', parent: 'cortex', aliases: ['occipital_lobe'], descendants: ['anterior_occipital_sulcus', 'calcarine_sulcus', 'cuneus', 'inferior_occipital_gyrus_and_sulcus', 'lateral_occipital_gyrus_middle_occipital_gyrus', 'lingual_gyrus', 'lunate_sulcus', 'occipital_pole', 'parieto_occipital_sulcus', 'superior_occipital_gyri', 'transverse_occipital_sulcus'] },
    'cingulate':       { layer: 'nervous', organ: 'brain', parent: 'cortex', aliases: ['cingulate'], descendants: ['cingulate_gyrus_and_sulcus_middle_anterior_part', 'cingulate_gyrus_and_sulcus_middle_posterior_part', 'cingulate_gyrus_and_sulcus_posterior_dorsal_part', 'cingulate_gyrus_posteroventral_part', 'cingulate_sulcus_marginal_part'] },
    'insula':          { layer: 'nervous', organ: 'brain', parent: 'cortex', aliases: ['insula'], descendants: ['circular_sulcus_of_insula', 'insula_subcentral_gyrus_and_ant_and_post_sulci'] },

    'brainstem':       { layer: 'nervous', organ: 'brain', parent: null, aliases: [], descendants: ['midbrain', 'pons', 'medulla'] },
    'midbrain':        { layer: 'nervous', organ: 'brain', parent: 'brainstem', aliases: ['midbrain'], descendants: ['aqueduct_of_midbrain', 'base_of_peduncle', 'inferior_colliculus', 'interpeduncular_fossa', 'midbrain', 'peduncle_of_flocculus', 'red_nucleus', 'superior_colliculus'] },
    'pons':            { layer: 'nervous', organ: 'brain', parent: 'brainstem', aliases: ['pons'], descendants: ['pons'] },
    'medulla':         { layer: 'nervous', organ: 'brain', parent: 'brainstem', aliases: ['medulla_oblongata'], descendants: ['inferior_salivatory_nucleus', 'medulla_oblongata', 'nucleus_ambiguus', 'nucleus_of_solitary_tract', 'olive', 'pyramid_of_medulla_oblongata', 'superior_salivatory_nucleus'] },

    'subcortical':     { layer: 'nervous', organ: 'brain', parent: null, aliases: [], descendants: ['thalamus', 'hypothalamus', 'hippocampus', 'amygdala', 'basal-ganglia', 'fornix', 'corpus-callosum'] },
    'thalamus':        { layer: 'nervous', organ: 'brain', parent: 'subcortical', aliases: ['thalamus'], descendants: ['habenula', 'lateral_geniculate_body', 'medial_geniculate_body', 'stria_medullaris_thalami', 'stria_terminalis', 'thalamus'] },
    'hypothalamus':    { layer: 'nervous', organ: 'brain', parent: 'subcortical', aliases: ['hypothalamus'], descendants: ['hypothalamus', 'mamillary_body', 'optic_chiasm', 'optic_tract'] },
    'hippocampus':     { layer: 'nervous', organ: 'brain', parent: 'subcortical', aliases: ['hippocampus'], descendants: ['hippocampal_commissure', 'hippocampus', 'medial_occipitotemporal_gyrus_parahippocampal'] },
    'amygdala':        { layer: 'nervous', organ: 'brain', parent: 'subcortical', aliases: ['amygdala', 'amygdaloid_body'], descendants: ['amygdaloid_body'] },
    'basal-ganglia':   { layer: 'nervous', organ: 'brain', parent: 'subcortical', aliases: ['putamen', 'caudate', 'septal_nuclei', 'globus_pallidus'], descendants: ['caudate_nucleus', 'globus_pallidus', 'lentiform_nucleus', 'putamen', 'septal_nuclei', 'septum_pellucidum'] },
    'fornix':          { layer: 'nervous', organ: 'brain', parent: 'subcortical', aliases: ['fornix'], descendants: ['fornix'] },
    'corpus-callosum': { layer: 'nervous', organ: 'brain', parent: 'subcortical', aliases: ['corpus_callosum'], descendants: ['anterior_commissure', 'corpus_callosum', 'posterior_commissure'] },
    'cerebellum':      { layer: 'nervous', organ: 'brain', parent: null, aliases: ['cerebellum'], descendants: ['anterior_quadrangular_lobule', 'biventral_lobule', 'central_lobule', 'culmen', 'declive', 'flocculus', 'folium_of_vermis', 'gracile_lobule', 'inferior_semilunar_lobule', 'lingula_of_cerebellum', 'nodule_of_vermis', 'posterior_quadrangular_lobule', 'pyramis_of_vermis', 'superior_cerebellar_peduncle', 'superior_semilunar_lobule', 'tonsil_of_cerebellum', 'tuber_of_vermis', 'uvula_of_vermis', 'wing_of_central_lobule'] },

    // ── spinal cord (sub-layer 'spinal-cord' of layer 'nervous') ──
    'spinal-cord':     { layer: 'nervous', organ: 'spinal-cord', parent: null, aliases: ['spinal_cord'] },

    // ── heart (sub-layer 'heart' of layer 'vessels' — the heart is modelled as
    //    chambers in the vessels GLB; there is no single heart organ mesh) ──
    'heart':           { layer: 'vessels', organ: 'heart', parent: null, aliases: [], descendants: ['right-atrium', 'left-atrium', 'right-ventricle', 'left-ventricle'] },
    'right-atrium':    { layer: 'vessels', organ: 'heart', parent: 'heart', aliases: ['right_atrium'] },
    'left-atrium':     { layer: 'vessels', organ: 'heart', parent: 'heart', aliases: ['left_atrium'] },
    'right-ventricle': { layer: 'vessels', organ: 'heart', parent: 'heart', aliases: ['right_ventricle'] },
    'left-ventricle':  { layer: 'vessels', organ: 'heart', parent: 'heart', aliases: ['left_ventricle'] },

    // ── organs ──
    'liver':           { layer: 'organs', organ: 'liver', parent: null, aliases: ['liver'] },
    'lungs':           { layer: 'organs', organ: 'lungs', parent: null, aliases: ['lungs'] },
    'kidneys':         { layer: 'organs', organ: 'kidneys', parent: null, aliases: ['kidney'] },

    // ── GI tract (sub-layer 'gi-tract' of 'organs') — all aliases verified present
    //    in the organs GLB (see /tmp/organs-inventory.json). 'esophagus'/'ileum'
    //    have no mesh (only 'oesophagus'; small bowel is duodenum+jejunum) — kept
    //    as harmless spelling/intent aliases.
    'stomach':         { layer: 'organs', organ: 'gi-tract', parent: null, aliases: ['stomach', 'cardia', 'cardiac_notch', 'pyloric_antrum', 'pyloric_part'] },
    'oesophagus':      { layer: 'organs', organ: 'gi-tract', parent: null, aliases: ['oesophagus', 'esophagus'] },
    'small-intestine': { layer: 'organs', organ: 'gi-tract', parent: null, aliases: ['small_intestine', 'duodenum', 'jejunum', 'ileum'], descendants: ['duodenum', 'jejunum'] },
    'duodenum':        { layer: 'organs', organ: 'gi-tract', parent: 'small-intestine', aliases: ['duodenum'] },
    'jejunum':         { layer: 'organs', organ: 'gi-tract', parent: 'small-intestine', aliases: ['jejunum'] },
    'large-intestine': { layer: 'organs', organ: 'gi-tract', parent: null, aliases: ['large_intestine', 'colon', 'ascending_colon', 'descending_colon', 'transverse_colon', 'sigmoid_colon', 'caecum', 'appendix', 'vermiform_appendix', 'rectum'] },
    'gallbladder':     { layer: 'organs', organ: 'gi-tract', parent: null, aliases: ['gallbladder'] },
    'pancreas':        { layer: 'organs', organ: 'pancreas', parent: null, aliases: ['pancreas'] },
    'thyroid-gland':   { layer: 'organs', organ: 'endocrine', parent: null, aliases: ['thyroid_gland'] },
    'nose':            { layer: 'organs', organ: 'airway', parent: null, aliases: ['nose', 'nasal', 'paranasal'] },

    // ── spine (sub-layer 'spine' of layer 'skeleton') ──
    'spine':           { layer: 'skeleton', organ: 'spine', parent: null, aliases: [], descendants: ['cervical-spine', 'thoracic-spine', 'lumbar-spine', 'sacral-spine'] },
    'cervical-spine':  { layer: 'skeleton', organ: 'spine', parent: 'spine', aliases: ['cervical_vertebrae', 'cervical_vertebra', 'atlas', 'axis_c2', 'dens', 'vertebra_c3', 'vertebra_c4', 'vertebra_c5', 'vertebra_c6', 'vertebra_c7'] },
    'thoracic-spine':  { layer: 'skeleton', organ: 'spine', parent: 'spine', aliases: ['thoracic_vertebrae', 'thoracic_vertebra', 'vertebra_t1', 'vertebra_t2', 'vertebra_t3', 'vertebra_t4', 'vertebra_t5', 'vertebra_t6', 'vertebra_t7', 'vertebra_t8', 'vertebra_t9', 'vertebra_t10', 'vertebra_t11', 'vertebra_t12'] },
    'lumbar-spine':    { layer: 'skeleton', organ: 'spine', parent: 'spine', aliases: ['lumbar_vertebrae', 'lumbar_vertebra', 'vertebra_l1', 'vertebra_l2', 'vertebra_l3', 'vertebra_l4', 'vertebra_l5'] },
    'sacral-spine':    { layer: 'skeleton', organ: 'spine', parent: 'spine', aliases: ['sacrum', 'sacral', 'coccyx', 'coccygeal'] },

    // ── hip joint (sub-layer 'hip' of 'skeleton') — the articulating surfaces.
    //    NOTE: the GLB mesh is 'head_of_femur' (not 'femur_head' as first spec'd).
    'hip':             { layer: 'skeleton', organ: 'hip', parent: null, aliases: ['hip_bone', 'acetabulum', 'head_of_femur'] }
  };
  Atlas.SEED_REGION_INFO = SEED_REGION_INFO;   // expose for tooling / account.html

  // Expand seed-id(s) into the full set of matching keys: each id itself, its
  // mesh-token aliases, and (recursively) its descendant seed-ids. Unknown ids
  // pass through unchanged so the tolerant matcher can still try them.
  Atlas.prototype._expandSeedIds = function (ids) {
    var seen = {}, out = [];
    function visit(i) {
      if (i == null || seen[i]) return;
      seen[i] = 1; out.push(i);
      var info = SEED_REGION_INFO[i];
      if (!info) return;
      (info.aliases || []).forEach(function (a) { if (!seen[a]) { seen[a] = 1; out.push(a); } });
      (info.descendants || []).forEach(visit);
    }
    (ids || []).forEach(visit);
    return out;
  };

  // Which GLB layers are needed to show this set of seed-ids (so account.html can
  // toggle exactly those layers on before focusing). Empty for unregistered ids.
  Atlas.prototype.layersForSeedIds = function (ids) {
    var seen = {};
    this._expandSeedIds(ids).forEach(function (i) {
      var info = SEED_REGION_INFO[i];
      if (info && info.layer) seen[info.layer] = 1;
    });
    return Object.keys(seen);
  };

  // Hybrid focus (powers PACK F): dim every region except `ids` to `dim`
  // opacity and restore the focused ones to full. Pass null/[] to clear.
  // Undo whatever the last focusRegions did: restore each mesh it touched to the EXACT
  // visibility it had before (so a mesh hidden by sub-layer isolation stays hidden, not
  // forced back to true), and drop the opacity boost off the meshes it brightened.
  Atlas.prototype._clearFocusState = function () {
    if (this._focusVis) {
      this._focusVis.forEach(function (it) { it.mesh.visible = it.prior; });
    }
    if (this._focusBoosted) {
      this._focusBoosted.forEach(function (o) {
        var mat = o.material;
        if (mat && mat.uniforms && mat.uniforms.uOpacity && o.userData._baseOpacity != null) mat.uniforms.uOpacity.value = o.userData._baseOpacity;
      });
    }
    this._focusVis = [];
    this._focusBoosted = [];
  };
  Atlas.prototype.focusRegions = function (ids, dim) {
    // ISOLATE (Tahir): focused regions render at full opacity; EVERYTHING ELSE is
    // REMOVED FROM RENDER via mesh.visible=false — NOT dimmed via opacity. A non-focused
    // mesh kept at uOpacity 0 still occupies the z-buffer (and SOLID-mode meshes ignore
    // uOpacity entirely), so it shows as a black silhouette that occludes the focused
    // regions. visible=false renders nothing at all → no occlusion, no black shapes. This
    // makes every layer behave like `organs` (which already focused cleanly). When ids is
    // empty, restore. We record each mesh's prior visibility so the clear is exact.
    if (!this.root) return this;
    var norm = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ''); };
    // Always undo the previous focus first (so re-focusing / clearing is clean).
    this._clearFocusState();
    var hasIds = !!(ids && ids.length);
    if (!hasIds) { if (this._requestRender) this._requestRender(); return this; }
    var expanded = this._expandSeedIds(ids);   // seed-ids → ids + aliases + descendants
    var set = {}; expanded.forEach(function (i) { var k = norm(i); if (k) set[k] = 1; });
    // Pass 1: classify every region mesh (curated ids are bare slugs; match tolerantly).
    var items = [], matchCount = 0;
    this.root.traverse(function (o) {
      if (!o.isMesh || !o.userData || !o.userData.regionId) return;
      var mat = o.material; if (!mat || !mat.uniforms || !mat.uniforms.uOpacity) return;
      var ud = o.userData;
      if (ud._baseOpacity == null) ud._baseOpacity = mat.uniforms.uOpacity.value;
      var on = false;
      var bare = (ud.layer && ud.baseSlug) ? String(ud.baseSlug).replace(new RegExp('^' + ud.layer + '_'), '') : ud.baseSlug;
      // ud.organ lets an organ-level seed ('lungs','kidneys','liver','pancreas','heart',
      // 'spinal-cord','hip','spine') match EVERY mesh of that organ — assignOrganTag
      // already tags all 65 lung lobes/segments as 'lungs', etc. — so the whole organ
      // lights up, not just the single coarse mesh. Sub-organ seeds whose name ≠ the
      // organ tag (stomach→gi-tract, nose→airway, cervical-spine→spine) don't over-match.
      var cands = [ud.regionId, ud.baseSlug, ud.coarseId, bare, ud.organ];
      for (var ci = 0; ci < cands.length; ci++) { if (cands[ci] && set[norm(cands[ci])]) { on = true; break; } }
      if (!on && bare) {
        var toks = String(bare).split('_');
        for (var ti = 0; ti < toks.length; ti++) { if (toks[ti].length >= 4 && set[norm(toks[ti])]) { on = true; break; } }
      }
      if (on) matchCount++;
      items.push({ o: o, mat: mat, ud: ud, on: on });
    });
    // Guard: focus requested but NOTHING matched (ids didn't resolve to a loaded mesh) →
    // don't blank the scene; leave everything as-is.
    if (matchCount === 0) { if (this._requestRender) this._requestRender(); return this; }
    var visChanges = [], boosted = [];
    items.forEach(function (it) {
      if (it.on) {
        it.mat.uniforms.uOpacity.value = 1.0; boosted.push(it.o);            // bright highlight
        if (it.o.visible !== true) { visChanges.push({ mesh: it.o, prior: it.o.visible }); it.o.visible = true; }
      } else if (it.o.visible !== false) {
        visChanges.push({ mesh: it.o, prior: it.o.visible }); it.o.visible = false;   // remove from render
      }
    });
    this._focusVis = visChanges;
    this._focusBoosted = boosted;
    if (this._requestRender) this._requestRender();
    return this;
  };

  // PACK 10: a standalone mini-viewer of one region for the side panel. It CLONES
  // the region's meshes out of the main scene (shares geometry — read-only — and
  // bakes their world transform) into a tiny self-contained scene + renderer +
  // OrbitControls, so there's no second multi-MB GLB download. Returns a handle
  // whose .destroy() frees the mini renderer/controls/materials (NOT the shared
  // geometry, which the main scene still owns). null if the region has no meshes.
  Atlas.prototype.makeRegionMiniViewer = function (container, regionId, size) {
    var T = window.THREE; if (!T || !this.root || !container) return null;
    size = size || 200;
    var src = [];
    this._forEachRegionMesh(regionId, function (m) { if (m.isMesh && m.geometry) src.push(m); });
    if (!src.length) return null;

    var scene = new T.Scene();
    var grp = new T.Group(); scene.add(grp);
    src.forEach(function (m) {
      var col = (m.material && m.material.uniforms && m.material.uniforms.uColor) ? m.material.uniforms.uColor.value.getHex() : COLD_CYAN;
      // SOLID material so the isolated region reads clearly from any angle (the
      // holographic additive x-ray is near-invisible on a small edge-on mesh).
      var mat = makeXrayMaterial({ color: col, opacity: 1.0, glow: 1.0, fresnelPower: 1.7 });
      mat.uniforms.uSolid.value = 1.0; mat.blending = T.NormalBlending; mat.depthWrite = true; mat.transparent = false;
      var c = new T.Mesh(m.geometry, mat);     // SHARE geometry (read-only)
      m.updateWorldMatrix(true, false);
      c.applyMatrix4(m.matrixWorld);           // bake the source's world transform
      grp.add(c);
    });
    // center on origin + size the camera to the bounding sphere
    var box = new T.Box3().setFromObject(grp);
    var ctr = box.getCenter(new T.Vector3()), sz = box.getSize(new T.Vector3());
    grp.position.sub(ctr);
    var radius = Math.max(sz.x, sz.y, sz.z) * 0.5 || 1;

    scene.add(new T.AmbientLight(0x6699aa, 0.7));
    var key = new T.DirectionalLight(0xA8F7FF, 0.85); key.position.set(2, 3, 4); scene.add(key);
    var fill = new T.DirectionalLight(0x8DFFC8, 0.35); fill.position.set(-3, 1, -2); scene.add(fill);

    var cam = new T.PerspectiveCamera(42, 1, 0.01, 100);
    var dist = (radius / Math.sin(42 * Math.PI / 360)) * 1.35;
    cam.position.set(0, 0, dist);

    var rndr = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    rndr.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    rndr.setSize(size, size); rndr.setClearColor(0x000000, 0);
    rndr.domElement.style.display = 'block';
    container.appendChild(rndr.domElement);

    var ctrls = new T.OrbitControls(cam, rndr.domElement);
    ctrls.enableDamping = true; ctrls.dampingFactor = 0.12; ctrls.enablePan = false;
    ctrls.minDistance = dist * 0.5; ctrls.maxDistance = dist * 2.4;
    ctrls.autoRotate = true; ctrls.autoRotateSpeed = 1.1;

    var raf = null, destroyed = false;
    (function loop() { if (destroyed) return; raf = requestAnimationFrame(loop); ctrls.update(); rndr.render(scene, cam); })();

    return {
      destroy: function () {
        if (destroyed) return; destroyed = true;
        if (raf) cancelAnimationFrame(raf);
        try { ctrls.dispose && ctrls.dispose(); } catch (e) {}
        grp.traverse(function (o) { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (mm) { mm.dispose && mm.dispose(); }); } });
        // NB: geometry is shared with the live scene — do NOT dispose it here.
        try { rndr.dispose(); rndr.forceContextLoss && rndr.forceContextLoss(); } catch (e) {}
        if (rndr.domElement && rndr.domElement.parentNode) rndr.domElement.parentNode.removeChild(rndr.domElement);
        scene = grp = cam = rndr = ctrls = null;
      }
    };
  };

  // ── brain detail mode (zoom + body fade) ────────────────────────────────────
  // Brain-detail is no longer a separate mode — the brain lives permanently in the
  // 'nervous' sub-layer. enterBrainDetail/exitBrainDetail are kept as a public
  // camera helper (same signatures + 'brain-enter'/'brain-exit' events) so the
  // «Детальный мозг» button, the click-on-head gesture and the course-player's
  // _haAtlas keep working WITHOUT code changes on their side. They no longer
  // switch layers — they just zoom the camera onto / away from the brain.
  Atlas.prototype.enterBrainDetail = function () {
    if (!this._metrics) return;            // atlas not mounted yet
    this._brainDetail = true;
    this.toggleLayer('nervous', true);     // ensure nervous on → brain group visible + eager-loaded
    this._loadBrainDetail();
    this._frameBrain();                    // orbit-fit on the brain bbox (load callback re-fits once known)
    if (this._requestRender) this._requestRender();
    this._emit('brain-enter', {});
  };

  Atlas.prototype.exitBrainDetail = function () {
    // Zoom the camera back to the body overview. The brain stays in the scene as
    // part of nervous — no layer restore needed (we never hid layers on enter).
    this._brainDetail = false;
    if (this.controls) this.controls.minDistance = 0.4;
    this._tweenCamera(new window.THREE.Vector3(0, 0.1, 4.2), new window.THREE.Vector3(0, 0, 0));
    if (this._requestRender) this._requestRender();
    this._emit('brain-exit', {});
  };

  Atlas.prototype.focusOrgan = function (organId) {
    // organId one of brain region ids or 'heart','liver','lungs','kidneys'
    var target = this._organAnchor(organId);
    if (!target) return;
    ['muscles', 'skeleton', 'nervous', 'vessels', 'organs'].forEach((function (n) { this.toggleLayer(n, false); }).bind(this));
    this.setLayerOpacity('skin', 0.1);
    this.toggleLayer('skin', true);
    this._tweenCamera(target.clone().add(new window.THREE.Vector3(0.4, 0.2, 1.0)), target.clone());
  };

  Atlas.prototype._organAnchor = function (id) {
    var M = this._metrics; if (!M) return null;
    var T = window.THREE;
    var map = {
      heart:   new T.Vector3(-M.width*0.05, M.y(0.72), M.depth*0.1),
      lungs:   new T.Vector3(0, M.y(0.74), 0),
      liver:   new T.Vector3(M.width*0.08, M.y(0.64), M.depth*0.12),
      kidneys: new T.Vector3(0, M.y(0.58), -M.depth*0.12),
      brain:   this._brainCenter ? this._brainCenter.clone() : new T.Vector3(0, M.y(0.94), 0)
    };
    return map[id] || null;
  };

  Atlas.prototype._tweenCamera = function (toPos, toTarget) {
    var self = this, T = window.THREE;
    var fromPos = this.camera.position.clone();
    var fromTgt = this.controls.target.clone();
    var t0 = null, dur = 700;
    function step(ts) {
      if (self._destroyed) return;
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      var e = k < 0.5 ? 2*k*k : 1 - Math.pow(-2*k+2, 2)/2; // easeInOutQuad
      self.camera.position.lerpVectors(fromPos, toPos, e);
      self.controls.target.lerpVectors(fromTgt, toTarget, e);
      self.controls.update();
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };

  // ── hit testing ─────────────────────────────────────────────────────────────
  Atlas.prototype.hitTest = function (screenX, screenY) {
    if (!this.renderer) return null;
    var rect = this.renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((screenX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((screenY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this._mouse, this.camera);
    var targets = this._hittableMeshes();
    var hits = this.raycaster.intersectObjects(targets, true);
    function isVis(m) { var nn = m; while (nn) { if (nn.visible === false) return false; nn = nn.parent; } return true; }
    for (var i = 0; i < hits.length; i++) {
      var o = hits[i].object;
      var node = o;
      while (node && (!node.userData || !node.userData.regionId)) node = node.parent;
      if (!node || !node.userData || !node.userData.regionId) continue;
      // FRONT-MOST wins: return the nearest hit whose mesh + named ancestor are
      // VISIBLE. Hidden meshes (isolation, brain duplicates) aren't clickable, and
      // we never skip a visible front mesh in favour of a deeper "named" one.
      if (!isVis(o) || !isVis(node)) continue;
      return { id: node.userData.regionId, names: this._regionNames(node.userData), object: node, point: hits[i].point, layer: node.userData.layer };
    }
    return null;
  };

  // Resolve a region's display names. Procedural regions carry an explicit
  // userData.names {ru,en,es}; streamed Z-Anatomy meshes resolve on the fly:
  // en = humanized Latin (+ left/right), ru/es from the lazy dictionary (+ a
  // localized side label) — undefined when no translation exists, so the UI
  // honestly shows the Latin term alone rather than a wrong guess.
  Atlas.prototype._regionNames = function (ud) {
    if (ud.names) return ud.names;
    var sideEn = ud.side === 'l' ? ' (left)' : ud.side === 'r' ? ' (right)' : '';
    var en = (ud.displayEn || ud.originalName || ud.regionId) + sideEn;
    var dict = this._anat || {};
    var ru = dict.ru && dict.ru[ud.baseSlug];
    var es = dict.es && dict.es[ud.baseSlug];
    var sideRu = ud.side === 'l' ? ' (левая)' : ud.side === 'r' ? ' (правая)' : '';
    var sideEs = ud.side === 'l' ? ' (izq.)' : ud.side === 'r' ? ' (der.)' : '';
    return { en: en, ru: ru ? ru + sideRu : undefined, es: es ? es + sideEs : undefined };
  };

  Atlas.prototype._hittableMeshes = function () {
    var self = this, arr = [];
    if (this._brainDetail && (this._brainRealGroup || this._brainGroup)) {
      // brain-detail session's domain: prefer the real anatomical brain once it
      // has streamed in, else the procedural brain regions.
      var src = (this._brainRealGroup && this._brainRealGroup.visible) ? this._brainRealGroup : this._brainGroup;
      src.traverse(function (o) { if (o.isMesh && o.userData && o.userData.regionId) arr.push(o); });
      return arr;
    }
    // Every visible loaded layer contributes its named meshes — generic per-mesh
    // hit-testing across skin/muscles/skeleton/nervous/vessels/organs.
    Object.keys(this._layers).forEach(function (ln) {
      if (ln === 'brain') return;            // brain only in detail mode (above)
      var grp = self._layers[ln]; if (!grp || !grp.visible) return;
      grp.traverse(function (o) {
        if (!(o.isMesh || o.isGroup)) return;
        if (o.userData && o.userData.regionId) arr.push(o);
      });
    });
    // brain-detail GLB is a permanent (visible) sub-layer of nervous — include its
    // meshes so the brain itself is clickable in the normal body view (it lives in
    // _brainRealGroup, not in _layers).
    if (this._brainRealGroup && this._brainRealGroup.visible) {
      this._brainRealGroup.traverse(function (o) { if (o.isMesh && o.userData && o.userData.regionId) arr.push(o); });
    }
    // skin head → brain entry (procedural skin has no per-mesh regions)
    if (this._layers.skin && this._layers.skin.visible) arr.push(this._layers.skin);
    return arr;
  };

  // ── events ───────────────────────────────────────────────────────────────────
  Atlas.prototype.on = function (ev, fn) { (this._handlers[ev] = this._handlers[ev] || []).push(fn); return this; };
  Atlas.prototype._emit = function (ev, data) { (this._handlers[ev] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.warn(e); } }); };

  Atlas.prototype._bindEvents = function () {
    var self = this, el = this.renderer.domElement;
    this._onMove = function (e) {
      var pt = e.touches ? e.touches[0] : e;
      self._hoverX = pt.clientX; self._hoverY = pt.clientY;
      var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      // skip while camera is moving
      if (self._cameraBusyUntil && now < self._cameraBusyUntil) {
        if (self._lastHit) { self._highlight(null); self._emit('region-hover', null); self._lastHit = null; }
        return;
      }
      // PERF: hard-throttle hover raycasts to ~15Hz. The full hit-test against
      // 2.5–3k named meshes once every 66ms is plenty responsive for a tooltip
      // and ~4× cheaper than running it every animation frame.
      if (self._lastHoverAt && now - self._lastHoverAt < 66) return;
      if (self._hoverRaf) return;
      self._hoverRaf = requestAnimationFrame(function () {
        self._hoverRaf = null;
        if (self._destroyed) return;
        self._lastHoverAt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        var hit = self.hitTest(self._hoverX, self._hoverY);
        el.style.cursor = hit ? 'pointer' : '';
        self._highlight(hit ? hit.object : null);
        self._emit('region-hover', hit);
        self._lastHit = hit;
      });
    };
    this._onClick = function (e) {
      var pt = e.changedTouches ? e.changedTouches[0] : e;
      // PACK 6: ignore the "click" that ends a rotate/pan drag — only a tap that
      // barely moved counts, so the region panel never slides out on its own.
      if (self._downX != null) {
        var ddx = pt.clientX - self._downX, ddy = pt.clientY - self._downY;
        if (ddx * ddx + ddy * ddy > 36) return;   // moved >6px → drag, not a tap
      }
      var hit = self.hitTest(pt.clientX, pt.clientY);
      var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      var isDouble = !!(self._lastClickAt && (now - self._lastClickAt) < 300);
      self._lastClickAt = now;
      if (isDouble) {
        // DOUBLE click → orbit-fit the camera onto the whole containing named
        // region. NO dim/opacity change — the layer slider stays in control, so no
        // sticky darkness. A miss still zooms: toward the nearest visible region,
        // or a generic zoom-in toward the cursor if nothing is near.
        var target = hit;
        if (!target) {
          var pivot = self._pivotFromScreen(pt.clientX, pt.clientY);
          var near = self._nearestVisibleMesh(pivot);
          if (near) {
            target = { object: near, id: near.userData.regionId, names: self._regionNames(near.userData), point: pivot, layer: near.userData.layer };
          } else {
            self._zoomTowardPivot(pivot, 1 / 1.3);   // generic zoom-in toward cursor
            return;
          }
        }
        var ud = target.object && target.object.userData ? target.object.userData : {};
        var region = self._meshNamedRegion(ud) || target.id;
        var meshes = [];
        self._forEachRegionMesh(region, function (m) { if (m.isMesh) meshes.push(m); });
        self.focusCameraOnMeshes(meshes.length ? meshes : (target.object ? [target.object] : []));
        self._emit('region-click', { id: region, names: target.names, object: target.object, point: target.point, layer: target.layer, level: 'region' });
        return;
      }
      // SINGLE click → the specific mesh under the cursor (or empty space).
      if (hit) self._emit('region-click', hit);
      else self._emit('empty-click', { x: pt.clientX, y: pt.clientY });
    };
    el.addEventListener('mousemove', this._onMove);
    el.addEventListener('click', this._onClick);
    el.addEventListener('touchend', this._onClick);

    // ── B2 + B5: zoom-to-cursor with a logarithmic curve ──────────────────────
    // We intercept the wheel in the CAPTURE phase and stopImmediatePropagation so
    // OrbitControls' own dolly never runs (it zooms toward target = pelvis, which
    // was Nick's complaint). We raycast the cursor to find the world point under
    // it and scale both camera and target about that pivot, so the point under the
    // cursor stays fixed while everything zooms around it.
    this._onWheel = function (e) {
      if (!self.camera || !self.controls || self._destroyed) return;
      e.preventDefault(); e.stopImmediatePropagation();
      // mark camera as actively moving so hover raycasts pause for 120ms
      var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      self._cameraBusyUntil = now + 120;
      self._requestRender();
      // PIVOT: world point under the cursor (plane through target ⟂ view) — shared
      // with the pinch handler so desktop wheel and mobile pinch zoom identically.
      var pivot = self._pivotFromScreen(e.clientX, e.clientY);
      var cam = self.camera.position, tgt = self.controls.target;
      var dist = cam.distanceTo(tgt);
      // normalise deltaY across deltaMode (pixel / line / page) +
      // detect Mac trackpad (deltaMode=0 with small per-event deltaY) and boost ~6×
      // so a single two-finger swipe actually zooms; regular mouse wheels stay calm.
      var dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= 100;
      else if (Math.abs(dy) < 50) dy *= 6;   // trackpad boost
      // clamp per-event to avoid huge jumps from accidentally giant deltas
      dy = Math.max(-300, Math.min(300, dy));
      var scale = Math.exp(dy * 0.0012);
      // PINCH CLAMP: a single ctrl+wheel pinch event (Chrome mobile + desktop
      // trackpad pinch) can carry a large deltaY that maps to a 30%+ zoom in
      // one go → 'first pinch teleports me' effect. Pinches fire many events
      // per gesture, so clamping each one to ±3% lets the gesture accumulate
      // smoothly without ever jumping. Plain wheel-scroll (e.ctrlKey=false)
      // keeps the full sensitivity for desktop.
      if (e.ctrlKey) {
        scale = Math.max(0.97, Math.min(1.03, scale));
      }
      var newDist = Math.max(self.controls.minDistance, Math.min(self.controls.maxDistance, dist * scale));
      scale = dist > 1e-5 ? newDist / dist : 1;
      cam.sub(pivot).multiplyScalar(scale).add(pivot);
      tgt.sub(pivot).multiplyScalar(scale).add(pivot);
    };
    el.addEventListener('wheel', this._onWheel, { capture: true, passive: false });

    // ── B3: Shift+drag → pan (pan is always enabled; see _startLoop)
    this._onPointerDown = function (e) {
      var T = window.THREE;
      // remember where the press started so _onClick can tell a deliberate tap
      // from the tail end of a rotate/pan drag (PACK 6: panel opens on click only)
      self._downX = e.clientX; self._downY = e.clientY;
      if (e.shiftKey && self.controls && T && T.MOUSE) self.controls.mouseButtons.LEFT = T.MOUSE.PAN;
    };
    this._onPointerUp = function () {
      var T = window.THREE;
      if (self.controls && T && T.MOUSE) self.controls.mouseButtons.LEFT = T.MOUSE.ROTATE;
    };
    el.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointerup', this._onPointerUp);

    this._onResize = function () { self._resize(); };
    window.addEventListener('resize', this._onResize);
  };

  Atlas.prototype._highlight = function (obj) {
    if (this._hl === obj) return;
    if (this._hl && this._hl.material && this._hl.material.uniforms && this._hl.material.uniforms.uGlow) {
      this._hl.material.uniforms.uGlow.value = this._hlPrev;
    }
    this._hl = obj;
    if (obj && obj.material && obj.material.uniforms && obj.material.uniforms.uGlow) {
      this._hlPrev = obj.material.uniforms.uGlow.value;
      obj.material.uniforms.uGlow.value = 2.2;
    }
    // PERF/on-demand: the hover glow is a scene mutation — without a render
    // request the highlight (and its clear) wouldn't paint until the next event.
    if (this._requestRender) this._requestRender();
  };

  Atlas.prototype._resize = function () {
    if (!this.renderer || this._destroyed) return;
    var w = this.container.clientWidth || 600, h = this.container.clientHeight || 600;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this._requestRender();
  };

  // ── render loop (on-demand) ──────────────────────────────────────────────────
  // PERF: render only when something actually changes — camera control update,
  // layer toggle, region focus, resize, GLB load, etc. Static scenes cost 0 GPU.
  Atlas.prototype._startLoop = function () {
    var self = this;
    self._needsRender = true;
    if (self.controls && self.controls.addEventListener) {
      self.controls.addEventListener('change', function () {
        // any controls change (rotate/pan via mouse) → camera-busy window so hover
        // raycasts back off; cleared automatically after 120ms idle.
        var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        self._cameraBusyUntil = now + 120;
        self._requestRender();
      });
      // damping in OrbitControls makes update() return true while easing; keep
      // animating until it settles.
    }
    function frame() {
      if (self._destroyed) return;
      self._raf = requestAnimationFrame(frame);
      var dirty = false;
      if (self.controls) {
        // pan is always enabled (enablePan set true at init) — the user must be
        // able to drag from leg to head at any zoom level. (Previously gated to
        // d < baseDist/1.5, which silently disabled pan at the default overview.)
        if (self.controls.update()) dirty = true;
      }
      if (self._needsRender || dirty) {
        self._needsRender = false;
        self.renderer.render(self.scene, self.camera);
      }
    }
    frame();

    // ── CUSTOM PINCH (replaces OrbitControls' DOLLY_PAN which had a first-event
    // teleport bug on Chrome mobile: touchstart could capture pinch distance
    // before both fingers fully registered, and the touchmove ratio divided
    // by that near-zero → camera flew off-screen). Our handler captures state
    // ONCE on touchstart, computes absolute ratio from initial → current pinch
    // each move, hard-clamps the ratio to 0.3..3.0.
    var _pinch = null;
    var el = self.renderer.domElement;
    this._onTouchStart = function (e) {
      if (e.touches && e.touches.length === 2) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var t0 = e.touches[0], t1 = e.touches[1];
        var dx = t1.clientX - t0.clientX, dy = t1.clientY - t0.clientY;
        // PIVOT: the world point under the MIDPOINT between the two fingers, via
        // the same plane projection desktop wheel uses — so pinch zooms toward
        // where the fingers are, not the model centre.
        var midX = (t0.clientX + t1.clientX) / 2, midY = (t0.clientY + t1.clientY) / 2;
        _pinch = {
          dist: Math.max(50, Math.hypot(dx, dy)),  // floor 50px prevents /0
          midX: midX, midY: midY,                  // screen midpoint at start (for pan)
          camPos: self.camera.position.clone(),
          target: self.controls.target.clone(),
          pivot: self._pivotFromScreen(midX, midY)
        };
      }
    };
    this._onTouchMove = function (e) {
      if (e.touches && e.touches.length === 2 && _pinch) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var T = window.THREE;
        var t0 = e.touches[0], t1 = e.touches[1];
        var dx = t1.clientX - t0.clientX, dy = t1.clientY - t0.clientY;
        var curDist = Math.max(50, Math.hypot(dx, dy));
        var curMidX = (t0.clientX + t1.clientX) / 2, curMidY = (t0.clientY + t1.clientY) / 2;
        // ── ZOOM: distance ratio → scale the captured (camera,target) pair about
        // the finger-midpoint pivot. Absolute from the start state → no drift.
        // hard clamp 0.3x..3x prevents the first-event teleport.
        var ratio = Math.max(0.3, Math.min(3.0, curDist / _pinch.dist));
        var pivot = _pinch.pivot;
        var scale = 1 / ratio;
        var startDist = _pinch.camPos.distanceTo(_pinch.target);
        var minD = self.controls.minDistance || 0.4, maxD = self.controls.maxDistance || 20;
        var newDist = Math.max(minD, Math.min(maxD, startDist * scale));
        scale = startDist > 1e-5 ? newDist / startDist : 1;
        var cam = _pinch.camPos.clone().sub(pivot).multiplyScalar(scale).add(pivot);
        var tgt = _pinch.target.clone().sub(pivot).multiplyScalar(scale).add(pivot);
        // ── PAN: midpoint screen-delta → world translation along the camera's
        // right/up axes, applied to BOTH camera and target (two-finger pan, the
        // standard 3D-viewer gesture). Absolute from the captured start midpoint.
        var rect = el.getBoundingClientRect();
        var vh = rect.height || el.clientHeight || 1;
        var fov = (self.camera.fov || 38) * Math.PI / 180;
        var worldPerPx = (2 * startDist * Math.tan(fov / 2)) / vh;   // world units per screen pixel at the target plane
        var dxS = curMidX - _pinch.midX, dyS = curMidY - _pinch.midY; // screen delta (dyS>0 = fingers moved DOWN)
        var right = new T.Vector3().setFromMatrixColumn(self.camera.matrix, 0);
        var up = new T.Vector3().setFromMatrixColumn(self.camera.matrix, 1);
        // "Grab the model" (Google-Maps style): the content follows the fingers —
        // drag up → the model moves UP on screen (camera moves the opposite way).
        var pan = right.multiplyScalar(-dxS * worldPerPx).add(up.multiplyScalar(dyS * worldPerPx));
        cam.add(pan); tgt.add(pan);
        self.camera.position.copy(cam);
        self.controls.target.copy(tgt);
        self._cameraBusyUntil = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) + 120;
        self._requestRender();
      }
    };
    this._onTouchEnd = function (e) {
      if (!e.touches || e.touches.length < 2) _pinch = null;
    };
    el.addEventListener('touchstart', this._onTouchStart, { capture: true, passive: false });
    el.addEventListener('touchmove', this._onTouchMove, { capture: true, passive: false });
    el.addEventListener('touchend', this._onTouchEnd, { capture: true, passive: false });
    el.addEventListener('touchcancel', this._onTouchEnd, { capture: true, passive: false });
  };

  Atlas.prototype._requestRender = function () {
    this._needsRender = true;
  };

  // Project a screen point (clientX/clientY) onto a world pivot: the plane through
  // controls.target perpendicular to the view direction. Shared by the desktop
  // wheel and the mobile pinch so both "zoom toward the point under the
  // cursor/fingers" identically. Falls back to controls.target if the ray misses
  // or lands implausibly far from the model (>5 units from origin — guards the
  // mobile "first event before getBoundingClientRect settles" teleport bug).
  Atlas.prototype._pivotFromScreen = function (clientX, clientY) {
    var T = window.THREE;
    var fallback = this.controls.target.clone();
    var el = this.renderer && this.renderer.domElement;
    if (!T || !el) return fallback;
    var rect = el.getBoundingClientRect();
    var rw = rect.width || el.clientWidth, rh = rect.height || el.clientHeight;
    if (!(rw > 0 && rh > 0)) return fallback;
    this._mouse.set(((clientX - rect.left) / rw) * 2 - 1, -((clientY - rect.top) / rh) * 2 + 1);
    this.raycaster.setFromCamera(this._mouse, this.camera);
    var camDir = new T.Vector3();
    this.camera.getWorldDirection(camDir);                       // unit vector camera → scene
    var plane = new T.Plane(camDir.clone().multiplyScalar(-1),   // normal points back at camera
                            camDir.dot(this.controls.target));   // passes through target
    var hitPt = new T.Vector3();
    if (!this.raycaster.ray.intersectPlane(plane, hitPt)) return fallback;
    var d = hitPt.length();
    return (d < 5.0 && isFinite(d)) ? hitPt.clone() : fallback;
  };

  // ── reconfigure (render) ─────────────────────────────────────────────────────
  Atlas.prototype.render = function (opts) {
    opts = opts || {};
    if (opts.mode) this.setMode(opts.mode);
    if (opts.layers) { this.opts.layers = opts.layers; this._applyLayerConfig(); }
    if (opts.rotation === 'fixed') { if (this.controls) this.controls.enableRotate = false; }
    if (opts.hitMap) this.hitMap = opts.hitMap;
    this._resize();
    return this;
  };

  Atlas.prototype.setSex = function (sex) {
    this.sex = sex;   // single mesh available; hook kept for female asset when added
    this._emit('sex-change', { sex: sex });
  };

  Atlas.prototype.destroy = function () {
    this._destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._hoverRaf) cancelAnimationFrame(this._hoverRaf);
    var el = this.renderer && this.renderer.domElement;
    if (el) {
      el.removeEventListener('mousemove', this._onMove);
      el.removeEventListener('click', this._onClick);
      el.removeEventListener('touchend', this._onClick);
      if (this._onWheel) el.removeEventListener('wheel', this._onWheel, { capture: true });
      if (this._onPointerDown) el.removeEventListener('pointerdown', this._onPointerDown);
      try {
        if (this._onTouchStart) el.removeEventListener('touchstart', this._onTouchStart, { capture: true });
        if (this._onTouchMove) el.removeEventListener('touchmove', this._onTouchMove, { capture: true });
        if (this._onTouchEnd) {
          el.removeEventListener('touchend', this._onTouchEnd, { capture: true });
          el.removeEventListener('touchcancel', this._onTouchEnd, { capture: true });
        }
      } catch (e) {}
    }
    if (this._onPointerUp) window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('resize', this._onResize);
    // B10: dispose every GPU resource (geometry / material / textures) before
    // dropping the renderer, so leaving the atlas frees memory and the next tool
    // (e.g. External Field) isn't starved / janky.
    if (this.scene) this.scene.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) {
        if (m.map) m.map.dispose();
        for (var k in m) { var v = m[k]; if (v && v.isTexture) v.dispose(); }
        m.dispose();
      });
    });
    if (this.scene && this.scene.clear) this.scene.clear();
    if (this.controls && this.controls.dispose) this.controls.dispose();
    if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss && this.renderer.forceContextLoss(); if (el && el.parentNode) el.parentNode.removeChild(el); }
    // B10: drop layer/brain caches so nothing keeps the old meshes alive.
    this._layers = {}; this._loadedLayers = {}; this._layerState = {};
    this._brainGroup = null; this._brainDetailMesh = null; this._brainMeshes = null;
    this.scene = this.camera = this.renderer = this.controls = this.root = null;
  };

  // ── public module ────────────────────────────────────────────────────────────
  var _instances = [];
  window.BodyAtlas = {
    REGIONS: BRAIN_REGIONS,
    SENSATION_REGION_MAP: SENSATION_REGION_MAP,
    init: function (container, options) {
      var a = new Atlas(container, options);
      _instances.push(a);
      return a.init();
    },
    // convenience: render(container, opts) — init-or-reconfigure
    render: function (container, opts) {
      if (container && container.__atlas) { container.__atlas.render(opts); return Promise.resolve(container.__atlas); }
      return this.init(container, opts).then(function (a) { container.__atlas = a; return a; });
    },
    ensureThree: ensureThree,
    _instances: _instances
  };
})();
