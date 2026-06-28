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

// ── MONAD read-only service token (GET-only) ──
const MONAD_READONLY_TOKEN = process.env.MONAD_READONLY_TOKEN || '';
let _monadPrincipal = null;
async function getMonadPrincipal() {
  if (_monadPrincipal) return _monadPrincipal;
  const rows = await sql`
    SELECT id, email FROM users
    WHERE role IN ('superadmin','founder')
    ORDER BY created_at ASC LIMIT 1
  `;
  if (rows.length) _monadPrincipal = { id: rows[0].id, email: rows[0].email };
  return _monadPrincipal;
}
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

  const purchasedAt = new Date();
  const activationDate = new Date(purchasedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
  const dateOpts = { day: 'numeric', month: 'long', year: 'numeric' };
  const purchaseStr = purchasedAt.toLocaleDateString('ru-RU', dateOpts);
  const activationStr = activationDate.toLocaleDateString('ru-RU', dateOpts);
  return sendEmail(email, `Подтверждение оплаты — ${productName}`, `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#0a0a0a;padding:24px;text-align:center;">
        <h1 style="color:#00e5ff;font-size:22px;margin:0;">NeuroAttention</h1>
      </div>
      <div style="padding:32px 24px;">
        <h2 style="font-size:20px;margin-bottom:8px;color:#333;">Спасибо за покупку!</h2>
        <p style="color:#555;font-size:15px;line-height:1.6;">Ваш заказ на <strong>${productName}</strong> успешно оплачен. Вся актуальная информация по программе ниже.</p>
        <div style="background:#f0fffe;border:1px solid #00e5ff33;border-radius:12px;padding:16px;margin:20px 0;">
          <p style="margin:0;font-size:14px;color:#333;"><strong>Программа:</strong> ${productName}</p>
          <p style="margin:8px 0 0;font-size:14px;color:#333;"><strong>Дата оплаты:</strong> ${purchaseStr}</p>
          <p style="margin:8px 0 0;font-size:14px;color:#333;"><strong>Активация программы:</strong> до ${activationStr} (в течение 14 дней)</p>
          <p style="margin:8px 0 0;font-size:13px;color:#666;"><strong>ID сессии:</strong> <span style="font-family:monospace;font-size:11px;">${sessionId}</span></p>
        </div>
        <div style="background:#fff8e6;border:1px solid #ffd60044;border-radius:12px;padding:16px;margin:20px 0;">
          <p style="margin:0 0 8px;font-size:14px;color:#333;"><strong>Что будет дальше:</strong></p>
          <ol style="margin:0;padding-left:20px;color:#555;font-size:13px;line-height:1.8;">
            <li>В течение 1–3 рабочих дней с вами свяжется куратор для приветственной диагностики и обсуждения вашего запроса.</li>
            <li>До <strong>${activationStr}</strong> программа будет полностью активирована: откроется доступ к практикам, материалам и инструментам в вашем личном кабинете.</li>
            <li>Если есть срочные вопросы или необходимо изменить контактные данные — ответьте на это письмо.</li>
          </ol>
        </div>
        ${magicLinkHtml}
        <p style="color:#555;font-size:14px;line-height:1.6;">В вашем <a href="${FRONTEND_URL}/account.html" style="color:#00e5ff;">личном кабинете</a> уже виден статус приобретённой программы и таймер до активации. Дополнительные инструменты будут открываться по мере прохождения онбординга.</p>
        <p style="color:#999;font-size:13px;margin-top:24px;line-height:1.5;">NeuroAttention — не медицинский сервис. Программы носят образовательный, исследовательский и тренировочный характер. Подробнее: <a href="${FRONTEND_URL}/terms-of-service.html" style="color:#999;">Terms of Service</a> · <a href="${FRONTEND_URL}/privacy-policy.html" style="color:#999;">Privacy Policy</a>.</p>
      </div>
      <div style="background:#f8f8f8;padding:16px 24px;text-align:center;font-size:12px;color:#999;">NeuroAttention Lab LLC · <a href="${FRONTEND_URL}" style="color:#00e5ff;">neuroattention.org</a></div>
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

  // Pack 21 round 3: handle refunds
  if (event.type === 'charge.refunded' || event.type === 'refund.created' || event.type === 'refund.updated') {
    try {
      const obj = event.data.object;
      const paymentIntentId = obj.payment_intent || obj.charge?.payment_intent;
      const chargeId = obj.id || obj.charge?.id;
      if (paymentIntentId) {
        await sql`UPDATE consent_log SET payment_status = 'refunded', refunded_at = now()
                  WHERE stripe_payment_intent_id = ${paymentIntentId}
                    OR stripe_charge_id = ${chargeId}`;
        console.log('Stripe webhook: marked refunded — pi:', paymentIntentId, 'charge:', chargeId);
      }
    } catch (err) {
      console.error('Stripe webhook refund DB error:', err.message);
    }
    return res.json({ received: true });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      const meta = session.metadata || {};

      // ── Donations branch (Pack 25/26) ──
      // Distinguished by absence of a `product` metadata field AND presence of
      // a `donation_message` (which is set when the donate checkout is created).
      if (!meta.product && (meta.donation_message !== undefined || meta.donation === 'true')) {
        const donorUserId = meta.user_id || null;
        const paymentIntent = session.payment_intent || null;
        await sql`INSERT INTO donations (donor_user_id, amount_cents, currency, stripe_session_id, stripe_payment_intent_id, message)
                  VALUES (${donorUserId}, ${session.amount_total || 0}, ${session.currency || 'usd'},
                          ${session.id}, ${paymentIntent}, ${meta.donation_message || ''})`;
        if (donorUserId) {
          // Award first_donation achievement; tryAwardAchievement is defined later in the file
          // and handles the idempotency + notification fan-out.
          try { await tryAwardAchievement(donorUserId, 'first_donation', []); }
          catch (e) { console.warn('first_donation award:', e.message); }
        }
        console.log('Stripe webhook: donation recorded for session', session.id, 'user_id:', donorUserId);
        return res.json({ received: true, kind: 'donation' });
      }

      const customerEmail = session.customer_details?.email || meta.email;
      // If consent_log row missing user_id, try to backfill from email
      let userIdForLog = null;
      if (customerEmail) {
        const u = await sql`SELECT id FROM users WHERE email = ${customerEmail}`;
        if (u.length) userIdForLog = u[0].id;
      }
      // Pack 21 round 3: capture payment_intent + amount + discount details
      const paymentIntent = session.payment_intent || null;
      const discountAmount = session.total_details?.amount_discount || 0;
      const promoCode = (session.discounts && session.discounts[0]?.promotion_code) || null;
      // Update existing consent_log row payment_status
      await sql`UPDATE consent_log SET
        stripe_session_id = ${session.id},
        stripe_customer_id = ${session.customer || null},
        stripe_payment_intent_id = ${paymentIntent},
        payment_status = ${session.payment_status || 'paid'},
        amount_total = COALESCE(${session.amount_total || null}, amount_total),
        discount_amount = ${discountAmount},
        promotion_code = ${promoCode},
        user_id = COALESCE(user_id, ${userIdForLog})
        WHERE product = ${meta.product} AND email = ${customerEmail}
        AND payment_status = 'pending'
      `;
      console.log('Stripe webhook: consent_log updated for session', session.id, 'user_id:', userIdForLog);

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

// Multer for multipart/form-data uploads (audio practices). Uses memory storage
// because we forward the buffer straight to GitHub Contents API — no disk needed.
const multer = require('multer');
const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 } // 60 MB hard cap (matches client 50 MB + headroom)
});
// Bigger uploader for stream recordings (up to ~500 MB / 30 min @ 2 Mbps)
const uploadRecording = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// ── ONE-TIME MIGRATION ENDPOINT (remove after use) ──
app.post('/api/run-migrations', async (req, res) => {
  try {
    // ⚠️ Critical schema columns FIRST — the course-block constructor (tool_task)
    // breaks hard without these. Kept at the very top of the pipeline so they
    // always apply even if a later (non-critical) migration statement throws and
    // aborts the rest of the run. Fully idempotent.
    await sql`ALTER TABLE course_blocks ADD COLUMN IF NOT EXISTS tool_kind TEXT`;
    await sql`ALTER TABLE course_blocks ADD COLUMN IF NOT EXISTS tool_config JSONB DEFAULT '{}'::jsonb`;

    // ── Migration 019: fix medically-wrong anatomy seed regions (mirrors
    //    migrations/019_fix_anatomy_seed_regions.sql). Run FIRST — a pre-existing
    //    tools rename further down throws a duplicate-key on re-run and aborts the
    //    rest of the pipeline, so these must apply before that point. Wrapped in
    //    try/catch: idempotent UPDATE…WHERE slug, no-op if the anatomy tables
    //    aren't seeded yet (fresh DB) — never aborts the run. Only the 11 listed
    //    rows; medically-correct rows (brain/cardio/neuro/psych/…) untouched.
    try {
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['stomach','medulla']::text[] WHERE slug = 'gastritis'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['oesophagus','stomach','medulla']::text[] WHERE slug = 'gerd'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['small-intestine','large-intestine']::text[] WHERE slug = 'crohns'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['large-intestine','medulla']::text[] WHERE slug = 'ibs'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['pancreas','hypothalamus','liver']::text[] WHERE slug = 'type1-diabetes'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['pancreas','hypothalamus','liver','kidneys']::text[] WHERE slug = 'type2-diabetes'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['thyroid-gland']::text[] WHERE slug = 'hyperthyroidism'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['thyroid-gland']::text[] WHERE slug = 'hypothyroidism'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['nose']::text[] WHERE slug = 'allergic-rhinitis'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['hip']::text[] WHERE slug = 'hip-osteoarthritis'`;
      await sql`UPDATE anatomy_functions SET region_ids = ARRAY['stomach','small-intestine','large-intestine','medulla','hypothalamus','liver']::text[] WHERE slug = 'digestion'`;
    } catch (e) { console.error('migration 019 (anatomy seed fix):', e.message); }

    // ── Migration 020: strip stray central/brain regions from NON-neuro
    //    conditions (mirrors migrations/020_strip_brain_from_nonbrain.sql). The
    //    affected_region_ids should be the locally affected organs only — medulla/
    //    hypothalamus are autonomic regulators, not the lesion. Run BEFORE the
    //    tools rename (which throws on re-run). Idempotent; only these 8 rows.
    //    Neuro/psych conditions keep their brain regions (untouched).
    try {
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['stomach']::text[] WHERE slug = 'gastritis'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['oesophagus','stomach']::text[] WHERE slug = 'gerd'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['large-intestine']::text[] WHERE slug = 'ibs'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['lungs']::text[] WHERE slug = 'asthma'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['lungs']::text[] WHERE slug = 'copd'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['pancreas','liver']::text[] WHERE slug = 'type1-diabetes'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['pancreas','liver','kidneys']::text[] WHERE slug = 'type2-diabetes'`;
      await sql`UPDATE human_conditions SET affected_region_ids = ARRAY['heart','kidneys']::text[] WHERE slug = 'hypertension'`;
    } catch (e) { console.error('migration 020 (strip brain from non-neuro):', e.message); }

    // ── External Field tool (objective environmental signals) ──
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS location_lon DOUBLE PRECISION`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS location_city TEXT`;
    // PR4 (4.4): country captured at registration alongside city/lat/lon.
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS location_country TEXT`;
    // soft-delete: superadmin marks a user deleted; a cron hard-deletes after 1h.
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;
    await sql`CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY, actor_user_id UUID, action TEXT NOT NULL,
      target_user_id UUID, detail JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS external_signal_events (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      layer TEXT NOT NULL CHECK (layer IN ('sun','moon','earth','weather','cosmos','social','experimental')),
      source TEXT NOT NULL,
      source_url TEXT,
      event_type TEXT,
      title TEXT,
      description TEXT,
      timestamp TIMESTAMPTZ NOT NULL,
      start_time TIMESTAMPTZ,
      end_time TIMESTAMPTZ,
      severity TEXT,
      location_scope TEXT CHECK (location_scope IN ('global','local','regional')),
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      dedup_key TEXT,
      raw_payload JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ese_user_time ON external_signal_events (user_id, timestamp DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ese_layer_time ON external_signal_events (layer, timestamp DESC)`;
    // dedup_key makes the poller idempotent (same external event never doubles)
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_ese_dedup ON external_signal_events (dedup_key) WHERE dedup_key IS NOT NULL`;
    // PR FIX #4: purge stale GraceDB Mock-Data-Challenge / Test replays that the
    // old poller ingested hourly (dedup_key gracedb:MS… / gracedb:TS…). The poller
    // now filters these out, but the historical rows still polluted the Cosmos layer.
    try { await sql`DELETE FROM external_signal_events WHERE layer = 'cosmos' AND (dedup_key LIKE 'gracedb:MS%' OR dedup_key LIKE 'gracedb:TS%' OR dedup_key LIKE 'gracedb:T0%')`; } catch (e) {}
    await sql`CREATE TABLE IF NOT EXISTS external_field_subscriptions (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS external_field_notifications (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      event_id BIGINT REFERENCES external_signal_events(id) ON DELETE CASCADE,
      layer TEXT NOT NULL,
      title TEXT,
      body TEXT,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_efn_user ON external_field_notifications (user_id, created_at DESC)`;

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
    // Pack 21 round 3: add columns for payment_intent / charge / refund metadata
    await sql`ALTER TABLE consent_log ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT`;
    await sql`ALTER TABLE consent_log ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT`;
    await sql`ALTER TABLE consent_log ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP`;
    await sql`ALTER TABLE consent_log ADD COLUMN IF NOT EXISTS discount_amount INTEGER DEFAULT 0`;
    await sql`ALTER TABLE consent_log ADD COLUMN IF NOT EXISTS promotion_code TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS idx_consent_log_pi ON consent_log(stripe_payment_intent_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_consent_log_session ON consent_log(stripe_session_id)`;
    // Dedupe consent_log rows that share the same stripe_session_id (keep newest)
    await sql`DELETE FROM consent_log
              WHERE id NOT IN (
                SELECT MAX(id) FROM consent_log
                WHERE stripe_session_id IS NOT NULL AND stripe_session_id <> ''
                GROUP BY stripe_session_id
              )
              AND stripe_session_id IS NOT NULL AND stripe_session_id <> ''`;
    // Unique constraint to prevent future duplicates per session
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_consent_log_session ON consent_log(stripe_session_id) WHERE stripe_session_id IS NOT NULL AND stripe_session_id <> ''`;

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

    // Migration 017: practice_blocks — composable parts of a practice (audio_part / text / image / video / link / sensation_entry / comment_prompt / question_choice)
    await sql`CREATE TABLE IF NOT EXISTS practice_blocks (
      id SERIAL PRIMARY KEY,
      practice_id INTEGER REFERENCES practices(id) ON DELETE CASCADE,
      order_idx INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      xp_reward INTEGER DEFAULT 50,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_practice_blocks_practice ON practice_blocks(practice_id, order_idx)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_practice_blocks_type ON practice_blocks(type)`;

    // Migration 018: practice_block_completion — per-user progress tracking
    await sql`CREATE TABLE IF NOT EXISTS practice_block_completion (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      block_id INTEGER REFERENCES practice_blocks(id) ON DELETE CASCADE,
      practice_id INTEGER REFERENCES practices(id) ON DELETE CASCADE,
      completed_at TIMESTAMP DEFAULT now(),
      duration_seconds INTEGER,
      payload_response JSONB
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_pbc_unique ON practice_block_completion(user_id, block_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pbc_user ON practice_block_completion(user_id, completed_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pbc_practice ON practice_block_completion(user_id, practice_id)`;

    // Migration 019: vocab_terms — unified vocabulary for sensations / body locations / emotions / etc., editable via admin
    await sql`CREATE TABLE IF NOT EXISTS vocab_terms (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      slug TEXT NOT NULL,
      label_ru TEXT NOT NULL,
      label_en TEXT NOT NULL,
      label_es TEXT NOT NULL,
      polarity_strength NUMERIC(4,2),
      order_idx INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_vocab_cat_slug ON vocab_terms(category, slug)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_vocab_active ON vocab_terms(category, is_active, order_idx)`;
    // PR4 (4.1/4.2): icon key (resolved client-side) + who added a user-created term.
    await sql`ALTER TABLE vocab_terms ADD COLUMN IF NOT EXISTS icon TEXT`;
    await sql`ALTER TABLE vocab_terms ADD COLUMN IF NOT EXISTS created_by UUID`;

    // Seed sensations (28 terms)
    const sensSeed = [
      ['heat','жар','heat','calor'],
      ['warmth','тепло','warmth','calidez'],
      ['coolness','прохлада','coolness','frescor'],
      ['cold','холод','cold','frío'],
      ['pressure','давление','pressure','presión'],
      ['heaviness','тяжесть','heaviness','pesadez'],
      ['lightness','лёгкость','lightness','ligereza'],
      ['pulsation','пульсация','pulsation','pulsación'],
      ['vibration','вибрация','vibration','vibración'],
      ['pain','боль','pain','dolor'],
      ['swelling','набухание','swelling','hinchazón'],
      ['tickling','щекотка','tickling','cosquilleo'],
      ['electric_like','электроподобные ощущения','electric-like sensations','sensaciones eléctricas'],
      ['tingling','покалывания','tingling','hormigueo'],
      ['weight','вес','weight','peso'],
      ['flowing','стекание','flowing','fluir'],
      ['deepening','углубление','deepening','profundización'],
      ['softness','мягкость','softness','suavidad'],
      ['hardness','твердость','hardness','dureza'],
      ['density','плотность','density','densidad'],
      ['seeping','просачивание','seeping','filtración'],
      ['expanding','увеличение','expanding','aumento'],
      ['shrinking','уменьшение','shrinking','disminución'],
      ['broadening','расширение','broadening','ensanchamiento'],
      ['narrowing','сужение','narrowing','estrechamiento'],
      ['permeability','проницаемость','permeability','permeabilidad'],
      ['moisture','влажность','moisture','humedad'],
      ['dryness','сухость','dryness','sequedad']
    ];
    for (let i = 0; i < sensSeed.length; i++) {
      const [slug, ru, en, es] = sensSeed[i];
      await sql`INSERT INTO vocab_terms (category, slug, label_ru, label_en, label_es, order_idx)
                VALUES ('sensation', ${slug}, ${ru}, ${en}, ${es}, ${i})
                ON CONFLICT (category, slug) DO NOTHING`;
    }

    // Seed body locations (44 terms)
    const bodySeed = [
      ['body','тело','body','cuerpo'],
      ['head','голова','head','cabeza'],
      ['right_leg','правая нога','right leg','pierna derecha'],
      ['left_leg','левая нога','left leg','pierna izquierda'],
      ['right_arm','правая рука','right arm','brazo derecho'],
      ['left_arm','левая рука','left arm','brazo izquierdo'],
      ['belly','живот','belly','vientre'],
      ['neck','шея','neck','cuello'],
      ['chest','грудь','chest','pecho'],
      ['back','спина','back','espalda'],
      ['right_palm','правая ладонь','right palm','palma derecha'],
      ['left_palm','левая ладонь','left palm','palma izquierda'],
      ['right_hand_fingers','пальцы правой руки','right hand fingers','dedos de la mano derecha'],
      ['left_hand_fingers','пальцы левой руки','left hand fingers','dedos de la mano izquierda'],
      ['right_foot_toes','пальцы правой ноги','right foot toes','dedos del pie derecho'],
      ['left_foot_toes','пальцы левой ноги','left foot toes','dedos del pie izquierdo'],
      ['heart','сердце','heart','corazón'],
      ['brain','мозг','brain','cerebro'],
      ['mid_brain','середина мозга','mid-brain','centro del cerebro'],
      ['brain_surface','поверхность мозга','brain surface','superficie cerebral'],
      ['lungs','лёгкие','lungs','pulmones'],
      ['stomach','желудок','stomach','estómago'],
      ['perineum','промежность','perineum','perineo'],
      ['pelvis','таз','pelvis','pelvis'],
      ['thighs','бёдра','thighs','muslos'],
      ['shins','голени','shins','espinillas'],
      ['knees','колени','knees','rodillas'],
      ['crown','макушка','crown of head','coronilla'],
      ['face','лицо','face','rostro'],
      ['eyes','глаза','eyes','ojos'],
      ['ears','уши','ears','oídos'],
      ['whole_body','всё тело','whole body','todo el cuerpo'],
      ['mouth','рот','mouth','boca'],
      ['teeth','зубы','teeth','dientes'],
      ['chin','подбородок','chin','mentón'],
      ['behind_back','за спиной','behind the back','detrás de la espalda'],
      ['front_body','перед телом','in front of body','frente al cuerpo'],
      ['above_head','над головой','above the head','sobre la cabeza'],
      ['under_feet','под стопами','under the feet','bajo los pies'],
      ['hand_fingertips','кончики пальцев рук','hand fingertips','puntas de los dedos de las manos'],
      ['foot_fingertips','кончики пальцев ног','foot fingertips','puntas de los dedos de los pies'],
      ['spine','позвоночник','spine','columna vertebral'],
      ['sacrum','крестец','sacrum','sacro'],
      ['coccyx','копчик','coccyx','cóccix']
    ];
    for (let i = 0; i < bodySeed.length; i++) {
      const [slug, ru, en, es] = bodySeed[i];
      await sql`INSERT INTO vocab_terms (category, slug, label_ru, label_en, label_es, order_idx)
                VALUES ('body_location', ${slug}, ${ru}, ${en}, ${es}, ${i})
                ON CONFLICT (category, slug) DO NOTHING`;
    }

    // Migration 020: XP system
    await sql`CREATE TABLE IF NOT EXISTS xp_events (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      source TEXT NOT NULL,
      source_ref_id INTEGER,
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_xp_events_user ON xp_events(user_id, created_at DESC)`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_xp INTEGER DEFAULT 0`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS current_level INTEGER DEFAULT 1`;

    // ── PACK 23: Diagnostic form templates ──
    // Templates: a default (owner_user_id NULL) plus per-specialist clones.
    await sql`CREATE TABLE IF NOT EXISTS diagnostic_templates (
      id SERIAL PRIMARY KEY,
      owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Базовая диагностика',
      is_default BOOLEAN DEFAULT false,
      cloned_from INTEGER REFERENCES diagnostic_templates(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_diag_tpl_owner ON diagnostic_templates(owner_user_id)`;

    await sql`CREATE TABLE IF NOT EXISTS diagnostic_items (
      id SERIAL PRIMARY KEY,
      template_id INTEGER REFERENCES diagnostic_templates(id) ON DELETE CASCADE,
      order_idx INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'question',
      response_type TEXT NOT NULL DEFAULT 'text',
      label_ru TEXT NOT NULL DEFAULT '',
      label_en TEXT NOT NULL DEFAULT '',
      label_es TEXT NOT NULL DEFAULT '',
      hint_ru TEXT DEFAULT '',
      hint_en TEXT DEFAULT '',
      hint_es TEXT DEFAULT '',
      options JSONB,
      is_required BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_diag_items_tpl ON diagnostic_items(template_id, order_idx)`;

    await sql`CREATE TABLE IF NOT EXISTS diagnostic_sessions (
      id SERIAL PRIMARY KEY,
      template_id INTEGER REFERENCES diagnostic_templates(id) ON DELETE SET NULL,
      specialist_id UUID REFERENCES users(id) ON DELETE SET NULL,
      client_id UUID REFERENCES users(id) ON DELETE SET NULL,
      client_email TEXT,
      client_name TEXT,
      started_at TIMESTAMP DEFAULT now(),
      completed_at TIMESTAMP,
      responses JSONB,
      notes TEXT
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_diag_sess_specialist ON diagnostic_sessions(specialist_id, started_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_diag_sess_client ON diagnostic_sessions(client_id)`;

    // Seed default template once (only if no defaults exist yet)
    const [hasDefault] = await sql`SELECT id FROM diagnostic_templates WHERE is_default = true LIMIT 1`;
    if (!hasDefault) {
      const [defTpl] = await sql`INSERT INTO diagnostic_templates (owner_user_id, name, is_default)
                                  VALUES (NULL, 'Базовая диагностика', true) RETURNING id`;
      const tplId = defTpl.id;
      // Tahir's 24 questions
      const questions = [
        { ru: 'Имя', en: 'Name', es: 'Nombre', type: 'text' },
        { ru: 'Возраст', en: 'Age', es: 'Edad', type: 'number' },
        { ru: 'Живёте в городе или ближе к природе?', en: 'Live in a city or closer to nature?', es: '¿Vives en la ciudad o más cerca de la naturaleza?', type: 'choice', options: [{ru:'Город',en:'City',es:'Ciudad'},{ru:'Природа',en:'Nature',es:'Naturaleza'},{ru:'Смешанно',en:'Mixed',es:'Mixto'}] },
        { ru: 'Род деятельности', en: 'Occupation', es: 'Ocupación', type: 'text' },
        { ru: 'Оцени по 10-балльной шкале удовлетворённость в настоящем моменте: Работа, Семья, Здоровье, Отдых (не саморазвитие), Друзья, Хобби, Саморазвитие, Духовность (Контакт с собой)', en: 'Rate present-moment satisfaction on a 10-point scale across: Work, Family, Health, Rest (not self-development), Friends, Hobby, Self-development, Spirituality (contact with self)', es: 'Califica del 1 al 10 tu satisfacción actual en: Trabajo, Familia, Salud, Descanso (no autodesarrollo), Amigos, Hobbies, Autodesarrollo, Espiritualidad (contacto contigo mismo)', type: 'scale_grid', options: { rows: [
          {ru:'Работа',en:'Work',es:'Trabajo'},{ru:'Семья',en:'Family',es:'Familia'},{ru:'Здоровье',en:'Health',es:'Salud'},{ru:'Отдых',en:'Rest',es:'Descanso'},{ru:'Друзья',en:'Friends',es:'Amigos'},{ru:'Хобби',en:'Hobby',es:'Hobby'},{ru:'Саморазвитие',en:'Self-development',es:'Autodesarrollo'},{ru:'Духовность',en:'Spirituality',es:'Espiritualidad'}
        ], min: 1, max: 10 } },
        { ru: 'Есть ли хронические заболевания / перенесённые тяжёлые травмы или болезни?', en: 'Any chronic conditions or serious past injuries / illnesses?', es: '¿Enfermedades crónicas o traumas/enfermedades graves pasadas?', type: 'multiline' },
        { ru: 'Есть ли зависимости?', en: 'Any addictions?', es: '¿Tienes adicciones?', type: 'multiline' },
        { ru: 'Есть ли что-то, что вас беспокоит по вашему здоровью / физическому или ментальному состоянию?', en: 'Anything bothering you about your health, physical or mental state?', es: '¿Algo que te preocupe sobre tu salud, estado físico o mental?', type: 'multiline' },
        { ru: 'Как вы считаете, вы пессимист, реалист или оптимист?', en: 'Do you consider yourself a pessimist, realist or optimist?', es: '¿Te consideras pesimista, realista u optimista?', type: 'choice', options: [{ru:'Пессимист',en:'Pessimist',es:'Pesimista'},{ru:'Реалист',en:'Realist',es:'Realista'},{ru:'Оптимист',en:'Optimist',es:'Optimista'}] },
        { ru: 'Сталкивались ли вы с ухудшением когнитивных способностей? Внимание, память, рассеянность, забывчивость', en: 'Have you experienced cognitive decline? Attention, memory, distractibility, forgetfulness', es: '¿Has experimentado deterioro cognitivo? Atención, memoria, distracción, olvidos', type: 'multiline' },
        { ru: 'Много ли стресса в вашей жизни?', en: 'Is there a lot of stress in your life?', es: '¿Hay mucho estrés en tu vida?', type: 'multiline' },
        { ru: 'Считаете себя стрессоустойчивым? Оценка по 10 баллам', en: 'Do you consider yourself stress-resilient? Rate 1–10', es: '¿Te consideras resiliente al estrés? Califica 1-10', type: 'scale', options: { min: 1, max: 10 } },
        { ru: 'Считаете своё повседневное состояние стабильным? (Если нет — что именно нестабильно?)', en: 'Do you consider your daily state stable? (If not — what specifically is unstable?)', es: '¿Consideras tu estado diario estable? (Si no, ¿qué es inestable?)', type: 'multiline' },
        { ru: 'Занимаетесь физической активностью?', en: 'Do you do physical activity?', es: '¿Haces actividad física?', type: 'multiline' },
        { ru: 'Активность ума по 10-балльной шкале', en: 'Mental activity on a 10-point scale', es: 'Actividad mental en una escala de 10', type: 'scale', options: { min: 1, max: 10 } },
        { ru: 'Бывает ли у вас, что вы проснулись уже уставшим?', en: 'Do you ever wake up already tired?', es: '¿Te despiertas ya cansado a veces?', type: 'multiline' },
        { ru: 'Часто ли вы испытываете ощущение тревоги / волнения / беспокойства?', en: 'Do you often feel anxiety / worry / unease?', es: '¿Sientes a menudo ansiedad / preocupación / inquietud?', type: 'multiline' },
        { ru: 'Ваша работа — это то, что вы любите?', en: 'Is your work something you love?', es: '¿Es tu trabajo algo que amas?', type: 'multiline' },
        { ru: 'Вы любите себя?', en: 'Do you love yourself?', es: '¿Te amas a ti mismo?', type: 'multiline' },
        { ru: 'Как вы считаете, вы управляете своей жизнью?', en: 'Do you feel you are in charge of your own life?', es: '¿Sientes que controlas tu vida?', type: 'multiline' },
        { ru: 'Удовлетворены ли своей жизнью?', en: 'Are you satisfied with your life?', es: '¿Estás satisfecho con tu vida?', type: 'multiline' },
        { ru: 'Вы счастливы?', en: 'Are you happy?', es: '¿Eres feliz?', type: 'multiline' },
        { ru: 'Что для вас счастье?', en: 'What does happiness mean to you?', es: '¿Qué es la felicidad para ti?', type: 'multiline' },
        { ru: 'Есть ли у вас мечта?', en: 'Do you have a dream?', es: '¿Tienes un sueño?', type: 'multiline' }
      ];
      // Tahir's 13 tasks
      const tasks = [
        { ru: 'Тест естественного дыхания на минуту (загибайте палец на каждом вдохе и каждом выдохе)', en: 'One-minute natural breathing test (bend a finger on each inhale and each exhale)', es: 'Prueba de respiración natural de un minuto (dobla un dedo en cada inhalación y exhalación)' },
        { ru: 'Дыхание 360 — следим, как расширяются рёбра во все стороны (куда меньше всего расширяются?)', en: '360° breathing — observe how the ribs expand in all directions (where do they expand least?)', es: 'Respiración 360° — observa cómo se expanden las costillas en todas direcciones (¿dónde menos?)' },
        { ru: 'Задержка дыхания на выдохе', en: 'Breath hold after exhale', es: 'Retención de la respiración tras exhalar' },
        { ru: 'Сядьте прямо, вниманием пробегитесь по телу и скажите, где ощущаете основное напряжение / тяжесть / усталость? (Плечи, глаза, затылок, живот, спина и т.д.)', en: 'Sit upright, scan the body with attention and report where you feel the main tension / heaviness / fatigue (Shoulders, eyes, back of head, belly, back, etc.)', es: 'Siéntate erguido, recorre el cuerpo con la atención e indica dónde sientes la tensión / pesadez / fatiga principal (Hombros, ojos, nuca, abdomen, espalda, etc.)' },
        { ru: 'Движение глаз по горизонтали (медленно) — влево, вправо', en: 'Slow horizontal eye movements — left, right', es: 'Movimientos oculares horizontales lentos — izquierda, derecha' },
        { ru: 'Фиксация глаз на одной точке 30 секунд', en: 'Fix eyes on a single point for 30 seconds', es: 'Fija la mirada en un punto durante 30 segundos' },
        { ru: 'Нарисуйте спираль (правой и левой рукой)', en: 'Draw a spiral (with right and left hand)', es: 'Dibuja una espiral (con la mano derecha y la izquierda)' },
        { ru: 'Поворот головы по 8 направлениям (глаза зафиксированы на одной точке)', en: 'Head turns in 8 directions (eyes fixed on one point)', es: 'Giros de cabeza en 8 direcciones (ojos fijos en un punto)' },
        { ru: 'Стоя на одной ноге, носок второй ноги опущен — поворот головы по 8 направлениям', en: 'Standing on one leg with the other toe pointed down — head turns in 8 directions', es: 'De pie sobre una pierna, con la punta del otro pie hacia abajo — gira la cabeza en 8 direcciones' },
        { ru: 'Стоим на одной ноге 30 сек (голову плавно поворачиваем влево-вправо), меняем ногу', en: 'Stand on one leg 30s (smoothly turning the head left–right), switch legs', es: 'De pie sobre una pierna 30 s (girando suavemente la cabeza izquierda-derecha), cambia de pierna' },
        { ru: 'Медленный наклон, округляя позвонок за позвонком, и такой же медленный подъём', en: 'Slow forward bend rolling vertebra by vertebra, and equally slow rise', es: 'Inclinación lenta hacia delante vértebra por vértebra, y subida igualmente lenta' },
        { ru: 'Шаг на месте с закрытыми глазами — 50 шагов', en: 'March in place with eyes closed — 50 steps', es: 'Marcha en el lugar con ojos cerrados — 50 pasos' },
        { ru: 'Дополнительное наблюдение специалиста', en: 'Additional specialist observation', es: 'Observación adicional del especialista' }
      ];
      let idx = 0;
      for (const q of questions) {
        await sql`INSERT INTO diagnostic_items (template_id, order_idx, kind, response_type, label_ru, label_en, label_es, options)
                  VALUES (${tplId}, ${idx}, 'question', ${q.type}, ${q.ru}, ${q.en}, ${q.es}, ${q.options ? JSON.stringify(q.options) : null})`;
        idx++;
      }
      for (const t of tasks) {
        await sql`INSERT INTO diagnostic_items (template_id, order_idx, kind, response_type, label_ru, label_en, label_es)
                  VALUES (${tplId}, ${idx}, 'task', 'multiline', ${t.ru}, ${t.en}, ${t.es})`;
        idx++;
      }
      console.log('Seeded default diagnostic template id=' + tplId + ' with ' + idx + ' items');
    }

    // ── PACK 24: Course Constructor ──
    await sql`CREATE TABLE IF NOT EXISTS courses (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name_ru TEXT NOT NULL DEFAULT '',
      name_en TEXT NOT NULL DEFAULT '',
      name_es TEXT NOT NULL DEFAULT '',
      description_ru TEXT DEFAULT '',
      description_en TEXT DEFAULT '',
      description_es TEXT DEFAULT '',
      cover_url TEXT DEFAULT '',
      program_access TEXT[] DEFAULT '{}',
      is_published BOOLEAN DEFAULT FALSE,
      order_idx INTEGER DEFAULT 0,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(is_published, order_idx)`;

    // ── Tool access (017): tools catalogue + per-course grants ──
    await sql`CREATE TABLE IF NOT EXISTS tools (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name_ru TEXT, name_en TEXT, name_es TEXT,
      description_ru TEXT, description_en TEXT, description_es TEXT,
      icon_url TEXT,
      is_free_default BOOLEAN DEFAULT FALSE,
      order_idx INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS course_tools (
      course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
      tool_id INTEGER REFERENCES tools(id) ON DELETE CASCADE,
      PRIMARY KEY (course_id, tool_id)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_course_tools_tool ON course_tools(tool_id)`;
    // Seed catalogue — existing tools free (no behaviour change); anatomy gated.
    await sql`INSERT INTO tools (code, name_ru, name_en, name_es, description_ru, description_en, description_es, is_free_default, order_idx) VALUES
      ('neuromap','NeuroMap','NeuroMap','NeuroMap','Граф ваших состояний и связей.','Graph of your states and links.','Grafo de tus estados y enlaces.',TRUE,1),
      ('sensation-map','Карта ощущений','Sensation Map','Mapa de sensaciones','Где и что вы чувствуете в теле.','Where and what you feel in the body.','Dónde y qué sientes en el cuerpo.',TRUE,2),
      ('diary','Дневник','Diary','Diario','Дневник нейроресурса.','Neuro-resource diary.','Diario de neurorrecurso.',TRUE,3),
      ('point-ab','Точка А → B','Point A → B','Punto A → B','Карта перехода из точки А в точку B.','Map your shift from point A to B.','Mapa de tu cambio de A a B.',TRUE,4),
      ('external-field','External Field','External Field','External Field','Объективные сигналы внешней среды.','Objective environmental signals.','Señales objetivas del entorno.',TRUE,5),
      ('evolution-path','Путь развития','Evolution Path','Camino de evolución','Ваш персональный путь развития.','Your personal evolution path.','Tu camino de evolución personal.',TRUE,6)
      ON CONFLICT (code) DO NOTHING`;
    // NOTE: legacy 'anatomy-atlas' is intentionally NOT seeded here — it is renamed
    // to 'human-atlas' below (id/grants preserved) and the canonical 'human-atlas'
    // row is inserted right after. Re-seeding it made the runner non-idempotent:
    // on re-run it re-created 'anatomy-atlas', then the rename below collided with
    // the existing 'human-atlas' (duplicate key) and aborted every later migration.
    // PACK F: consolidate into ONE tool "Human Atlas" with 3 in-app tabs
    // (Anatomy / Human Functions / Conditions). Rename the existing anatomy-atlas
    // in place (id preserved → course grants survive); never a separate tool.
    await sql`UPDATE tools SET code = 'human-atlas',
      name_ru = 'Атлас человека', name_en = 'Human Atlas', name_es = 'Atlas humano',
      description_ru = 'Единый 3D-атлас: анатомия, функции человека и состояния.',
      description_en = 'Unified 3D atlas: anatomy, human functions and conditions.',
      description_es = 'Atlas 3D unificado: anatomia, funciones humanas y estados.'
      WHERE code = 'anatomy-atlas' AND NOT EXISTS (SELECT 1 FROM tools WHERE code = 'human-atlas')`;
    await sql`INSERT INTO tools (code, name_ru, name_en, name_es, description_ru, description_en, description_es, is_free_default, order_idx) VALUES
      ('human-atlas','Атлас человека','Human Atlas','Atlas humano','Единый 3D-атлас: анатомия, функции человека и состояния.','Unified 3D atlas: anatomy, human functions and conditions.','Atlas 3D unificado: anatomia, funciones humanas y estados.',FALSE,7)
      ON CONFLICT (code) DO NOTHING`;
    // Clean up any stray 'anatomy-atlas' a previous non-idempotent run may have
    // re-inserted (it carries no course grants — those live on the renamed
    // 'human-atlas' row). Only ever runs when 'human-atlas' already exists.
    await sql`DELETE FROM tools WHERE code = 'anatomy-atlas' AND EXISTS (SELECT 1 FROM tools WHERE code = 'human-atlas')`;

    // PACK F1 / B9: Body-Functions library + region relations + named circuits.
    // Tables created on boot; the rich seed lives in migrations/018 (run via the
    // migration runner). Mirrors how anatomy-atlas was introduced.
    await sql`CREATE TABLE IF NOT EXISTS anatomy_circuits (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL, name_ru TEXT, name_es TEXT,
      description_en TEXT, description_ru TEXT, description_es TEXT,
      region_ids TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS anatomy_region_relations (
      id SERIAL PRIMARY KEY,
      region_a TEXT NOT NULL, region_b TEXT NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'functional',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (region_a, region_b, relation_type)
    )`;
    await sql`CREATE TABLE IF NOT EXISTS anatomy_functions (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL, name_ru TEXT, name_es TEXT,
      description_en TEXT NOT NULL, description_ru TEXT, description_es TEXT,
      category TEXT,
      region_ids TEXT[] NOT NULL DEFAULT '{}',
      circuit_ids INTEGER[] DEFAULT '{}',
      tags TEXT[] DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_anatomy_functions_slug ON anatomy_functions(slug)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_anatomy_functions_tags ON anatomy_functions USING GIN(tags)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_anatomy_functions_cat ON anatomy_functions(category)`;

    // ── Migration 021: Pregnancy as an anatomy_function (Phase 1, reproductive) ──
    //    Mirrors migrations/021_pregnancy_function.sql. region_ids use real SEED ids so
    //    focusRegions highlights the meshes (female_reproductive + placenta + endocrine).
    //    Idempotent: insert-if-missing, then refresh region_ids/category on re-run.
    try {
      await sql`INSERT INTO anatomy_functions (slug, name_en, name_ru, name_es, description_en, description_ru, description_es, category, region_ids, tags)
        VALUES ('pregnancy', 'Pregnancy', 'Беременность', 'Embarazo',
          'The physiological process of fetal development in the womb, accompanied by changes across the reproductive, endocrine and metabolic systems.',
          'Физиологический процесс развития плода в материнской утробе, сопровождается изменениями репродуктивной, эндокринной и метаболической систем.',
          'El proceso fisiologico de desarrollo del feto en el utero, acompanado de cambios en los sistemas reproductivo, endocrino y metabolico.',
          'reproductive',
          ARRAY['uterus','placenta','ovaries','breasts','hypothalamus','pituitary','thyroid-gland','cervix']::text[],
          ARRAY['pregnancy','gestation','beremennost','embarazo']::text[])
        ON CONFLICT (slug) DO NOTHING`;
      await sql`UPDATE anatomy_functions SET region_ids = ARRAY['uterus','placenta','ovaries','breasts','hypothalamus','pituitary','thyroid-gland','cervix']::text[], category = 'reproductive' WHERE slug = 'pregnancy'`;
    } catch (e) { console.error('migration 021 (pregnancy function):', e.message); }

    // ── Migration 022: Family & Team (Phase 2A) ── mirrors
    //    migrations/022_family_dependents.sql. Families/teams already live in the
    //    `teams` table (kind='family'/'team'); here we add only the new pieces:
    //    dependent_profiles (non-user children), team_invites (join-by-link tokens),
    //    and journey_events.dependent_id (so events can be attributed to a dependent).
    //    Idempotent. Wrapped so a fresh DB without `teams` yet never aborts the run.
    try {
      await sql`CREATE TABLE IF NOT EXISTS dependent_profiles (
        id BIGSERIAL PRIMARY KEY,
        owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        family_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        sex TEXT,
        birth_date DATE,
        expected_due_date DATE,
        track_from DATE,
        relation TEXT,
        diagnoses_ids INTEGER[] DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        deleted_at TIMESTAMPTZ,
        CONSTRAINT dependent_has_date CHECK (birth_date IS NOT NULL OR expected_due_date IS NOT NULL)
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_dependents_owner ON dependent_profiles(owner_user_id) WHERE deleted_at IS NULL`;
      await sql`CREATE INDEX IF NOT EXISTS idx_dependents_family ON dependent_profiles(family_id)`;
      await sql`CREATE TABLE IF NOT EXISTS team_invites (
        token TEXT PRIMARY KEY,
        team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        role TEXT DEFAULT 'member',
        max_uses INTEGER,
        use_count INTEGER NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_team_invites_team ON team_invites(team_id)`;
      await sql`ALTER TABLE journey_events ADD COLUMN IF NOT EXISTS dependent_id BIGINT`;
      await sql`CREATE INDEX IF NOT EXISTS idx_journey_events_dependent ON journey_events(dependent_id) WHERE dependent_id IS NOT NULL`;
    } catch (e) { console.error('migration 022 (family/dependents):', e.message); }

    // Conditions / states (internal field) — tab 3 of Human Atlas.
    await sql`CREATE TABLE IF NOT EXISTS human_conditions (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name_en TEXT NOT NULL, name_ru TEXT, name_es TEXT,
      category TEXT,
      description_en TEXT, description_ru TEXT, description_es TEXT,
      affected_region_ids TEXT[] NOT NULL DEFAULT '{}',
      affected_function_ids INTEGER[] DEFAULT '{}',
      impact_summary_en TEXT, impact_summary_ru TEXT, impact_summary_es TEXT,
      recommendations_en TEXT, recommendations_ru TEXT, recommendations_es TEXT,
      is_neurodevelopmental BOOLEAN DEFAULT FALSE,
      severity_default TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_human_conditions_slug ON human_conditions(slug)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_human_conditions_cat ON human_conditions(category)`;

    // (Migration 019 anatomy-seed fixes moved to the TOP of this runner — a
    //  pre-existing tools rename below throws a duplicate-key on re-run and aborts
    //  everything after it, so the fixes must run before that point.)

    await sql`CREATE TABLE IF NOT EXISTS course_blocks (
      id SERIAL PRIMARY KEY,
      course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
      order_idx INTEGER NOT NULL DEFAULT 0,
      block_type TEXT NOT NULL,
      title_ru TEXT DEFAULT '',
      title_en TEXT DEFAULT '',
      title_es TEXT DEFAULT '',
      payload JSONB DEFAULT '{}'::jsonb,
      points INTEGER DEFAULT 0,
      unlock_condition JSONB,
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_course_blocks_course ON course_blocks(course_id, order_idx)`;

    await sql`CREATE TABLE IF NOT EXISTS course_branches (
      id SERIAL PRIMARY KEY,
      block_id INTEGER REFERENCES course_blocks(id) ON DELETE CASCADE,
      answer_key TEXT NOT NULL,
      next_block_id INTEGER REFERENCES course_blocks(id) ON DELETE SET NULL,
      label_ru TEXT DEFAULT '',
      label_en TEXT DEFAULT '',
      label_es TEXT DEFAULT ''
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_course_branches_block ON course_branches(block_id)`;

    await sql`CREATE TABLE IF NOT EXISTS course_assets (
      id SERIAL PRIMARY KEY,
      course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      github_url TEXT NOT NULL,
      size_bytes INTEGER DEFAULT 0,
      uploaded_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_course_assets_course ON course_assets(course_id)`;

    // Per-block completion progress for Pack 24 (distinct from legacy course_progress
    // which is keyed by item_type/item_id). Renamed to avoid colliding with the
    // older course_progress schema in migration 006.
    await sql`CREATE TABLE IF NOT EXISTS course_block_progress (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
      block_id INTEGER REFERENCES course_blocks(id) ON DELETE CASCADE,
      response JSONB,
      points_earned INTEGER DEFAULT 0,
      completed_at TIMESTAMP DEFAULT now(),
      UNIQUE(user_id, block_id)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_course_block_progress_user_course ON course_block_progress(user_id, course_id)`;

    // ── PACK 25: DOMunity (community layer) ──
    // Profile privacy + notification preferences
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_public BOOLEAN DEFAULT true`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT ''`;

    // 1:1 direct message threads
    await sql`CREATE TABLE IF NOT EXISTS dm_threads (
      id SERIAL PRIMARY KEY,
      user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      last_message_at TIMESTAMP DEFAULT now(),
      created_at TIMESTAMP DEFAULT now(),
      UNIQUE(user_a, user_b)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_dm_threads_users ON dm_threads(user_a, user_b)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_dm_threads_b ON dm_threads(user_b)`;

    await sql`CREATE TABLE IF NOT EXISTS dm_messages (
      id SERIAL PRIMARY KEY,
      thread_id INTEGER NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      body TEXT NOT NULL DEFAULT '',
      attachments JSONB DEFAULT '[]'::jsonb,
      read_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_dm_messages_thread ON dm_messages(thread_id, created_at)`;

    // Group chat rooms (created by admins; can be tied to a course cohort)
    await sql`CREATE TABLE IF NOT EXISTS chat_rooms (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      cover_url TEXT DEFAULT '',
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_chat_rooms_course ON chat_rooms(course_id)`;

    await sql`CREATE TABLE IF NOT EXISTS chat_room_members (
      room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member',
      joined_at TIMESTAMP DEFAULT now(),
      PRIMARY KEY(room_id, user_id)
    )`;

    await sql`CREATE TABLE IF NOT EXISTS chat_room_messages (
      id SERIAL PRIMARY KEY,
      room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
      sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
      body TEXT NOT NULL DEFAULT '',
      attachments JSONB DEFAULT '[]'::jsonb,
      is_announcement BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_chat_room_messages_room ON chat_room_messages(room_id, created_at)`;

    // News feed (admin posts visible to all logged-in users)
    await sql`CREATE TABLE IF NOT EXISTS feed_posts (
      id SERIAL PRIMARY KEY,
      author_id UUID REFERENCES users(id) ON DELETE SET NULL,
      title TEXT DEFAULT '',
      body TEXT NOT NULL,
      cover_url TEXT DEFAULT '',
      attachments JSONB DEFAULT '[]'::jsonb,
      is_pinned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_feed_posts_created ON feed_posts(created_at DESC)`;

    await sql`CREATE TABLE IF NOT EXISTS feed_reactions (
      id SERIAL PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL DEFAULT '❤',
      created_at TIMESTAMP DEFAULT now(),
      UNIQUE(target_type, target_id, user_id, emoji)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_feed_reactions_target ON feed_reactions(target_type, target_id)`;

    await sql`CREATE TABLE IF NOT EXISTS feed_comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
      parent_id INTEGER REFERENCES feed_comments(id) ON DELETE CASCADE,
      author_id UUID REFERENCES users(id) ON DELETE SET NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_feed_comments_post ON feed_comments(post_id, created_at)`;

    // Notifications inbox
    await sql`CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      payload JSONB DEFAULT '{}'::jsonb,
      seen_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_notifications_user_unseen ON notifications(user_id, seen_at, created_at DESC)`;

    // Joint practice invites
    await sql`CREATE TABLE IF NOT EXISTS joint_practice_sessions (
      id SERIAL PRIMARY KEY,
      host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      practice_id INTEGER,
      course_block_id INTEGER REFERENCES course_blocks(id) ON DELETE SET NULL,
      scheduled_at TIMESTAMP,
      status TEXT DEFAULT 'planned',
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS joint_practice_participants (
      session_id INTEGER REFERENCES joint_practice_sessions(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMP DEFAULT now(),
      PRIMARY KEY(session_id, user_id)
    )`;

    // Donations
    await sql`CREATE TABLE IF NOT EXISTS donations (
      id SERIAL PRIMARY KEY,
      donor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT DEFAULT 'usd',
      stripe_session_id TEXT,
      stripe_payment_intent_id TEXT,
      message TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT now()
    )`;

    // ── PACK 26: Achievements / XP badges ──
    await sql`CREATE TABLE IF NOT EXISTS achievements (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title_ru TEXT NOT NULL DEFAULT '',
      title_en TEXT NOT NULL DEFAULT '',
      title_es TEXT NOT NULL DEFAULT '',
      description_ru TEXT DEFAULT '',
      description_en TEXT DEFAULT '',
      description_es TEXT DEFAULT '',
      badge_emoji TEXT DEFAULT '🏅',
      xp_reward INTEGER DEFAULT 0,
      condition_kind TEXT DEFAULT 'manual',
      condition_value JSONB,
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS user_achievements (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
      earned_at TIMESTAMP DEFAULT now(),
      UNIQUE(user_id, achievement_id)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id, earned_at DESC)`;
    await sql`INSERT INTO achievements (slug, title_ru, title_en, title_es, description_ru, description_en, description_es, badge_emoji, xp_reward, condition_kind)
      VALUES
        ('first_steps', 'Первые шаги', 'First Steps', 'Primeros pasos', 'Завершите первый блок любого курса.', 'Complete your first block of any course.', 'Completa tu primer bloque.', '🌱', 50, 'first_block'),
        ('course_done', 'Курс пройден', 'Course Completed', 'Curso completado', 'Завершите курс целиком.', 'Finish a course in full.', 'Finaliza un curso completo.', '🎓', 250, 'course_done'),
        ('focused_streak', 'Поток внимания', 'Focus Streak', 'Racha de enfoque', 'Завершите 7 блоков подряд за неделю.', 'Complete 7 blocks within a week.', 'Completa 7 bloques en una semana.', '⚡', 150, 'weekly_streak'),
        ('first_donation', 'Поддержавший', 'Supporter', 'Quien apoya', 'Сделайте первое пожертвование лаборатории.', 'Make your first donation to the lab.', 'Realiza tu primera donación.', '💛', 100, 'first_donation')
      ON CONFLICT (slug) DO NOTHING`;

    await sql`CREATE TABLE IF NOT EXISTS joint_practice_messages (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES joint_practice_sessions(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      kind TEXT DEFAULT 'text',
      body TEXT DEFAULT '',
      emoji TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_jpm_session ON joint_practice_messages(session_id, created_at)`;

    // Pack 25 phase 3: live-stream toggle on group rooms, join/leave timestamps for joint practice
    await sql`ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS live_started_at TIMESTAMP`;
    await sql`ALTER TABLE joint_practice_participants ADD COLUMN IF NOT EXISTS left_at TIMESTAMP`;
    await sql`ALTER TABLE joint_practice_participants ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT now()`;

    // Pack 28: per-kind notification mute + admin-author flag on achievements + LIVE room signaling table
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_mute TEXT[] DEFAULT '{}'`;
    await sql`ALTER TABLE achievements ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id) ON DELETE SET NULL`;
    // Simple WebRTC signaling table — peers POST offers/answers/ice candidates; viewers GET pending ones for them
    await sql`CREATE TABLE IF NOT EXISTS rtc_signals (
      id SERIAL PRIMARY KEY,
      room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
      from_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_id UUID REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_rtc_signals_to ON rtc_signals(room_id, to_id, created_at DESC)`;

    // Pack 27.1: stream recordings
    await sql`CREATE TABLE IF NOT EXISTS room_recordings (
      id SERIAL PRIMARY KEY,
      room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
      recorder_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      url TEXT NOT NULL,
      filename TEXT NOT NULL DEFAULT 'recording.webm',
      mime_type TEXT DEFAULT 'video/webm',
      size_bytes BIGINT DEFAULT 0,
      duration_seconds INTEGER DEFAULT 0,
      has_overlay BOOLEAN DEFAULT FALSE,
      has_video BOOLEAN DEFAULT TRUE,
      started_at TIMESTAMP,
      ended_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_room_recordings_room ON room_recordings(room_id, created_at DESC)`;

    // Pack 24 follow-up: per-language gating on courses
    // Empty array (default) = available in all languages of the site.
    // Specific values like ['ru'] = only shown when site lang is RU.
    await sql`ALTER TABLE courses ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}'`;

    // Pack 24 v2: two-level structure (section → child items)
    // parent_block_id IS NULL → top-level section or stand-alone item
    // parent_block_id INTEGER → child item inside that section
    // block_type='section' is just a container with a multilingual title.
    await sql`ALTER TABLE course_blocks ADD COLUMN IF NOT EXISTS parent_block_id INTEGER REFERENCES course_blocks(id) ON DELETE CASCADE`;
    await sql`CREATE INDEX IF NOT EXISTS idx_course_blocks_parent ON course_blocks(parent_block_id)`;

    // 🅱 tool_task blocks: a course step that embeds one of the instruments
    // (sensation map / point A→B / diary / neuromap-emotion|event|thought).
    // tool_kind selects the instrument; tool_config carries per-task parameters.
    await sql`ALTER TABLE course_blocks ADD COLUMN IF NOT EXISTS tool_kind TEXT`;
    await sql`ALTER TABLE course_blocks ADD COLUMN IF NOT EXISTS tool_config JSONB DEFAULT '{}'::jsonb`;
    // Migrate legacy sensation-request blocks (feeling_request / sensation_prompt)
    // into the unified tool_task model. Idempotent — only touches untouched rows.
    await sql`UPDATE course_blocks
      SET block_type = 'tool_task', tool_kind = 'sensation_map'
      WHERE block_type IN ('feeling_request', 'sensation_prompt') AND tool_kind IS NULL`;

    // Pack 30: Teams (small groups within the community, owner-configurable broadcasts)
    await sql`CREATE TABLE IF NOT EXISTS teams (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      broadcast_kinds TEXT[] DEFAULT '{block_done,course_done,achievement_earned}',
      is_public BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_user_id)`;
    await sql`CREATE TABLE IF NOT EXISTS team_members (
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member',
      joined_at TIMESTAMP DEFAULT now(),
      PRIMARY KEY (team_id, user_id)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id)`;
    // PR7: team kind — 'team' (default) or 'family' (members carry a kin role).
    await sql`ALTER TABLE teams ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'team'`;

    // PR7: simple key/value system settings (e.g. collective_path_published).
    await sql`CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMP DEFAULT now()
    )`;

    // Pack 31: «Мицелий сознания» foundation tables — universal journey
    // events log + links + global cycles. UI layers consume these in
    // future iterations; for now they exist so we don't have to refactor
    // when the visualization expands.
    await sql`CREATE TABLE IF NOT EXISTS journey_events (
      id BIGSERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,                -- block_done, achievement, emotion_note, sensation_note,
                                         -- life_event, neuromap_node, macro_anchor, etc.
      layer TEXT NOT NULL DEFAULT 'practice',
      payload JSONB DEFAULT '{}'::jsonb,
      occurred_at TIMESTAMP DEFAULT now(),
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_journey_events_user_time ON journey_events(user_id, occurred_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_journey_events_kind ON journey_events(kind, occurred_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_journey_events_layer ON journey_events(layer, occurred_at DESC)`;

    await sql`CREATE TABLE IF NOT EXISTS journey_links (
      id BIGSERIAL PRIMARY KEY,
      event_a BIGINT NOT NULL REFERENCES journey_events(id) ON DELETE CASCADE,
      event_b BIGINT NOT NULL REFERENCES journey_events(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,                -- sequence, correlation, cross_user, macro_anchor
      weight REAL DEFAULT 1.0,
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_journey_links_a ON journey_links(event_a)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_journey_links_b ON journey_links(event_b)`;

    await sql`CREATE TABLE IF NOT EXISTS cycles (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      kind TEXT NOT NULL,                -- astro, lunar, holiday, geomag, economic
      name TEXT NOT NULL,
      occurred_at TIMESTAMP NOT NULL,
      payload JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cycles_time ON cycles(occurred_at)`;

    // ── Migration 034 (PR94 #10): backfill type='sensation' nm_nodes from existing
    //    sensation journey_events. Before PR94 only body-location 'area' nodes were
    //    created, so the standalone NeuroMap "Ощущения" layer (1) was empty for ALL
    //    historical data — this populates it. Idempotent (ON CONFLICT, no count++ on
    //    re-run). Links each sensation to the body-location 'area' nodes recorded in
    //    the SAME event (matched by normalized label). try/catch — never aborts.
    try {
      const sensEvents = await sql`
        SELECT user_id, occurred_at, payload FROM journey_events
        WHERE kind = 'sensation' AND payload ? 'sensation_labels'`;
      let made = 0;
      for (const ev of sensEvents) {
        const p = ev.payload || {};
        const labels = Array.isArray(p.sensation_labels) ? p.sensation_labels.filter(Boolean) : [];
        const locs = Array.isArray(p.body_locations) ? p.body_locations.filter(Boolean) : [];
        if (!labels.length) continue;
        const when = ev.occurred_at ? new Date(ev.occurred_at) : new Date();
        const sensIds = [];
        for (const lbl of labels) {
          const norm = normalizeLabel(lbl);
          const r = await sql`
            INSERT INTO nm_nodes (user_id, type, label, normalized_label, valence, count, last_seen_at, metadata)
            VALUES (${ev.user_id}, 'sensation', ${lbl}, ${norm}, 'neutral', 1, ${when.toISOString()},
                    ${JSON.stringify({ source: 'sensation', backfill: true })}::jsonb)
            ON CONFLICT (user_id, type, normalized_label, valence)
            DO UPDATE SET last_seen_at = GREATEST(nm_nodes.last_seen_at, ${when.toISOString()})
            RETURNING id`;
          if (r[0]) { sensIds.push(r[0].id); made++; }
        }
        if (sensIds.length && locs.length) {
          const locNorms = locs.map(l => normalizeLabel(l));
          const areaRows = await sql`
            SELECT id FROM nm_nodes WHERE user_id = ${ev.user_id} AND type = 'area'
              AND normalized_label = ANY(${locNorms}::text[])`;
          for (const sid of sensIds) for (const a of areaRows) {
            await sql`INSERT INTO nm_links (user_id, from_node_id, to_node_id, count, last_seen_at)
                      VALUES (${ev.user_id}, ${sid}, ${a.id}, 1, ${when.toISOString()})
                      ON CONFLICT (user_id, from_node_id, to_node_id) DO NOTHING`;
          }
        }
      }
      console.log('migration 034 (sensation node backfill): processed', sensEvents.length, 'events,', made, 'sensation nodes');
    } catch (e) { console.error('migration 034 (sensation node backfill):', e.message); }

    res.json({ ok: true, message: 'Migrations 003-034 applied successfully' });
  } catch (err) {
    console.error('Migration error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── AUTH MIDDLEWARE ──

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  const token = authHeader.slice(7);

  // MONAD read-only: only GET, mapped to a privileged read principal
  if (MONAD_READONLY_TOKEN && token === MONAD_READONLY_TOKEN) {
    if (req.method !== 'GET') {
      return res.status(403).json({ error: 'MONAD token is read-only' });
    }
    const principal = await getMonadPrincipal();
    if (!principal) return res.status(503).json({ error: 'No admin principal' });
    req.user = { id: principal.id, email: principal.email };
    req.monadReadonly = true;
    return next();
  }

  try {
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
    let { email, password, display_name, phone, country, city, location_lat, location_lon } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    // PR4 (4.4): residence is required at registration so External Field has a
    // location immediately. Coordinates come from the city autocomplete (Open-Meteo).
    const lat = (location_lat != null && !isNaN(parseFloat(location_lat))) ? parseFloat(location_lat) : null;
    const lon = (location_lon != null && !isNaN(parseFloat(location_lon))) ? parseFloat(location_lon) : null;
    country = country ? String(country).trim().slice(0, 80) : null;
    city = city ? String(city).trim().slice(0, 120) : null;
    if (!country || !city || lat == null || lon == null) {
      return res.status(400).json({ error: 'Country, city and coordinates are required' });
    }

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
      INSERT INTO users (email, password_hash, display_name, phone, role, location_country, location_city, location_lat, location_lon)
      VALUES (${email}, ${passwordHash}, ${display_name || null}, ${phone || null}, ${role}, ${country}, ${city}, ${lat}, ${lon})
      RETURNING id, email, display_name, phone, role, created_at, location_country, location_city, location_lat, location_lon
    `;
    const user = inserted[0];
    const token = signToken(user);

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, display_name: user.display_name, phone: user.phone, role: user.role, avatar_url: null,
              location_country: user.location_country, location_city: user.location_city, location_lat: user.location_lat, location_lon: user.location_lon }
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
      SELECT id, email, display_name, phone, role, created_at, last_login_at, avatar_url,
             location_lat, location_lon, location_city, location_country
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
    const validItems = []; // chain items that produced a node, aligned 1:1 with nodeIds
    const seenNodes = new Set(); // deduplicate: only increment count once per unique node per call
    // Optional backdating: caller may pass occurred_at (ISO) to log this chain in the past.
    const occurredAt = req.body && req.body.occurred_at ? req.body.occurred_at : null;

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
      validItems.push(item);
    }

    // 1b. Journey log (Pack 31.5): one journey_event per chain node so the
    // Evolution Path timeline gets a real, time-accurate, clickable point for
    // every emotion / thought / sensation / event the user just added. Links
    // between consecutive nodes are mirrored into journey_links.
    const journeyIds = [];
    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i];
      const { kind, layer } = nmTypeToJourney(it.type);
      const jid = await logJourney(userId, kind, layer, {
        label: it.label,
        valence: it.valence || 'neutral',
        nm_node_id: nodeIds[i],
        nm_type: it.type,
        source: 'neuromap',
        coords: (it.metadata && it.metadata.coords) || null
      }, occurredAt);
      journeyIds.push(jid);
    }
    for (let i = 0; i < journeyIds.length - 1; i++) {
      await linkJourney(journeyIds[i], journeyIds[i + 1], 'sequence', 1.0);
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

    res.json({ ok: true, node_ids: nodeIds, journey_ids: journeyIds, links: linkResults });
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
    // Journey log (Pack 31.5): a diary note becomes an insight point on the
    // Evolution Path. occurred_at honours the user-chosen date_key (+ time) so a
    // back-dated entry lands on the right day, not "now".
    const occAt = date_key ? (date_key + (time && /^\d{2}:\d{2}/.test(time) ? 'T' + time : 'T12:00')) : null;
    const valence = (plus_count || 0) > (minus_count || 0) ? 'positive'
                  : ((minus_count || 0) > (plus_count || 0) ? 'negative' : 'neutral');
    const jid = await logJourney(req.user.id, 'insight', 'insight', {
      text: String(text).slice(0, 280), comment: comment || '',
      plus_count: plus_count || 0, minus_count: minus_count || 0,
      valence, date_key, diary_id: rows[0].id, source: 'diary'
    }, occAt);
    res.json({ ok: true, id: rows[0].id, date_key: rows[0].date_key, journey_id: jid });
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
// ── Soft-delete: superadmin marks a user deleted; a cron hard-deletes after 1h,
// during which it can be restored from the Trash. ──
async function requireSuperadmin(req, res) {
  const caller = await sql`SELECT id, role FROM users WHERE id = ${req.user.id}`;
  if (!caller.length || caller[0].role !== 'superadmin') { res.status(403).json({ error: 'Forbidden' }); return null; }
  return caller[0];
}
// Cascade hard-delete of one user's data + the row. Best-effort per table so a
// missing table never aborts the whole purge. Used by the cron after 1h.
async function hardDeleteUser(userId) {
  const del = async (p) => { try { await p; } catch (e) {} };
  await del(sql`DELETE FROM nm_links WHERE user_id = ${userId}`);
  await del(sql`DELETE FROM nm_nodes WHERE user_id = ${userId}`);
  await del(sql`DELETE FROM neuro_map_entries WHERE user_id = ${userId}`);
  await del(sql`DELETE FROM neuro_resource_diary WHERE user_id = ${userId}`);
  await del(sql`DELETE FROM calendar_events WHERE user_id = ${userId}`);
  await del(sql`DELETE FROM course_progress WHERE user_id = ${userId}`);
  await del(sql`DELETE FROM course_block_progress WHERE user_id = ${userId}`);
  await del(sql`DELETE FROM journey_events WHERE user_id = ${userId}`);
  await del(sql`DELETE FROM team_members WHERE user_id = ${userId}`);
  await del(sql`DELETE FROM external_field_subscriptions WHERE user_id = ${userId}`);
  await del(sql`DELETE FROM external_field_notifications WHERE user_id = ${userId}`);
  await del(sql`DELETE FROM external_signal_events WHERE user_id = ${userId}`);
  await del(sql`DELETE FROM test_results WHERE user_id = ${userId}`);
  await del(sql`DELETE FROM password_resets WHERE user_id = ${userId}`);
  // teams this user owned: hand leadership to the earliest other member, else delete the team
  try {
    const owned = await sql`SELECT id FROM teams WHERE owner_user_id = ${userId}`;
    for (const t of owned) {
      const [next] = await sql`SELECT user_id FROM team_members WHERE team_id = ${t.id} AND user_id <> ${userId} ORDER BY joined_at ASC LIMIT 1`;
      if (next) await sql`UPDATE teams SET owner_user_id = ${next.user_id} WHERE id = ${t.id}`;
      else await sql`DELETE FROM teams WHERE id = ${t.id}`;
    }
  } catch (e) {}
  await sql`DELETE FROM users WHERE id = ${userId}`;
}
// POST /api/admin/users/:id/soft-delete { confirm_email } — superadmin only.
app.post('/api/admin/users/:id/soft-delete', requireAuth, async (req, res) => {
  try {
    const caller = await requireSuperadmin(req, res); if (!caller) return;
    const targetId = req.params.id;
    if (String(targetId) === String(caller.id)) return res.status(400).json({ error: 'Cannot delete yourself' });
    const [target] = await sql`SELECT id, email, role, deleted_at FROM users WHERE id = ${targetId}`;
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'superadmin') return res.status(400).json({ error: 'Cannot delete another superadmin' });
    const confirm = String((req.body && req.body.confirm_email) || '').trim().toLowerCase();
    if (!confirm || confirm !== String(target.email || '').toLowerCase()) return res.status(400).json({ error: 'Confirmation email does not match' });
    const [u] = await sql`UPDATE users SET deleted_at = now() WHERE id = ${targetId} RETURNING deleted_at`;
    try { await sql`INSERT INTO audit_log (actor_user_id, action, target_user_id, detail) VALUES (${caller.id}, 'user.soft_delete', ${targetId}, ${JSON.stringify({ email: target.email })}::jsonb)`; } catch (e) {}
    res.json({ success: true, deleted_at: u.deleted_at });
  } catch (err) { console.error('soft-delete:', err); res.status(500).json({ error: 'Internal error' }); }
});
// POST /api/admin/cleanup-test-users — superadmin only. Soft-deletes every
// non-superadmin user whose email ends in @test.local (QA throwaways the
// verification harness registers). Idempotent; the 1h cron then hard-deletes.
app.post('/api/admin/cleanup-test-users', requireAuth, async (req, res) => {
  try {
    const caller = await requireSuperadmin(req, res); if (!caller) return;
    const rows = await sql`UPDATE users SET deleted_at = now()
      WHERE lower(email) LIKE '%@test.local'
        AND role <> 'superadmin'
        AND id <> ${caller.id}
        AND deleted_at IS NULL
      RETURNING id, email`;
    try { await sql`INSERT INTO audit_log (actor_user_id, action, target_user_id, detail) VALUES (${caller.id}, 'user.cleanup_test', NULL, ${JSON.stringify({ count: rows.length, emails: rows.map(r => r.email) })}::jsonb)`; } catch (e) {}
    res.json({ success: true, soft_deleted: rows.length, emails: rows.map(r => r.email) });
  } catch (err) { console.error('cleanup-test-users:', err); res.status(500).json({ error: 'Internal error' }); }
});
// POST /api/admin/users/:id/restore — only within the 1h grace window.
app.post('/api/admin/users/:id/restore', requireAuth, async (req, res) => {
  try {
    const caller = await requireSuperadmin(req, res); if (!caller) return;
    const [target] = await sql`SELECT id, deleted_at FROM users WHERE id = ${req.params.id}`;
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (!target.deleted_at) return res.json({ success: true });   // already active
    if (new Date(target.deleted_at).getTime() < Date.now() - 60 * 60 * 1000) return res.status(410).json({ error: 'Grace window expired' });
    await sql`UPDATE users SET deleted_at = NULL WHERE id = ${req.params.id}`;
    try { await sql`INSERT INTO audit_log (actor_user_id, action, target_user_id) VALUES (${caller.id}, 'user.restore', ${req.params.id})`; } catch (e) {}
    res.json({ success: true });
  } catch (err) { console.error('restore:', err); res.status(500).json({ error: 'Internal error' }); }
});
// GET /api/admin/users/trash — soft-deleted users still in the 1h grace window.
app.get('/api/admin/users/trash', requireAuth, async (req, res) => {
  try {
    const caller = await requireSuperadmin(req, res); if (!caller) return;
    const rows = await sql`SELECT id, email, display_name, role, deleted_at FROM users
      WHERE deleted_at IS NOT NULL AND deleted_at > now() - interval '1 hour' ORDER BY deleted_at DESC`;
    res.json({ ok: true, users: rows });
  } catch (err) { console.error('trash:', err); res.status(500).json({ error: 'Internal error' }); }
});
// Legacy DELETE /api/admin/user {email} — now performs a SOFT delete (superadmin).
app.delete('/api/admin/user', requireAuth, async (req, res) => {
  try {
    const caller = await requireSuperadmin(req, res); if (!caller) return;
    const email = String((req.body && req.body.email) || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Email required' });
    const [target] = await sql`SELECT id, role FROM users WHERE LOWER(email) = ${email}`;
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (String(target.id) === String(caller.id)) return res.status(400).json({ error: 'Cannot delete yourself' });
    if (target.role === 'superadmin') return res.status(400).json({ error: 'Cannot delete another superadmin' });
    await sql`UPDATE users SET deleted_at = now() WHERE id = ${target.id}`;
    try { await sql`INSERT INTO audit_log (actor_user_id, action, target_user_id, detail) VALUES (${caller.id}, 'user.soft_delete', ${target.id}, ${JSON.stringify({ email })}::jsonb)`; } catch (e) {}
    res.json({ ok: true, soft_deleted: email });
  } catch (err) { console.error('DELETE /api/admin/user:', err); res.status(500).json({ error: 'Internal error' }); }
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
        const inserted = await sql`INSERT INTO users (email, password_hash, display_name, role) VALUES (${userEmail}, ${hash}, ${'Guest'}, ${'client'}) RETURNING id`;
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
        // payment_method_types determined automatically by Stripe Dashboard settings
        // (card, klarna, etc. — enable/disable in Dashboard → Payment methods)
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
      // Pack 21 round 3: pass user's locale to Stripe so checkout page is in their language
      // Stripe supports: auto, bg, cs, da, de, el, en, en-GB, es, es-419, et, fi, fil, fr, fr-CA, hr, hu, id, it, ja, ko, lt, lv, ms, mt, nb, nl, pl, pt, pt-BR, ro, ru, sk, sl, sv, th, tr, vi, zh, zh-HK, zh-TW
      const userLocale = (req.body && req.body.locale) || (req.headers['accept-language'] || '').split(',')[0].split('-')[0].toLowerCase();
      if (['ru', 'en', 'es'].includes(userLocale)) sessionParams.locale = userLocale;
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

// ─── GitHub PAT for practices audio upload (legacy) ───
const GITHUB_PAT = process.env.GITHUB_PAT || '';
const GITHUB_REPO_OWNER = 'tvildanov';
const GITHUB_REPO_NAME = 'neuroattention-site';
const GITHUB_AUDIO_PATH = 'assets/audio/practices';

// ─── Cloudflare R2 (object storage for large media) ───
// R2 is the recommended backend for audio/video/stream recordings because
// GitHub repos start to choke at ~5 GB (warnings) and hard-fail near 100 GB.
// R2 has S3-compatible API, no egress fees, and tiered pricing ($0.015/GB).
//
// Required env vars (set them in Railway):
//   R2_ACCOUNT_ID            Cloudflare account ID (visible in dashboard URL)
//   R2_BUCKET                bucket name, e.g. 'neuroattention-media'
//   R2_ACCESS_KEY_ID         from R2 → Manage API Tokens
//   R2_SECRET_ACCESS_KEY     from the same place
//   R2_PUBLIC_BASE_URL       public URL for the bucket. Either a custom
//                            domain ('https://media.neuroattention.org')
//                            or the dev URL ('https://pub-XXX.r2.dev').
//
// If any of those are missing, storage falls back to GitHub. Existing
// files (already on GitHub Pages) keep working forever — only NEW
// uploads go to R2.
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_BUCKET = process.env.R2_BUCKET || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/$/, '');
const r2Configured = !!(R2_ACCOUNT_ID && R2_BUCKET && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_PUBLIC_BASE_URL);
let r2Client = null;
if (r2Configured) {
  try {
    const { S3Client } = require('@aws-sdk/client-s3');
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
    });
    console.log('R2 storage configured: bucket=' + R2_BUCKET);
  } catch (e) {
    console.warn('R2 SDK not loaded:', e.message);
    r2Client = null;
  }
}

// Public status (admin can inspect)
function getStorageStatus() {
  return {
    primary: r2Client ? 'r2' : 'github',
    r2_configured: r2Configured,
    r2_bucket: R2_BUCKET || null,
    r2_public_base: R2_PUBLIC_BASE_URL || null,
    github_configured: !!GITHUB_PAT,
    github_repo: GITHUB_REPO_OWNER + '/' + GITHUB_REPO_NAME
  };
}

// Upload to R2 (if configured) — returns public URL on success
async function uploadToR2(key, buffer, contentType) {
  if (!r2Client) throw new Error('R2 not configured');
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  await r2Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: contentType || 'application/octet-stream'
  }));
  return R2_PUBLIC_BASE_URL + '/' + key.replace(/^\/+/, '');
}

// Delete from R2 (best-effort)
async function deleteFromR2(key) {
  if (!r2Client) return;
  try {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch (e) { console.warn('R2 delete failed:', e.message); }
}

// Storage abstraction: route a file to R2 if configured, else GitHub.
// Returns { url, backend, key }. Existing GitHub URLs continue working forever.
async function storeMediaAsset(key, buffer, contentType, commitMessage) {
  if (r2Client) {
    try {
      const url = await uploadToR2(key, buffer, contentType);
      return { url, backend: 'r2', key };
    } catch (e) {
      console.warn('R2 upload failed, falling back to GitHub:', e.message);
    }
  }
  // GitHub fallback
  const b64 = buffer.toString('base64');
  await githubUploadFile(key, b64, commitMessage || ('[storage] add ' + key));
  return { url: 'https://neuroattention.org/' + key, backend: 'github', key };
}

// Delete by URL — picks the right backend based on the URL host
async function deleteMediaAsset(url) {
  if (!url) return;
  if (R2_PUBLIC_BASE_URL && url.indexOf(R2_PUBLIC_BASE_URL) === 0) {
    const key = url.slice(R2_PUBLIC_BASE_URL.length + 1);
    await deleteFromR2(key);
    return 'r2';
  }
  if (url.indexOf('https://neuroattention.org/') === 0) {
    const path = url.replace('https://neuroattention.org/', '');
    try {
      const sha = await githubGetFileSha(path);
      if (sha) await githubDeleteFile(path, sha, '[storage] remove ' + path);
    } catch (e) { console.warn('GitHub delete failed:', e.message); }
    return 'github';
  }
  return 'unknown';
}

// Percent-encode each path segment so non-ASCII chars (Cyrillic, spaces, etc.)
// don't trigger Node's "Request path contains unescaped characters" in https.request
function encodeGitHubPath(filePath) {
  return String(filePath).split('/').map(encodeURIComponent).join('/');
}

// Helper: upload file to GitHub via Contents API
async function githubUploadFile(filePath, contentBase64, commitMessage) {
  if (!GITHUB_PAT) throw new Error('GITHUB_PAT not configured');
  const https = require('https');
  const encodedPath = encodeGitHubPath(filePath);
  const url = `/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${encodedPath}`;

  // GitHub Contents API requires sha when overwriting an existing file. Fetch
  // it up-front so we never get the "Invalid request. sha wasn't supplied" 422.
  let existingSha = null;
  try { existingSha = await githubGetFileSha(filePath); } catch (_) { existingSha = null; }

  return new Promise((resolve, reject) => {
    const payload = {
      message: commitMessage,
      content: contentBase64,
      branch: 'main'
    };
    if (existingSha) payload.sha = existingSha;
    const body = JSON.stringify(payload);
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
  const encodedPath = encodeGitHubPath(filePath);
  const url = `/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${encodedPath}`;

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
  const encodedPath = encodeGitHubPath(filePath);
  const url = `/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${encodedPath}`;

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
// Accepts either:
//   • application/json: { slug, block_id, lang, name, description, duration_seconds,
//                         order_idx, audio_base64 } — audio_base64 is raw base64 (no data: prefix)
//   • multipart/form-data: same fields as form fields + `audio` file part
// Multipart is strongly preferred — iOS Safari fails JSON+base64 over ~25 MB
// with "the string did not match the expected pattern".
app.post('/api/admin/practices', requireAuth, uploadAudio.single('audio'), async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.sub || req.user.id}`;
    if (!caller.length || !['superadmin', 'founder'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden — founder/superadmin only' });
    }

    const { slug, block_id, lang, name, description, duration_seconds, order_idx, audio_base64 } = req.body;
    // Resolve the audio base64 from either path
    let resolvedB64 = audio_base64;
    if (!resolvedB64 && req.file && req.file.buffer) {
      resolvedB64 = req.file.buffer.toString('base64');
    }
    if (!slug || !block_id || !lang || !name || !resolvedB64) {
      return res.status(400).json({ error: 'Required: slug, block_id, lang, name, audio (multipart) or audio_base64 (json)' });
    }

    // Sanitize slug: transliterate Cyrillic → Latin, then strip to [a-z0-9-] so
    // the file name is safe for both Node's https.request and GitHub Pages URLs.
    function transliterateSlug(s) {
      const map = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya' };
      return String(s).toLowerCase()
        .split('').map(c => map[c] !== undefined ? map[c] : c).join('')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    }
    const cleanSlug = transliterateSlug(slug);
    if (!cleanSlug) {
      return res.status(400).json({ error: 'Slug must contain at least one Latin/Cyrillic letter or digit' });
    }
    const cleanLang = String(lang).toLowerCase().replace(/[^a-z]/g, '').slice(0, 4) || 'ru';

    // Upload audio to GitHub
    const fileName = `${cleanSlug}-${cleanLang}.mp3`;
    const gitPath = `${GITHUB_AUDIO_PATH}/${fileName}`;
    const commitMsg = `[practices] Add audio: ${fileName}`;

    // Route through storage abstraction (R2 if configured, GitHub fallback)
    const audioBuffer = Buffer.from(resolvedB64, 'base64');
    const stored = await storeMediaAsset(gitPath, audioBuffer, 'audio/mpeg', commitMsg);
    const audioUrl = stored.url;

    // Insert into DB (use cleaned slug/lang so the row matches the uploaded filename).
    // duration_seconds / order_idx arrive as strings via multipart, parseInt safely.
    const durNum = parseInt(duration_seconds, 10) || 0;
    const orderNum = parseInt(order_idx, 10) || 0;
    // Upsert: if a row with the same slug+lang exists, update it instead of failing
    // (matches the GitHub overwrite behaviour above). Fallback to INSERT if no unique constraint.
    let rows;
    try {
      rows = await sql`
        INSERT INTO practices (slug, block_id, lang, name, description, audio_url, duration_seconds, order_idx)
        VALUES (${cleanSlug}, ${block_id}, ${cleanLang}, ${name}, ${description || ''}, ${audioUrl}, ${durNum}, ${orderNum})
        ON CONFLICT (slug, lang) DO UPDATE SET
          block_id = EXCLUDED.block_id,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          audio_url = EXCLUDED.audio_url,
          duration_seconds = EXCLUDED.duration_seconds,
          order_idx = EXCLUDED.order_idx,
          updated_at = now()
        RETURNING *
      `;
    } catch (upsertErr) {
      // If there's no unique index on (slug, lang), fall back to manual update-or-insert
      const existing = await sql`SELECT id FROM practices WHERE slug = ${cleanSlug} AND lang = ${cleanLang} LIMIT 1`;
      if (existing.length) {
        rows = await sql`UPDATE practices SET
          block_id = ${block_id}, name = ${name}, description = ${description || ''},
          audio_url = ${audioUrl}, duration_seconds = ${durNum}, order_idx = ${orderNum},
          updated_at = now()
          WHERE id = ${existing[0].id} RETURNING *`;
      } else {
        rows = await sql`INSERT INTO practices (slug, block_id, lang, name, description, audio_url, duration_seconds, order_idx)
                         VALUES (${cleanSlug}, ${block_id}, ${cleanLang}, ${name}, ${description || ''}, ${audioUrl}, ${durNum}, ${orderNum}) RETURNING *`;
      }
    }

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

// PATCH /api/admin/practices/:id — edit a practice's metadata
// (name / description / slug / block_id / lang / duration / order; audio
// stays unless you re-upload via the regular POST flow with the same slug).
app.patch('/api/admin/practices/:id', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.sub || req.user.id}`;
    if (!caller.length || !['superadmin', 'founder'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const practiceId = parseInt(req.params.id, 10);
    const [existing] = await sql`SELECT * FROM practices WHERE id = ${practiceId}`;
    if (!existing) return res.status(404).json({ error: 'Practice not found' });

    const b = req.body || {};
    // Sanitize slug + lang same way as the upload path so the DB stays internally consistent
    function transliterateSlug(s) {
      const map = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya' };
      return String(s).toLowerCase().split('').map(c => map[c] !== undefined ? map[c] : c).join('').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
    }
    const cleanSlug = b.slug !== undefined ? (transliterateSlug(b.slug) || existing.slug) : existing.slug;
    const cleanLang = b.lang !== undefined ? (String(b.lang).toLowerCase().replace(/[^a-z]/g,'').slice(0,4) || existing.lang) : existing.lang;
    const durNum = b.duration_seconds !== undefined ? (parseInt(b.duration_seconds, 10) || 0) : existing.duration_seconds;
    const orderNum = b.order_idx !== undefined ? (parseInt(b.order_idx, 10) || 0) : existing.order_idx;

    // If slug or lang changed, rename the audio file on GitHub too so the URL stays in sync
    let newAudioUrl = existing.audio_url;
    if (cleanSlug !== existing.slug || cleanLang !== existing.lang) {
      try {
        const oldPath = existing.audio_url.replace('https://neuroattention.org/', '');
        const newFileName = `${cleanSlug}-${cleanLang}.mp3`;
        const newPath = `assets/audio/practices/${newFileName}`;
        if (oldPath && oldPath !== newPath) {
          const oldSha = await githubGetFileSha(oldPath);
          if (oldSha) {
            // Get the old file's base64 content, write it to the new path, delete the old.
            // Cheaper alternative: just download the raw bytes via HTTPS, then re-upload.
            const https = require('https');
            const rawUrl = `/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${encodeGitHubPath(oldPath)}`;
            const buf = await new Promise((resolve, reject) => {
              const r = https.request({ hostname: 'api.github.com', path: rawUrl, method: 'GET',
                headers: { 'Authorization': `token ${GITHUB_PAT}`, 'User-Agent': 'NeuroAttention-API', 'Accept': 'application/vnd.github.v3+json' } },
                (res) => { let d=''; res.on('data', c=>d+=c); res.on('end', ()=>{ try { resolve(JSON.parse(d).content || ''); } catch(e){ reject(e); } }); });
              r.on('error', reject); r.end();
            });
            const cleanedB64 = String(buf).replace(/\s+/g, '');
            await githubUploadFile(newPath, cleanedB64, `[practices] Rename ${existing.slug}-${existing.lang} → ${cleanSlug}-${cleanLang}`);
            await githubDeleteFile(oldPath, oldSha, `[practices] Remove old ${existing.slug}-${existing.lang}`);
            newAudioUrl = `https://neuroattention.org/${newPath}`;
          }
        }
      } catch (gitErr) {
        console.warn('Audio rename failed (keeping old URL):', gitErr.message);
      }
    }

    const [updated] = await sql`UPDATE practices SET
      slug = ${cleanSlug},
      block_id = COALESCE(${b.block_id ?? null}, block_id),
      lang = ${cleanLang},
      name = COALESCE(${b.name ?? null}, name),
      description = COALESCE(${b.description ?? null}, description),
      audio_url = ${newAudioUrl},
      duration_seconds = ${durNum},
      order_idx = ${orderNum},
      updated_at = now()
      WHERE id = ${practiceId} RETURNING *`;
    res.json({ ok: true, practice: updated });
  } catch (err) {
    console.error('PATCH /api/admin/practices/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PACK 20: Practice Blocks (composer) ──
// Helper: check if caller has founder/superadmin role
async function callerIsAdmin(req) {
  const id = req.user?.sub || req.user?.id;
  if (!id) return false;
  const r = await sql`SELECT role FROM users WHERE id = ${id}`;
  return r.length && ['superadmin', 'founder'].includes(r[0].role);
}

// XP helper — adds xp event, updates totals, recomputes level
// ── Pack 31.5: Journey event log helpers (Evolution Path real-data wiring) ──
// Every meaningful user action in any instrument should leave a journey_event so
// the Evolution Path reader can render a real, clickable, time-accurate timeline.
// Fault-tolerant by design: a failure here must NEVER break the instrument write
// that called it — we log a warning and return null.
async function logJourney(userId, kind, layer, payload, occurredAt) {
  try {
    if (!userId || !kind) return null;
    let whenIso = null;
    if (occurredAt) {
      const d = new Date(occurredAt);
      if (!isNaN(d.getTime())) whenIso = d.toISOString();
    }
    const body = JSON.stringify(payload || {});
    const rows = whenIso
      ? await sql`INSERT INTO journey_events (user_id, kind, layer, payload, occurred_at)
                  VALUES (${userId}, ${kind}, ${layer || kind}, ${body}::jsonb, ${whenIso}) RETURNING id`
      : await sql`INSERT INTO journey_events (user_id, kind, layer, payload, occurred_at)
                  VALUES (${userId}, ${kind}, ${layer || kind}, ${body}::jsonb, now()) RETURNING id`;
    return rows[0] ? rows[0].id : null;
  } catch (e) { console.warn('logJourney(' + kind + '):', e.message); return null; }
}

// Link two journey events (e.g. a sensation bound to the emotion it accompanied,
// or consecutive nodes in a neuromap chain). journey_links has no uniqueness, so
// callers should avoid obvious duplicates; cheap correlations are acceptable.
async function linkJourney(eventA, eventB, kind, weight) {
  try {
    if (!eventA || !eventB || String(eventA) === String(eventB)) return;
    await sql`INSERT INTO journey_links (event_a, event_b, kind, weight)
              VALUES (${eventA}, ${eventB}, ${kind || 'sequence'}, ${weight || 1.0})`;
  } catch (e) { console.warn('linkJourney:', e.message); }
}

// Map a neuromap node type → { kind, layer } for the journey log / Evolution Path.
function nmTypeToJourney(type) {
  switch (type) {
    case 'emotion':  return { kind: 'emotion',   layer: 'emotion' };
    case 'thought':  return { kind: 'thought',   layer: 'thought' };
    case 'area':     return { kind: 'sensation', layer: 'sensation' };
    case 'cause':    return { kind: 'event',     layer: 'event' };
    case 'event':    return { kind: 'event',     layer: 'event' };
    case 'practice': return { kind: 'practice',  layer: 'practice' };
    default:         return { kind: 'event',     layer: 'event' };
  }
}

async function awardXP(userId, amount, source, refId) {
  if (!userId || !amount) return null;
  await sql`INSERT INTO xp_events (user_id, amount, source, source_ref_id) VALUES (${userId}, ${amount}, ${source}, ${refId || null})`;
  // Journey log: every XP award is a point on the xp_gain layer of Evolution Path.
  await logJourney(userId, 'xp_gain', 'xp', { points: amount, reason: source || 'xp', ref_id: refId || null });
  const [t] = await sql`SELECT COALESCE(SUM(amount),0)::int AS total FROM xp_events WHERE user_id = ${userId}`;
  const total = parseInt(t.total) || 0;
  // quadratic levels: Lvl N requires total >= N*N*100. Level = floor(sqrt(total/100)) + 1, cap 50.
  const level = Math.min(50, Math.floor(Math.sqrt(total / 100)) + 1);
  await sql`UPDATE users SET total_xp = ${total}, current_level = ${level} WHERE id = ${userId}`;
  return { total_xp: total, current_level: level, awarded: amount };
}

// Single practice metadata (public)
app.get('/api/practices/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Bad id' });
    const [row] = await sql`SELECT id, slug, block_id, lang, name, description, audio_url, duration_seconds, order_idx, created_at FROM practices WHERE id = ${id}`;
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ practice: row });
  } catch (err) {
    console.error('GET /api/practices/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// List blocks of a practice (public read for users, full read for admins)
app.get('/api/practices/:id/blocks', async (req, res) => {
  try {
    const practiceId = parseInt(req.params.id);
    if (!practiceId) return res.status(400).json({ error: 'Bad practice id' });
    const blocks = await sql`SELECT id, practice_id, order_idx, type, payload, xp_reward FROM practice_blocks WHERE practice_id = ${practiceId} ORDER BY order_idx ASC`;
    res.json({ blocks });
  } catch (err) {
    console.error('GET /api/practices/:id/blocks:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: list blocks (alias)
app.get('/api/admin/practices/:id/blocks', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const practiceId = parseInt(req.params.id);
    const blocks = await sql`SELECT * FROM practice_blocks WHERE practice_id = ${practiceId} ORDER BY order_idx ASC`;
    res.json({ blocks });
  } catch (err) {
    console.error('GET /api/admin/practices/:id/blocks:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: create block
app.post('/api/admin/practices/:id/blocks', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const practiceId = parseInt(req.params.id);
    const { type, payload, xp_reward, order_idx } = req.body || {};
    const validTypes = ['audio_part','text','image','video','link','sensation_entry','comment_prompt','question_choice'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    // Default order_idx = max + 1
    let idx = order_idx;
    if (typeof idx !== 'number') {
      const [m] = await sql`SELECT COALESCE(MAX(order_idx), -1) + 1 AS next FROM practice_blocks WHERE practice_id = ${practiceId}`;
      idx = parseInt(m.next) || 0;
    }
    const xp = (typeof xp_reward === 'number') ? xp_reward : ({audio_part:100, sensation_entry:75, comment_prompt:50, question_choice:50, text:25, image:25, video:25, link:25}[type] || 25);
    const [row] = await sql`
      INSERT INTO practice_blocks (practice_id, order_idx, type, payload, xp_reward)
      VALUES (${practiceId}, ${idx}, ${type}, ${JSON.stringify(payload || {})}, ${xp})
      RETURNING *
    `;
    res.json({ block: row });
  } catch (err) {
    console.error('POST /api/admin/practices/:id/blocks:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: update block
app.patch('/api/admin/practices/:id/blocks/:blockId', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const blockId = parseInt(req.params.blockId);
    const { type, payload, xp_reward, order_idx } = req.body || {};
    const cur = await sql`SELECT * FROM practice_blocks WHERE id = ${blockId}`;
    if (!cur.length) return res.status(404).json({ error: 'Block not found' });
    const newType = type || cur[0].type;
    const newPayload = payload !== undefined ? payload : cur[0].payload;
    const newXp = (typeof xp_reward === 'number') ? xp_reward : cur[0].xp_reward;
    const newIdx = (typeof order_idx === 'number') ? order_idx : cur[0].order_idx;
    const [row] = await sql`
      UPDATE practice_blocks
      SET type = ${newType}, payload = ${JSON.stringify(newPayload)}, xp_reward = ${newXp}, order_idx = ${newIdx}, updated_at = now()
      WHERE id = ${blockId} RETURNING *
    `;
    res.json({ block: row });
  } catch (err) {
    console.error('PATCH /api/admin/practices/:id/blocks/:blockId:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: delete block
app.delete('/api/admin/practices/:id/blocks/:blockId', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const blockId = parseInt(req.params.blockId);
    await sql`DELETE FROM practice_blocks WHERE id = ${blockId}`;
    res.json({ ok: true, deleted: blockId });
  } catch (err) {
    console.error('DELETE /api/admin/practices/:id/blocks/:blockId:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: bulk reorder (body: {order: [blockId, blockId, ...]})
app.post('/api/admin/practices/:id/blocks/reorder', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const practiceId = parseInt(req.params.id);
    const { order } = req.body || {};
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be array' });
    for (let i = 0; i < order.length; i++) {
      const id = parseInt(order[i]);
      if (!id) continue;
      await sql`UPDATE practice_blocks SET order_idx = ${i}, updated_at = now() WHERE id = ${id} AND practice_id = ${practiceId}`;
    }
    const blocks = await sql`SELECT * FROM practice_blocks WHERE practice_id = ${practiceId} ORDER BY order_idx ASC`;
    res.json({ ok: true, blocks });
  } catch (err) {
    console.error('POST .../reorder:', err);
    res.status(500).json({ error: err.message });
  }
});

// User: complete a block — saves response, awards XP, optionally adds to NeuroMap
app.post('/api/practices/:id/blocks/:blockId/complete', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const practiceId = parseInt(req.params.id);
    const blockId = parseInt(req.params.blockId);
    const { duration_seconds, payload_response } = req.body || {};
    // Load block
    const [blk] = await sql`SELECT * FROM practice_blocks WHERE id = ${blockId} AND practice_id = ${practiceId}`;
    if (!blk) return res.status(404).json({ error: 'Block not found' });
    // Idempotent insert: if already completed, return existing
    const existing = await sql`SELECT id FROM practice_block_completion WHERE user_id = ${userId} AND block_id = ${blockId}`;
    if (existing.length) {
      return res.json({ ok: true, alreadyCompleted: true });
    }
    await sql`
      INSERT INTO practice_block_completion (user_id, block_id, practice_id, duration_seconds, payload_response)
      VALUES (${userId}, ${blockId}, ${practiceId}, ${duration_seconds || null}, ${payload_response ? JSON.stringify(payload_response) : null})
    `;
    // Award XP (also logs an xp_gain journey event inside awardXP)
    const xp = await awardXP(userId, blk.xp_reward || 25, 'block_completion', blockId);

    // Journey log + Step 5: a completed practice becomes (a) a practice point on
    // the Evolution Path and (b) a real "event" node on the user's NeuroMap, so
    // sensations/emotions can later be bound to it as context.
    try {
      const [pr] = await sql`SELECT slug, name FROM practices WHERE id = ${practiceId}`;
      const prName = (pr && pr.name) || (blk.title_ru) || 'Практика';
      const journeyId = await logJourney(userId, 'practice', 'practice', {
        practice_id: practiceId, practice_slug: pr && pr.slug || null, practice_name: prName,
        block_id: blockId, duration: duration_seconds || null,
        completion_at: new Date().toISOString(), source: 'practice'
      }, null);
      // NeuroMap node: type 'event' so it shows on the personal map and is a
      // valid context-binding target for the sensation map.
      const evLabel = 'Практика: ' + prName;
      const normEv = normalizeLabel(evLabel);
      const nmRows = await sql`
        INSERT INTO nm_nodes (user_id, type, label, normalized_label, valence, count, last_seen_at, metadata)
        VALUES (${userId}, 'event', ${evLabel}, ${normEv}, 'positive', 1, now(),
                ${JSON.stringify({ practice_id: practiceId, source: 'practice', journey_id: journeyId })}::jsonb)
        ON CONFLICT (user_id, type, normalized_label, valence)
        DO UPDATE SET count = nm_nodes.count + 1, last_seen_at = now()
        RETURNING id`;
      if (journeyId && nmRows[0]) {
        await sql`UPDATE journey_events SET payload = payload || ${JSON.stringify({ nm_node_id: nmRows[0].id })}::jsonb WHERE id = ${journeyId}`;
      }
    } catch (jpErr) { console.warn('practice journey/nm log:', jpErr.message); }

    res.json({ ok: true, xp });
  } catch (err) {
    console.error('POST .../blocks/:blockId/complete:', err);
    res.status(500).json({ error: err.message });
  }
});

// User: save sensation-path entries to NeuroMap (called from sensation_entry block)
// payload: { sensations: [slug,...], body_locations: [slug,...], comment?: string, practice_block_id?: int }
app.post('/api/neuromap/sensation', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { sensations = [], body_locations = [], comment, practice_block_id,
            intensity, occurred_at, link_to } = req.body || {};
    if (!Array.isArray(sensations) || !Array.isArray(body_locations)) {
      return res.status(400).json({ error: 'sensations and body_locations must be arrays' });
    }
    // Resolve labels
    const sensRows = sensations.length ? await sql`SELECT slug, label_ru FROM vocab_terms WHERE category = 'sensation' AND slug = ANY(${sensations}::text[])` : [];
    const locRows = body_locations.length ? await sql`SELECT slug, label_ru FROM vocab_terms WHERE category = 'body_location' AND slug = ANY(${body_locations}::text[])` : [];
    // PR4 (4.3): accept detailed/custom body-location slugs (e.g. "right_leg__foot")
    // that aren't seeded in vocab_terms. Label comes from the client-sent loc_labels
    // map (the body-part hierarchy lives in the frontend) or a humanized slug.
    const knownLoc = new Set(locRows.map(r => r.slug));
    const locLabels = (req.body && req.body.loc_labels) || {};
    for (const slug of body_locations) {
      if (knownLoc.has(slug)) continue;
      knownLoc.add(slug);
      const lbl = (locLabels && locLabels[slug]) ? String(locLabels[slug]).slice(0, 80)
                : String(slug).replace(/__/g, ' › ').replace(/_/g, ' ');
      locRows.push({ slug, label_ru: lbl });
    }

    // occurred_at supports back-dating; default to now. date_key follows it.
    let when = occurred_at ? new Date(occurred_at) : new Date();
    if (isNaN(when.getTime())) when = new Date();
    const dateKey = when.toISOString().slice(0, 10);

    // Keep the freeform diary record (backward compat with existing recent-list UI)
    const text = `Sensation: ${sensRows.map(s => s.label_ru).join(', ')} @ ${locRows.map(l => l.label_ru).join(', ')}${comment ? ' — ' + comment : ''}`;
    await sql`INSERT INTO neuro_resource_diary (user_id, date_key, text, comment) VALUES (${userId}, ${dateKey}, ${text}, ${comment || ''})`;

    // NeuroMap nodes: body locations as 'area' nodes so they appear on the map.
    const nmNodeIds = [];
    for (const loc of locRows) {
      const norm = normalizeLabel(loc.label_ru);
      const r = await sql`
        INSERT INTO nm_nodes (user_id, type, label, normalized_label, valence, count, last_seen_at, metadata)
        VALUES (${userId}, 'area', ${loc.label_ru}, ${norm}, 'neutral', 1, ${when.toISOString()},
                ${JSON.stringify({ source: 'sensation', slug: loc.slug })}::jsonb)
        ON CONFLICT (user_id, type, normalized_label, valence)
        DO UPDATE SET count = nm_nodes.count + 1, last_seen_at = ${when.toISOString()}
        RETURNING id`;
      if (r[0]) nmNodeIds.push(r[0].id);
    }

    // PR94 (#10): also create 'sensation'-type nodes for each FELT sensation word
    // (тепло, напряжение…) so the "Ощущения" layer (1) of the standalone NeuroMap
    // actually populates. Previously only body locations were stored (as 'area'),
    // and the sensation words were dropped entirely — so layer 1 was permanently
    // empty and read as "тёмный/невидимый". Link each sensation to the body
    // location(s) where it was felt (sensation ↔ where).
    const sensNodeIds = [];
    for (const s of sensRows) {
      const snorm = normalizeLabel(s.label_ru);
      const sr = await sql`
        INSERT INTO nm_nodes (user_id, type, label, normalized_label, valence, count, last_seen_at, metadata)
        VALUES (${userId}, 'sensation', ${s.label_ru}, ${snorm}, 'neutral', 1, ${when.toISOString()},
                ${JSON.stringify({ source: 'sensation', slug: s.slug })}::jsonb)
        ON CONFLICT (user_id, type, normalized_label, valence)
        DO UPDATE SET count = nm_nodes.count + 1, last_seen_at = ${when.toISOString()}
        RETURNING id`;
      if (sr[0]) sensNodeIds.push(sr[0].id);
    }
    for (const sid of sensNodeIds) {
      for (const aid of nmNodeIds) {
        await sql`INSERT INTO nm_links (user_id, from_node_id, to_node_id, count, last_seen_at)
                  VALUES (${userId}, ${sid}, ${aid}, 1, ${when.toISOString()})
                  ON CONFLICT (user_id, from_node_id, to_node_id)
                  DO UPDATE SET count = nm_links.count + 1, last_seen_at = ${when.toISOString()}`;
      }
    }

    // Journey log: a single sensation event carrying all chosen sensations +
    // locations + intensity + the context it was bound to (link_to).
    const linkTo = Array.isArray(link_to) ? link_to.filter(Boolean) : [];
    const sensationEventId = await logJourney(userId, 'sensation', 'sensation', {
      sensation_ids: sensRows.map(s => s.slug),
      sensation_labels: sensRows.map(s => s.label_ru),
      body_locations: locRows.map(l => l.label_ru),
      body_location_slugs: locRows.map(l => l.slug),
      intensity: (typeof intensity === 'number' ? intensity : (parseInt(intensity, 10) || null)),
      comment: comment || '',
      nm_node_ids: nmNodeIds.concat(sensNodeIds),
      context: { linked_to: linkTo },
      source: 'sensation'
    }, when.toISOString());

    // Context binding: connect this sensation to the emotions/events/thoughts/
    // practices the user picked, in both the journey graph and (where possible)
    // the NeuroMap graph (thin ⚭ links between the area node and the target node).
    let linkedCount = 0;
    if (sensationEventId && linkTo.length) {
      const targets = await sql`SELECT id, payload FROM journey_events
                                WHERE user_id = ${userId} AND id = ANY(${linkTo}::bigint[])`;
      for (const tgt of targets) {
        await linkJourney(sensationEventId, tgt.id, 'correlation', 1.0);
        linkedCount++;
        // Mirror onto the NeuroMap graph if both sides have nm nodes
        const tgtNmId = tgt.payload && tgt.payload.nm_node_id;
        if (tgtNmId) {
          for (const areaId of nmNodeIds) {
            await sql`INSERT INTO nm_links (user_id, from_node_id, to_node_id, count, last_seen_at)
                      VALUES (${userId}, ${areaId}, ${tgtNmId}, 1, ${when.toISOString()})
                      ON CONFLICT (user_id, from_node_id, to_node_id)
                      DO UPDATE SET count = nm_links.count + 1, last_seen_at = ${when.toISOString()}`;
          }
        }
      }
    }

    // PR (custom context): free-text context the user typed (not from the
    // candidate list). Persist each as a 'thought' journey event so it binds now
    // and reappears as a candidate next time (deduped by label).
    let customContext = Array.isArray(req.body && req.body.custom_context) ? req.body.custom_context : [];
    customContext = customContext.map(s => String(s == null ? '' : s).trim().slice(0, 120)).filter(Boolean).slice(0, 10);
    if (sensationEventId && customContext.length) {
      for (const text of customContext) {
        const cid = await logJourney(userId, 'thought', 'thought', { label: text, source: 'custom_context' }, when.toISOString());
        if (cid) { await linkJourney(sensationEventId, cid, 'correlation', 1.0); linkedCount++; }
      }
    }

    res.json({ ok: true, sensations: sensRows.length, locations: locRows.length,
               journey_id: sensationEventId, linked: linkedCount });
  } catch (err) {
    console.error('POST /api/neuromap/sensation:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/neuromap/context-candidates — recent emotions/events/thoughts/practices
// the user can bind a sensation to. Powers the "Связать с контекстом" step in the
// sensation map UI. ?days=7 (default), ?limit=40.
app.get('/api/neuromap/context-candidates', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const days = Math.min(366, Math.max(1, parseInt(req.query.days, 10) || 7));
    // PR (context dedup): default to a tight list of the most recent distinct
    // items (max 30). The same emotion/thought is logged many times — without
    // de-duplication the picker showed dozens of identical chips.
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    // One chip per distinct (kind, label): keep the newest occurrence, expose how
    // many times it appeared (freq) so the UI can hint at frequency, order by recency.
    const rows = await sql`
      WITH base AS (
        SELECT id, kind, layer, occurred_at,
               COALESCE(NULLIF(payload->>'label',''), NULLIF(payload->>'practice_name',''),
                        NULLIF(payload->>'title',''), kind) AS lbl,
               COALESCE(payload->>'valence','neutral') AS valence
        FROM journey_events
        WHERE user_id = ${userId}
          AND kind IN ('emotion','event','thought','practice')
          AND occurred_at >= ${since}
      ), ranked AS (
        SELECT *, COUNT(*) OVER (PARTITION BY kind, lbl) AS freq,
               ROW_NUMBER() OVER (PARTITION BY kind, lbl ORDER BY occurred_at DESC) AS rn
        FROM base
      )
      SELECT id, kind, layer, occurred_at, lbl, valence, freq
      FROM ranked WHERE rn = 1
      ORDER BY occurred_at DESC LIMIT ${limit}`;
    // Clean each label so the picker never shows raw slot dumps or mid-word cuts:
    //  · collapse whitespace
    //  · a "Sensation: a, b, c…" dump → just the first sensation type, flagged so
    //    the client can render it as a sensation chip ("🌊 <type> · <date>")
    //  · truncate long free text to a word boundary + ellipsis (never mid-word)
    //  · drop junk (1-char / punctuation-only labels)
    const SENS_RE = /^(?:sensation|ощущени[ея])\s*[:·—–-]\s*(.+)$/i;
    function cleanCtxLabel(raw) {
      let s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
      let sensation = false;
      const m = s.match(SENS_RE);
      if (m) {
        sensation = true;
        const first = (m[1].split(/[,;·]/)[0] || '').trim();
        s = first || s;
      }
      const LIMIT = 42;
      if (s.length > LIMIT) {
        let cut = s.slice(0, LIMIT);
        const sp = cut.lastIndexOf(' ');
        if (sp >= 20) cut = cut.slice(0, sp);            // back off to last word boundary
        s = cut.replace(/[\s,.;:·—–-]+$/, '') + '…';
      }
      return { label: s, sensation };
    }
    const items = rows.map(r => {
      const c = cleanCtxLabel(r.lbl || r.kind);
      return {
        id: String(r.id), kind: r.kind, layer: r.layer, occurred_at: r.occurred_at,
        label: c.label, sensation: c.sensation,
        valence: r.valence || 'neutral', freq: Number(r.freq) || 1
      };
    }).filter(it => {
      const core = it.label.replace(/[…\s]/g, '');
      return core.length >= 2 && /[\p{L}\p{N}]/u.test(core); // keep only meaningful labels
    });
    res.json({ ok: true, items });
  } catch (err) {
    console.error('GET /api/neuromap/context-candidates:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PACK 20: Vocabulary (sensations / body locations / emotions) ──
// Public read by category
app.get('/api/vocab/:category', async (req, res) => {
  try {
    const cat = req.params.category;
    const rows = await sql`SELECT slug, label_ru, label_en, label_es, polarity_strength, icon, order_idx FROM vocab_terms WHERE category = ${cat} AND is_active = true ORDER BY order_idx ASC, label_ru ASC`;
    res.json({ category: cat, terms: rows });
  } catch (err) {
    console.error('GET /api/vocab/:category:', err);
    res.status(500).json({ error: err.message });
  }
});

// PR4 (4.1): authenticated user adds a new sensation/body_location term to the
// shared vocabulary. slug is auto-derived; icon is an optional icon-key resolved
// client-side. Added terms are active and appear in everyone's picker (single
// shared vocab is the existing model); created_by records the author.
app.post('/api/vocab/user', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    let { category, label_ru, label_en, label_es, icon } = req.body || {};
    category = (category === 'body_location') ? 'body_location' : 'sensation';
    label_ru = label_ru ? String(label_ru).trim().slice(0, 80) : '';
    label_en = label_en ? String(label_en).trim().slice(0, 80) : label_ru;
    label_es = label_es ? String(label_es).trim().slice(0, 80) : label_ru;
    icon = icon ? String(icon).trim().slice(0, 40) : null;
    if (!label_ru) return res.status(400).json({ error: 'label_ru required' });
    // slug from a transliteration-ish of the labels + short uniqueness suffix
    const base = (label_en || label_ru).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'custom';
    const suffix = userId.replace(/[^a-z0-9]/gi, '').slice(0, 4).toLowerCase();
    let slug = base + '_u' + suffix;
    const [maxOrder] = await sql`SELECT COALESCE(MAX(order_idx), 0) AS m FROM vocab_terms WHERE category = ${category}`;
    const [row] = await sql`
      INSERT INTO vocab_terms (category, slug, label_ru, label_en, label_es, icon, created_by, order_idx)
      VALUES (${category}, ${slug}, ${label_ru}, ${label_en}, ${label_es}, ${icon}, ${userId}, ${(maxOrder.m || 0) + 1})
      ON CONFLICT (category, slug) DO UPDATE SET label_ru = EXCLUDED.label_ru, label_en = EXCLUDED.label_en, label_es = EXCLUDED.label_es, icon = EXCLUDED.icon, is_active = true, updated_at = now()
      RETURNING slug, label_ru, label_en, label_es, icon, order_idx`;
    res.json({ ok: true, term: row });
  } catch (err) {
    console.error('POST /api/vocab/user:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: list all (or by category)
app.get('/api/admin/vocab', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const cat = req.query.category;
    const rows = cat
      ? await sql`SELECT * FROM vocab_terms WHERE category = ${cat} ORDER BY order_idx ASC, id ASC`
      : await sql`SELECT * FROM vocab_terms ORDER BY category ASC, order_idx ASC, id ASC`;
    res.json({ terms: rows });
  } catch (err) {
    console.error('GET /api/admin/vocab:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/vocab', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const { category, slug, label_ru, label_en, label_es, polarity_strength, order_idx } = req.body || {};
    if (!category || !slug || !label_ru || !label_en || !label_es) {
      return res.status(400).json({ error: 'category, slug, label_ru, label_en, label_es required' });
    }
    const [row] = await sql`
      INSERT INTO vocab_terms (category, slug, label_ru, label_en, label_es, polarity_strength, order_idx)
      VALUES (${category}, ${slug}, ${label_ru}, ${label_en}, ${label_es}, ${polarity_strength || null}, ${order_idx || 0})
      ON CONFLICT (category, slug) DO UPDATE SET label_ru = EXCLUDED.label_ru, label_en = EXCLUDED.label_en, label_es = EXCLUDED.label_es, updated_at = now()
      RETURNING *
    `;
    res.json({ term: row });
  } catch (err) {
    console.error('POST /api/admin/vocab:', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/vocab/:id', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const id = parseInt(req.params.id);
    const { label_ru, label_en, label_es, polarity_strength, order_idx, is_active } = req.body || {};
    const [cur] = await sql`SELECT * FROM vocab_terms WHERE id = ${id}`;
    if (!cur) return res.status(404).json({ error: 'Term not found' });
    const [row] = await sql`
      UPDATE vocab_terms SET
        label_ru = ${label_ru ?? cur.label_ru},
        label_en = ${label_en ?? cur.label_en},
        label_es = ${label_es ?? cur.label_es},
        polarity_strength = ${polarity_strength ?? cur.polarity_strength},
        order_idx = ${order_idx ?? cur.order_idx},
        is_active = ${is_active ?? cur.is_active},
        updated_at = now()
      WHERE id = ${id} RETURNING *
    `;
    res.json({ term: row });
  } catch (err) {
    console.error('PATCH /api/admin/vocab/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/vocab/:id', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const id = parseInt(req.params.id);
    // Soft delete (is_active = false) — preserves referential integrity for past completions
    await sql`UPDATE vocab_terms SET is_active = false, updated_at = now() WHERE id = ${id}`;
    res.json({ ok: true, deactivated: id });
  } catch (err) {
    console.error('DELETE /api/admin/vocab/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PACK 20: User XP & Level ──
app.get('/api/users/me/xp', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const [u] = await sql`SELECT total_xp, current_level FROM users WHERE id = ${userId}`;
    if (!u) return res.status(404).json({ error: 'Not found' });
    const total = parseInt(u.total_xp) || 0;
    const level = parseInt(u.current_level) || 1;
    const nextLevelAt = level * level * 100;
    const prevLevelAt = (level - 1) * (level - 1) * 100;
    res.json({ total_xp: total, current_level: level, next_level_at: nextLevelAt, prev_level_at: prevLevelAt, progress_pct: Math.min(100, Math.round(((total - prevLevelAt) / (nextLevelAt - prevLevelAt)) * 100)) });
  } catch (err) {
    console.error('GET /api/users/me/xp:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PACK 21: Post-purchase flow — list of user's paid programs ──
// Default activation window: 14 days from purchase
const ACTIVATION_DAYS = 14;
app.get('/api/users/me/purchases', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const [u] = await sql`SELECT email FROM users WHERE id = ${userId}`;
    if (!u) return res.status(404).json({ error: 'Not found' });
    const rows = await sql`
      SELECT id, product, payment_status, amount_total, currency, consent_timestamp, stripe_session_id
      FROM consent_log
      WHERE (user_id = ${userId} OR email = ${u.email})
        AND payment_status IN ('paid','completed')
      ORDER BY consent_timestamp DESC
    `;
    const purchases = rows.map(r => {
      const purchasedAt = r.consent_timestamp || new Date();
      const activationDate = new Date(new Date(purchasedAt).getTime() + ACTIVATION_DAYS * 24 * 60 * 60 * 1000);
      const now = Date.now();
      const isActivated = now >= activationDate.getTime();
      const daysLeft = Math.max(0, Math.ceil((activationDate.getTime() - now) / (24 * 60 * 60 * 1000)));
      return {
        id: r.id,
        product: r.product,
        purchased_at: purchasedAt,
        activation_date: activationDate.toISOString(),
        days_until_activation: daysLeft,
        is_activated: isActivated,
        amount_total: r.amount_total,
        currency: r.currency,
        stripe_session_id: r.stripe_session_id
      };
    });
    res.json({ purchases, has_active_purchase: purchases.length > 0 });
  } catch (err) {
    console.error('GET /api/users/me/purchases:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PACK 23: Diagnostic templates & sessions ──
async function callerHasSpecialistAccess(req) {
  const id = req.user?.sub || req.user?.id;
  if (!id) return false;
  const r = await sql`SELECT role FROM users WHERE id = ${id}`;
  return r.length && ['superadmin', 'founder', 'specialist', 'admin'].includes(r[0].role);
}

// List templates: default + caller's own
app.get('/api/admin/diagnostic/templates', requireAuth, async (req, res) => {
  try {
    if (!await callerHasSpecialistAccess(req)) return res.status(403).json({ error: 'Forbidden' });
    const userId = req.user.sub || req.user.id;
    const rows = await sql`
      SELECT t.id, t.name, t.is_default, t.cloned_from, t.owner_user_id, t.created_at, t.updated_at,
             (SELECT COUNT(*) FROM diagnostic_items WHERE template_id = t.id) AS item_count
      FROM diagnostic_templates t
      WHERE t.is_default = true OR t.owner_user_id = ${userId}
      ORDER BY t.is_default DESC, t.updated_at DESC
    `;
    res.json({ templates: rows });
  } catch (err) {
    console.error('GET /api/admin/diagnostic/templates:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single template with items
app.get('/api/admin/diagnostic/templates/:id', requireAuth, async (req, res) => {
  try {
    if (!await callerHasSpecialistAccess(req)) return res.status(403).json({ error: 'Forbidden' });
    const userId = req.user.sub || req.user.id;
    const id = parseInt(req.params.id);
    const [tpl] = await sql`SELECT * FROM diagnostic_templates WHERE id = ${id} AND (is_default = true OR owner_user_id = ${userId})`;
    if (!tpl) return res.status(404).json({ error: 'Template not found or access denied' });
    const items = await sql`SELECT * FROM diagnostic_items WHERE template_id = ${id} ORDER BY order_idx ASC`;
    res.json({ template: tpl, items });
  } catch (err) {
    console.error('GET diagnostic template:', err);
    res.status(500).json({ error: err.message });
  }
});

// Clone default template into caller's own (so they can customize)
// Create blank template owned by the caller
app.post('/api/admin/diagnostic/templates', requireAuth, async (req, res) => {
  try {
    if (!await callerHasSpecialistAccess(req)) return res.status(403).json({ error: 'Forbidden' });
    const userId = req.user.sub || req.user.id;
    const { name } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
    const [tpl] = await sql`
      INSERT INTO diagnostic_templates (owner_user_id, name, is_default)
      VALUES (${userId}, ${String(name).trim()}, false)
      RETURNING *
    `;
    res.json({ template: tpl });
  } catch (err) {
    console.error('POST diagnostic blank template:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/diagnostic/templates/clone', requireAuth, async (req, res) => {
  try {
    if (!await callerHasSpecialistAccess(req)) return res.status(403).json({ error: 'Forbidden' });
    const userId = req.user.sub || req.user.id;
    const { from_id, template_id, name } = req.body || {};
    const sourceId = parseInt(from_id || template_id);
    const [src] = await sql`SELECT * FROM diagnostic_templates WHERE id = ${sourceId}`;
    if (!src) return res.status(404).json({ error: 'Source template not found' });
    const [newTpl] = await sql`
      INSERT INTO diagnostic_templates (owner_user_id, name, is_default, cloned_from)
      VALUES (${userId}, ${name || (src.name + ' (моя)')}, false, ${sourceId})
      RETURNING *
    `;
    // Copy items
    const items = await sql`SELECT * FROM diagnostic_items WHERE template_id = ${sourceId} ORDER BY order_idx ASC`;
    for (const it of items) {
      await sql`INSERT INTO diagnostic_items (template_id, order_idx, kind, response_type, label_ru, label_en, label_es, hint_ru, hint_en, hint_es, options, is_required)
                VALUES (${newTpl.id}, ${it.order_idx}, ${it.kind}, ${it.response_type}, ${it.label_ru}, ${it.label_en}, ${it.label_es}, ${it.hint_ru}, ${it.hint_en}, ${it.hint_es}, ${it.options ? JSON.stringify(it.options) : null}, ${it.is_required})`;
    }
    res.json({ template: newTpl, copied_items: items.length });
  } catch (err) {
    console.error('POST diagnostic clone:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update template name
app.patch('/api/admin/diagnostic/templates/:id', requireAuth, async (req, res) => {
  try {
    if (!await callerHasSpecialistAccess(req)) return res.status(403).json({ error: 'Forbidden' });
    const userId = req.user.sub || req.user.id;
    const id = parseInt(req.params.id);
    const [tpl] = await sql`SELECT * FROM diagnostic_templates WHERE id = ${id}`;
    if (!tpl) return res.status(404).json({ error: 'Not found' });
    if (tpl.is_default && tpl.owner_user_id !== userId) {
      const [caller] = await sql`SELECT role FROM users WHERE id = ${userId}`;
      if (caller.role !== 'superadmin' && caller.role !== 'founder') return res.status(403).json({ error: 'Default template can only be edited by founder/superadmin' });
    } else if (tpl.owner_user_id !== userId) {
      return res.status(403).json({ error: 'Not your template' });
    }
    const { name } = req.body || {};
    const [updated] = await sql`UPDATE diagnostic_templates SET name = COALESCE(${name}, name), updated_at = now() WHERE id = ${id} RETURNING *`;
    res.json({ template: updated });
  } catch (err) {
    console.error('PATCH diagnostic template:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete template (only own, not default)
app.delete('/api/admin/diagnostic/templates/:id', requireAuth, async (req, res) => {
  try {
    if (!await callerHasSpecialistAccess(req)) return res.status(403).json({ error: 'Forbidden' });
    const userId = req.user.sub || req.user.id;
    const id = parseInt(req.params.id);
    const [tpl] = await sql`SELECT * FROM diagnostic_templates WHERE id = ${id}`;
    if (!tpl) return res.status(404).json({ error: 'Not found' });
    if (tpl.is_default) return res.status(400).json({ error: 'Cannot delete default template' });
    if (tpl.owner_user_id !== userId) {
      const [caller] = await sql`SELECT role FROM users WHERE id = ${userId}`;
      if (caller.role !== 'superadmin' && caller.role !== 'founder') return res.status(403).json({ error: 'Not your template' });
    }
    await sql`DELETE FROM diagnostic_templates WHERE id = ${id}`;
    res.json({ ok: true, deleted: id });
  } catch (err) {
    console.error('DELETE diagnostic template:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add item to template
app.post('/api/admin/diagnostic/templates/:id/items', requireAuth, async (req, res) => {
  try {
    if (!await callerHasSpecialistAccess(req)) return res.status(403).json({ error: 'Forbidden' });
    const userId = req.user.sub || req.user.id;
    const tplId = parseInt(req.params.id);
    const [tpl] = await sql`SELECT * FROM diagnostic_templates WHERE id = ${tplId}`;
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    if (tpl.is_default) {
      const [caller] = await sql`SELECT role FROM users WHERE id = ${userId}`;
      if (caller.role !== 'superadmin' && caller.role !== 'founder') return res.status(403).json({ error: 'Cannot edit default — clone first' });
    } else if (tpl.owner_user_id !== userId) {
      return res.status(403).json({ error: 'Not your template' });
    }
    const { kind = 'question', response_type = 'text', label_ru = '', label_en = '', label_es = '', hint_ru = '', hint_en = '', hint_es = '', options = null, is_required = false } = req.body || {};
    const [maxRow] = await sql`SELECT COALESCE(MAX(order_idx), -1) + 1 AS next FROM diagnostic_items WHERE template_id = ${tplId}`;
    const [row] = await sql`
      INSERT INTO diagnostic_items (template_id, order_idx, kind, response_type, label_ru, label_en, label_es, hint_ru, hint_en, hint_es, options, is_required)
      VALUES (${tplId}, ${parseInt(maxRow.next) || 0}, ${kind}, ${response_type}, ${label_ru}, ${label_en}, ${label_es}, ${hint_ru}, ${hint_en}, ${hint_es}, ${options ? JSON.stringify(options) : null}, ${!!is_required})
      RETURNING *
    `;
    res.json({ item: row });
  } catch (err) {
    console.error('POST diagnostic item:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update item
app.patch('/api/admin/diagnostic/templates/:id/items/:itemId', requireAuth, async (req, res) => {
  try {
    if (!await callerHasSpecialistAccess(req)) return res.status(403).json({ error: 'Forbidden' });
    const itemId = parseInt(req.params.itemId);
    const [cur] = await sql`SELECT i.*, t.owner_user_id, t.is_default FROM diagnostic_items i JOIN diagnostic_templates t ON t.id = i.template_id WHERE i.id = ${itemId}`;
    if (!cur) return res.status(404).json({ error: 'Not found' });
    const userId = req.user.sub || req.user.id;
    if (cur.is_default) {
      const [caller] = await sql`SELECT role FROM users WHERE id = ${userId}`;
      if (caller.role !== 'superadmin' && caller.role !== 'founder') return res.status(403).json({ error: 'Cannot edit default' });
    } else if (cur.owner_user_id !== userId) return res.status(403).json({ error: 'Not your template' });
    const { kind, response_type, label_ru, label_en, label_es, hint_ru, hint_en, hint_es, options, is_required, order_idx } = req.body || {};
    const [updated] = await sql`UPDATE diagnostic_items SET
      kind = COALESCE(${kind}, kind),
      response_type = COALESCE(${response_type}, response_type),
      label_ru = COALESCE(${label_ru}, label_ru),
      label_en = COALESCE(${label_en}, label_en),
      label_es = COALESCE(${label_es}, label_es),
      hint_ru = COALESCE(${hint_ru}, hint_ru),
      hint_en = COALESCE(${hint_en}, hint_en),
      hint_es = COALESCE(${hint_es}, hint_es),
      options = COALESCE(${options !== undefined ? JSON.stringify(options) : null}::jsonb, options),
      is_required = COALESCE(${is_required}, is_required),
      order_idx = COALESCE(${order_idx}, order_idx)
      WHERE id = ${itemId} RETURNING *`;
    res.json({ item: updated });
  } catch (err) {
    console.error('PATCH diagnostic item:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete item
app.delete('/api/admin/diagnostic/templates/:id/items/:itemId', requireAuth, async (req, res) => {
  try {
    if (!await callerHasSpecialistAccess(req)) return res.status(403).json({ error: 'Forbidden' });
    const itemId = parseInt(req.params.itemId);
    const [cur] = await sql`SELECT i.*, t.owner_user_id, t.is_default FROM diagnostic_items i JOIN diagnostic_templates t ON t.id = i.template_id WHERE i.id = ${itemId}`;
    if (!cur) return res.status(404).json({ error: 'Not found' });
    const userId = req.user.sub || req.user.id;
    if (cur.is_default) {
      const [caller] = await sql`SELECT role FROM users WHERE id = ${userId}`;
      if (caller.role !== 'superadmin' && caller.role !== 'founder') return res.status(403).json({ error: 'Cannot edit default' });
    } else if (cur.owner_user_id !== userId) return res.status(403).json({ error: 'Not your template' });
    await sql`DELETE FROM diagnostic_items WHERE id = ${itemId}`;
    res.json({ ok: true, deleted: itemId });
  } catch (err) {
    console.error('DELETE diagnostic item:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reorder items
// Atomic full-replace of all items in a template
app.put('/api/admin/diagnostic/templates/:id/items/replace', requireAuth, async (req, res) => {
  try {
    if (!await callerHasSpecialistAccess(req)) return res.status(403).json({ error: 'Forbidden' });
    const userId = req.user.sub || req.user.id;
    const tplId = parseInt(req.params.id);
    const { items } = req.body || {};
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });
    const [tpl] = await sql`SELECT * FROM diagnostic_templates WHERE id = ${tplId}`;
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    if (tpl.is_default) {
      const [caller] = await sql`SELECT role FROM users WHERE id = ${userId}`;
      if (!caller || (caller.role !== 'superadmin' && caller.role !== 'founder')) {
        return res.status(403).json({ error: 'Default template can only be edited by founder/superadmin' });
      }
    } else if (tpl.owner_user_id !== userId) {
      const [caller] = await sql`SELECT role FROM users WHERE id = ${userId}`;
      if (!caller || (caller.role !== 'superadmin' && caller.role !== 'founder')) {
        return res.status(403).json({ error: 'Not your template' });
      }
    }
    await sql`DELETE FROM diagnostic_items WHERE template_id = ${tplId}`;
    let inserted = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      await sql`
        INSERT INTO diagnostic_items
          (template_id, order_idx, kind, response_type, label_ru, label_en, label_es, hint_ru, hint_en, hint_es, options, is_required)
        VALUES
          (${tplId}, ${i}, ${it.kind || 'question'}, ${it.response_type || 'text'},
           ${it.label_ru || ''}, ${it.label_en || ''}, ${it.label_es || ''},
           ${it.hint_ru || ''}, ${it.hint_en || ''}, ${it.hint_es || ''},
           ${it.options ? JSON.stringify(it.options) : null}, ${!!it.is_required})
      `;
      inserted++;
    }
    await sql`UPDATE diagnostic_templates SET updated_at = now() WHERE id = ${tplId}`;
    res.json({ ok: true, replaced: inserted });
  } catch (err) {
    console.error('PUT diagnostic items replace:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/diagnostic/templates/:id/items/reorder', requireAuth, async (req, res) => {
  try {
    if (!await callerHasSpecialistAccess(req)) return res.status(403).json({ error: 'Forbidden' });
    const tplId = parseInt(req.params.id);
    const { order } = req.body || {};
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });
    for (let i = 0; i < order.length; i++) {
      const id = parseInt(order[i]);
      if (id) await sql`UPDATE diagnostic_items SET order_idx = ${i} WHERE id = ${id} AND template_id = ${tplId}`;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('POST diagnostic reorder:', err);
    res.status(500).json({ error: err.message });
  }
});

// Sessions: list / create / save responses
app.get('/api/admin/diagnostic/sessions', requireAuth, async (req, res) => {
  try {
    if (!await callerHasSpecialistAccess(req)) return res.status(403).json({ error: 'Forbidden' });
    const userId = req.user.sub || req.user.id;
    const rows = await sql`
      SELECT s.*, t.name AS template_name, c.email AS client_email_real, c.display_name AS client_name_real
      FROM diagnostic_sessions s
      LEFT JOIN diagnostic_templates t ON t.id = s.template_id
      LEFT JOIN users c ON c.id = s.client_id
      WHERE s.specialist_id = ${userId}
      ORDER BY s.started_at DESC LIMIT 100
    `;
    res.json({ sessions: rows });
  } catch (err) {
    console.error('GET diagnostic sessions:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/diagnostic/sessions', requireAuth, async (req, res) => {
  try {
    if (!await callerHasSpecialistAccess(req)) return res.status(403).json({ error: 'Forbidden' });
    const userId = req.user.sub || req.user.id;
    const { template_id, client_id, client_email, client_name, responses, notes, completed } = req.body || {};
    if (!template_id) return res.status(400).json({ error: 'template_id required' });
    const hasResp = responses !== undefined && responses !== null;
    const completedAt = (completed || hasResp) ? new Date() : null;
    const [row] = await sql`
      INSERT INTO diagnostic_sessions
        (template_id, specialist_id, client_id, client_email, client_name, responses, notes, completed_at)
      VALUES
        (${parseInt(template_id)}, ${userId}, ${client_id || null}, ${client_email || null}, ${client_name || null},
         ${hasResp ? JSON.stringify(responses) : null}::jsonb, ${notes || null}, ${completedAt})
      RETURNING *
    `;
    res.json({ session: row });
  } catch (err) {
    console.error('POST diagnostic session:', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/admin/diagnostic/sessions/:id', requireAuth, async (req, res) => {
  try {
    if (!await callerHasSpecialistAccess(req)) return res.status(403).json({ error: 'Forbidden' });
    const userId = req.user.sub || req.user.id;
    const id = parseInt(req.params.id);
    const { responses, notes, completed } = req.body || {};
    const [updated] = await sql`UPDATE diagnostic_sessions SET
      responses = COALESCE(${responses !== undefined ? JSON.stringify(responses) : null}::jsonb, responses),
      notes = COALESCE(${notes}, notes),
      completed_at = CASE WHEN ${!!completed} THEN now() ELSE completed_at END
      WHERE id = ${id} AND specialist_id = ${userId} RETURNING *`;
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ session: updated });
  } catch (err) {
    console.error('PATCH diagnostic session:', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════
// ── PACK 24: Course Constructor (courses → blocks → branches) ──
// ══════════════════════════════════════════════════════════════════
async function callerIsAdmin(req) {
  const id = req.user?.sub || req.user?.id;
  if (!id) return false;
  const r = await sql`SELECT role FROM users WHERE id = ${id}`;
  return r.length && ['superadmin', 'founder', 'admin'].includes(r[0].role);
}

// GET /api/admin/courses — list all courses
app.get('/api/admin/courses', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const rows = await sql`
      SELECT c.*, (SELECT COUNT(*) FROM course_blocks WHERE course_id = c.id) AS block_count
      FROM courses c ORDER BY c.order_idx ASC, c.id DESC
    `;
    res.json({ courses: rows });
  } catch (err) { console.error('GET courses:', err); res.status(500).json({ error: err.message }); }
});

// POST /api/admin/courses — create new course
app.post('/api/admin/courses', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const userId = req.user.sub || req.user.id;
    const { slug, name_ru, name_en, name_es, description_ru, description_en, description_es,
            cover_url, program_access, is_published, languages } = req.body || {};
    if (!slug || !String(slug).trim()) return res.status(400).json({ error: 'slug required' });
    // Sanitize slug
    function transliterate(s) {
      const map = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya' };
      return String(s).toLowerCase().split('').map(c => map[c] !== undefined ? map[c] : c).join('').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
    }
    const cleanSlug = transliterate(slug);
    if (!cleanSlug) return res.status(400).json({ error: 'slug must contain letters/digits' });
    const accessArr = Array.isArray(program_access) ? program_access : [];
    const langArr = Array.isArray(languages) ? languages.filter(l => ['ru','en','es'].includes(l)) : [];
    const [row] = await sql`
      INSERT INTO courses (slug, name_ru, name_en, name_es, description_ru, description_en, description_es,
                           cover_url, program_access, is_published, languages, created_by)
      VALUES (${cleanSlug}, ${name_ru||''}, ${name_en||''}, ${name_es||''},
              ${description_ru||''}, ${description_en||''}, ${description_es||''},
              ${cover_url||''}, ${accessArr}::text[], ${!!is_published}, ${langArr}::text[], ${userId})
      RETURNING *
    `;
    res.status(201).json({ course: row });
  } catch (err) {
    console.error('POST course:', err);
    if (String(err.message).includes('duplicate')) return res.status(409).json({ error: 'Course with this slug already exists' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/courses/:id — get course with blocks
app.get('/api/admin/courses/:id', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const id = parseInt(req.params.id, 10);
    const [course] = await sql`SELECT * FROM courses WHERE id = ${id}`;
    if (!course) return res.status(404).json({ error: 'Not found' });
    const blocks = await sql`SELECT * FROM course_blocks WHERE course_id = ${id} ORDER BY order_idx ASC, id ASC`;
    // #4: resolve practice audio so the admin preview player also plays.
    const practiceIds = [...new Set(blocks
      .filter(b => b.block_type === 'practice' && b.payload && b.payload.practice_id)
      .map(b => parseInt(b.payload.practice_id, 10))
      .filter(n => Number.isFinite(n)))];
    if (practiceIds.length) {
      const prRows = await sql`SELECT id, slug, lang, name, audio_url, duration_seconds FROM practices WHERE id = ANY(${practiceIds})`;
      const prMap = {};
      prRows.forEach(p => { prMap[p.id] = p; });
      blocks.forEach(b => {
        if (b.block_type === 'practice' && b.payload && b.payload.practice_id) {
          const pr = prMap[parseInt(b.payload.practice_id, 10)];
          if (pr) b.payload = Object.assign({}, b.payload, {
            audio_url: pr.audio_url || b.payload.audio_url || '',
            practice_slug: b.payload.practice_slug || pr.slug,
            practice_name: b.payload.practice_name || pr.name,
            practice_lang: b.payload.practice_lang || pr.lang,
            duration_seconds: pr.duration_seconds
          });
        }
      });
    }
    const branches = await sql`SELECT cb.* FROM course_branches cb JOIN course_blocks b ON b.id = cb.block_id WHERE b.course_id = ${id}`;
    res.json({ course, blocks, branches });
  } catch (err) { console.error('GET course:', err); res.status(500).json({ error: err.message }); }
});

// PATCH /api/admin/courses/:id — update course meta
app.patch('/api/admin/courses/:id', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const [updated] = await sql`UPDATE courses SET
      name_ru = COALESCE(${b.name_ru}, name_ru),
      name_en = COALESCE(${b.name_en}, name_en),
      name_es = COALESCE(${b.name_es}, name_es),
      description_ru = COALESCE(${b.description_ru}, description_ru),
      description_en = COALESCE(${b.description_en}, description_en),
      description_es = COALESCE(${b.description_es}, description_es),
      cover_url = COALESCE(${b.cover_url}, cover_url),
      program_access = COALESCE(${Array.isArray(b.program_access) ? b.program_access : null}::text[], program_access),
      languages = COALESCE(${Array.isArray(b.languages) ? b.languages.filter(l => ['ru','en','es'].includes(l)) : null}::text[], languages),
      is_published = COALESCE(${b.is_published !== undefined ? !!b.is_published : null}, is_published),
      order_idx = COALESCE(${b.order_idx !== undefined ? parseInt(b.order_idx,10) : null}, order_idx),
      updated_at = now()
      WHERE id = ${id} RETURNING *`;
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ course: updated });
  } catch (err) { console.error('PATCH course:', err); res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/courses/:id — delete course (cascades blocks, branches)
app.delete('/api/admin/courses/:id', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const id = parseInt(req.params.id, 10);
    await sql`DELETE FROM courses WHERE id = ${id}`;
    res.json({ ok: true, deleted: id });
  } catch (err) { console.error('DELETE course:', err); res.status(500).json({ error: err.message }); }
});

// ── Course blocks CRUD ──

// POST /api/admin/courses/:id/blocks — append a new block
app.post('/api/admin/courses/:id/blocks', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const courseId = parseInt(req.params.id, 10);
    const { block_type, title_ru, title_en, title_es, payload, points, parent_block_id, tool_kind, tool_config } = req.body || {};
    if (!block_type) return res.status(400).json({ error: 'block_type required' });
    // order_idx scope: next-after-max within the SAME parent_block_id (or top-level if null)
    const parent = parent_block_id ? parseInt(parent_block_id, 10) : null;
    const maxRows = parent
      ? await sql`SELECT COALESCE(MAX(order_idx), -1) AS max_idx FROM course_blocks WHERE course_id = ${courseId} AND parent_block_id = ${parent}`
      : await sql`SELECT COALESCE(MAX(order_idx), -1) AS max_idx FROM course_blocks WHERE course_id = ${courseId} AND parent_block_id IS NULL`;
    const nextIdx = (maxRows[0]?.max_idx ?? -1) + 1;
    const [row] = await sql`
      INSERT INTO course_blocks (course_id, order_idx, block_type, title_ru, title_en, title_es, payload, points, parent_block_id, tool_kind, tool_config)
      VALUES (${courseId}, ${nextIdx}, ${block_type}, ${title_ru||''}, ${title_en||''}, ${title_es||''},
              ${JSON.stringify(payload || {})}::jsonb, ${parseInt(points, 10) || 0}, ${parent},
              ${tool_kind || null}, ${JSON.stringify(tool_config || {})}::jsonb)
      RETURNING *
    `;
    res.status(201).json({ block: row });
  } catch (err) { console.error('POST block:', err); res.status(500).json({ error: err.message }); }
});

// PATCH /api/admin/courses/:cid/blocks/:bid — edit block
app.patch('/api/admin/courses/:cid/blocks/:bid', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const bid = parseInt(req.params.bid, 10);
    const b = req.body || {};
    let updated;
    if (Object.prototype.hasOwnProperty.call(b, 'parent_block_id')) {
      // Explicit parent change (null clears it, integer sets it)
      const newParent = b.parent_block_id === null ? null : parseInt(b.parent_block_id, 10);
      [updated] = await sql`UPDATE course_blocks SET
        block_type = COALESCE(${b.block_type}, block_type),
        title_ru = COALESCE(${b.title_ru}, title_ru),
        title_en = COALESCE(${b.title_en}, title_en),
        title_es = COALESCE(${b.title_es}, title_es),
        payload = COALESCE(${b.payload !== undefined ? JSON.stringify(b.payload) : null}::jsonb, payload),
        points = COALESCE(${b.points !== undefined ? parseInt(b.points, 10) : null}, points),
        unlock_condition = COALESCE(${b.unlock_condition !== undefined ? JSON.stringify(b.unlock_condition) : null}::jsonb, unlock_condition),
        tool_kind = COALESCE(${b.tool_kind !== undefined ? b.tool_kind : null}, tool_kind),
        tool_config = COALESCE(${b.tool_config !== undefined ? JSON.stringify(b.tool_config) : null}::jsonb, tool_config),
        parent_block_id = ${newParent}
        WHERE id = ${bid} RETURNING *`;
    } else {
      [updated] = await sql`UPDATE course_blocks SET
        block_type = COALESCE(${b.block_type}, block_type),
        title_ru = COALESCE(${b.title_ru}, title_ru),
        title_en = COALESCE(${b.title_en}, title_en),
        title_es = COALESCE(${b.title_es}, title_es),
        payload = COALESCE(${b.payload !== undefined ? JSON.stringify(b.payload) : null}::jsonb, payload),
        points = COALESCE(${b.points !== undefined ? parseInt(b.points, 10) : null}, points),
        unlock_condition = COALESCE(${b.unlock_condition !== undefined ? JSON.stringify(b.unlock_condition) : null}::jsonb, unlock_condition),
        tool_kind = COALESCE(${b.tool_kind !== undefined ? b.tool_kind : null}, tool_kind),
        tool_config = COALESCE(${b.tool_config !== undefined ? JSON.stringify(b.tool_config) : null}::jsonb, tool_config)
        WHERE id = ${bid} RETURNING *`;
    }
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ block: updated });
  } catch (err) { console.error('PATCH block:', err); res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/courses/:cid/blocks/:bid — remove a block
app.delete('/api/admin/courses/:cid/blocks/:bid', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const bid = parseInt(req.params.bid, 10);
    await sql`DELETE FROM course_blocks WHERE id = ${bid}`;
    res.json({ ok: true, deleted: bid });
  } catch (err) { console.error('DELETE block:', err); res.status(500).json({ error: err.message }); }
});

// POST /api/admin/courses/:id/blocks/reorder — set order_idx for each id in given array
app.post('/api/admin/courses/:id/blocks/reorder', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const courseId = parseInt(req.params.id, 10);
    const order = Array.isArray(req.body?.order) ? req.body.order : null;
    if (!order) return res.status(400).json({ error: 'order array required' });
    for (let i = 0; i < order.length; i++) {
      const bid = parseInt(order[i], 10);
      if (bid) await sql`UPDATE course_blocks SET order_idx = ${i} WHERE id = ${bid} AND course_id = ${courseId}`;
    }
    res.json({ ok: true, reordered: order.length });
  } catch (err) { console.error('reorder blocks:', err); res.status(500).json({ error: err.message }); }
});

// ── Course branches (for question_branch blocks) ──
app.post('/api/admin/courses/:cid/blocks/:bid/branches', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const bid = parseInt(req.params.bid, 10);
    const { answer_key, next_block_id, label_ru, label_en, label_es } = req.body || {};
    if (!answer_key) return res.status(400).json({ error: 'answer_key required' });
    const [row] = await sql`
      INSERT INTO course_branches (block_id, answer_key, next_block_id, label_ru, label_en, label_es)
      VALUES (${bid}, ${answer_key}, ${next_block_id ? parseInt(next_block_id,10) : null},
              ${label_ru||''}, ${label_en||''}, ${label_es||''})
      RETURNING *
    `;
    res.status(201).json({ branch: row });
  } catch (err) { console.error('POST branch:', err); res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/courses/:cid/blocks/:bid/branches/:brid', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const brid = parseInt(req.params.brid, 10);
    await sql`DELETE FROM course_branches WHERE id = ${brid}`;
    res.json({ ok: true });
  } catch (err) { console.error('DELETE branch:', err); res.status(500).json({ error: err.message }); }
});

// ── Course assets (upload audio/image/video for sound cues, covers, inline media) ──
app.post('/api/admin/courses/:id/assets', requireAuth, uploadAudio.single('file'), async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const courseId = parseInt(req.params.id, 10);
    const { asset_type, filename } = req.body || {};
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'file required (multipart "file")' });
    const safeName = String(filename || req.file.originalname || 'asset').toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    const ext = (safeName.split('.').pop() || 'bin').slice(0, 8);
    const stamp = Date.now();
    const objectKey = `assets/audio/courses/${courseId}/${stamp}-${safeName}`;
    const stored = await storeMediaAsset(objectKey, req.file.buffer, req.file.mimetype || 'application/octet-stream',
                                          `[course ${courseId}] add asset: ${safeName}`);
    const url = stored.url;
    const [row] = await sql`
      INSERT INTO course_assets (course_id, filename, asset_type, github_url, size_bytes)
      VALUES (${courseId}, ${safeName}, ${asset_type || ext}, ${url}, ${req.file.size || 0})
      RETURNING *
    `;
    res.status(201).json({ asset: row });
  } catch (err) { console.error('POST asset:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/admin/courses/:id/assets — list assets for a course
app.get('/api/admin/courses/:id/assets', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const courseId = parseInt(req.params.id, 10);
    const rows = await sql`SELECT * FROM course_assets WHERE course_id = ${courseId} ORDER BY uploaded_at DESC`;
    res.json({ assets: rows });
  } catch (err) { console.error('GET assets:', err); res.status(500).json({ error: err.message }); }
});

// ──────────────────────────────────────────────────────────────────
// PACK 24 phase 3 — student-side: list, fetch, complete blocks
// ──────────────────────────────────────────────────────────────────

// Resolve the set of program access keys for a given user.
// Returns a string[] like ['self','rehab'] — admins/founders always get all.
async function getUserAccessTags(userId) {
  if (!userId) return [];
  const [user] = await sql`SELECT role FROM users WHERE id = ${userId}`;
  if (!user) return [];
  if (['superadmin', 'founder', 'admin'].includes(user.role)) return ['self','guided','group','rehab'];
  // Purchases via consent_log (Pack 21 schema): map product → access tag
  // product values seen: 'lab' (Self-Guided), 'rehab' (Rehabilitation), 'guided', 'group'
  const rows = await sql`SELECT DISTINCT product FROM consent_log
    WHERE user_id = ${userId} AND payment_status IN ('paid','completed')`;
  const map = { lab: 'self', rehab: 'rehab', guided: 'guided', group: 'group' };
  const tags = new Set();
  for (const r of rows) if (map[r.product]) tags.add(map[r.product]);
  return Array.from(tags);
}

// ── Tool access (017) ──────────────────────────────────────────────────────
// A tool is available to a user when it is free-by-default, or when the user
// has access to ≥1 published course that includes it (course access reuses the
// same program_access ∩ user-access-tags rule as /api/courses). Admins: all.
async function getUserToolAccess(userId) {
  const out = {}; // code -> { unlocked, free, unlock_course:{name_ru,...}|null }
  const tools = await sql`SELECT * FROM tools ORDER BY order_idx ASC, id ASC`;
  const [me] = await sql`SELECT role FROM users WHERE id = ${userId}`;
  const isAdmin = me && ['superadmin', 'founder', 'admin'].includes(me.role);
  const access = await getUserAccessTags(userId);
  // courses the user can access (published + program_access gate)
  const courses = await sql`
    SELECT id, name_ru, name_en, name_es, program_access FROM courses WHERE is_published = true`;
  const accessibleCourseIds = new Set();
  courses.forEach(c => {
    const pa = c.program_access || [];
    if (isAdmin || pa.length === 0 || pa.some(t => access.includes(t))) accessibleCourseIds.add(c.id);
  });
  // course_tools map: tool_id -> [course rows]
  const links = await sql`SELECT ct.tool_id, c.id, c.name_ru, c.name_en, c.name_es, c.program_access, c.is_published
    FROM course_tools ct JOIN courses c ON c.id = ct.course_id`;
  const byTool = {};
  links.forEach(l => { (byTool[l.tool_id] = byTool[l.tool_id] || []).push(l); });
  tools.forEach(t => {
    let unlocked = isAdmin || !!t.is_free_default;
    let unlockCourse = null;
    const linked = byTool[t.id] || [];
    for (const l of linked) {
      if (accessibleCourseIds.has(l.id)) { unlocked = true; break; }
      if (l.is_published && !unlockCourse) unlockCourse = { name_ru: l.name_ru, name_en: l.name_en, name_es: l.name_es };
    }
    out[t.code] = { unlocked, free: !!t.is_free_default, unlock_course: unlocked ? null : unlockCourse, tool: t };
  });
  return out;
}
// Express gate helper for tool-specific endpoints → 403 if locked.
async function requireToolAccess(req, res, toolCode) {
  const userId = req.user.sub || req.user.id;
  const acc = await getUserToolAccess(userId);
  if (acc[toolCode] && acc[toolCode].unlocked) return true;
  res.status(403).json({ error: 'tool_locked', tool: toolCode, unlock_course: acc[toolCode] ? acc[toolCode].unlock_course : null });
  return false;
}

// GET /api/tools — user-facing catalogue with unlocked flags
app.get('/api/tools', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const acc = await getUserToolAccess(userId);
    const tools = Object.keys(acc).map(code => ({
      code,
      name_ru: acc[code].tool.name_ru, name_en: acc[code].tool.name_en, name_es: acc[code].tool.name_es,
      description_ru: acc[code].tool.description_ru, description_en: acc[code].tool.description_en, description_es: acc[code].tool.description_es,
      icon_url: acc[code].tool.icon_url, order_idx: acc[code].tool.order_idx,
      unlocked: acc[code].unlocked, free: acc[code].free, unlock_course: acc[code].unlock_course
    })).sort((a, b) => (a.order_idx - b.order_idx));
    res.json({ tools });
  } catch (err) { console.error('GET /api/tools:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/tools/:code/access — single-tool gate check (used by client before opening)
app.get('/api/tools/:code/access', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const acc = await getUserToolAccess(userId);
    const t = acc[req.params.code];
    if (!t) return res.status(404).json({ error: 'unknown_tool' });
    res.json({ code: req.params.code, unlocked: t.unlocked, free: t.free, unlock_course: t.unlock_course });
  } catch (err) { console.error('GET tool access:', err); res.status(500).json({ error: err.message }); }
});

// ── Admin: tools catalogue + per-course grants ──
app.get('/api/admin/tools', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const tools = await sql`SELECT * FROM tools ORDER BY order_idx ASC, id ASC`;
    res.json({ tools });
  } catch (err) { console.error('GET admin tools:', err); res.status(500).json({ error: err.message }); }
});

app.patch('/api/admin/tools/:id', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const [row] = await sql`UPDATE tools SET
      is_free_default = COALESCE(${b.is_free_default !== undefined ? !!b.is_free_default : null}, is_free_default),
      name_ru = COALESCE(${b.name_ru ?? null}, name_ru),
      name_en = COALESCE(${b.name_en ?? null}, name_en),
      name_es = COALESCE(${b.name_es ?? null}, name_es)
      WHERE id = ${id} RETURNING *`;
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ tool: row });
  } catch (err) { console.error('PATCH tool:', err); res.status(500).json({ error: err.message }); }
});

// GET tool ids attached to a course
app.get('/api/admin/courses/:id/tools', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const id = parseInt(req.params.id, 10);
    const rows = await sql`SELECT tool_id FROM course_tools WHERE course_id = ${id}`;
    res.json({ tool_ids: rows.map(r => r.tool_id) });
  } catch (err) { console.error('GET course tools:', err); res.status(500).json({ error: err.message }); }
});

// PUT — replace the set of tools attached to a course
app.put('/api/admin/courses/:id/tools', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const id = parseInt(req.params.id, 10);
    const ids = Array.isArray(req.body && req.body.tool_ids) ? req.body.tool_ids.map(n => parseInt(n, 10)).filter(Number.isFinite) : [];
    await sql`DELETE FROM course_tools WHERE course_id = ${id}`;
    for (const tid of ids) {
      await sql`INSERT INTO course_tools (course_id, tool_id) VALUES (${id}, ${tid}) ON CONFLICT DO NOTHING`;
    }
    res.json({ ok: true, tool_ids: ids });
  } catch (err) { console.error('PUT course tools:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/courses — list published courses available to the caller (gated by their access tags)
app.get('/api/courses', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    // Admin override: superadmin/founder/admin see EVERY course — published AND
    // drafts — with access-tag and language gating bypassed entirely. Each course
    // is flagged `_admin_override: true` so the UI may show an "admin access" badge.
    const [me] = await sql`SELECT role FROM users WHERE id = ${userId}`;
    if (me && ['superadmin', 'founder', 'admin'].includes(me.role)) {
      const all = await sql`
        SELECT id, slug, name_ru, name_en, name_es, description_ru, description_en, description_es,
               cover_url, program_access, languages, is_published,
               (SELECT COUNT(*) FROM course_blocks WHERE course_id = courses.id) AS block_count
        FROM courses
        ORDER BY order_idx ASC, id DESC
      `;
      const courses = all.map(c => ({ ...c, _admin_override: true }));
      return res.json({ courses, access: ['self','guided','group','rehab'], filtered_lang: null, admin_override: true });
    }
    const access = await getUserAccessTags(userId);
    // Language gate: if ?lang= is passed (current site language), show only
    // courses with that lang in their `languages` array, or with no langs set
    // (= available everywhere). Defaults to RU if absent.
    const lang = ['ru','en','es'].includes(String(req.query.lang||'').toLowerCase())
      ? String(req.query.lang).toLowerCase() : 'ru';
    const rows = await sql`
      SELECT id, slug, name_ru, name_en, name_es, description_ru, description_en, description_es,
             cover_url, program_access, languages,
             (SELECT COUNT(*) FROM course_blocks WHERE course_id = courses.id) AS block_count
      FROM courses
      WHERE is_published = true
        AND (program_access = '{}' OR program_access && ${access}::text[])
        AND (COALESCE(languages, '{}') = '{}' OR ${lang} = ANY(COALESCE(languages, '{}')))
      ORDER BY order_idx ASC, id DESC
    `;
    res.json({ courses: rows, access, filtered_lang: lang });
  } catch (err) { console.error('GET /api/courses:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/courses/:slug — get full course (with blocks) for the student
app.get('/api/courses/:slug', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const access = await getUserAccessTags(userId);
    const [me] = await sql`SELECT role FROM users WHERE id = ${userId}`;
    const isAdmin = me && ['superadmin', 'founder', 'admin'].includes(me.role);
    // Admin override: load the course even if it's a draft (is_published = false)
    // and skip the access-tag + language gates below.
    const [course] = isAdmin
      ? await sql`SELECT * FROM courses WHERE slug = ${req.params.slug}`
      : await sql`SELECT * FROM courses WHERE slug = ${req.params.slug} AND is_published = true`;
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (isAdmin) {
      course._admin_override = true;
    } else {
      // Access check
      const courseAccess = course.program_access || [];
      const hasAccess = courseAccess.length === 0 || courseAccess.some(t => access.includes(t));
      if (!hasAccess) return res.status(403).json({ error: 'No access to this course' });
      // Language check (advisory — block at the listing level but allow direct link
      // if user explicitly navigates to a course for another lang)
      const langPref = ['ru','en','es'].includes(String(req.query.lang||'').toLowerCase()) ? String(req.query.lang).toLowerCase() : null;
      if (langPref && Array.isArray(course.languages) && course.languages.length > 0 && !course.languages.includes(langPref)) {
        return res.status(404).json({ error: 'Course not available in this language' });
      }
    }
    const blocks = await sql`SELECT id, course_id, order_idx, block_type, title_ru, title_en, title_es, payload, points, parent_block_id, unlock_condition, tool_kind, tool_config
                              FROM course_blocks WHERE course_id = ${course.id} ORDER BY order_idx ASC`;
    // #4: practice blocks reference a library practice by practice_id; their audio
    // lives in the practices table, not in the block payload. Resolve audio_url
    // (+ duration) here so the player can actually render a working <audio> element.
    const practiceIds = [...new Set(blocks
      .filter(b => b.block_type === 'practice' && b.payload && b.payload.practice_id)
      .map(b => parseInt(b.payload.practice_id, 10))
      .filter(n => Number.isFinite(n)))];
    if (practiceIds.length) {
      const prRows = await sql`SELECT id, slug, lang, name, audio_url, duration_seconds FROM practices WHERE id = ANY(${practiceIds})`;
      const prMap = {};
      prRows.forEach(p => { prMap[p.id] = p; });
      blocks.forEach(b => {
        if (b.block_type === 'practice' && b.payload && b.payload.practice_id) {
          const pr = prMap[parseInt(b.payload.practice_id, 10)];
          if (pr) {
            b.payload = Object.assign({}, b.payload, {
              audio_url: pr.audio_url || b.payload.audio_url || '',
              practice_slug: b.payload.practice_slug || pr.slug,
              practice_name: b.payload.practice_name || pr.name,
              practice_lang: b.payload.practice_lang || pr.lang,
              duration_seconds: pr.duration_seconds
            });
          }
        }
      });
    }
    const progress = await sql`SELECT block_id, response, points_earned, completed_at FROM course_block_progress
                                WHERE user_id = ${userId} AND course_id = ${course.id}`;
    res.json({ course, blocks, progress });
  } catch (err) { console.error('GET /api/courses/:slug:', err); res.status(500).json({ error: err.message }); }
});

// POST /api/courses/:id/blocks/:bid/complete — mark block complete, save response, award points
app.post('/api/courses/:id/blocks/:bid/complete', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const courseId = parseInt(req.params.id, 10);
    const blockId = parseInt(req.params.bid, 10);
    const { response } = req.body || {};
    const [block] = await sql`SELECT * FROM course_blocks WHERE id = ${blockId} AND course_id = ${courseId}`;
    if (!block) return res.status(404).json({ error: 'Block not found' });
    const points = parseInt(block.points, 10) || 0;
    await sql`
      INSERT INTO course_block_progress (user_id, course_id, block_id, response, points_earned)
      VALUES (${userId}, ${courseId}, ${blockId}, ${response !== undefined ? JSON.stringify(response) : null}::jsonb, ${points})
      ON CONFLICT (user_id, block_id) DO UPDATE
        SET response = EXCLUDED.response, points_earned = EXCLUDED.points_earned, completed_at = now()
    `;
    // Determine next block: if question_branch, look up answer→next_block_id; else next by order_idx
    let nextId = null;
    if (block.block_type === 'question_branch' && response && (block.payload?.options || []).length) {
      const ans = String(response.answer || response).trim();
      const match = (block.payload.options || []).find(o =>
        (o.label && String(o.label).trim() === ans) || (o.key && String(o.key).trim() === ans)
      );
      if (match && match.next_block_id) nextId = match.next_block_id;
    }
    if (!nextId) {
      const [next] = await sql`SELECT id FROM course_blocks
        WHERE course_id = ${courseId} AND order_idx > ${block.order_idx}
        ORDER BY order_idx ASC LIMIT 1`;
      nextId = next ? next.id : null;
    }

    // ── Achievements check (Pack 26) ──
    const earnedNow = [];
    try {
      // first_block: any block ever completed
      const totalDone = await sql`SELECT COUNT(*)::int AS n FROM course_block_progress WHERE user_id = ${userId}`;
      if (totalDone[0].n >= 1) await tryAwardAchievement(userId, 'first_steps', earnedNow);
      // course_done: nextId === null means we just finished the last block
      if (!nextId) await tryAwardAchievement(userId, 'course_done', earnedNow);
      // weekly_streak: 7+ blocks completed in last 7 days
      const recent = await sql`SELECT COUNT(*)::int AS n FROM course_block_progress
                               WHERE user_id = ${userId} AND completed_at > now() - interval '7 days'`;
      if (recent[0].n >= 7) await tryAwardAchievement(userId, 'focused_streak', earnedNow);
    } catch(achErr) { console.warn('achievement check:', achErr.message); }

    // ── Team broadcasts + journey event log (Pack 30/31) ──
    try {
      await sql`INSERT INTO journey_events (user_id, kind, layer, payload, occurred_at)
                VALUES (${userId}, 'block_done', 'practice', ${JSON.stringify({
                  course_id: courseId, block_id: blockId,
                  block_type: block.block_type, points: points
                })}::jsonb, now())`;
    } catch (jeErr) { console.warn('journey log:', jeErr.message); }

    // 🅱 tool_task: persist the instrument result onto the unified timeline so it
    // surfaces in the right Evolution Path layer (and the path map) exactly like a
    // standalone instrument entry. Mapping kind → {journey kind, layer}.
    if (block.block_type === 'tool_task' && block.tool_kind) {
      const TOOL_JOURNEY = {
        sensation_map:    { kind: 'sensation', layer: 'sensation' },
        point_ab:         { kind: 'event',     layer: 'event' },
        diary:            { kind: 'insight',   layer: 'insight' },
        neuromap_emotion: { kind: 'emotion',   layer: 'emotion' },
        neuromap_event:   { kind: 'event',     layer: 'event' },
        neuromap_thought: { kind: 'thought',   layer: 'thought' }
      };
      const map = TOOL_JOURNEY[block.tool_kind];
      if (map) {
        try {
          // cap the label to a word boundary so it never lands as mid-word junk
          var rawLabel = (response && (response.label || response.text)) || block.title_ru || '';
          rawLabel = String(rawLabel).replace(/\s+/g, ' ').trim();
          if (rawLabel.length > 80) {
            var sp = rawLabel.slice(0, 80).lastIndexOf(' ');
            rawLabel = rawLabel.slice(0, sp >= 40 ? sp : 80).replace(/[\s,.;:—–-]+$/, '');
          }
          await logJourney(userId, map.kind, map.layer, {
            source: 'course_tool_task', tool_kind: block.tool_kind,
            course_id: courseId, block_id: blockId,
            label: rawLabel,
            valence: (response && response.valence) || 'neutral',
            comment: (response && (response.comment || response.text)) || '',
            response: response || {}
          }, null);
        } catch (ttErr) { console.warn('tool_task journey:', ttErr.message); }
      }
    }

    const teamPayload = {
      user_id: userId,
      course_id: courseId,
      block_id: blockId,
      block_title: block.title_ru || block.block_type,
      points: points
    };
    await broadcastToTeams(userId, 'block_done', teamPayload);
    if (!nextId) {
      await broadcastToTeams(userId, 'course_done', { user_id: userId, course_id: courseId });
    }

    // ── Peer progress broadcast (Pack 29) ──
    // Notify other users with public profile that this user just finished
    // a block / a course. Receivers can react with «делать вместе» or just
    // see it as a 'X прошёл блок Y' card.
    try {
      const [actor] = await sql`SELECT display_name, profile_public FROM users WHERE id = ${userId}`;
      const [course] = await sql`SELECT name_ru, slug FROM courses WHERE id = ${courseId}`;
      if (actor && actor.profile_public !== false) {
        const isCourseDone = !nextId;
        const kind = isCourseDone ? 'peer_course_done' : 'peer_progress';
        const payload = {
          user_id: userId,
          user_name: actor.display_name || null,
          course_id: courseId,
          course_name: course?.name_ru || course?.slug || null,
          block_id: blockId,
          block_title: block.title_ru || block.block_type,
          completed_at: new Date().toISOString()
        };
        await sql`INSERT INTO notifications (user_id, kind, payload)
                  SELECT id, ${kind}, ${JSON.stringify(payload)}::jsonb
                  FROM users
                  WHERE notifications_enabled = true AND deleted_at IS NULL AND id <> ${userId}
                    AND NOT (${kind} = ANY(COALESCE(notif_mute, '{}'::text[])))`;
      }
    } catch (peerErr) { console.warn('peer broadcast:', peerErr.message); }

    res.json({ ok: true, next_block_id: nextId, points_earned: points, earned_achievements: earnedNow });
  } catch (err) { console.error('POST complete:', err); res.status(500).json({ error: err.message }); }
});

// ── Pack 30: Teams — owner-configurable broadcasts ──
// Sends a per-team notification (kind='team_X') to each team-mate when this
// event kind is enabled in the team's broadcast_kinds array.
async function broadcastToTeams(actorUserId, kind, payload) {
  try {
    const teams = await sql`
      SELECT t.id, t.name, t.broadcast_kinds
      FROM teams t
      JOIN team_members m ON m.team_id = t.id
      WHERE m.user_id = ${actorUserId} AND ${kind} = ANY(COALESCE(t.broadcast_kinds, '{}'::text[]))`;
    if (!teams.length) return;
    for (const t of teams) {
      const enriched = Object.assign({}, payload, { team_id: t.id, team_name: t.name });
      await sql`
        INSERT INTO notifications (user_id, kind, payload)
        SELECT m.user_id, ${'team_' + kind}, ${JSON.stringify(enriched)}::jsonb
        FROM team_members m
        JOIN users u ON u.id = m.user_id
        WHERE m.team_id = ${t.id} AND m.user_id <> ${actorUserId}
          AND u.notifications_enabled = true AND u.deleted_at IS NULL
          AND NOT (${'team_' + kind} = ANY(COALESCE(u.notif_mute, '{}'::text[])))`;
    }
  } catch (e) { console.warn('broadcastToTeams:', e.message); }
}

// GET /api/teams — teams I'm in (any role)
app.get('/api/teams', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const rows = await sql`
      SELECT t.*, m.role AS my_role,
             (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count
      FROM teams t JOIN team_members m ON m.team_id = t.id AND m.user_id = ${me}
      ORDER BY t.created_at DESC`;
    res.json({ teams: rows });
  } catch (err) { console.error('GET teams:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/teams/search?q=… — discover public teams to join. Returns only
// public, non-family teams. MUST be registered before /api/teams/:id so the
// literal 'search' segment isn't captured as an :id. (PR91)
app.get('/api/teams/search', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q.length < 2) return res.json({ teams: [] });
    const like = '%' + q + '%';
    const rows = await sql`
      SELECT t.id, t.name, t.description, t.slug,
             (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count,
             EXISTS(SELECT 1 FROM team_members WHERE team_id = t.id AND user_id = ${me}) AS is_member
      FROM teams t
      WHERE t.kind = 'team' AND t.is_public = TRUE
        AND (lower(t.name) LIKE ${like} OR lower(coalesce(t.description,'')) LIKE ${like})
      ORDER BY member_count DESC, t.created_at DESC
      LIMIT 25`;
    res.json({ teams: rows });
  } catch (err) { console.error('GET teams/search:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/teams/:id — team detail with members
app.get('/api/teams/:id', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const tid = parseInt(req.params.id, 10);
    const [t] = await sql`SELECT * FROM teams WHERE id = ${tid}`;
    if (!t) return res.status(404).json({ error: 'Team not found' });
    const [member] = await sql`SELECT role FROM team_members WHERE team_id = ${tid} AND user_id = ${me}`;
    if (!member && !t.is_public) return res.status(403).json({ error: 'Not a member' });
    const members = await sql`
      SELECT tm.role, tm.joined_at, u.id, u.display_name, u.email
      FROM team_members tm JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = ${tid} ORDER BY tm.joined_at ASC`;
    res.json({ team: t, members, my_role: member?.role || null });
  } catch (err) { console.error('GET team:', err); res.status(500).json({ error: err.message }); }
});

// Kin roles a family member can hold (validated server-side).
const FAMILY_ROLES = ['mother','father','spouse','partner','son','daughter','brother','sister','grandmother','grandfather','grandchild','aunt','uncle','cousin','other'];
// POST /api/teams — create a team OR a family (creator = owner). For a family,
// kind='family', the creator's kin role comes in my_role, and members[] may carry
// per-member {email|user_id, role} so the whole family can be set up at once.
app.post('/api/teams', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const { name, description, broadcast_kinds, is_public, kind, my_role, members } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
    const teamKind = kind === 'family' ? 'family' : 'team';
    const slug = String(name).toLowerCase().replace(/[^a-z0-9а-я]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40) + '-' + Date.now();
    const kinds = Array.isArray(broadcast_kinds) ? broadcast_kinds : ['block_done','course_done','achievement_earned'];
    const [t] = await sql`INSERT INTO teams (slug, name, description, owner_user_id, broadcast_kinds, is_public, kind)
                          VALUES (${slug}, ${name.trim()}, ${description||''}, ${me}, ${kinds}::text[], ${!!is_public}, ${teamKind})
                          RETURNING *`;
    // owner row — for a family keep the kin role too (still the structural owner)
    const ownerRole = (teamKind === 'family' && FAMILY_ROLES.includes(my_role)) ? my_role : 'owner';
    await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${t.id}, ${me}, ${ownerRole})`;
    // inline members (best-effort; unknown emails are skipped, not fatal)
    let added = 0;
    if (Array.isArray(members)) {
      for (const m of members.slice(0, 40)) {
        let uid = m && m.user_id ? m.user_id : null;
        if (!uid && m && m.email) { const [u] = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${String(m.email)})`; if (u) uid = u.id; }
        if (!uid || String(uid) === String(me)) continue;
        const role = (teamKind === 'family' && FAMILY_ROLES.includes(m && m.role)) ? m.role : 'member';
        await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${t.id}, ${uid}, ${role}) ON CONFLICT DO NOTHING`;
        try { await notifyUser(uid, 'team_invite', { team_id: t.id, team_name: t.name, inviter: me }); } catch (e) {}
        added++;
      }
    }
    res.status(201).json({ team: t, members_added: added });
  } catch (err) { console.error('POST team:', err); res.status(500).json({ error: err.message }); }
});

// PATCH /api/teams/:id — owner edits team settings (incl. broadcast kinds)
app.patch('/api/teams/:id', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const tid = parseInt(req.params.id, 10);
    const [t] = await sql`SELECT owner_user_id FROM teams WHERE id = ${tid}`;
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (t.owner_user_id !== me) return res.status(403).json({ error: 'Owner only' });
    const b = req.body || {};
    const [updated] = await sql`UPDATE teams SET
      name = COALESCE(${b.name}, name),
      description = COALESCE(${b.description}, description),
      broadcast_kinds = COALESCE(${Array.isArray(b.broadcast_kinds) ? b.broadcast_kinds : null}::text[], broadcast_kinds),
      is_public = COALESCE(${b.is_public !== undefined ? !!b.is_public : null}, is_public),
      updated_at = now()
      WHERE id = ${tid} RETURNING *`;
    res.json({ team: updated });
  } catch (err) { console.error('PATCH team:', err); res.status(500).json({ error: err.message }); }
});

// DELETE /api/teams/:id — owner disbands team
app.delete('/api/teams/:id', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const tid = parseInt(req.params.id, 10);
    const [t] = await sql`SELECT owner_user_id FROM teams WHERE id = ${tid}`;
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (t.owner_user_id !== me) return res.status(403).json({ error: 'Owner only' });
    await sql`DELETE FROM teams WHERE id = ${tid}`;
    res.json({ ok: true });
  } catch (err) { console.error('DELETE team:', err); res.status(500).json({ error: err.message }); }
});

// POST /api/teams/:id/members — owner adds member by email
app.post('/api/teams/:id/members', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const tid = parseInt(req.params.id, 10);
    const [t] = await sql`SELECT owner_user_id, name FROM teams WHERE id = ${tid}`;
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (t.owner_user_id !== me) return res.status(403).json({ error: 'Owner only' });
    const { email, user_id } = req.body || {};
    let uid = user_id || null;
    if (!uid && email) {
      const [u] = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${email})`;
      if (!u) return res.status(404).json({ error: 'User not found' });
      uid = u.id;
    }
    if (!uid) return res.status(400).json({ error: 'email or user_id required' });
    const role = FAMILY_ROLES.includes(req.body && req.body.role) ? req.body.role : 'member';
    await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${tid}, ${uid}, ${role}) ON CONFLICT DO NOTHING`;
    await notifyUser(uid, 'team_invite', { team_id: tid, team_name: t.name, inviter: me });
    res.json({ ok: true });
  } catch (err) { console.error('add member:', err); res.status(500).json({ error: err.message }); }
});

// DELETE /api/teams/:id/members/:uid — owner removes a member
app.delete('/api/teams/:id/members/:uid', requireAuth, async (req, res) => {
  try {
    const me = String(req.user.sub || req.user.id);
    const tid = parseInt(req.params.id, 10);
    const target = String(req.params.uid);
    const [t] = await sql`SELECT owner_user_id, kind FROM teams WHERE id = ${tid}`;
    if (!t) return res.status(404).json({ error: 'Not found' });
    const owner = String(t.owner_user_id);
    const isOwner = owner === me;
    const isSelf = target === me;
    // PR94 (#3): on a FAMILY, any member may remove another NON-owner member — this
    // is how a legacy "сын" card gets cleared even when the caller isn't the
    // structural owner (old families can have owner_user_id set to someone else).
    // The owner can never be removed by others. On work TEAMS keep owner-or-self.
    let allowed = isOwner || isSelf;
    if (!allowed && t.kind === 'family' && target !== owner) {
      const [mem] = await sql`SELECT 1 FROM team_members WHERE team_id = ${tid} AND user_id = ${me}`;
      if (mem) allowed = true;
    }
    if (!allowed) return res.status(403).json({ error: 'Not permitted' });
    await sql`DELETE FROM team_members WHERE team_id = ${tid} AND user_id = ${target}`;
    res.json({ ok: true });
  } catch (err) { console.error('rm member:', err); res.status(500).json({ error: err.message }); }
});

// POST /api/teams/:id/announce — owner posts an announcement to team (notification fanout)
app.post('/api/teams/:id/announce', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const tid = parseInt(req.params.id, 10);
    const [t] = await sql`SELECT owner_user_id, name, broadcast_kinds FROM teams WHERE id = ${tid}`;
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (t.owner_user_id !== me) return res.status(403).json({ error: 'Owner only' });
    const { body } = req.body || {};
    if (!body || !String(body).trim()) return res.status(400).json({ error: 'body required' });
    await sql`
      INSERT INTO notifications (user_id, kind, payload)
      SELECT m.user_id, 'team_announcement', ${JSON.stringify({ team_id: tid, team_name: t.name, body: String(body).slice(0, 500), from: me })}::jsonb
      FROM team_members m JOIN users u ON u.id = m.user_id
      WHERE m.team_id = ${tid} AND m.user_id <> ${me}
        AND u.notifications_enabled = true AND u.deleted_at IS NULL
        AND NOT ('team_announcement' = ANY(COALESCE(u.notif_mute, '{}'::text[])))`;
    res.json({ ok: true });
  } catch (err) { console.error('team announce:', err); res.status(500).json({ error: err.message }); }
});

// PATCH /api/teams/:id/leader — transfer leadership (🅵 п.29). Only the current
// owner may transfer; the new leader must already be a member. Enforces a single
// leader: the old owner becomes a normal member, the target becomes owner.
app.patch('/api/teams/:id/leader', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const tid = parseInt(req.params.id, 10);
    const newLeader = req.body && req.body.user_id;
    if (!newLeader) return res.status(400).json({ error: 'user_id required' });
    const [t] = await sql`SELECT owner_user_id FROM teams WHERE id = ${tid}`;
    if (!t) return res.status(404).json({ error: 'Team not found' });
    if (String(t.owner_user_id) !== String(me)) return res.status(403).json({ error: 'Only the current leader can transfer leadership' });
    const [mem] = await sql`SELECT 1 FROM team_members WHERE team_id = ${tid} AND user_id = ${newLeader}`;
    if (!mem) return res.status(400).json({ error: 'New leader must be a team member' });
    await sql`UPDATE teams SET owner_user_id = ${newLeader}, updated_at = now() WHERE id = ${tid}`;
    // reflect roles in team_members (single owner)
    await sql`UPDATE team_members SET role = 'member' WHERE team_id = ${tid} AND role = 'owner'`;
    await sql`UPDATE team_members SET role = 'owner' WHERE team_id = ${tid} AND user_id = ${newLeader}`;
    res.json({ ok: true, owner_user_id: newLeader });
  } catch (err) { console.error('team leader transfer:', err); res.status(500).json({ error: err.message }); }
});

// ───────────────────────────────────────────────────────────────────────────
// PR91 — Family & Team (Phase 2A). Invite links (family + team), team search,
// dependent profiles (children/etc. who are not platform users).
// ───────────────────────────────────────────────────────────────────────────

// POST /api/teams/:id/invite — owner generates a shareable invite token/link.
// Works for both family and team. Body: { role?, max_uses?, expires_in_days? }.
app.post('/api/teams/:id/invite', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const tid = parseInt(req.params.id, 10);
    const [t] = await sql`SELECT owner_user_id, kind FROM teams WHERE id = ${tid}`;
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (String(t.owner_user_id) !== String(me)) return res.status(403).json({ error: 'Owner only' });
    const b = req.body || {};
    const role = (t.kind === 'family' && FAMILY_ROLES.includes(b.role)) ? b.role : 'member';
    const maxUses = (b.max_uses != null && !isNaN(parseInt(b.max_uses, 10))) ? Math.max(1, parseInt(b.max_uses, 10)) : null;
    const days = (b.expires_in_days != null && !isNaN(parseInt(b.expires_in_days, 10))) ? parseInt(b.expires_in_days, 10) : 30;
    const expiresAt = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
    const token = crypto.randomBytes(18).toString('base64url');
    await sql`INSERT INTO team_invites (token, team_id, created_by, role, max_uses, expires_at)
              VALUES (${token}, ${tid}, ${me}, ${role}, ${maxUses}, ${expiresAt})`;
    res.status(201).json({ ok: true, token, team_id: tid, kind: t.kind, role, expires_at: expiresAt });
  } catch (err) { console.error('POST team invite:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/teams/join/:token — preview an invite (no membership change yet).
app.get('/api/teams/join/:token', requireAuth, async (req, res) => {
  try {
    const [inv] = await sql`SELECT i.*, t.name AS team_name, t.kind AS team_kind, t.description
                            FROM team_invites i JOIN teams t ON t.id = i.team_id
                            WHERE i.token = ${req.params.token}`;
    if (!inv) return res.status(404).json({ error: 'Invite not found' });
    const expired = inv.expires_at && new Date(inv.expires_at) < new Date();
    const exhausted = inv.max_uses != null && inv.use_count >= inv.max_uses;
    res.json({ ok: true, valid: !expired && !exhausted, expired: !!expired, exhausted: !!exhausted,
               team_id: inv.team_id, team_name: inv.team_name, kind: inv.team_kind, description: inv.description, role: inv.role });
  } catch (err) { console.error('GET join preview:', err); res.status(500).json({ error: err.message }); }
});

// POST /api/teams/join/:token — accept an invite and become a member.
app.post('/api/teams/join/:token', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const [inv] = await sql`SELECT * FROM team_invites WHERE token = ${req.params.token}`;
    if (!inv) return res.status(404).json({ error: 'Invite not found' });
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: 'Invite expired' });
    if (inv.max_uses != null && inv.use_count >= inv.max_uses) return res.status(410).json({ error: 'Invite already used up' });
    const [t] = await sql`SELECT id, name FROM teams WHERE id = ${inv.team_id}`;
    if (!t) return res.status(404).json({ error: 'Team no longer exists' });
    const [already] = await sql`SELECT 1 FROM team_members WHERE team_id = ${inv.team_id} AND user_id = ${me}`;
    if (!already) {
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${inv.team_id}, ${me}, ${inv.role}) ON CONFLICT DO NOTHING`;
      await sql`UPDATE team_invites SET use_count = use_count + 1 WHERE token = ${inv.token}`;
      try { await notifyUser(inv.created_by, 'team_joined', { team_id: inv.team_id, team_name: t.name, joiner: me }); } catch (e) {}
    }
    res.json({ ok: true, team_id: inv.team_id, already_member: !!already });
  } catch (err) { console.error('POST join:', err); res.status(500).json({ error: err.message }); }
});

// POST /api/teams/:id/join — directly join a PUBLIC team (no invite needed).
// Public teams are discoverable via /api/teams/search and open to join. Families
// and private teams still require an invite link or owner add.
app.post('/api/teams/:id/join', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const tid = parseInt(req.params.id, 10);
    const [t] = await sql`SELECT id, name, kind, is_public, owner_user_id FROM teams WHERE id = ${tid}`;
    if (!t) return res.status(404).json({ error: 'Not found' });
    if (t.kind === 'family' || !t.is_public) return res.status(403).json({ error: 'This team requires an invite' });
    const [already] = await sql`SELECT 1 FROM team_members WHERE team_id = ${tid} AND user_id = ${me}`;
    if (!already) {
      await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${tid}, ${me}, 'member') ON CONFLICT DO NOTHING`;
      try { await notifyUser(t.owner_user_id, 'team_joined', { team_id: tid, team_name: t.name, joiner: me }); } catch (e) {}
    }
    res.json({ ok: true, team_id: tid, already_member: !!already });
  } catch (err) { console.error('POST team join:', err); res.status(500).json({ error: err.message }); }
});

// ── Dependent profiles (children / family members without their own account) ──

// Compute a life phase from birth_date / expected_due_date. Returns the phase
// label plus, for the prenatal case, the gestational age in weeks.
function dependentPhase(dep) {
  const now = Date.now();
  if (!dep.birth_date && dep.expected_due_date) {
    const due = new Date(dep.expected_due_date).getTime();
    const weeks = Math.max(0, Math.min(42, Math.round(40 - (due - now) / (7 * 86400000))));
    return { phase: 'prenatal', gestation_weeks: weeks };
  }
  if (!dep.birth_date) return { phase: 'unknown' };
  const ageYears = (now - new Date(dep.birth_date).getTime()) / (365.25 * 86400000);
  let phase = 'adult';
  if (ageYears < 1) phase = 'infant';
  else if (ageYears < 3) phase = 'toddler';
  else if (ageYears < 12) phase = 'child';
  else if (ageYears < 18) phase = 'adolescent';
  return { phase, age_years: Math.floor(ageYears) };
}
function shapeDependent(dep) {
  return Object.assign({}, dep, dependentPhase(dep));
}

// POST /api/dependents — create a child/dependent owned by the caller.
app.post('/api/dependents', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const b = req.body || {};
    const name = String(b.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    const sex = ['male', 'female', 'other'].includes(b.sex) ? b.sex : null;
    const birthDate = b.birth_date ? String(b.birth_date).slice(0, 10) : null;
    const dueDate = b.expected_due_date ? String(b.expected_due_date).slice(0, 10) : null;
    if (!birthDate && !dueDate) return res.status(400).json({ error: 'birth_date or expected_due_date required' });
    const trackFrom = b.track_from ? String(b.track_from).slice(0, 10) : null;
    const relation = b.relation ? String(b.relation).slice(0, 40) : null;
    const diagnoses = Array.isArray(b.diagnoses_ids) ? b.diagnoses_ids.map(n => parseInt(n, 10)).filter(n => !isNaN(n)) : [];
    // family_id: validate the caller owns/belongs to that family team
    let familyId = null;
    if (b.family_id != null) {
      const fid = parseInt(b.family_id, 10);
      const [fm] = await sql`SELECT 1 FROM team_members WHERE team_id = ${fid} AND user_id = ${me}`;
      if (fm) familyId = fid;
    }
    const [dep] = await sql`INSERT INTO dependent_profiles
      (owner_user_id, family_id, name, sex, birth_date, expected_due_date, track_from, relation, diagnoses_ids)
      VALUES (${me}, ${familyId}, ${name}, ${sex}, ${birthDate}, ${dueDate}, ${trackFrom}, ${relation}, ${diagnoses}::int[])
      RETURNING *`;
    res.status(201).json({ ok: true, dependent: shapeDependent(dep) });
  } catch (err) { console.error('POST dependents:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/dependents — list the caller's dependents.
app.get('/api/dependents', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const rows = await sql`SELECT * FROM dependent_profiles
      WHERE owner_user_id = ${me} AND deleted_at IS NULL ORDER BY created_at ASC`;
    res.json({ ok: true, dependents: rows.map(shapeDependent) });
  } catch (err) { console.error('GET dependents:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/dependents/:id — one dependent (owner only).
app.get('/api/dependents/:id', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const [dep] = await sql`SELECT * FROM dependent_profiles
      WHERE id = ${parseInt(req.params.id, 10)} AND owner_user_id = ${me} AND deleted_at IS NULL`;
    if (!dep) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, dependent: shapeDependent(dep) });
  } catch (err) { console.error('GET dependent:', err); res.status(500).json({ error: err.message }); }
});

// PATCH /api/dependents/:id — update fields (owner only).
app.patch('/api/dependents/:id', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const id = parseInt(req.params.id, 10);
    const [dep] = await sql`SELECT * FROM dependent_profiles WHERE id = ${id} AND owner_user_id = ${me} AND deleted_at IS NULL`;
    if (!dep) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    const name = b.name != null ? String(b.name).trim() : null;
    const sex = (b.sex != null) ? (['male', 'female', 'other'].includes(b.sex) ? b.sex : null) : undefined;
    const birthDate = b.birth_date !== undefined ? (b.birth_date ? String(b.birth_date).slice(0, 10) : null) : undefined;
    const dueDate = b.expected_due_date !== undefined ? (b.expected_due_date ? String(b.expected_due_date).slice(0, 10) : null) : undefined;
    const trackFrom = b.track_from !== undefined ? (b.track_from ? String(b.track_from).slice(0, 10) : null) : undefined;
    const relation = b.relation !== undefined ? (b.relation ? String(b.relation).slice(0, 40) : null) : undefined;
    const diagnoses = Array.isArray(b.diagnoses_ids) ? b.diagnoses_ids.map(n => parseInt(n, 10)).filter(n => !isNaN(n)) : undefined;
    const [updated] = await sql`UPDATE dependent_profiles SET
      name = COALESCE(${name}, name),
      sex = ${sex === undefined ? dep.sex : sex},
      birth_date = ${birthDate === undefined ? dep.birth_date : birthDate}::date,
      expected_due_date = ${dueDate === undefined ? dep.expected_due_date : dueDate}::date,
      track_from = ${trackFrom === undefined ? dep.track_from : trackFrom}::date,
      relation = ${relation === undefined ? dep.relation : relation},
      diagnoses_ids = ${diagnoses === undefined ? dep.diagnoses_ids : diagnoses}::int[],
      updated_at = now()
      WHERE id = ${id} RETURNING *`;
    res.json({ ok: true, dependent: shapeDependent(updated) });
  } catch (err) { console.error('PATCH dependent:', err); res.status(500).json({ error: err.message }); }
});

// DELETE /api/dependents/:id — soft-delete (owner only).
app.delete('/api/dependents/:id', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const id = parseInt(req.params.id, 10);
    const [dep] = await sql`SELECT 1 FROM dependent_profiles WHERE id = ${id} AND owner_user_id = ${me} AND deleted_at IS NULL`;
    if (!dep) return res.status(404).json({ error: 'Not found' });
    await sql`UPDATE dependent_profiles SET deleted_at = now() WHERE id = ${id}`;
    res.json({ ok: true });
  } catch (err) { console.error('DELETE dependent:', err); res.status(500).json({ error: err.message }); }
});

// ── Pack 29: User journey + admin path-map grid ──

// GET /api/users/me/journey — full progress + XP for the calling user
app.get('/api/users/me/journey', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const courses = await sql`
      SELECT c.id, c.slug, c.name_ru, c.name_en, c.name_es, c.cover_url,
             (SELECT COUNT(*) FROM course_blocks WHERE course_id = c.id) AS total_blocks,
             (SELECT COUNT(*) FROM course_block_progress WHERE user_id = ${me} AND course_id = c.id) AS done_blocks
      FROM courses c
      WHERE c.is_published = true
      ORDER BY c.order_idx ASC, c.id DESC
    `;
    const xpRow = await sql`
      SELECT COALESCE(SUM(points_earned),0)::int AS xp_blocks FROM course_block_progress WHERE user_id = ${me}
    `;
    const achRow = await sql`
      SELECT COALESCE(SUM(a.xp_reward),0)::int AS xp_ach
      FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id
      WHERE ua.user_id = ${me}
    `;
    const recent = await sql`
      SELECT cbp.course_id, cbp.block_id, cbp.points_earned, cbp.completed_at,
             cb.title_ru AS block_title, cb.block_type, c.slug AS course_slug, c.name_ru AS course_name
      FROM course_block_progress cbp
      LEFT JOIN course_blocks cb ON cb.id = cbp.block_id
      LEFT JOIN courses c ON c.id = cbp.course_id
      WHERE cbp.user_id = ${me}
      ORDER BY cbp.completed_at DESC LIMIT 25
    `;
    res.json({
      total_xp: (xpRow[0].xp_blocks||0) + (achRow[0].xp_ach||0),
      xp_breakdown: { blocks: xpRow[0].xp_blocks, achievements: achRow[0].xp_ach },
      courses,
      recent
    });
  } catch (err) { console.error('GET me/journey:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/users/me/evolution — Mycelium Stage 2 (Personal Evolution Path).
// Event-centric, read-only aggregation of the user's journey.
//
// PRIMARY source is journey_events (Pack 31.5): every emotion / event / thought /
// sensation / practice / insight / xp_gain the user logs in ANY instrument lands
// here as a real, time-accurate row with a stable id + payload. Each returned
// item carries { id, kind, layer, occurred_at, t, label, valence, weight,
// source, payload, links } so the frontend can render a clickable detail card
// and draw the journey_links between related events.
//
// LEGACY fallbacks (nm_nodes aggregate, calendar_events, neuro_resource_diary,
// course_block_progress) fill a layer ONLY when journey_events has nothing for
// it — so pre-Pack-31.5 data still shows, but is never double-counted.
//
// Filtering: ?from=<ISO>&to=<ISO> takes precedence; otherwise ?period=
// day|week|month|3months|year|all. Every query is fault-tolerant.

// PR FIX #2: per-layer significance threshold for Path-of-Development overlays.
// Only meaningful events get through; returns { pass, color: yellow|orange|red }.
function overlayThreshold(r) {
  const layer = r.layer, et = r.event_type || '', sev = String(r.severity || ''), title = String(r.title || ''), desc = String(r.description || '');
  const num = (re) => { const m = sev.match(re) || title.match(re); return m ? parseFloat(m[1]) : null; };
  if (layer === 'sun') {
    if (et === 'flare') {
      const cm = sev.match(/([BCMX])\s*[\d.]*/i) || title.match(/([BCMX])\s*[\d.]*/i);
      if (!cm) return { pass: false };
      const C = cm[1].toUpperCase();
      if (C === 'B') return { pass: false };                 // skip B-class flares
      return { pass: true, color: C === 'X' ? 'red' : C === 'M' ? 'orange' : 'yellow' };
    }
    if (et === 'geomagnetic_storm' || et === 'kp_index') {
      const kp = num(/Kp\s*([\d.]+)/i);
      if (kp != null && kp >= 5) return { pass: true, color: kp >= 9 ? 'red' : kp >= 7 ? 'orange' : 'yellow' };
    }
    return { pass: false };                                   // skip solar_wind / f107 / xray / cme noise
  }
  if (layer === 'earth') {
    if (et === 'earthquake') { const mag = num(/M\s*([\d.]+)/i); if (mag != null && mag >= 5) return { pass: true, color: mag >= 7 ? 'red' : mag >= 6 ? 'orange' : 'yellow' }; }
    if (et === 'geomagnetic_storm' || et === 'kp_index') { const kp = num(/Kp\s*([\d.]+)/i); if (kp != null && kp >= 5) return { pass: true, color: kp >= 9 ? 'red' : kp >= 7 ? 'orange' : 'yellow' }; }
    return { pass: false };
  }
  if (layer === 'moon') {
    const isNF = /\b(new|full)\b/i.test(title + ' ' + sev) || /полнолун|новолун/i.test(title);
    return isNF ? { pass: true, color: 'yellow' } : { pass: false };
  }
  if (layer === 'weather') {
    const uv = num(/UV\s*([\d.]+)/i); if (uv != null && uv >= 9) return { pass: true, color: uv >= 11 ? 'red' : 'yellow' };
    const aqi = num(/AQI\s*([\d.]+)/i); if (aqi != null && aqi >= 150) return { pass: true, color: aqi >= 300 ? 'red' : 'orange' };
    const tmp = num(/(-?[\d.]+)\s*°?\s*C/i); if (tmp != null && (tmp > 35 || tmp < -20)) return { pass: true, color: 'orange' };
    if (/high|severe|extreme/i.test(sev)) return { pass: true, color: 'red' };
    return { pass: false };
  }
  if (layer === 'cosmos') {
    if (et === 'gw_candidate') {
      if (/terrestrial|uncertain|retract/i.test(title + ' ' + sev + ' ' + desc)) return { pass: false };
      return { pass: true, color: /BBH|BNS|NSBH/i.test(title + ' ' + sev + ' ' + desc) ? 'orange' : 'yellow' };
    }
    return { pass: false };
  }
  if (layer === 'social') {
    if (/crisis|disaster|war|conflict|election|emergency|attack|flood|wildfire/i.test(title + ' ' + desc)) return { pass: true, color: 'orange' };
    return { pass: false };
  }
  if (layer === 'experimental') {
    const hz = num(/([\d.]+)\s*Hz/i); if (hz != null && Math.abs(hz - 7.83) >= 1) return { pass: true, color: 'orange' };
    return { pass: false };
  }
  return { pass: true, color: 'yellow' };
}

app.get('/api/users/me/evolution', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const period = ['day','week','month','3months','year','all'].includes(String(req.query.period||'').toLowerCase())
      ? String(req.query.period).toLowerCase() : 'month';
    const days = { day:1, week:7, month:30, '3months':90, year:365, all:36500 }[period];

    // from/to override period when valid
    let fromD = new Date(Date.now() - days*24*60*60*1000);
    let toD = new Date();
    if (req.query.from) { const d = new Date(req.query.from); if (!isNaN(d.getTime())) fromD = d; }
    if (req.query.to)   { const d = new Date(req.query.to);   if (!isNaN(d.getTime())) toD = d; }
    if (toD <= fromD) toD = new Date(fromD.getTime() + 1000);
    const fromIso = fromD.toISOString(), toIso = toD.toISOString();
    const spanDays = Math.max(1, (toD - fromD) / (24*60*60*1000));

    const safe = (p) => p.then(r => r).catch(() => []);
    const clamp01 = (n) => Math.max(0, Math.min(1, n));

    // PR91: ?subject=dependent:<id> | team:<id> — read another scope's path (GET
    // only; events are still WRITTEN against the authenticated user). Default
    // scope is the caller's own journey. dependent → journey_events attributed to
    // that dependent_id (owner-gated); team → all members' events. Legacy fallback
    // sources (neuromap/calendar/diary/course-blocks) are user-only so they're
    // skipped for non-self scopes.
    let depId = null, teamUserIds = null, scopeValid = true;
    const subject = String(req.query.subject || '').trim();
    if (subject.startsWith('dependent:')) {
      const id = parseInt(subject.slice(10), 10);
      if (!isNaN(id)) {
        const [dep] = await safe(sql`SELECT id FROM dependent_profiles WHERE id = ${id} AND owner_user_id = ${me} AND deleted_at IS NULL`).then(r => [r[0]]).catch(() => [null]);
        if (dep) depId = id; else scopeValid = false;
      } else scopeValid = false;
    } else if (subject.startsWith('team:')) {
      const id = parseInt(subject.slice(5), 10);
      if (!isNaN(id)) {
        const mem = await safe(sql`SELECT 1 FROM team_members WHERE team_id = ${id} AND user_id = ${me}`);
        if (mem.length) {
          const rows = await safe(sql`SELECT user_id FROM team_members WHERE team_id = ${id}`);
          teamUserIds = rows.map(r => r.user_id);
        } else scopeValid = false;
      } else scopeValid = false;
    }
    if (!scopeValid) return res.status(403).json({ error: 'Subject not accessible' });

    const selfScope = !depId && !teamUserIds;
    let je;
    if (depId) {
      je = await safe(sql`SELECT id, kind, layer, payload, occurred_at FROM journey_events
                          WHERE dependent_id = ${depId} AND occurred_at >= ${fromIso} AND occurred_at <= ${toIso}
                          ORDER BY occurred_at ASC`);
    } else if (teamUserIds) {
      je = await safe(sql`SELECT id, kind, layer, payload, occurred_at FROM journey_events
                          WHERE user_id = ANY(${teamUserIds}::uuid[]) AND dependent_id IS NULL
                            AND occurred_at >= ${fromIso} AND occurred_at <= ${toIso}
                          ORDER BY occurred_at ASC`);
    } else {
      je = await safe(sql`SELECT id, kind, layer, payload, occurred_at FROM journey_events
                          WHERE user_id = ${me} AND dependent_id IS NULL
                            AND occurred_at >= ${fromIso} AND occurred_at <= ${toIso}
                          ORDER BY occurred_at ASC`);
    }
    const [cbp, nm, cal, diary] = selfScope ? await Promise.all([
      safe(sql`SELECT cbp.points_earned, cbp.completed_at, cb.block_type
               FROM course_block_progress cbp LEFT JOIN course_blocks cb ON cb.id = cbp.block_id
               WHERE cbp.user_id = ${me} AND cbp.completed_at >= ${fromIso} AND cbp.completed_at <= ${toIso}
               ORDER BY cbp.completed_at ASC`),
      safe(sql`SELECT id, type, label, valence, count, last_seen_at FROM nm_nodes
               WHERE user_id = ${me} AND last_seen_at >= ${fromIso} AND last_seen_at <= ${toIso}
               ORDER BY last_seen_at ASC`),
      safe(sql`SELECT id, title, event_type, date_key, done, done_at, created_at FROM calendar_events
               WHERE user_id = ${me} AND created_at >= ${fromIso} AND created_at <= ${toIso}
               ORDER BY created_at ASC`),
      safe(sql`SELECT id, text, comment, plus_count, minus_count, date_key, created_at FROM neuro_resource_diary
               WHERE user_id = ${me} AND created_at >= ${fromIso} AND created_at <= ${toIso}
               ORDER BY created_at ASC`)
    ]) : [[], [], [], []];

    // journey_links among the in-range events → per-event link list + flat list
    const idSet = new Set(je.map(e => String(e.id)));
    let rawLinks = [];
    if (je.length) {
      const ids = je.map(e => e.id);
      rawLinks = await safe(sql`SELECT event_a, event_b, kind, weight FROM journey_links
                                WHERE event_a = ANY(${ids}::bigint[]) OR event_b = ANY(${ids}::bigint[])`);
    }
    const linksByEvent = {};
    const flatLinks = [];
    rawLinks.forEach(l => {
      const a = String(l.event_a), b = String(l.event_b);
      if (!idSet.has(a) || !idSet.has(b)) return; // only links fully inside the window
      flatLinks.push({ a, b, kind: l.kind, weight: l.weight });
      (linksByEvent[a] = linksByEvent[a] || []).push({ to: b, kind: l.kind, weight: l.weight });
      (linksByEvent[b] = linksByEvent[b] || []).push({ to: a, kind: l.kind, weight: l.weight });
    });

    const layers = { practice:[], emotion:[], event:[], thought:[], sensation:[], insight:[], xp_gain:[] };

    // PR93: resolve course/block titles for course-linked events (block_done +
    // tool_task) so the timeline never shows a raw 'block_done' id. Caller's UI
    // language picks which title column to use.
    const uiLang = ['ru','en','es'].includes(String(req.query.lang || '')) ? String(req.query.lang) : 'ru';
    const pick = (ru, en, es) => (uiLang === 'en' ? (en || ru) : uiLang === 'es' ? (es || ru) : ru) || en || es || '';
    let blockMap = {};
    const blockIds = [...new Set(je.map(e => e.payload && e.payload.block_id).filter(v => v != null))];
    if (blockIds.length) {
      const brows = await safe(sql`SELECT b.id, b.order_idx, b.title_ru, b.title_en, b.title_es,
                                          c.name_ru, c.name_en, c.name_es
                                   FROM course_blocks b LEFT JOIN courses c ON c.id = b.course_id
                                   WHERE b.id = ANY(${blockIds}::bigint[])`);
      brows.forEach(b => { blockMap[String(b.id)] = b; });
    }
    function courseCtx(p) {
      const b = p && p.block_id != null ? blockMap[String(p.block_id)] : null;
      if (!b) return null;
      return {
        course: pick(b.name_ru, b.name_en, b.name_es),
        block: pick(b.title_ru, b.title_en, b.title_es),
        index: (b.order_idx != null ? b.order_idx + 1 : null)
      };
    }

    // Derive a human label for a journey event from its payload + kind.
    function jeLabel(e) {
      const p = e.payload || {};
      if (e.kind === 'sensation') {
        // PR93: neuromap 'area' nodes store p.label (not sensation_labels) — fall
        // back to it so a sensation never collapses to the bare word "ощущение".
        const s = (p.sensation_labels || []).join(', ') || p.label || '';
        const loc = (p.body_locations || []).join(', ');
        return (s || 'ощущение') + (loc ? ' @ ' + loc : '');
      }
      if (e.kind === 'practice') return p.practice_name || p.label || ('Практика' + (p.block_type ? ': ' + p.block_type : ''));
      if (e.kind === 'insight') return String(p.text || p.label || 'инсайт').slice(0, 90);
      if (e.kind === 'xp_gain') return '+' + (p.points || 0) + ' XP';
      if (e.kind === 'achievement') return p.title || 'достижение';
      if (e.kind === 'block_done') {
        // PR93: prefer the real block/course title; empty → frontend renders the
        // i18n meta-label ("Завершён блок курса"), never the raw kind.
        const ctx = courseCtx(p);
        if (ctx && ctx.block) return ctx.block;
        if (ctx && ctx.course) return ctx.course;
        return p.label || p.title || '';
      }
      return p.label || p.title || e.kind;
    }
    function jeItem(e) {
      const p = e.payload || {};
      const ctx = courseCtx(p);
      // PR94 (#4): standalone NeuroMap 'area' nodes are LIFE AREAS (сфера жизни /
      // Образы: relationships, work, health…), NOT body sensations. They were mapped
      // onto the sensation layer purely for the cyan colour, so the UI mislabelled
      // "отношения" as "Ощущение". Re-tag the KIND to 'life_area' (frontend shows
      // "Сфера жизни") while keeping the cyan layer. Real sensations arrive via
      // /api/neuromap/sensation (source 'sensation', sensation_labels) — untouched.
      const kind = (e.kind === 'sensation' && p.nm_type === 'area') ? 'life_area' : e.kind;
      return {
        id: String(e.id), kind, layer: e.layer, source: p.source || e.kind,
        occurred_at: e.occurred_at, t: e.occurred_at,
        label: jeLabel(e), valence: p.valence || 'neutral',
        weight: p.weight || p.count || p.points || p.intensity || 1,
        payload: ctx ? Object.assign({}, p, { course_ctx: ctx }) : p,
        links: linksByEvent[String(e.id)] || []
      };
    }

    // Route journey events into layers by their `layer` field.
    const haveJE = { practice:false, emotion:false, event:false, thought:false, sensation:false, insight:false };
    je.forEach(e => {
      const layer = e.layer || nmTypeToJourney('').layer;
      if (e.kind === 'xp_gain' || e.layer === 'xp') return;            // xp handled below
      if (e.kind === 'achievement') { layers.practice.push(jeItem(e)); haveJE.practice = true; return; }
      if (e.kind === 'block_done')  { layers.practice.push(jeItem(e)); haveJE.practice = true; return; }
      if (layers[layer]) { layers[layer].push(jeItem(e)); haveJE[layer] = true; }
    });

    // xp_gain — cumulative timeline. Prefer journey xp_gain/achievement events;
    // fall back to raw block points when the journey log has no xp yet.
    const xpItems = [];
    const jeXp = je.filter(e => e.kind === 'xp_gain' || e.layer === 'xp');
    const jeAch = je.filter(e => e.kind === 'achievement');
    if (jeXp.length) {
      jeXp.forEach(e => xpItems.push({ t: e.occurred_at, amount: (e.payload && e.payload.points) || 0 }));
    } else {
      cbp.forEach(r => xpItems.push({ t: r.completed_at, amount: r.points_earned || 0 }));
      jeAch.forEach(e => xpItems.push({ t: e.occurred_at, amount: (e.payload && e.payload.xp) || 0 }));
    }
    xpItems.sort((a, b) => new Date(a.t) - new Date(b.t));
    let cum = 0;
    xpItems.forEach(x => { cum += x.amount; layers.xp_gain.push({ t: x.t, amount: x.amount, cumulative: cum }); });

    // ── Legacy fallbacks (only when a layer has no journey events) ──
    if (!haveJE.practice) {
      cbp.forEach(r => layers.practice.push({ id: 'cbp_' + (r.block_id||r.completed_at), kind:'block_done', layer:'practice', source:'course_block', t: r.completed_at, occurred_at: r.completed_at, label: r.block_type || 'practice', valence:'neutral', weight: r.points_earned || 1, payload: r, links: [] }));
    }
    nm.forEach(n => {
      const map = { emotion:'emotion', thought:'thought', area:'sensation', cause:'event', event:'event' };
      const lyr = map[n.type]; if (!lyr) return;
      if (haveJE[lyr]) return; // journey already covers this layer
      // PR94 (#4): legacy 'area' nodes are life areas, not sensations — same re-tag.
      const kind = (n.type === 'area') ? 'life_area' : lyr;
      layers[lyr].push({ id: 'nm_' + n.id, kind, layer: lyr, source:'neuromap_legacy', t: n.last_seen_at, occurred_at: n.last_seen_at, label: n.label, valence: n.valence, weight: n.count || 1, payload: { label: n.label, valence: n.valence, nm_type: n.type, legacy: true }, links: [] });
    });
    // calendar — separate instrument, always include (not mirrored to journey)
    cal.forEach(c => layers.event.push({ id: 'cal_' + c.id, kind:'event', layer:'event', source:'calendar', t: c.created_at, occurred_at: c.created_at, label: c.title, valence:'neutral', weight: 1, payload: { title: c.title, event_type: c.event_type, date_key: c.date_key }, links: [] }));
    if (!haveJE.insight) {
      diary.forEach(d => layers.insight.push({ id: 'diary_' + d.id, kind:'insight', layer:'insight', source:'diary_legacy', t: d.created_at, occurred_at: d.created_at, label: String(d.text || '').slice(0, 90), valence: (d.plus_count > d.minus_count ? 'positive' : (d.minus_count > d.plus_count ? 'negative' : 'neutral')), weight: ((d.plus_count || 0) + (d.minus_count || 0)) || 1, payload: { text: d.text, comment: d.comment }, links: [] }));
    }

    // Keep every layer chronological
    Object.keys(layers).forEach(k => layers[k].sort((a, b) => new Date(a.t) - new Date(b.t)));

    // Flat chronological event stream (everything except the xp curve) — used by
    // the tunnel/field views and the click-to-detail logic on the frontend.
    const events = [];
    ['practice','emotion','event','thought','sensation','insight'].forEach(k => {
      layers[k].forEach(it => events.push(Object.assign({ layer: k }, it)));
    });
    events.sort((a, b) => new Date(a.t) - new Date(b.t));

    // state aggregates → MVP visual rule (amplitude / density / brightness / spread)
    const emo = layers.emotion;
    const emoTotal = emo.length || 1;
    const positivity = emo.length ? emo.filter(e => e.valence === 'positive').length / emoTotal : 0.5;
    const turbulence = emo.length ? emo.filter(e => e.valence === 'negative').length / emoTotal : 0;
    const activity = layers.practice.length + layers.event.length + emo.length + layers.insight.length;
    const pracDays = new Set(layers.practice.map(p => String(p.t).slice(0, 10))).size;
    const consistency = clamp01(pracDays / Math.min(spanDays, 14));

    const aggregates = {
      positivity: +positivity.toFixed(3),
      turbulence: +turbulence.toFixed(3),
      activity,
      consistency: +consistency.toFixed(3),
      brightness: +clamp01(0.35 + 0.40 * positivity + 0.25 * consistency - 0.30 * turbulence).toFixed(3),
      amplitude:  +clamp01(0.20 + Math.min(1, activity / 40)).toFixed(3),
      density:    +clamp01(0.25 + 0.50 * turbulence + 0.30 * Math.min(1, activity / 60)).toFixed(3),
      spread:     +clamp01(0.30 + 0.50 * positivity - 0.40 * turbulence + 0.20 * consistency).toFixed(3)
    };

    // External Field overlays (PR5): thin-track markers on the same time axis,
    // ONLY for layers the user marked showOnPath, and ONLY events that pass the
    // per-layer significance threshold (PR FIX #2) — so the Path isn't buried in
    // constant solar-wind/phase noise. Each kept event carries a severity_color.
    let overlays = {};
    try {
      const subRows = await safe(sql`SELECT config FROM external_field_subscriptions WHERE user_id = ${me}`);
      const cfg = (subRows[0] && subRows[0].config) || {};
      const onPath = Object.keys(cfg).filter(k => cfg[k] && cfg[k].showOnPath && cfg[k].enabled !== false);
      if (onPath.length) {
        const ovRows = await safe(sql`SELECT id, layer, event_type, title, description, timestamp, severity, source, source_url, location_scope, raw_payload
                                      FROM external_signal_events
                                      WHERE (user_id IS NULL OR user_id = ${me})
                                        AND layer = ANY(${onPath}::text[])
                                        AND timestamp >= ${fromIso} AND timestamp <= ${toIso}
                                      ORDER BY timestamp ASC`);
        ovRows.forEach(r => {
          const th = overlayThreshold(r);
          if (!th.pass) return;
          (overlays[r.layer] = overlays[r.layer] || []).push({
            id: String(r.id), layer: r.layer, event_type: r.event_type,
            title: r.title, description: r.description,
            timestamp: r.timestamp, t: r.timestamp,
            severity: r.severity, severity_color: th.color, source: r.source, source_url: r.source_url, scope: r.location_scope
          });
        });
      }
    } catch (e) { overlays = {}; }

    res.json({
      ok: true,
      range: { from: fromIso, to: toIso, period },
      layers,
      events,
      links: flatLinks,
      overlays,
      aggregates,
      totals: {
        xp_total: cum,
        practices: layers.practice.length,
        emotions: layers.emotion.length,
        events: layers.event.length,
        thoughts: layers.thought.length,
        sensations: layers.sensation.length,
        insights: layers.insight.length
      }
    });
  } catch (err) { console.error('GET me/evolution:', err); res.status(500).json({ error: err.message }); }
});

// POST /api/users/me/evolution/backfill — one-time, idempotent seeding of the
// journey_events log from data the user created BEFORE Pack 31.5 hooks existed
// (NeuroMap nodes, sensation/diary entries). Without this, history added earlier
// stays invisible on the Evolution Path until the user re-enters it. Safe to run
// repeatedly: it only inserts journey_events that don't already exist (matched by
// nm_node_id / diary_id / block_id in payload).
app.post('/api/users/me/evolution/backfill', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const existing = await sql`SELECT kind, payload FROM journey_events WHERE user_id = ${me}`;
    const haveNm = new Set(), haveDiary = new Set(), haveBlock = new Set();
    existing.forEach(e => {
      const p = e.payload || {};
      if (p.nm_node_id != null) haveNm.add(String(p.nm_node_id));
      if (p.diary_id != null) haveDiary.add(String(p.diary_id));
      if (e.kind === 'block_done' && p.block_id != null) haveBlock.add(String(p.block_id));
    });

    let nmCount = 0, diaryCount = 0, blockCount = 0;

    // NeuroMap nodes → one event each at last_seen_at (best available timestamp)
    const nodes = await sql`SELECT id, type, label, valence, last_seen_at, metadata FROM nm_nodes WHERE user_id = ${me}`;
    for (const n of nodes) {
      if (haveNm.has(String(n.id))) continue;
      const { kind, layer } = nmTypeToJourney(n.type);
      await logJourney(me, kind, layer, {
        label: n.label, valence: n.valence, nm_node_id: n.id, nm_type: n.type,
        source: 'backfill_neuromap'
      }, n.last_seen_at);
      nmCount++;
    }

    // Diary → insight events at their date_key
    const diary = await sql`SELECT id, text, comment, plus_count, minus_count, date_key, time, created_at FROM neuro_resource_diary WHERE user_id = ${me}`;
    for (const d of diary) {
      if (haveDiary.has(String(d.id))) continue;
      const occAt = d.date_key ? (d.date_key + (d.time && /^\d{2}:\d{2}/.test(d.time) ? 'T' + d.time : 'T12:00')) : d.created_at;
      const valence = (d.plus_count || 0) > (d.minus_count || 0) ? 'positive'
                    : ((d.minus_count || 0) > (d.plus_count || 0) ? 'negative' : 'neutral');
      await logJourney(me, 'insight', 'insight', {
        text: String(d.text || '').slice(0, 280), comment: d.comment || '',
        plus_count: d.plus_count || 0, minus_count: d.minus_count || 0,
        valence, date_key: d.date_key, diary_id: d.id, source: 'backfill_diary'
      }, occAt);
      diaryCount++;
    }

    // Course block completions → block_done events
    let blocks = [];
    try { blocks = await sql`SELECT block_id, course_id, points_earned, completed_at FROM course_block_progress WHERE user_id = ${me}`; } catch (e) { blocks = []; }
    for (const b of blocks) {
      if (haveBlock.has(String(b.block_id))) continue;
      await logJourney(me, 'block_done', 'practice', {
        course_id: b.course_id, block_id: b.block_id, points: b.points_earned || 1,
        source: 'backfill_course'
      }, b.completed_at);
      blockCount++;
    }

    res.json({ ok: true, backfilled: { neuromap: nmCount, diary: diaryCount, blocks: blockCount } });
  } catch (err) { console.error('POST evolution/backfill:', err); res.status(500).json({ error: err.message }); }
});

// ── PR7: Collective Path of Development ──────────────────────────────────────
// Every user as a parallel "spine" on a shared time axis, starting at their
// registration. Superadmin always sees it; regular users only once published.
async function getCollectivePublished() {
  try {
    const rows = await sql`SELECT value FROM system_settings WHERE key = 'collective_path_published'`;
    return !!(rows[0] && rows[0].value && rows[0].value.published);
  } catch (e) { return false; }
}
// GET /api/admin/collective-path?from=&to=&overlay=sun,earth
app.get('/api/admin/collective-path', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const [caller] = await sql`SELECT role FROM users WHERE id = ${me}`;
    const isSuper = !!caller && ['superadmin', 'founder'].includes(caller.role);
    const published = await getCollectivePublished();
    if (!isSuper && !published) return res.status(403).json({ error: 'Not published' });

    let toD = new Date(); let fromD = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    if (req.query.from) { const d = new Date(req.query.from); if (!isNaN(d.getTime())) fromD = d; }
    if (req.query.to)   { const d = new Date(req.query.to);   if (!isNaN(d.getTime())) toD = d; }
    const fromIso = fromD.toISOString(), toIso = toD.toISOString();
    const safe = (p) => p.then(r => r).catch(() => []);

    // users (bounded). Active accounts with a registration date.
    const users = await safe(sql`SELECT id, COALESCE(display_name, split_part(email,'@',1)) AS name,
        created_at, location_lat AS lat, location_lon AS lon, location_city AS city, location_country AS country
      FROM users WHERE created_at IS NOT NULL AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 200`);
    const uids = users.map(u => u.id);
    let evRows = [], linkRows = [], teamRows = [];
    if (uids.length) {
      // cap total events for safety; newest within window per the index order
      evRows = await safe(sql`SELECT id, user_id, kind, layer, payload, occurred_at FROM journey_events
        WHERE user_id = ANY(${uids}::uuid[]) AND occurred_at >= ${fromIso} AND occurred_at <= ${toIso}
        ORDER BY occurred_at ASC LIMIT 8000`);
      const eids = evRows.map(e => e.id);
      if (eids.length) {
        linkRows = await safe(sql`SELECT event_a, event_b, kind, weight FROM journey_links
          WHERE event_a = ANY(${eids}::bigint[]) OR event_b = ANY(${eids}::bigint[])`);
      }
      teamRows = await safe(sql`SELECT t.id, t.name, t.kind, tm.user_id, tm.role
        FROM teams t JOIN team_members tm ON tm.team_id = t.id
        WHERE tm.user_id = ANY(${uids}::uuid[])`);
    }
    function jeLabel(e) {
      const p = e.payload || {};
      // PR94 (#4): area-origin "sensation" rows carry their content in p.label
      // ("отношения"); fall back to it instead of the bare "ощущение" placeholder.
      if (e.kind === 'sensation') return ((p.sensation_labels || []).join(', ') || p.label || 'ощущение');
      if (e.kind === 'practice') return p.practice_name || p.label || 'practice';
      if (e.kind === 'insight') return String(p.text || p.label || 'insight').slice(0, 60);
      if (e.kind === 'xp_gain') return '+' + (p.points || 0) + ' XP';
      return p.label || p.title || e.kind;
    }
    const evByUser = {};
    evRows.forEach(e => {
      const k = String(e.user_id);
      const p = e.payload || {};
      const kind = (e.kind === 'sensation' && p.nm_type === 'area') ? 'life_area' : e.kind;
      (evByUser[k] = evByUser[k] || []).push({ id: String(e.id), kind, layer: e.layer,
        t: e.occurred_at, occurred_at: e.occurred_at, label: jeLabel(e),
        valence: (e.payload && e.payload.valence) || 'neutral' });
    });
    const idSet = new Set(evRows.map(e => String(e.id)));
    const links = [];
    linkRows.forEach(l => { const a = String(l.event_a), b = String(l.event_b); if (idSet.has(a) && idSet.has(b)) links.push({ a, b, kind: l.kind, weight: l.weight }); });
    const teams = {};
    teamRows.forEach(r => {
      const id = String(r.id);
      if (!teams[id]) teams[id] = { id, name: r.name, kind: r.kind || 'team', members: [] };
      teams[id].members.push({ user_id: String(r.user_id), role: r.role || 'member' });
    });

    // External Field overlays for the layers requested (global signals only here).
    const layers = String(req.query.overlay || '').split(',').map(s => s.trim()).filter(s => /^[a-z]+$/.test(s));
    let external_overlays = {};
    if (layers.length) {
      const ovRows = await safe(sql`SELECT id, layer, event_type, title, description, timestamp, severity, source, source_url
        FROM external_signal_events WHERE user_id IS NULL AND layer = ANY(${layers}::text[])
          AND timestamp >= ${fromIso} AND timestamp <= ${toIso} ORDER BY timestamp ASC LIMIT 2000`);
      ovRows.forEach(r => { const th = overlayThreshold(r); if (!th.pass) return; (external_overlays[r.layer] = external_overlays[r.layer] || []).push({
        id: String(r.id), layer: r.layer, event_type: r.event_type, title: r.title,
        t: r.timestamp, timestamp: r.timestamp, severity: r.severity, severity_color: th.color, source: r.source, source_url: r.source_url }); });
    }

    // PR10: geo distance (km) of every user to the CALLER, so the client layout
    // can order family/team blocks and loners by real-world proximity (Haversine).
    function haversineKm(la1, lo1, la2, lo2) {
      if (la1 == null || lo1 == null || la2 == null || lo2 == null) return null;
      const R = 6371, toR = Math.PI / 180;
      const dLa = (la2 - la1) * toR, dLo = (lo2 - lo1) * toR;
      const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * toR) * Math.cos(la2 * toR) * Math.sin(dLo / 2) ** 2;
      return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
    }
    const anchor = users.find(u => String(u.id) === String(me)) || null;
    const aLat = anchor ? anchor.lat : null, aLon = anchor ? anchor.lon : null;

    res.json({
      ok: true, published, is_superadmin: isSuper,
      range: { from: fromIso, to: toIso },
      users: users.map(u => ({ id: String(u.id), name: u.name, created_at: u.created_at,
        lat: u.lat, lon: u.lon, city: u.city, country: u.country,
        dist: haversineKm(aLat, aLon, u.lat, u.lon),
        events: evByUser[String(u.id)] || [] })),
      links, teams: Object.values(teams), external_overlays
    });
  } catch (err) { console.error('GET /api/admin/collective-path:', err); res.status(500).json({ error: err.message }); }
});
// POST /api/admin/collective-path/publish { published: bool } — superadmin only
app.post('/api/admin/collective-path/publish', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const [caller] = await sql`SELECT role FROM users WHERE id = ${me}`;
    if (!caller || !['superadmin', 'founder'].includes(caller.role)) return res.status(403).json({ error: 'Forbidden' });
    const published = !!(req.body && req.body.published);
    await sql`INSERT INTO system_settings (key, value, updated_at)
      VALUES ('collective_path_published', ${JSON.stringify({ published })}::jsonb, now())
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify({ published })}::jsonb, updated_at = now()`;
    res.json({ ok: true, published });
  } catch (err) { console.error('POST collective-path/publish:', err); res.status(500).json({ error: err.message }); }
});
// GET /api/collective-path/status — is the collective path published? (for subtab gating)
app.get('/api/collective-path/status', async (req, res) => {
  try { res.json({ ok: true, published: await getCollectivePublished() }); }
  catch (err) { res.json({ ok: true, published: false }); }
});

// GET /api/admin/journeys — list all users with progress summary (admin only)
app.get('/api/admin/journeys', requireAuth, async (req, res) => {
  try {
    const callerId = req.user.sub || req.user.id;
    const [caller] = await sql`SELECT role FROM users WHERE id = ${callerId}`;
    if (!caller || !['superadmin','founder','admin'].includes(caller.role)) return res.status(403).json({ error: 'Admin only' });
    const rows = await sql`
      SELECT u.id, u.display_name, u.email, u.role, u.created_at, u.profile_public,
             (SELECT COALESCE(SUM(points_earned),0)::int FROM course_block_progress WHERE user_id = u.id) AS xp_blocks,
             (SELECT COALESCE(SUM(a.xp_reward),0)::int FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id WHERE ua.user_id = u.id) AS xp_ach,
             (SELECT COUNT(*)::int FROM course_block_progress WHERE user_id = u.id) AS blocks_done,
             (SELECT COUNT(DISTINCT course_id)::int FROM course_block_progress WHERE user_id = u.id) AS courses_touched,
             (SELECT MAX(completed_at) FROM course_block_progress WHERE user_id = u.id) AS last_active,
             (SELECT COUNT(*)::int FROM user_achievements WHERE user_id = u.id) AS badges_count
      FROM users u
      WHERE u.deleted_at IS NULL
      ORDER BY (
        (SELECT COALESCE(SUM(points_earned),0) FROM course_block_progress WHERE user_id = u.id) +
        (SELECT COALESCE(SUM(a.xp_reward),0) FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id WHERE ua.user_id = u.id)
      ) DESC, u.created_at DESC
      LIMIT 500
    `;
    res.json({ users: rows.map(r => ({ ...r, total_xp: (r.xp_blocks||0) + (r.xp_ach||0) })) });
  } catch (err) { console.error('GET admin/journeys:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/admin/journeys/:userId — detailed view of one user's journey
app.get('/api/admin/journeys/:userId', requireAuth, async (req, res) => {
  try {
    const callerId = req.user.sub || req.user.id;
    const [caller] = await sql`SELECT role FROM users WHERE id = ${callerId}`;
    if (!caller || !['superadmin','founder','admin'].includes(caller.role)) return res.status(403).json({ error: 'Admin only' });
    const uid = req.params.userId;
    const courses = await sql`
      SELECT c.id, c.slug, c.name_ru, c.name_en, c.name_es,
             (SELECT COUNT(*) FROM course_blocks WHERE course_id = c.id) AS total_blocks,
             (SELECT COUNT(*) FROM course_block_progress WHERE user_id = ${uid} AND course_id = c.id) AS done_blocks
      FROM courses c
      WHERE c.is_published = true OR EXISTS (SELECT 1 FROM course_block_progress WHERE user_id = ${uid} AND course_id = c.id)
      ORDER BY c.order_idx ASC, c.id DESC
    `;
    const recent = await sql`
      SELECT cbp.*, cb.title_ru AS block_title, cb.block_type
      FROM course_block_progress cbp
      LEFT JOIN course_blocks cb ON cb.id = cbp.block_id
      WHERE cbp.user_id = ${uid}
      ORDER BY cbp.completed_at DESC LIMIT 50
    `;
    const badges = await sql`
      SELECT a.* FROM user_achievements ua JOIN achievements a ON a.id = ua.achievement_id
      WHERE ua.user_id = ${uid} ORDER BY ua.earned_at DESC
    `;
    res.json({ courses, recent, badges });
  } catch (err) { console.error('GET journey detail:', err); res.status(500).json({ error: err.message }); }
});

// POST /api/admin/users/:id/xp — grant manual XP bonus (admin only)
// Records as a synthetic course_block_progress row with block_id = NULL would
// fail FK; we instead use a dedicated bonus achievement on the fly.
app.post('/api/admin/users/:id/xp', requireAuth, async (req, res) => {
  try {
    const callerId = req.user.sub || req.user.id;
    const [caller] = await sql`SELECT role FROM users WHERE id = ${callerId}`;
    if (!caller || !['superadmin','founder','admin'].includes(caller.role)) return res.status(403).json({ error: 'Admin only' });
    const targetId = req.params.id;
    const amount = parseInt(req.body?.amount, 10) || 0;
    const reason = String(req.body?.reason || 'manual bonus');
    if (!amount || amount < 1) return res.status(400).json({ error: 'amount must be > 0' });
    // Ensure a one-off bonus achievement record per grant
    const slug = 'bonus_' + Date.now() + '_' + Math.floor(Math.random()*1000);
    const [ach] = await sql`INSERT INTO achievements
      (slug, title_ru, title_en, title_es, description_ru, badge_emoji, xp_reward, condition_kind, author_id)
      VALUES (${slug}, ${'⭐ ' + reason}, ${'⭐ ' + reason}, ${'⭐ ' + reason},
              ${'Бонус от админа: ' + reason}, '⭐', ${amount}, 'admin_bonus', ${callerId})
      RETURNING *`;
    await sql`INSERT INTO user_achievements (user_id, achievement_id) VALUES (${targetId}, ${ach.id})
              ON CONFLICT DO NOTHING`;
    await notifyUser(targetId, 'achievement', { slug, title: ach.title_ru, emoji: '⭐', xp: amount });
    res.json({ ok: true, granted_xp: amount, achievement_id: ach.id });
  } catch (err) { console.error('grant xp:', err); res.status(500).json({ error: err.message }); }
});

// ── 🅴 Admin: mark course-block completion for any user (or self) ────────────
// Resolve ':userId' — the literal 'me' (or the caller's own id) maps to the admin.
function resolveTargetUser(req) {
  const callerId = req.user.sub || req.user.id;
  const raw = req.params.userId;
  return (raw === 'me' || raw === callerId) ? callerId : raw;
}

// GET /api/admin/users/:userId/courses/:courseId/completions — the user's
// per-block completion state for a course (admin only). Powers the checkbox grid.
app.get('/api/admin/users/:userId/courses/:courseId/completions', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const targetId = resolveTargetUser(req);
    const courseId = parseInt(req.params.courseId, 10);
    const blocks = await sql`SELECT id, order_idx, block_type, title_ru, title_en, title_es, points, parent_block_id, tool_kind
                             FROM course_blocks WHERE course_id = ${courseId} ORDER BY order_idx ASC, id ASC`;
    const progress = await sql`SELECT block_id, points_earned, completed_at, response
                               FROM course_block_progress WHERE user_id = ${targetId} AND course_id = ${courseId}`;
    res.json({ blocks, progress });
  } catch (err) { console.error('GET completions:', err); res.status(500).json({ error: err.message }); }
});

// POST /api/admin/users/:userId/blocks/:blockId/completion — set/clear completion.
// body { completed: bool, completed_at?: iso, note?: string }. Awards XP + logs a
// back-dated journey event so it surfaces in Evolution Path + the Path Map.
app.post('/api/admin/users/:userId/blocks/:blockId/completion', requireAuth, async (req, res) => {
  try {
    if (!await callerIsAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    const targetId = resolveTargetUser(req);
    const blockId = parseInt(req.params.blockId, 10);
    const { completed, completed_at, note } = req.body || {};
    const [block] = await sql`SELECT * FROM course_blocks WHERE id = ${blockId}`;
    if (!block) return res.status(404).json({ error: 'Block not found' });
    const courseId = block.course_id;
    const points = parseInt(block.points, 10) || 0;

    if (completed === false) {
      await sql`DELETE FROM course_block_progress WHERE user_id = ${targetId} AND block_id = ${blockId}`;
      return res.json({ ok: true, completed: false, block_id: blockId });
    }

    // Validate/normalise an optional back-date; default to now().
    let whenIso = null;
    if (completed_at) { const d = new Date(completed_at); if (!isNaN(d.getTime())) whenIso = d.toISOString(); }
    const resp = { admin_marked: true, marked_by: req.user.sub || req.user.id, note: note || '' };

    if (whenIso) {
      await sql`INSERT INTO course_block_progress (user_id, course_id, block_id, response, points_earned, completed_at)
                VALUES (${targetId}, ${courseId}, ${blockId}, ${JSON.stringify(resp)}::jsonb, ${points}, ${whenIso})
                ON CONFLICT (user_id, block_id) DO UPDATE
                  SET response = EXCLUDED.response, points_earned = EXCLUDED.points_earned, completed_at = EXCLUDED.completed_at`;
    } else {
      await sql`INSERT INTO course_block_progress (user_id, course_id, block_id, response, points_earned)
                VALUES (${targetId}, ${courseId}, ${blockId}, ${JSON.stringify(resp)}::jsonb, ${points})
                ON CONFLICT (user_id, block_id) DO UPDATE
                  SET response = EXCLUDED.response, points_earned = EXCLUDED.points_earned, completed_at = now()`;
    }

    // Journey event (back-dated) so XP + the timeline reflect the admin mark.
    try {
      await logJourney(targetId, 'block_done', 'practice', {
        course_id: courseId, block_id: blockId, block_type: block.block_type,
        points: points, admin_marked: true, note: note || ''
      }, whenIso);
    } catch (jeErr) { console.warn('admin completion journey:', jeErr.message); }

    res.json({ ok: true, completed: true, block_id: blockId, points_earned: points, completed_at: whenIso });
  } catch (err) { console.error('POST completion:', err); res.status(500).json({ error: err.message }); }
});

// Helper: insert a notification but respect the recipient's per-kind mute list.
// Returns true if inserted, false if user has muted this kind.
async function notifyUser(userId, kind, payload) {
  try {
    const [u] = await sql`SELECT notifications_enabled, notif_mute FROM users WHERE id = ${userId}`;
    if (!u) return false;
    if (u.notifications_enabled === false) return false;
    if (Array.isArray(u.notif_mute) && u.notif_mute.includes(kind)) return false;
    await sql`INSERT INTO notifications (user_id, kind, payload) VALUES (${userId}, ${kind}, ${JSON.stringify(payload)}::jsonb)`;
    return true;
  } catch (e) { console.warn('notifyUser:', e.message); return false; }
}

// Helper: award an achievement by slug if user doesn't have it yet.
// Pushes the slug into `out` if granted (so the caller can return it).
async function tryAwardAchievement(userId, slug, out) {
  const [ach] = await sql`SELECT id, badge_emoji, title_ru, xp_reward FROM achievements WHERE slug = ${slug}`;
  if (!ach) return;
  const [existing] = await sql`SELECT 1 FROM user_achievements WHERE user_id = ${userId} AND achievement_id = ${ach.id}`;
  if (existing) return;
  await sql`INSERT INTO user_achievements (user_id, achievement_id) VALUES (${userId}, ${ach.id}) ON CONFLICT DO NOTHING`;
  await notifyUser(userId, 'achievement', { slug, title: ach.title_ru, emoji: ach.badge_emoji, xp: ach.xp_reward });
  // Journey + team broadcast
  try {
    await sql`INSERT INTO journey_events (user_id, kind, layer, payload, occurred_at)
              VALUES (${userId}, 'achievement', 'practice',
                      ${JSON.stringify({ slug, title: ach.title_ru, emoji: ach.badge_emoji, xp: ach.xp_reward })}::jsonb, now())`;
  } catch (e) { console.warn('journey log ach:', e.message); }
  await broadcastToTeams(userId, 'achievement_earned',
    { user_id: userId, slug, title: ach.title_ru, emoji: ach.badge_emoji });
  // Broadcast peer_achievement (respects each recipient's notif_mute)
  const [usr] = await sql`SELECT display_name, profile_public FROM users WHERE id = ${userId}`;
  if (usr && usr.profile_public) {
    await sql`INSERT INTO notifications (user_id, kind, payload)
              SELECT id, 'peer_achievement', ${JSON.stringify({ user_id: userId, user_name: usr.display_name, slug, title: ach.title_ru, emoji: ach.badge_emoji })}::jsonb
              FROM users WHERE notifications_enabled = true AND deleted_at IS NULL AND id <> ${userId}
                AND NOT ('peer_achievement' = ANY(COALESCE(notif_mute, '{}'::text[])))`;
  }
  if (out) out.push(slug);
}

// ══════════════════════════════════════════════════════════════════
// PACK 25: DOMunity — community layer (DMs, feed, notifications, profiles)
// ══════════════════════════════════════════════════════════════════

// User search / profile lookup
app.get('/api/users/search', requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (q.length < 2) return res.json({ users: [] });
    const rows = await sql`
      SELECT id, display_name, email, role, profile_public
      FROM users
      WHERE deleted_at IS NULL
        AND (LOWER(display_name) LIKE ${'%' + q + '%'} OR LOWER(email) LIKE ${'%' + q + '%'})
        AND id <> ${req.user.sub || req.user.id}
        AND (profile_public = true OR ${(['superadmin','founder','admin'].includes((req.user.role||'')))})
      LIMIT 25
    `;
    res.json({ users: rows });
  } catch (err) { console.error('user search:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/users/:id/profile', requireAuth, async (req, res) => {
  try {
    const [u] = await sql`SELECT id, display_name, role, bio, profile_public, created_at FROM users WHERE id = ${req.params.id}`;
    if (!u) return res.status(404).json({ error: 'Not found' });
    const isAdmin = ['superadmin','founder','admin'].includes(req.user.role || '');
    const isSelf = (req.user.sub || req.user.id) === req.params.id;
    if (!u.profile_public && !isAdmin && !isSelf) {
      return res.json({ user: { id: u.id, display_name: u.display_name, profile_public: false } });
    }
    res.json({ user: u });
  } catch (err) { console.error('GET profile:', err); res.status(500).json({ error: err.message }); }
});

app.patch('/api/users/me/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const { display_name, bio, profile_public, notifications_enabled } = req.body || {};
    const [updated] = await sql`UPDATE users SET
      display_name = COALESCE(${display_name}, display_name),
      bio = COALESCE(${bio}, bio),
      profile_public = COALESCE(${profile_public !== undefined ? !!profile_public : null}, profile_public),
      notifications_enabled = COALESCE(${notifications_enabled !== undefined ? !!notifications_enabled : null}, notifications_enabled),
      updated_at = now()
      WHERE id = ${userId} RETURNING id, display_name, email, role, bio, profile_public, notifications_enabled`;
    res.json({ user: updated });
  } catch (err) { console.error('PATCH profile:', err); res.status(500).json({ error: err.message }); }
});

// ── DM threads + messages ──
function orderedPair(a, b) { return a < b ? [a, b] : [b, a]; }

app.get('/api/dm/threads', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const rows = await sql`
      SELECT t.*,
        ua.display_name AS user_a_name, ub.display_name AS user_b_name,
        (SELECT body FROM dm_messages WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_body,
        (SELECT COUNT(*) FROM dm_messages WHERE thread_id = t.id AND sender_id <> ${me} AND read_at IS NULL) AS unread
      FROM dm_threads t
      JOIN users ua ON ua.id = t.user_a
      JOIN users ub ON ub.id = t.user_b
      WHERE t.user_a = ${me} OR t.user_b = ${me}
      ORDER BY t.last_message_at DESC
    `;
    res.json({ threads: rows });
  } catch (err) { console.error('GET dm threads:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/dm/threads', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const { peer_id } = req.body || {};
    if (!peer_id || peer_id === me) return res.status(400).json({ error: 'valid peer_id required' });
    const [a, b] = orderedPair(me, peer_id);
    const [existing] = await sql`SELECT id FROM dm_threads WHERE user_a = ${a} AND user_b = ${b}`;
    if (existing) return res.json({ thread_id: existing.id, created: false });
    const [row] = await sql`INSERT INTO dm_threads (user_a, user_b) VALUES (${a}, ${b}) RETURNING id`;
    res.json({ thread_id: row.id, created: true });
  } catch (err) { console.error('POST dm thread:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/dm/threads/:id/messages', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const tid = parseInt(req.params.id, 10);
    const [t] = await sql`SELECT * FROM dm_threads WHERE id = ${tid} AND (user_a = ${me} OR user_b = ${me})`;
    if (!t) return res.status(404).json({ error: 'Thread not found or no access' });
    const msgs = await sql`SELECT * FROM dm_messages WHERE thread_id = ${tid} ORDER BY created_at ASC LIMIT 200`;
    // Mark incoming as read
    await sql`UPDATE dm_messages SET read_at = now() WHERE thread_id = ${tid} AND sender_id <> ${me} AND read_at IS NULL`;
    res.json({ thread: t, messages: msgs });
  } catch (err) { console.error('GET dm messages:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/dm/threads/:id/messages', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const tid = parseInt(req.params.id, 10);
    const { body } = req.body || {};
    if (!body || !String(body).trim()) return res.status(400).json({ error: 'body required' });
    const [t] = await sql`SELECT * FROM dm_threads WHERE id = ${tid} AND (user_a = ${me} OR user_b = ${me})`;
    if (!t) return res.status(404).json({ error: 'Thread not found or no access' });
    const [row] = await sql`INSERT INTO dm_messages (thread_id, sender_id, body) VALUES (${tid}, ${me}, ${String(body)}) RETURNING *`;
    await sql`UPDATE dm_threads SET last_message_at = now() WHERE id = ${tid}`;
    // Notification for recipient
    const recipient = t.user_a === me ? t.user_b : t.user_a;
    await notifyUser(recipient, 'dm', { thread_id: tid, from: me, preview: String(body).slice(0, 80) });
    res.status(201).json({ message: row });
  } catch (err) { console.error('POST dm message:', err); res.status(500).json({ error: err.message }); }
});

// ── Feed posts ──
app.get('/api/feed/posts', requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT p.*, u.display_name AS author_name,
        (SELECT COUNT(*) FROM feed_reactions WHERE target_type = 'post' AND target_id = p.id) AS reaction_count,
        (SELECT COUNT(*) FROM feed_comments WHERE post_id = p.id) AS comment_count
      FROM feed_posts p
      LEFT JOIN users u ON u.id = p.author_id
      ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT 100
    `;
    res.json({ posts: rows });
  } catch (err) { console.error('GET feed:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/feed/posts', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const [user] = await sql`SELECT role FROM users WHERE id = ${userId}`;
    if (!user || !['superadmin','founder','admin'].includes(user.role)) return res.status(403).json({ error: 'Admin only' });
    const { title, body, cover_url, is_pinned } = req.body || {};
    if (!body || !String(body).trim()) return res.status(400).json({ error: 'body required' });
    const [row] = await sql`INSERT INTO feed_posts (author_id, title, body, cover_url, is_pinned)
                            VALUES (${userId}, ${title||''}, ${body}, ${cover_url||''}, ${!!is_pinned}) RETURNING *`;
    // Broadcast notification to all users with notifications enabled
    await sql`INSERT INTO notifications (user_id, kind, payload)
              SELECT id, 'feed_post', ${JSON.stringify({ post_id: row.id, title: title||'', preview: String(body).slice(0, 100) })}::jsonb
              FROM users WHERE notifications_enabled = true AND deleted_at IS NULL AND id <> ${userId}
                AND NOT ('feed_post' = ANY(COALESCE(notif_mute, '{}'::text[])))`;
    res.status(201).json({ post: row });
  } catch (err) { console.error('POST feed:', err); res.status(500).json({ error: err.message }); }
});

// PATCH /api/feed/posts/:id — edit own post (author-only)
app.patch('/api/feed/posts/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const postId = parseInt(req.params.id, 10);
    const [existing] = await sql`SELECT author_id FROM feed_posts WHERE id = ${postId}`;
    if (!existing) return res.status(404).json({ error: 'Not found' });
    // Server-side guard: only the author who is still an admin can edit
    const [me] = await sql`SELECT role FROM users WHERE id = ${userId}`;
    if (existing.author_id !== userId || !me || !['superadmin','founder','admin'].includes(me.role)) {
      return res.status(403).json({ error: 'You can only edit your own posts' });
    }
    const { title, body, cover_url, is_pinned } = req.body || {};
    const [updated] = await sql`UPDATE feed_posts SET
      title = COALESCE(${title}, title),
      body = COALESCE(${body}, body),
      cover_url = COALESCE(${cover_url}, cover_url),
      is_pinned = COALESCE(${is_pinned !== undefined ? !!is_pinned : null}, is_pinned),
      updated_at = now()
      WHERE id = ${postId} RETURNING *`;
    res.json({ post: updated });
  } catch (err) { console.error('PATCH feed:', err); res.status(500).json({ error: err.message }); }
});

// DELETE /api/feed/posts/:id — author-only delete
app.delete('/api/feed/posts/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const postId = parseInt(req.params.id, 10);
    const [existing] = await sql`SELECT author_id FROM feed_posts WHERE id = ${postId}`;
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const [me] = await sql`SELECT role FROM users WHERE id = ${userId}`;
    if (existing.author_id !== userId || !me || !['superadmin','founder','admin'].includes(me.role)) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }
    await sql`DELETE FROM feed_posts WHERE id = ${postId}`;
    res.json({ ok: true, deleted: postId });
  } catch (err) { console.error('DELETE feed:', err); res.status(500).json({ error: err.message }); }
});

// ── Notification mute preferences ──
app.patch('/api/users/me/notif-mute', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const { mute } = req.body || {};
    if (!Array.isArray(mute)) return res.status(400).json({ error: 'mute must be array of kinds' });
    const allowed = ['dm','feed_post','achievement','peer_achievement','joint_invite'];
    const clean = mute.filter(k => allowed.includes(k));
    await sql`UPDATE users SET notif_mute = ${clean}::text[] WHERE id = ${me}`;
    res.json({ ok: true, mute: clean });
  } catch (err) { console.error('mute:', err); res.status(500).json({ error: err.message }); }
});

// ── Pack 26: Admin manages custom achievements ──
app.post('/api/admin/achievements', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const [caller] = await sql`SELECT role FROM users WHERE id = ${me}`;
    if (!caller || !['superadmin','founder','admin'].includes(caller.role)) return res.status(403).json({ error: 'Admin only' });
    const { slug, title_ru, title_en, title_es, description_ru, description_en, description_es, badge_emoji, xp_reward, condition_kind } = req.body || {};
    if (!slug || !title_ru) return res.status(400).json({ error: 'slug + title_ru required' });
    const cleanSlug = String(slug).toLowerCase().replace(/[^a-z0-9_-]+/g,'_').slice(0,40);
    const [row] = await sql`INSERT INTO achievements
      (slug, title_ru, title_en, title_es, description_ru, description_en, description_es, badge_emoji, xp_reward, condition_kind, author_id)
      VALUES (${cleanSlug}, ${title_ru}, ${title_en||title_ru}, ${title_es||title_ru},
              ${description_ru||''}, ${description_en||''}, ${description_es||''},
              ${badge_emoji||'🏅'}, ${parseInt(xp_reward,10)||0}, ${condition_kind||'manual'}, ${me})
      RETURNING *`;
    res.status(201).json({ achievement: row });
  } catch (err) {
    if (String(err.message).includes('duplicate')) return res.status(409).json({ error: 'Achievement with this slug already exists' });
    console.error('POST achievement:', err); res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/achievements/:id', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const [caller] = await sql`SELECT role FROM users WHERE id = ${me}`;
    if (!caller || !['superadmin','founder','admin'].includes(caller.role)) return res.status(403).json({ error: 'Admin only' });
    const id = parseInt(req.params.id, 10);
    const [a] = await sql`SELECT author_id FROM achievements WHERE id = ${id}`;
    if (!a) return res.status(404).json({ error: 'Not found' });
    if (a.author_id !== me && !['superadmin','founder'].includes(caller.role)) {
      return res.status(403).json({ error: 'Only the author or a founder can delete' });
    }
    await sql`DELETE FROM achievements WHERE id = ${id}`;
    res.json({ ok: true });
  } catch (err) { console.error('DELETE achievement:', err); res.status(500).json({ error: err.message }); }
});

// Award an achievement to a user by email (manual badge granting)
app.post('/api/admin/achievements/:id/award', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const [caller] = await sql`SELECT role FROM users WHERE id = ${me}`;
    if (!caller || !['superadmin','founder','admin'].includes(caller.role)) return res.status(403).json({ error: 'Admin only' });
    const id = parseInt(req.params.id, 10);
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const [target] = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${email})`;
    if (!target) return res.status(404).json({ error: 'User not found' });
    const [a] = await sql`SELECT slug FROM achievements WHERE id = ${id}`;
    if (!a) return res.status(404).json({ error: 'Achievement not found' });
    await tryAwardAchievement(target.id, a.slug, []);
    res.json({ ok: true });
  } catch (err) { console.error('award achievement:', err); res.status(500).json({ error: err.message }); }
});

// ── WebRTC signaling for LIVE rooms (Pack 27 minimal) ──
// Tiny polling-based signaling: clients POST offers/answers/ICE; receivers
// long-poll via GET. Once the peer connection is established WebRTC carries
// the media stream directly between admin and viewers. No TURN — works on
// most networks; strict NATs will silently fail.
app.post('/api/rtc/:roomId/signal', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const rid = parseInt(req.params.roomId, 10);
    const { kind, payload, to_id } = req.body || {};
    if (!kind || !payload) return res.status(400).json({ error: 'kind and payload required' });
    await sql`INSERT INTO rtc_signals (room_id, from_id, to_id, kind, payload)
              VALUES (${rid}, ${me}, ${to_id || null}, ${kind}, ${JSON.stringify(payload)}::jsonb)`;
    res.json({ ok: true });
  } catch (err) { console.error('rtc signal:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/rtc/:roomId/signals', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const rid = parseInt(req.params.roomId, 10);
    const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 30000);
    const rows = await sql`SELECT * FROM rtc_signals
      WHERE room_id = ${rid} AND (to_id = ${me} OR to_id IS NULL) AND from_id <> ${me} AND created_at > ${since}
      ORDER BY created_at ASC LIMIT 100`;
    res.json({ signals: rows });
  } catch (err) { console.error('rtc fetch:', err); res.status(500).json({ error: err.message }); }
});

// Lightweight badge endpoint — returns unread counts only (cheap; safe to poll often)
app.get('/api/badges', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const [n] = await sql`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = ${me} AND seen_at IS NULL`;
    const [dm] = await sql`SELECT COUNT(*)::int AS n FROM dm_messages m
      JOIN dm_threads t ON t.id = m.thread_id
      WHERE (t.user_a = ${me} OR t.user_b = ${me}) AND m.sender_id <> ${me} AND m.read_at IS NULL`;
    const [latest] = await sql`SELECT id, created_at FROM feed_posts ORDER BY created_at DESC LIMIT 1`;
    res.json({
      unseen_notifs: n.n,
      unread_dms: dm.n,
      latest_feed_post_id: latest ? latest.id : 0,
      latest_feed_post_at: latest ? latest.created_at : null
    });
  } catch (err) { console.error('GET badges:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/feed/posts/:id/react', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const postId = parseInt(req.params.id, 10);
    const emoji = (req.body && req.body.emoji) || '❤';
    // Toggle: if exists, delete; else insert
    const existing = await sql`SELECT id FROM feed_reactions WHERE target_type='post' AND target_id=${postId} AND user_id=${userId} AND emoji=${emoji}`;
    if (existing.length) {
      await sql`DELETE FROM feed_reactions WHERE id = ${existing[0].id}`;
      return res.json({ reacted: false });
    }
    await sql`INSERT INTO feed_reactions (target_type, target_id, user_id, emoji) VALUES ('post', ${postId}, ${userId}, ${emoji})`;
    res.json({ reacted: true });
  } catch (err) { console.error('react:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/feed/posts/:id/comments', requireAuth, async (req, res) => {
  try {
    const postId = parseInt(req.params.id, 10);
    const rows = await sql`SELECT c.*, u.display_name AS author_name FROM feed_comments c
                           LEFT JOIN users u ON u.id = c.author_id
                           WHERE c.post_id = ${postId} ORDER BY c.created_at ASC LIMIT 500`;
    res.json({ comments: rows });
  } catch (err) { console.error('GET comments:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/feed/posts/:id/comments', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const postId = parseInt(req.params.id, 10);
    const { body, parent_id } = req.body || {};
    if (!body || !String(body).trim()) return res.status(400).json({ error: 'body required' });
    const [row] = await sql`INSERT INTO feed_comments (post_id, parent_id, author_id, body)
                            VALUES (${postId}, ${parent_id ? parseInt(parent_id, 10) : null}, ${userId}, ${body}) RETURNING *`;
    res.status(201).json({ comment: row });
  } catch (err) { console.error('POST comment:', err); res.status(500).json({ error: err.message }); }
});

// ── DOMunity: Group chat rooms (admin-managed) ──
app.get('/api/chat/rooms', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const rows = await sql`
      SELECT r.*, (SELECT COUNT(*) FROM chat_room_members WHERE room_id = r.id) AS member_count,
             (SELECT body FROM chat_room_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_body
      FROM chat_rooms r
      WHERE EXISTS (SELECT 1 FROM chat_room_members m WHERE m.room_id = r.id AND m.user_id = ${me})
         OR ${(['superadmin','founder','admin'].includes(req.user.role||''))}
      ORDER BY r.created_at DESC
    `;
    res.json({ rooms: rows });
  } catch (err) { console.error('GET rooms:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/chat/rooms', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const [user] = await sql`SELECT role FROM users WHERE id = ${me}`;
    if (!user || !['superadmin','founder','admin'].includes(user.role)) return res.status(403).json({ error: 'Admin only' });
    const { slug, name, description, course_id, member_ids } = req.body || {};
    if (!slug || !name) return res.status(400).json({ error: 'slug and name required' });
    const [room] = await sql`INSERT INTO chat_rooms (slug, name, description, course_id, created_by)
                              VALUES (${slug}, ${name}, ${description||''}, ${course_id ? parseInt(course_id,10) : null}, ${me}) RETURNING *`;
    // Add creator as admin member
    await sql`INSERT INTO chat_room_members (room_id, user_id, role) VALUES (${room.id}, ${me}, 'admin')`;
    // Add other members
    if (Array.isArray(member_ids)) {
      for (const uid of member_ids) {
        if (uid !== me) await sql`INSERT INTO chat_room_members (room_id, user_id) VALUES (${room.id}, ${uid}) ON CONFLICT DO NOTHING`;
      }
    }
    res.status(201).json({ room });
  } catch (err) { console.error('POST room:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/chat/rooms/:id/messages', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const rid = parseInt(req.params.id, 10);
    // Access check
    const [member] = await sql`SELECT 1 FROM chat_room_members WHERE room_id = ${rid} AND user_id = ${me}`;
    const isAdmin = ['superadmin','founder','admin'].includes(req.user.role || '');
    if (!member && !isAdmin) return res.status(403).json({ error: 'Not a member' });
    const rows = await sql`SELECT m.*, u.display_name AS sender_name FROM chat_room_messages m
                           LEFT JOIN users u ON u.id = m.sender_id
                           WHERE m.room_id = ${rid} ORDER BY m.created_at ASC LIMIT 300`;
    res.json({ messages: rows });
  } catch (err) { console.error('GET room messages:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/chat/rooms/:id/messages', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const rid = parseInt(req.params.id, 10);
    const { body, is_announcement } = req.body || {};
    if (!body || !String(body).trim()) return res.status(400).json({ error: 'body required' });
    const [member] = await sql`SELECT role FROM chat_room_members WHERE room_id = ${rid} AND user_id = ${me}`;
    const isAdmin = ['superadmin','founder','admin'].includes(req.user.role || '');
    if (!member && !isAdmin) return res.status(403).json({ error: 'Not a member' });
    // Live-stream gate: while is_live, only admins/room-admins can post full messages.
    // Regular members are limited to short comments (<= 80 chars) — emulates a stream
    // chat where the host broadcasts and audience replies in short bursts.
    const [room] = await sql`SELECT is_live FROM chat_rooms WHERE id = ${rid}`;
    const isRoomAdmin = isAdmin || (member && member.role === 'admin');
    if (room?.is_live && !isRoomAdmin && String(body).length > 80) {
      return res.status(403).json({ error: 'Live mode: только реакции и короткие комменты (≤ 80 знаков). Лектор говорит.' });
    }
    const ann = !!is_announcement && isRoomAdmin;
    const [row] = await sql`INSERT INTO chat_room_messages (room_id, sender_id, body, is_announcement)
                            VALUES (${rid}, ${me}, ${body}, ${ann}) RETURNING *`;
    res.status(201).json({ message: row });
  } catch (err) { console.error('POST room message:', err); res.status(500).json({ error: err.message }); }
});

// ── DOMunity: Donations via Stripe (one-off) ──
app.post('/api/donate/checkout', requireAuth, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
    const me = req.user.sub || req.user.id;
    const { amount_cents, currency, message } = req.body || {};
    const amt = parseInt(amount_cents, 10);
    if (!amt || amt < 100) return res.status(400).json({ error: 'amount_cents must be >= 100' });
    const cur = (currency || 'usd').toLowerCase();
    const lang = (req.headers['accept-language'] || '').split(',')[0].split('-')[0].toLowerCase();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: cur,
          unit_amount: amt,
          product_data: { name: 'Donation to NeuroAttention Lab', description: 'Support our research and platform' }
        },
        quantity: 1
      }],
      success_url: 'https://neuroattention.org/account.html?donation=success',
      cancel_url: 'https://neuroattention.org/account.html?donation=cancel',
      metadata: { user_id: me, donation_message: message || '', donation: 'true' },
      allow_promotion_codes: true,   // tester can use a 100% coupon to verify the flow
      locale: ['ru','en','es'].includes(lang) ? lang : 'auto'
    });
    res.json({ checkout_url: session.url, session_id: session.id });
  } catch (err) { console.error('donate checkout:', err); res.status(500).json({ error: err.message }); }
});

// ── Notifications ──
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const rows = await sql`SELECT * FROM notifications WHERE user_id = ${me} ORDER BY created_at DESC LIMIT 100`;
    const unseen = await sql`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ${me} AND seen_at IS NULL`;
    res.json({ notifications: rows, unseen: parseInt(unseen[0].n, 10) || 0 });
  } catch (err) { console.error('GET notifications:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/notifications/seen', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(i => parseInt(i, 10)).filter(Boolean) : null;
    if (ids && ids.length) {
      await sql`UPDATE notifications SET seen_at = now() WHERE user_id = ${me} AND id = ANY(${ids}::int[])`;
    } else {
      await sql`UPDATE notifications SET seen_at = now() WHERE user_id = ${me} AND seen_at IS NULL`;
    }
    res.json({ ok: true });
  } catch (err) { console.error('POST seen:', err); res.status(500).json({ error: err.message }); }
});

// ── PACK 26: Achievements ──
app.get('/api/achievements', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const all = await sql`SELECT * FROM achievements ORDER BY id ASC`;
    const mine = await sql`SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ${me}`;
    const earned = new Map(mine.map(r => [r.achievement_id, r.earned_at]));
    res.json({ achievements: all.map(a => ({ ...a, earned_at: earned.get(a.id) || null, has: earned.has(a.id) })) });
  } catch (err) { console.error('GET achievements:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/users/:id/achievements', requireAuth, async (req, res) => {
  try {
    const rows = await sql`SELECT a.* FROM user_achievements ua
                            JOIN achievements a ON a.id = ua.achievement_id
                            WHERE ua.user_id = ${req.params.id}
                            ORDER BY ua.earned_at DESC`;
    res.json({ achievements: rows });
  } catch (err) { console.error('GET user achievements:', err); res.status(500).json({ error: err.message }); }
});

// Joint practice sessions — invite peers to do a course block together
app.post('/api/joint-practice', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const { course_block_id, scheduled_at, invitee_ids } = req.body || {};
    const [row] = await sql`INSERT INTO joint_practice_sessions (host_id, course_block_id, scheduled_at)
                            VALUES (${me}, ${course_block_id ? parseInt(course_block_id,10) : null}, ${scheduled_at || null}) RETURNING *`;
    await sql`INSERT INTO joint_practice_participants (session_id, user_id) VALUES (${row.id}, ${me}) ON CONFLICT DO NOTHING`;
    if (Array.isArray(invitee_ids)) {
      for (const uid of invitee_ids) {
        await sql`INSERT INTO joint_practice_participants (session_id, user_id) VALUES (${row.id}, ${uid}) ON CONFLICT DO NOTHING`;
        await notifyUser(uid, 'joint_invite', { session_id: row.id, host: me, block_id: course_block_id });
      }
    }
    res.status(201).json({ session: row });
  } catch (err) { console.error('joint create:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/joint-practice/:id/messages', requireAuth, async (req, res) => {
  try {
    const sid = parseInt(req.params.id, 10);
    const rows = await sql`SELECT m.*, u.display_name FROM joint_practice_messages m
                           LEFT JOIN users u ON u.id = m.user_id
                           WHERE m.session_id = ${sid} ORDER BY m.created_at ASC LIMIT 200`;
    res.json({ messages: rows });
  } catch (err) { console.error('joint msgs:', err); res.status(500).json({ error: err.message }); }
});

// ── Stream recordings — upload + list ──
app.post('/api/chat/rooms/:id/recordings', requireAuth, uploadRecording.single('file'), async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const rid = parseInt(req.params.id, 10);
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'file part required' });
    const [room] = await sql`SELECT created_by FROM chat_rooms WHERE id = ${rid}`;
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const [caller] = await sql`SELECT role FROM users WHERE id = ${me}`;
    const isAdmin = caller && ['superadmin','founder','admin'].includes(caller.role);
    if (room.created_by !== me && !isAdmin) return res.status(403).json({ error: 'Only host can upload' });

    const hasOverlay = String(req.body.has_overlay) === 'true' || req.body.has_overlay === '1';
    const hasVideo = String(req.body.has_video) !== 'false';
    const duration = parseInt(req.body.duration_seconds, 10) || 0;
    const startedAt = req.body.started_at || null;
    const endedAt = req.body.ended_at || new Date().toISOString();
    const ext = hasVideo ? 'webm' : 'webm';     // audio-only is also webm-opus
    const mime = req.file.mimetype || (hasVideo ? 'video/webm' : 'audio/webm');
    const safeName = (req.body.filename || ('room-' + rid + '-' + Date.now() + '.' + ext)).toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    const objectKey = 'assets/recordings/rooms/' + rid + '/' + Date.now() + '-' + safeName;
    const stored = await storeMediaAsset(objectKey, req.file.buffer, mime, '[room ' + rid + '] add recording: ' + safeName);
    const url = stored.url;
    const [row] = await sql`INSERT INTO room_recordings
      (room_id, recorder_user_id, url, filename, mime_type, size_bytes, duration_seconds, has_overlay, has_video, started_at, ended_at)
      VALUES (${rid}, ${me}, ${url}, ${safeName}, ${mime}, ${req.file.size || 0}, ${duration}, ${hasOverlay}, ${hasVideo}, ${startedAt}, ${endedAt})
      RETURNING *`;
    // Post a system message in the room linking to the recording
    await sql`INSERT INTO chat_room_messages (room_id, sender_id, body, is_announcement)
              VALUES (${rid}, ${me}, ${'🎬 Запись стрима доступна: ' + url}, true)`;
    res.status(201).json({ recording: row });
  } catch (err) { console.error('POST recording:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/chat/rooms/:id/recordings', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const rid = parseInt(req.params.id, 10);
    const [member] = await sql`SELECT 1 FROM chat_room_members WHERE room_id = ${rid} AND user_id = ${me}`;
    const [caller] = await sql`SELECT role FROM users WHERE id = ${me}`;
    const isAdmin = caller && ['superadmin','founder','admin'].includes(caller.role);
    if (!member && !isAdmin) return res.status(403).json({ error: 'Not a member' });
    const rows = await sql`SELECT * FROM room_recordings WHERE room_id = ${rid} ORDER BY created_at DESC LIMIT 50`;
    res.json({ recordings: rows });
  } catch (err) { console.error('GET recordings:', err); res.status(500).json({ error: err.message }); }
});

// Toggle live mode on a chat room (admin/superadmin/founder + room creator)
app.patch('/api/chat/rooms/:id', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const rid = parseInt(req.params.id, 10);
    const [room] = await sql`SELECT * FROM chat_rooms WHERE id = ${rid}`;
    if (!room) return res.status(404).json({ error: 'Not found' });
    const isAdmin = ['superadmin','founder','admin'].includes(req.user.role || '');
    if (room.created_by !== me && !isAdmin) return res.status(403).json({ error: 'Not your room' });
    const { is_live, name, description } = req.body || {};
    let liveStartedAt = room.live_started_at;
    if (is_live === true && !room.is_live) liveStartedAt = new Date();
    if (is_live === false) liveStartedAt = null;
    const [updated] = await sql`UPDATE chat_rooms SET
      is_live = COALESCE(${is_live !== undefined ? !!is_live : null}, is_live),
      live_started_at = ${liveStartedAt},
      name = COALESCE(${name}, name),
      description = COALESCE(${description}, description)
      WHERE id = ${rid} RETURNING *`;
    if (is_live !== undefined) {
      // System message announcing the state change
      await sql`INSERT INTO chat_room_messages (room_id, sender_id, body, is_announcement)
                VALUES (${rid}, ${me}, ${is_live ? '🔴 LIVE началась' : '⏹ LIVE завершена'}, true)`;
    }
    res.json({ room: updated });
  } catch (err) { console.error('PATCH room:', err); res.status(500).json({ error: err.message }); }
});

// Joint practice: join/leave (posts system messages)
app.post('/api/joint-practice/:id/join', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const sid = parseInt(req.params.id, 10);
    await sql`INSERT INTO joint_practice_participants (session_id, user_id, last_seen_at)
              VALUES (${sid}, ${me}, now())
              ON CONFLICT (session_id, user_id) DO UPDATE SET left_at = NULL, last_seen_at = now()`;
    const [u] = await sql`SELECT display_name FROM users WHERE id = ${me}`;
    await sql`INSERT INTO joint_practice_messages (session_id, user_id, kind, body)
              VALUES (${sid}, ${me}, 'system', ${(u?.display_name || 'Кто-то') + ' присоединился к практике'})`;
    res.json({ ok: true });
  } catch (err) { console.error('joint join:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/joint-practice/:id/leave', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const sid = parseInt(req.params.id, 10);
    await sql`UPDATE joint_practice_participants SET left_at = now() WHERE session_id = ${sid} AND user_id = ${me}`;
    const [u] = await sql`SELECT display_name FROM users WHERE id = ${me}`;
    await sql`INSERT INTO joint_practice_messages (session_id, user_id, kind, body)
              VALUES (${sid}, ${me}, 'system', ${(u?.display_name || 'Кто-то') + ' покинул(а) практику'})`;
    res.json({ ok: true });
  } catch (err) { console.error('joint leave:', err); res.status(500).json({ error: err.message }); }
});

app.post('/api/joint-practice/:id/messages', requireAuth, async (req, res) => {
  try {
    const me = req.user.sub || req.user.id;
    const sid = parseInt(req.params.id, 10);
    const { body, emoji, kind } = req.body || {};
    const [row] = await sql`INSERT INTO joint_practice_messages (session_id, user_id, kind, body, emoji)
                            VALUES (${sid}, ${me}, ${kind||'text'}, ${body||''}, ${emoji||''}) RETURNING *`;
    res.status(201).json({ message: row });
  } catch (err) { console.error('joint post msg:', err); res.status(500).json({ error: err.message }); }
});

// ── Admin: grant test access to a user (writes a synthetic completed consent_log row)
// Use this to give a tester program-access without making them go through Stripe.
// After call, getUserAccessTags(user) will include the chosen tag → courses with
// matching program_access will be visible in their student dashboard.
app.post('/api/admin/grant-test-access', requireAuth, async (req, res) => {
  try {
    const callerId = req.user.sub || req.user.id;
    const [caller] = await sql`SELECT role FROM users WHERE id = ${callerId}`;
    if (!caller || !['superadmin','founder','admin'].includes(caller.role)) return res.status(403).json({ error: 'Admin only' });
    const { email, product } = req.body || {};
    if (!email || !product) return res.status(400).json({ error: 'email and product required (product = lab/rehab/guided/group)' });
    if (!['lab','rehab','guided','group'].includes(product)) return res.status(400).json({ error: 'product must be lab|rehab|guided|group' });
    const [target] = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${email})`;
    if (!target) return res.status(404).json({ error: 'User with that email not found' });
    // Idempotent — skip if already has a paid row for this product
    const existing = await sql`SELECT id FROM consent_log WHERE user_id = ${target.id} AND product = ${product} AND payment_status IN ('paid','completed')`;
    if (existing.length) return res.json({ ok: true, already_granted: true });
    const [row] = await sql`INSERT INTO consent_log
      (user_id, email, product, payment_status, consent_timestamp, consent_tos, consent_privacy, consent_digital, amount_total, stripe_session_id)
      VALUES (${target.id}, ${email.toLowerCase()}, ${product}, 'paid', now(), true, true, true, 0, ${'TEST_GRANT_' + Date.now()})
      RETURNING id`;
    res.json({ ok: true, granted: { user_id: target.id, product, consent_log_id: row.id } });
  } catch (err) { console.error('grant test access:', err); res.status(500).json({ error: err.message }); }
});

// Admin: revoke test access (deletes the synthetic row)
app.post('/api/admin/revoke-test-access', requireAuth, async (req, res) => {
  try {
    const callerId = req.user.sub || req.user.id;
    const [caller] = await sql`SELECT role FROM users WHERE id = ${callerId}`;
    if (!caller || !['superadmin','founder','admin'].includes(caller.role)) return res.status(403).json({ error: 'Admin only' });
    const { email, product } = req.body || {};
    const [target] = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${email})`;
    if (!target) return res.status(404).json({ error: 'User not found' });
    const result = await sql`DELETE FROM consent_log
      WHERE user_id = ${target.id} AND product = ${product}
        AND stripe_session_id LIKE 'TEST_GRANT_%' RETURNING id`;
    res.json({ ok: true, revoked: result.length });
  } catch (err) { console.error('revoke test access:', err); res.status(500).json({ error: err.message }); }
});

// Admin: promote/demote a user (assign role). Used to make someone an admin tester
// so they can write/edit/delete posts and use admin-only courses constructor in sandbox.
app.post('/api/admin/set-user-role', requireAuth, async (req, res) => {
  try {
    const callerId = req.user.sub || req.user.id;
    const [caller] = await sql`SELECT role FROM users WHERE id = ${callerId}`;
    if (!caller || !['superadmin','founder'].includes(caller.role)) return res.status(403).json({ error: 'superadmin/founder only' });
    const { email, role } = req.body || {};
    if (!email || !role) return res.status(400).json({ error: 'email and role required' });
    if (!['user','admin','specialist','founder'].includes(role)) return res.status(400).json({ error: 'role must be user|admin|specialist|founder' });
    const [target] = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${email})`;
    if (!target) return res.status(404).json({ error: 'User not found' });
    await sql`UPDATE users SET role = ${role} WHERE id = ${target.id}`;
    res.json({ ok: true, user_id: target.id, new_role: role });
  } catch (err) { console.error('set role:', err); res.status(500).json({ error: err.message }); }
});

// ── Storage backend status (admin diagnostic) ──
app.get('/api/admin/storage-status', requireAuth, async (req, res) => {
  try {
    const callerId = req.user.sub || req.user.id;
    const [caller] = await sql`SELECT role FROM users WHERE id = ${callerId}`;
    if (!caller || !['superadmin','founder','admin'].includes(caller.role)) return res.status(403).json({ error: 'Admin only' });
    res.json(getStorageStatus());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PACK 21: Admin test confirmation email ──
app.post('/api/admin/test-email', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.sub || req.user.id}`;
    if (!caller.length || !['superadmin', 'founder'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { email, product = 'lab' } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    const result = await sendConfirmationEmail(email, product, 'TEST_' + Date.now());
    res.json({ ok: true, sent_to: email, product: product, result: result || null });
  } catch (err) {
    console.error('POST /api/admin/test-email:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PACK 21: Bulk seed vocab_terms from neuromap-vocabulary.json (idempotent) ──
app.post('/api/admin/vocab/import-from-json', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.sub || req.user.id}`;
    if (!caller.length || !['superadmin', 'founder'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const vocabPath = path.join(__dirname, 'neuromap-vocabulary.json');
    const vocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
    const enMap = (vocab._translations && vocab._translations.en) || {};
    const esMap = (vocab._translations && vocab._translations.es) || {};
    function transliterate(s) {
      const map = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya' };
      return String(s).toLowerCase().split('').map(c => map[c] !== undefined ? map[c] : c).join('').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
    }
    const counts = { emotion: 0, area: 0, cause: 0, thought: 0, action: 0 };
    if (vocab.emotions) {
      for (const polarity of ['negative', 'positive', 'neutral']) {
        const list = vocab.emotions[polarity] || [];
        for (let i = 0; i < list.length; i++) {
          const e = list[i]; const ru = e.name; const slug = transliterate(ru);
          if (!slug) continue;
          await sql`INSERT INTO vocab_terms (category, slug, label_ru, label_en, label_es, polarity_strength, order_idx)
                    VALUES ('emotion', ${slug}, ${ru}, ${enMap[ru] || ru}, ${esMap[ru] || ru}, ${e.polarity_strength || null}, ${counts.emotion})
                    ON CONFLICT (category, slug) DO UPDATE SET label_ru = EXCLUDED.label_ru, label_en = EXCLUDED.label_en, label_es = EXCLUDED.label_es, polarity_strength = COALESCE(EXCLUDED.polarity_strength, vocab_terms.polarity_strength), updated_at = now()`;
          counts.emotion++;
        }
      }
    }
    // Recursively flatten nested objects/arrays into a list of strings.
    // Handles both string entries and {text, emoji} objects (used for thoughts).
    function flattenStrings(node, out) {
      if (node == null) return;
      if (Array.isArray(node)) {
        for (const item of node) flattenStrings(item, out);
        return;
      }
      if (typeof node === 'object') {
        if (typeof node.text === 'string') {
          out.push(node.text);
          return;
        }
        if (typeof node.name === 'string') {
          out.push(node.name);
          return;
        }
        for (const k of Object.keys(node)) flattenStrings(node[k], out);
        return;
      }
      if (typeof node === 'string' && node.trim()) out.push(node.trim());
    }
    async function seedDeepCategory(category, source, idxKey) {
      if (!source) return;
      const items = [];
      flattenStrings(source, items);
      const seen = new Set();
      let idx = 0;
      for (const ru of items) {
        if (!ru || seen.has(ru)) continue;
        seen.add(ru);
        const slug = transliterate(ru); if (!slug) continue;
        await sql`INSERT INTO vocab_terms (category, slug, label_ru, label_en, label_es, order_idx)
                  VALUES (${category}, ${slug}, ${ru}, ${enMap[ru] || ru}, ${esMap[ru] || ru}, ${idx})
                  ON CONFLICT (category, slug) DO UPDATE SET label_ru = EXCLUDED.label_ru, label_en = EXCLUDED.label_en, label_es = EXCLUDED.label_es, updated_at = now()`;
        counts[idxKey]++;
        idx++;
      }
    }
    await seedDeepCategory('area', vocab.areas, 'area');
    await seedDeepCategory('cause', vocab.causes, 'cause');
    await seedDeepCategory('thought', vocab.thoughts, 'thought');
    await seedDeepCategory('action', vocab.practices, 'action');

    // ── Purge stale + corrupted entries ──
    // 1) Build set of valid slugs from JSON for each deep category
    const validSlugs = { area: new Set(), cause: new Set(), thought: new Set(), action: new Set() };
    function collectValidSlugs(category, source) {
      if (!source) return;
      const items = [];
      flattenStrings(source, items);
      const seen = new Set();
      for (const ru of items) {
        if (!ru || seen.has(ru)) continue;
        seen.add(ru);
        const slug = transliterate(ru);
        if (slug) validSlugs[category].add(slug);
      }
    }
    collectValidSlugs('area', vocab.areas);
    collectValidSlugs('cause', vocab.causes);
    collectValidSlugs('thought', vocab.thoughts);
    collectValidSlugs('action', vocab.practices);
    const purged = { area: 0, cause: 0, thought: 0, action: 0, broken: 0 };
    for (const cat of ['area', 'cause', 'thought', 'action']) {
      const validArr = Array.from(validSlugs[cat]);
      if (validArr.length === 0) continue;
      const result = await sql`DELETE FROM vocab_terms WHERE category = ${cat} AND slug <> ALL(${validArr}::text[]) RETURNING id`;
      purged[cat] = (result || []).length;
    }
    // 2) Delete any row whose label contains the U+FFFD replacement char in any language
    const FFFD = String.fromCharCode(0xFFFD);
    const broken = await sql`DELETE FROM vocab_terms
                              WHERE label_ru LIKE ${'%'+FFFD+'%'}
                                 OR label_en LIKE ${'%'+FFFD+'%'}
                                 OR label_es LIKE ${'%'+FFFD+'%'}
                                 OR label_ru LIKE '{%' OR label_ru LIKE '[%'
                              RETURNING id`;
    purged.broken = (broken || []).length;
    res.json({ ok: true, counts, purged });
  } catch (err) {
    console.error('POST /api/admin/vocab/import-from-json:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── PACK 21: Admin — recent purchases / sales feed ──
app.get('/api/admin/purchases', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.sub || req.user.id}`;
    if (!caller.length || !['superadmin', 'founder', 'specialist'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const rows = await sql`
      SELECT cl.id, cl.product, cl.email, cl.user_id, cl.payment_status, cl.amount_total, cl.currency, cl.consent_timestamp, cl.stripe_session_id, cl.stripe_payment_intent_id, cl.discount_amount, cl.promotion_code, cl.refunded_at,
             u.display_name AS user_name
      FROM consent_log cl
      LEFT JOIN users u ON u.id = cl.user_id
      WHERE cl.payment_status IN ('paid','completed','refunded')
      ORDER BY cl.consent_timestamp DESC
      LIMIT ${limit}
    `;
    const purchases = rows.map(r => {
      const purchasedAt = r.consent_timestamp || new Date();
      const activationDate = new Date(new Date(purchasedAt).getTime() + ACTIVATION_DAYS * 24 * 60 * 60 * 1000);
      const now = Date.now();
      const daysLeft = Math.max(0, Math.ceil((activationDate.getTime() - now) / (24 * 60 * 60 * 1000)));
      return {
        ...r,
        activation_date: activationDate.toISOString(),
        days_until_activation: daysLeft,
        is_activated: now >= activationDate.getTime()
      };
    });
    res.json({ purchases });
  } catch (err) {
    console.error('GET /api/admin/purchases:', err);
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
    const [paidR] = await sql`SELECT COUNT(DISTINCT cl.user_id) AS cnt FROM consent_log cl WHERE cl.payment_status IN ('paid','completed')`;

    // Recent signups (last 10)
    const recent = await sql`
      SELECT id, email, display_name AS name, role, phone, created_at, avatar_url
      FROM users ORDER BY created_at DESC LIMIT 10
    `;

    // Sales by program (from consent_log)
    const salesRows = await sql`
      SELECT COALESCE(product, 'unknown') AS program, COUNT(*) AS cnt
      FROM consent_log WHERE payment_status IN ('paid','completed')
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

    // Normalize role aliases — frontend buttons may send legacy/plural/synonym names.
    // We expand to an array of acceptable DB roles. Empty array = no filter.
    const roleAliasMap = {
      'admin': ['admin'],
      'admins': ['admin'],
      'admin_basic': ['admin'],
      'client': ['user', 'client'],
      'clients': ['user', 'client'],
      'user': ['user'],
      'users': ['user'],
      'specialist': ['specialist'],
      'specialists': ['specialist'],
      'founder': ['founder', 'superadmin'],
      'founders': ['founder', 'superadmin'],
      'superadmin': ['superadmin']
    };
    let roleArr = null;
    if (role && role !== 'all' && role !== '') {
      roleArr = roleAliasMap[role.toLowerCase()] || [role];
    }

    // Simple approach: fetch all matching users, then enrich
    let users, countR;
    const like = search ? `%${search.toLowerCase()}%` : null;

    if (roleArr && like) {
      [countR] = await sql`SELECT COUNT(*) AS cnt FROM users WHERE deleted_at IS NULL AND role = ANY(${roleArr}::text[]) AND (LOWER(email) LIKE ${like} OR LOWER(display_name) LIKE ${like} OR phone LIKE ${like})`;
      users = await sql`
        SELECT id, email, display_name, role, phone, created_at, last_login_at, avatar_url
        FROM users WHERE deleted_at IS NULL AND role = ANY(${roleArr}::text[]) AND (LOWER(email) LIKE ${like} OR LOWER(display_name) LIKE ${like} OR phone LIKE ${like})
        ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
      `;
    } else if (roleArr) {
      [countR] = await sql`SELECT COUNT(*) AS cnt FROM users WHERE deleted_at IS NULL AND role = ANY(${roleArr}::text[])`;
      users = await sql`
        SELECT id, email, display_name, role, phone, created_at, last_login_at, avatar_url
        FROM users WHERE deleted_at IS NULL AND role = ANY(${roleArr}::text[])
        ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
      `;
    } else if (like) {
      [countR] = await sql`SELECT COUNT(*) AS cnt FROM users WHERE deleted_at IS NULL AND (LOWER(email) LIKE ${like} OR LOWER(display_name) LIKE ${like} OR phone LIKE ${like})`;
      users = await sql`
        SELECT id, email, display_name, role, phone, created_at, last_login_at, avatar_url
        FROM users WHERE deleted_at IS NULL AND (LOWER(email) LIKE ${like} OR LOWER(display_name) LIKE ${like} OR phone LIKE ${like})
        ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
      `;
    } else {
      [countR] = await sql`SELECT COUNT(*) AS cnt FROM users WHERE deleted_at IS NULL`;
      users = await sql`
        SELECT id, email, display_name, role, phone, created_at, last_login_at, avatar_url
        FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ${lim} OFFSET ${off}
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
        // Pack 21: include latest paid purchase
        const [pp] = await sql`
          SELECT product, payment_status, amount_total, currency, consent_timestamp
          FROM consent_log
          WHERE (user_id = ${u.id} OR email = ${u.email})
            AND payment_status IN ('paid','completed')
          ORDER BY consent_timestamp DESC LIMIT 1
        `;
        if (pp) {
          u.purchased_product = pp.product;
          u.purchased_at = pp.consent_timestamp;
          u.purchase_amount = pp.amount_total;
          u.purchase_currency = pp.currency;
          u.has_paid_program = true;
        } else {
          u.has_paid_program = false;
        }
      } catch (enrichErr) {
        console.warn('Enrich user', u.id, enrichErr.message);
        u.test_completed = false; u.nm_entries_count = 0; u.diary_entries_count = 0; u.rehab_flag = false; u.has_paid_program = false;
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
    const [nmLastEntry] = await sql`SELECT MAX(last_seen_at) AS last_at FROM nm_nodes WHERE user_id = ${userId}`;
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

    // Pack 21: Purchases linked by user_id OR email
    const purchaseRows = await sql`
      SELECT id, product, payment_status, amount_total, currency, consent_timestamp, stripe_session_id
      FROM consent_log
      WHERE (user_id = ${userId} OR email = ${user.email})
        AND payment_status IN ('paid','completed')
      ORDER BY consent_timestamp DESC
    `;
    const purchases = purchaseRows.map(r => {
      const purchasedAt = r.consent_timestamp || new Date();
      const activationDate = new Date(new Date(purchasedAt).getTime() + 14 * 24 * 60 * 60 * 1000);
      const now = Date.now();
      return {
        ...r,
        activation_date: activationDate.toISOString(),
        days_until_activation: Math.max(0, Math.ceil((activationDate.getTime() - now) / (24 * 60 * 60 * 1000))),
        is_activated: now >= activationDate.getTime()
      };
    });

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
      user_stats: userStats,
      purchases: purchases
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

// ── ADMIN: Change user role (superadmin only) ──
app.patch('/api/admin/users/:id/role', requireAuth, async (req, res) => {
  try {
    const caller = await sql`SELECT role FROM users WHERE id = ${req.user.id}`;
    if (!caller.length || !['superadmin', 'founder'].includes(caller[0].role)) {
      return res.status(403).json({ error: 'Only superadmin/founder can change roles' });
    }

    const targetId = req.params.id;
    const { role } = req.body;
    const VALID_ROLES = ['user', 'client', 'specialist', 'admin', 'superadmin', 'founder'];
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Valid: ' + VALID_ROLES.join(', ') });
    }

    // Prevent superadmin from changing own role
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const [target] = await sql`SELECT id, role FROM users WHERE id = ${targetId}`;
    if (!target) return res.status(404).json({ error: 'User not found' });

    const oldRole = target.role;
    await sql`UPDATE users SET role = ${role} WHERE id = ${targetId}`;

    console.log(`[ROLE CHANGE] ${req.user.id} changed ${targetId} from ${oldRole} to ${role}`);
    res.json({ ok: true, old_role: oldRole, new_role: role });
  } catch (err) {
    console.error('PATCH /api/admin/users/:id/role:', err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  EXTERNAL FIELD — objective environmental signals (sun/moon/earth/weather/
//  cosmos/social/experimental). Sources are isolated under services/external/*;
//  a poller ingests them into external_signal_events; users read via the API.
//  Tone is factual/observational — no predictions, no medical claims.
// ════════════════════════════════════════════════════════════════════════════
const EXT_SOURCES = {
  noaa:    { load: () => require('./services/external/noaa'),    everyMs: 10 * 60 * 1000 },
  donki:   { load: () => require('./services/external/donki'),   everyMs: 60 * 60 * 1000 },
  usgs:    { load: () => require('./services/external/usgs'),    everyMs: 15 * 60 * 1000 },
  gracedb: { load: () => require('./services/external/gracedb'), everyMs: 5 * 60 * 1000 },
  gdelt:   { load: () => require('./services/external/gdelt'),   everyMs: 60 * 60 * 1000 },
  moon:    { load: () => require('./services/external/moon'),    everyMs: 24 * 60 * 60 * 1000 }
};

async function extInsert(ev) {
  const rows = await sql`
    INSERT INTO external_signal_events
      (user_id, layer, source, source_url, event_type, title, description, timestamp,
       start_time, end_time, severity, location_scope, latitude, longitude, dedup_key, raw_payload)
    VALUES (${ev.user_id || null}, ${ev.layer}, ${ev.source}, ${ev.source_url || null},
       ${ev.event_type || null}, ${ev.title || null}, ${ev.description || null}, ${ev.timestamp},
       ${ev.start_time || null}, ${ev.end_time || null}, ${ev.severity || null},
       ${ev.location_scope || 'global'}, ${ev.latitude != null ? ev.latitude : null},
       ${ev.longitude != null ? ev.longitude : null}, ${ev.dedup_key || null},
       ${JSON.stringify(ev.raw_payload || {})}::jsonb)
    ON CONFLICT (dedup_key) WHERE dedup_key IS NOT NULL DO NOTHING
    RETURNING id`;
  return rows.length ? rows[0].id : null;
}

function extSignificant(ev) {
  if (ev.layer === 'sun' && /^[MX]/.test(ev.severity || '')) return true;       // M/X flares
  if (ev.event_type === 'cme' || ev.event_type === 'geomagnetic_storm') return true;
  if (ev.layer === 'earth' && /Kp(\d)/.test(ev.severity || '')) { const kp = parseFloat((ev.severity.match(/Kp(\d+(\.\d+)?)/) || [])[1]); return kp >= 5; }
  if (ev.event_type === 'earthquake') { const m = parseFloat((ev.severity || '').replace('M', '')); return m >= 5.5; }
  if (ev.event_type === 'gw_candidate') return true;
  return false;
}
function extNotifyBody(ev) {
  if (ev.event_type === 'flare') return 'Solar flare detected: ' + (ev.severity || '') + ' class. Source: ' + ev.source + '. Potential Earth-directed effects depend on CME confirmation.';
  if (ev.event_type === 'cme') return 'Coronal mass ejection recorded. Source: ' + ev.source + '. Event saved to External Field timeline.';
  if (ev.layer === 'earth' && /Kp/.test(ev.severity || '')) return 'Geomagnetic activity increased: ' + ev.severity + '. Event saved to External Field timeline.';
  if (ev.event_type === 'earthquake') return ev.title + '. Source: USGS. Event saved to Earth layer.';
  if (ev.event_type === 'gw_candidate') return 'Gravitational-wave candidate detected by LVK public alerts. Event saved to Cosmos layer. Biological relevance is not assumed.';
  return ev.title + '. Event saved to External Field timeline.';
}
async function extNotify(ev, eventId) {
  if (!extSignificant(ev)) return;
  let subs;
  try { subs = await sql`SELECT user_id, config FROM external_field_subscriptions`; } catch (e) { return; }
  for (const s of subs) {
    try {
      const cfg = (s.config || {})[ev.layer];
      if (!cfg || !cfg.enabled || !cfg.notify) continue;
      const body = extNotifyBody(ev);
      await sql`INSERT INTO external_field_notifications (user_id, event_id, layer, title, body) VALUES (${s.user_id}, ${eventId}, ${ev.layer}, ${ev.title}, ${body})`;
      await sql`INSERT INTO notifications (user_id, kind, payload) VALUES (${s.user_id}, 'external_field', ${JSON.stringify({ layer: ev.layer, title: ev.title, body: body, event_id: eventId })}::jsonb)`;
    } catch (e) { /* one user's notify failure must not block others */ }
  }
}
async function runExtSource(name) {
  try {
    const mod = EXT_SOURCES[name].load();
    const events = await mod.fetchLatest({ nasaKey: process.env.NASA_API_KEY || 'DEMO_KEY' });
    let added = 0;
    for (const ev of (events || [])) {
      if (!ev || !ev.timestamp || !ev.layer) continue;
      const id = await extInsert(ev);
      if (id) { added++; await extNotify(ev, id); }
    }
    if (added) console.log('[ext/' + name + '] +' + added + ' new events');
  } catch (e) { console.warn('[ext/' + name + '] poll failed:', e.message); }
}
function startExternalPoller() {
  if (!process.env.DATABASE_URL) return;
  Object.keys(EXT_SOURCES).forEach(function (name, i) {
    setTimeout(function () { runExtSource(name); }, 5000 + i * 3000);   // staggered first run
    setInterval(function () { runExtSource(name); }, EXT_SOURCES[name].everyMs);
  });
  console.log('[ext] External Field poller started');
}

// ── PACK F / B9: Body-Functions library + circuits + region relations ───────
// Reference data (no PII) — served without auth; tool *visibility* is still gated
// by tool-access in the UI. Used by the Body Functions tool, the atlas relations
// panel, and course-embedded function blocks.

// GET /api/anatomy/functions?q=&category=&limit= — search/list functions
app.get('/api/anatomy/functions', async (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    const category = (req.query.category || '').trim().toLowerCase();
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    let rows;
    if (q) {
      const like = '%' + q + '%';
      rows = await sql`SELECT * FROM anatomy_functions
        WHERE (${category} = '' OR lower(category) = ${category})
          AND (lower(name_en) LIKE ${like} OR lower(coalesce(name_ru,'')) LIKE ${like}
               OR lower(coalesce(name_es,'')) LIKE ${like}
               OR lower(coalesce(description_en,'')) LIKE ${like}
               OR EXISTS (SELECT 1 FROM unnest(tags) tg WHERE lower(tg) LIKE ${like}))
        ORDER BY category, name_en LIMIT ${limit}`;
    } else if (category) {
      rows = await sql`SELECT * FROM anatomy_functions WHERE lower(category) = ${category} ORDER BY name_en LIMIT ${limit}`;
    } else {
      rows = await sql`SELECT * FROM anatomy_functions ORDER BY category, name_en LIMIT ${limit}`;
    }
    res.json({ ok: true, functions: rows });
  } catch (err) { console.error('GET /api/anatomy/functions:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/anatomy/functions/:slug — one function with its resolved circuits
app.get('/api/anatomy/functions/:slug', async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM anatomy_functions WHERE slug = ${req.params.slug}`;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const fn = rows[0];
    let circuits = [];
    if (fn.circuit_ids && fn.circuit_ids.length) {
      circuits = await sql`SELECT * FROM anatomy_circuits WHERE id = ANY(${fn.circuit_ids}::int[]) ORDER BY name_en`;
    }
    res.json({ ok: true, function: fn, circuits });
  } catch (err) { console.error('GET /api/anatomy/functions/:slug:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/anatomy/circuits — all named circuits
app.get('/api/anatomy/circuits', async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM anatomy_circuits ORDER BY name_en`;
    res.json({ ok: true, circuits: rows });
  } catch (err) { console.error('GET /api/anatomy/circuits:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/anatomy/relations?region=slug — relations touching a region (both dirs)
app.get('/api/anatomy/relations', async (req, res) => {
  try {
    const region = (req.query.region || '').trim();
    let rows;
    if (region) {
      rows = await sql`SELECT * FROM anatomy_region_relations WHERE region_a = ${region} OR region_b = ${region}`;
    } else {
      rows = await sql`SELECT * FROM anatomy_region_relations ORDER BY region_a, region_b`;
    }
    res.json({ ok: true, relations: rows });
  } catch (err) { console.error('GET /api/anatomy/relations:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/anatomy/regions/:id/links — everything connected to a region:
// related regions, named circuits, functions and conditions that involve it.
// Backs the Anatomy-tab side panel cross-links (B9 + F5).
app.get('/api/anatomy/regions/:id/links', async (req, res) => {
  try {
    const id = req.params.id;
    const [relations, circuits, functions, conditions] = await Promise.all([
      sql`SELECT * FROM anatomy_region_relations WHERE region_a = ${id} OR region_b = ${id}`,
      sql`SELECT id, slug, name_en, name_ru, name_es FROM anatomy_circuits WHERE ${id} = ANY(region_ids)`,
      sql`SELECT id, slug, name_en, name_ru, name_es, category FROM anatomy_functions WHERE ${id} = ANY(region_ids) ORDER BY name_en`,
      sql`SELECT id, slug, name_en, name_ru, name_es, category, is_neurodevelopmental FROM human_conditions WHERE ${id} = ANY(affected_region_ids) ORDER BY name_en`
    ]);
    res.json({ ok: true, region: id, relations, circuits, functions, conditions });
  } catch (err) { console.error('GET /api/anatomy/regions/:id/links:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/anatomy/conditions?q=&category=&limit= — diagnoses / states (tab 3)
app.get('/api/anatomy/conditions', async (req, res) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    const category = (req.query.category || '').trim().toLowerCase();
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    let rows;
    if (q) {
      const like = '%' + q + '%';
      rows = await sql`SELECT * FROM human_conditions
        WHERE (${category} = '' OR lower(category) = ${category})
          AND (lower(name_en) LIKE ${like} OR lower(coalesce(name_ru,'')) LIKE ${like}
               OR lower(coalesce(name_es,'')) LIKE ${like}
               OR lower(coalesce(description_en,'')) LIKE ${like})
        ORDER BY category, name_en LIMIT ${limit}`;
    } else if (category) {
      rows = await sql`SELECT * FROM human_conditions WHERE lower(category) = ${category} ORDER BY name_en LIMIT ${limit}`;
    } else {
      rows = await sql`SELECT * FROM human_conditions ORDER BY category, name_en LIMIT ${limit}`;
    }
    res.json({ ok: true, conditions: rows });
  } catch (err) { console.error('GET /api/anatomy/conditions:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/anatomy/conditions/:slug — one condition with its resolved functions
app.get('/api/anatomy/conditions/:slug', async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM human_conditions WHERE slug = ${req.params.slug}`;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const cond = rows[0];
    let functions = [];
    if (cond.affected_function_ids && cond.affected_function_ids.length) {
      functions = await sql`SELECT * FROM anatomy_functions WHERE id = ANY(${cond.affected_function_ids}::int[]) ORDER BY name_en`;
    }
    res.json({ ok: true, condition: cond, functions });
  } catch (err) { console.error('GET /api/anatomy/conditions/:slug:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/external/events?layer=&from=&to=&limit= — global + this user's events
app.get('/api/external/events', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const layer = req.query.layer && /^[a-z]+$/.test(req.query.layer) ? req.query.layer : null;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 300);
    const from = req.query.from ? new Date(req.query.from).toISOString() : new Date(Date.now() - 30 * 864e5).toISOString();
    const to = req.query.to ? new Date(req.query.to).toISOString() : new Date().toISOString();
    const rows = layer
      ? await sql`SELECT id, user_id, layer, source, source_url, event_type, title, description, timestamp, start_time, end_time, severity, location_scope, latitude, longitude, raw_payload
                  FROM external_signal_events
                  WHERE layer = ${layer} AND (user_id IS NULL OR user_id = ${userId}) AND timestamp >= ${from} AND timestamp <= ${to}
                  ORDER BY timestamp DESC LIMIT ${limit}`
      : await sql`SELECT id, user_id, layer, source, source_url, event_type, title, description, timestamp, start_time, end_time, severity, location_scope, latitude, longitude, raw_payload
                  FROM external_signal_events
                  WHERE (user_id IS NULL OR user_id = ${userId}) AND timestamp >= ${from} AND timestamp <= ${to}
                  ORDER BY timestamp DESC LIMIT ${limit}`;

    // C1: the Social layer carries free-form English GDELT headlines. When the
    // user's UI language is RU/ES, attach title_translated / description_translated
    // (cached, provider-pluggable). No provider configured -> fields equal the
    // original so the frontend transparently falls back to English.
    const lang = (req.query.lang || '').toLowerCase().slice(0, 2);
    if (/^(ru|es)$/.test(lang)) {
      try {
        const { translateMany, isConfigured } = require('./services/translate');
        if (isConfigured()) {
          const social = rows.filter(r => r.layer === 'social');
          if (social.length) {
            const titles = await translateMany(social.map(r => r.title || ''), lang, 60);
            const descs = await translateMany(social.map(r => r.description || ''), lang, 60);
            social.forEach((r, i) => { r.title_translated = titles[i]; r.description_translated = descs[i]; });
          }
        }
      } catch (e) { console.warn('social translate skipped:', e.message); }
    }
    res.json({ ok: true, events: rows });
  } catch (err) { console.error('GET /api/external/events:', err); res.status(500).json({ error: err.message }); }
});

// POST /api/admin/external/poll { source } — superadmin: force one poll cycle of a
// source NOW and report what it returned. Distinguishes a real quiet window
// (fetched=0) from a fetch/key failure, and reports whether the env key is set.
app.post('/api/admin/external/poll', requireAuth, async (req, res) => {
  try {
    const caller = await requireSuperadmin(req, res); if (!caller) return;
    const src = String((req.body && req.body.source) || '').trim();
    if (!EXT_SOURCES[src]) return res.status(400).json({ error: 'Unknown source. Valid: ' + Object.keys(EXT_SOURCES).join(', ') });
    let events;
    try { events = await EXT_SOURCES[src].load().fetchLatest({ nasaKey: process.env.NASA_API_KEY || 'DEMO_KEY' }); }
    catch (e) { return res.status(502).json({ ok: false, source: src, error: 'fetch failed: ' + e.message, usingKey: process.env.NASA_API_KEY ? 'env' : 'DEMO_KEY' }); }
    let added = 0;
    for (const ev of (events || [])) { if (!ev || !ev.timestamp || !ev.layer) continue; const id = await extInsert(ev); if (id) { added++; await extNotify(ev, id); } }
    const byType = {};
    (events || []).forEach(function (e) { if (e && e.event_type) byType[e.event_type] = (byType[e.event_type] || 0) + 1; });
    res.json({ ok: true, source: src, fetched: (events || []).length, added, byType, usingKey: process.env.NASA_API_KEY ? 'env' : 'DEMO_KEY' });
  } catch (err) { console.error('POST /api/admin/external/poll:', err); res.status(500).json({ error: err.message }); }
});

// GET/POST /api/external/subscriptions — per-layer config (enabled / showOnPath / notify)
app.get('/api/external/subscriptions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const rows = await sql`SELECT config FROM external_field_subscriptions WHERE user_id = ${userId}`;
    res.json({ ok: true, config: rows.length ? rows[0].config : {} });
  } catch (err) { console.error('GET /api/external/subscriptions:', err); res.status(500).json({ error: err.message }); }
});
app.post('/api/external/subscriptions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const config = (req.body && req.body.config) || {};
    await sql`INSERT INTO external_field_subscriptions (user_id, config, updated_at)
              VALUES (${userId}, ${JSON.stringify(config)}::jsonb, now())
              ON CONFLICT (user_id) DO UPDATE SET config = ${JSON.stringify(config)}::jsonb, updated_at = now()`;
    res.json({ ok: true });
  } catch (err) { console.error('POST /api/external/subscriptions:', err); res.status(500).json({ error: err.message }); }
});

// POST /api/users/me/location {lat,lon,city} — for weather/AQ/sunrise (no default)
app.post('/api/users/me/location', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const lat = parseFloat(req.body && req.body.lat), lon = parseFloat(req.body && req.body.lon);
    const city = (req.body && req.body.city ? String(req.body.city) : '').slice(0, 120) || null;
    const country = (req.body && req.body.country ? String(req.body.country) : '').slice(0, 80) || null;
    if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Valid lat/lon required' });
    }
    // country is optional here (External Field's quick set-location may omit it); only overwrite when provided.
    if (country) {
      await sql`UPDATE users SET location_lat = ${lat}, location_lon = ${lon}, location_city = ${city}, location_country = ${country} WHERE id = ${userId}`;
    } else {
      await sql`UPDATE users SET location_lat = ${lat}, location_lon = ${lon}, location_city = ${city} WHERE id = ${userId}`;
    }
    res.json({ ok: true, location: { lat: lat, lon: lon, city: city, country: country } });
  } catch (err) { console.error('POST /api/users/me/location:', err); res.status(500).json({ error: err.message }); }
});

// GET /api/external/notifications — this user's External Field notifications
app.get('/api/external/notifications', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub || req.user.id;
    const rows = await sql`SELECT id, event_id, layer, title, body, read_at, created_at
                           FROM external_field_notifications WHERE user_id = ${userId}
                           ORDER BY created_at DESC LIMIT 50`;
    res.json({ ok: true, notifications: rows });
  } catch (err) { console.error('GET /api/external/notifications:', err); res.status(500).json({ error: err.message }); }
});

// Soft-delete cron: every 5 min, hard-delete users whose grace window (1h) has
// elapsed. Idempotent and best-effort.
function startSoftDeleteCron() {
  async function sweep() {
    try {
      const due = await sql`SELECT id, email FROM users WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '1 hour' LIMIT 50`;
      for (const u of due) {
        await hardDeleteUser(u.id);
        try { await sql`INSERT INTO audit_log (action, target_user_id, detail) VALUES ('user.hard_delete', ${u.id}, ${JSON.stringify({ email: u.email })}::jsonb)`; } catch (e) {}
        console.log('[soft-delete] hard-deleted user', u.id);
      }
    } catch (e) { console.warn('[soft-delete cron]', e.message); }
  }
  setInterval(sweep, 5 * 60 * 1000);
  setTimeout(sweep, 30 * 1000);   // first pass shortly after boot
}

app.listen(PORT, () => {
  console.log(`NeuroAttention API running on port ${PORT}`);
  try { startExternalPoller(); } catch (e) { console.warn('[ext] poller start failed:', e.message); }
  try { startSoftDeleteCron(); } catch (e) { console.warn('[soft-delete] cron start failed:', e.message); }
});
