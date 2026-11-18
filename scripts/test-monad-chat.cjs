'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const monadChat = require('../api/services/monad-chat');
const source = fs.readFileSync(require.resolve('../api/server.js'), 'utf8');
const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, options: '-c search_path=monad_chat_test', max: 8 });
function sql(parts, ...values) {
  const query = parts.reduce((s, p, i) => s + p + (i < values.length ? '$' + (i + 1) : ''), '');
  return { query, values, then: (ok, fail) => pool.query(query, values).then(r => r.rows).then(ok, fail) };
}
sql.transaction = async queries => {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = []; for (const q of queries) result.push((await client.query(q.query, q.values)).rows); await client.query('COMMIT'); return result; }
  catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
};

(async () => {
  await pool.query('CREATE SCHEMA monad_chat_test');
  await pool.query('CREATE TABLE monad_chats(id uuid primary key, user_id uuid, archived boolean not null default false, updated_at timestamptz default now())');
  await pool.query("CREATE TABLE monad_chat_messages(id uuid primary key default gen_random_uuid(), chat_id uuid, user_id uuid, role text, text text, seed_id text, meta jsonb default '{}'::jsonb, created_at timestamptz default now())");
  const userId = crypto.randomUUID(), chatId = crypto.randomUUID(), otherUser = crypto.randomUUID();
  await sql`INSERT INTO monad_chats(id,user_id) VALUES(${chatId},${userId})`;
  await sql`INSERT INTO monad_chat_messages(chat_id,user_id,role,text,seed_id,created_at) VALUES(${chatId},${userId},'you','hello','old-seed',now()-interval '1 day')`;
  let polled = { messages: [] }, failPoll = false, legacy = [], calls = [];
  const monadSvc = { configured: () => true, resolveHumanId: () => 'fixture', isChannelAckText: s => /ждем ответ/i.test(s), mcpCall: async (name, args) => {
    calls.push({ name, args }); if (name === 'human_chat_poll') { if (failPoll) throw Error('upstream unavailable'); return polled; } return legacy;
  } };
  let handler;
  const section = source.slice(source.indexOf("app.post('/api/monad/chats/:id/poll'"), source.indexOf('// GET /api/monad/inbox'));
  vm.runInNewContext(section, { app: { post: (path, auth, fn) => { handler = fn; } }, requireAuth: () => {}, loadCallerForMonad: async req => ({ id: req.userId }), sql, monadSvc, monadChat, console });
  async function poll(id = userId) {
    let body, status = 200;
    await handler({ userId: id, params: { id: chatId }, body: {} }, { status: n => { status = n; return { json: d => { body = d; } }; }, json: d => { body = d; } });
    return { status, body };
  }
  assert.equal((await poll()).status, 200);
  assert.equal(calls.length, 1, 'successful empty poll must not read raw context');
  assert.equal(calls[0].args.include_site_echo, false);
  assert.equal((await poll(otherUser)).status, 404, 'other owner cannot poll this chat');
  polled = { messages: [{ key: 'legacy-human', role: 'human', text: 'hello', seed_id: 'old-seed' }] };
  assert.equal((await poll()).body.imported, 0, 'typed human echo remains suppressed after one day');
  const candidate = monadChat.pollCandidate({ key: 'voice', role: 'human', origin: 'voice', text: 'мы ждем ответ?' }, monadSvc.isChannelAckText);
  assert.equal(candidate.role, 'you', 'human technical vocabulary is retained');
  assert.equal(monadChat.pollCandidate({ role: 'human', origin: 'lk_site', text: 'hello' }, () => false), null);
  polled = { messages: [{ key: 'answer', role: 'monad', text: 'a fixture reply' }, { key: 'voice', role: 'human', origin: 'voice', text: 'мы ждем ответ?' }] };
  const results = await Promise.all(Array.from({ length: 6 }, () => poll()));
  assert.equal(results.reduce((n, r) => n + r.body.imported, 0), 2, 'overlapping polls insert exactly one copy of each message');
  assert.equal((await sql`SELECT id FROM monad_chat_messages WHERE chat_id=${chatId}`).length, 3);
  failPoll = true; legacy = [{ key: 'mirror', value: { role: 'human', origin: 'lk_site', text: 'hello' } }, { key: 'fallback-answer', value: { role: 'monad', text: 'legacy fixture reply' } }];
  assert.equal((await poll()).body.imported, 1, 'fallback still imports real answers, never site echoes');
  await sql`INSERT INTO monad_chat_messages(chat_id,user_id,role,text,seed_id,meta) VALUES(${chatId},${userId},'you','hello','old-seed','{"from_poll":true,"source_key":"old-echo"}'::jsonb)`;
  const visible = (await poll()).body.messages;
  assert.equal(visible.filter(m => m.role === 'you' && m.text === 'hello').length, 1, 'stored historical echo is hidden without deletion');
  assert.equal((await sql`SELECT id FROM monad_chat_messages WHERE seed_id='old-seed'`).length, 2, 'history rows are preserved');
  console.log('MONAD_CHAT_POSTGRES_PASS: empty poll, owner isolation, old seed echo, voice transcript, fallback and six concurrent polls');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { await pool.query('DROP SCHEMA IF EXISTS monad_chat_test CASCADE'); await pool.end(); });
