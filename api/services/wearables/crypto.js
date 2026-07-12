'use strict';
// At-rest encryption for wearable OAuth tokens (Oura / WHOOP). AES-256-GCM,
// Node's built-in `crypto` — no new npm dependency.
//
// Mirrors api/services/calendar/crypto.js (P7) intentionally: same passphrase
// source (ENCRYPTION_KEY → JWT_SECRET fallback) so ops only sets ONE key, but a
// distinct STATIC_SALT. The two features share the `oauth_tokens` table yet a row
// is only ever decrypted by its OWN feature's code (calendar rows by calendar
// crypto, wearable rows by wearable crypto — they never cross-decrypt), so the
// separate salt is safe and keeps each service self-contained.
//
// A static app-level salt is acceptable: the passphrase is already a high-entropy
// secret and we are protecting data at rest in our own DB, not stretching a
// low-entropy user password. Rotating JWT_SECRET (with no dedicated ENCRYPTION_KEY)
// would invalidate stored tokens → users reconnect; set ENCRYPTION_KEY on Railway
// to decouple. See WEARABLES-OAUTH-REPORT.md.
const crypto = require('crypto');

const STATIC_SALT = 'neuroattention.wearables.tokens.v1';

function passphrase() {
  return process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || '';
}

function haveKey() { return !!passphrase(); }

let _key = null;
function key() {
  if (_key) return _key;
  const pass = passphrase();
  if (!pass) throw new Error('wearables/crypto: no ENCRYPTION_KEY or JWT_SECRET set');
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
