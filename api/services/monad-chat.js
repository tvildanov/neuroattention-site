'use strict';

// The site is the source of typed human messages. Monad may return mirrors of
// those messages through the legacy context reader; voice transcripts are new.
function pollCandidate(item, isChannelAckText) {
  const value = item.value != null ? item.value : item;
  const roleRaw = value && value.role;
  const role = roleRaw === 'human' || roleRaw === 'you' ? 'you' : roleRaw === 'system' ? 'system' : 'monad';
  const text = String(typeof value === 'string' ? value : (value && (value.text || value.body || value.message)) || '').trim().slice(0, 20000);
  if (!text || (role === 'you' && value.origin === 'lk_site')) return null;
  if (role !== 'you' && isChannelAckText(text)) return null;
  return { key: String(item.key || item.id || ''), role, text,
    seed_id: value.seed_id || null, origin: value.origin || null };
}

async function importPollMessages(sql, chatId, userId, candidates, via) {
  const seen = new Set();
  const rows = candidates.filter(Boolean).filter(c => {
    const identity = c.role !== 'you' ? JSON.stringify([c.role, c.text]) : (c.key || JSON.stringify([c.role, c.seed_id, c.text]));
    if (seen.has(identity)) return false;
    seen.add(identity); return true;
  }).map(c => ({ role: c.role, text: c.text, seed_id: c.seed_id,
    meta: { source_key: c.key || null, origin: c.origin, from_poll: true, via } }));
  if (!rows.length) return 0;
  // Serialize imports for this chat across tabs/processes. A separate statement
  // after the lock obtains a fresh READ COMMITTED snapshot, including prior polls.
  const results = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${String(chatId)}, 0))`,
    sql`INSERT INTO monad_chat_messages (chat_id, user_id, role, text, seed_id, meta)
      SELECT ${chatId}, ${userId}, c.role, c.text, c.seed_id, c.meta
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
        AS c(role text, text text, seed_id text, meta jsonb)
      WHERE NOT EXISTS (
        SELECT 1 FROM monad_chat_messages m WHERE m.chat_id = ${chatId} AND (
          (c.meta->>'source_key' IS NOT NULL AND m.meta->>'source_key' = c.meta->>'source_key')
          OR (c.role = 'you' AND c.seed_id IS NOT NULL AND m.role = 'you' AND m.seed_id::text = c.seed_id)
          OR (c.role <> 'you' AND m.role = c.role AND m.text = c.text
            AND m.created_at > now() - interval '2 minutes')
        )
      ) RETURNING id`
  ]);
  return results[1].length;
}

// Hide already imported, identifiable echoes without deleting conversation data
// or merging intentional repeated messages from the human.
function visibleMessages(messages) {
  const localSeeds = new Set(messages.filter(m => m.role === 'you' && !m.meta?.from_poll && m.seed_id).map(m => String(m.seed_id)));
  const keys = new Set();
  return messages.filter(m => {
    if (m.role === 'you' && m.meta?.from_poll && (m.meta.origin === 'lk_site' || (m.seed_id && localSeeds.has(String(m.seed_id))))) return false;
    const key = m.meta?.source_key;
    if (key && keys.has(key)) return false;
    if (key) keys.add(key);
    return true;
  });
}

module.exports = { pollCandidate, importPollMessages, visibleMessages };
