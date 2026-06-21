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
        '  gl_FragColor = vec4(outC, outA);',
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

    // PERF: on hi-DPI (retina) desktops the x-ray shader is fill-rate bound.
    // Disable MSAA (FXAA-free anyway, the wireframe carries edge detail) and
    // render at native 1.0 DPR — this cuts fragment work ~4× on a 2× retina.
    var isHiDPI = (window.devicePixelRatio || 1) >= 1.5;
    this.renderer = new T.WebGLRenderer({ antialias: !isHiDPI, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1.0);
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
    // enableZoom stays ON so touch pinch-zoom keeps working (toward target). The
    // desktop WHEEL is intercepted in capture phase for zoom-to-cursor (B2).
    this.controls.enableZoom = true;
    // B3: panning is allowed but only takes effect once zoomed in (>1.5x), gated
    // each frame in the render loop. screen-space panning feels natural here.
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.target.set(0, 0, 0);
    this._baseDist = this.camera.position.distanceTo(this.controls.target); // reference for "zoom factor"
    // default mouse map: left = rotate. Shift+drag temporarily becomes pan (B3).
    if (T.MOUSE) this.controls.mouseButtons = { LEFT: T.MOUSE.ROTATE, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.PAN };
    // two-finger touch = pan + pinch-zoom (pinch handled by our wheel-equivalent below)
    if (T.TOUCH) this.controls.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN };

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
              group: info ? info.group : '', layer: 'brain', brain: true, baseOpacity: 0.5
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
          grp.visible = !!self._brainDetail;
          self._emit('brain-loaded', { regions: meshes.length });
          // re-frame if we're already inside brain-detail
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
    this._emit('layer-change', { layer: name, visible: visible });
    if (this._requestRender) this._requestRender();
  };

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
            if (!(o.isMesh && o.geometry)) return;
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
    this.root.traverse(function (o) {
      if (!o.isMesh || !o.userData) return;
      var ud = o.userData;
      if (ud.regionId === regionId || ud.baseSlug === regionId) cb(o);
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
  // opacity is a 0..1 multiplier of the region's base x-ray opacity.
  Atlas.prototype.setRegionOpacity = function (regionId, k) {
    k = Math.max(0, Math.min(1, k == null ? 1 : k));
    this._regState(regionId).opacity = k;
    this._forEachRegionMesh(regionId, function (m) {
      var mat = m.material; if (!mat || !mat.uniforms || !mat.uniforms.uOpacity) return;
      if (m.userData._baseOpacity == null) m.userData._baseOpacity = mat.uniforms.uOpacity.value;
      mat.uniforms.uOpacity.value = m.userData._baseOpacity * k;
    });
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
        var mat = m.material;
        if (mat && mat.uniforms && mat.uniforms.uOpacity && m.userData._baseOpacity != null) {
          mat.uniforms.uOpacity.value = m.userData._baseOpacity;
        }
      });
    });
    this._regionStates = {};
    return this;
  };
  // Hybrid focus (powers PACK F): dim every region except `ids` to `dim`
  // opacity and restore the focused ones to full. Pass null/[] to clear.
  Atlas.prototype.focusRegions = function (ids, dim) {
    dim = dim == null ? 0.1 : dim;
    // PACK 12: curated condition/function region ids are BARE anatomical slugs
    // ('liver', 'medulla', 'stomach', 'frontal-lobe') while real mesh ids are
    // layer-prefixed with underscores ('organs_liver', 'brain' coarseId). Match
    // tolerantly — normalize (drop -/_/case) and also try the layer-stripped bare
    // slug + each of its word tokens — so the affected regions light up at full
    // opacity and only the rest dim, instead of dimming (or showing) everything.
    var norm = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ''); };
    var set = {}; (ids || []).forEach(function (i) { var k = norm(i); if (k) set[k] = 1; });
    var hasIds = ids && ids.length;
    if (!this.root) return this;
    this.root.traverse(function (o) {
      if (!o.isMesh || !o.userData || !o.userData.regionId) return;
      var mat = o.material; if (!mat || !mat.uniforms || !mat.uniforms.uOpacity) return;
      if (o.userData._baseOpacity == null) o.userData._baseOpacity = mat.uniforms.uOpacity.value;
      var ud = o.userData;
      var on = false;
      // exact / coarse / layer-stripped bare candidates
      var bare = (ud.layer && ud.baseSlug) ? String(ud.baseSlug).replace(new RegExp('^' + ud.layer + '_'), '') : ud.baseSlug;
      var cands = [ud.regionId, ud.baseSlug, ud.coarseId, bare];
      for (var ci = 0; ci < cands.length; ci++) { if (cands[ci] && set[norm(cands[ci])]) { on = true; break; } }
      // token fallback: a focus id that is a whole word of the bare slug
      // (≥4 chars to avoid spurious short-token hits like 'of'/'the')
      if (!on && bare) {
        var toks = String(bare).split('_');
        for (var ti = 0; ti < toks.length; ti++) { if (toks[ti].length >= 4 && set[norm(toks[ti])]) { on = true; break; } }
      }
      mat.uniforms.uOpacity.value = ud._baseOpacity * (on ? 1 : (hasIds ? dim : 1));
    });
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
  Atlas.prototype.enterBrainDetail = function () {
    if (!this._metrics) return;            // atlas not mounted yet
    this._brainDetail = true;
    var bodyLayers = ['muscles', 'skeleton', 'nervous', 'vessels', 'organs'];
    // PACK 7: snapshot which body layers were on so exitBrainDetail can restore
    // them (was previously dropping everything back to skin-only on exit).
    var snap = {}; var self = this;
    bodyLayers.forEach(function (n) { snap[n] = !!(self._layerState[n] && self._layerState[n].visible); });
    this._layerStateBeforeBrainDetail = snap;
    // No procedural brain preview anymore — the real Z-Anatomy brain-detail GLB
    // is the only brain. Show it if already streamed, else kick off the lazy
    // load; the load callback frames the camera once its bbox is known.
    if (this._brainRealGroup) this._brainRealGroup.visible = true;
    this._loadBrainDetail();
    bodyLayers.forEach(function (n) { self.toggleLayer(n, false); });
    this._frameBrain();
    if (this._requestRender) this._requestRender();
    this._emit('brain-enter', {});
  };

  Atlas.prototype.exitBrainDetail = function () {
    this._brainDetail = false;
    if (this._brainRealGroup) this._brainRealGroup.visible = false;
    // PACK 7: restore the exact body-layer visibility from before we entered
    // brain detail (fall back to skin-only if there's no snapshot).
    var snap = this._layerStateBeforeBrainDetail;
    var self = this;
    if (snap) {
      ['muscles', 'skeleton', 'nervous', 'vessels', 'organs'].forEach(function (n) {
        self.toggleLayer(n, !!snap[n]);
      });
    } else {
      // skin layer is removed — nothing to restore by default
    }
    // Hard-ensure skin stays hidden (legacy mount initializes _layerState.skin.visible=true)
    if (self._layers.skin) self._layers.skin.visible = false;
    if (self._layerState && self._layerState.skin) self._layerState.skin.visible = false;
    this.controls.minDistance = 0.4;
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
    for (var i = 0; i < hits.length; i++) {
      var o = hits[i].object;
      while (o && (!o.userData || !o.userData.regionId)) o = o.parent;
      if (o && o.userData && o.userData.regionId) {
        // CNS meshes are non-interactive outside brain-detail (their geometry is
        // still ray-hit, so skip them here and let the loop continue past).
        if (o.userData.isBrain && !this._brainDetail) continue;
        return { id: o.userData.regionId, names: this._regionNames(o.userData), object: o, point: hits[i].point, layer: o.userData.layer };
      }
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
      // PERF: throttle hover raycasts. The full hit-test (2.5–3k named meshes)
      // is too expensive to do on every mousemove. We coalesce into rAF AND
      // skip the raycast for ~120ms after any camera/wheel interaction, so
      // rotating/zooming never competes with hover work.
      self._hoverX = pt.clientX; self._hoverY = pt.clientY;
      var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (self._cameraBusyUntil && now < self._cameraBusyUntil) {
        // camera is still moving — clear any tooltip but don't burn cycles raycasting
        if (self._lastHit) { self._highlight(null); self._emit('region-hover', null); self._lastHit = null; }
        return;
      }
      if (self._hoverRaf) return;
      self._hoverRaf = requestAnimationFrame(function () {
        self._hoverRaf = null;
        if (self._destroyed) return;
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
      if (hit) {
        // clicking the head (skin) in full mode → brain detail
        if (false) {  // skin layer removed — head-click trigger disabled; use Brain Detail button
          var localY = hit.point.y;
          if (self._metrics && localY > self._metrics.y(0.86)) { self.enterBrainDetail(); return; }
        }
        self._emit('region-click', hit);
      } else {
        self._emit('empty-click', { x: pt.clientX, y: pt.clientY });
      }
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
      var rect = el.getBoundingClientRect();
      var rw = rect.width || el.clientWidth, rh = rect.height || el.clientHeight;
      var pivot;
      if (rw > 0 && rh > 0) {
        self._mouse.set(((e.clientX - rect.left) / rw) * 2 - 1,
                        -((e.clientY - rect.top) / rh) * 2 + 1);
        self.raycaster.setFromCamera(self._mouse, self.camera);
        var hits = self.root ? self.raycaster.intersectObjects(self.root.children, true) : [];
        if (hits && hits.length) {
          pivot = hits[0].point.clone();
        } else {
          // No mesh under cursor (atlas default scene is empty after skin removal).
          // Project the cursor ray onto a plane through controls.target perpendicular
          // to the camera view direction, so the zoom still pivots toward the visible
          // cursor position rather than the controls.target.
          var T = window.THREE;
          var camDir = new T.Vector3();
          self.camera.getWorldDirection(camDir);
          var plane = new T.Plane(camDir.clone().multiplyScalar(-1), camDir.dot(self.controls.target));
          var hitPt = new T.Vector3();
          pivot = self.raycaster.ray.intersectPlane(plane, hitPt) ? hitPt.clone() : self.controls.target.clone();
        }
      } else {
        pivot = self.controls.target.clone();   // can't locate cursor → plain center zoom
      }
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
      var newDist = Math.max(self.controls.minDistance, Math.min(self.controls.maxDistance, dist * scale));
      scale = dist > 1e-5 ? newDist / dist : 1;
      cam.sub(pivot).multiplyScalar(scale).add(pivot);
      tgt.sub(pivot).multiplyScalar(scale).add(pivot);
    };
    el.addEventListener('wheel', this._onWheel, { capture: true, passive: false });

    // ── B3: Shift+drag → pan (only effective once zoomed past 1.5x, gated in loop)
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
        if (self._baseDist) {
          var d = self.camera.position.distanceTo(self.controls.target);
          self.controls.enablePan = d < self._baseDist / 1.5;
        }
        if (self.controls.update()) dirty = true;
      }
      if (self._needsRender || dirty) {
        self._needsRender = false;
        self.renderer.render(self.scene, self.camera);
      }
    }
    frame();
  };

  Atlas.prototype._requestRender = function () {
    this._needsRender = true;
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
