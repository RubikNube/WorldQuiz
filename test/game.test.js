import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { eligibleCountries, allowedCounts, createGame, currentQuestion, answer, nextQuestion, score, mistakes, retryGame } from '../src/game.js';

const countries = JSON.parse(await readFile(new URL('../assets/data/countries.json', import.meta.url)));
const valid = new Set(countries.map(c => c.code));

test('continent pools partition all countries and offer valid round sizes', () => {
  const continents = new Set(countries.map(c => c.continent));
  assert.equal(continents.size, 6);
  const pools = [...continents].map(c => eligibleCountries(countries, c));
  assert.equal(pools.reduce((n, p) => n + p.length, 0), 195);
  assert.equal(eligibleCountries(countries).length, 195);
  for (const pool of pools) {
    const counts = allowedCounts(pool.length);
    assert.ok(counts.includes(10));
    assert.ok(counts.includes(pool.length));
    assert.ok(counts.every(n => n > 0 && n <= pool.length));
  }
  assert.deepEqual(allowedCounts(3), [3]);
});

test('round samples unique targets without mutating source data', () => {
  const original = countries.map(c => c.code);
  const game = createGame(countries, 20, () => 0.5);
  assert.equal(game.questions.length, 20);
  assert.equal(new Set(game.questions.map(c => c.code)).size, 20);
  assert.deepEqual(countries.map(c => c.code), original);
  assert.throws(() => createGame(countries, 196), RangeError);
  assert.throws(() => createGame(countries, 0), RangeError);
});

test('only first valid answer counts; final answer requires explicit completion', () => {
  const game = createGame(countries, 2, () => 0.5);
  assert.equal(nextQuestion(game), false);
  assert.equal(answer(game, 'xx', valid), false);
  assert.equal(answer(game, currentQuestion(game).code, valid), true);
  assert.equal(answer(game, 'de', valid), false);
  assert.equal(score(game), 1);
  assert.equal(nextQuestion(game), true);
  const wrong = countries.find(c => c.code !== currentQuestion(game).code).code;
  assert.equal(answer(game, wrong, valid), true);
  assert.equal(game.finished, false);
  assert.equal(game.answers.length, 2);
  assert.equal(nextQuestion(game), true);
  assert.equal(game.finished, true);
  assert.equal(answer(game, 'de', valid), false);
  assert.equal(nextQuestion(game), false);
  assert.equal(score(game), 1);
  assert.equal(mistakes(game).length, 1);
});

test('mistake practice supports one-country rounds and only remaining mistakes', () => {
  const game = createGame(countries, 2, () => 0.5);
  assert.equal(retryGame(game), null);
  const missed = currentQuestion(game).code;
  answer(game, countries.find(c => c.code !== missed).code, valid);
  nextQuestion(game);
  answer(game, currentQuestion(game).code, valid);
  nextQuestion(game);
  const retry = retryGame(game);
  assert.equal(retry.practice, true);
  assert.deepEqual(retry.questions.map(c => c.code), [missed]);
  answer(retry, missed, valid);
  nextQuestion(retry);
  assert.equal(retryGame(retry), null);
  const fresh = createGame(countries, 5);
  assert.equal(fresh.practice, false);
  assert.equal(fresh.answers.length, 0);
});
