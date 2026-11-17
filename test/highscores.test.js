import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHighscores, highscoreMessage } from '../src/highscores.js';
import { createGame, answer, nextQuestion, currentQuestion, eligibleCountries } from '../src/game.js';

const countries = JSON.parse(await readFile(new URL('../assets/data/countries.json', import.meta.url)));
const codes = new Set(countries.map(c => c.code));
const key = 'worldQuizHighscores';
function storage() {
  const data = new Map();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
}
function round(points, { mode = 'quiz', region = 'Welt', count = 5, practice = false, finish = true } = {}) {
  const game = Object.assign(createGame(eligibleCountries(countries, region), count, () => .5, practice), { mode, region });
  for (let i = 0; i < count; i++) {
    const target = currentQuestion(game).code;
    answer(game, i < points ? target : countries.find(c => c.code !== target).code, codes);
    if (i < count - 1 || finish) nextQuestion(game);
  }
  return game;
}

test('first, improved, tied and lower records include zero and only write once per completed round', () => {
  const db = storage(), records = createHighscores(countries, () => db);
  assert.equal(records.hasRecords, false);
  assert.equal(highscoreMessage(records.recordCompletedRound(round(0))), 'Erster Rekord: 0/5!');
  const improved = round(4);
  const result = records.recordCompletedRound(improved);
  assert.equal(highscoreMessage(result), 'Neuer Rekord: 4/5!');
  assert.equal(records.recordCompletedRound(improved), result);
  assert.equal(highscoreMessage(records.recordCompletedRound(round(4))), 'Rekord eingestellt: 4/5!');
  assert.equal(highscoreMessage(records.recordCompletedRound(round(2))), 'Dein Rekord: 4/5.');
  assert.equal(createHighscores(countries, () => db).getBest('quiz', 'Welt', 5), 4);
});

test('records are independent across mode, region and count, including full-region rounds', () => {
  const records = createHighscores(countries, () => storage());
  for (const options of [{}, { mode: 'capitals' }, { region: 'Europa' }, { count: 10 }, { region: 'Europa', count: eligibleCountries(countries, 'Europa').length }]) {
    assert.equal(records.recordCompletedRound(round(2, options)).kind, 'first');
  }
  assert.equal(records.getBest('capitals', 'Europa', 5), null);
});

test('unfinished, abandoned, learning and practice rounds cannot save records', () => {
  const db = storage(), records = createHighscores(countries, () => db);
  for (const game of [null, createGame(countries, 5), round(5, { finish: false }), round(5, { practice: true }), round(5, { mode: 'learn' })]) {
    assert.equal(records.recordCompletedRound(game), null);
  }
  assert.equal(records.hasRecords, false);
  assert.equal(db.getItem(key), null);
});

test('invalid storage is ignored while valid entries survive', () => {
  const db = storage();
  for (const raw of ['{', 'null', '{"version":2,"records":{"quiz:Welt:5":3}}', '{"version":1,"records":[]}']) {
    db.setItem(key, raw);
    assert.equal(createHighscores(countries, () => db).hasRecords, false);
  }
  db.setItem(key, JSON.stringify({ version: 1, records: {
    'quiz:Welt:5': 3, 'quiz:Europa:5': 0, 'learn:Welt:5': 4, 'quiz:Unknown:5': 4,
    'quiz:Welt:6': 4, 'quiz:Welt:05': 4, 'quiz:Welt:5:extra': 4,
    'quiz:Welt:10': 11, 'capitals:Welt:5': -1, 'capitals:Europa:5': '4',
  } }));
  const records = createHighscores(countries, () => db);
  assert.equal(records.getBest('quiz', 'Welt', 5), 3);
  assert.equal(records.getBest('quiz', 'Europa', 5), 0);
  assert.equal(records.getBest('quiz', 'Welt', 6), null);
  assert.equal(records.getBest('quiz', 'Welt', 10), null);
  assert.equal(records.getBest('capitals', 'Europa', 5), null);
});

test('storage access and write failures retain records for the session', () => {
  const unavailable = () => { throw Error('blocked'); };
  for (const provider of [unavailable, () => ({ getItem: unavailable }), () => ({ getItem: () => null, setItem: unavailable, removeItem: unavailable })]) {
    const records = createHighscores(countries, provider);
    records.recordCompletedRound(round(3));
    assert.equal(records.persistent, false);
    assert.equal(records.getBest('quiz', 'Welt', 5), 3);
  }
  const records = createHighscores(countries, unavailable);
  records.recordCompletedRound(round(2));
  assert.equal(records.resetAll(), true);
  assert.equal(records.hasRecords, false);
});

test('selected and all resets persist and preserve unrelated browser data', () => {
  const db = storage(), records = createHighscores(countries, () => db);
  db.setItem('otherSetting', 'keep');
  const game = round(3);
  records.recordCompletedRound(game);
  records.recordCompletedRound(round(2, { region: 'Europa' }));
  assert.equal(records.resetRecord('quiz', 'Welt', 5), true);
  assert.equal(records.getBest('quiz', 'Welt', 5), null);
  records.recordCompletedRound(game);
  assert.equal(records.getBest('quiz', 'Welt', 5), null, 'rendering a previously completed round cannot restore a reset record');
  assert.equal(createHighscores(countries, () => db).getBest('quiz', 'Europa', 5), 2);
  assert.equal(records.resetAll(), true);
  assert.equal(db.getItem(key), null);
  assert.equal(db.getItem('otherSetting'), 'keep');
  assert.equal(records.resetRecord('learn', 'Welt', 5), false);
});

test('failed persistent resets leave both copies intact and can be retried', () => {
  const db = storage(), records = createHighscores(countries, () => db);
  records.recordCompletedRound(round(3));
  records.recordCompletedRound(round(2, { region: 'Europa' }));
  const original = db.getItem(key), set = db.setItem, remove = db.removeItem;
  db.setItem = db.removeItem = () => { throw Error('blocked'); };
  assert.equal(records.resetRecord('quiz', 'Welt', 5), false);
  assert.equal(records.resetAll(), false);
  assert.equal(records.getBest('quiz', 'Welt', 5), 3);
  assert.equal(db.getItem(key), original);
  db.setItem = set; db.removeItem = remove;
  assert.equal(records.resetAll(), true);
});
