'use strict';
// Manual operator check. Prints status only; never keys, inboxes or architecture contents.
const assert = require('node:assert/strict');
const monad = require('../services/monad');

function checkRouting() {
  for (const human of ['nikita', 'egor', 'nastya']) {
    assert.equal(monad.resolveHumanId({ monad_human_id: human }), human);
    assert.equal(monad.siteHandoffAgent(human), 'persona_' + human);
    assert.deepEqual(monad.resolveLkReplyAgents(human), ['persona_' + human]);
    const email = Object.keys(monad.EMAIL_HUMAN_MAP).find(key => monad.EMAIL_HUMAN_MAP[key] === human);
    assert.ok(email);
    assert.equal(monad.resolveHumanId({ email }), human);
  }
  assert.equal(monad.resolveHumanId({ email: 'unmapped@example.invalid' }), null);
  assert.equal(monad.resolveHumanId(null), null);
  console.log('MONAD_BRIDGE_ROUTING_CHECK ' + JSON.stringify({ ok: true, personas: 3, unknownIdentityDenied: true }));
}

async function main() {
  checkRouting();
  if (process.argv.includes('--offline')) return;
  const timeout = setTimeout(() => {
    console.error('MONAD_BRIDGE_AUTH_CHECK ' + JSON.stringify({ ok: false, reason: 'timeout' }));
    process.exit(1);
  }, 25000);
  try {
    const result = await monad.mcpCall('get_architecture', {});
    assert.ok(result && typeof result === 'object', 'Architecture result required');
    console.log('MONAD_BRIDGE_AUTH_CHECK ' + JSON.stringify({ ok: true, authenticated: true, tool: 'get_architecture' }));
  } finally {
    clearTimeout(timeout);
  }
}

main().catch(() => {
  // Upstream errors can include private contents; deliberately omit their messages.
  console.error('MONAD_BRIDGE_AUTH_CHECK ' + JSON.stringify({ ok: false, reason: 'check_failed' }));
  process.exitCode = 1;
});
