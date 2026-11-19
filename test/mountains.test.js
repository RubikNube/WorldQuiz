import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONTINENTS, allowedCounts, eligibleCountries, createGame, createMixedGame,
  createCorrectionGame, currentQuestion, questionTopic, answer, nextQuestion, retryGame, score } from '../src/game.js';
import { createMistakes } from '../src/mistakes.js';
import { createHighscores } from '../src/highscores.js';
import { nearestMountain } from '../src/mountains.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const mountains = JSON.parse(await read('assets/data/mountains.json'));
const catalog = JSON.parse(await read('assets/data/mountains-catalog.json'));
const countries = JSON.parse(await read('assets/data/countries.json'));
const rivers = JSON.parse(await read('assets/data/rivers.json'));
const svg = await read('src/world.svg');
const allCodes = new Set([...countries, ...rivers, ...mountains].map(q => q.code));
function storage() {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
}
function complete(game, correct = true, store) {
  while (!game.finished) {
    const target = currentQuestion(game);
    const pool = questionTopic(game) === 'river' ? rivers : mountains;
    assert.equal(answer(game, correct ? target.code : pool.find(q => q.code !== target.code).code, allCodes), true);
    store?.recordAnswer(game);
    nextQuestion(game);
  }
  return game;
}

test('40 sourced summit profiles have unique markers, valid coordinates and all six regional pools', () => {
  assert.equal(mountains.length, 40);
  assert.equal(new Set(mountains.map(m => m.code)).size, 40);
  assert.deepEqual([...svg.matchAll(/data-mountain="([^"]+)"/g)].map(m => m[1]).sort(), mountains.map(m => m.code).sort());
  assert.ok(svg.includes('id="mountainsLayer" hidden="hidden"'));
  for (const [i, m] of mountains.entries()) {
    const { anchor, ...source } = m;
    assert.deepEqual(source, catalog[i]);
    assert.match(m.code, /^mountain-[a-z0-9-]+$/);
    assert.ok(m.name && CONTINENTS.includes(m.continent));
    assert.ok(Number.isInteger(m.elevationM) && m.elevationM > 0 && m.elevationM < 9000);
    assert.ok(m.coordinates.length === 2 && m.coordinates.every(Number.isFinite));
    assert.ok(Math.abs(m.coordinates[0]) <= 180 && Math.abs(m.coordinates[1]) <= 90);
    assert.match(m.wikipediaUrl, /^https:\/\/de\.wikipedia\.org\/wiki\//);
    assert.ok(m.sourceUrls.length && m.sourceUrls.every(url => url.startsWith('https://')));
    assert.ok(anchor.length === 2 && anchor.every(Number.isFinite));
    assert.ok(anchor[0] >= 0 && anchor[0] <= 1200 && anchor[1] >= 0 && anchor[1] <= 590);
    const marker = svg.match(new RegExp(`data-mountain="${m.code}"[^>]*data-anchor-x="([^"]+)" data-anchor-y="([^"]+)" transform="translate\\(([^)]+)\\)"`));
    assert.ok(marker, m.name);
    assert.deepEqual(marker.slice(1, 3).map(Number), anchor);
    assert.deepEqual(marker[3].split(' ').map(Number), anchor);
  }
  assert.deepEqual(CONTINENTS.map(region => eligibleCountries(mountains, region).length), [6, 8, 8, 6, 6, 6]);
  for (const region of ['Welt', ...CONTINENTS]) {
    const pool = eligibleCountries(mountains, region);
    assert.ok(allowedCounts(pool.length).every(n => n > 0 && n <= pool.length));
    const game = createGame(pool, pool.length, () => .4, false, 'mountain');
    assert.equal(new Set(game.questions.map(q => q.code)).size, pool.length);
  }
});

test('mountain answers score once, reject other map layers and retain one-error retries', () => {
  const game = createGame(mountains, 1, () => .5, false, 'mountain');
  assert.equal(answer(game, countries[0].code, allCodes), false);
  assert.equal(answer(game, rivers[0].code, allCodes), false);
  assert.equal(answer(game, 'mountain-unknown', allCodes), false);
  assert.equal(nextQuestion(game), false);
  const target = currentQuestion(game);
  const wrong = mountains.find(m => m.code !== target.code);
  assert.equal(answer(game, wrong.code, allCodes), true);
  assert.equal(answer(game, target.code, allCodes), false);
  assert.equal(score(game), 0);
  nextQuestion(game);
  const retry = retryGame(game);
  assert.equal(retry.practice, true);
  assert.deepEqual(retry.questions.map(q => q.code), [target.code]);
  complete(retry);
  assert.equal(retryGame(retry), null);
  for (const [pool, mode] of [[countries, 'quiz'], [rivers, 'river']]) {
    assert.equal(answer(createGame(pool, 1, () => .5, false, mode), target.code, allCodes), false);
  }
});

test('six-topic mixed rounds balance and redistribute scarce independent pools without duplicate targets', () => {
  const topics = ['quiz', 'capitals', 'flags', 'population', 'river', 'mountain'];
  for (const count of [5, 10, 12, 15, 20]) {
    const game = createMixedGame(countries, rivers, count, () => .4, mountains);
    const totals = topics.map(t => game.questions.filter(q => q.topic === t).length);
    assert.ok(Math.max(...totals) - Math.min(...totals) <= 1);
    assert.equal(new Set(game.questions.map(q => q.code)).size, count);
  }
  for (const region of ['Welt', ...CONTINENTS]) {
    const pools = [countries, rivers, mountains].map(pool => eligibleCountries(pool, region));
    const expected = pools.flat().map(q => q.code);
    const game = createMixedGame(pools[0], pools[1], expected.length, () => .4, pools[2]);
    assert.deepEqual(new Set(game.questions.map(q => q.code)), new Set(expected));
  }
  for (const [cp, rp, mp] of [[[], [], mountains], [countries.slice(0, 1), [], mountains], [countries, rivers, mountains.slice(0, 1)]]) {
    const count = Math.min(20, cp.length + rp.length + mp.length);
    const game = createMixedGame(cp, rp, count, () => .4, mp);
    assert.equal(game.questions.length, count);
    assert.equal(new Set(game.questions.map(q => q.code)).size, count);
  }
  assert.throws(() => createMixedGame(countries, rivers, 1, Math.random, [mountains[0], mountains[0]]), /Doppelte/);
  assert.throws(() => createMixedGame([], [], 41, Math.random, mountains), RangeError);
});

test('mountain mistakes persist, reset progress, and clear after two correct practice rounds', () => {
  const db = storage();
  let store = createMistakes(countries, () => db, rivers, mountains);
  const game = complete(createGame(mountains, 1, () => .5, false, 'mountain'), false, store);
  const target = game.questions[0].code;
  store = createMistakes(countries, () => db, rivers, mountains);
  assert.equal(store.count, 1);
  const correction = () => createCorrectionGame(countries, store.selectQuestions(), () => .5, rivers, mountains);
  const practice = correction();
  assert.equal(questionTopic(practice), 'mountain');
  assert.equal(currentQuestion(practice).code, target);
  complete(practice, true, store);
  assert.equal(store.selectQuestions()[0].streak, 1);
  complete(correction(), false, store);
  assert.equal(store.selectQuestions()[0].streak, 0);
  complete(correction(), true, store);
  complete(correction(), true, store);
  assert.equal(createMistakes(countries, () => db, rivers, mountains).count, 0);
  assert.throws(() => createCorrectionGame(countries, [{ topic: 'mountain', code: countries[0].code }], Math.random, rivers, mountains), RangeError);
});

test('mountain records coexist with existing records and preserve old mixed all-round records', () => {
  const db = storage();
  const legacyCount = countries.length + rivers.length;
  db.setItem('worldQuizHighscores', JSON.stringify({ version: 1, records: {
    [`mixed:Welt:${legacyCount}`]: 120, 'quiz:Welt:10': 8, 'river:Welt:10': 7,
  } }));
  const records = createHighscores(countries, () => db, rivers, mountains);
  const game = complete(createGame(mountains, 5, () => .5, false, 'mountain'));
  game.region = 'Welt';
  assert.equal(records.recordCompletedRound(game).best, 5);
  assert.equal(records.recordCompletedRound({ ...game, practice: true }), null);
  const reload = createHighscores(countries, () => db, rivers, mountains);
  assert.equal(reload.getBest('mountain', 'Welt', 5), 5);
  assert.equal(reload.getBest('mixed', 'Welt', legacyCount), 120);
  assert.equal(reload.getBest('quiz', 'Welt', 10), 8);
  assert.equal(reload.getBest('river', 'Welt', 10), 7);
  assert.equal(reload.resetRecord('mountain', 'Welt', 5), true);
  assert.equal(reload.getBest('mountain', 'Welt', 5), null);
  assert.equal(reload.getBest('quiz', 'Welt', 10), 8);
});

test('nearest summit selection uses screen transforms and keeps deterministic ties and missing-matrix fallback', t => {
  const previous = globalThis.DOMPoint;
  globalThis.DOMPoint = class {
    constructor(x, y) { this.x = x; this.y = y; }
    matrixTransform(m) { return { x: this.x * m.scale + m.x, y: this.y * m.scale + m.y }; }
  };
  t.after(() => { if (previous === undefined) delete globalThis.DOMPoint; else globalThis.DOMPoint = previous; });
  const nodes = [0, 10].map(x => ({ dataset: { anchorX: String(x), anchorY: '0' } }));
  const map = { getScreenCTM: () => ({ scale: 3, x: 100, y: 50 }), querySelectorAll: () => nodes };
  assert.equal(nearestMountain(map, 128, 51, nodes[0]), nodes[1]);
  assert.equal(nearestMountain(map, 115, 50, nodes[1]), nodes[1]);
  assert.equal(nearestMountain({ ...map, getScreenCTM: () => null }, 128, 51, nodes[0]), nodes[0]);
});
