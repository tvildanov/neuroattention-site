/* ============================================================================
   SunCalc-lite — astronomical Moon phase + moonrise/moonset, zero-dependency.
   Ported from SunCalc (https://github.com/mourner/suncalc, BSD-2-Clause,
   © 2014 Vladimir Agafonkin), trimmed to the Moon routines we need:
     window.SunCalcLite.getMoonIllumination(date) -> { fraction, phase, angle }
     window.SunCalcLite.getMoonTimes(date, lat, lng) -> { rise, set, alwaysUp, alwaysDown }
     window.SunCalcLite.moonPhaseName(phase) -> canonical English phase string
   `phase` is 0..1 where 0 = New, 0.25 = First Quarter, 0.5 = Full, 0.75 = Last
   Quarter. Used by External Field (Moon tab moonrise/moonset) and the Evolution
   Path lunar-phase day markers. — PR#110
   ============================================================================ */
(function () {
  'use strict';
  var PI = Math.PI, rad = PI / 180,
    dayMs = 1000 * 60 * 60 * 24, J1970 = 2440588, J2000 = 2451545;

  function toJulian(date) { return date.valueOf() / dayMs - 0.5 + J1970; }
  function fromJulian(j) { return new Date((j + 0.5 - J1970) * dayMs); }
  function toDays(date) { return toJulian(date) - J2000; }

  var e = rad * 23.4397; // obliquity of the Earth

  function rightAscension(l, b) { return Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)); }
  function declination(l, b) { return Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l)); }
  function siderealTime(d, lw) { return rad * (280.16 + 360.9856235 * d) - lw; }
  function astroRefraction(h) {
    if (h < 0) h = 0;
    return 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179));
  }

  function solarMeanAnomaly(d) { return rad * (357.5291 + 0.98560028 * d); }
  function eclipticLongitude(M) {
    var C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)),
      P = rad * 102.9372;
    return M + C + P + PI;
  }
  function sunCoords(d) {
    var M = solarMeanAnomaly(d), L = eclipticLongitude(M);
    return { dec: declination(L, 0), ra: rightAscension(L, 0) };
  }

  function moonCoords(d) { // geocentric ecliptic coordinates of the moon
    var L = rad * (218.316 + 13.176396 * d),  // ecliptic longitude
      M = rad * (134.963 + 13.064993 * d),    // mean anomaly
      F = rad * (93.272 + 13.229350 * d),     // mean distance
      l = L + rad * 6.289 * Math.sin(M),      // longitude
      b = rad * 5.128 * Math.sin(F),          // latitude
      dt = 385001 - 20905 * Math.cos(M);      // distance to the moon in km
    return { ra: rightAscension(l, b), dec: declination(l, b), dist: dt };
  }

  function moonPosition(d, lat, lng) {
    var lw = rad * -lng, phi = rad * lat, c = moonCoords(d),
      H = siderealTime(d, lw) - c.ra,
      h = altitude(H, phi, c.dec),
      pa = Math.atan2(Math.sin(H), Math.tan(phi) * Math.cos(c.dec) - Math.sin(c.dec) * Math.cos(H));
    h = h + astroRefraction(h); // altitude correction for refraction
    return { altitude: h, distance: c.dist, parallacticAngle: pa };
  }
  function altitude(H, phi, dec) { return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)); }

  function getMoonIllumination(date) {
    var d = toDays(date || new Date()),
      s = sunCoords(d), m = moonCoords(d),
      sdist = 149598000, // distance from Earth to Sun in km
      phi = Math.acos(Math.sin(s.dec) * Math.sin(m.dec) + Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra)),
      inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi)),
      angle = Math.atan2(Math.cos(s.dec) * Math.sin(s.ra - m.ra), Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra));
    return {
      fraction: (1 + Math.cos(inc)) / 2,
      phase: 0.5 + 0.5 * inc * (angle < 0 ? -1 : 1) / Math.PI,
      angle: angle
    };
  }

  // hours of a given UTC `date` (its 00:00 local-to-UTC handling is on the caller)
  function hoursLater(date, h) { return new Date(date.valueOf() + h * dayMs / 24); }

  function getMoonTimes(date, lat, lng) {
    var t = new Date(date); t.setHours(0, 0, 0, 0); // local midnight
    var hc = 0.133 * rad,
      h0 = moonPosition(toDays(t), lat, lng).altitude - hc,
      rise, set, ye, d, roots, x1, x2, dx;
    // go in 2-hour chunks, each time seeing if a 3-point quadratic crosses zero
    for (var i = 1; i <= 24; i += 2) {
      var h1 = moonPosition(toDays(hoursLater(t, i)), lat, lng).altitude - hc,
        h2 = moonPosition(toDays(hoursLater(t, i + 1)), lat, lng).altitude - hc;
      var a = (h0 + h2) / 2 - h1, b = (h2 - h0) / 2;
      var xe = -b / (2 * a); ye = (a * xe + b) * xe + h1;
      d = b * b - 4 * a * h1; roots = 0;   // discriminant uses c = h1 (NOT ye)
      if (d >= 0) {
        dx = Math.sqrt(d) / (Math.abs(a) * 2);
        x1 = xe - dx; x2 = xe + dx;
        if (Math.abs(x1) <= 1) roots++;
        if (Math.abs(x2) <= 1) roots++;
        if (x1 < -1) x1 = x2;
      }
      if (roots === 1) {
        if (h0 < 0) rise = i + x1; else set = i + x1;
      } else if (roots === 2) {
        rise = i + (ye < 0 ? x2 : x1);
        set = i + (ye < 0 ? x1 : x2);
      }
      if (rise && set) break;
      h0 = h2;
    }
    var result = {};
    if (rise) result.rise = hoursLater(t, rise);
    if (set) result.set = hoursLater(t, set);
    if (!rise && !set) result[ye > 0 ? 'alwaysUp' : 'alwaysDown'] = true;
    return result;
  }

  function moonPhaseName(phase) {
    // phase 0..1 (0=new, .25=first quarter, .5=full, .75=last quarter)
    if (phase < 0.03 || phase > 0.97) return 'New Moon';
    if (phase < 0.22) return 'Waxing Crescent';
    if (phase < 0.28) return 'First Quarter';
    if (phase < 0.47) return 'Waxing Gibbous';
    if (phase < 0.53) return 'Full Moon';
    if (phase < 0.72) return 'Waning Gibbous';
    if (phase < 0.78) return 'Last Quarter';
    return 'Waning Crescent';
  }

  window.SunCalcLite = {
    getMoonIllumination: getMoonIllumination,
    getMoonTimes: getMoonTimes,
    moonPhaseName: moonPhaseName,
    _toDays: toDays
  };
})();
