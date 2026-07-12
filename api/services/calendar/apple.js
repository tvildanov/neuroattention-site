'use strict';
// Apple iCloud provider — CalDAV (RFC 4791) + iCalendar (RFC 5545). Apple gives NO
// public OAuth for consumer iCloud accounts, so the only path is CalDAV with an
// APP-SPECIFIC PASSWORD the user generates at appleid.apple.com → Sign-In & Security.
//
// Dependency-free: native fetch with Basic auth + a compact iCal parser. This is a
// deliberately MINIMAL CalDAV client covering the common iCloud case:
//   principal discovery → calendar-home-set → list calendars → time-ranged REPORT.
// KNOWN LIMITATIONS (documented in the report, verify on a live account before GA):
//   • Timezone: DTSTART with a TZID is treated as wall-clock (no VTIMEZONE table
//     resolution). UTC ('...Z') and all-day (VALUE=DATE) are handled exactly.
//   • Recurrence: RRULE master events are imported once at their DTSTART; expanded
//     instances are NOT generated client-side (iCloud's REPORT returns masters).
//   • XML is parsed with targeted regex over the predictable multistatus body, not
//     a full DOM — adequate for iCloud's response shape, not a general CalDAV client.
// If these limits bite in practice, swapping in `tsdav` is a single-file change.

const ICLOUD_ROOT = 'https://caldav.icloud.com';

function configured() { return true; } // no server-side app credentials needed

function basicAuth(email, appPassword) {
  return 'Basic ' + Buffer.from(email + ':' + appPassword).toString('base64');
}

async function propfind(url, auth, depth, xmlBody) {
  const r = await fetch(url, {
    method: 'PROPFIND',
    headers: {
      Authorization: auth,
      Depth: String(depth),
      'Content-Type': 'application/xml; charset=utf-8',
    },
    body: xmlBody,
  });
  const text = await r.text();
  return { status: r.status, ok: r.ok, text };
}

function absolutize(href) {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  return ICLOUD_ROOT + (href.startsWith('/') ? href : '/' + href);
}

// Pull the first href inside the first element matching one of the given local names.
function firstHrefUnder(xml, localNames) {
  for (const name of localNames) {
    const re = new RegExp('<[^>]*\\b' + name + '\\b[^>]*>([\\s\\S]*?)<\\/[^>]*' + name + '>', 'i');
    const m = xml.match(re);
    if (m) {
      const h = m[1].match(/<[^>]*href[^>]*>([\s\S]*?)<\/[^>]*href>/i);
      if (h) return h[1].trim();
    }
  }
  return null;
}

// Validate credentials + discover the principal. Returns { principalUrl, homeUrl }.
async function connect({ email, appPassword }) {
  const auth = basicAuth(email, appPassword);
  const body = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>`;
  const res = await propfind(ICLOUD_ROOT + '/', auth, 0, body);
  if (res.status === 401 || res.status === 403) { const e = new Error('apple auth rejected'); e.authFailed = true; throw e; }
  if (res.status !== 207) throw new Error('apple CalDAV principal probe failed: HTTP ' + res.status);
  const principalHref = firstHrefUnder(res.text, ['current-user-principal']);
  const principalUrl = absolutize(principalHref) || ICLOUD_ROOT + '/';
  const homeUrl = await discoverHome(principalUrl, auth);
  return { principalUrl, homeUrl };
}

async function discoverHome(principalUrl, auth) {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set/></d:prop></d:propfind>`;
  const res = await propfind(principalUrl, auth, 0, body);
  const homeHref = firstHrefUnder(res.text, ['calendar-home-set']);
  return absolutize(homeHref);
}

// List calendar collection hrefs under the home set (Depth:1).
async function listCalendars(homeUrl, auth) {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:resourcetype/><d:displayname/><c:supported-calendar-component-set/></d:prop></d:propfind>`;
  const res = await propfind(homeUrl, auth, 1, body);
  const cals = [];
  // Split into <response> blocks; keep those whose resourcetype includes <calendar/>.
  const blocks = res.text.split(/<[^>]*\bresponse\b[^>]*>/i).slice(1);
  for (const b of blocks) {
    if (!/<[^>]*\bcalendar\b[^>]*\/>/i.test(b)) continue;
    const h = b.match(/<[^>]*href[^>]*>([\s\S]*?)<\/[^>]*href>/i);
    if (h) cals.push(absolutize(h[1].trim()));
  }
  return cals;
}

// REPORT calendar-query with a VEVENT time-range filter → array of iCal blobs.
async function reportEvents(calUrl, auth, timeMin, timeMax) {
  const fmt = (iso) => {
    const d = new Date(iso);
    return d.getUTCFullYear()
      + String(d.getUTCMonth() + 1).padStart(2, '0')
      + String(d.getUTCDate()).padStart(2, '0') + 'T'
      + String(d.getUTCHours()).padStart(2, '0')
      + String(d.getUTCMinutes()).padStart(2, '0')
      + String(d.getUTCSeconds()).padStart(2, '0') + 'Z';
  };
  const body = `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-data/></d:prop>
  <c:filter><c:comp-filter name="VCALENDAR">
    <c:comp-filter name="VEVENT">
      <c:time-range start="${fmt(timeMin)}" end="${fmt(timeMax)}"/>
    </c:comp-filter>
  </c:comp-filter></c:filter>
</c:calendar-query>`;
  const r = await fetch(calUrl, {
    method: 'REPORT',
    headers: { Authorization: auth, Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' },
    body,
  });
  const text = await r.text();
  if (r.status !== 207) return [];
  const blobs = [];
  const re = /<[^>]*calendar-data[^>]*>([\s\S]*?)<\/[^>]*calendar-data>/gi;
  let m;
  while ((m = re.exec(text))) {
    blobs.push(decodeXmlEntities(m[1]));
  }
  return blobs;
}

function decodeXmlEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, '&');
}

// ---- minimal iCalendar (RFC 5545) parsing ----

// Unfold folded lines: a CRLF followed by a space/tab continues the previous line.
function unfold(ical) {
  return String(ical).replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

// '20260102T090000Z' | '20260102T090000' | '20260102' → ISO-ish string + allDay flag.
function parseIcalDate(rawKeyAndVal) {
  // rawKeyAndVal example: 'DTSTART;TZID=America/New_York:20260102T090000'
  const [head, ...rest] = rawKeyAndVal.split(':');
  const value = rest.join(':').trim();
  const isDateOnly = /VALUE=DATE\b/i.test(head) || /^\d{8}$/.test(value);
  if (isDateOnly) {
    const y = value.slice(0, 4), mo = value.slice(4, 6), d = value.slice(6, 8);
    return { iso: `${y}-${mo}-${d}`, allDay: true };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return { iso: value, allDay: false };
  const [, y, mo, d, h, mi, s, z] = m;
  // UTC ('Z') kept exact; a TZID/floating time is treated as wall-clock (no offset).
  return { iso: `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? 'Z' : ''}`, allDay: false };
}

function parseVevents(ical) {
  const text = unfold(ical);
  const out = [];
  const blocks = text.split('BEGIN:VEVENT').slice(1);
  for (const raw of blocks) {
    const block = raw.split('END:VEVENT')[0];
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const ev = {};
    let dtStart = null, dtEnd = null;
    for (const line of lines) {
      const key = line.split(/[;:]/)[0].toUpperCase();
      if (key === 'UID') ev.id = line.slice(line.indexOf(':') + 1).trim();
      else if (key === 'SUMMARY') ev.title = line.slice(line.indexOf(':') + 1).trim();
      else if (key === 'DESCRIPTION') ev.description = line.slice(line.indexOf(':') + 1).trim();
      else if (key === 'DTSTART') dtStart = parseIcalDate(line);
      else if (key === 'DTEND') dtEnd = parseIcalDate(line);
    }
    if (!ev.id || !dtStart) continue;
    out.push({
      id: ev.id,
      title: ev.title || '(no title)',
      start: dtStart.iso,
      end: dtEnd ? dtEnd.iso : null,
      allDay: !!dtStart.allDay,
      description: ev.description || '',
    });
  }
  return out;
}

// Full fetch: discover → list calendars → REPORT each → parse. Dedups by UID across
// calendars (iCloud can surface the same event in overlapping collections).
async function fetchEvents({ email, appPassword, homeUrl, timeMin, timeMax }) {
  const auth = basicAuth(email, appPassword);
  let home = homeUrl;
  if (!home) { const c = await connect({ email, appPassword }); home = c.homeUrl; }
  if (!home) throw new Error('apple: no calendar-home-set discovered');
  const calendars = await listCalendars(home, auth);
  const seen = new Set();
  const out = [];
  for (const cal of calendars) {
    let blobs = [];
    try { blobs = await reportEvents(cal, auth, timeMin, timeMax); }
    catch (e) { continue; }
    for (const blob of blobs) {
      for (const ev of parseVevents(blob)) {
        if (seen.has(ev.id)) continue;
        seen.add(ev.id);
        out.push(ev);
      }
    }
  }
  return out;
}

module.exports = { configured, connect, listCalendars, fetchEvents, parseVevents, _internal: { parseIcalDate, unfold } };
