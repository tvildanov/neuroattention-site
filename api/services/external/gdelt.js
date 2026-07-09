// GDELT — high-impact world events (conflict / disaster / election / crisis).
// No auth. NOT a media feed — a filtered layer of significant world events.
const { getJson } = require('./_util');

// GDELT seendate is "YYYYMMDDTHHMMSSZ"
function gdeltDate(s) {
  if (!s || s.length < 15) return null;
  try {
    var d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(9, 11), +s.slice(11, 13), +s.slice(13, 15)));
    return isNaN(d) ? null : d.toISOString();
  } catch (e) { return null; }
}

// GDELT wants datetimes as "YYYYMMDDHHMMSS" (UTC). When a window is given we use
// startdatetime/enddatetime (the archive path); otherwise a rolling timespan.
function gdeltStamp(t) { return new Date(t).toISOString().replace(/[-:T]/g, '').slice(0, 14); }
function urlFor(query, win) {
  var range = (win && win.from && win.to)
    ? '&startdatetime=' + gdeltStamp(win.from) + '&enddatetime=' + gdeltStamp(win.to)
    : '&timespan=3d';
  return 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent(query) +
    '&mode=artlist&maxrecords=' + ((win && win.max) || 25) + '&sort=hybridrel&format=json' + range;
}
async function tryQuery(query, win) {
  try {
    const d = await getJson(urlFor(query, win));
    return (d && d.articles) || [];
  } catch (err) { console.warn('[ext/gdelt]', err.message); return []; }
}
// GDELT's DOC API only indexes ~3 months back; older windows return nothing.
var THEMED = '(theme:WAR OR theme:ARMEDCONFLICT OR theme:NATURAL_DISASTER OR theme:DISASTER ' +
  'OR theme:CRISISLEX_CRISISLEXREC OR theme:ELECTION OR theme:PANDEMIC) sourcelang:eng';
var KEYWORD = '(earthquake OR flood OR wildfire OR war OR conflict OR "natural disaster" OR election OR pandemic) sourcelang:eng';

async function fetchLatest() { return build(null); }

// Historical world events for an explicit [from,to] window (archive path).
async function fetchHistory(ctx) {
  return build({ from: (ctx && ctx.from) || Date.now() - 3 * 864e5, to: (ctx && ctx.to) || Date.now(), max: 75 });
}

async function build(win) {
  const out = [];
  // GDELT's multi-theme boolean query is fragile and sometimes returns nothing.
  // Try the themed high-impact query first; if it's empty, fall back to a simple
  // keyword query so the Social layer isn't permanently "No data".
  var articles = await tryQuery(THEMED, win);
  if (!articles.length) articles = await tryQuery(KEYWORD, win);
  articles.slice(0, (win && win.max) || 25).forEach(function (a) {
    if (!a.title) return;
    out.push({ layer: 'social', source: 'GDELT', source_url: a.url, event_type: 'world_event',
      title: a.title, description: (a.domain || '') + (a.sourcecountry ? ' · ' + a.sourcecountry : ''),
      timestamp: gdeltDate(a.seendate), location_scope: 'global',
      dedup_key: 'gdelt:' + (a.url || a.title).slice(0, 200), raw_payload: a });
  });
  return out.filter(function (x) { return x.timestamp && x.title; });
}
module.exports = { fetchLatest, fetchHistory };
