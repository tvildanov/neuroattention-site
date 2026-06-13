// Shared helpers for External Field source services. Each source exports
// async fetchLatest(ctx) -> normalized event[]; a failure in one source must
// never block the others (the poller wraps each call in try/catch).

async function getJson(url, opts) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, Object.assign({ signal: ctrl.signal, headers: { 'User-Agent': 'NeuroAttention-ExternalField/1.0 (+https://neuroattention.org)' } }, opts || {}));
    if (!r.ok) throw new Error(url.split('?')[0] + ' -> HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(to); }
}

function iso(t) { try { var d = new Date(t); return isNaN(d) ? null : d.toISOString(); } catch (e) { return null; } }
// NOAA product timestamps are "YYYY-MM-DD HH:MM:SS" in UTC (no zone marker)
function isoUtc(s) { try { return new Date(String(s).replace(' ', 'T') + 'Z').toISOString(); } catch (e) { return null; } }

module.exports = { getJson, iso, isoUtc };
