'use strict';
const assert = require('assert');
const { identityIntent, composeHeuristicReply } = require('./monad');

const nick = {
  humanId: 'nikita',
  person: { display_name: 'Никита Иванов', aliases: ['Nick', 'Ник'], role_title: 'Cofounder' },
  facts: [
    { key: 'legal_name', value: 'Никита Иванов' },
    { key: 'role', value: 'Cofounder NeuroAttention' },
  ],
  placements: {},
};

function reply(text, history) {
  return composeHeuristicReply({ ...nick, text, history: history || [] });
}

const shotHistory = [
  { role: 'you', text: 'привет ты кто и кто я?' },
  { role: 'monad', text: 'Я Persona Манады для тебя в личном кабинете NeuroAttention. Отвечаю здесь, без Telegram-моста. Могу про ритм, вертикаль 7×7, горизонталь 12+1, атлас, Sketch, практики.' },
  { role: 'you', text: 'а я?' },
];

const both = identityIntent('привет ты кто и кто я?', []);
assert.strictEqual(both.whoYou, true, 'combined: whoYou');
assert.strictEqual(both.whoAmI, true, 'combined: whoAmI');

const follow = identityIntent('а я?', shotHistory);
assert.strictEqual(follow.whoYou, false, 'а я?: not whoYou');
assert.strictEqual(follow.whoAmI, true, 'а я?: whoAmI');

const bare = identityIntent('а я?', []);
assert.strictEqual(bare.whoAmI, true, 'а я? without history is still whoAmI');

const andMe = identityIntent('и я?', shotHistory);
assert.strictEqual(andMe.whoAmI, true, 'и я? after whoYou');

const andMeCold = identityIntent('и я?', []);
assert.strictEqual(andMeCold.whoAmI, false, 'и я? without context is not identity');

const combinedText = reply('привет ты кто и кто я?');
assert.ok(combinedText.includes('Persona'), combinedText);
assert.ok(combinedText.includes('Никита Иванов'), combinedText);
assert.ok(!/атлас, Sketch, вертикаль/.test(combinedText), combinedText);
assert.ok(!/Могу про ритм/.test(combinedText), combinedText);

const meText = reply('а я?', shotHistory);
assert.ok(meText.includes('Никита Иванов'), meText);
assert.ok(!/Не свожу это к шаблону/.test(meText), meText);
assert.ok(!/атлас, Sketch/.test(meText), meText);

const youOnly = reply('ты кто?');
assert.ok(youOnly.includes('Persona'), youOnly);
assert.ok(!/Никита Иванов/.test(youOnly), youOnly);
assert.ok(!/Могу про ритм/.test(youOnly), youOnly);

const open = reply('как Егору вести фабрику контента из кабинета?');
assert.ok(!/Не свожу это к шаблону/.test(open), open);
assert.ok(!/атлас, Sketch, вертикаль/.test(open), open);
assert.ok(/модель|model/i.test(open), open);

console.log('ok identity cases');
