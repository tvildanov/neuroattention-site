/* ============================================================================
   registration-location.js — PR4 (4.4)

   Mandatory residence at registration + a one-time prompt for existing users.
   - Country: native <datalist> (search-filter, no heavy widget).
   - City: live autocomplete via Open-Meteo geocoding (free, already used by the
     External Field). Picking a city fills hidden lat/lon and the country.

   Exposes (window):
     NA_COUNTRIES                          → array of country names
     naPopulateCountryList(datalistEl)     → fills a <datalist>
     naWireCityAutocomplete(input, box, onPick)  → onPick({name,country,lat,lon})
     naMaybeLocationModal(user, token, apiBase, onSaved)  → one-time modal if no location
   ============================================================================ */
(function () {
  'use strict';

  var NA_COUNTRIES = ['Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czechia','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Ivory Coast','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'];

  function populateCountryList(dl) {
    if (!dl) return;
    dl.innerHTML = NA_COUNTRIES.map(function (c) { return '<option value="' + c + '"></option>'; }).join('');
  }

  function langOf() { return (typeof window.getLang === 'function') ? window.getLang() : 'ru'; }

  // Wire a city <input> to Open-Meteo geocoding. `box` is a positioned container
  // for the results dropdown. onPick receives {name, country, lat, lon}.
  function wireCityAutocomplete(input, box, onPick) {
    if (!input || input.__naWired) return;
    input.__naWired = true;
    var timer = null;
    function close() { if (box) { box.style.display = 'none'; box.innerHTML = ''; } }
    function search() {
      var q = input.value.trim();
      if (q.length < 2) { close(); return; }
      var url = 'https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(q) +
                '&count=6&language=' + encodeURIComponent(langOf()) + '&format=json';
      fetch(url).then(function (r) { return r.json(); }).then(function (d) {
        var results = (d && d.results) || [];
        if (!results.length || !box) { close(); return; }
        box.innerHTML = results.map(function (r, i) {
          var sub = [r.admin1, r.country].filter(Boolean).join(', ');
          return '<div class="na-city-opt" data-i="' + i + '" style="padding:0.55rem 0.75rem;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;">' +
            '<span style="color:var(--text-primary,#fff);">' + (r.name || '') + '</span>' +
            (sub ? ' <span style="color:var(--text-muted,#9aa);font-size:12px;">' + sub + '</span>' : '') + '</div>';
        }).join('');
        box.style.display = 'block';
        box.querySelectorAll('.na-city-opt').forEach(function (el) {
          el.addEventListener('mousedown', function (e) {
            e.preventDefault();
            var r = results[parseInt(el.getAttribute('data-i'), 10)];
            input.value = r.name;
            close();
            if (onPick) onPick({ name: r.name, country: r.country || '', lat: r.latitude, lon: r.longitude });
          });
        });
      }).catch(close);
    }
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(search, 280); });
    input.addEventListener('blur', function () { setTimeout(close, 180); });
  }

  // One-time modal for users registered before location was mandatory.
  function maybeLocationModal(user, token, apiBase, onSaved) {
    if (!user || (user.location_lat != null && user.location_lon != null)) return;
    if (localStorage.getItem('na_loc_prompt_dismissed') === '1') return;
    var lang = langOf();
    var S = {
      ru: { t: 'Укажите место жительства', p: 'Это нужно для External Field — он показывает локальную погоду, фазу луны и геофизические сигналы для вашей точки. Изменить можно в любой момент в шапке External Field.',
            country: 'Страна', city: 'Город', save: 'Сохранить', later: 'Позже', need: 'Выберите страну и город' },
      en: { t: 'Set your place of residence', p: 'External Field uses it to show local weather, the moon phase and geophysical signals for your location. You can change it anytime from the External Field header.',
            country: 'Country', city: 'City', save: 'Save', later: 'Later', need: 'Pick a country and city' },
      es: { t: 'Indica tu lugar de residencia', p: 'External Field lo usa para mostrar el clima local, la fase lunar y señales geofísicas de tu ubicación. Puedes cambiarlo cuando quieras desde la cabecera de External Field.',
            country: 'País', city: 'Ciudad', save: 'Guardar', later: 'Más tarde', need: 'Elige país y ciudad' }
    }[lang] || null;
    var L = S || { t: 'Укажите место жительства', p: '', country: 'Страна', city: 'Город', save: 'Сохранить', later: 'Позже', need: 'Выберите страну и город' };
    var picked = { country: '', city: '', lat: null, lon: null };
    var ov = document.createElement('div');
    ov.className = 'rpg-modal-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);padding:1rem;';
    ov.innerHTML = '<div class="rpg-modal" style="max-width:440px;width:100%;background:rgba(10,12,16,0.97);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:1.5rem;">' +
      '<h3 style="font-family:\'Unbounded\',sans-serif;font-size:1.05rem;font-weight:500;color:var(--text-primary,#fff);margin:0 0 0.5rem;">' + L.t + '</h3>' +
      '<p style="font-size:13px;color:var(--text-muted,#9aa);line-height:1.6;margin:0 0 1.1rem;">' + L.p + '</p>' +
      '<label style="font-size:11px;color:var(--text-dim,#8c98a6);">' + L.country + '</label>' +
      '<input id="na-loc-country" class="glass-input" list="na-loc-country-list" style="width:100%;margin:0.2rem 0 0.8rem;" autocomplete="off">' +
      '<datalist id="na-loc-country-list"></datalist>' +
      '<label style="font-size:11px;color:var(--text-dim,#8c98a6);">' + L.city + '</label>' +
      '<div style="position:relative;"><input id="na-loc-city" class="glass-input" style="width:100%;margin:0.2rem 0 0.2rem;" autocomplete="off">' +
      '<div id="na-loc-city-box" style="display:none;position:absolute;left:0;right:0;top:100%;z-index:5;background:rgba(12,15,20,0.98);border:1px solid rgba(255,255,255,0.12);border-radius:10px;overflow:hidden;max-height:240px;overflow-y:auto;"></div></div>' +
      '<p id="na-loc-err" style="font-size:12px;color:#ff8a8a;min-height:1rem;margin:0.4rem 0 0;"></p>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">' +
      '<button id="na-loc-save" class="btn btn-solid" style="flex:1;justify-content:center;">' + L.save + '</button>' +
      '<button id="na-loc-later" class="btn btn-ghost" style="justify-content:center;">' + L.later + '</button>' +
      '</div></div>';
    document.body.appendChild(ov);
    populateCountryList(ov.querySelector('#na-loc-country-list'));
    var cityIn = ov.querySelector('#na-loc-city');
    var countryIn = ov.querySelector('#na-loc-country');
    wireCityAutocomplete(cityIn, ov.querySelector('#na-loc-city-box'), function (r) {
      picked.city = r.name; picked.lat = r.lat; picked.lon = r.lon;
      if (r.country && !countryIn.value.trim()) { countryIn.value = r.country; picked.country = r.country; }
    });
    countryIn.addEventListener('input', function () { picked.country = countryIn.value.trim(); });
    ov.querySelector('#na-loc-later').onclick = function () { localStorage.setItem('na_loc_prompt_dismissed', '1'); ov.remove(); };
    ov.querySelector('#na-loc-save').onclick = function () {
      var country = countryIn.value.trim();
      var city = picked.city || cityIn.value.trim();
      var err = ov.querySelector('#na-loc-err');
      if (!country || !city || picked.lat == null) { err.textContent = L.need; return; }
      err.style.color = 'var(--text-muted,#9aa)'; err.textContent = '...';
      fetch(apiBase + '/api/users/me/location', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: picked.lat, lon: picked.lon, city: city, country: country })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.ok) { ov.remove(); if (onSaved) onSaved(d.location); }
        else { err.style.color = '#ff8a8a'; err.textContent = (d && d.error) || 'Error'; }
      }).catch(function () { err.style.color = '#ff8a8a'; err.textContent = 'Network error'; });
    };
  }

  window.NA_COUNTRIES = NA_COUNTRIES;
  window.naPopulateCountryList = populateCountryList;
  window.naWireCityAutocomplete = wireCityAutocomplete;
  window.naMaybeLocationModal = maybeLocationModal;
})();
