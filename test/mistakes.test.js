import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMistakes } from '../src/mistakes.js';
import { createGame, createCorrectionGame, currentQuestion, questionTopic, answer, nextQuestion, retryGame } from '../src/game.js';
import { createHighscores } from '../src/highscores.js';
const countries = JSON.parse(await readFile(new URL('../assets/data/countries.json', import.meta.url)));
const codes = new Set(countries.map(c => c.code));
const country = countries[0];
const wrong = countries[1].code;
function storage(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (key, next) => { value = next; } };
}
function respond(store, correct, topic = 'quiz', practice = false) {
  const game = createGame([country], 1, Math.random, practice);
  game.mode = topic;
  answer(game, correct ? country.code : wrong, codes);
  return { game, progress: store.recordAnswer(game) };
}

test('answers persist immediately, topics stay separate, progress resets and clears only once', () => {
  const db = storage();
  let store = createMistakes(countries, () => db);
  const { game } = respond(store, false);
  assert.equal(game.finished, false);
  assert.equal(store.recordAnswer(game), null);
  respond(store, false, 'capitals');
  store = createMistakes(countries, () => db);
  assert.equal(store.count, 2);
  assert.deepEqual(respond(store, true).progress, { transition: 'correcting', streak: 1, cleared: false });
  respond(store, false);
  assert.equal(store.entries.find(e => e.topic === 'quiz').streak, 0);
  respond(store, true, 'quiz', true);
  store = createMistakes(countries, () => db);
  const last = respond(store, true, 'quiz', true);
  assert.equal(last.progress.transition, 'scheduled');
  assert.equal(last.progress.cleared, true);
  assert.equal(store.reviewCount, 1);
  assert.equal(store.recordAnswer(last.game), null);
  assert.equal(store.count, 1);
  assert.equal(store.entries.find(e => e.status === 'correction').topic, 'capitals');
  assert.equal(respond(store, true).progress, null);
  respond(store, false);
  assert.equal(store.count, 2);
});

test('malformed and obsolete saved entries are ignored', () => {
  for (const raw of ['{', 'null', JSON.stringify({ version: 2, entries: [] })]) {
    assert.equal(createMistakes(countries, () => storage(raw)).count, 0);
  }
  const entries = [null, { topic: 'quiz', code: 'xx', streak: 0 },
    { topic: 'learn', code: country.code, streak: 0 }, { topic: 'quiz', code: country.code, streak: 2 },
    { topic: 'capitals', code: country.code, streak: 1 }];
  const store = createMistakes(countries, () => storage(JSON.stringify({ version: 1, entries })));
  assert.deepEqual(store.entries, [{ ...entries.at(-1), status: 'correction' }]);
});

test('storage failures retain usable session progress', () => {
  const unreadable = createMistakes(countries, () => ({ getItem: () => { throw Error('blocked'); } }));
  assert.equal(unreadable.persistent, false);
  for (const provider of [() => { throw Error('blocked'); },
    () => ({ getItem: () => null, setItem: () => { throw Error('quota'); } }),
    () => ({ getItem: () => { throw Error('blocked'); } })]) {
    const store = createMistakes(countries, provider);
    respond(store, false);
    assert.equal(store.persistent, false);
    assert.equal(store.count, 1);
    respond(store, true); respond(store, true);
    assert.equal(store.count, 0);
  }
});

test('selection caps at ten and prioritizes zero streak before randomized one streak', () => {
  const entries = countries.slice(0, 14).map((c, i) => ({ topic: 'quiz', code: c.code, streak: i < 3 ? 0 : 1 }));
  const store = createMistakes(countries, () => storage(JSON.stringify({ version: 1, entries })));
  const selected = store.selectQuestions(() => 0.25);
  assert.equal(selected.length, 10);
  assert.ok(selected.slice(0, 3).every(e => e.streak === 0));
  assert.equal(new Set(selected.map(e => e.code)).size, 10);
  selected[0].streak = 9;
  assert.ok(store.entries.every(e => e.streak < 2));
});

test('mixed rounds allow both topics for one country, retain answer topics and exclude records', () => {
  const store = createMistakes(countries, () => storage());
  respond(store, false); respond(store, false, 'capitals');
  const game = createCorrectionGame(countries, store.selectQuestions());
  assert.equal(game.practice, true);
  assert.equal(game.questions.length, 2);
  assert.equal(new Set(game.questions.map(q => q.code)).size, 1);
  const topics = new Set();
  for (let i = 0; i < 2; i++) {
    topics.add(questionTopic(game));
    assert.equal(store.recordAnswer(game), null);
    assert.equal(answer(game, 'xx', codes), false);
    assert.equal(answer(game, currentQuestion(game).code, codes), true);
    assert.equal(answer(game, wrong, codes), false);
    assert.equal(game.answers[i].topic, questionTopic(game));
    assert.equal(store.recordAnswer(game).streak, 1);
    nextQuestion(game);
  }
  assert.equal(topics.size, 2);
  assert.equal(store.count, 2);
  assert.equal(retryGame(game), null);
  assert.equal(createHighscores(countries, () => storage()).recordCompletedRound(game), null);
  const restarted = createCorrectionGame(countries, store.selectQuestions());
  answer(restarted, currentQuestion(restarted).code, codes);
  assert.equal(store.recordAnswer(restarted).cleared, true);
  const fresh = createCorrectionGame(countries, store.selectQuestions());
  assert.equal(fresh.questions.length, 1);
  answer(fresh, currentQuestion(fresh).code, codes);
  store.recordAnswer(fresh);
  assert.equal(store.count, 0);
});

test('correction construction rejects empty, duplicate, oversized and invalid references', () => {
  const ref = { topic: 'quiz', code: country.code };
  for (const refs of [[], [ref, ref], [{ ...ref, topic: 'learn' }], [{ ...ref, code: 'xx' }],
    countries.slice(0, 11).map(c => ({ ...ref, code: c.code }))]) {
    assert.throws(() => createCorrectionGame(countries, refs), RangeError);
  }
});

test('flag mistakes persist separately and mixed correction rounds clear all three topics', () => {
  const db = storage();
  let store = createMistakes(countries, () => db);
  for (const topic of ['quiz', 'capitals', 'flags']) respond(store, false, topic);
  store = createMistakes(countries, () => db);
  assert.equal(store.count, 3);
  respond(store, true, 'flags');
  respond(store, false, 'flags');
  assert.equal(store.entries.find(e => e.topic === 'flags').streak, 0);
  for (let round = 0; round < 2; round++) {
    const game = createCorrectionGame(countries, store.selectQuestions());
    assert.deepEqual(new Set(game.questions.map(q => q.topic)), new Set(['quiz', 'capitals', 'flags']));
    while (!game.finished) {
      answer(game, country.code, codes);
      assert.equal(store.recordAnswer(game).cleared, round === 1);
      nextQuestion(game);
    }
    store = createMistakes(countries, () => db);
    assert.equal(store.count, round === 0 ? 3 : 0);
  }
});

const DAY = 86400000;
function scheduled(stage, dueAt, code = country.code, topic = 'quiz') {
  return { topic, code, status: 'review', stage, dueAt };
}
function seeded(entries) { return storage(JSON.stringify({ version: 2, entries })); }

test('seven spaced reviews graduate after 115 days, with no early advancement and later re-entry', () => {
  let now = Date.UTC(2026, 0, 1);
  const start = now, db = storage();
  let store = createMistakes(countries, () => db, [], [], () => now);
  assert.equal(respond(store, true).progress, null, 'correct first encounters do not enter review');
  respond(store, false); respond(store, true);
  assert.equal(respond(store, true).progress.transition, 'scheduled');
  assert.equal(store.count, 0);
  assert.equal(store.reviewCount, 1);
  for (const [stage, days] of [1, 3, 7, 14, 30, 30, 30].entries()) {
    const dueAt = now + days * DAY;
    assert.deepEqual(store.entries, [scheduled(stage, dueAt)]);
    assert.equal(store.nextDueAt, dueAt);
    now = dueAt - 1;
    assert.equal(store.dueCount, 0);
    assert.deepEqual(store.selectQuestions(), []);
    assert.equal(respond(store, true).progress, null);
    store = createMistakes(countries, () => db, [], [], () => now);
    assert.equal(store.nextDueAt, dueAt, 'reload preserves schedule');
    now = dueAt;
    assert.equal(store.dueCount, 1);
    assert.equal(store.selectQuestions().length, 1);
    const { game, progress } = respond(store, true);
    assert.equal(progress.transition, stage === 6 ? 'graduated' : 'reviewed');
    assert.equal(store.recordAnswer(game), null);
    assert.equal(store.reviewCount, stage === 6 ? 0 : 1);
  }
  assert.equal(now - start, 115 * DAY);
  assert.equal(store.nextDueAt, null);
  assert.deepEqual(store.entries, []);
  assert.deepEqual(JSON.parse(db.getItem()).entries, []);
  assert.equal(respond(store, true).progress, null);
  assert.equal(respond(store, false).progress.transition, 'added');
  assert.deepEqual(store.entries, [{ topic: 'quiz', code: country.code, status: 'correction', streak: 0 }]);
});

test('early and due wrong answers reset every review stage; late success schedules from answer time', () => {
  const now = Date.UTC(2026, 0, 1);
  for (let stage = 0; stage < 7; stage++) {
    for (const dueAt of [now - DAY, now, now + DAY]) {
      const store = createMistakes(countries, () => seeded([scheduled(stage, dueAt)]), [], [], () => now);
      assert.equal(respond(store, false).progress.transition, 'reopened');
      assert.equal(store.reviewCount, 0);
      assert.equal(store.count, 1);
      respond(store, true); respond(store, true);
      assert.deepEqual(store.entries, [scheduled(0, now + DAY)]);
    }
  }
  const store = createMistakes(countries, () => seeded([scheduled(1, now - 10 * DAY)]), [], [], () => now);
  respond(store, true);
  assert.deepEqual(store.entries, [scheduled(2, now + 7 * DAY)]);
});

test('practice prioritizes corrections, overdue dates, caps at ten, and returns copies', () => {
  const now = Date.UTC(2026, 0, 1);
  const entries = [
    { topic: 'quiz', code: countries[0].code, status: 'correction', streak: 1 },
    { topic: 'quiz', code: countries[1].code, status: 'correction', streak: 0 },
    ...countries.slice(2, 14).map((c, i) => scheduled(0, now - i * DAY, c.code)),
    scheduled(0, now + 1, countries[14].code),
  ];
  const store = createMistakes(countries, () => seeded(entries), [], [], () => now);
  assert.equal(store.count, 2);
  assert.equal(store.dueCount, 12);
  assert.equal(store.reviewCount, 13);
  const selected = store.selectQuestions(() => .5);
  assert.equal(selected.length, 10);
  assert.deepEqual(selected.slice(0, 2).map(e => e.streak), [0, 1]);
  assert.deepEqual(selected.slice(2).map(e => e.dueAt), entries.slice(2, 14).map(e => e.dueAt).sort((a, b) => a - b).slice(0, 8));
  assert.equal(new Set(selected.map(e => `${e.topic}:${e.code}`)).size, 10);
  selected[0].streak = 99;
  store.entries[0].streak = 99;
  assert.ok(store.entries.every(e => e.streak !== 99));
  const game = createCorrectionGame(countries, selected.slice(2));
  assert.equal(game.questions.length, 8);
  assert.equal(game.practice, true);
  const late = createMistakes(countries, () => seeded([scheduled(0, now + 1)]), [], [], () => now + 1);
  assert.equal(late.dueCount, 1);
});

test('migration saves v2 immediately and failed migration writes retain session state', () => {
  const old = { version: 1, entries: [{ topic: 'flags', code: country.code, streak: 1 }] };
  const db = storage(JSON.stringify(old));
  const migrated = createMistakes(countries, () => db);
  assert.equal(JSON.parse(db.getItem()).version, 2);
  assert.deepEqual(migrated.entries, [{ ...old.entries[0], status: 'correction' }]);
  const failed = createMistakes(countries, () => ({ getItem: () => JSON.stringify(old), setItem: () => { throw Error('quota'); } }));
  assert.equal(failed.persistent, false);
  assert.equal(failed.count, 1);
  assert.equal(respond(failed, true, 'flags').progress.transition, 'scheduled');
  assert.equal(failed.reviewCount, 1);
});

test('invalid v2 schedules are ignored and valid records are normalized', () => {
  const good = scheduled(0, 1000);
  const invalid = [null, { ...good, topic: 'learn' }, { ...good, code: 'unknown' },
    { ...good, status: 'other' }, ...[-1, 7, .5, '1'].map(stage => ({ ...good, stage })),
    ...[-1, 1.5, '100', null, 8640000000000001].map(dueAt => ({ ...good, dueAt })),
    { topic: 'quiz', code: country.code, status: 'correction', streak: 2 }];
  const store = createMistakes(countries, () => seeded([...invalid, { ...good, extra: true }]));
  assert.deepEqual(store.entries, [good]);
});

test('normal mixed answers and round retries update schedules without recording twice', () => {
  const db = storage(), now = Date.UTC(2026, 0, 1);
  const store = createMistakes(countries, () => db, [], [], () => now);
  const normal = createGame([{ ...country, topic: 'flags' }], 1, Math.random, false, 'mixed');
  answer(normal, wrong, codes);
  store.recordAnswer(normal);
  nextQuestion(normal);
  const retry = retryGame(normal);
  answer(retry, country.code, codes);
  assert.equal(store.recordAnswer(retry).transition, 'correcting');
  assert.equal(store.recordAnswer(retry), null);
  respond(store, true, 'flags');
  assert.deepEqual(store.entries, [scheduled(0, now + DAY, country.code, 'flags')]);
});

test('all six topics can complete due reviews without sharing their schedules', async () => {
  const { answerPopulation, roundedPopulation } = await import('../src/game.js');
  const rivers = JSON.parse(await readFile(new URL('../assets/data/rivers.json', import.meta.url)));
  const mountains = JSON.parse(await readFile(new URL('../assets/data/mountains.json', import.meta.url)));
  const now = Date.UTC(2026, 0, 1);
  const entries = ['quiz', 'capitals', 'flags', 'population'].map(topic => scheduled(6, now, country.code, topic));
  entries.push(scheduled(6, now, rivers[0].code, 'river'), scheduled(6, now, mountains[0].code, 'mountain'));
  const db = seeded(entries);
  const store = createMistakes(countries, () => db, rivers, mountains, () => now);
  const game = createCorrectionGame(countries, store.selectQuestions(), Math.random, rivers, mountains);
  const validCodes = new Set([...countries, ...rivers, ...mountains].map(e => e.code));
  for (let i = 0; i < 6; i++) {
    const target = currentQuestion(game);
    if (questionTopic(game) === 'population') answerPopulation(game, roundedPopulation(target.population));
    else answer(game, target.code, validCodes);
    assert.equal(store.recordAnswer(game).transition, 'graduated');
    assert.equal(store.reviewCount, 5 - i);
    nextQuestion(game);
  }
  assert.deepEqual(store.entries, []);
  assert.equal(createHighscores(countries, () => storage(), rivers, mountains).recordCompletedRound(game), null);
  assert.deepEqual(JSON.parse(db.getItem()).entries, []);
});
