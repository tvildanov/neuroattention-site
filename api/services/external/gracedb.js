// LIGO/Virgo/KAGRA — public gravitational-wave superevent alerts via GraceDB.
// No auth for public production superevents. Cosmos layer. Best-effort (the API
// shape/availability varies; errors are isolated).
const { getJson, iso } = require('./_util');

async function fetchLatest() {
  const out = [];
  const urls = [
    'https://gracedb.ligo.org/api/superevents/?category=Production&count=20&format=json',
    'https://gracedb.ligo.org/apiweb/superevents/?category=Production&count=20&format=json'
  ];
  for (var i = 0; i < urls.length; i++) {
    try {
      const d = await getJson(urls[i]);
      const list = d.superevents || d.results || [];
      list.slice(0, 20).forEach(function (s) {
        const id = s.superevent_id || s.graceid;
        if (!id) return;
        out.push({ layer: 'cosmos', source: 'LIGO/Virgo/KAGRA (GraceDB)',
          source_url: 'https://gracedb.ligo.org/superevents/' + id + '/view/', event_type: 'gw_candidate',
          title: 'Gravitational-wave candidate ' + id,
          description: 'LVK public alert. Biological relevance is not assumed.',
          timestamp: iso(s.created || s.t_0 || s.created_at), severity: s.category || null, location_scope: 'global',
          dedup_key: 'gracedb:' + id, raw_payload: s });
      });
      if (list.length) break;
    } catch (err) { console.warn('[ext/gracedb]', err.message); }
  }
  return out.filter(function (x) { return x.timestamp; });
}
module.exports = { fetchLatest };
