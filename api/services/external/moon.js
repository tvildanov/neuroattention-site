// Moon — pure astronomical lunar phase (no auth, always available). Global daily
// "moon phase" event. (moonrise/moonset are location-dependent and computed
// client-side once the user provides a location.)
function moonData(date) {
  var SYNODIC = 29.53058867;
  var EPOCH = Date.UTC(2000, 0, 6, 18, 14); // known new moon 2000-01-06 18:14 UTC
  var age = ((date.getTime() - EPOCH) / 86400000) % SYNODIC;
  if (age < 0) age += SYNODIC;
  var f = age / SYNODIC;
  var illum = (1 - Math.cos(2 * Math.PI * f)) / 2; // 0..1
  var phase;
  if (age < 1.0) phase = 'New Moon';
  else if (Math.abs(f - 0.25) < 0.02) phase = 'First Quarter';
  else if (Math.abs(f - 0.5) < 0.02) phase = 'Full Moon';
  else if (Math.abs(f - 0.75) < 0.02) phase = 'Last Quarter';
  else if (f < 0.25) phase = 'Waxing Crescent';
  else if (f < 0.5) phase = 'Waxing Gibbous';
  else if (f < 0.75) phase = 'Waning Gibbous';
  else phase = 'Waning Crescent';
  return { age: age, illumination: illum, fraction: f, phase: phase };
}

function moonEvent(date) {
  var m = moonData(date);
  return { layer: 'moon', source: 'Computed (astronomical)', source_url: null, event_type: 'moon_phase',
    title: 'Moon: ' + m.phase + ' · ' + Math.round(m.illumination * 100) + '% illuminated',
    description: 'Lunar age ' + m.age.toFixed(1) + ' days.', timestamp: date.toISOString(),
    location_scope: 'global', severity: m.phase, dedup_key: 'moon:phase:' + date.toISOString().slice(0, 10),
    raw_payload: m };
}

async function fetchLatest() { return [moonEvent(new Date())]; }

// One deterministic phase event per UTC day across [from,to] (max 60 days).
// Pure astronomy — always available, no network. Anchored at 12:00 UTC so the
// stamp lands squarely inside the day it represents.
async function fetchHistory(ctx) {
  var from = new Date((ctx && ctx.from) || Date.now()), to = new Date((ctx && ctx.to) || Date.now());
  var out = [], day = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 12));
  var end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate(), 12);
  for (var i = 0; i < 60 && day.getTime() <= end; i++) { out.push(moonEvent(new Date(day))); day.setUTCDate(day.getUTCDate() + 1); }
  return out;
}
module.exports = { fetchLatest, fetchHistory, moonData };
