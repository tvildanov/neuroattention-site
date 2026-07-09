// NASA DONKI — solar flares (FLR), coronal mass ejections (CME), geomagnetic
// storms (GST). Needs a NASA API key (env NASA_API_KEY, falls back to DEMO_KEY).
const { getJson, iso } = require('./_util');
function d10(t) { return new Date(t).toISOString().slice(0, 10); }

async function fetchLatest(ctx) {
  const key = (ctx && ctx.nasaKey) || process.env.NASA_API_KEY || 'DEMO_KEY';
  return fetchRange(d10(Date.now() - 7 * 864e5), d10(Date.now()), key);
}

// Historical FLR/CME/GST for an explicit [from,to] window (YYYY-MM-DD or ms).
// Same normalized shape as fetchLatest — DONKI's endpoints are already
// date-ranged, so this is the archive path for the Sun/Earth layers. Needs a
// real NASA key for coverage; on DEMO_KEY it is rate-limited and returns little.
async function fetchHistory(ctx) {
  const key = (ctx && ctx.nasaKey) || process.env.NASA_API_KEY || 'DEMO_KEY';
  return fetchRange(d10((ctx && ctx.from) || Date.now()), d10((ctx && ctx.to) || Date.now()), key);
}

async function fetchRange(s, e, key) {
  const out = [];
  try {
    const flr = await getJson('https://api.nasa.gov/DONKI/FLR?startDate=' + s + '&endDate=' + e + '&api_key=' + key);
    (flr || []).forEach(function (f) {
      out.push({ layer: 'sun', source: 'NASA DONKI', source_url: f.link, event_type: 'flare',
        title: 'Solar flare ' + (f.classType || '') + (f.sourceLocation ? ' (' + f.sourceLocation + ')' : ''),
        description: f.peakTime ? 'Peak ' + f.peakTime : 'Solar flare event', timestamp: iso(f.beginTime),
        start_time: iso(f.beginTime), end_time: iso(f.endTime), severity: f.classType, location_scope: 'global',
        dedup_key: 'donki:flr:' + f.flrID, raw_payload: f });
    });
  } catch (err) { console.warn('[ext/donki] flr:', err.message); }
  try {
    const cme = await getJson('https://api.nasa.gov/DONKI/CME?startDate=' + s + '&endDate=' + e + '&api_key=' + key);
    (cme || []).forEach(function (c) {
      const a = (c.cmeAnalyses && c.cmeAnalyses[0]) || {};
      out.push({ layer: 'sun', source: 'NASA DONKI', source_url: c.link, event_type: 'cme',
        title: 'Coronal mass ejection' + (a.speed ? ' · ' + Math.round(a.speed) + ' km/s' : ''),
        description: a.note || 'Coronal mass ejection detected.', timestamp: iso(c.startTime),
        start_time: iso(c.startTime), severity: a.type || null, location_scope: 'global',
        dedup_key: 'donki:cme:' + c.activityID, raw_payload: c });
    });
  } catch (err) { console.warn('[ext/donki] cme:', err.message); }
  try {
    const gst = await getJson('https://api.nasa.gov/DONKI/GST?startDate=' + s + '&endDate=' + e + '&api_key=' + key);
    (gst || []).forEach(function (g) {
      const kp = (g.allKpIndex && g.allKpIndex.length) ? g.allKpIndex[g.allKpIndex.length - 1].kpIndex : null;
      out.push({ layer: 'earth', source: 'NASA DONKI', source_url: g.link, event_type: 'geomagnetic_storm',
        title: 'Geomagnetic storm' + (kp != null ? ' · Kp ' + kp : ''), description: 'Geomagnetic storm event.',
        timestamp: iso(g.startTime), start_time: iso(g.startTime), severity: kp != null ? 'Kp' + kp : null,
        location_scope: 'global', dedup_key: 'donki:gst:' + g.gstID, raw_payload: g });
    });
  } catch (err) { console.warn('[ext/donki] gst:', err.message); }
  return out.filter(function (x) { return x.timestamp; });
}
module.exports = { fetchLatest, fetchHistory };
