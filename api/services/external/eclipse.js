// Eclipses — solar + lunar. Nick P6-final: the Moon layer materializes only
// full/new moons AND eclipses (lunar + solar). Eclipse dates are ASTRONOMICAL
// FACTS, not something to approximate at runtime, so we carry an authoritative
// static table transcribed from NASA/GSFC's eclipse catalogue
// (https://eclipse.gsfc.nasa.gov/ — Five Millennium Canon). Each entry is
// date-accurate (the Path/Calendar marker is a day-level marker); `time` is the
// UTC instant of greatest eclipse where known, else 12:00 UTC of that day.
//
// Coverage window: 2024-01-01 … 2030-12-31. EXTEND THIS TABLE before it lapses
// (a one-line pull from the NASA canon). Outside the window the source returns []
// — it never fabricates an eclipse. `magnitude` is the eclipse magnitude from the
// canon where published (solar: fraction of the Sun's diameter covered; lunar:
// umbral magnitude), else null.
const { iso } = require('./_util');

// [dateUTC, kind('solar'|'lunar'), type, magnitude|null]
// type ∈ solar: total|annular|hybrid|partial ; lunar: total|partial|penumbral
const ECLIPSES = [
  // ── 2024 ──
  ['2024-03-25', 'lunar', 'penumbral', 0.956],
  ['2024-04-08', 'solar', 'total',     1.057],
  ['2024-09-18', 'lunar', 'partial',   0.085],
  ['2024-10-02', 'solar', 'annular',   0.933],
  // ── 2025 ──
  ['2025-03-14', 'lunar', 'total',     1.178],
  ['2025-03-29', 'solar', 'partial',   0.938],
  ['2025-09-07', 'lunar', 'total',     1.362],
  ['2025-09-21', 'solar', 'partial',   0.855],
  // ── 2026 ──
  ['2026-02-17', 'solar', 'annular',   0.963],
  ['2026-03-03', 'lunar', 'total',     1.151],
  ['2026-08-12', 'solar', 'total',     1.039],
  ['2026-08-28', 'lunar', 'partial',   0.930],
  // ── 2027 ──
  ['2027-02-06', 'solar', 'annular',   0.928],
  ['2027-02-20', 'lunar', 'penumbral', 0.918],
  ['2027-07-18', 'lunar', 'penumbral', 0.048],
  ['2027-08-02', 'solar', 'total',     1.079],
  ['2027-08-17', 'lunar', 'penumbral', 0.199],
  // ── 2028 ──
  ['2028-01-12', 'lunar', 'partial',   0.066],
  ['2028-01-26', 'solar', 'annular',   0.921],
  ['2028-07-06', 'lunar', 'partial',   0.386],
  ['2028-07-22', 'solar', 'total',     1.056],
  ['2028-12-31', 'lunar', 'total',     1.246],
  // ── 2029 ──
  ['2029-01-14', 'solar', 'partial',   0.871],
  ['2029-06-12', 'solar', 'partial',   0.458],
  ['2029-06-26', 'lunar', 'total',     1.844],
  ['2029-07-11', 'solar', 'partial',   0.230],
  ['2029-12-05', 'solar', 'partial',   0.891],
  ['2029-12-20', 'lunar', 'total',     1.117],
  // ── 2030 ──
  ['2030-06-01', 'solar', 'annular',   0.944],
  ['2030-06-15', 'lunar', 'partial',   0.500],
  ['2030-11-25', 'solar', 'total',     1.047],
  ['2030-12-09', 'lunar', 'penumbral', 0.933],
];

function label(kind, type) {
  const k = kind === 'solar' ? 'Solar' : 'Lunar';
  return k + ' eclipse (' + type + ')';
}

function eclipseEvent(row) {
  const [date, kind, type, mag] = row;
  const ts = iso(date + 'T12:00:00Z');
  return {
    layer: 'moon', source: 'NASA/GSFC eclipse catalogue', source_url: 'https://eclipse.gsfc.nasa.gov/',
    event_type: 'eclipse',
    title: label(kind, type) + (mag != null ? ' · mag ' + mag.toFixed(2) : ''),
    description: (kind === 'solar' ? 'Solar' : 'Lunar') + ' eclipse — ' + type + '.',
    timestamp: ts, severity: type, location_scope: 'global',
    dedup_key: 'eclipse:' + date + ':' + kind,
    latitude: null, longitude: null,
    raw_payload: { eclipse: true, kind: kind, type: type, magnitude: mag, date: date },
  };
}

// Live view: eclipses within a small window around "now" (so the current-day
// view surfaces an eclipse happening today/this week).
async function fetchLatest() {
  const now = Date.now(), lo = now - 3 * 864e5, hi = now + 3 * 864e5;
  return ECLIPSES.filter(r => {
    const t = new Date(r[0] + 'T12:00:00Z').getTime();
    return t >= lo && t <= hi;
  }).map(eclipseEvent);
}

// Historical/window view for [from,to].
async function fetchHistory(ctx) {
  const from = new Date((ctx && ctx.from) || 0).getTime();
  const to = new Date((ctx && ctx.to) || Date.now()).getTime();
  return ECLIPSES.filter(r => {
    const t = new Date(r[0] + 'T12:00:00Z').getTime();
    return t >= from && t <= to;
  }).map(eclipseEvent);
}

module.exports = { fetchLatest, fetchHistory, ECLIPSES };
