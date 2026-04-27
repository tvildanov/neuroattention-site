const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_ROUNDS = 10;
const TOKEN_EXPIRY = '30d';
const SUPERADMIN_EMAILS = (process.env.SUPERADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const SUPERADMIN_LIMIT = 2;
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'DOM Unity <noreply@neuroattention.org>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://neuroattention.org';

// DB connection
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error('JWT_SECRET not set');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

// Load vocabulary aliases for node normalization
const fs = require('fs');
const path = require('path');
let vocabAliases = {};
try {
  const vocabPath = path.join(__dirname, 'neuromap-vocabulary.json');
  const vocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
  vocabAliases = vocab.aliases || {};
  console.log(`Loaded ${Object.keys(vocabAliases).length} vocabulary aliases`);
} catch (e) {
  console.warn('Could not load vocabulary aliases:', e.message);
}

// Normalize label: lowercase, trim, resolve aliases
function normalizeLabel(label) {
  const norm = (label || '').toLowerCase().trim();
  return vocabAliases[norm] || norm;
}

app.use(cors({
  origin: [
    'https://neuroattention.org',
    'https://www.neuroattention.org',
    /\.github\.io$/,
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '4mb' }));

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// ── ONE-TIME MIGRATION ENDPOINT (remove after use) ──
app.post('/api/run-migrations', async (req, res) => {
  try {
    // Migration 003: Add role column
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`;

    // Migration 004: Password resets table
    await sql`CREATE TABLE IF NOT EXISTS password_resets (
      token TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id)`;

    // Also add last_login_at if missing
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`;

    // Migration 005: NeuroMap entries table
    await sql`CREATE TABLE IF NOT EXISTS neuro_map_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date_key TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_neuromap_user ON neuro_map_entries(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_neuromap_user_date ON neuro_map_entries(user_id, date_key)`;

    // Migration 006: Diary, Calendar Events, Course Progress tables
    await sql`CREATE TABLE IF NOT EXISTS neuro_resource_diary (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date_key TEXT NOT NULL,
      text TEXT NOT NULL,
      comment TEXT DEFAULT '',
      plus_count INT DEFAULT 0,
      minus_count INT DEFAULT 0,
      time TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_diary_user ON neuro_resource_diary(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_diary_user_date ON neuro_resource_diary(user_id, date_key)`;

    await sql`CREATE TABLE IF NOT EXISTS calendar_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date_key TEXT NOT NULL,
      time TEXT DEFAULT '',
      title TEXT NOT NULL,
      event_type TEXT DEFAULT '',
      duration TEXT DEFAULT '',
      done BOOLEAN DEFAULT false,
      done_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cal_events_user ON calendar_events(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cal_events_user_date ON calendar_events(user_id, date_key)`;

    await sql`CREATE TABLE IF NOT EXISTS course_progress (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      status TEXT DEFAULT 'locked',
      progress_pct INT DEFAULT 0,
      completed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id, item_type, item_id)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_progress_user ON course_progress(user_id)`;

    // Migration 007: NeuroMap graph tables — nm_nodes + nm_links
    await sql`CREATE TABLE IF NOT EXISTS nm_nodes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      normalized_label TEXT NOT NULL,
      valence TEXT NOT NULL DEFAULT 'neutral',
      count INT NOT NULL DEFAULT 1,
      last_seen_at TIMESTAMPTZ DEFAULT now(),
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id, type, normalized_label, valence)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_nm_nodes_user ON nm_nodes(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_nm_nodes_user_type ON nm_nodes(user_id, type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_nm_nodes_last_seen ON nm_nodes(user_id, last_seen_at DESC)`;

    await sql`CREATE TABLE IF NOT EXISTS nm_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_node_id UUID NOT NULL REFERENCES nm_nodes(id) ON DELETE CASCADE,
      to_node_id UUID NOT NULL REFERENCES nm_nodes(id) ON DELETE CASCADE,
      count INT NOT NULL DEFAULT 1,
      last_seen_at TIMESTAMPTZ DEFAULT now(),
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id, from_node_id, to_node_id)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_nm_links_user ON nm_links(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_nm_links_from ON nm_links(from_node_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_nm_links_to ON nm_links(to_node_id)`;

    // Migration 010: test_results
    await sql`CREATE TABLE IF NOT EXISTS test_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      profile TEXT NOT NULL,
      answers JSONB NOT NULL,
      scores JSONB NOT NULL,
      completed_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_test_user ON test_results(user_id, completed_at DESC)`;

    // Migration 011: user_stats for RPG dashboard
    await sql`CREATE TABLE IF NOT EXISTS user_stats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      stats JSONB NOT NULL DEFAULT '{}'::jsonb,
      world_model_coherence SMALLINT NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_stats_user ON user_stats(user_id)`;

    // Migration 012: avatar_url column on users
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;

    res.json({ ok: true, message: 'Migrations 003-012 applied successfully' });
  } catch (err) {
    console.error('Migration error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── AUTH MIDDLEWARE ──

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

// ── AUTH ENDPOINTS ──

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    let { email, password, display_name, phone } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    email = email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const existing = await sql`SELECT id FROM users WHERE LOWER(email) = ${email}`;
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    // Determine role: superadmin if email is in SUPERADMIN_EMAILS and limit not reached
    let role = 'user';
    if (SUPERADMIN_EMAILS.includes(email)) {
      const saCount = await sql`SELECT COUNT(*) AS cnt FROM users WHERE role = 'superadmin'`;
      if (parseInt(saCount[0].cnt) < SUPERADMIN_LIMIT) {
        role = 'superadmin';
      }
    }

    const inserted = await sql`
      INSERT INTO users (email, password_hash, display_name, phone, role)
      VALUES (${email}, ${passwordHash}, ${display_name || null}, ${phone || null}, ${role})
      RETURNING id, email, display_name, phone, role, created_at
    `;
    const user = inserted[0];
    const token = signToken(user);

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, display_name: user.display_name, phone: user.phone, role: user.role }
    });
  } catch (err) {
    console.error('POST /api/auth/register:', err);
    if (err.message?.includes('unique') || err.message?.includes('duplicate')) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    res.status(500).json({ error: 'Internal error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    email = email.toLowerCase().trim();
    const rows = await sql`
      SELECT id, email, password_hash, display_name, phone, role
      FROM users WHERE LOWER(email) = ${email}
    `;
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    // Update last_login_at
    await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, email: user.email, display_name: user.display_name, phone: user.phone, role: user.role }
    });
  } catch (err) {
    console.error('POST /api/auth/login:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Get current user
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT id, email, display_name, phone, role, created_at, last_login_at, avatar_url
      FROM users WHERE id = ${req.user.id}
    `;
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('GET /api/auth/me:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Upload avatar (base64 stored in DB)
app.post('/api/users/me/avatar', requireAuth, async (req, res) => {
  try {
    const { avatar } = req.body;
    if (!avatar || typeof avatar !== 'string') {
      return res.status(400).json({ error: 'avatar (base64 data-URI) required' });
    }
    // Limit: ~2MB base64
    if (avatar.length > 3 * 1024 * 1024) {
      return res.status(413).json({ error: 'Avatar too large (max 2MB)' });
    }
    await sql`UPDATE users SET avatar_url = ${avatar} WHERE id = ${req.user.id}`;
    res.json({ ok: true, avatar_url: avatar });
  } catch (err) {
    console.error('POST /api/users/me/avatar:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Logout (placeholder for future token blacklist)
app.post('/api/auth/logout', (req, res) => {
  res.json({ ok: true });
});

// ── PASSWORD RESET ──

// Helper: send email via Resend (or log in dev mode)
async function sendResetEmail(to, resetToken) {
  const resetUrl = `${FRONTEND_URL}/account.html?reset=${resetToken}`;

  if (!RESEND_API_KEY) {
    console.log('══ DEV MODE: Password reset ══');
    console.log(`To: ${to}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log(`Token: ${resetToken}`);
    console.log('══════════════════════════════');
    return { dev: true };
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      subject: 'Сброс пароля — NeuroAttention',
      html: `<p>Вы запросили сброс пароля.</p><p><a href="${resetUrl}">Нажмите здесь, чтобы установить новый пароль</a></p><p>Ссылка действительна 1 час.</p><p>Если вы не запрашивали сброс — просто проигнорируйте это письмо.</p>`
    })
  });
  return resp.json();
}

// Forgot password
app.post('/api/auth/forgot', async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    email = email.toLowerCase().trim();

    // Always return 200 to prevent email enumeration
    const rows = await sql`SELECT id FROM users WHERE LOWER(email) = ${email}`;
    if (!rows.length) return res.json({ ok: true });

    const userId = rows[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await sql`
      INSERT INTO password_resets (token, user_id, expires_at)
      VALUES (${token}, ${userId}, ${expiresAt.toISOString()})
    `;

    const emailResult = await sendResetEmail(email, token);
    // In dev mode (no RESEND_API_KEY), return token in response so forgot-password works without email
    if (emailResult && emailResult.dev) {
      return res.json({ ok: true, dev: true, resetToken: token });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/auth/forgot:', err);
    res.json({ ok: true }); // Always 200
  }
});

// Reset password
app.post('/api/auth/reset', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const rows = await sql`
      SELECT token, user_id, expires_at, used
      FROM password_resets WHERE token = ${token}
    `;
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired reset link' });

    const reset = rows[0];
    if (reset.used) return res.status(400).json({ error: 'This reset link has already been used' });
    if (new Date(reset.expires_at) < new Date()) return res.status(400).json({ error: 'Reset link has expired' });

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${reset.user_id}`;
    await sql`UPDATE password_resets SET used = true WHERE token = ${token}`;

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/auth/reset:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── POINT AB: Save / Load (all require auth) ──

// Save or update entry
app.post('/api/pointab/save', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { point_a, change_a, point_b, reasons, corrections, share_with_specialist, reminder_frequency } = req.body;

    // Upsert: update if entry exists for today, otherwise insert
    const today = new Date().toISOString().slice(0, 10);
    const existing = await sql`
      SELECT id FROM point_ab_entries
      WHERE user_id = ${userId} AND created_at::date = ${today}::date
      ORDER BY created_at DESC LIMIT 1
    `;

    let entryId;
    if (existing.length) {
      entryId = existing[0].id;
      await sql`
        UPDATE point_ab_entries SET
          point_a = ${JSON.stringify(point_a || {})},
          change_a = ${JSON.stringify(change_a || {})},
          point_b = ${JSON.stringify(point_b || {})},
          reasons = ${JSON.stringify(reasons || [])},
          corrections = ${JSON.stringify(corrections || [])},
          share_with_specialist = ${share_with_specialist || false},
          reminder_frequency = ${reminder_frequency || '3_week'},
          updated_at = now()
        WHERE id = ${entryId}
      `;
    } else {
      const inserted = await sql`
        INSERT INTO point_ab_entries (user_id, point_a, change_a, point_b, reasons, corrections, share_with_specialist, reminder_frequency)
        VALUES (
          ${userId},
          ${JSON.stringify(point_a || {})},
          ${JSON.stringify(change_a || {})},
          ${JSON.stringify(point_b || {})},
          ${JSON.stringify(reasons || [])},
          ${JSON.stringify(corrections || [])},
          ${share_with_specialist || false},
          ${reminder_frequency || '3_week'}
        )
        RETURNING id
      `;
      entryId = inserted[0].id;
    }

    res.json({ ok: true, entry_id: entryId });
  } catch (err) {
    console.error('POST /api/pointab/save:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Get latest entry for current user
app.get('/api/pointab/latest', requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT e.*,
        (SELECT COUNT(*) FROM point_ab_audio WHERE entry_id = e.id) > 0 AS has_audio
      FROM point_ab_entries e
      WHERE e.user_id = ${req.user.id}
      ORDER BY e.created_at DESC LIMIT 1
    `;
    if (!rows.length) return res.json({ entry: null });
    res.json({ entry: rows[0] });
  } catch (err) {
    console.error('GET /api/pointab/latest:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Get all entries for current user (history)
app.get('/api/pointab/history', requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT id, created_at, updated_at,
        point_a->'image' AS a_image, point_b->'image' AS b_image,
        jsonb_array_length(reasons) AS reason_count,
        reminder_frequency
      FROM point_ab_entries
      WHERE user_id = ${req.user.id}
      ORDER BY created_at DESC LIMIT 20
    `;
    res.json({ entries: rows });
  } catch (err) {
    console.error('GET /api/pointab/history:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── AUDIO (require auth) ──

// Upload audio (base64 in body)
app.post('/api/pointab/audio', requireAuth, async (req, res) => {
  try {
    const { entry_id, audio_base64, duration_sec, mime_type } = req.body;
    if (!entry_id || !audio_base64) return res.status(400).json({ error: 'entry_id and audio_base64 required' });

    // Verify entry belongs to user
    const check = await sql`SELECT id FROM point_ab_entries WHERE id = ${entry_id} AND user_id = ${req.user.id}`;
    if (!check.length) return res.status(403).json({ error: 'Entry not found or access denied' });

    const buf = Buffer.from(audio_base64, 'base64');
    const sizeBytes = buf.length;

    if (sizeBytes > 3670016) return res.status(413).json({ error: 'Audio too large (max 3.5 MB)' });
    if (duration_sec && duration_sec > 180) return res.status(413).json({ error: 'Audio too long (max 180 sec)' });

    await sql`DELETE FROM point_ab_audio WHERE entry_id = ${entry_id}`;

    const inserted = await sql`
      INSERT INTO point_ab_audio (entry_id, audio_data, duration_sec, mime_type, size_bytes)
      VALUES (${entry_id}, ${buf}, ${duration_sec || null}, ${mime_type || 'audio/webm'}, ${sizeBytes})
      RETURNING id
    `;

    res.json({ ok: true, audio_id: inserted[0].id });
  } catch (err) {
    console.error('POST /api/pointab/audio:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Stream audio (public — entry_id is UUID, not guessable)
app.get('/api/pointab/audio/:entryId', async (req, res) => {
  try {
    const rows = await sql`
      SELECT audio_data, mime_type, size_bytes FROM point_ab_audio
      WHERE entry_id = ${req.params.entryId}
      ORDER BY created_at DESC LIMIT 1
    `;
    if (!rows.length) return res.status(404).json({ error: 'No audio' });

    const row = rows[0];
    res.setHeader('Content-Type', row.mime_type);
    res.setHeader('Content-Length', row.size_bytes);
    const buf = Buffer.from(row.audio_data, 'hex');
    res.send(buf);
  } catch (err) {
    console.error('GET /api/pointab/audio/:entryId:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── CALENDAR REMINDERS (require auth) ──

// Sync reminders
app.post('/api/pointab/reminders/sync', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { entry_id, frequency } = req.body;

    if (frequency === 'manual') {
      await sql`DELETE FROM calendar_reminders WHERE user_id = ${userId} AND task_type = 'listen_program' AND reminder_date > CURRENT_DATE`;
      return res.json({ ok: true, count: 0 });
    }

    const days = frequency === 'daily' ? 1 : frequency === '1_week' ? 7 : 2;
    const today = new Date();
    const values = [];

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i * days);
      values.push({ user_id: userId, entry_id: entry_id || null, date: d.toISOString().slice(0, 10) });
    }

    for (const v of values) {
      await sql`
        INSERT INTO calendar_reminders (user_id, entry_id, reminder_date, task_type)
        VALUES (${v.user_id}, ${v.entry_id}, ${v.date}::date, 'listen_program')
        ON CONFLICT (user_id, reminder_date, task_type) DO NOTHING
      `;
    }

    res.json({ ok: true, count: values.length });
  } catch (err) {
    console.error('POST /api/pointab/reminders/sync:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Get reminders
app.get('/api/pointab/reminders', requireAuth, async (req, res) => {
  try {
    const { month, year } = req.query;
    let rows;
    if (month && year) {
      rows = await sql`
        SELECT id, reminder_date, task_type, done, done_at
        FROM calendar_reminders
        WHERE user_id = ${req.user.id}
          AND EXTRACT(MONTH FROM reminder_date) = ${month}
          AND EXTRACT(YEAR FROM reminder_date) = ${year}
        ORDER BY reminder_date
      `;
    } else {
      rows = await sql`
        SELECT id, reminder_date, task_type, done, done_at
        FROM calendar_reminders
        WHERE user_id = ${req.user.id}
          AND reminder_date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY reminder_date
        LIMIT 60
      `;
    }
    res.json({ reminders: rows });
  } catch (err) {
    console.error('GET /api/pointab/reminders:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Toggle reminder done/undone
app.patch('/api/pointab/reminders/:id', requireAuth, async (req, res) => {
  try {
    // Verify reminder belongs to user
    const rows = await sql`
      UPDATE calendar_reminders
      SET done = NOT done, done_at = CASE WHEN done THEN NULL ELSE now() END
      WHERE id = ${req.params.id} AND user_id = ${req.user.id}
      RETURNING id, done
    `;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, done: rows[0].done });
  } catch (err) {
    console.error('PATCH /api/pointab/reminders/:id:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── NEUROMAP PERSISTENCE ──
// IMPORTANT: Never change the data format without a migration script.
// See MIGRATIONS.md for the data-safety contract.

// Save a NeuroMap entry (one survey submission)
app.post('/api/neuromap/save', requireAuth, async (req, res) => {
  try {
    const { date_key, entry } = req.body;
    if (!date_key || !entry) return res.status(400).json({ error: 'date_key and entry required' });
    const rows = await sql`
      INSERT INTO neuro_map_entries (user_id, date_key, payload)
      VALUES (${req.user.id}, ${date_key}, ${JSON.stringify(entry)})
      RETURNING id, date_key, created_at
    `;
    res.json({ ok: true, id: rows[0].id, date_key: rows[0].date_key });
  } catch (err) {
    console.error('POST /api/neuromap/save:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Load all NeuroMap entries for current user
app.get('/api/neuromap', requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT id, date_key, payload, created_at
      FROM neuro_map_entries
      WHERE user_id = ${req.user.id}
      ORDER BY date_key ASC, created_at ASC
    `;
    // Reconstruct nmData format: { 'YYYY-MM-DD': [ entry, entry, ... ] }
    const data = {};
    rows.forEach(r => {
      if (!data[r.date_key]) data[r.date_key] = [];
      data[r.date_key].push(r.payload);
    });
    res.json({ ok: true, data: data, count: rows.length });
  } catch (err) {
    console.error('GET /api/neuromap:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Delete a specific NeuroMap entry
app.delete('/api/neuromap/:id', requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      DELETE FROM neuro_map_entries
      WHERE id = ${req.params.id} AND user_id = ${req.user.id}
      RETURNING id
    `;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/neuromap/:id:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── NEUROMAP V2: GRAPH NODES + LINKS ──

// POST /api/neuromap/v2/append — accept a chain, upsert nodes + links
app.post('/api/neuromap/v2/append', requireAuth, async (req, res) => {
  try {
    const { chain } = req.body;
    // chain = [ { type: 'emotion', label: 'тревога', valence: 'negative', metadata: {} }, ... ]
    if (!chain || !Array.isArray(chain) || chain.length === 0) {
      return res.status(400).json({ error: 'chain array required' });
    }

    const userId = req.user.id;
    const nodeIds = [];
    const seenNodes = new Set(); // deduplicate: only increment count once per unique node per call

    // 1. Upsert each node (deduplicate within single call)
    for (const item of chain) {
      const { type, label, valence, metadata } = item;
      if (!type || !label) continue;
      const normalizedLabel = normalizeLabel(label);
      const val = valence || 'neutral';
      const meta = metadata ? JSON.stringify(metadata) : '{}';
      const dedupeKey = `${type}|${normalizedLabel}|${val}`;
      const alreadySeen = seenNodes.has(dedupeKey);
      seenNodes.add(dedupeKey);

      let rows;
      if (alreadySeen) {
        // Already counted this node in this call — just get its id without incrementing
        rows = await sql`
          SELECT id FROM nm_nodes
          WHERE user_id = ${userId} AND type = ${type} AND normalized_label = ${normalizedLabel} AND valence = ${val}
        `;
        if (!rows.length) {
          // Shouldn't happen, but fall back to upsert
          rows = await sql`
            INSERT INTO nm_nodes (user_id, type, label, normalized_label, valence, count, last_seen_at, metadata)
            VALUES (${userId}, ${type}, ${label}, ${normalizedLabel}, ${val}, 1, now(), ${meta}::jsonb)
            ON CONFLICT (user_id, type, normalized_label, valence)
            DO UPDATE SET last_seen_at = now(), label = EXCLUDED.label
            RETURNING id
          `;
        }
      } else {
        rows = await sql`
          INSERT INTO nm_nodes (user_id, type, label, normalized_label, valence, count, last_seen_at, metadata)
          VALUES (${userId}, ${type}, ${label}, ${normalizedLabel}, ${val}, 1, now(), ${meta}::jsonb)
          ON CONFLICT (user_id, type, normalized_label, valence)
          DO UPDATE SET
            count = nm_nodes.count + 1,
            last_seen_at = now(),
            label = EXCLUDED.label
          RETURNING id
        `;
      }
      nodeIds.push(rows[0].id);
    }

    // 2. Create links between consecutive nodes in the chain
    const linkResults = [];
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const fromId = nodeIds[i];
      const toId = nodeIds[i + 1];
      const rows = await sql`
        INSERT INTO nm_links (user_id, from_node_id, to_node_id, count, last_seen_at)
        VALUES (${userId}, ${fromId}, ${toId}, 1, now())
        ON CONFLICT (user_id, from_node_id, to_node_id)
        DO UPDATE SET
          count = nm_links.count + 1,
          last_seen_at = now()
        RETURNING id, count
      `;
      linkResults.push({ from: fromId, to: toId, count: rows[0].count });
    }

    res.json({ ok: true, node_ids: nodeIds, links: linkResults });
  } catch (err) {
    console.error('POST /api/neuromap/v2/append:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/neuromap/v2/graph — return full graph (nodes + links) for current user
// Superadmin/founder can pass ?email=... to view another user's graph
app.get('/api/neuromap/v2/graph', requireAuth, async (req, res) => {
  try {
    let userId = req.user.id;
    if (req.query.email) {
      const caller = await sql`SELECT role FROM users WHERE id = ${req.user.id}`;
      if (caller.length && ['superadmin', 'founder'].includes(caller[0].role)) {
        const target = await sql`SELECT id FROM users WHERE email = ${req.query.email}`;
        if (target.length) userId = target[0].id;
      }
    }

    const nodes = await sql`
      SELECT id, type, label, normalized_label, valence, count, last_seen_at, metadata, created_at
      FROM nm_nodes
      WHERE user_id = ${userId}
      ORDER BY count DESC
    `;

    const links = await sql`
      SELECT l.id, l.from_node_id, l.to_node_id, l.count, l.last_seen_at
      FROM nm_links l
      WHERE l.user_id = ${userId}
      ORDER BY l.count DESC
    `;

    res.json({
      ok: true,
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        label: n.label,
        normalized_label: n.normalized_label,
        valence: n.valence,
        count: n.count,
        last_seen_at: n.last_seen_at,
        metadata: n.metadata,
        created_at: n.created_at
      })),
      links: links.map(l => ({
        id: l.id,
        source: l.from_node_id,
        target: l.to_node_id,
        count: l.count,
        last_seen_at: l.last_seen_at
      }))
    });
  } catch (err) {
    console.error('GET /api/neuromap/v2/graph:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── NEUROMAP V2: MIGRATE LEGACY DATA ──
// POST /api/neuromap/v2/migrate-legacy
// Reads all neuro_map_entries for the current user, converts chains into nm_nodes + nm_links.
// Idempotent: uses ON CONFLICT upsert so running twice is safe.
app.post('/api/neuromap/v2/migrate-legacy', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // ── IDEMPOTENCY GUARD ──
    // If nm_nodes already has data for this user, migration was already done.
    // Skip entirely to prevent count inflation from repeated calls.
    const existing = await sql`
      SELECT COUNT(*)::int AS cnt FROM nm_nodes WHERE user_id = ${userId}
    `;
    if (existing[0].cnt > 0) {
      return res.json({ ok: true, migrated: 0, message: 'Already migrated — nm_nodes has data, skipping' });
    }

    // Known negative emotions (must match frontend NM_EMOTIONS_NEG)
    const NEG_EMOTIONS = ['тревога','страх','раздражение','злость','вина','стыд','грусть','усталость','апатия','напряжение'];
    function isNeg(e) { return NEG_EMOTIONS.includes((e || '').toLowerCase().trim()); }

    // 1. Read all legacy entries
    const legacyRows = await sql`
      SELECT id, date_key, payload, created_at
      FROM neuro_map_entries
      WHERE user_id = ${userId}
      ORDER BY date_key ASC, created_at ASC
    `;

    if (!legacyRows.length) {
      return res.json({ ok: true, migrated: 0, message: 'No legacy entries to migrate' });
    }

    let totalNodes = 0;
    let totalLinks = 0;

    // Per-entry deduplication to prevent double-counting within one migration run
    const seenNodes = new Set(); // "type|normalizedLabel|valence"
    const seenLinks = new Set(); // "fromId|toId"

    // 2. Process each legacy entry
    for (const row of legacyRows) {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      const chains = payload.chains || [];
      if (!chains.length) continue;

      const entryDate = row.created_at || new Date().toISOString();
      const seenInEntry = new Set(); // per-entry dedup for count accuracy

      for (const chain of chains) {
        const v2Items = [];

        if (chain.emotion) {
          const neg = isNeg(chain.emotion);
          v2Items.push({
            type: 'emotion',
            label: chain.emotion,
            valence: neg ? 'negative' : 'positive',
            metadata: JSON.stringify({ source: 'legacy_migration' })
          });
        }
        if (chain.area) {
          v2Items.push({
            type: 'area',
            label: chain.area,
            valence: 'neutral',
            metadata: JSON.stringify({ source: 'legacy_migration' })
          });
        }
        if (chain.cause) {
          const emValence = chain.emotion ? (isNeg(chain.emotion) ? 'negative' : 'positive') : 'neutral';
          v2Items.push({
            type: 'cause',
            label: chain.cause,
            valence: emValence,
            metadata: JSON.stringify({ source: 'legacy_migration' })
          });
        }
        if (chain.thought) {
          v2Items.push({
            type: 'thought',
            label: chain.thought,
            valence: chain.emotion ? (isNeg(chain.emotion) ? 'negative' : 'positive') : 'neutral',
            metadata: JSON.stringify({ source: 'legacy_migration' })
          });
        }

        if (!v2Items.length) continue;

        // Upsert nodes — only increment count once per entry per unique node
        const nodeIds = [];
        for (const item of v2Items) {
          const normalizedLabel = normalizeLabel(item.label);
          const nodeKey = `${item.type}|${normalizedLabel}|${item.valence}`;
          const shouldIncrement = !seenInEntry.has(nodeKey);
          if (shouldIncrement) seenInEntry.add(nodeKey);

          const rows2 = await sql`
            INSERT INTO nm_nodes (user_id, type, label, normalized_label, valence, count, last_seen_at, metadata)
            VALUES (${userId}, ${item.type}, ${item.label}, ${normalizedLabel}, ${item.valence}, 1, ${entryDate}::timestamptz, ${item.metadata}::jsonb)
            ON CONFLICT (user_id, type, normalized_label, valence)
            DO UPDATE SET
              count = CASE WHEN ${shouldIncrement} THEN nm_nodes.count + 1 ELSE nm_nodes.count END,
              last_seen_at = GREATEST(nm_nodes.last_seen_at, ${entryDate}::timestamptz)
            RETURNING id
          `;
          nodeIds.push(rows2[0].id);
          totalNodes++;
        }

        // Create links between consecutive nodes
        for (let i = 0; i < nodeIds.length - 1; i++) {
          const linkKey = `${nodeIds[i]}|${nodeIds[i+1]}`;
          const shouldIncrementLink = !seenInEntry.has('L:'+linkKey);
          if (shouldIncrementLink) seenInEntry.add('L:'+linkKey);

          await sql`
            INSERT INTO nm_links (user_id, from_node_id, to_node_id, count, last_seen_at)
            VALUES (${userId}, ${nodeIds[i]}, ${nodeIds[i + 1]}, 1, ${entryDate}::timestamptz)
            ON CONFLICT (user_id, from_node_id, to_node_id)
            DO UPDATE SET
              count = CASE WHEN ${shouldIncrementLink} THEN nm_links.count + 1 ELSE nm_links.count END,
              last_seen_at = GREATEST(nm_links.last_seen_at, ${entryDate}::timestamptz)
            RETURNING id
          `;
          totalLinks++;
        }
      }
    }

    res.json({
      ok: true,
      migrated: legacyRows.length,
      totalNodes,
      totalLinks,
      message: `Migrated ${legacyRows.length} legacy entries → ${totalNodes} node upserts, ${totalLinks} link upserts`
    });
  } catch (err) {
    console.error('POST /api/neuromap/v2/migrate-legacy:', err);
    res.status(500).json({ error: 'Migration failed: ' + err.message });
  }
});

// ── DIARY PERSISTENCE ──
// Save a diary entry
app.post('/api/diary/save', requireAuth, async (req, res) => {
  try {
    const { date_key, text, comment, plus_count, minus_count, time } = req.body;
    if (!date_key || !text) return res.status(400).json({ error: 'date_key and text required' });
    const rows = await sql`
      INSERT INTO neuro_resource_diary (user_id, date_key, text, comment, plus_count, minus_count, time)
      VALUES (${req.user.id}, ${date_key}, ${text}, ${comment || ''}, ${plus_count || 0}, ${minus_count || 0}, ${time || ''})
      RETURNING id, date_key, created_at
    `;
    res.json({ ok: true, id: rows[0].id, date_key: rows[0].date_key });
  } catch (err) {
    console.error('POST /api/diary/save:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Load all diary entries for current user
app.get('/api/diary', requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT id, date_key, text, comment, plus_count, minus_count, time, created_at
      FROM neuro_resource_diary
      WHERE user_id = ${req.user.id}
      ORDER BY date_key ASC, created_at ASC
    `;
    // Reconstruct diaryData format: { 'YYYY-MM-DD': [ {id, text, comment, plusCount, minusCount, time} ] }
    const data = {};
    rows.forEach(r => {
      if (!data[r.date_key]) data[r.date_key] = [];
      data[r.date_key].push({
        id: r.id,
        text: r.text,
        comment: r.comment,
        plusCount: r.plus_count,
        minusCount: r.minus_count,
        time: r.time
      });
    });
    res.json({ ok: true, data, count: rows.length });
  } catch (err) {
    console.error('GET /api/diary:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Delete a diary entry
app.delete('/api/diary/:id', requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      DELETE FROM neuro_resource_diary
      WHERE id = ${req.params.id} AND user_id = ${req.user.id}
      RETURNING id
    `;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/diary/:id:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── CALENDAR EVENTS PERSISTENCE ──
// Save a calendar event
app.post('/api/calendar/save', requireAuth, async (req, res) => {
  try {
    const { date_key, time, title, event_type, duration } = req.body;
    if (!date_key || !title) return res.status(400).json({ error: 'date_key and title required' });
    const rows = await sql`
      INSERT INTO calendar_events (user_id, date_key, time, title, event_type, duration)
      VALUES (${req.user.id}, ${date_key}, ${time || ''}, ${title}, ${event_type || ''}, ${duration || ''})
      RETURNING id, date_key, created_at
    `;
    res.json({ ok: true, id: rows[0].id, date_key: rows[0].date_key });
  } catch (err) {
    console.error('POST /api/calendar/save:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Load calendar events (optional month/year filter)
app.get('/api/calendar', requireAuth, async (req, res) => {
  try {
    const { month, year } = req.query;
    let rows;
    if (month && year) {
      // date_key format is 'YYYY-MM-DD', filter by prefix
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      rows = await sql`
        SELECT id, date_key, time, title, event_type, duration, done, done_at, created_at
        FROM calendar_events
        WHERE user_id = ${req.user.id} AND date_key LIKE ${prefix + '%'}
        ORDER BY date_key ASC, time ASC
      `;
    } else {
      rows = await sql`
        SELECT id, date_key, time, title, event_type, duration, done, done_at, created_at
        FROM calendar_events
        WHERE user_id = ${req.user.id}
        ORDER BY date_key ASC, time ASC
      `;
    }
    // Group by date_key
    const data = {};
    rows.forEach(r => {
      if (!data[r.date_key]) data[r.date_key] = [];
      data[r.date_key].push({
        id: r.id,
        time: r.time,
        title: r.title,
        event_type: r.event_type,
        duration: r.duration,
        done: r.done,
        done_at: r.done_at
      });
    });
    res.json({ ok: true, data, count: rows.length });
  } catch (err) {
    console.error('GET /api/calendar:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Toggle calendar event done
app.patch('/api/calendar/:id/toggle', requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      UPDATE calendar_events
      SET done = NOT done, done_at = CASE WHEN done THEN NULL ELSE now() END
      WHERE id = ${req.params.id} AND user_id = ${req.user.id}
      RETURNING id, done
    `;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, id: rows[0].id, done: rows[0].done });
  } catch (err) {
    console.error('PATCH /api/calendar/:id/toggle:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Delete a calendar event
app.delete('/api/calendar/:id', requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      DELETE FROM calendar_events
      WHERE id = ${req.params.id} AND user_id = ${req.user.id}
      RETURNING id
    `;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/calendar/:id:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── COURSE PROGRESS PERSISTENCE ──
// Save/upsert course progress
app.post('/api/progress/save', requireAuth, async (req, res) => {
  try {
    const { item_type, item_id, status, progress_pct } = req.body;
    if (!item_type || !item_id) return res.status(400).json({ error: 'item_type and item_id required' });
    const completed_at = status === 'completed' ? new Date().toISOString() : null;
    const rows = await sql`
      INSERT INTO course_progress (user_id, item_type, item_id, status, progress_pct, completed_at, updated_at)
      VALUES (${req.user.id}, ${item_type}, ${item_id}, ${status || 'locked'}, ${progress_pct || 0}, ${completed_at}, now())
      ON CONFLICT (user_id, item_type, item_id)
      DO UPDATE SET status = EXCLUDED.status, progress_pct = EXCLUDED.progress_pct,
                    completed_at = EXCLUDED.completed_at, updated_at = now()
      RETURNING id, item_type, item_id, status, progress_pct
    `;
    res.json({ ok: true, progress: rows[0] });
  } catch (err) {
    console.error('POST /api/progress/save:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Load all course progress for current user
app.get('/api/progress', requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT id, item_type, item_id, status, progress_pct, completed_at, updated_at
      FROM course_progress
      WHERE user_id = ${req.user.id}
      ORDER BY item_type, item_id
    `;
    res.json({ ok: true, progress: rows });
  } catch (err) {
    console.error('GET /api/progress:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── ADMIN: Delete user by email (superadmin only) ──
app.delete('/api/admin/user', requireAuth, async (req, res) => {
  try {
    // Role is not in JWT, fetch from DB
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.id}`;
    if (!caller.length || caller[0].role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const rows = await sql`SELECT id FROM users WHERE LOWER(email) = ${email.toLowerCase().trim()}`;
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const userId = rows[0].id;
    // Cascade delete user data
    await sql`DELETE FROM nm_links WHERE user_id = ${userId}`;
    await sql`DELETE FROM nm_nodes WHERE user_id = ${userId}`;
    await sql`DELETE FROM neuro_map_entries WHERE user_id = ${userId}`;
    await sql`DELETE FROM neuro_resource_diary WHERE user_id = ${userId}`;
    await sql`DELETE FROM calendar_events WHERE user_id = ${userId}`;
    await sql`DELETE FROM course_progress WHERE user_id = ${userId}`;
    await sql`DELETE FROM password_resets WHERE user_id = ${userId}`;
    await sql`DELETE FROM users WHERE id = ${userId}`;

    res.json({ ok: true, deleted: email });
  } catch (err) {
    console.error('DELETE /api/admin/user:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── ADMIN: Merge duplicate nodes using vocabulary aliases ──
app.post('/api/neuromap/v2/merge-aliases', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    // Find all nodes for this user
    const nodes = await sql`
      SELECT id, type, label, normalized_label, valence, count
      FROM nm_nodes WHERE user_id = ${userId}
    `;

    let merged = 0;
    // Group by (type, normalizeLabel(label), valence) — find duplicates
    const groups = {};
    for (const n of nodes) {
      const canonical = normalizeLabel(n.label);
      const key = `${n.type}|${canonical}|${n.valence}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push({ ...n, canonical });
    }

    for (const key of Object.keys(groups)) {
      const group = groups[key];
      if (group.length <= 1) continue;

      // Keep the node with the highest count as the canonical one
      group.sort((a, b) => b.count - a.count);
      const keeper = group[0];

      for (let i = 1; i < group.length; i++) {
        const dup = group[i];
        // Re-point links from duplicate to keeper
        await sql`UPDATE nm_links SET from_node_id = ${keeper.id} WHERE from_node_id = ${dup.id} AND user_id = ${userId}`;
        await sql`UPDATE nm_links SET to_node_id = ${keeper.id} WHERE to_node_id = ${dup.id} AND user_id = ${userId}`;
        // Add duplicate's count to keeper
        await sql`UPDATE nm_nodes SET count = count + ${dup.count}, normalized_label = ${keeper.canonical} WHERE id = ${keeper.id}`;
        // Update keeper's label to canonical form
        await sql`UPDATE nm_nodes SET label = ${keeper.canonical} WHERE id = ${keeper.id}`;
        // Delete duplicate node
        await sql`DELETE FROM nm_nodes WHERE id = ${dup.id}`;
        merged++;
      }

      // Clean up any self-referencing links created by merges
      await sql`DELETE FROM nm_links WHERE from_node_id = to_node_id AND user_id = ${userId}`;
      // Merge duplicate links (same from→to)
      const dupeLinks = await sql`
        SELECT from_node_id, to_node_id, array_agg(id) as ids, sum(count) as total
        FROM nm_links WHERE user_id = ${userId}
        GROUP BY from_node_id, to_node_id
        HAVING count(*) > 1
      `;
      for (const dl of dupeLinks) {
        const keepId = dl.ids[0];
        await sql`UPDATE nm_links SET count = ${dl.total} WHERE id = ${keepId}`;
        const removeIds = dl.ids.slice(1);
        if (removeIds.length > 0) {
          await sql`DELETE FROM nm_links WHERE id = ANY(${removeIds})`;
        }
      }
    }

    res.json({ ok: true, merged_nodes: merged });
  } catch (err) {
    console.error('POST /api/neuromap/v2/merge-aliases:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── ADMIN: Rebuild graph from source data (superadmin/founder only) ──
// Drops nm_nodes + nm_links for the caller, re-creates from neuro_map_entries + neuro_resource_diary
app.post('/api/admin/rebuild-graph', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.id}`;
    if (!caller.length || !['superadmin', 'founder'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Allow superadmin/founder to rebuild another user's graph via body.userId or body.email
    let userId = req.user.id;
    if (req.body.userId) {
      userId = req.body.userId;
    } else if (req.body.email) {
      const target = await sql`SELECT id FROM users WHERE email = ${req.body.email}`;
      if (!target.length) return res.status(404).json({ error: 'User not found by email' });
      userId = target[0].id;
    }
    const NEG_EMOTIONS = ['тревога','страх','раздражение','злость','вина','стыд','грусть','усталость','апатия','напряжение',
      'отчаяние','обида','ревность','зависть','растерянность','разочарование','одиночество','беспомощность','скука',
      'тоска','подавленность','паника','агрессия','отвращение','гнев','ярость','печаль','уныние','меланхолия',
      'волнение','беспокойство','нервозность','испуг','боязнь','ужас','бешенство','лень','безразличие','равнодушие',
      'утомление','изнурение','истощение','напряжение','ощущение пустоты'];
    function isNeg(e) { return NEG_EMOTIONS.includes((e || '').toLowerCase().trim()); }

    // Helper: upsert a single node with normalizeLabel
    async function upsertNode(type, label, valence, metadata, entryDate) {
      const nl = normalizeLabel(label);
      const val = valence || 'neutral';
      const meta = metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : '{}';
      const dt = entryDate || new Date().toISOString();
      const rows = await sql`
        INSERT INTO nm_nodes (user_id, type, label, normalized_label, valence, count, last_seen_at, metadata)
        VALUES (${userId}, ${type}, ${label}, ${nl}, ${val}, 1, ${dt}::timestamptz, ${meta}::jsonb)
        ON CONFLICT (user_id, type, normalized_label, valence)
        DO UPDATE SET
          count = nm_nodes.count + 1,
          last_seen_at = GREATEST(nm_nodes.last_seen_at, ${dt}::timestamptz),
          label = EXCLUDED.label
        RETURNING id
      `;
      return rows[0].id;
    }

    // Helper: upsert a link
    async function upsertLink(fromId, toId, entryDate) {
      const dt = entryDate || new Date().toISOString();
      await sql`
        INSERT INTO nm_links (user_id, from_node_id, to_node_id, count, last_seen_at)
        VALUES (${userId}, ${fromId}, ${toId}, 1, ${dt}::timestamptz)
        ON CONFLICT (user_id, from_node_id, to_node_id)
        DO UPDATE SET
          count = nm_links.count + 1,
          last_seen_at = GREATEST(nm_links.last_seen_at, ${dt}::timestamptz)
      `;
    }

    // 1. Drop existing graph for this user
    await sql`DELETE FROM nm_links WHERE user_id = ${userId}`;
    await sql`DELETE FROM nm_nodes WHERE user_id = ${userId}`;

    let stats = { legacy_entries: 0, diary_entries: 0, nodes_upserted: 0, links_upserted: 0 };

    // 2. Re-process legacy neuro_map_entries
    const legacyRows = await sql`
      SELECT id, date_key, payload, created_at
      FROM neuro_map_entries WHERE user_id = ${userId}
      ORDER BY date_key ASC, created_at ASC
    `;
    for (const row of legacyRows) {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      const chains = payload.chains || [];
      const entryDate = row.created_at || new Date().toISOString();
      const seenInEntry = new Set(); // deduplicate nodes within a single entry

      for (const chain of chains) {
        const nodeIds = [];
        if (chain.emotion) {
          const neg = isNeg(chain.emotion);
          const nl = normalizeLabel(chain.emotion);
          const dedupeKey = `emotion|${nl}|${neg ? 'negative' : 'positive'}`;
          if (!seenInEntry.has(dedupeKey)) {
            seenInEntry.add(dedupeKey);
            nodeIds.push(await upsertNode('emotion', chain.emotion, neg ? 'negative' : 'positive', { source: 'legacy' }, entryDate));
          } else {
            // Already counted this node in this entry — just get id
            const existing = await sql`SELECT id FROM nm_nodes WHERE user_id = ${userId} AND type = 'emotion' AND normalized_label = ${nl} AND valence = ${neg ? 'negative' : 'positive'}`;
            if (existing.length) nodeIds.push(existing[0].id);
          }
          stats.nodes_upserted++;
        }
        if (chain.area) {
          const nl = normalizeLabel(chain.area);
          const dedupeKey = `area|${nl}|neutral`;
          if (!seenInEntry.has(dedupeKey)) {
            seenInEntry.add(dedupeKey);
            nodeIds.push(await upsertNode('area', chain.area, 'neutral', { source: 'legacy' }, entryDate));
          } else {
            const existing = await sql`SELECT id FROM nm_nodes WHERE user_id = ${userId} AND type = 'area' AND normalized_label = ${nl} AND valence = 'neutral'`;
            if (existing.length) nodeIds.push(existing[0].id);
          }
          stats.nodes_upserted++;
        }
        if (chain.cause) {
          const emVal = chain.emotion ? (isNeg(chain.emotion) ? 'negative' : 'positive') : 'neutral';
          const nl = normalizeLabel(chain.cause);
          const dedupeKey = `cause|${nl}|${emVal}`;
          if (!seenInEntry.has(dedupeKey)) {
            seenInEntry.add(dedupeKey);
            nodeIds.push(await upsertNode('cause', chain.cause, emVal, { source: 'legacy' }, entryDate));
          } else {
            const existing = await sql`SELECT id FROM nm_nodes WHERE user_id = ${userId} AND type = 'cause' AND normalized_label = ${nl} AND valence = ${emVal}`;
            if (existing.length) nodeIds.push(existing[0].id);
          }
          stats.nodes_upserted++;
        }
        if (chain.thought) {
          const emVal = chain.emotion ? (isNeg(chain.emotion) ? 'negative' : 'positive') : 'neutral';
          const nl = normalizeLabel(chain.thought);
          const dedupeKey = `thought|${nl}|${emVal}`;
          if (!seenInEntry.has(dedupeKey)) {
            seenInEntry.add(dedupeKey);
            nodeIds.push(await upsertNode('thought', chain.thought, emVal, { source: 'legacy' }, entryDate));
          } else {
            const existing = await sql`SELECT id FROM nm_nodes WHERE user_id = ${userId} AND type = 'thought' AND normalized_label = ${nl} AND valence = ${emVal}`;
            if (existing.length) nodeIds.push(existing[0].id);
          }
          stats.nodes_upserted++;
        }
        for (let i = 0; i < nodeIds.length - 1; i++) {
          await upsertLink(nodeIds[i], nodeIds[i + 1], entryDate);
          stats.links_upserted++;
        }
      }
      stats.legacy_entries++;
    }

    // 3. Re-process diary entries (neuro_resource_diary)
    const diaryRows = await sql`
      SELECT id, text, comment, plus_count, minus_count, created_at
      FROM neuro_resource_diary WHERE user_id = ${userId}
      ORDER BY created_at ASC
    `;
    for (const row of diaryRows) {
      const net = (row.plus_count || 0) - (row.minus_count || 0);
      const valence = net > 0 ? 'positive' : (net < 0 ? 'negative' : 'neutral');
      const entryDate = row.created_at || new Date().toISOString();
      const nodeIds = [];

      // Event node from diary text
      if (row.text) {
        const label = row.text.substring(0, 80);
        nodeIds.push(await upsertNode('event', label, valence, { source: 'diary', plus: row.plus_count || 0, minus: row.minus_count || 0 }, entryDate));
        stats.nodes_upserted++;
      }
      // Thought node from comment
      if (row.comment) {
        const label = row.comment.substring(0, 80);
        nodeIds.push(await upsertNode('thought', label, valence, { source: 'diary' }, entryDate));
        stats.nodes_upserted++;
      }
      for (let i = 0; i < nodeIds.length - 1; i++) {
        await upsertLink(nodeIds[i], nodeIds[i + 1], entryDate);
        stats.links_upserted++;
      }
      stats.diary_entries++;
    }

    // 4. Count final graph
    const finalNodes = await sql`SELECT count(*) as cnt FROM nm_nodes WHERE user_id = ${userId}`;
    const finalLinks = await sql`SELECT count(*) as cnt FROM nm_links WHERE user_id = ${userId}`;

    res.json({
      ok: true,
      stats,
      graph: { nodes: parseInt(finalNodes[0].cnt), links: parseInt(finalLinks[0].cnt) }
    });
  } catch (err) {
    console.error('POST /api/admin/rebuild-graph:', err);
    res.status(500).json({ error: 'Rebuild failed: ' + err.message });
  }
});

// ── SELF-REBUILD: Any authenticated user can rebuild their own graph ──
app.post('/api/neuromap/v2/rebuild-self', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const NEG_EMOTIONS = ['тревога','страх','раздражение','злость','вина','стыд','грусть','усталость','апатия','напряжение',
      'отчаяние','обида','ревность','зависть','растерянность','разочарование','одиночество','беспомощность','скука',
      'тоска','подавленность','паника','агрессия','отвращение','гнев','ярость','печаль','уныние','меланхолия',
      'волнение','беспокойство','нервозность','испуг','боязнь','ужас','бешенство','лень','безразличие','равнодушие',
      'утомление','изнурение','истощение','напряжение','ощущение пустоты'];
    function isNeg(e) { return NEG_EMOTIONS.includes((e || '').toLowerCase().trim()); }

    async function upsertNode(type, label, valence, metadata, entryDate) {
      const nl = normalizeLabel(label);
      const val = valence || 'neutral';
      const meta = metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : '{}';
      const dt = entryDate || new Date().toISOString();
      const rows = await sql`
        INSERT INTO nm_nodes (user_id, type, label, normalized_label, valence, count, last_seen_at, metadata)
        VALUES (${userId}, ${type}, ${label}, ${nl}, ${val}, 1, ${dt}::timestamptz, ${meta}::jsonb)
        ON CONFLICT (user_id, type, normalized_label, valence)
        DO UPDATE SET
          count = nm_nodes.count + 1,
          last_seen_at = GREATEST(nm_nodes.last_seen_at, ${dt}::timestamptz),
          label = EXCLUDED.label
        RETURNING id
      `;
      return rows[0].id;
    }

    async function upsertLink(fromId, toId, entryDate) {
      const dt = entryDate || new Date().toISOString();
      await sql`
        INSERT INTO nm_links (user_id, from_node_id, to_node_id, count, last_seen_at)
        VALUES (${userId}, ${fromId}, ${toId}, 1, ${dt}::timestamptz)
        ON CONFLICT (user_id, from_node_id, to_node_id)
        DO UPDATE SET
          count = nm_links.count + 1,
          last_seen_at = GREATEST(nm_links.last_seen_at, ${dt}::timestamptz)
      `;
    }

    // 1. Drop existing graph
    await sql`DELETE FROM nm_links WHERE user_id = ${userId}`;
    await sql`DELETE FROM nm_nodes WHERE user_id = ${userId}`;

    let stats = { legacy_entries: 0, diary_entries: 0, nodes_upserted: 0, links_upserted: 0 };

    // 2. Re-process legacy neuro_map_entries
    const legacyRows = await sql`
      SELECT id, date_key, payload, created_at
      FROM neuro_map_entries WHERE user_id = ${userId}
      ORDER BY date_key ASC, created_at ASC
    `;
    for (const row of legacyRows) {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      const chains = payload.chains || [];
      const entryDate = row.created_at || new Date().toISOString();
      const seenInEntry = new Set();

      for (const chain of chains) {
        const nodeIds = [];
        if (chain.emotion) {
          const neg = isNeg(chain.emotion);
          const nl = normalizeLabel(chain.emotion);
          const dedupeKey = `emotion|${nl}|${neg ? 'negative' : 'positive'}`;
          if (!seenInEntry.has(dedupeKey)) {
            seenInEntry.add(dedupeKey);
            nodeIds.push(await upsertNode('emotion', chain.emotion, neg ? 'negative' : 'positive', { source: 'legacy' }, entryDate));
          } else {
            const existing = await sql`SELECT id FROM nm_nodes WHERE user_id = ${userId} AND type = 'emotion' AND normalized_label = ${nl} AND valence = ${neg ? 'negative' : 'positive'}`;
            if (existing.length) nodeIds.push(existing[0].id);
          }
          stats.nodes_upserted++;
        }
        if (chain.area) {
          const nl = normalizeLabel(chain.area);
          const dedupeKey = `area|${nl}|neutral`;
          if (!seenInEntry.has(dedupeKey)) {
            seenInEntry.add(dedupeKey);
            nodeIds.push(await upsertNode('area', chain.area, 'neutral', { source: 'legacy' }, entryDate));
          } else {
            const existing = await sql`SELECT id FROM nm_nodes WHERE user_id = ${userId} AND type = 'area' AND normalized_label = ${nl} AND valence = 'neutral'`;
            if (existing.length) nodeIds.push(existing[0].id);
          }
          stats.nodes_upserted++;
        }
        if (chain.cause) {
          const emVal = chain.emotion ? (isNeg(chain.emotion) ? 'negative' : 'positive') : 'neutral';
          const nl = normalizeLabel(chain.cause);
          const dedupeKey = `cause|${nl}|${emVal}`;
          if (!seenInEntry.has(dedupeKey)) {
            seenInEntry.add(dedupeKey);
            nodeIds.push(await upsertNode('cause', chain.cause, emVal, { source: 'legacy' }, entryDate));
          } else {
            const existing = await sql`SELECT id FROM nm_nodes WHERE user_id = ${userId} AND type = 'cause' AND normalized_label = ${nl} AND valence = ${emVal}`;
            if (existing.length) nodeIds.push(existing[0].id);
          }
          stats.nodes_upserted++;
        }
        if (chain.thought) {
          const emVal = chain.emotion ? (isNeg(chain.emotion) ? 'negative' : 'positive') : 'neutral';
          const nl = normalizeLabel(chain.thought);
          const dedupeKey = `thought|${nl}|${emVal}`;
          if (!seenInEntry.has(dedupeKey)) {
            seenInEntry.add(dedupeKey);
            nodeIds.push(await upsertNode('thought', chain.thought, emVal, { source: 'legacy' }, entryDate));
          } else {
            const existing = await sql`SELECT id FROM nm_nodes WHERE user_id = ${userId} AND type = 'thought' AND normalized_label = ${nl} AND valence = ${emVal}`;
            if (existing.length) nodeIds.push(existing[0].id);
          }
          stats.nodes_upserted++;
        }
        for (let i = 0; i < nodeIds.length - 1; i++) {
          await upsertLink(nodeIds[i], nodeIds[i + 1], entryDate);
          stats.links_upserted++;
        }
      }
      stats.legacy_entries++;
    }

    // 3. Re-process diary entries
    const diaryRows = await sql`
      SELECT id, text, comment, plus_count, minus_count, created_at
      FROM neuro_resource_diary WHERE user_id = ${userId}
      ORDER BY created_at ASC
    `;
    for (const row of diaryRows) {
      const net = (row.plus_count || 0) - (row.minus_count || 0);
      const valence = net > 0 ? 'positive' : (net < 0 ? 'negative' : 'neutral');
      const entryDate = row.created_at || new Date().toISOString();
      const nodeIds = [];
      if (row.text) {
        const label = row.text.substring(0, 80);
        nodeIds.push(await upsertNode('event', label, valence, { source: 'diary', plus: row.plus_count || 0, minus: row.minus_count || 0 }, entryDate));
        stats.nodes_upserted++;
      }
      if (row.comment) {
        const label = row.comment.substring(0, 80);
        nodeIds.push(await upsertNode('thought', label, valence, { source: 'diary' }, entryDate));
        stats.nodes_upserted++;
      }
      for (let i = 0; i < nodeIds.length - 1; i++) {
        await upsertLink(nodeIds[i], nodeIds[i + 1], entryDate);
        stats.links_upserted++;
      }
      stats.diary_entries++;
    }

    // 4. Count final graph
    const finalNodes = await sql`SELECT count(*) as cnt FROM nm_nodes WHERE user_id = ${userId}`;
    const finalLinks = await sql`SELECT count(*) as cnt FROM nm_links WHERE user_id = ${userId}`;

    res.json({
      ok: true,
      stats,
      graph: { nodes: parseInt(finalNodes[0].cnt), links: parseInt(finalLinks[0].cnt) }
    });
  } catch (err) {
    console.error('POST /api/neuromap/v2/rebuild-self:', err);
    res.status(500).json({ error: 'Rebuild failed: ' + err.message });
  }
});

// ── TEST RESULT ENDPOINTS ──

// Save test result (auth required)
app.post('/api/test-result/save', requireAuth, async (req, res) => {
  try {
    const { profile, answers, scores } = req.body;
    if (!profile || !answers || !scores) {
      return res.status(400).json({ error: 'profile, answers, and scores required' });
    }
    const userId = req.user.id;
    await sql`
      INSERT INTO test_results (user_id, profile, answers, scores)
      VALUES (${userId}, ${profile}, ${JSON.stringify(answers)}, ${JSON.stringify(scores)})
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/test-result/save:', err);
    res.status(500).json({ error: 'Save failed: ' + err.message });
  }
});

// Get latest test result (auth required)
app.get('/api/test-result/latest', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const rows = await sql`
      SELECT profile, answers, scores, completed_at
      FROM test_results
      WHERE user_id = ${userId}
      ORDER BY completed_at DESC
      LIMIT 1
    `;
    if (rows.length === 0) {
      return res.json({ ok: true, result: null });
    }
    res.json({ ok: true, result: rows[0] });
  } catch (err) {
    console.error('GET /api/test-result/latest:', err);
    res.status(500).json({ error: 'Fetch failed: ' + err.message });
  }
});

// ── USER STATS (RPG Dashboard) ──

// Load profile stats config
let profileStatsConfig = {};
try {
  const psPath = path.join(__dirname, '..', 'data', 'profile-stats.json');
  profileStatsConfig = JSON.parse(fs.readFileSync(psPath, 'utf8'));
  console.log(`Loaded profile-stats.json with ${Object.keys(profileStatsConfig.profiles || {}).length} profiles`);
} catch (e) {
  console.warn('Could not load profile-stats.json:', e.message);
}

// GET /api/stats/me — current user stats
app.get('/api/stats/me', requireAuth, async (req, res) => {
  try {
    const rows = await sql`SELECT stats, world_model_coherence, updated_at FROM user_stats WHERE user_id = ${req.user.id}`;
    if (rows.length === 0) return res.status(404).json({ error: 'No stats found. Call POST /api/stats/init first.' });
    res.json({ ok: true, stats: rows[0].stats, world_model_coherence: rows[0].world_model_coherence, updated_at: rows[0].updated_at });
  } catch (err) {
    console.error('GET /api/stats/me:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stats/init — create initial stats from test profile
app.post('/api/stats/init', requireAuth, async (req, res) => {
  try {
    // Check if already exists
    const existing = await sql`SELECT id FROM user_stats WHERE user_id = ${req.user.id}`;
    if (existing.length > 0) return res.json({ ok: true, message: 'Stats already initialized' });

    // Get user's test result to determine profile
    const testRows = await sql`
      SELECT profile FROM test_results
      WHERE user_id = ${req.user.id}
      ORDER BY completed_at DESC LIMIT 1
    `;

    let profileKey = 'STABLE_EXPLORER'; // default
    if (testRows.length > 0 && testRows[0].profile) {
      profileKey = testRows[0].profile;
    }

    // Also check localStorage-based profile from request body
    if (req.body && req.body.profileKey) profileKey = req.body.profileKey;

    const profile = (profileStatsConfig.profiles || {})[profileKey];
    if (!profile) {
      return res.status(400).json({ error: 'Unknown profile: ' + profileKey });
    }

    await sql`
      INSERT INTO user_stats (user_id, stats, world_model_coherence)
      VALUES (${req.user.id}, ${JSON.stringify(profile.stats)}, ${profile.world_model_coherence})
    `;

    res.json({ ok: true, stats: profile.stats, world_model_coherence: profile.world_model_coherence });
  } catch (err) {
    console.error('POST /api/stats/init:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/stats/:stat — update a single stat (for future leveling)
app.patch('/api/stats/:stat', requireAuth, async (req, res) => {
  try {
    const { stat } = req.params;
    const { value } = req.body;
    if (typeof value !== 'number' || value < 0 || value > 100) {
      return res.status(400).json({ error: 'Value must be 0-100' });
    }
    const rows = await sql`
      UPDATE user_stats
      SET stats = jsonb_set(stats, ${'{' + stat + '}'}, ${JSON.stringify(value)}::jsonb),
          updated_at = NOW()
      WHERE user_id = ${req.user.id}
      RETURNING stats, world_model_coherence
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'No stats found' });
    res.json({ ok: true, stats: rows[0].stats, world_model_coherence: rows[0].world_model_coherence });
  } catch (err) {
    console.error('PATCH /api/stats:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`NeuroAttention API running on port ${PORT}`);
});
