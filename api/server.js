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
const EMAIL_FROM = process.env.EMAIL_FROM || 'NeuroAttention Lab <info@neuroattention.org>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://neuroattention.org';

// ─── Nodemailer SMTP (Namecheap Private Email) ───
const nodemailer = require('nodemailer');
const SMTP_HOST = process.env.SMTP_HOST || 'mail.privateemail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
let mailTransport = null;
if (SMTP_USER && SMTP_PASS) {
  mailTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  mailTransport.verify().then(() => console.log('SMTP connected:', SMTP_HOST)).catch(e => console.error('SMTP verify error:', e.message));
} else {
  console.warn('SMTP not configured — emails will be logged to console (dev mode)');
}

// Stripe config (optional — endpoints gracefully degrade if keys missing)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';
let stripe = null;
if (STRIPE_SECRET_KEY) {
  try { stripe = require('stripe')(STRIPE_SECRET_KEY); } catch(e) { console.warn('stripe package not installed:', e.message); }
}

// ─── Send email helper (nodemailer SMTP) ───
async function sendEmail(to, subject, html) {
  if (!mailTransport) {
    console.log('══ DEV MODE: Email ══');
    console.log(`To: ${to} | Subject: ${subject}`);
    console.log('═════════════════════');
    return { dev: true };
  }
  try {
    const info = await mailTransport.sendMail({ from: EMAIL_FROM, to, subject, html });
    console.log(`Email sent to ${to} (messageId: ${info.messageId})`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('sendEmail error:', err.message);
    return { error: err.message };
  }
}

async function sendConfirmationEmail(email, product, sessionId) {
  if (!email) return;
  const productNames = { lab: 'NeuroAttention Lab Program', guided: 'NeuroAttention Lab — Guided Program', rehab: 'Rehabilitation Program' };
  const productName = productNames[product] || product;

  // Generate magic-link token for guest users (valid 7 days)
  let magicLinkHtml = '';
  try {
    const sql2 = neon(process.env.DATABASE_URL);
    const users = await sql2`SELECT id FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`;
    if (users.length > 0) {
      const magicToken = jwt.sign({ id: users[0].id, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '7d' });
      const magicUrl = `${FRONTEND_URL}/account.html?magic=${magicToken}`;
      magicLinkHtml = `
        <div style="background:#0a1a18;border:1px solid #00e5ff44;border-radius:12px;padding:20px;margin:20px 0;text-align:center;">
          <p style="margin:0 0 12px;font-size:15px;color:#e8eaed;font-weight:600;">Войти в личный кабинет</p>
          <a href="${magicUrl}" style="display:inline-block;padding:12px 32px;background:#00e5ff;color:#0a0a0a;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">Открыть кабинет</a>
          <p style="margin:12px 0 0;font-size:12px;color:#999;">Ссылка действительна 7 дней. Для постоянного доступа установите пароль в кабинете.</p>
        </div>`;
    }
  } catch (e) {
    console.error('Magic link generation error:', e.message);
  }

  return sendEmail(email, `Подтверждение оплаты — ${productName}`, `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#0a0a0a;padding:24px;text-align:center;">
        <h1 style="color:#00e5ff;font-size:22px;margin:0;">NeuroAttention</h1>
      </div>
      <div style="padding:32px 24px;">
        <h2 style="font-size:20px;margin-bottom:8px;color:#333;">Спасибо за покупку!</h2>
        <p style="color:#555;font-size:15px;line-height:1.6;">
          Ваш заказ на <strong>${productName}</strong> успешно оплачен.
        </p>
        <div style="background:#f0fffe;border:1px solid #00e5ff33;border-radius:12px;padding:16px;margin:20px 0;">
          <p style="margin:0;font-size:14px;color:#333;"><strong>Программа:</strong> ${productName}</p>
          <p style="margin:8px 0 0;font-size:14px;color:#333;"><strong>ID сессии:</strong> ${sessionId}</p>
        </div>
        ${magicLinkHtml}
        <p style="color:#555;font-size:14px;line-height:1.6;">
          Доступ к программе появится в вашем <a href="${FRONTEND_URL}/account.html" style="color:#00e5ff;">личном кабинете</a>
          в течение нескольких минут.
        </p>
        <p style="color:#999;font-size:13px;margin-top:24px;">
          Если у вас есть вопросы — ответьте на это письмо.
        </p>
      </div>
      <div style="background:#f8f8f8;padding:16px 24px;text-align:center;font-size:12px;color:#999;">
        NeuroAttention Lab LLC · <a href="${FRONTEND_URL}" style="color:#00e5ff;">neuroattention.org</a>
      </div>
    </div>
  `);
}

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
// Stripe webhook needs raw body — must be BEFORE express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    console.log('Stripe webhook called but keys not configured — ignoring');
    return res.json({ received: true, stub: true });
  }

  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      const meta = session.metadata || {};
      const customerEmail = session.customer_details?.email || meta.email;
      // Update existing consent_log row payment_status
      await sql`UPDATE consent_log SET
        stripe_session_id = ${session.id},
        stripe_customer_id = ${session.customer || null},
        payment_status = ${session.payment_status || 'paid'}
        WHERE product = ${meta.product} AND email = ${customerEmail}
        AND payment_status = 'pending'
      `;
      console.log('Stripe webhook: consent_log updated for session', session.id);

      // Send confirmation email
      if (session.payment_status === 'paid') {
        sendConfirmationEmail(customerEmail, meta.product, session.id);
      }
    } catch (err) {
      console.error('Stripe webhook DB error:', err.message);
    }
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '25mb' }));

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

    // Migration 013: rehab columns on test_results
    await sql`ALTER TABLE test_results ADD COLUMN IF NOT EXISTS rehab_flag BOOLEAN DEFAULT false`;
    await sql`ALTER TABLE test_results ADD COLUMN IF NOT EXISTS rehab_conditions TEXT[] DEFAULT '{}'`;
    await sql`ALTER TABLE test_results ADD COLUMN IF NOT EXISTS rehab_other_description TEXT DEFAULT ''`;

    // Migration 014: rehab_applications table
    await sql`CREATE TABLE IF NOT EXISTS rehab_applications (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      city TEXT NOT NULL,
      phone TEXT NOT NULL,
      age INTEGER NOT NULL CHECK (age > 0 AND age < 120),
      description TEXT NOT NULL,
      rehab_conditions TEXT[] DEFAULT '{}',
      rehab_other_description TEXT DEFAULT '',
      status TEXT DEFAULT 'new',
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rehab_app_status ON rehab_applications(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rehab_app_created ON rehab_applications(created_at DESC)`;

    // Migration 015: consent_log table
    await sql`CREATE TABLE IF NOT EXISTS consent_log (
      id SERIAL PRIMARY KEY,
      stripe_session_id TEXT,
      stripe_customer_id TEXT,
      product TEXT NOT NULL,
      email TEXT,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      consent_tos BOOLEAN DEFAULT false,
      consent_privacy BOOLEAN DEFAULT false,
      consent_digital BOOLEAN DEFAULT false,
      consent_rehab BOOLEAN,
      amount_total INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'usd',
      payment_status TEXT DEFAULT 'pending',
      consent_timestamp TIMESTAMP,
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_consent_log_product ON consent_log(product)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_consent_log_email ON consent_log(email)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_consent_log_created ON consent_log(created_at DESC)`;

    // Migration 016: practices table
    await sql`CREATE TABLE IF NOT EXISTS practices (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL,
      block_id TEXT NOT NULL,
      lang TEXT NOT NULL DEFAULT 'ru',
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      audio_url TEXT NOT NULL,
      duration_seconds INTEGER DEFAULT 0,
      order_idx INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_practices_block_lang ON practices(block_id, lang)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_practices_slug ON practices(slug)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_practices_order ON practices(block_id, lang, order_idx)`;

    res.json({ ok: true, message: 'Migrations 003-016 applied successfully' });
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
      user: { id: user.id, email: user.email, display_name: user.display_name, phone: user.phone, role: user.role, avatar_url: null }
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
      SELECT id, email, password_hash, display_name, phone, role, avatar_url
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
      user: { id: user.id, email: user.email, display_name: user.display_name, phone: user.phone, role: user.role, avatar_url: user.avatar_url || null }
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

// Upload avatar (base64 stored in DB, auto-compressed via sharp)
app.post('/api/users/me/avatar', requireAuth, async (req, res) => {
  try {
    const { avatar } = req.body;
    if (!avatar || typeof avatar !== 'string') {
      return res.status(400).json({ error: 'avatar (base64 data-URI) required' });
    }
    // Limit: ~20MB base64 (base64 is ~33% larger than raw)
    if (avatar.length > 28 * 1024 * 1024) {
      return res.status(413).json({ error: 'Avatar too large (max 20MB)' });
    }

    // Parse data-URI: data:image/png;base64,AAAA...
    const match = avatar.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ error: 'Invalid data-URI format' });
    }
    const mimeType = match[1];
    const rawBuf = Buffer.from(match[2], 'base64');

    // GIF: pass through up to 10MB uncompressed (sharp can't handle animated GIF well)
    if (mimeType === 'image/gif') {
      if (rawBuf.length > 10 * 1024 * 1024) {
        return res.status(413).json({ error: 'GIF too large (max 10MB)' });
      }
      // Store as-is
      await sql`UPDATE users SET avatar_url = ${avatar} WHERE id = ${req.user.id}`;
      return res.json({ ok: true, avatar_url: avatar, compressed: false, size: rawBuf.length });
    }

    // PNG/JPG/WebP: compress via sharp → max 1024x1024, JPEG q85
    let sharp;
    try {
      sharp = require('sharp');
    } catch (e) {
      // sharp not available — fall back to storing as-is with size check
      console.warn('sharp not available, storing avatar as-is');
      if (rawBuf.length > 5 * 1024 * 1024) {
        return res.status(413).json({ error: 'Avatar too large (max 5MB without compression)' });
      }
      await sql`UPDATE users SET avatar_url = ${avatar} WHERE id = ${req.user.id}`;
      return res.json({ ok: true, avatar_url: avatar, compressed: false, size: rawBuf.length });
    }

    const compressed = await sharp(rawBuf)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    const compressedDataUri = 'data:image/jpeg;base64,' + compressed.toString('base64');

    await sql`UPDATE users SET avatar_url = ${compressedDataUri} WHERE id = ${req.user.id}`;
    res.json({
      ok: true,
      avatar_url: compressedDataUri,
      compressed: true,
      original_size: rawBuf.length,
      compressed_size: compressed.length
    });
  } catch (err) {
    console.error('POST /api/users/me/avatar:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Select preset avatar (stores relative URL path in DB)
const VALID_PRESETS = [
  'preset-01.png','preset-02.png','preset-03.jpg','preset-04.jpg',
  'preset-05.jpg','preset-06.jpg','preset-07.jpg','preset-08.gif',
  'preset-09.jpg','preset-10.jpg','preset-11.gif','preset-12.jpg',
  'preset-13.gif'
];
app.post('/api/users/me/avatar/preset', requireAuth, async (req, res) => {
  try {
    const { preset } = req.body;
    if (!preset || !VALID_PRESETS.includes(preset)) {
      return res.status(400).json({ error: 'Invalid preset. Valid: ' + VALID_PRESETS.join(', ') });
    }
    const avatarUrl = 'assets/avatars/preset/' + preset;
    await sql`UPDATE users SET avatar_url = ${avatarUrl} WHERE id = ${req.user.id}`;
    res.json({ ok: true, avatar_url: avatarUrl });
  } catch (err) {
    console.error('POST /api/users/me/avatar/preset:', err);
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
  return sendEmail(to, 'Сброс пароля — NeuroAttention', `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#0a0a0a;padding:24px;text-align:center;">
        <h1 style="color:#00e5ff;font-size:22px;margin:0;">NeuroAttention</h1>
      </div>
      <div style="padding:32px 24px;">
        <h2 style="font-size:20px;margin-bottom:8px;color:#333;">Сброс пароля</h2>
        <p style="color:#555;font-size:15px;line-height:1.6;">Вы запросили сброс пароля.</p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${resetUrl}" style="background:#00e5ff;color:#000;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Установить новый пароль</a>
        </p>
        <p style="color:#999;font-size:13px;">Ссылка действительна 1 час. Если вы не запрашивали сброс — просто проигнорируйте это письмо.</p>
      </div>
      <div style="background:#f8f8f8;padding:16px 24px;text-align:center;font-size:12px;color:#999;">
        NeuroAttention Lab LLC · <a href="${FRONTEND_URL}" style="color:#00e5ff;">neuroattention.org</a>
      </div>
    </div>
  `);
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
    const { profile, answers, scores, rehab_flag, rehab_conditions, rehab_other_description } = req.body;
    if (!profile || !answers || !scores) {
      return res.status(400).json({ error: 'profile, answers, and scores required' });
    }
    const userId = req.user.id;
    const conditionsArr = Array.isArray(rehab_conditions) ? rehab_conditions : [];
    await sql`
      INSERT INTO test_results (user_id, profile, answers, scores, rehab_flag, rehab_conditions, rehab_other_description)
      VALUES (${userId}, ${profile}, ${JSON.stringify(answers)}, ${JSON.stringify(scores)}, ${rehab_flag || false}, ${conditionsArr}, ${rehab_other_description || ''})
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

// ══════════════════════════════════════════
// REHABILITATION APPLICATIONS
// ══════════════════════════════════════════

// Simple in-memory rate limiter for rehab applications (3 per day per IP)
const rehabRateMap = new Map();
function rehabRateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
  const key = ip + ':' + new Date().toISOString().slice(0, 10); // ip:YYYY-MM-DD
  const count = rehabRateMap.get(key) || 0;
  if (count >= 3) {
    return res.status(429).json({ error: 'Too many applications today. Try again tomorrow.' });
  }
  rehabRateMap.set(key, count + 1);
  // Cleanup old keys every 100 requests
  if (rehabRateMap.size > 500) {
    const today = new Date().toISOString().slice(0, 10);
    for (const k of rehabRateMap.keys()) {
      if (!k.endsWith(today)) rehabRateMap.delete(k);
    }
  }
  next();
}

// Optional auth — extracts user_id if token present, but doesn't require it
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      req.user = decoded;
    } catch (e) {
      // Token invalid — proceed without user
    }
  }
  next();
}

// POST /api/rehab/apply — public (rate-limited), optional auth
app.post('/api/rehab/apply', rehabRateLimit, optionalAuth, async (req, res) => {
  try {
    const { city, phone, age, description, rehab_conditions, rehab_other_description } = req.body;
    if (!city || !phone || !age || !description) {
      return res.status(400).json({ error: 'All fields required: city, phone, age, description' });
    }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 119) {
      return res.status(400).json({ error: 'Invalid age' });
    }
    const conditionsArr = Array.isArray(rehab_conditions) ? rehab_conditions : [];
    const userId = req.user ? req.user.id : null;

    const rows = await sql`
      INSERT INTO rehab_applications (user_id, city, phone, age, description, rehab_conditions, rehab_other_description)
      VALUES (${userId}, ${city.trim()}, ${phone.trim()}, ${ageNum}, ${description.trim()}, ${conditionsArr}, ${(rehab_other_description || '').trim()})
      RETURNING id, created_at
    `;
    res.json({ ok: true, id: rows[0].id, created_at: rows[0].created_at });
  } catch (err) {
    console.error('POST /api/rehab/apply:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/rehab/applications — superadmin/founder only
app.get('/api/admin/rehab/applications', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.id}`;
    if (!caller.length || !['superadmin', 'founder'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { status: filterStatus } = req.query;
    let rows;
    if (filterStatus && filterStatus !== 'all') {
      rows = await sql`
        SELECT ra.*, u.name as user_name, u.email as user_email
        FROM rehab_applications ra
        LEFT JOIN users u ON ra.user_id = u.id
        WHERE ra.status = ${filterStatus}
        ORDER BY ra.created_at DESC
        LIMIT 200
      `;
    } else {
      rows = await sql`
        SELECT ra.*, u.name as user_name, u.email as user_email
        FROM rehab_applications ra
        LEFT JOIN users u ON ra.user_id = u.id
        ORDER BY ra.created_at DESC
        LIMIT 200
      `;
    }
    res.json({ ok: true, applications: rows });
  } catch (err) {
    console.error('GET /api/admin/rehab/applications:', err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/rehab/applications/:id/status — superadmin/founder only
app.patch('/api/admin/rehab/applications/:id/status', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.id}`;
    if (!caller.length || !['superadmin', 'founder'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { id } = req.params;
    const { status: newStatus } = req.body;
    const validStatuses = ['new', 'contacted', 'in_progress', 'accepted', 'declined'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: 'Invalid status. Valid: ' + validStatuses.join(', ') });
    }
    const rows = await sql`
      UPDATE rehab_applications
      SET status = ${newStatus}, updated_at = now()
      WHERE id = ${parseInt(id, 10)}
      RETURNING *
    `;
    if (!rows.length) return res.status(404).json({ error: 'Application not found' });
    res.json({ ok: true, application: rows[0] });
  } catch (err) {
    console.error('PATCH /api/admin/rehab/applications/:id/status:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Stripe Checkout: create session ───
const STRIPE_PRODUCTS = {
  lab: {
    name: 'NeuroAttention Lab — Self-Guided Program',
    price: 140000, // $1,400
    currency: 'usd'
  },
  guided: {
    name: 'NeuroAttention Lab — Guided Program',
    price: 400000, // $4,000
    currency: 'usd'
  },
  rehab: {
    name: 'Rehabilitation Program',
    price: 19900, // $199
    currency: 'usd'
  }
};

app.post('/api/checkout/create-session', optionalAuth, async (req, res) => {
  try {
    const { product, tos, privacy, digital, rehab, timestamp, email: guestEmail } = req.body;
    if (!product || !STRIPE_PRODUCTS[product]) {
      return res.status(400).json({ error: 'Invalid product. Use: lab, rehab' });
    }
    if (!tos || !privacy || !digital) {
      return res.status(400).json({ error: 'All consent checkboxes must be accepted' });
    }
    if (product === 'rehab' && !rehab) {
      return res.status(400).json({ error: 'Rehabilitation consent must be accepted' });
    }

    const prod = STRIPE_PRODUCTS[product];
    let userEmail = req.user ? req.user.email : null;
    let userId = req.user ? req.user.id : null;

    // Guest checkout: if no auth, require email and create/find guest user
    if (!req.user && guestEmail) {
      userEmail = guestEmail.trim().toLowerCase();
      // Check if user already exists
      const existing = await sql`SELECT id FROM users WHERE email = ${userEmail} LIMIT 1`;
      if (existing.length > 0) {
        userId = existing[0].id;
      } else {
        // Create guest user with random password
        const bcrypt = require('bcryptjs');
        const randomPass = require('crypto').randomBytes(16).toString('hex');
        const hash = await bcrypt.hash(randomPass, 10);
        const inserted = await sql`INSERT INTO users (email, password_hash, name, role) VALUES (${userEmail}, ${hash}, ${'Guest'}, ${'client'}) RETURNING id`;
        userId = inserted[0].id;
      }
    } else if (!req.user && !guestEmail) {
      return res.status(400).json({ error: 'Email is required for guest checkout' });
    }

    // Always log consent to DB
    await sql`INSERT INTO consent_log (
      product, email, user_id,
      consent_tos, consent_privacy, consent_digital, consent_rehab,
      amount_total, currency, payment_status, consent_timestamp
    ) VALUES (
      ${product},
      ${userEmail},
      ${userId},
      ${!!tos},
      ${!!privacy},
      ${!!digital},
      ${product === 'rehab' ? !!rehab : null},
      ${prod.price},
      ${prod.currency},
      ${'pending'},
      ${timestamp || new Date().toISOString()}
    )`;

    // Create real Stripe Checkout session when keys are configured
    if (stripe) {
      const sessionParams = {
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: prod.currency,
            product_data: { name: prod.name },
            unit_amount: prod.price
          },
          quantity: 1
        }],
        success_url: FRONTEND_URL + '/checkout-success.html?session_id={CHECKOUT_SESSION_ID}&product=' + product,
        cancel_url: FRONTEND_URL + '/checkout-confirm.html?product=' + product,
        metadata: {
          product: product,
          consent_tos: String(!!tos),
          consent_privacy: String(!!privacy),
          consent_digital: String(!!digital),
          consent_rehab: product === 'rehab' ? String(!!rehab) : '',
          consent_timestamp: timestamp || new Date().toISOString(),
          email: userEmail || ''
        },
        allow_promotion_codes: true,
        custom_text: {
          submit: { message: 'By completing this purchase you confirm that you have read and agreed to our Terms of Service and Privacy Policy.' }
        }
      };
      if (userEmail) sessionParams.customer_email = userEmail;
      const session = await stripe.checkout.sessions.create(sessionParams);
      return res.json({ url: session.url, sessionId: session.id });
    }

    // Stripe keys not configured — consent logged, redirect to info page
    console.log('Stripe not configured, consent logged for product:', product, 'email:', userEmail);
    res.json({ stub: true, redirect_url: FRONTEND_URL + '/payment-coming-soon.html?product=' + product });
  } catch (err) {
    console.error('POST /api/checkout/create-session:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health / Stripe status check
app.get('/api/stripe/status', (req, res) => {
  res.json({
    configured: !!stripe,
    hasSecret: !!STRIPE_SECRET_KEY,
    hasWebhookSecret: !!STRIPE_WEBHOOK_SECRET,
    hasPublishable: !!STRIPE_PUBLISHABLE_KEY
  });
});

// ─── GitHub PAT for practices audio upload ───
const GITHUB_PAT = process.env.GITHUB_PAT || '';
const GITHUB_REPO_OWNER = 'tvildanov';
const GITHUB_REPO_NAME = 'NeuroAttention';
const GITHUB_AUDIO_PATH = 'assets/audio/practices';

// Helper: upload file to GitHub via Contents API
async function githubUploadFile(filePath, contentBase64, commitMessage) {
  if (!GITHUB_PAT) throw new Error('GITHUB_PAT not configured');
  const https = require('https');
  const url = `/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${filePath}`;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      message: commitMessage,
      content: contentBase64,
      branch: 'main'
    });
    const options = {
      hostname: 'api.github.com',
      path: url,
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_PAT}`,
        'User-Agent': 'NeuroAttention-API',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`GitHub API ${res.statusCode}: ${parsed.message || data}`));
          }
        } catch(e) { reject(new Error('GitHub API parse error: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Helper: delete file from GitHub via Contents API
async function githubDeleteFile(filePath, sha, commitMessage) {
  if (!GITHUB_PAT) throw new Error('GITHUB_PAT not configured');
  const https = require('https');
  const url = `/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${filePath}`;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      message: commitMessage,
      sha: sha,
      branch: 'main'
    });
    const options = {
      hostname: 'api.github.com',
      path: url,
      method: 'DELETE',
      headers: {
        'Authorization': `token ${GITHUB_PAT}`,
        'User-Agent': 'NeuroAttention-API',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`GitHub API ${res.statusCode}: ${parsed.message || data}`));
          }
        } catch(e) { reject(new Error('GitHub API parse error: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Helper: get file SHA from GitHub (needed for delete)
async function githubGetFileSha(filePath) {
  if (!GITHUB_PAT) throw new Error('GITHUB_PAT not configured');
  const https = require('https');
  const url = `/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${filePath}`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: url,
      method: 'GET',
      headers: {
        'Authorization': `token ${GITHUB_PAT}`,
        'User-Agent': 'NeuroAttention-API',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(parsed.sha);
          } else if (res.statusCode === 404) {
            resolve(null);
          } else {
            reject(new Error(`GitHub API ${res.statusCode}: ${parsed.message || data}`));
          }
        } catch(e) { reject(new Error('GitHub API parse error')); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ─── PRACTICES ENDPOINTS ───

// POST /api/admin/practices — upload practice (founder/superadmin only)
// Accepts: { slug, block_id, lang, name, description, duration_seconds, order_idx, audio_base64 }
// audio_base64 is the raw base64 of the mp3 file (no data: prefix)
app.post('/api/admin/practices', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.sub || req.user.id}`;
    if (!caller.length || !['superadmin', 'founder'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden — founder/superadmin only' });
    }

    const { slug, block_id, lang, name, description, duration_seconds, order_idx, audio_base64 } = req.body;
    if (!slug || !block_id || !lang || !name || !audio_base64) {
      return res.status(400).json({ error: 'Required: slug, block_id, lang, name, audio_base64' });
    }

    // Upload audio to GitHub
    const fileName = `${slug}-${lang}.mp3`;
    const gitPath = `${GITHUB_AUDIO_PATH}/${fileName}`;
    const commitMsg = `[practices] Add audio: ${fileName}`;

    await githubUploadFile(gitPath, audio_base64, commitMsg);

    // Raw URL for the file on GitHub Pages
    const audioUrl = `https://neuroattention.org/${gitPath}`;

    // Insert into DB
    const rows = await sql`
      INSERT INTO practices (slug, block_id, lang, name, description, audio_url, duration_seconds, order_idx)
      VALUES (${slug}, ${block_id}, ${lang}, ${name}, ${description || ''}, ${audioUrl}, ${duration_seconds || 0}, ${order_idx || 0})
      RETURNING *
    `;

    res.status(201).json({ ok: true, practice: rows[0] });
  } catch (err) {
    console.error('POST /api/admin/practices:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/practices — list practices (public, filtered by lang and optionally block)
app.get('/api/practices', async (req, res) => {
  try {
    const lang = req.query.lang || 'ru';
    const block = req.query.block;

    let rows;
    if (block) {
      rows = await sql`
        SELECT id, slug, block_id, lang, name, description, audio_url, duration_seconds, order_idx, created_at
        FROM practices
        WHERE lang = ${lang} AND block_id = ${block}
        ORDER BY order_idx ASC, id ASC
      `;
    } else {
      rows = await sql`
        SELECT id, slug, block_id, lang, name, description, audio_url, duration_seconds, order_idx, created_at
        FROM practices
        WHERE lang = ${lang}
        ORDER BY block_id ASC, order_idx ASC, id ASC
      `;
    }

    res.json({ practices: rows });
  } catch (err) {
    console.error('GET /api/practices:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/practices — list all practices across all languages (founder/superadmin)
app.get('/api/admin/practices', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.sub || req.user.id}`;
    if (!caller.length || !['superadmin', 'founder'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const rows = await sql`
      SELECT id, slug, block_id, lang, name, description, audio_url, duration_seconds, order_idx, created_at
      FROM practices
      ORDER BY block_id ASC, order_idx ASC, lang ASC
    `;

    res.json({ practices: rows });
  } catch (err) {
    console.error('GET /api/admin/practices:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/practices/:id — delete practice (founder/superadmin only)
app.delete('/api/admin/practices/:id', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.sub || req.user.id}`;
    if (!caller.length || !['superadmin', 'founder'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const practiceId = parseInt(req.params.id);
    const rows = await sql`SELECT * FROM practices WHERE id = ${practiceId}`;
    if (!rows.length) return res.status(404).json({ error: 'Practice not found' });

    const practice = rows[0];

    // Try to delete audio file from GitHub
    try {
      const audioPath = practice.audio_url.replace('https://neuroattention.org/', '');
      const sha = await githubGetFileSha(audioPath);
      if (sha) {
        await githubDeleteFile(audioPath, sha, `[practices] Remove audio: ${path.basename(audioPath)}`);
      }
    } catch (gitErr) {
      console.warn('Could not delete audio from GitHub:', gitErr.message);
      // Continue with DB deletion even if GitHub delete fails
    }

    // Delete from DB
    await sql`DELETE FROM practices WHERE id = ${practiceId}`;

    res.json({ ok: true, deleted: practiceId });
  } catch (err) {
    console.error('DELETE /api/admin/practices/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: Dashboard stats ──
app.get('/api/admin/stats', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.id}`;
    if (!caller.length || !['superadmin', 'founder', 'specialist'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Aggregate counts
    const [totalR] = await sql`SELECT COUNT(*) AS cnt FROM users`;
    const [activeR] = await sql`SELECT COUNT(*) AS cnt FROM users WHERE last_login_at > NOW() - INTERVAL '30 days'`;
    const [clientsR] = await sql`SELECT COUNT(*) AS cnt FROM users WHERE role IN ('user','client')`;
    const [specsR] = await sql`SELECT COUNT(*) AS cnt FROM users WHERE role = 'specialist'`;
    const [paidR] = await sql`SELECT COUNT(DISTINCT cl.user_id) AS cnt FROM consent_log cl WHERE cl.payment_status = 'completed'`;

    // Recent signups (last 10)
    const recent = await sql`
      SELECT id, email, display_name AS name, role, phone, created_at, avatar_url
      FROM users ORDER BY created_at DESC LIMIT 10
    `;

    // Sales by program (from consent_log)
    const salesRows = await sql`
      SELECT COALESCE(product, 'unknown') AS program, COUNT(*) AS cnt
      FROM consent_log WHERE payment_status = 'completed'
      GROUP BY product
    `;
    const salesMap = { self_guided: 0, guided: 0, group: 0 };
    salesRows.forEach(r => {
      const k = r.program.toLowerCase().replace(/[\s-]/g, '_');
      if (k in salesMap) salesMap[k] = parseInt(r.cnt);
      else if (k.includes('self')) salesMap.self_guided = parseInt(r.cnt);
      else if (k.includes('guided')) salesMap.guided = parseInt(r.cnt);
      else if (k.includes('group')) salesMap.group = parseInt(r.cnt);
    });

    res.json({
      total_users: parseInt(totalR.cnt),
      active_users: parseInt(activeR.cnt),
      clients: parseInt(clientsR.cnt),
      specialists: parseInt(specsR.cnt),
      with_program: parseInt(paidR.cnt),
      recent_signups: recent,
      sales_by_program: salesMap
    });
  } catch (err) {
    console.error('GET /api/admin/stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: Users list ──
app.get('/api/admin/users', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.id}`;
    if (!caller.length || !['superadmin', 'founder', 'specialist'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { role, search, page = 1, limit = 50 } = req.query;
    const lim = Math.min(parseInt(limit) || 50, 200);
    const off = (Math.max(parseInt(page) || 1, 1) - 1) * lim;

    // Simple approach: fetch all matching users, then enrich
    let users, countR;
    const like = search ? `%${search.toLowerCase()}%` : null;

    if (role && role !== 'all' && like) {
      [countR] = await sql`SELECT COUNT(*) AS cnt FROM users WHERE role = ${role} AND (LOWER(email) LIKE ${like} OR LOWER(display_name) LIKE ${like} OR phone LIKE ${like})`;
      users = await sql`
        SELECT id, email, display_name, role, phone, created_at, last_login_at, avatar_url
        FROM users WHERE role = ${role} AND (LOWER(email) LIKE ${like} OR LOWER(display_name) LIKE ${like} OR phone LIKE ${like})
        ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
      `;
    } else if (role && role !== 'all') {
      [countR] = await sql`SELECT COUNT(*) AS cnt FROM users WHERE role = ${role}`;
      users = await sql`
        SELECT id, email, display_name, role, phone, created_at, last_login_at, avatar_url
        FROM users WHERE role = ${role}
        ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
      `;
    } else if (like) {
      [countR] = await sql`SELECT COUNT(*) AS cnt FROM users WHERE (LOWER(email) LIKE ${like} OR LOWER(display_name) LIKE ${like} OR phone LIKE ${like})`;
      users = await sql`
        SELECT id, email, display_name, role, phone, created_at, last_login_at, avatar_url
        FROM users WHERE (LOWER(email) LIKE ${like} OR LOWER(display_name) LIKE ${like} OR phone LIKE ${like})
        ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
      `;
    } else {
      [countR] = await sql`SELECT COUNT(*) AS cnt FROM users`;
      users = await sql`
        SELECT id, email, display_name, role, phone, created_at, last_login_at, avatar_url
        FROM users ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
      `;
    }

    // Enrich each user with test/neuromap/diary/rehab counts
    for (const u of users) {
      try {
        const [tr] = await sql`SELECT profile FROM test_results WHERE user_id = ${u.id} ORDER BY completed_at DESC LIMIT 1`;
        u.test_completed = !!tr;
        u.test_profile = tr ? tr.profile : null;
        const [nm] = await sql`SELECT COUNT(*) AS cnt FROM nm_nodes WHERE user_id = ${u.id}`;
        u.nm_entries_count = parseInt(nm.cnt);
        const [di] = await sql`SELECT COUNT(*) AS cnt FROM neuro_resource_diary WHERE user_id = ${u.id}`;
        u.diary_entries_count = parseInt(di.cnt);
        const [ra] = await sql`SELECT id FROM rehab_applications WHERE user_id = ${u.id} LIMIT 1`;
        u.rehab_flag = !!ra;
      } catch (enrichErr) {
        console.warn('Enrich user', u.id, enrichErr.message);
        u.test_completed = false; u.nm_entries_count = 0; u.diary_entries_count = 0; u.rehab_flag = false;
      }
    }

    res.json({ users, total: parseInt(countR.cnt), page: parseInt(page), limit: lim });
  } catch (err) {
    console.error('GET /api/admin/users:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: User detail ──
app.get('/api/admin/users/:id', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.id}`;
    if (!caller.length || !['superadmin', 'founder', 'specialist'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const userId = req.params.id;
    const [user] = await sql`
      SELECT id, email, display_name, role, phone, created_at, last_login_at, avatar_url
      FROM users WHERE id = ${userId}
    `;
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Test result
    const [testResult] = await sql`
      SELECT id, user_id, profile, scores, completed_at FROM test_results WHERE user_id = ${userId} ORDER BY completed_at DESC LIMIT 1
    `;

    // Rehab application
    const [rehabApp] = await sql`
      SELECT * FROM rehab_applications WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1
    `;

    // NeuroMap summary
    const [nmCount] = await sql`SELECT COUNT(*) AS cnt FROM nm_nodes WHERE user_id = ${userId}`;
    const [nmLastEntry] = await sql`SELECT MAX(updated_at) AS last_at FROM nm_nodes WHERE user_id = ${userId}`;
    const topConcepts = await sql`
      SELECT label, type, count FROM nm_nodes WHERE user_id = ${userId} ORDER BY count DESC LIMIT 10
    `;

    // Diary summary
    const [diaryCount] = await sql`SELECT COUNT(*) AS cnt FROM neuro_resource_diary WHERE user_id = ${userId}`;
    const [diaryLast] = await sql`SELECT MAX(created_at) AS last_at FROM neuro_resource_diary WHERE user_id = ${userId}`;

    // Course progress
    const courseProgress = await sql`SELECT * FROM course_progress WHERE user_id = ${userId}`;

    // User stats
    const userStats = await sql`SELECT * FROM user_stats WHERE user_id = ${userId}`;

    res.json({
      user,
      test_result: testResult || null,
      rehab_application: rehabApp || null,
      neuromap_summary: {
        nodes_count: parseInt(nmCount.cnt),
        last_entry_at: nmLastEntry?.last_at || null,
        top_concepts: topConcepts
      },
      diary_summary: {
        entries_count: parseInt(diaryCount.cnt),
        last_entry_at: diaryLast?.last_at || null
      },
      course_progress: courseProgress,
      user_stats: userStats
    });
  } catch (err) {
    console.error('GET /api/admin/users/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: User NeuroMap graph (read-only) ──
app.get('/api/admin/users/:id/neuromap', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.id}`;
    if (!caller.length || !['superadmin', 'founder', 'specialist'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const userId = req.params.id;
    const nodes = await sql`SELECT * FROM nm_nodes WHERE user_id = ${userId}`;
    const links = await sql`SELECT * FROM nm_links WHERE user_id = ${userId}`;
    res.json({ nodes, links });
  } catch (err) {
    console.error('GET /api/admin/users/:id/neuromap:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: User diary (read-only) ──
app.get('/api/admin/users/:id/diary', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.id}`;
    if (!caller.length || !['superadmin', 'founder', 'specialist'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const userId = req.params.id;
    const entries = await sql`
      SELECT * FROM neuro_resource_diary WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 500
    `;
    res.json({ entries });
  } catch (err) {
    console.error('GET /api/admin/users/:id/diary:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── ADMIN: User progress (read-only) ──
app.get('/api/admin/users/:id/progress', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.id}`;
    if (!caller.length || !['superadmin', 'founder', 'specialist'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const userId = req.params.id;
    const progress = await sql`SELECT * FROM course_progress WHERE user_id = ${userId}`;
    res.json({ progress });
  } catch (err) {
    console.error('GET /api/admin/users/:id/progress:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`NeuroAttention API running on port ${PORT}`);
});
