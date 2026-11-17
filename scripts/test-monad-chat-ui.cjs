'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../assets/js/monad-lk.js'), 'utf8').replace(/\}\)\(\);\s*$/, 'window.fixture = { STATE, sendMessage, pollReplies, isTechMessage, displayText };})();');
const elements = { 'monad-chat-input': { value: 'fixture question' }, 'monad-chat-send': {}, 'monad-chat-log': {} };
let sends = 0, polls = 0, releaseSend, releasePoll;
const window = {};
const ok = data => ({ ok: true, json: async () => data });
const ctx = { window, document: { readyState: 'loading', addEventListener() {}, getElementById: id => elements[id] || null, querySelectorAll: () => [] }, localStorage: { getItem: () => null }, setInterval: () => 1, clearInterval() {}, console,
  fetch: async (url, opts) => {
    if (url.endsWith('/message')) { sends++; assert.equal(JSON.parse(opts.body).chat_id, 'chat-a'); await new Promise(r => { releaseSend = r; }); return ok({ awaiting_persona: true }); }
    if (url.endsWith('/poll')) { polls++; await new Promise(r => { releasePoll = r; }); return ok({ messages: [{ role: 'monad', text: 'old thread answer' }] }); }
    if (url.endsWith('/chats/chat-a')) return ok({ chat: { id: 'chat-a' }, messages: [{ role: 'you', text: 'fixture question' }] });
    if (url.endsWith('/chats')) return ok({ chats: [{ id: 'chat-a' }] });
    throw Error('unexpected fixture URL');
  }
};
vm.runInNewContext(source, ctx);
const { STATE, sendMessage, pollReplies, isTechMessage, displayText } = window.fixture;
(async () => {
  STATE.activeChatId = 'chat-a'; STATE.chats = [{ id: 'chat-a' }];
  assert.equal(isTechMessage({ role: 'you', text: 'мы ждем ответ? shared_context' }), false);
  assert.equal(displayText({ role: 'you', text: 'shared_context seed=example' }), 'shared_context seed=example');
  const first = sendMessage();
  elements['monad-chat-input'].value = 'fixture question';
  await sendMessage();
  assert.equal(sends, 1, 'Enter while a send is in flight does not create a second message');
  assert.equal(elements['monad-chat-send'].disabled, true);
  releaseSend(); await first;
  assert.equal(STATE.sending, false);
  assert.equal(elements['monad-chat-send'].disabled, false);
  // startFastPoll was called while sending and therefore did not launch a poll.
  const p = pollReplies(); await pollReplies(); assert.equal(polls, 1, 'poll calls cannot overlap');
  STATE.activeChatId = 'chat-b'; STATE.messages = [{ role: 'you', text: 'different thread' }];
  releasePoll(); await p;
  assert.equal(STATE.messages[0].text, 'different thread', 'late response cannot replace the newly selected thread');
  assert.equal(STATE.polling, false);
  console.log('MONAD_CHAT_UI_PASS: send guard, human text, poll guard and thread isolation');
})().catch(e => { console.error(e); process.exitCode = 1; });
