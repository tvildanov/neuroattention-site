'use strict';

function reason(error) {
  const msg = String(error?.message || error || '');
  const status = Number(error?.status || error?.statusCode);
  if (/context.length|context.window|maximum.context|context_length_exceeded/i.test(msg)) return 'context_limit';
  if (/insufficient_quota|credit balance|weekly.usage.limit|billing.error|payment required/i.test(msg) || status === 402) return 'quota';
  if (status === 429 || /rate.limit|too many requests|\b429\b/i.test(msg)) return 'rate_limit';
  if (status === 401 || status === 403 || /unauthorized|forbidden/i.test(msg)) return 'upstream_access';
  if (status === 502 || status === 503 || /service unavailable|\b50[23]\b/i.test(msg)) return 'upstream';
  if (/abort|timed?\s*out|timeout/i.test(msg)) return 'timeout';
  if (/fetch failed|network|ECONNRESET/i.test(msg)) return 'network';
  return 'unknown';
}

function describe(message, handoff, delivered, now = Date.now()) {
  const meta = message.meta || {};
  const created = message.created_at;
  const base = { message_id: message.id, correlation_id: meta.correlation_id || null,
    last_confirmed_at: meta.delivery_updated_at || created, retryable: false };
  if (delivered) {
    return { ...base, stage: 'display', status: 'delivered',
      last_confirmed_at: delivered.created_at || base.last_confirmed_at };
  }
  if (!handoff) {
    const awaiting = !!message.seed_id || meta.planted === true;
    const old = now - Date.parse(created) >= 120000;
    return { ...base, stage: awaiting ? 'handoff' : 'send',
      status: awaiting && !old ? 'awaiting_external_reply' : (meta.delivery_error || old) ? 'expired_or_unconfirmed' : 'received',
      reason_code: meta.delivery_error || (old ? 'unknown' : null) };
  }
  const result = handoff.result || {};
  if (handoff.status === 'completed') {
    return { ...base, stage: 'sync', status: 'response_ready',
      last_confirmed_at: handoff.completed_at || base.last_confirmed_at };
  }
  if (['failed','cancelled','rejected'].includes(handoff.status)) {
    return { ...base, stage: 'processing', status: 'failed', reason_code: reason(result.last_error),
      last_confirmed_at: handoff.completed_at || base.last_confirmed_at };
  }
  const retryAt = Date.parse(result.not_before);
  if (handoff.status === 'pending' && result.retry && retryAt > now) {
    return { ...base, stage: 'processing', status: 'retryable_error', reason_code: reason(result.last_error),
      retryable: true, retry_after: Math.ceil((retryAt - now) / 1000),
      last_confirmed_at: handoff.payload?.persona_runtime?.last_failed_at || base.last_confirmed_at };
  }
  const accepted = Date.parse(handoff.accepted_at);
  if (['accepted','in_progress'].includes(handoff.status) && Number.isFinite(accepted) && now - accepted < 300000) {
    return { ...base, stage: 'processing', status: 'processing', last_confirmed_at: handoff.accepted_at };
  }
  const started = Date.parse(handoff.created_at || created);
  return { ...base, stage: 'handoff',
    status: now - started < 120000 ? 'queued' : 'awaiting_external_reply',
    last_confirmed_at: handoff.created_at || base.last_confirmed_at };
}

module.exports = { reason, describe };
