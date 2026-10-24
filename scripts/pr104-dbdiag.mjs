// PR#104 item #1/#2 DB diagnostic. Run via:  railway run node scripts/pr104-dbdiag.mjs
// Inspects the sensation-node coverage gap + area-type overload (body vs life-sphere).
import { neon } from '/Users/tvildanov/Code/neuroattention-site/scripts/node_modules/@neondatabase/serverless/index.mjs';
const sql = neon(process.env.DATABASE_URL);

const P = (...a) => console.log(...a);

// Global picture across all users
const totSens = await sql`SELECT COUNT(*)::int c FROM nm_nodes WHERE type='sensation'`;
const totArea = await sql`SELECT COUNT(*)::int c FROM nm_nodes WHERE type='area'`;
P('nm_nodes total: sensation=%d  area=%d', totSens[0].c, totArea[0].c);

// area nodes split by metadata.source (sensation = body location, else = life sphere)
const areaBySrc = await sql`
  SELECT COALESCE(metadata->>'source','(none)') src, COUNT(*)::int c
  FROM nm_nodes WHERE type='area' GROUP BY 1 ORDER BY 2 DESC`;
P('\narea nodes by metadata.source:');
areaBySrc.forEach(r => P('   %s : %d', r.src, r.c));

// distinct area labels for the non-sensation ones (should be life spheres: семья/работа…)
const sphereLabels = await sql`
  SELECT normalized_label, COUNT(*)::int c FROM nm_nodes
  WHERE type='area' AND COALESCE(metadata->>'source','') <> 'sensation'
  GROUP BY 1 ORDER BY 2 DESC LIMIT 30`;
P('\ntop NON-sensation area labels (candidate life-spheres):');
sphereLabels.forEach(r => P('   %s (%d)', r.normalized_label, r.c));

// body-location area labels (source=sensation)
const bodyLabels = await sql`
  SELECT normalized_label, COUNT(*)::int c FROM nm_nodes
  WHERE type='area' AND metadata->>'source'='sensation'
  GROUP BY 1 ORDER BY 2 DESC LIMIT 30`;
P('\ntop sensation-source area labels (body locations):');
bodyLabels.forEach(r => P('   %s (%d)', r.normalized_label, r.c));

// journey_events sensation coverage vs sensation nodes — per user gap
const evCount = await sql`
  SELECT COUNT(*)::int c FROM journey_events WHERE kind='sensation' AND payload ? 'sensation_labels'`;
P('\njourney_events kind=sensation w/ labels: %d', evCount[0].c);

// users with sensation events but ZERO sensation nodes (the backfill-gap signal)
const gap = await sql`
  SELECT je.user_id, COUNT(DISTINCT je.id)::int events,
         (SELECT COUNT(*)::int FROM nm_nodes n WHERE n.user_id=je.user_id AND n.type='sensation') nodes
  FROM journey_events je
  WHERE je.kind='sensation' AND je.payload ? 'sensation_labels'
  GROUP BY je.user_id
  HAVING (SELECT COUNT(*)::int FROM nm_nodes n WHERE n.user_id=je.user_id AND n.type='sensation') = 0
  LIMIT 20`;
P('\nusers WITH sensation events but ZERO sensation nodes (backfill gap): %d', gap.length);
gap.forEach(r => P('   user=%s events=%d nodes=%d', r.user_id, r.events, r.nodes));

// distinct sensation_labels in events vs nodes for a quick sample user (Tahir if present)
const tahir = await sql`SELECT id, email FROM users WHERE email ILIKE '%tahir%' OR display_name ILIKE '%tahir%' OR display_name ILIKE '%тахир%' LIMIT 5`;
P('\ntahir-ish users:', JSON.stringify(tahir));
for (const u of tahir) {
  const ev = await sql`SELECT COUNT(*)::int c FROM journey_events WHERE user_id=${u.id} AND kind='sensation'`;
  const sn = await sql`SELECT COUNT(*)::int c FROM nm_nodes WHERE user_id=${u.id} AND type='sensation'`;
  const an = await sql`SELECT COUNT(*)::int c FROM nm_nodes WHERE user_id=${u.id} AND type='area'`;
  const oldestNode = await sql`SELECT MIN(last_seen_at) m, MAX(last_seen_at) x FROM nm_nodes WHERE user_id=${u.id} AND type='sensation'`;
  P('   %s: sens_events=%d sens_nodes=%d area_nodes=%d  sensNode span %s..%s',
    u.email, ev[0].c, sn[0].c, an[0].c, oldestNode[0].m, oldestNode[0].x);
}
P('\nDONE');
