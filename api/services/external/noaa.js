// NOAA SWPC — solar X-ray flux (flare class), planetary Kp, solar wind, alerts.
// No auth. Public JSON products. Sun + Earth layers.
const { getJson, isoUtc } = require('./_util');

function flareClass(flux) {
  if (!(flux > 0)) return 'A0.0';
  if (flux >= 1e-4) return 'X' + (flux / 1e-4).toFixed(1);
  if (flux >= 1e-5) return 'M' + (flux / 1e-5).toFixed(1);
  if (flux >= 1e-6) return 'C' + (flux / 1e-6).toFixed(1);
  if (flux >= 1e-7) return 'B' + (flux / 1e-7).toFixed(1);
  return 'A' + (flux / 1e-8).toFixed(1);
}
function gScale(kp) {
  if (kp >= 9) return 'Extreme geomagnetic storm (G5)';
  if (kp >= 8) return 'Severe geomagnetic storm (G4)';
  if (kp >= 7) return 'Strong geomagnetic storm (G3)';
  if (kp >= 6) return 'Moderate geomagnetic storm (G2)';
  if (kp >= 5) return 'Minor geomagnetic storm (G1)';
  return 'Quiet to unsettled geomagnetic field';
}

async function fetchLatest() {
  const out = [];
  // ── X-ray flux → current flare level (sun) ──
  try {
    const xr = await getJson('https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json');
    const long = xr.filter(function (d) { return d.energy === '0.1-0.8nm'; });
    const last = long[long.length - 1];
    if (last) {
      const cls = flareClass(last.flux);
      out.push({ layer: 'sun', source: 'NOAA SWPC', source_url: 'https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json',
        event_type: 'xray_flux', title: 'Solar X-ray flux: ' + cls + ' class',
        description: 'GOES long-channel (0.1–0.8 nm) X-ray flux.', timestamp: last.time_tag,
        severity: cls, location_scope: 'global', dedup_key: 'noaa:xray:' + String(last.time_tag).slice(0, 13),
        raw_payload: last });
    }
  } catch (e) { console.warn('[ext/noaa] xray:', e.message); }

  // ── Planetary Kp index + Ap (earth) ──
  try {
    const kpRaw = await getJson('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
    // NOAA now serves an array of OBJECTS {time_tag, Kp, a_running, station_count}
    // with no header row; the legacy shape was an array-of-arrays WITH a header.
    // Support both — the old `slice(1)` + index access produced NaN on the new
    // shape, which is why Planetary Kp was rendering as a dash. — fix
    let rows = kpRaw;
    if (Array.isArray(rows[0])) rows = rows.slice(1);             // legacy header row
    const last = rows[rows.length - 1];
    const kp = last ? (Array.isArray(last) ? parseFloat(last[1]) : parseFloat(last.Kp)) : NaN;
    const tt = last ? (Array.isArray(last) ? last[0] : last.time_tag) : null;
    const ap = last ? (Array.isArray(last) ? parseFloat(last[2]) : last.a_running) : null;
    if (isFinite(kp) && tt) {
      out.push({ layer: 'earth', source: 'NOAA SWPC', source_url: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
        event_type: 'kp_index', title: 'Planetary Kp: ' + kp, description: gScale(kp),
        timestamp: isoUtc(tt), severity: 'Kp' + kp, location_scope: 'global',
        dedup_key: 'noaa:kp:' + tt, raw_payload: { time: tt, kp: kp, ap: ap } });
    }
  } catch (e) { console.warn('[ext/noaa] kp:', e.message); }

  // ── F10.7 cm solar radio flux (sun) — a standard solar-activity proxy ──
  try {
    const f = await getJson('https://services.swpc.noaa.gov/json/f107_cm_flux.json');
    const last = Array.isArray(f) ? f[f.length - 1] : null;
    if (last && last.flux != null) {
      out.push({ layer: 'sun', source: 'NOAA SWPC', source_url: 'https://services.swpc.noaa.gov/json/f107_cm_flux.json',
        event_type: 'f107_flux', title: 'F10.7 solar flux: ' + last.flux + ' sfu',
        description: '10.7 cm radio flux — a proxy for overall solar activity.', timestamp: isoUtc(last.time_tag),
        severity: last.flux + ' sfu', location_scope: 'global',
        dedup_key: 'noaa:f107:' + String(last.time_tag).slice(0, 10), raw_payload: last });
    }
  } catch (e) { console.warn('[ext/noaa] f107:', e.message); }

  // ── Solar wind plasma (sun) ──
  try {
    const sw = await getJson('https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json');
    const rows = sw.slice(1);
    const last = rows[rows.length - 1]; // [time, density, speed, temperature]
    if (last && last[2]) {
      out.push({ layer: 'sun', source: 'NOAA SWPC', source_url: 'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json',
        event_type: 'solar_wind', title: 'Solar wind speed: ' + Math.round(last[2]) + ' km/s',
        description: 'Density ' + last[1] + ' p/cm³.', timestamp: isoUtc(last[0]),
        severity: Math.round(last[2]) + ' km/s', location_scope: 'global',
        dedup_key: 'noaa:sw:' + last[0], raw_payload: { time: last[0], density: last[1], speed: last[2] } });
    }
  } catch (e) { console.warn('[ext/noaa] solarwind:', e.message); }

  // ── Active alerts/warnings (sun or earth by content) ──
  try {
    const alerts = await getJson('https://services.swpc.noaa.gov/products/alerts.json');
    alerts.slice(0, 10).forEach(function (a) {
      const msg = String(a.message || '').replace(/\s+/g, ' ').trim();
      if (!msg) return;
      const layer = /geomagnetic|planetary k|kp |storm/i.test(msg) ? 'earth' : 'sun';
      const head = (msg.match(/(ALERT|WARNING|WATCH|SUMMARY)[:\s].{0,80}/i) || [msg.slice(0, 90)])[0];
      out.push({ layer: layer, source: 'NOAA SWPC', source_url: 'https://services.swpc.noaa.gov/products/alerts.json',
        event_type: 'alert', title: head.replace(/\s+/g, ' ').trim(), description: msg.slice(0, 500),
        timestamp: isoUtc(a.issue_datetime), location_scope: 'global',
        dedup_key: 'noaa:alert:' + a.issue_datetime + ':' + (a.product_id || ''), raw_payload: a });
    });
  } catch (e) { console.warn('[ext/noaa] alerts:', e.message); }

  return out.filter(function (e) { return e.timestamp; });
}

module.exports = { fetchLatest };
