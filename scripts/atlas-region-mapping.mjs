#!/usr/bin/env node
// Cross-references seed region_ids (from functions/conditions) against the real
// Z-Anatomy mesh inventory, replicating the EXACT tolerant matching that
// Atlas.prototype.focusRegions uses in assets/js/body-atlas.js.
//
// Inputs:  /tmp/seed_ids.json        (from the API pull, step 1)
//          /tmp/mesh_inventory.json  (from atlas-mesh-inventory.mjs, step 2)
// Output:  /tmp/mapping_report.json + console report (✅ matched / ❌ unmatched)
//
// focusRegions matching (body-atlas.js ~L957-976), per mesh `ud` vs a focus set:
//   norm(s)   = s.toLowerCase().replace(/[^a-z0-9]+/g, '')
//   only meshes WITH ud.regionId are considered (L962)
//   bare      = (ud.layer && ud.baseSlug) ? baseSlug.replace(/^layer_/, '') : ud.baseSlug
//   cands     = [regionId, baseSlug, coarseId, bare]; match if norm(cand) in set
//   token fb  = if unmatched & bare: any '_'-split token of bare with raw len>=4
//               whose norm is in set
import { readFileSync, writeFileSync } from 'fs';

const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '');

const seed = JSON.parse(readFileSync('/tmp/seed_ids.json', 'utf8'));
const inv = JSON.parse(readFileSync('/tmp/mesh_inventory.json', 'utf8'));
const seedIds = seed.ids;
// focusRegions only touches meshes that have a regionId
const meshes = inv.meshes.filter((m) => m.regionId);

function matchesSeed(ud, seedNorm) {
  const bare = (ud.layer && ud.baseSlug)
    ? String(ud.baseSlug).replace(new RegExp('^' + ud.layer + '_'), '')
    : ud.baseSlug;
  const cands = [ud.regionId, ud.baseSlug, ud.coarseId, bare];
  for (const c of cands) { if (c && norm(c) === seedNorm) return true; }
  if (bare) {
    const toks = String(bare).split('_');
    for (const t of toks) { if (t.length >= 4 && norm(t) === seedNorm) return true; }
  }
  return false;
}

const report = [];
for (const sid of seedIds) {
  const sn = norm(sid);
  const hits = meshes.filter((m) => matchesSeed(m, sn));
  const examples = [...new Set(hits.map((h) => h.baseSlug || h.slug || h.regionId))].slice(0, 4);
  const layers = [...new Set(hits.map((h) => h.layer))];
  report.push({
    seed_id: sid,
    mentions: seed.counts[sid].total,
    matched: hits.length,
    layers,
    examples,
  });
}

report.sort((a, b) => (a.matched - b.matched) || (b.mentions - a.mentions));
writeFileSync('/tmp/mapping_report.json', JSON.stringify({ totalMeshesWithRegionId: meshes.length, report }, null, 2));

const miss = report.filter((r) => r.matched === 0);
const hit = report.filter((r) => r.matched > 0);

console.log('meshes with regionId considered:', meshes.length);
console.log('');
console.log('❌ UNMATCHED (0 meshes) — need explicit binding: ' + miss.length);
console.log('-'.repeat(60));
for (const r of miss) console.log('  ❌ ' + r.seed_id.padEnd(20) + ' (' + r.mentions + ' mentions)');
console.log('');
console.log('✅ MATCHED: ' + hit.length);
console.log('-'.repeat(60));
for (const r of hit) {
  console.log('  ✅ ' + r.seed_id.padEnd(18) + String(r.matched).padStart(5) + ' meshes  [' + r.layers.join(',') + ']  e.g. ' + r.examples.slice(0, 3).join(', '));
}
