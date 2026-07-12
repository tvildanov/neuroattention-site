// USGS ShakeMap — perceived-intensity (Modified Mercalli, MMI) at a point.
// Nick P6-final: an earthquake materializes for a user only if the shaking they
// actually felt reaches MMI ≥ III at their coordinates — not merely because a big
// quake happened somewhere. Pipeline:
//   1) USGS event detail (geojson) → the ShakeMap product's `download/grid.xml`.
//   2) parse the regular MMI grid, bilinear-interpolate at (userLat,userLon).
//   3) no ShakeMap for the event → Bakun–Wentworth attenuation fallback.
//   4) no user location → caller applies the M7+ global rule (not here).
// This module is PURE (fetch+parse+math, no DB). The 7-day cache of parsed grids
// lives in server.js (which owns `sql`). — grid.xml format: ShakeMap manual,
// NW-corner first, longitude varies fastest (W→E), latitude slowest (N→S).

const EVENT_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventid=';

async function getText(url) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'NeuroAttention-ExternalField/1.0 (+https://neuroattention.org)' } });
    if (!r.ok) throw new Error(url.split('?')[0] + ' -> HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(to); }
}
async function getJson(url) { return JSON.parse(await getText(url)); }

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad, dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Bakun–Wentworth simplified (per brief). PGA in cm/s²; R = epicentral distance km.
//   log10(PGA) = -0.5 + 0.6*M - 1.66*log10(R+10)
//   MMI = 3.66*log10(PGA) - 1.66
function bakunWentworthMMI(mag, distKm) {
  const logPGA = -0.5 + 0.6 * mag - 1.66 * Math.log10(distKm + 10);
  const mmi = 3.66 * logPGA - 1.66;
  if (!isFinite(mmi)) return null;
  return Math.max(1, Math.min(12, mmi));
}

// Resolve the ShakeMap grid.xml URL for an event from its geojson detail.
function gridUrlFromDetail(detail) {
  try {
    const products = detail && detail.properties && detail.properties.products;
    const sm = products && products.shakemap && products.shakemap[0];
    const contents = sm && sm.contents;
    if (!contents) return null;
    const c = contents['download/grid.xml'] || contents['download/grid.xml.gz'];
    return (c && c.url) || null;
  } catch (e) { return null; }
}

// Parse a ShakeMap grid.xml text into { lonMin,latMin,lonMax,latMax,nlon,nlat,mmi:Float64Array }.
// Returns null if the MMI field or the grid spec can't be found.
function parseGridXml(xml) {
  try {
    const spec = xml.match(/<grid_specification[^>]*>/i);
    if (!spec) return null;
    const attr = (name) => { const m = spec[0].match(new RegExp(name + '\\s*=\\s*"([^"]+)"', 'i')); return m ? Number(m[1]) : null; };
    const lonMin = attr('lon_min'), latMin = attr('lat_min'), lonMax = attr('lon_max'), latMax = attr('lat_max');
    const nlon = attr('nlon'), nlat = attr('nlat');
    if ([lonMin, latMin, lonMax, latMax, nlon, nlat].some(v => v == null || !isFinite(v))) return null;

    // field name → 1-based column index
    const fields = {};
    const fieldRe = /<grid_field\s+([^>]*)\/?>/gi; let fm;
    while ((fm = fieldRe.exec(xml))) {
      const idx = (fm[1].match(/index\s*=\s*"(\d+)"/i) || [])[1];
      const nm = (fm[1].match(/name\s*=\s*"([^"]+)"/i) || [])[1];
      if (idx && nm) fields[nm.toUpperCase()] = parseInt(idx, 10);
    }
    const nfields = Object.keys(fields).length;
    const mmiCol = fields['MMI'];
    if (!mmiCol || !nfields) return null;

    const dataM = xml.match(/<grid_data[^>]*>([\s\S]*?)<\/grid_data>/i);
    if (!dataM) return null;
    const nums = dataM[1].trim().split(/\s+/);
    const npts = nlon * nlat;
    const mmi = new Float64Array(npts);
    const off = mmiCol - 1;
    for (let p = 0; p < npts; p++) {
      const v = Number(nums[p * nfields + off]);
      mmi[p] = isFinite(v) ? v : NaN;
    }
    return { lonMin, latMin, lonMax, latMax, nlon, nlat, mmi };
  } catch (e) { return null; }
}

// Bilinear MMI at (lat,lon). NW-first ordering: point index = row*nlon + col,
// row 0 = latMax (north), col 0 = lonMin (west); lon varies fastest. Returns null
// if the point lies outside the grid footprint.
function mmiAtGrid(grid, lat, lon) {
  const { lonMin, latMin, lonMax, latMax, nlon, nlat, mmi } = grid;
  if (lon < lonMin || lon > lonMax || lat < latMin || lat > latMax) return null;
  const dlon = (lonMax - lonMin) / (nlon - 1);
  const dlat = (latMax - latMin) / (nlat - 1);
  const fcol = (lon - lonMin) / dlon;             // increases west→east
  const frow = (latMax - lat) / dlat;             // increases north→south
  const c0 = Math.min(nlon - 2, Math.max(0, Math.floor(fcol)));
  const r0 = Math.min(nlat - 2, Math.max(0, Math.floor(frow)));
  const tx = Math.min(1, Math.max(0, fcol - c0));
  const ty = Math.min(1, Math.max(0, frow - r0));
  const at = (r, c) => mmi[r * nlon + c];
  const v00 = at(r0, c0), v01 = at(r0, c0 + 1), v10 = at(r0 + 1, c0), v11 = at(r0 + 1, c0 + 1);
  if ([v00, v01, v10, v11].some(v => !isFinite(v))) {
    // fall back to nearest finite corner
    const cand = [v00, v01, v10, v11].filter(isFinite);
    return cand.length ? cand[0] : null;
  }
  const top = v00 * (1 - tx) + v01 * tx;
  const bot = v10 * (1 - tx) + v11 * tx;
  return top * (1 - ty) + bot * ty;
}

// Fetch + parse the MMI grid for an event id. Returns { ok, grid } or { ok:false }.
async function fetchGrid(eventid) {
  try {
    const detail = await getJson(EVENT_URL + encodeURIComponent(eventid));
    const url = gridUrlFromDetail(detail);
    if (!url) return { ok: false, reason: 'no_shakemap' };
    if (/\.gz$/i.test(url)) return { ok: false, reason: 'gz_unsupported' }; // prefer uncompressed grid.xml
    const xml = await getText(url);
    const grid = parseGridXml(xml);
    if (!grid) return { ok: false, reason: 'parse_failed' };
    return { ok: true, grid };
  } catch (e) { return { ok: false, reason: e.message }; }
}

module.exports = { fetchGrid, parseGridXml, mmiAtGrid, bakunWentworthMMI, haversineKm, gridUrlFromDetail };
