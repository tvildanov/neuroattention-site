'use strict';

const maxBytes = 2 * 1024 * 1024;

function parseAttachment(value) {
  if (value == null) return null;
  if (typeof value.name !== 'string' || typeof value.base64 !== 'string') throw Error('Invalid attachment');
  const name = value.name.replace(/[\u0000-\u001f\u007f/\\]/g, '_').trim().slice(0,150);
  if (!name || value.base64.length > Math.ceil(maxBytes / 3) * 4) throw Error('Invalid attachment');
  const bytes = Buffer.from(value.base64,'base64');
  if (!bytes.length || bytes.length > maxBytes || bytes.toString('base64') !== value.base64) throw Error('Invalid attachment');
  return { name, size:bytes.length, base64:value.base64 };
}

async function ensureSchema(sql) {
  await sql`CREATE TABLE IF NOT EXISTS dom_hidden_messages (
    user_id UUID NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('dm','group')), conversation_id INTEGER NOT NULL,
    message_id TEXT NOT NULL, PRIMARY KEY(user_id,kind,conversation_id,message_id))`;
  await sql`ALTER TABLE IF EXISTS dm_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS attachment_data TEXT`;
  await sql`ALTER TABLE IF EXISTS chat_room_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS attachment_data TEXT`;
  await sql`CREATE TABLE IF NOT EXISTS dom_conversation_folders (
    id BIGSERIAL PRIMARY KEY, user_id UUID NOT NULL, name TEXT NOT NULL, UNIQUE(user_id,name))`;
  await sql`CREATE TABLE IF NOT EXISTS dom_conversation_settings (
    user_id UUID NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('dm','group')), conversation_id INTEGER NOT NULL,
    folder_id BIGINT REFERENCES dom_conversation_folders(id) ON DELETE SET NULL,
    hidden BOOLEAN NOT NULL DEFAULT false, PRIMARY KEY(user_id,kind,conversation_id))`;
}

function install(app,{requireAuth,sql}) {
  const path = '/api/domunity/conversations/:kind/:conversationId';
  const foldersPath = '/api/domunity/conversation-folders';
  const idOf = value => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null;
  };
  const run = handler => async (req,res) => {
    if (req.monadReadonly) return res.status(403).json({error:'Forbidden'});
    try { await handler(req,res,req.user.sub || req.user.id); }
    catch (error) {
      console.error('[DOMunity conversation controls]',error.code || 'error');
      res.status(500).json({error:'Conversation action unavailable'});
    }
  };
  const withConversation = handler => run(async (req,res,me) => {
    const id = idOf(req.params.conversationId);
    const kind = req.params.kind;
    if (!id || !['dm','group'].includes(kind)) return res.status(400).json({error:'Invalid conversation'});
    const [allowed] = kind === 'dm'
      ? await sql`SELECT id FROM dm_threads WHERE id=${id} AND (user_a=${me} OR user_b=${me})`
      : await sql`SELECT r.id FROM chat_rooms r JOIN chat_room_members m ON m.room_id=r.id
          WHERE r.id=${id} AND r.dm_thread_id IS NULL AND m.user_id=${me}`;
    if (!allowed) return res.status(404).json({error:'Conversation not found'});
    await handler(req,res,me,id,kind);
  });

  app.get(foldersPath,requireAuth,run(async (req,res,me) => {
    const folders = await sql`SELECT id,name FROM dom_conversation_folders WHERE user_id=${me} ORDER BY name,id`;
    res.json({folders});
  }));
  app.post(foldersPath,requireAuth,run(async (req,res,me) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 80) return res.status(400).json({error:'Invalid folder name'});
    const [folder] = await sql`INSERT INTO dom_conversation_folders(user_id,name) VALUES(${me},${name})
      ON CONFLICT(user_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id,name`;
    res.status(201).json({folder});
  }));
  app.patch(path,requireAuth,withConversation(async (req,res,me,id,kind) => {
    const {folder_id,hidden} = req.body || {};
    if (hidden !== undefined && typeof hidden !== 'boolean') return res.status(400).json({error:'Invalid visibility'});
    let folder = null;
    if (folder_id != null) {
      if (!/^[1-9]\d{0,17}$/.test(String(folder_id))) return res.status(400).json({error:'Invalid folder'});
      const [owned] = await sql`SELECT id FROM dom_conversation_folders WHERE user_id=${me} AND id=${folder_id}`;
      if (!owned) return res.status(404).json({error:'Folder not found'});
      folder = owned.id;
    }
    await sql`INSERT INTO dom_conversation_settings(user_id,kind,conversation_id,folder_id,hidden)
      VALUES(${me},${kind},${id},${folder},${hidden ?? false})
      ON CONFLICT(user_id,kind,conversation_id) DO UPDATE SET
      folder_id=CASE WHEN ${folder_id !== undefined} THEN EXCLUDED.folder_id ELSE dom_conversation_settings.folder_id END,
      hidden=CASE WHEN ${hidden !== undefined} THEN EXCLUDED.hidden ELSE dom_conversation_settings.hidden END`;
    res.json({ok:true});
  }));

  const messagePath = path + '/messages/:messageId';
  const change = deleted => withConversation(async (req,res,me,id,kind) => {
    const message = idOf(req.params.messageId);
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    if (!message || (!deleted && (!body || body.length > 8000))) return res.status(400).json({error:'Invalid message'});
    const [changed] = kind === 'dm'
      ? await sql`UPDATE dm_messages SET body=CASE WHEN ${deleted} THEN body ELSE ${body} END,
          edited_at=now(), deleted_at=CASE WHEN ${deleted} THEN now() ELSE NULL END
          WHERE id=${message} AND thread_id=${id} AND sender_id=${me} AND deleted_at IS NULL RETURNING id`
      : await sql`UPDATE chat_room_messages m SET body=CASE WHEN ${deleted} THEN m.body ELSE ${body} END,
          edited_at=now(), deleted_at=CASE WHEN ${deleted} THEN now() ELSE NULL END
          FROM chat_rooms r JOIN chat_room_members member ON member.room_id=r.id AND member.user_id=${me}
          WHERE r.id=${id} AND m.id=${message} AND m.room_id=r.id AND m.sender_id=${me} AND m.deleted_at IS NULL
          AND (${deleted} OR NOT r.is_live OR member.role='admin' OR length(${body})<=80) RETURNING m.id`;
    if (!changed) return res.status(404).json({error:'Message cannot be changed'});
    res.json({ok:true});
  });
  app.patch(messagePath,requireAuth,change(false));
  app.post(messagePath+'/hide',requireAuth,withConversation(async (req,res,me,id,kind) => {
    const raw = String(req.params.messageId || '');
    const agent = /^agent-[1-9]\d{0,17}$/.test(raw);
    const message = idOf(raw);
    if (!agent && !message) return res.status(400).json({error:'Invalid message'});
    let existing;
    if (agent) {
      [existing] = await sql`SELECT e.id FROM dom_room_agent_events e JOIN chat_rooms r ON r.id=e.room_id
        WHERE e.id=${raw.slice(6)} AND e.status='completed' AND e.reply IS NOT NULL
          AND ((${kind}='dm' AND r.dm_thread_id=${id}) OR (${kind}='group' AND r.id=${id}))`;
    } else {
      [existing] = kind==='dm'
        ? await sql`SELECT id FROM dm_messages WHERE id=${message} AND thread_id=${id} AND deleted_at IS NULL`
        : await sql`SELECT id FROM chat_room_messages WHERE id=${message} AND room_id=${id} AND deleted_at IS NULL`;
    }
    if (!existing) return res.status(404).json({error:'Message not found'});
    await sql`INSERT INTO dom_hidden_messages(user_id,kind,conversation_id,message_id)
      VALUES(${me},${kind},${id},${agent?raw:String(message)}) ON CONFLICT DO NOTHING`;
    res.json({ok:true});
  }));
  app.delete(messagePath,requireAuth,change(true));
  app.get(messagePath+'/attachment',requireAuth,withConversation(async (req,res,me,id,kind) => {
    const message = idOf(req.params.messageId);
    if (!message) return res.status(400).json({error:'Invalid message'});
    const [row] = kind === 'dm'
      ? await sql`SELECT attachments,attachment_data FROM dm_messages WHERE id=${message} AND thread_id=${id} AND deleted_at IS NULL`
      : await sql`SELECT attachments,attachment_data FROM chat_room_messages WHERE id=${message} AND room_id=${id} AND deleted_at IS NULL`;
    if (!row?.attachment_data || !row.attachments?.[0]?.name) return res.status(404).json({error:'Attachment not found'});
    res.set('Cache-Control','private, no-store').set('X-Content-Type-Options','nosniff');
    res.attachment(row.attachments[0].name).type('application/octet-stream').send(Buffer.from(row.attachment_data,'base64'));
  }));
}

async function hidePersonalMessages(sql,userId,kind,id,messages) {
  const hidden = await sql`SELECT message_id FROM dom_hidden_messages
    WHERE user_id=${userId} AND kind=${kind} AND conversation_id=${id}`;
  const excluded=new Set(hidden.map(row=>row.message_id));
  return messages.filter(message=>!excluded.has(String(message.id)));
}
module.exports = {ensureSchema, install, parseAttachment, hidePersonalMessages};
