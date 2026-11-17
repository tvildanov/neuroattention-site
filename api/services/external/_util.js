// Shared helpers for External Field source services. Each source exports
// async fetchLatest(ctx) -> normalized event[]; a failure in one source must
// never block the others (the poller wraps each call in try/catch).

async function getJson(url, opts) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, Object.assign({ signal: ctrl.signal, headers: { 'User-Agent': 'NeuroAttention-ExternalField/1.0 (+https://neuroattention.org)' } }, opts || {}));
    if (!r.ok) { const err=new Error(url.split('?')[0]+' -> HTTP '+r.status);err.status=r.status;throw err; }
    return await r.json();
  } finally { clearTimeout(to); }
}

function iso(t) { try { var d = new Date(t); return isNaN(d) ? null : d.toISOString(); } catch (e) { return null; } }
// NOAA product timestamps are "YYYY-MM-DD HH:MM:SS" in UTC (no zone marker)
function isoUtc(s) { if(s==null||s==='')return null;const t=String(s).replace(' ','T');return iso(/[Zz]$|[+-]\d{2}:?\d{2}$/.test(t)?t:t+'Z'); }

module.exports = { getJson, iso, isoUtc };
