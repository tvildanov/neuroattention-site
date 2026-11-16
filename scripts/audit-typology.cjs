// Read-only audit of the current implementation; does not contact or mutate the API.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'test.html'), 'utf8');
const start = html.indexOf('  function scoreAnswer(');
const end = html.indexOf('  function finishTest()', start);
assert(start > 0 && end > start, 'Scoring functions must be reviewed if moved');
const context = vm.createContext({});
vm.runInContext(html.slice(start, end), context);
const config = JSON.parse(fs.readFileSync(path.join(root, 'data/profile-stats.json')));
const keys = config.stat_meta.layers.flatMap(layer => layer.stats.map(stat => stat.key));
assert.equal(keys.length, 13);
const answer = letter => Object.fromEntries(Array.from({length:10}, (_, i) => ['Q' + (i+1), letter]));
const cases = [
  ['all A', answer('A'), 'STABLE_EXPLORER'],
  ['all B', answer('B'), 'HIGH_LOAD_ADAPTER'],
  ['all C', answer('C'), 'NERVOUS_SYSTEM_SENSITIVE'],
  ['B, Q2/Q4 D', {...answer('B'), Q2:'D', Q4:'D'}, 'DISTRACTED_EXPLORER'],
  ['A, Q2/Q4 D: total rule wins', {...answer('A'), Q2:'D', Q4:'D'}, 'STABLE_EXPLORER'],
  ['A, Q9 D', {...answer('A'), Q9:'D'}, 'FUTURE_SPECIALIST']
];
for (const [label, answers, expected] of cases) {
  const result = context.computeProfile(answers);
  assert.equal(result.profile, expected);
  assert.deepEqual(Object.keys(config.profiles[result.profile].stats).sort(), [...keys].sort());
  console.log(JSON.stringify({label, ...result, configuredStats:config.profiles[result.profile].stats}));
}
const first = context.computeProfile(answer('A'));
const second = context.computeProfile({...answer('A'), Q1:'B'});
assert.equal(first.profile, second.profile);
assert.notEqual(first.scores.state, second.scores.state);
const embedded = JSON.parse(fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/<script type="application\/json" id="xr2-data">([\s\S]*?)<\/script>/)[1]);
assert.deepEqual(embedded.profiles, config);
console.log('Confirmed: different answers share a template; homepage embedded config equals data/profile-stats.json.');
