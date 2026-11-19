import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMixedGame, createGame, eligibleCountries, currentQuestion, questionTopic, answer, answerPopulation, roundedPopulation, nextQuestion, retryGame, score } from '../src/game.js';
import { createMistakes } from '../src/mistakes.js';
import { createHighscores } from '../src/highscores.js';
const countries = JSON.parse(await readFile(new URL('../assets/data/countries.json', import.meta.url)));
const rivers = JSON.parse(await readFile(new URL('../assets/data/rivers.json', import.meta.url)));
const codes = new Set([...countries, ...rivers].map(q => q.code));
const topics = ['quiz', 'capitals', 'flags', 'population', 'river'];
function respond(game, correct = true) {
  const q = currentQuestion(game);
  if (questionTopic(game) === 'population') return answerPopulation(game, correct ? roundedPopulation(q.population) : q.populationOptions.find(n => n !== roundedPopulation(q.population)));
  return answer(game, correct ? q.code : (q.topic === 'river' ? rivers : countries).find(c => c.code !== q.code).code, codes);
}
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('balanced mixed rounds use unique targets and preserve source data', () => {
  const before = JSON.stringify([countries, rivers]);
  for (const count of [5, 10, 15, 20, 7]) {
    const game = createMixedGame(countries, rivers, count, () => 0.4);
    const totals = topics.map(topic => game.questions.filter(q => q.topic === topic).length);
    assert.equal(game.questions.length, count);
    assert.equal(new Set(game.questions.map(q => q.code)).size, count);
    assert.ok(Math.max(...totals) - Math.min(...totals) <= 1);
    for (const q of game.questions.filter(q => q.topic === 'population')) assert.ok(q.populationOptions.includes(roundedPopulation(q.population)));
  }
  const remainderTopics = new Set([0, 0.3, 0.7, 0.99].map(n => {
    const game = createMixedGame(countries, rivers, 6, () => n);
    return topics.find(topic => game.questions.filter(q => q.topic === topic).length === 2);
  }));
  assert.ok(remainderTopics.size > 1);
  assert.equal(JSON.stringify([countries, rivers]), before);
  for (const count of [0, -1, 1.5, countries.length + rivers.length + 1]) assert.throws(() => createMixedGame(countries, rivers, count), RangeError);
  assert.throws(() => createMixedGame([countries[0], countries[0]], [], 1), /Doppelte/);
});

test('regions, all targets, and scarce topic pools redistribute safely', () => {
  for (const region of ['Welt', 'Afrika', 'Asien', 'Europa', 'Nordamerika', 'Südamerika', 'Ozeanien']) {
    const cp = eligibleCountries(countries, region), rp = eligibleCountries(rivers, region);
    const all = createMixedGame(cp, rp, cp.length + rp.length);
    assert.deepEqual(new Set(all.questions.map(q => q.code)), new Set([...cp, ...rp].map(q => q.code)));
    assert.ok(all.questions.every(q => region === 'Welt' || q.continent === region));
    const countryTotals = topics.slice(0, 4).map(topic => all.questions.filter(q => q.topic === topic).length);
    assert.ok(Math.max(...countryTotals) - Math.min(...countryTotals) <= 1);
  }
  const oceania = createMixedGame(eligibleCountries(countries, 'Ozeanien'), eligibleCountries(rivers, 'Ozeanien'), eligibleCountries(countries, 'Ozeanien').length + 4);
  assert.equal(oceania.questions.filter(q => q.topic === 'river').length, 4);
  const scarce = createMixedGame(countries, rivers.slice(0, 1), 20);
  assert.equal(scarce.questions.filter(q => q.topic === 'river').length, 1);
  const totals = topics.slice(0, 4).map(topic => scarce.questions.filter(q => q.topic === topic).length);
  assert.ok(Math.max(...totals) - Math.min(...totals) <= 1);
  for (const [cp, rp] of [[countries.slice(0, 2), rivers.slice(0, 8)], [countries.slice(0, 8), []], [[], rivers.slice(0, 8)]]) {
    const game = createMixedGame(cp, rp, cp.length + rp.length);
    assert.equal(game.questions.length, cp.length + rp.length);
  }
});

test('mixed answers keep topics, reject wrong inputs, persist mistakes, and retry remaining errors', () => {
  const db = storage();
  const store = createMistakes(countries, () => db, rivers);
  const game = createMixedGame(countries, rivers, 5);
  const pairs = game.questions.map(q => `${q.topic}:${q.code}`).sort();
  while (!game.finished) {
    const q = currentQuestion(game);
    assert.equal(nextQuestion(game), false);
    if (q.topic === 'population') assert.equal(answer(game, q.code, codes), false);
    else {
      assert.equal(answerPopulation(game, 1), false);
      assert.equal(answer(game, q.topic === 'river' ? countries[0].code : rivers[0].code, codes), false);
    }
    assert.equal(respond(game, false), true);
    assert.equal(respond(game), false);
    assert.equal(game.answers.at(-1).topic, q.topic);
    store.recordAnswer(game);
    nextQuestion(game);
  }
  assert.equal(score(game), 0);
  assert.equal(createMistakes(countries, () => db, rivers).count, 5);
  const retry = retryGame(game);
  assert.equal(retry.practice, true);
  assert.deepEqual(retry.questions.map(q => `${q.topic}:${q.code}`).sort(), pairs);
  const restarted = createGame(retry.questions, retry.questions.length, Math.random, true, 'mixed');
  assert.deepEqual(restarted.questions.map(q => `${q.topic}:${q.code}`).sort(), pairs);
  while (!retry.finished) {
    respond(retry, true); store.recordAnswer(retry); nextQuestion(retry);
  }
  assert.equal(retryGame(retry), null);
  while (!restarted.finished) {
    respond(restarted, true); store.recordAnswer(restarted); nextQuestion(restarted);
  }
  assert.equal(store.count, 0);
});

test('mixed records use combined region counts, persist, reset, and exclude practice', () => {
  const db = storage();
  const records = createHighscores(countries, () => db, rivers);
  const cp = eligibleCountries(countries, 'Ozeanien'), rp = eligibleCountries(rivers, 'Ozeanien');
  const game = createMixedGame(cp, rp, cp.length + rp.length);
  game.region = 'Ozeanien';
  assert.equal(records.recordCompletedRound(game), null);
  while (!game.finished) { respond(game); nextQuestion(game); }
  assert.equal(records.recordCompletedRound(game).best, game.questions.length);
  assert.equal(createHighscores(countries, () => db, rivers).getBest('mixed', 'Ozeanien', game.questions.length), game.questions.length);
  assert.equal(records.recordCompletedRound({ ...game, practice: true }), null);
  assert.equal(records.resetRecord('mixed', 'Ozeanien', game.questions.length), true);
  assert.equal(records.getBest('mixed', 'Ozeanien', game.questions.length), null);
});

test('successive mixed retries keep only remaining target-topic pairs', () => {
  const game = createMixedGame(countries, rivers, 5);
  while (!game.finished) { respond(game, false); nextQuestion(game); }
  const retry = retryGame(game);
  const missed = retry.questions[0];
  while (!retry.finished) {
    respond(retry, retry.index !== 0);
    nextQuestion(retry);
  }
  const remaining = retryGame(retry);
  assert.equal(remaining.practice, true);
  assert.deepEqual(remaining.questions.map(q => [q.code, q.topic]), [[missed.code, missed.topic]]);
  respond(remaining); nextQuestion(remaining);
  assert.equal(retryGame(remaining), null);
});
