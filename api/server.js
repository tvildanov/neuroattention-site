const express = require('express');
const cors = require('cors');
const { neon } = require('@neondatabase/serverless');

const app = express();
const PORT = process.env.PORT || 3001;

// DB connection
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

app.use(cors({
  origin: [
    'https://neuroattention.org',
    'https://www.neuroattention.org',
    /\.github\.io$/,
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ]
}));
app.use(express.json({ limit: '4mb' }));

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// ── POINT AB: Save / Load ──

// Save or update entry
app.post('/api/pointab/save', async (req, res) => {
  try {
    const { user_id, point_a, change_a, point_b, reasons, corrections, share_with_specialist, reminder_frequency } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    // Upsert: update if entry exists for today, otherwise insert
    const today = new Date().toISOString().slice(0, 10);
    const existing = await sql`
      SELECT id FROM point_ab_entries
      WHERE user_id = ${user_id} AND created_at::date = ${today}::date
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
          ${user_id},
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

// Get latest entry for user
app.get('/api/pointab/:userId', async (req, res) => {
  try {
    const rows = await sql`
      SELECT e.*,
        (SELECT COUNT(*) FROM point_ab_audio WHERE entry_id = e.id) > 0 AS has_audio
      FROM point_ab_entries e
      WHERE e.user_id = ${req.params.userId}
      ORDER BY e.created_at DESC LIMIT 1
    `;
    if (!rows.length) return res.json({ entry: null });
    res.json({ entry: rows[0] });
  } catch (err) {
    console.error('GET /api/pointab/:userId:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Get all entries for user (history)
app.get('/api/pointab/:userId/all', async (req, res) => {
  try {
    const rows = await sql`
      SELECT id, created_at, updated_at,
        point_a->'image' AS a_image, point_b->'image' AS b_image,
        jsonb_array_length(reasons) AS reason_count,
        reminder_frequency
      FROM point_ab_entries
      WHERE user_id = ${req.params.userId}
      ORDER BY created_at DESC LIMIT 20
    `;
    res.json({ entries: rows });
  } catch (err) {
    console.error('GET /api/pointab/:userId/all:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── AUDIO ──

// Upload audio (base64 in body)
app.post('/api/pointab/audio', async (req, res) => {
  try {
    const { entry_id, audio_base64, duration_sec, mime_type } = req.body;
    if (!entry_id || !audio_base64) return res.status(400).json({ error: 'entry_id and audio_base64 required' });

    const buf = Buffer.from(audio_base64, 'base64');
    const sizeBytes = buf.length;

    // Server-side checks
    if (sizeBytes > 3670016) return res.status(413).json({ error: 'Audio too large (max 3.5 MB)' });
    if (duration_sec && duration_sec > 180) return res.status(413).json({ error: 'Audio too long (max 180 sec)' });

    // Delete previous audio for this entry
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

// Stream audio
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
    // audio_data comes as a hex string from neon serverless driver
    const buf = Buffer.from(row.audio_data, 'hex');
    res.send(buf);
  } catch (err) {
    console.error('GET /api/pointab/audio/:entryId:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── CALENDAR REMINDERS ──

// Sync reminders for a user
app.post('/api/pointab/reminders/sync', async (req, res) => {
  try {
    const { user_id, entry_id, frequency } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id required' });
    if (frequency === 'manual') {
      // Remove existing future reminders
      await sql`DELETE FROM calendar_reminders WHERE user_id = ${user_id} AND task_type = 'listen_program' AND reminder_date > CURRENT_DATE`;
      return res.json({ ok: true, count: 0 });
    }

    const days = frequency === 'daily' ? 1 : frequency === '1_week' ? 7 : 2; // 3_week default = every 2 days
    const values = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i * days);
      const dateStr = d.toISOString().slice(0, 10);
      values.push({ user_id, entry_id: entry_id || null, date: dateStr });
    }

    // Upsert reminders
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

// Get reminders for a user (month view)
app.get('/api/pointab/reminders/:userId', async (req, res) => {
  try {
    const { month, year } = req.query; // optional
    let rows;
    if (month && year) {
      rows = await sql`
        SELECT id, reminder_date, task_type, done, done_at
        FROM calendar_reminders
        WHERE user_id = ${req.params.userId}
          AND EXTRACT(MONTH FROM reminder_date) = ${month}
          AND EXTRACT(YEAR FROM reminder_date) = ${year}
        ORDER BY reminder_date
      `;
    } else {
      rows = await sql`
        SELECT id, reminder_date, task_type, done, done_at
        FROM calendar_reminders
        WHERE user_id = ${req.params.userId}
          AND reminder_date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY reminder_date
        LIMIT 60
      `;
    }
    res.json({ reminders: rows });
  } catch (err) {
    console.error('GET /api/pointab/reminders/:userId:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Toggle reminder done/undone
app.patch('/api/pointab/reminders/:id', async (req, res) => {
  try {
    const rows = await sql`
      UPDATE calendar_reminders
      SET done = NOT done, done_at = CASE WHEN done THEN NULL ELSE now() END
      WHERE id = ${req.params.id}
      RETURNING id, done
    `;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, done: rows[0].done });
  } catch (err) {
    console.error('PATCH /api/pointab/reminders/:id:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.listen(PORT, () => {
  console.log(`NeuroAttention API running on port ${PORT}`);
});
