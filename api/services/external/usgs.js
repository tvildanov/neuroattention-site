// USGS — significant earthquakes (M ≥ 4.5) in the last 2 days. No auth. Earth layer.
const { getJson, iso } = require('./_util');

async function fetchLatest() {
  const start = new Date(Date.now() - 2 * 864e5).toISOString();
  const out = [];
  try {
    const geo = await getJson('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=' + start + '&minmagnitude=4.5&orderby=time&limit=50');
    (geo.features || []).forEach(function (f) {
      const p = f.properties || {}, c = (f.geometry && f.geometry.coordinates) || [];
      out.push({ layer: 'earth', source: 'USGS', source_url: p.url, event_type: 'earthquake',
        title: 'M' + p.mag + ' earthquake' + (p.place ? ' — ' + p.place : ''), description: p.place || '',
        timestamp: iso(p.time), severity: 'M' + p.mag, location_scope: 'regional', latitude: c[1], longitude: c[0],
        dedup_key: 'usgs:' + f.id, raw_payload: p });
    });
  } catch (err) { console.warn('[ext/usgs]', err.message); }
  return out.filter(function (x) { return x.timestamp; });
}
module.exports = { fetchLatest };
