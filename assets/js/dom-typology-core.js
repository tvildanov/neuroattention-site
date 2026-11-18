(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DOMTypology = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function fail(message) { throw new Error(message); }
  function isRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function allItems(config) { return config.items.concat(config.context_items || []); }
  function validateConfig(config) {
    if (!isRecord(config) || typeof config.id !== 'string' || typeof config.version !== 'string') fail('Invalid instrument identity');
    if (!Array.isArray(config.stats) || config.stats.length !== 13 || !Array.isArray(config.items)) fail('Expected 13 stat definitions and an item bank');
    var stats = new Set(config.stats.map(function (s) { return s.id; }));
    if (stats.size !== 13) fail('Duplicate stat ids');
    var ids = new Set();
    allItems(config).forEach(function (item) {
      if (!isRecord(item) || typeof item.id !== 'string' || ids.has(item.id)) fail('Invalid or duplicate item id');
      ids.add(item.id);
      if (!stats.has(item.stat_id) || typeof item.stem !== 'string' || !item.stem.trim()) fail('Invalid item target or prompt');
      if (['single-choice','single-choice-with-not-applicable','select-up-to-two','rank-top-two'].indexOf(item.format) < 0) fail('Unsupported response format');
      if (!Array.isArray(item.options) || item.options.length < 2) fail('Missing answer options');
      var options = item.options.concat(item.not_applicable ? [item.not_applicable] : []);
      if (new Set(options.map(function (o) { return o.id; })).size !== options.length) fail('Duplicate option ids');
      options.forEach(function (option) { if (typeof option.id !== 'string' || typeof option.text !== 'string') fail('Invalid option'); });
    });
    config.stats.forEach(function (stat) {
      var actual = config.items.filter(function (item) { return item.stat_id === stat.id; }).map(function (item) { return item.id; });
      if (!actual.length || !Array.isArray(stat.baseline.item_ids) || JSON.stringify(actual) !== JSON.stringify(stat.baseline.item_ids)) fail('Stat item index mismatch');
    });
    return true;
  }
  function normalizeAnswer(item, answer) {
    if (!isRecord(answer)) fail('Invalid answer');
    if (answer.status === 'skipped') return { status: 'skipped', value: null };
    if (answer.status === 'not_applicable') {
      if (!item.not_applicable) fail('Not-applicable answer is unavailable');
      return { status: 'not_applicable', value: null };
    }
    if (answer.status !== 'answered') fail('Invalid answer status');
    var allowed = new Set(item.options.map(function (option) { return option.id; }));
    if (item.format.indexOf('single-choice') === 0) {
      if (item.not_applicable && answer.value === item.not_applicable.id) return { status: 'not_applicable', value: null };
      if (typeof answer.value !== 'string' || !allowed.has(answer.value)) fail('Unknown option');
      return { status: 'answered', value: answer.value };
    }
    if (!Array.isArray(answer.value) || new Set(answer.value).size !== answer.value.length) fail('Invalid multiple response');
    var min = item.format === 'rank-top-two' ? 2 : 1;
    if (answer.value.length < min || answer.value.length > 2 || answer.value.some(function (id) { return !allowed.has(id); })) fail('Invalid selection size or option');
    return { status: 'answered', value: item.format === 'rank-top-two' ? answer.value.slice() : answer.value.slice().sort() };
  }
  function createSession(config, id, at) {
    validateConfig(config);
    return { schema_version:'0.1', instrument_id:config.id, instrument_version:config.version,
      id:id, created_at:at, updated_at:at, cursor:0, answers:{}, completed_at:null };
  }
  function restoreSession(config, value) {
    validateConfig(config);
    if (!isRecord(value) || value.instrument_id !== config.id || value.instrument_version !== config.version) fail('Session version mismatch');
    if (typeof value.id !== 'string' || !value.id || !isRecord(value.answers)) fail('Invalid session data');
    if (!Number.isInteger(value.cursor) || value.cursor < 0 || value.cursor > allItems(config).length) fail('Invalid cursor');
    if (typeof value.created_at !== 'string' || !Number.isFinite(Date.parse(value.created_at)) ||
        typeof value.updated_at !== 'string' || !Number.isFinite(Date.parse(value.updated_at))) fail('Invalid session timestamp');
    var lookup = new Map(allItems(config).map(function (item) { return [item.id,item]; }));
    var answers = {};
    Object.keys(value.answers).forEach(function (id) {
      if (!lookup.has(id)) fail('Unknown saved item');
      Object.defineProperty(answers,id,{ value:normalizeAnswer(lookup.get(id),value.answers[id]),enumerable:true,writable:true,configurable:true });
    });
    var complete = allItems(config).every(function (item) { return Object.prototype.hasOwnProperty.call(answers,item.id); });
    var done = value.completed_at;
    if (done !== null && (typeof done !== 'string' || !Number.isFinite(Date.parse(done)) || !complete)) fail('Invalid completed session');
    return { schema_version:'0.1',instrument_id:config.id,instrument_version:config.version,id:value.id,
      created_at:value.created_at,updated_at:value.updated_at,cursor:value.cursor,answers:answers,completed_at:done };
  }
  function setAnswer(config, session, id, answer, at) {
    var next = restoreSession(config, session);
    var item = allItems(config).find(function (entry) { return entry.id === id; });
    if (!item) fail('Unknown item');
    Object.defineProperty(next.answers,id,{value:normalizeAnswer(item,answer),enumerable:true,writable:true,configurable:true});
    next.updated_at=at; next.completed_at=null;
    return next;
  }
  function finish(config, session, at) {
    var next=restoreSession(config,session);
    if (!allItems(config).every(function (item) { return Object.prototype.hasOwnProperty.call(next.answers,item.id); })) fail('Session has unanswered items');
    next.completed_at=at; next.updated_at=at; next.cursor=allItems(config).length;
    return next;
  }
  function summarize(config, session) {
    var safe=restoreSession(config,session);
    return {
      instrument_id:config.id,instrument_version:config.version,
      completed:safe.completed_at!==null,profile:null,profile_status:'rules-not-defined',
      wmc:null,xp:null,
      stats:config.stats.map(function (stat) {
        var items=config.items.filter(function (item) { return item.stat_id===stat.id; });
        var counts={ answered:0,skipped:0,not_applicable:0,missing:0 };
        items.forEach(function (item) { var answer=safe.answers[item.id]; counts[answer?answer.status:'missing']++; });
        return { stat_id:stat.id,label:stat.label,item_count:items.length,responses:counts,
          score:null,confidence:null,status:counts.answered?'self-report-collected':'insufficient-data',
          evidence_type:'self_report_and_scenario_intentions',method_version:config.version };
      })
    };
  }
  function exportSession(config, session) {
    return { session:restoreSession(config,session),summary:summarize(config,session),
      interpretation:'Ответы и описательное покрытие; численные оценки способностей и профиль ещё не рассчитаны.' };
  }
  return Object.freeze({ validateConfig:validateConfig,allItems:allItems,normalizeAnswer:normalizeAnswer,
    createSession:createSession,restoreSession:restoreSession,setAnswer:setAnswer,finish:finish,summarize:summarize,exportSession:exportSession });
});
