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
      // GraceDB's "Production" feed ALSO serves continuous MDC (Mock Data
      // Challenge, id "MS…", category "MDC") and test ("TS…") replays — these
      // looked like a real GW every hour. Keep only genuine production
      // superevents: id "S"+date AND category not MDC/Test. Real events are
      // rare (only during observing runs), so an empty list here is correct. — fix
      const raw = d.superevents || d.results || [];
      const list = raw.filter(function (s) {
        const id = s.superevent_id || s.graceid || '';
        const cat = String(s.category || '').toUpperCase();
        return /^S\d/.test(id) && cat !== 'MDC' && cat !== 'TEST' && cat !== 'T';
      });
      list.slice(0, 20).forEach(function (s) {
        const id = s.superevent_id || s.graceid;
        if (!id) return;
        // classification (BBH/BNS/NSBH/Terrestrial) when the preferred event carries it
        const pe = s.preferred_event_data || {};
        const cls = pe.classification || (pe.extra_attributes && pe.extra_attributes.Classification) || null;
        out.push({ layer: 'cosmos', source: 'LIGO/Virgo/KAGRA (GraceDB)',
          source_url: 'https://gracedb.ligo.org/superevents/' + id + '/view/', event_type: 'gw_candidate',
          title: 'Gravitational-wave candidate ' + id,
          description: 'LVK public alert. Biological relevance is not assumed.',
          timestamp: iso(s.created || s.t_0 || s.created_at), severity: s.category || null, location_scope: 'global',
          dedup_key: 'gracedb:' + id, raw_payload: Object.assign({ classification: cls }, s) });
      });
      if (raw.length) break;   // endpoint answered (even if all were mocks) — stop trying URLs
    } catch (err) { console.warn('[ext/gracedb]', err.message); }
  }
  return out.filter(function (x) { return x.timestamp; });
}
module.exports = { fetchLatest };
