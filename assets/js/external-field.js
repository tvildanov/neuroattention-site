/* ============================================================================
   External Field — objective external events & environmental parameters.
   Sun / Moon / Earth / Weather / Cosmos / Social / Experimental.
   Raw observational data + value-on-scale visualisations (norm/danger zones),
   NO medical/psychological inference. Tone: factual, scientific, calm.
   Public APIs (NOAA, NASA DONKI, USGS, GraceDB, GDELT, Open-Meteo) + pure-JS
   lunar calc. Weather/AQ/sunrise fetched client-side from Open-Meteo.

   i18n: self-contained dictionary (en/ru/es) read via window.getLang(); the
   widget re-renders on the global `langchange` event.

   window.mountExternalField(container)
   ============================================================================ */
(function () {
  'use strict';

  /* ── i18n ─────────────────────────────────────────────────────────────── */
  var I18N = {
    en: {
      title: 'External Field', sub: 'Objective external events & environmental parameters. Observational data — no interpretation.',
      foot: 'Sources: NOAA SWPC · NASA DONKI · USGS · LIGO/Virgo/KAGRA · GDELT · Open-Meteo. Times in your local timezone.',
      setLoc: 'Set location', subsTitle: 'Subscriptions', loading: 'Loading…',
      tab: { sun: 'Sun', moon: 'Moon', earth: 'Earth', weather: 'Weather', cosmos: 'Cosmos', social: 'Social Events', experimental: 'Experimental' },
      noData: 'Data not available', awaitNext: 'Awaiting next poll cycle.', srcEmpty: 'Source API returned no events in this window.',
      needLoc: 'Available after you set a location.',
      sun: { xray: 'X-ray flux', wind: 'Solar wind', f107: 'F10.7 flux', lastFlare: 'Last flare', lastCME: 'Last CME',
        sunrise: 'Sunrise', sunset: 'Sunset', recent: 'Recent solar events', flares: 'Solar flares', cmes: 'Coronal mass ejections',
        sdoCap: 'Solar Dynamics Observatory — AIA 193 Å (latest)', sdoOpen: 'Open full SDO image ↗',
        windField: 'within typical range', xrayQuiet: 'background / quiet' },
      moon: { phase: 'Phase', illum: 'Illumination', age: 'Lunar age', moonrise: 'Moonrise', moonset: 'Moonset', timeline: 'Lunar timeline',
        days: 'd', computed: 'Computed astronomically (always available).',
        phases: { 'New Moon': 'New Moon', 'Waxing Crescent': 'Waxing Crescent', 'First Quarter': 'First Quarter', 'Waxing Gibbous': 'Waxing Gibbous', 'Full Moon': 'Full Moon', 'Waning Gibbous': 'Waning Gibbous', 'Last Quarter': 'Last Quarter', 'Waning Crescent': 'Waning Crescent' } },
      earth: { kp: 'Planetary Kp', ap: 'Ap index', geomag: 'Geomagnetic field', lastQuake: 'Last earthquake',
        quiet: 'quiet', stormActive: 'storm active', seismic: 'Geomagnetic & seismic events', lastGlobalQuake: 'Latest earthquake M ≥ 4.5 worldwide (USGS)',
        from: 'from you', kpScaleNote: 'Kp 0–9 · G-scale' },
      weather: { temp: 'Temperature', pressure: 'Pressure', humidity: 'Humidity', wind: 'Wind', uv: 'UV index',
        pm25: 'PM2.5', pm10: 'PM10', ozone: 'Ozone', no2: 'NO₂', co: 'CO', air: 'Air quality', last24: 'last 24 h',
        snapshot: 'Weather & air quality by Open-Meteo. Snapshot at load time.', enterLoc: 'Enter your address or coordinates to see local weather and air quality.' },
      cosmos: { note: 'Public gravitational-wave alerts from LIGO/Virgo/KAGRA. Mock-data replays are filtered out. Biological relevance is not assumed.',
        candidates: 'Gravitational-wave candidates', noConfirmed: 'No confirmed candidates right now. Real detections are rare — only during active observing runs.',
        whatQ: 'What is a gravitational wave?', whatA: 'Ripples in spacetime from violent cosmic events — merging black holes or neutron stars. LIGO/Virgo/KAGRA detect them as tiny length changes (far smaller than a proton). They carry no known biological effect; this layer is shown for completeness, not health relevance.',
        cls: { BBH: 'Binary black hole', BNS: 'Binary neutron star', NSBH: 'Neutron star – black hole', Terrestrial: 'Likely terrestrial (noise)', Unknown: 'Unclassified' } },
      social: { note: 'A filtered layer of high-impact world events (conflict, disaster, elections, economic & health crises) from GDELT — not a media feed.',
        events: 'World events' },
      exp: { warn: 'Experimental signals. Data source and biological relevance require validation.',
        schumann: 'Schumann resonance', schDesc: 'Earth–ionosphere cavity resonances. Fundamental 7.83 Hz + harmonics. No validated real-time public feed integrated yet.',
        harmonics: 'Harmonics', emf: 'EMF', emfNote: 'Not implemented for MVP. Requires a user-side mobile scan or self-report.',
        disabled: 'Layer disabled: no validated data source available.', notifyInteg: 'Notify me when integrated', status: 'Status', awaiting: 'awaiting validated source' },
      aqi: { good: 'Good', moderate: 'Moderate', usg: 'Unhealthy (sensitive)', unhealthy: 'Unhealthy', vunhealthy: 'Very unhealthy', hazardous: 'Hazardous' },
      uvz: { low: 'Low', moderate: 'Moderate', high: 'High', vhigh: 'Very high', extreme: 'Extreme' },
      kpz: { quiet: 'Quiet', active: 'Active', g1: 'Minor (G1)', g2: 'Moderate (G2)', g3: 'Strong (G3)', g4: 'Severe (G4)', g5: 'Extreme (G5)' },
      loc: { title: 'Set your location', p: 'Used for local weather, air quality, sunrise/sunset and moonrise. Search a city or enter coordinates.',
        search: 'City or place (e.g. Berlin)', orCoords: 'or coordinates', lat: 'latitude', lon: 'longitude', save: 'Save location', none: 'No matches.', invalid: 'Enter valid coordinates or pick a city.' },
      subs: { title: 'External Field subscriptions', p: 'Choose which layers you track, which appear on your Path of Development, and which send notifications.',
        show: 'show', onPath: 'Show on Path of Development', notify: 'notify', save: 'Save' }
    },
    ru: {
      title: 'Внешнее поле', sub: 'Объективные внешние события и параметры среды. Наблюдательные данные — без интерпретации.',
      foot: 'Источники: NOAA SWPC · NASA DONKI · USGS · LIGO/Virgo/KAGRA · GDELT · Open-Meteo. Время — в вашем часовом поясе.',
      setLoc: 'Указать локацию', subsTitle: 'Подписки', loading: 'Загрузка…',
      tab: { sun: 'Солнце', moon: 'Луна', earth: 'Земля', weather: 'Погода', cosmos: 'Космос', social: 'Соц. события', experimental: 'Экспериментальные' },
      noData: 'Данных пока нет', awaitNext: 'Ожидаем следующий цикл опроса.', srcEmpty: 'Источник не вернул событий в этом окне.',
      needLoc: 'Доступно после указания локации.',
      sun: { xray: 'Рентген. поток', wind: 'Солнечный ветер', f107: 'Поток F10.7', lastFlare: 'Последняя вспышка', lastCME: 'Последний CME',
        sunrise: 'Восход', sunset: 'Закат', recent: 'Недавние солнечные события', flares: 'Солнечные вспышки', cmes: 'Корональные выбросы массы',
        sdoCap: 'Solar Dynamics Observatory — AIA 193 Å (актуальное)', sdoOpen: 'Открыть полное изображение SDO ↗',
        windField: 'в пределах нормы', xrayQuiet: 'фон / спокойно' },
      moon: { phase: 'Фаза', illum: 'Освещённость', age: 'Возраст Луны', moonrise: 'Восход Луны', moonset: 'Заход Луны', timeline: 'Лунная хроника',
        days: 'дн', computed: 'Рассчитано астрономически (доступно всегда).',
        phases: { 'New Moon': 'Новолуние', 'Waxing Crescent': 'Растущий серп', 'First Quarter': 'Первая четверть', 'Waxing Gibbous': 'Растущая Луна', 'Full Moon': 'Полнолуние', 'Waning Gibbous': 'Убывающая Луна', 'Last Quarter': 'Последняя четверть', 'Waning Crescent': 'Убывающий серп' } },
      earth: { kp: 'Планетарный Kp', ap: 'Индекс Ap', geomag: 'Геомагнитное поле', lastQuake: 'Последнее землетрясение',
        quiet: 'спокойно', stormActive: 'идёт буря', seismic: 'Геомагнитные и сейсмические события', lastGlobalQuake: 'Последнее землетрясение M ≥ 4.5 в мире (USGS)',
        from: 'от вас', kpScaleNote: 'Kp 0–9 · шкала G' },
      weather: { temp: 'Температура', pressure: 'Давление', humidity: 'Влажность', wind: 'Ветер', uv: 'УФ-индекс',
        pm25: 'PM2.5', pm10: 'PM10', ozone: 'Озон', no2: 'NO₂', co: 'CO', air: 'Качество воздуха', last24: 'за 24 ч',
        snapshot: 'Погода и качество воздуха — Open-Meteo. Снимок на момент загрузки.', enterLoc: 'Укажите адрес или координаты, чтобы видеть местную погоду и качество воздуха.' },
      cosmos: { note: 'Публичные оповещения о гравитационных волнах от LIGO/Virgo/KAGRA. Тестовые (mock) повторы отфильтрованы. Биологическая значимость не предполагается.',
        candidates: 'Кандидаты гравитационных волн', noConfirmed: 'Сейчас подтверждённых кандидатов нет. Реальные регистрации редки — только во время активных наблюдательных сессий.',
        whatQ: 'Что такое гравитационная волна?', whatA: 'Рябь пространства-времени от мощных космических событий — слияний чёрных дыр или нейтронных звёзд. LIGO/Virgo/KAGRA регистрируют их как крошечные изменения длины (меньше размера протона). Известного биологического эффекта нет; слой показан для полноты, а не как фактор здоровья.',
        cls: { BBH: 'Двойная чёрная дыра', BNS: 'Двойная нейтронная звезда', NSBH: 'Нейтронная звезда – чёрная дыра', Terrestrial: 'Вероятно земной шум', Unknown: 'Без классификации' } },
      social: { note: 'Отфильтрованный слой значимых мировых событий (конфликты, катастрофы, выборы, экономические и медицинские кризисы) из GDELT — не новостная лента.',
        events: 'Мировые события' },
      exp: { warn: 'Экспериментальные сигналы. Источник данных и биологическая значимость требуют валидации.',
        schumann: 'Резонанс Шумана', schDesc: 'Резонансы полости «Земля–ионосфера». Основная частота 7,83 Гц + гармоники. Надёжный публичный поток в реальном времени пока не интегрирован.',
        harmonics: 'Гармоники', emf: 'ЭМП', emfNote: 'Не реализовано в MVP. Требует замера на телефоне пользователя или самоотчёта.',
        disabled: 'Слой отключён: нет проверенного источника данных.', notifyInteg: 'Уведомить, когда появится', status: 'Статус', awaiting: 'ожидается проверенный источник' },
      aqi: { good: 'Хорошо', moderate: 'Умеренно', usg: 'Вредно (чувствит.)', unhealthy: 'Вредно', vunhealthy: 'Очень вредно', hazardous: 'Опасно' },
      uvz: { low: 'Низкий', moderate: 'Умеренный', high: 'Высокий', vhigh: 'Очень высокий', extreme: 'Экстремальный' },
      kpz: { quiet: 'Спокойно', active: 'Активно', g1: 'Слабая (G1)', g2: 'Умеренная (G2)', g3: 'Сильная (G3)', g4: 'Жёсткая (G4)', g5: 'Экстрем. (G5)' },
      loc: { title: 'Укажите локацию', p: 'Нужно для местной погоды, качества воздуха, восхода/заката и восхода Луны. Найдите город или введите координаты.',
        search: 'Город или место (напр. Берлин)', orCoords: 'или координаты', lat: 'широта', lon: 'долгота', save: 'Сохранить локацию', none: 'Совпадений нет.', invalid: 'Введите корректные координаты или выберите город.' },
      subs: { title: 'Подписки на внешнее поле', p: 'Выберите слои, за которыми следите, какие показывать на Пути развития и по каким присылать уведомления.',
        show: 'показать', onPath: 'Показывать на Пути развития', notify: 'уведомлять', save: 'Сохранить' }
    },
    es: {
      title: 'Campo Externo', sub: 'Eventos externos objetivos y parámetros ambientales. Datos observacionales — sin interpretación.',
      foot: 'Fuentes: NOAA SWPC · NASA DONKI · USGS · LIGO/Virgo/KAGRA · GDELT · Open-Meteo. Horas en tu zona local.',
      setLoc: 'Definir ubicación', subsTitle: 'Suscripciones', loading: 'Cargando…',
      tab: { sun: 'Sol', moon: 'Luna', earth: 'Tierra', weather: 'Clima', cosmos: 'Cosmos', social: 'Eventos sociales', experimental: 'Experimental' },
      noData: 'Datos no disponibles', awaitNext: 'Esperando el próximo ciclo de sondeo.', srcEmpty: 'La fuente no devolvió eventos en esta ventana.',
      needLoc: 'Disponible tras definir una ubicación.',
      sun: { xray: 'Flujo de rayos X', wind: 'Viento solar', f107: 'Flujo F10.7', lastFlare: 'Última fulguración', lastCME: 'Última CME',
        sunrise: 'Amanecer', sunset: 'Atardecer', recent: 'Eventos solares recientes', flares: 'Fulguraciones solares', cmes: 'Eyecciones de masa coronal',
        sdoCap: 'Solar Dynamics Observatory — AIA 193 Å (reciente)', sdoOpen: 'Abrir imagen completa de SDO ↗',
        windField: 'dentro del rango típico', xrayQuiet: 'fondo / tranquilo' },
      moon: { phase: 'Fase', illum: 'Iluminación', age: 'Edad lunar', moonrise: 'Salida de la Luna', moonset: 'Puesta de la Luna', timeline: 'Cronología lunar',
        days: 'd', computed: 'Calculado astronómicamente (siempre disponible).',
        phases: { 'New Moon': 'Luna nueva', 'Waxing Crescent': 'Creciente', 'First Quarter': 'Cuarto creciente', 'Waxing Gibbous': 'Gibosa creciente', 'Full Moon': 'Luna llena', 'Waning Gibbous': 'Gibosa menguante', 'Last Quarter': 'Cuarto menguante', 'Waning Crescent': 'Menguante' } },
      earth: { kp: 'Kp planetario', ap: 'Índice Ap', geomag: 'Campo geomagnético', lastQuake: 'Último sismo',
        quiet: 'tranquilo', stormActive: 'tormenta activa', seismic: 'Eventos geomagnéticos y sísmicos', lastGlobalQuake: 'Último sismo M ≥ 4.5 en el mundo (USGS)',
        from: 'de ti', kpScaleNote: 'Kp 0–9 · escala G' },
      weather: { temp: 'Temperatura', pressure: 'Presión', humidity: 'Humedad', wind: 'Viento', uv: 'Índice UV',
        pm25: 'PM2.5', pm10: 'PM10', ozone: 'Ozono', no2: 'NO₂', co: 'CO', air: 'Calidad del aire', last24: 'últimas 24 h',
        snapshot: 'Clima y calidad del aire por Open-Meteo. Instantánea al cargar.', enterLoc: 'Introduce tu dirección o coordenadas para ver el clima local y la calidad del aire.' },
      cosmos: { note: 'Alertas públicas de ondas gravitacionales de LIGO/Virgo/KAGRA. Las repeticiones de datos simulados se filtran. No se asume relevancia biológica.',
        candidates: 'Candidatos de ondas gravitacionales', noConfirmed: 'No hay candidatos confirmados ahora. Las detecciones reales son raras — solo durante campañas de observación activas.',
        whatQ: '¿Qué es una onda gravitacional?', whatA: 'Ondulaciones del espacio-tiempo por eventos cósmicos violentos — fusiones de agujeros negros o estrellas de neutrones. LIGO/Virgo/KAGRA las detectan como cambios de longitud diminutos (mucho menores que un protón). No tienen efecto biológico conocido; esta capa se muestra por completitud, no por relevancia para la salud.',
        cls: { BBH: 'Agujeros negros binarios', BNS: 'Estrellas de neutrones binarias', NSBH: 'Estrella de neutrones – agujero negro', Terrestrial: 'Probable ruido terrestre', Unknown: 'Sin clasificar' } },
      social: { note: 'Una capa filtrada de eventos mundiales de alto impacto (conflictos, desastres, elecciones, crisis económicas y sanitarias) de GDELT — no es un feed de noticias.',
        events: 'Eventos mundiales' },
      exp: { warn: 'Señales experimentales. La fuente de datos y la relevancia biológica requieren validación.',
        schumann: 'Resonancia Schumann', schDesc: 'Resonancias de la cavidad Tierra–ionosfera. Fundamental 7,83 Hz + armónicos. Aún sin feed público validado en tiempo real.',
        harmonics: 'Armónicos', emf: 'CEM', emfNote: 'No implementado para el MVP. Requiere un escaneo móvil del usuario o autoinforme.',
        disabled: 'Capa deshabilitada: no hay fuente de datos validada.', notifyInteg: 'Avísame cuando se integre', status: 'Estado', awaiting: 'a la espera de fuente validada' },
      aqi: { good: 'Buena', moderate: 'Moderada', usg: 'Dañina (sensibles)', unhealthy: 'Dañina', vunhealthy: 'Muy dañina', hazardous: 'Peligrosa' },
      uvz: { low: 'Bajo', moderate: 'Moderado', high: 'Alto', vhigh: 'Muy alto', extreme: 'Extremo' },
      kpz: { quiet: 'Tranquilo', active: 'Activo', g1: 'Menor (G1)', g2: 'Moderada (G2)', g3: 'Fuerte (G3)', g4: 'Severa (G4)', g5: 'Extrema (G5)' },
      loc: { title: 'Define tu ubicación', p: 'Se usa para el clima local, calidad del aire, amanecer/atardecer y salida de la Luna. Busca una ciudad o introduce coordenadas.',
        search: 'Ciudad o lugar (p. ej. Berlín)', orCoords: 'o coordenadas', lat: 'latitud', lon: 'longitud', save: 'Guardar ubicación', none: 'Sin coincidencias.', invalid: 'Introduce coordenadas válidas o elige una ciudad.' },
      subs: { title: 'Suscripciones del Campo Externo', p: 'Elige qué capas sigues, cuáles aparecen en tu Camino de Desarrollo y cuáles envían notificaciones.',
        show: 'mostrar', onPath: 'Mostrar en Camino de evolución', notify: 'notificar', save: 'Guardar' }
    }
  };
  function lang() { try { return (window.getLang && window.getLang()) || 'ru'; } catch (e) { return 'ru'; } }
  // BCP-47 locale for the user's selected language, so dates/numbers follow the
  // UI language rather than the browser's OS locale (fixes RU month names in EN/ES).
  function locale() { return { ru: 'ru-RU', en: 'en-US', es: 'es-ES' }[lang()] || 'en-US'; }
  function dict() { return I18N[lang()] || I18N.en; }
  function t(path) {
    var parts = path.split('.'), cur = dict(), fb = I18N.en, i;
    for (i = 0; i < parts.length; i++) { cur = cur && cur[parts[i]]; fb = fb && fb[parts[i]]; }
    return (cur != null ? cur : (fb != null ? fb : path));
  }

  var LAYERS = [
    { key: 'sun', icon: '☀' }, { key: 'moon', icon: '☾' }, { key: 'earth', icon: '⊕' },
    { key: 'weather', icon: '🌦' }, { key: 'cosmos', icon: '✦' }, { key: 'social', icon: '🌐' },
    { key: 'experimental', icon: '⚡' }
  ];

  var S = { active: 'sun', config: {}, user: null, container: null };

  function api(path, opts) {
    var token = localStorage.getItem('na_token');
    return fetch((window.AUTH_API || '') + path, Object.assign({
      headers: Object.assign({ 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, (opts && opts.headers) || {})
    }, opts || {})).then(function (r) { return r.json(); });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtTime(ts) { var d = new Date(ts); if (isNaN(d)) return ''; try { return d.toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return d.toISOString().slice(0, 16).replace('T', ' '); } }
  function fmtHM(ts) { var d = new Date(ts); if (isNaN(d)) return '—'; try { return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }); } catch (e) { return '—'; } }
  function hasLocation() { return S.user && S.user.location_lat != null && S.user.location_lon != null; }

  /* ── shell ─────────────────────────────────────────────────────────────── */
  function shell() {
    var tabs = LAYERS.map(function (l) {
      return '<button class="ef-tab" data-ef="' + l.key + '"><span class="ef-tab-ic">' + l.icon + '</span>' + esc(t('tab.' + l.key)) + '</button>';
    }).join('');
    return '' +
      '<div class="ef-root">' +
        '<div class="ef-head">' +
          '<div><h3 class="ef-title">' + esc(t('title')) + '</h3><p class="ef-sub">' + esc(t('sub')) + '</p></div>' +
          '<div class="ef-head-actions">' +
            '<button class="ef-loc-btn" id="ef-loc-btn"></button>' +
            '<button class="ef-gear" id="ef-gear" title="' + esc(t('subsTitle')) + '">⚙</button>' +
          '</div>' +
        '</div>' +
        '<div class="ef-tabs">' + tabs + '</div>' +
        '<div class="ef-body" id="ef-body"></div>' +
        '<div class="ef-foot">' + esc(t('foot')) + '</div>' +
      '</div>';
  }

  function mountExternalField(container) {
    if (!container) return;
    S.container = container;
    renderShell();
    if (S.user) { renderLocBtn(); selectTab(S.active); }
    else { loadUser().then(function () { renderLocBtn(); selectTab(S.active); }); loadConfig(); }
    if (!mountExternalField._langBound) {
      mountExternalField._langBound = true;
      document.addEventListener('langchange', function () { if (S.container && document.body.contains(S.container)) { renderShell(); renderLocBtn(); selectTab(S.active); } });
    }
  }
  function renderShell() {
    var c = S.container;
    c.innerHTML = shell();
    c.querySelectorAll('.ef-tab').forEach(function (b) { b.addEventListener('click', function () { selectTab(b.getAttribute('data-ef')); }); });
    c.querySelector('#ef-gear').addEventListener('click', openSubscriptions);
    c.querySelector('#ef-loc-btn').addEventListener('click', openLocationModal);
  }

  function loadUser() { return api('/api/auth/me').then(function (d) { if (d && d.user) S.user = d.user; }).catch(function () {}); }
  function loadConfig() { api('/api/external/subscriptions').then(function (d) { if (d && d.config) S.config = d.config; }).catch(function () {}); }

  function renderLocBtn() {
    var b = S.container.querySelector('#ef-loc-btn'); if (!b) return;
    b.innerHTML = hasLocation() ? '📍 ' + esc(S.user.location_city || (S.user.location_lat.toFixed(2) + ', ' + S.user.location_lon.toFixed(2))) : '📍 ' + esc(t('setLoc'));
  }

  function selectTab(key) {
    S.active = key;
    S.container.querySelectorAll('.ef-tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-ef') === key); });
    var body = S.container.querySelector('#ef-body');
    body.innerHTML = '<div class="ef-loading">' + esc(t('loading')) + '</div>';
    var fn = ({ sun: renderSun, moon: renderMoon, earth: renderEarth, weather: renderWeather, cosmos: renderCosmos, social: renderSocial, experimental: renderExperimental })[key];
    if (fn) fn(body);
  }

  /* ── shared builders ────────────────────────────────────────────────────── */
  function emptyState(reason) {
    return '<div class="ef-empty"><div class="ef-empty-ic">◌</div><div class="ef-empty-t">' + esc(t('noData')) + '</div>' +
      '<div class="ef-empty-r">' + esc(reason || t('awaitNext')) + '</div></div>';
  }
  function timeline(events, emptyReason) {
    if (!events || !events.length) return emptyState(emptyReason || t('srcEmpty'));
    return '<div class="ef-timeline">' + events.map(function (e) {
      var sev = e.severity ? '<span class="ef-sev">' + esc(e.severity) + '</span>' : '';
      var src = e.source_url ? '<a href="' + esc(e.source_url) + '" target="_blank" rel="noopener" class="ef-src">' + esc(e.source) + ' ↗</a>' : '<span class="ef-src">' + esc(e.source) + '</span>';
      return '<div class="ef-item">' +
        '<div class="ef-item-top">' + sev + '<span class="ef-item-title">' + esc(e.title) + '</span></div>' +
        (e.description ? '<div class="ef-item-desc">' + esc(e.description) + '</div>' : '') +
        '<div class="ef-item-meta">' + esc(fmtTime(e.timestamp)) + ' · ' + src + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }
  function statRow(items) {
    return '<div class="ef-stats">' + items.map(function (it) {
      return '<div class="ef-stat"><div class="ef-stat-k">' + esc(it[0]) + '</div><div class="ef-stat-v">' + esc(it[1]) + '</div></div>';
    }).join('') + '</div>';
  }
  function latestOf(events, type) { for (var i = 0; i < events.length; i++) if (events[i].event_type === type) return events[i]; return null; }
  function allOf(events, type) { return events.filter(function (e) { return e.event_type === type; }); }
  function loadLayer(layer, cb) {
    api('/api/external/events?layer=' + layer + '&limit=150').then(function (d) { cb((d && d.events) || []); }).catch(function () { cb(null); });
  }

  // value-on-scale gauge: opts = { value, min, max, unit, zones:[{to,color,label,tag?}], note }
  // PACK 2: the range is legible at a glance — min/max printed at the ends, each
  // colour band carries its class tag underneath, and the current value rides a
  // bubble + marker AT its position on the scale (not parked in a corner).
  function gauge(opts) {
    var v = opts.value;
    if (v == null || !isFinite(v)) return '';
    var min = opts.min || 0, max = opts.max, span = (max - min) || 1;
    var pct = Math.max(0, Math.min(100, ((v - min) / span) * 100));
    var bubblePct = Math.max(7, Math.min(93, pct));        // keep the value label inside the bar
    // per-zone widths shared by the colour segments AND the class tags below
    var widths = opts.zones.map(function (z, i) {
      var from = i === 0 ? min : opts.zones[i - 1].to;
      return Math.max(0, ((Math.min(z.to, max) - from) / span) * 100);
    });
    // current zone index (for the head badge + to highlight its tag)
    var zi = opts.zones.length - 1;
    for (var i = 0; i < opts.zones.length; i++) { if (v <= opts.zones[i].to) { zi = i; break; } }
    var zone = opts.zones[zi];
    var segs = opts.zones.map(function (z, i) {
      return '<span class="ef-g-seg" style="width:' + widths[i].toFixed(2) + '%;background:' + z.color + '"></span>';
    }).join('');
    var tags = opts.zones.map(function (z, i) {
      return '<span class="ef-g-zl' + (i === zi ? ' is-cur' : '') + '" style="width:' + widths[i].toFixed(2) +
        '%;color:' + z.color + '">' + esc(z.tag || z.label) + '</span>';
    }).join('');
    var disp = (opts.display != null ? opts.display : v) + (opts.unit ? ' ' + opts.unit : '');
    var end = function (x) { var r = Math.round(x * 100) / 100; return esc(r + (opts.unit ? ' ' + opts.unit : '')); };
    var loEnd = opts.minLabel != null ? esc(opts.minLabel) : end(min);
    var hiEnd = opts.maxLabel != null ? esc(opts.maxLabel) : end(max);
    return '<div class="ef-gauge">' +
      '<div class="ef-g-head"><span class="ef-g-label">' + esc(opts.label) + '</span>' +
        '<span class="ef-g-zone" style="color:' + zone.color + '">' + esc(zone.label) + '</span></div>' +
      '<div class="ef-g-valrow"><span class="ef-g-bubble" style="left:' + bubblePct.toFixed(1) + '%">' + esc(disp) + '</span></div>' +
      '<div class="ef-g-track">' + segs + '<span class="ef-g-marker" style="left:' + pct.toFixed(1) + '%"></span></div>' +
      '<div class="ef-g-zlabels">' + tags + '</div>' +
      '<div class="ef-g-ends"><span>' + loEnd + '</span><span>' + hiEnd + '</span></div>' +
      (opts.note ? '<div class="ef-g-note">' + esc(opts.note) + '</div>' : '') +
    '</div>';
  }
  function sparkline(values, color) {
    var vals = (values || []).filter(function (x) { return x != null && isFinite(x); });
    if (vals.length < 2) return '';
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), span = (max - min) || 1;
    var W = 220, H = 34, n = vals.length;
    var pts = vals.map(function (v, i) { return (i / (n - 1) * W).toFixed(1) + ',' + (H - ((v - min) / span) * (H - 6) - 3).toFixed(1); }).join(' ');
    return '<svg class="ef-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><polyline points="' + pts + '" fill="none" stroke="' + (color || 'var(--accent-cyan,#5ee0ff)') + '" stroke-width="1.6"/></svg>';
  }
  var ZONE = { blue: '#4ea3ff', green: '#56F2A6', yellow: '#ffd24a', orange: '#ff9f43', red: '#ff5d5d', violet: '#b07cff', grey: '#7d8a99' };

  /* ── Sun ────────────────────────────────────────────────────────────────── */
  function classPos(cls) { // 'B5.9'→0.59, 'C2'→1.2, 'M1.8'→2.18, 'X3'→3.3
    var m = /^([ABCMX])\s*([\d.]+)?/i.exec(String(cls || '')); if (!m) return null;
    var base = { A: -1, B: 0, C: 1, M: 2, X: 3 }[m[1].toUpperCase()]; if (base == null) base = 0;
    return base + (parseFloat(m[2]) || 0) / 10;
  }
  function renderSun(body) {
    loadLayer('sun', function (events) {
      if (events == null) { body.innerHTML = emptyState(t('awaitNext')); return; }
      var xray = latestOf(events, 'xray_flux'), sw = latestOf(events, 'solar_wind'), f107 = latestOf(events, 'f107_flux');
      var flares = allOf(events, 'flare'), cmes = allOf(events, 'cme');
      var html = '';
      // X-ray flux gauge (B/C/M/X)
      var xc = xray && classPos(xray.severity);
      html += gauge({ label: t('sun.xray'), value: xc, display: xray ? xray.severity : '—', min: 0, max: 4, minLabel: 'B', maxLabel: 'X',
        zones: [{ to: 1, color: ZONE.blue, label: 'B' }, { to: 2, color: ZONE.green, label: 'C' }, { to: 3, color: ZONE.yellow, label: 'M' }, { to: 4, color: ZONE.red, label: 'X' }],
        note: xc != null && xc < 1 ? t('sun.xrayQuiet') : '' }) || stat2(t('sun.xray'), '—');
      // Solar wind speed gauge
      var spd = sw && parseFloat(String(sw.severity).replace(/[^\d.]/g, ''));
      html += gauge({ label: t('sun.wind'), value: spd, display: sw ? sw.severity : '—', min: 250, max: 1000, unit: '',
        zones: [{ to: 500, color: ZONE.green, label: '250–500' }, { to: 700, color: ZONE.yellow, label: '500–700' }, { to: 1000, color: ZONE.red, label: '700+' }],
        note: spd != null && spd <= 700 ? t('sun.windField') : '' }) || stat2(t('sun.wind'), '—');
      // F10.7 flux gauge
      var fx = f107 && parseFloat(String(f107.severity).replace(/[^\d.]/g, ''));
      html += gauge({ label: t('sun.f107'), value: fx, display: f107 ? f107.severity : '—', min: 60, max: 300,
        zones: [{ to: 100, color: ZONE.blue, label: '<100' }, { to: 150, color: ZONE.green, label: '100–150' }, { to: 200, color: ZONE.yellow, label: '150–200' }, { to: 300, color: ZONE.orange, label: '200+' }] }) || '';
      // SDO image
      html += sdoImage();
      // last flare / CME quick stats
      html += statRow([
        [t('sun.lastFlare'), flares.length ? flares[0].severity : '—'],
        [t('sun.lastCME'), cmes.length ? fmtTime(cmes[0].timestamp) : '—']
      ]);
      // sunrise/sunset
      html += hasLocation() ? '<div class="ef-suntimes" id="ef-suntimes"><span>☀ ' + esc(t('sun.sunrise')) + ': <b>—</b></span><span>🌇 ' + esc(t('sun.sunset')) + ': <b>—</b></span></div>'
                            : '<div class="ef-need-loc">' + esc(t('needLoc')) + '</div>';
      // grouped recent events
      html += '<h4 class="ef-h4">' + esc(t('sun.flares')) + '</h4>' + timeline(flares, t('srcEmpty'));
      html += '<h4 class="ef-h4">' + esc(t('sun.cmes')) + '</h4>' + timeline(cmes, t('srcEmpty'));
      body.innerHTML = html;
      if (hasLocation()) fillSunWindow();
    });
  }
  function stat2(k, v) { return statRow([[k, v]]); }
  function sdoImage() {
    var url = 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_0193.jpg';
    return '<figure class="ef-sdo"><img src="' + url + '?_=' + Date.now() + '" alt="SDO AIA 193" loading="lazy" ' +
      'onerror="this.closest(\'.ef-sdo\').classList.add(\'ef-sdo-fail\')"/>' +
      '<figcaption>' + esc(t('sun.sdoCap')) + ' · <a href="https://sdo.gsfc.nasa.gov/data/" target="_blank" rel="noopener">' + esc(t('sun.sdoOpen')) + '</a></figcaption></figure>';
  }
  function fillSunWindow() {
    var u = S.user;
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + u.location_lat + '&longitude=' + u.location_lon + '&daily=sunrise,sunset&timezone=auto&forecast_days=1')
      .then(function (r) { return r.json(); }).then(function (d) {
        var box = S.container.querySelector('#ef-suntimes'); if (!box || !d.daily) return;
        var sr = d.daily.sunrise && d.daily.sunrise[0], ss = d.daily.sunset && d.daily.sunset[0];
        box.innerHTML = '<span>☀ ' + esc(t('sun.sunrise')) + ': <b>' + fmtHM(sr) + '</b></span><span>🌇 ' + esc(t('sun.sunset')) + ': <b>' + fmtHM(ss) + '</b></span>';
      }).catch(function () {});
  }

  /* ── Moon (client-side astronomical calc — always available) ────────────── */
  function moonData(date) {
    var SYN = 29.53058867, EPOCH = Date.UTC(2000, 0, 6, 18, 14);
    var age = ((date.getTime() - EPOCH) / 86400000) % SYN; if (age < 0) age += SYN;
    var f = age / SYN, illum = (1 - Math.cos(2 * Math.PI * f)) / 2, phase;
    if (age < 1.0) phase = 'New Moon';
    else if (Math.abs(f - 0.25) < 0.02) phase = 'First Quarter';
    else if (Math.abs(f - 0.5) < 0.02) phase = 'Full Moon';
    else if (Math.abs(f - 0.75) < 0.02) phase = 'Last Quarter';
    else if (f < 0.25) phase = 'Waxing Crescent';
    else if (f < 0.5) phase = 'Waxing Gibbous';
    else if (f < 0.75) phase = 'Waning Gibbous';
    else phase = 'Waning Crescent';
    return { age: age, illumination: illum, fraction: f, phase: phase };
  }
  function moonGlyph(fraction, illum) {
    // simple lit-disc indicator; shadow offset by phase
    var r = 26, cx = 30, cy = 30, lit = Math.round(illum * 100);
    var waxing = fraction < 0.5;
    return '<svg class="ef-moon-svg" viewBox="0 0 60 60" width="60" height="60">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#1a2230"/>' +
      '<clipPath id="efm"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/></clipPath>' +
      '<rect x="' + (waxing ? cx : cx - r) + '" y="' + (cy - r) + '" width="' + r + '" height="' + (r * 2) + '" fill="#e9eef6" clip-path="url(#efm)" opacity="' + (0.25 + illum * 0.75) + '"/>' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + (r * Math.abs(1 - illum * 2)) + '" ry="' + r + '" fill="' + (illum < 0.5 ? '#1a2230' : '#e9eef6') + '" clip-path="url(#efm)" opacity="0.9"/>' +
      '<text x="' + cx + '" y="56" text-anchor="middle" font-size="8" fill="#8c98a6">' + lit + '%</text></svg>';
  }
  function renderMoon(body) {
    var m = moonData(new Date());
    var phaseName = (dict().moon.phases[m.phase]) || m.phase;
    var html = '<div class="ef-moon-hero">' + moonGlyph(m.fraction, m.illumination) +
      '<div class="ef-moon-info">' + statRow([
        [t('moon.phase'), phaseName],
        [t('moon.illum'), Math.round(m.illumination * 100) + '%'],
        [t('moon.age'), m.age.toFixed(1) + ' ' + t('moon.days')]
      ]) + '</div></div>';
    html += '<div class="ef-foot-inline">' + esc(t('moon.computed')) + '</div>';
    if (hasLocation()) html += '<div class="ef-suntimes" id="ef-moontimes"><span>🌙 ' + esc(t('moon.moonrise')) + ': <b>—</b></span><span>🌑 ' + esc(t('moon.moonset')) + ': <b>—</b></span></div>';
    else html += '<div class="ef-need-loc">' + esc(t('needLoc')) + '</div>';
    html += '<h4 class="ef-h4">' + esc(t('moon.timeline')) + '</h4><div id="ef-moon-tl"><div class="ef-loading">' + esc(t('loading')) + '</div></div>';
    body.innerHTML = html;
    loadLayer('moon', function (events) {
      var tl = S.container.querySelector('#ef-moon-tl'); if (tl) tl.innerHTML = timeline(events, t('srcEmpty'));
    });
    if (hasLocation()) fillMoonTimes(m);
  }
  function fillMoonTimes(m) {
    var u = S.user;
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + u.location_lat + '&longitude=' + u.location_lon + '&daily=moonrise,moonset&timezone=auto&forecast_days=1')
      .then(function (r) { return r.json(); }).then(function (d) {
        var box = S.container.querySelector('#ef-moontimes'); if (!box) return;
        var mr = d.daily && d.daily.moonrise && d.daily.moonrise[0], ms = d.daily && d.daily.moonset && d.daily.moonset[0];
        // Open-Meteo may omit moonrise/moonset on its standard endpoint — keep dashes gracefully
        box.innerHTML = '<span>🌙 ' + esc(t('moon.moonrise')) + ': <b>' + (mr ? fmtHM(mr) : '—') + '</b></span><span>🌑 ' + esc(t('moon.moonset')) + ': <b>' + (ms ? fmtHM(ms) : '—') + '</b></span>';
      }).catch(function () {});
  }

  /* ── Earth ──────────────────────────────────────────────────────────────── */
  function renderEarth(body) {
    loadLayer('earth', function (events) {
      if (events == null) { body.innerHTML = emptyState(t('awaitNext')); return; }
      var kp = latestOf(events, 'kp_index'), quake = latestOf(events, 'earthquake'), storm = latestOf(events, 'geomagnetic_storm');
      var quakes = allOf(events, 'earthquake');
      var html = '';
      // Kp gauge 0-9 with G-zones
      var kpv = kp ? parseFloat(String(kp.severity).replace('Kp', '')) : null;
      html += gauge({ label: t('earth.kp'), value: kpv, display: kpv != null ? kpv : '—', min: 0, max: 9,
        zones: [{ to: 3, color: ZONE.green, label: t('kpz.quiet') }, { to: 4, color: ZONE.yellow, label: t('kpz.active') },
          { to: 5, color: ZONE.orange, label: t('kpz.g1') }, { to: 6, color: ZONE.orange, label: t('kpz.g2') },
          { to: 7, color: ZONE.red, label: t('kpz.g3') }, { to: 8, color: ZONE.red, label: t('kpz.g4') }, { to: 9, color: ZONE.violet, label: t('kpz.g5') }],
        note: t('earth.kpScaleNote') }) || stat2(t('earth.kp'), '—');
      // Ap
      var ap = kp && kp.raw_payload && kp.raw_payload.ap;
      html += statRow([
        [t('earth.ap'), ap != null ? ap : '—'],
        [t('earth.geomag'), storm ? t('earth.stormActive') : t('earth.quiet')]
      ]);
      // last quake card with region + distance + map pin
      if (quake) {
        html += quakeCard(quake);
      } else {
        html += emptyState(t('srcEmpty'));
      }
      html += '<h4 class="ef-h4">' + esc(t('earth.seismic')) + '</h4>' + timeline(quakes.length ? quakes : events, t('srcEmpty'));
      body.innerHTML = html;
    });
  }
  function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
  function quakeCard(q) {
    var lat = q.latitude, lon = q.longitude;
    var dist = (hasLocation() && lat != null && lon != null) ? haversine(S.user.location_lat, S.user.location_lon, lat, lon) : null;
    var place = (q.description || q.title || '').replace(/^M[\d.]+\s+earthquake\s*—?\s*/i, '');
    var map = (lat != null && lon != null) ? worldPin(lat, lon) : '';
    return '<div class="ef-quake">' +
      '<div class="ef-quake-top"><span class="ef-quake-mag">' + esc(q.severity || '') + '</span>' +
        '<div><div class="ef-quake-place">' + esc(place || q.title) + '</div>' +
        '<div class="ef-quake-sub">' + esc(t('earth.lastGlobalQuake')) + '</div></div></div>' +
      map +
      '<div class="ef-quake-meta">' + esc(fmtTime(q.timestamp)) + (dist != null ? ' · ' + dist.toLocaleString(locale()) + ' km ' + t('earth.from') : '') +
        (q.source_url ? ' · <a href="' + esc(q.source_url) + '" target="_blank" rel="noopener">USGS ↗</a>' : '') + '</div></div>';
  }
  function worldPin(lat, lon) {
    var W = 300, H = 150; // equirectangular
    var x = ((lon + 180) / 360) * W, y = ((90 - lat) / 180) * H;
    var ux = null, uy = null;
    if (hasLocation()) { ux = ((S.user.location_lon + 180) / 360) * W; uy = ((90 - S.user.location_lat) / 180) * H; }
    var grid = '';
    for (var gx = 30; gx < W; gx += 30) grid += '<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + H + '" stroke="rgba(255,255,255,0.05)"/>';
    for (var gy = 30; gy < H; gy += 30) grid += '<line x1="0" y1="' + gy + '" x2="' + W + '" y2="' + gy + '" stroke="rgba(255,255,255,0.05)"/>';
    return '<svg class="ef-worldmap" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="rgba(40,80,120,0.12)" rx="6"/>' +
      '<line x1="0" y1="' + (H / 2) + '" x2="' + W + '" y2="' + (H / 2) + '" stroke="rgba(255,255,255,0.12)"/>' + grid +
      (ux != null ? '<circle cx="' + ux.toFixed(1) + '" cy="' + uy.toFixed(1) + '" r="3" fill="#5ee0ff"/><circle cx="' + ux.toFixed(1) + '" cy="' + uy.toFixed(1) + '" r="6" fill="none" stroke="#5ee0ff" opacity="0.5"/>' : '') +
      '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.5" fill="#ff5d5d"/>' +
      '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="9" fill="none" stroke="#ff5d5d" opacity="0.5"><animate attributeName="r" values="5;12;5" dur="2.2s" repeatCount="indefinite"/></circle>' +
    '</svg>';
  }

  /* ── Weather / Local Environment (client-side Open-Meteo) ───────────────── */
  function renderWeather(body) {
    if (!hasLocation()) {
      body.innerHTML = '<div class="ef-prompt"><div class="ef-prompt-ic">📍</div><p>' + esc(t('weather.enterLoc')) + '</p>' +
        '<button class="btn btn-solid ef-prompt-btn" id="ef-prompt-loc">' + esc(t('setLoc')) + '</button></div>';
      var b = body.querySelector('#ef-prompt-loc'); if (b) b.addEventListener('click', openLocationModal);
      return;
    }
    var u = S.user;
    body.innerHTML = '<div class="ef-loading">' + esc(t('loading')) + '</div>';
    Promise.all([
      fetch('https://api.open-meteo.com/v1/forecast?latitude=' + u.location_lat + '&longitude=' + u.location_lon + '&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,uv_index&hourly=temperature_2m,surface_pressure,wind_speed_10m&past_days=1&forecast_days=1&timezone=auto').then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + u.location_lat + '&longitude=' + u.location_lon + '&current=pm2_5,pm10,ozone,nitrogen_dioxide,carbon_monoxide&timezone=auto').then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) {
      var w = res[0] && res[0].current, hourly = res[0] && res[0].hourly, aq = res[1] && res[1].current;
      var html = '<div class="ef-loc-line">📍 ' + esc(u.location_city || (u.location_lat.toFixed(2) + ', ' + u.location_lon.toFixed(2))) + '</div>';
      if (!w && !aq) { body.innerHTML = html + emptyState(t('srcEmpty')); return; }
      // last-24h sparklines
      var last24 = function (arr) { return (arr || []).slice(-24); };
      html += '<div class="ef-spark-grid">' +
        sparkCard(t('weather.temp'), w ? Math.round(w.temperature_2m) + '°C' : '—', hourly && last24(hourly.temperature_2m), ZONE.orange) +
        sparkCard(t('weather.pressure'), w ? Math.round(w.surface_pressure) + ' hPa' : '—', hourly && last24(hourly.surface_pressure), ZONE.blue) +
        sparkCard(t('weather.wind'), w ? Math.round(w.wind_speed_10m) + ' km/h' : '—', hourly && last24(hourly.wind_speed_10m), ZONE.green) +
      '</div>';
      html += statRow([[t('weather.humidity'), w ? Math.round(w.relative_humidity_2m) + '%' : '—']]);
      // UV gauge
      if (w && w.uv_index != null) html += gauge({ label: t('weather.uv'), value: w.uv_index, display: w.uv_index, min: 0, max: 12,
        zones: [{ to: 2, color: ZONE.green, label: t('uvz.low') }, { to: 5, color: ZONE.yellow, label: t('uvz.moderate') }, { to: 7, color: ZONE.orange, label: t('uvz.high') }, { to: 10, color: ZONE.red, label: t('uvz.vhigh') }, { to: 12, color: ZONE.violet, label: t('uvz.extreme') }] });
      // AQ gauges
      if (aq) {
        html += '<h4 class="ef-h4">' + esc(t('weather.air')) + '</h4>';
        html += aqGauge(t('weather.pm25'), aq.pm2_5, [10, 25, 50, 75, 110], 'µg/m³');
        html += aqGauge(t('weather.pm10'), aq.pm10, [20, 50, 100, 200, 300], 'µg/m³');
        html += aqGauge(t('weather.ozone'), aq.ozone, [60, 120, 180, 240, 320], 'µg/m³');
        html += aqGauge(t('weather.no2'), aq.nitrogen_dioxide, [40, 90, 120, 230, 340], 'µg/m³');
        html += aqGauge(t('weather.co'), aq.carbon_monoxide, [4400, 9400, 12400, 15400, 30000], 'µg/m³');
      }
      html += '<div class="ef-foot-inline">' + esc(t('weather.snapshot')) + '</div>';
      body.innerHTML = html;
    });
  }
  function sparkCard(label, val, series, color) {
    return '<div class="ef-spark-card"><div class="ef-spark-k">' + esc(label) + '</div><div class="ef-spark-v">' + esc(val) + '</div>' +
      (series && series.length > 1 ? sparkline(series, color) + '<div class="ef-spark-cap">' + esc(t('weather.last24')) + '</div>' : '') + '</div>';
  }
  function aqGauge(label, value, bp, unit) {
    if (value == null || !isFinite(value)) return gauge({ label: label, value: null }) || stat2(label, '—');
    var a = t('aqi');
    return gauge({ label: label, value: value, display: value, unit: unit, min: 0, max: bp[4],
      zones: [{ to: bp[0], color: ZONE.green, label: a.good }, { to: bp[1], color: ZONE.yellow, label: a.moderate },
        { to: bp[2], color: ZONE.orange, label: a.usg }, { to: bp[3], color: ZONE.red, label: a.unhealthy }, { to: bp[4], color: ZONE.violet, label: a.vunhealthy }] });
  }

  /* ── Cosmos ─────────────────────────────────────────────────────────────── */
  function gwClass(e) {
    var c = (e.raw_payload && e.raw_payload.classification) || null;
    if (c && typeof c === 'object') { // probability map → take argmax
      var best = null, bv = -1; Object.keys(c).forEach(function (k) { if (c[k] > bv) { bv = c[k]; best = k; } });
      c = best;
    }
    var key = ({ BBH: 'BBH', BNS: 'BNS', NSBH: 'NSBH', Terrestrial: 'Terrestrial' })[c] || 'Unknown';
    var col = ({ BBH: ZONE.blue, BNS: ZONE.yellow, NSBH: ZONE.orange, Terrestrial: ZONE.grey, Unknown: ZONE.grey })[key];
    return { key: key, color: col, label: t('cosmos.cls.' + key) };
  }
  function renderCosmos(body) {
    loadLayer('cosmos', function (events) {
      var help = '<details class="ef-help"><summary>' + esc(t('cosmos.whatQ')) + '</summary><p>' + esc(t('cosmos.whatA')) + '</p></details>';
      var note = '<div class="ef-note">' + esc(t('cosmos.note')) + '</div>';
      var list;
      if (!events || !events.length) {
        list = emptyState(t('cosmos.noConfirmed'));
      } else {
        list = '<div class="ef-gw-timeline">' + events.map(function (e) {
          var cl = gwClass(e);
          return '<div class="ef-gw-item"><span class="ef-gw-dot" style="background:' + cl.color + '"></span>' +
            '<div class="ef-gw-body"><div class="ef-gw-title">' + esc(e.title) + '</div>' +
            '<div class="ef-gw-meta"><span class="ef-gw-cls" style="color:' + cl.color + '">' + esc(cl.label) + '</span> · ' + esc(fmtTime(e.timestamp)) +
            (e.source_url ? ' · <a href="' + esc(e.source_url) + '" target="_blank" rel="noopener">GraceDB ↗</a>' : '') + '</div></div></div>';
        }).join('') + '</div>';
      }
      body.innerHTML = note + '<h4 class="ef-h4">' + esc(t('cosmos.candidates')) + '</h4>' + list + help;
    });
  }

  /* ── Social Events ──────────────────────────────────────────────────────── */
  function renderSocial(body) {
    loadLayer('social', function (events) {
      body.innerHTML = '<div class="ef-note">' + esc(t('social.note')) + '</div>' +
        '<h4 class="ef-h4">' + esc(t('social.events')) + '</h4>' + timeline(events, t('srcEmpty'));
    });
  }

  /* ── Experimental Signals ───────────────────────────────────────────────── */
  function renderExperimental(body) {
    var harmonics = [7.83, 14.3, 20.8, 27.3, 33.8];
    var bars = harmonics.map(function (h, i) {
      return '<div class="ef-harm"><div class="ef-harm-bar" style="height:' + (60 - i * 10) + '%"></div><div class="ef-harm-hz">' + h + '</div></div>';
    }).join('');
    var notifyChecked = (S.config.experimental && S.config.experimental.notify) ? ' checked' : '';
    var html = '<div class="ef-warn">⚠ ' + esc(t('exp.warn')) + '</div>';
    // Schumann — disabled, no validated source
    html += '<div class="ef-exp-block"><div class="ef-exp-h">' + esc(t('exp.schumann')) + '</div>' +
      '<div class="ef-exp-desc">' + esc(t('exp.schDesc')) + '</div>' +
      '<div class="ef-harm-row">' + bars + '</div>' +
      '<div class="ef-harm-cap">' + esc(t('exp.harmonics')) + ' (Hz)</div>' +
      '<div class="ef-disabled">' + esc(t('exp.disabled')) + '</div>' +
      '<label class="ef-chk ef-notify-integ"><input type="checkbox" id="ef-exp-notify"' + notifyChecked + '> ' + esc(t('exp.notifyInteg')) + '</label></div>';
    // EMF — explicitly not implemented
    html += '<div class="ef-exp-block"><div class="ef-exp-h">' + esc(t('exp.emf')) + '</div>' +
      '<div class="ef-disabled">' + esc(t('exp.emfNote')) + '</div></div>';
    body.innerHTML = html;
    var nb = body.querySelector('#ef-exp-notify');
    if (nb) nb.addEventListener('change', function () {
      S.config.experimental = Object.assign({}, S.config.experimental, { notify: nb.checked, enabled: true });
      api('/api/external/subscriptions', { method: 'POST', body: JSON.stringify({ config: S.config }) }).catch(function () {});
    });
  }

  /* ── Location modal (geocode via Open-Meteo) ────────────────────────────── */
  function openLocationModal() {
    var ov = modalShell(t('loc.title'),
      '<p class="ef-modal-p">' + esc(t('loc.p')) + '</p>' +
      '<input id="ef-geo-q" class="ef-input" placeholder="' + esc(t('loc.search')) + '" autocomplete="off">' +
      '<div id="ef-geo-results" class="ef-geo-results"></div>' +
      '<div class="ef-or">' + esc(t('loc.orCoords')) + '</div>' +
      '<div class="ef-coords"><input id="ef-lat" class="ef-input" placeholder="' + esc(t('loc.lat')) + '"><input id="ef-lon" class="ef-input" placeholder="' + esc(t('loc.lon')) + '"></div>' +
      '<button class="btn btn-solid ef-modal-save" id="ef-loc-save">' + esc(t('loc.save')) + '</button>');
    var q = ov.querySelector('#ef-geo-q'), results = ov.querySelector('#ef-geo-results'), tm;
    q.addEventListener('input', function () {
      clearTimeout(tm); var v = q.value.trim(); if (v.length < 2) { results.innerHTML = ''; return; }
      tm = setTimeout(function () {
        fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(v) + '&count=6&language=' + lang() + '&format=json')
          .then(function (r) { return r.json(); }).then(function (d) {
            results.innerHTML = ((d && d.results) || []).map(function (r) {
              var name = r.name + (r.admin1 ? ', ' + r.admin1 : '') + (r.country ? ', ' + r.country : '');
              return '<button class="ef-geo-r" data-lat="' + r.latitude + '" data-lon="' + r.longitude + '" data-city="' + esc(name) + '">' + esc(name) + '</button>';
            }).join('') || '<div class="ef-geo-none">' + esc(t('loc.none')) + '</div>';
            results.querySelectorAll('.ef-geo-r').forEach(function (b) {
              b.addEventListener('click', function () { saveLocation(+b.getAttribute('data-lat'), +b.getAttribute('data-lon'), b.getAttribute('data-city'), ov); });
            });
          }).catch(function () {});
      }, 350);
    });
    ov.querySelector('#ef-loc-save').addEventListener('click', function () {
      var lat = parseFloat(ov.querySelector('#ef-lat').value), lon = parseFloat(ov.querySelector('#ef-lon').value);
      if (!isFinite(lat) || !isFinite(lon)) { alert(t('loc.invalid')); return; }
      saveLocation(lat, lon, lat.toFixed(2) + ', ' + lon.toFixed(2), ov);
    });
  }
  function saveLocation(lat, lon, city, ov) {
    api('/api/users/me/location', { method: 'POST', body: JSON.stringify({ lat: lat, lon: lon, city: city }) })
      .then(function (d) {
        if (d && d.ok) { S.user.location_lat = lat; S.user.location_lon = lon; S.user.location_city = city; renderLocBtn(); if (ov) ov.remove(); selectTab(S.active); }
        else alert((d && d.error) || 'Could not save location.');
      }).catch(function () { alert('Network error.'); });
  }

  /* ── Subscriptions modal ────────────────────────────────────────────────── */
  function openSubscriptions() {
    var rows = LAYERS.map(function (l) {
      var c = S.config[l.key] || {};
      // PR FIX: only two real toggles per layer — show on Path, and notify.
      return '<div class="ef-sub-row" data-layer="' + l.key + '">' +
        '<div class="ef-sub-name">' + l.icon + ' ' + esc(t('tab.' + l.key)) + '</div>' +
        '<label class="ef-chk"><input type="checkbox" data-k="showOnPath"' + (c.showOnPath ? ' checked' : '') + '> ' + esc(t('subs.onPath')) + '</label>' +
        '<label class="ef-chk"><input type="checkbox" data-k="notify"' + (c.notify ? ' checked' : '') + '> ' + esc(t('subs.notify')) + '</label>' +
      '</div>';
    }).join('');
    var ov = modalShell(t('subs.title'),
      '<p class="ef-modal-p">' + esc(t('subs.p')) + '</p>' + rows + '<button class="btn btn-solid ef-modal-save" id="ef-sub-save">' + esc(t('subs.save')) + '</button>');
    ov.querySelector('#ef-sub-save').addEventListener('click', function () {
      var cfg = {};
      ov.querySelectorAll('.ef-sub-row').forEach(function (r) {
        var layer = r.getAttribute('data-layer'); cfg[layer] = { enabled: true };   // layers always fetchable; gating is showOnPath/notify
        r.querySelectorAll('input[type=checkbox]').forEach(function (cb) { cfg[layer][cb.getAttribute('data-k')] = cb.checked; });
      });
      api('/api/external/subscriptions', { method: 'POST', body: JSON.stringify({ config: cfg }) })
        .then(function (d) { if (d && d.ok) { S.config = cfg; ov.remove(); } else alert('Could not save.'); });
    });
  }

  function modalShell(title, inner) {
    var ov = document.createElement('div');
    ov.className = 'ef-modal-ov';
    ov.innerHTML = '<div class="ef-modal"><div class="ef-modal-head"><b>' + esc(title) + '</b><button class="ef-modal-x">✕</button></div><div class="ef-modal-body">' + inner + '</div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.ef-modal-x').addEventListener('click', function () { ov.remove(); });
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) ov.remove(); });
    return ov;
  }

  window.mountExternalField = mountExternalField;
})();
