#!/usr/bin/env node
/**
 * Unified events model — Phase 1 backfill / inspection tool
 * ==========================================================
 * Converts `neuro_resource_diary` rows into extended `journey_events` rows
 * (migration 062 columns) so the Path/Calendar/NeuroMap all read ONE table.
 *
 * ⚠️  DO NOT `--apply` ON PRODUCTION UNTIL BOTH ARE TRUE:
 *   1. Migration 062 has been run (POST /api/run-migrations).
 *   2. The unified READ path is deployed AND `EVENTS_UNIFIED=true`.
 *
 * WHY THE ORDERING MATTERS (the double-render trap):
 *   `GET /api/users/me/evolution` (server.js ~L8319) ALREADY reads
 *   neuro_resource_diary as a legacy fallback source. If we backfill diary rows
 *   into journey_events while that fallback is still active (flag OFF), every
 *   diary entry renders TWICE on the Path — we would CREATE ghosts, not remove
 *   them. The fallback read is only dropped when EVENTS_UNIFIED is on. So the
 *   backfill is safe only AFTER the flag flips.
 *
 * SAFETY:
 *   • Dry-run by default. Mutates only with BOTH `--apply` and `--i-understand`.
 *   • Idempotent: skips diary rows already backfilled (dedup by
 *     payload->>'diary_id').
 *   • NEVER deletes neuro_resource_diary (kept read-only as legacy per brief).
 *   • Sensation-mirror rows (text ~ /^\s*sensation\s*:/i) are NOT backfilled as
 *     diary events — they mirror the cyan sensation nm_node already on the map
 *     (see CLAUDE.md "Path duplicates" grand-bug + migration 042). They are
 *     reported separately so a human can decide.
 *
 * USAGE (run on Railway where DATABASE_URL is set):
 *   railway run node scripts/unified-events-backfill.mjs                # dry run, all users? no — needs --user
 *   railway run node scripts/unified-events-backfill.mjs --user <uuid>  # inspect one user
 *   railway run node scripts/unified-events-backfill.mjs --user <uuid> --apply --i-understand
 */
import { neon } from '@neondatabase/serverless';

const DB = process.env.DATABASE_URL;
if (!DB) { console.error('DATABASE_URL not set — run via `railway run`.'); process.exit(1); }
const sql = neon(DB);

const args = process.argv.slice(2);
const getArg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const USER = getArg('--user');
const APPLY = args.includes('--apply') && args.includes('--i-understand');
// Nick's user (from the brief) — default target for a quick sanity inspection.
const NICK = '24ed935e-de34-49a6-8527-b9defb4c3464';
const target = USER || NICK;

const isSensationMirror = (t) => /^\s*sensation\s*:/i.test(t || '');

async function main() {
  console.log(`\n=== Unified events backfill — target user ${target} ===`);
  console.log(APPLY ? '*** APPLY MODE (will write journey_events) ***' : '(dry run — no writes)\n');

  const diary = await sql`
    SELECT id, date_key, text, comment, plus_count, minus_count, created_at
    FROM neuro_resource_diary WHERE user_id = ${target}
    ORDER BY created_at ASC`;
  const existing = await sql`
    SELECT id, payload->>'diary_id' AS diary_id, title, occurred_at
    FROM journey_events
    WHERE user_id = ${target} AND source = 'calendar' AND kind = 'diary'`;
  const doneSet = new Set(existing.map(e => e.diary_id).filter(Boolean));

  const toBackfill = [], mirrors = [], alreadyDone = [];
  for (const r of diary) {
    if (isSensationMirror(r.text)) { mirrors.push(r); continue; }
    if (doneSet.has(String(r.id))) { alreadyDone.push(r); continue; }
    toBackfill.push(r);
  }

  console.log(`diary rows: ${diary.length} | to backfill: ${toBackfill.length} | already done: ${alreadyDone.length} | sensation-mirrors (skipped): ${mirrors.length}`);
  console.log('\n-- would backfill --');
  for (const r of toBackfill) console.log(`  ${r.date_key}  "${(r.text || '').slice(0, 48)}"  (+${r.plus_count}/-${r.minus_count})`);
  if (mirrors.length) {
    console.log('\n-- sensation-mirror rows (NOT backfilled — review manually) --');
    for (const r of mirrors) console.log(`  ${r.date_key}  "${(r.text || '').slice(0, 48)}"`);
  }

  if (!APPLY) { console.log('\n(dry run complete — pass --apply --i-understand to write, AFTER flag is ON)\n'); return; }

  let wrote = 0;
  for (const r of toBackfill) {
    // occurred_at = noon of the target date so it sorts cleanly on the day.
    const occ = new Date(`${r.date_key}T12:00:00Z`).toISOString();
    const payload = JSON.stringify({ diary_id: String(r.id), title: r.text, source: 'calendar', text: r.text });
    try {
      await sql`
        INSERT INTO journey_events
          (user_id, kind, layer, payload, occurred_at, created_at,
           title, notes, valence_plus, valence_minus, source)
        VALUES
          (${target}, 'diary', 'diary', ${payload}::jsonb, ${occ}, ${r.created_at},
           ${r.text}, ${r.comment || null}, ${r.plus_count || 0}, ${r.minus_count || 0}, 'calendar')`;
      wrote++;
    } catch (e) { console.error(`  FAILED ${r.date_key}: ${e.message}`); }
  }
  console.log(`\napplied: ${wrote} journey_events written. neuro_resource_diary left intact.\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
