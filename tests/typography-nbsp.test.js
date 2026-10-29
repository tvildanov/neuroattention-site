'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { glueShort, glueOrphan, MAX_RUN, NBSP } = require('../assets/js/typography.js');

function unbreakableRuns(text) {
  return String(text).split(/[ \n\t\r]+/).filter(Boolean);
}

function longest(text) {
  return unbreakableRuns(text).reduce(function (m, run) {
    return Math.max(m, run.length);
  }, 0);
}

function compose(text) {
  return glueOrphan(glueShort(text));
}

test('MAX_RUN counts the NBSP that glueShort is about to insert', function () {
  assert.equal(MAX_RUN, 12);
  assert.equal(NBSP, '\u00a0');

  const forThe = glueShort('for the human');
  assert.equal(forThe, 'for\u00a0the human');
  assert.notEqual(forThe, 'for\u00a0the\u00a0human');
  assert.ok(longest(forThe) <= MAX_RUN, forThe + ' len ' + longest(forThe));

  const para = glueShort('para la salud');
  assert.equal(para, 'para\u00a0la salud');
  assert.notEqual(para, 'para\u00a0la\u00a0salud');
  assert.ok(longest(para) <= MAX_RUN, para + ' len ' + longest(para));
});

test('replaying glue does not grow a run past 12', function () {
  ['for the human', 'para la salud', 'for human attention', 'para la atención humana'].forEach(function (src) {
    const once = compose(src);
    const twice = compose(once);
    assert.equal(twice, once, src + ' replayed to ' + JSON.stringify(twice));
    unbreakableRuns(twice).forEach(function (run) {
      if (run.includes(NBSP)) {
        assert.ok(run.length <= MAX_RUN, JSON.stringify(run) + ' from ' + src);
      }
    });
    assert.ok(!twice.includes('for\u00a0the\u00a0human'), twice);
    assert.ok(!twice.includes('para\u00a0la\u00a0salud'), twice);
  });
});

test('a short chain that still fits the cap is glued, including its NBSPs', function () {
  const glued = glueShort('in the lab');
  assert.equal(glued, 'in\u00a0the\u00a0lab');
  assert.equal(glued.length, 10);
  assert.equal(glueShort(glued), glued);
});

test('orphan glue refuses a chain the short-word pass already left at the cap', function () {
  const once = glueShort('for the human');
  assert.equal(glueOrphan(once), once);
  const salud = glueShort('para la salud');
  assert.equal(glueOrphan(salud), salud);
});
