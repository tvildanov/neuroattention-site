'use strict';
// At-rest encryption for OAuth tokens & Apple app-specific passwords.
// AES-256-GCM. No new npm dependency — Node's built-in `crypto`.
//
// KEY: prefers a dedicated ENCRYPTION_KEY env var; falls back to JWT_SECRET so
// token encryption works out of the box on the existing secret. Documented
// trade-off (see EXTERNAL-CALENDAR-OAUTH-REPORT.md): rotating JWT_SECRET would
// invalidate every stored calendar token → users must reconnect. Set a dedicated
// ENCRYPTION_KEY on Railway to decouple the two. We do NOT auto-generate + persist
// a key from the app process (that would require Railway API access at runtime and
// silently diverge across instances); instead we degrade gracefully and log a
// fingerprint so ops can confirm the active key.
//
// A static app-level salt is acceptable here: the passphrase is already a secret,
// high-entropy value, and we are protecting data at rest in our own database — not
// stretching a low-entropy user password.
const crypto = require('crypto');

const STATIC_SALT = 'neuroattention.calendar.tokens.v1';

function passphrase() {
  return process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || '';
}

function haveKey() { return !!passphrase(); }

let _key = null;
function key() {
  if (_key) return _key;
  const pass = passphrase();
  if (!pass) throw new Error('calendar/crypto: no ENCRYPTION_KEY or JWT_SECRET set');
  _key = crypto.scryptSync(pass, STATIC_SALT, 32);
  return _key;
}

// Encrypt → 'v1:<ivHex>:<tagHex>:<cipherHex>'. Empty/null input → null.
function encrypt(plain) {
  if (plain == null || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return 'v1:' + iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

// Reverse of encrypt. Any tampering / wrong key / bad format → null (never throws).
function decrypt(blob) {
  if (!blob) return null;
  try {
    const p = String(blob).split(':');
    if (p.length !== 4 || p[0] !== 'v1') return null;
    const iv = Buffer.from(p[1], 'hex');
    const tag = Buffer.from(p[2], 'hex');
    const data = Buffer.from(p[3], 'hex');
    const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  } catch (e) { return null; }
}

// Non-reversible 8-char fingerprint of the active key — logs only, never secrets.
function keyFingerprint() {
  try { return crypto.createHash('sha256').update(key()).digest('hex').slice(0, 8); }
  catch (e) { return null; }
}

module.exports = { encrypt, decrypt, haveKey, keyFingerprint };
