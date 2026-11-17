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
  assert.deepEqual(respond(store, true).progress, { streak: 1, cleared: false });
  respond(store, false);
  assert.equal(store.entries.find(e => e.topic === 'quiz').streak, 0);
  respond(store, true, 'quiz', true);
  store = createMistakes(countries, () => db);
  const last = respond(store, true, 'quiz', true);
  assert.deepEqual(last.progress, { streak: 2, cleared: true });
  assert.equal(store.recordAnswer(last.game), null);
  assert.equal(store.count, 1);
  assert.equal(store.entries[0].topic, 'capitals');
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
  assert.deepEqual(store.entries, [entries.at(-1)]);
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
