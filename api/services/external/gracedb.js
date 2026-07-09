// LIGO/Virgo/KAGRA — public gravitational-wave superevent alerts via GraceDB.
// No auth for public production superevents. Cosmos layer. Best-effort (the API
// shape/availability varies; errors are isolated).
const { getJson, iso } = require('./_util');

async function fetchLatest() {
  return fromUrls([
    'https://gracedb.ligo.org/api/superevents/?category=Production&count=20&format=json',
    'https://gracedb.ligo.org/apiweb/superevents/?category=Production&count=20&format=json'
  ]);
}

// Historical superevents for an explicit [from,to] window. GraceDB's query
// language filters by created date (`created: <from> .. <to>`). Best-effort —
// real detections only exist during observing runs, so most windows are empty.
async function fetchHistory(ctx) {
  var d10 = function (t) { return new Date(t).toISOString().slice(0, 10); };
  var q = encodeURIComponent('created: ' + d10((ctx && ctx.from) || Date.now()) + ' .. ' + d10((ctx && ctx.to) || Date.now()));
  return fromUrls([
    'https://gracedb.ligo.org/api/superevents/?query=' + q + '&count=50&format=json',
    'https://gracedb.ligo.org/apiweb/superevents/?query=' + q + '&count=50&format=json'
  ]);
}

async function fromUrls(urls) {
  const out = [];
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
module.exports = { fetchLatest, fetchHistory };
