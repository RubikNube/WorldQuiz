import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGame, createCorrectionGame, currentQuestion, questionTopic, roundedPopulation,
  populationOptions, answerPopulation, answer, nextQuestion, retryGame, score } from '../src/game.js';
import { createMistakes } from '../src/mistakes.js';
import { createHighscores } from '../src/highscores.js';

const countries = JSON.parse(await readFile(new URL('../assets/data/countries.json', import.meta.url)));
const codes = new Set(countries.map(c => c.code));
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key) };
};
const round = (count = 1, practice = false) => createGame(countries, count, () => 0.5, practice, 'population');
function respond(game, correct = true) {
  const question = currentQuestion(game);
  const right = roundedPopulation(question.population);
  return answerPopulation(game, correct ? right : question.populationOptions.find(n => n !== right));
}

test('population estimates round to two significant digits', () => {
  for (const [raw, rounded] of [[83132799, 83000000], [1397715000, 1400000000], [825, 830], [9999, 10000]]) {
    assert.equal(roundedPopulation(raw), rounded);
  }
  for (const value of [0, -1, NaN, Infinity]) assert.throws(() => roundedPopulation(value), RangeError);
});

test('all countries get four distinct positive choices with substantial gaps at every correct rank', () => {
  for (const country of countries) {
    for (const rank of [0, 1, 2, 3]) {
      const options = populationOptions(country.population, () => (rank + 0.5) / 4);
      assert.equal(options.length, 4);
      assert.equal(new Set(options).size, 4);
      assert.ok(options.every(n => Number.isInteger(n) && n > 0));
      const sorted = [...options].sort((a, b) => a - b);
      assert.ok(sorted.slice(1).every((n, i) => n / sorted[i] >= 1.8));
      assert.equal(sorted.indexOf(roundedPopulation(country.population)), rank, country.code);
      assert.equal(options.filter(n => n === roundedPopulation(country.population)).length, 1);
    }
  }
});

test('correct numerical ranks use equal random intervals including their boundaries', () => {
  for (const [sample, rank] of [[0, 0], [0.25 - Number.EPSILON, 0], [0.25, 1],
    [0.5 - Number.EPSILON, 1], [0.5, 2], [0.75 - Number.EPSILON, 2], [0.75, 3], [1 - Number.EPSILON, 3]]) {
    const options = populationOptions(83132799, () => sample).sort((a, b) => a - b);
    assert.equal(options.indexOf(83000000), rank);
  }
});

test('button order is shuffled independently of the correct numerical rank', () => {
  for (const rank of [0, 1, 2, 3]) {
    const positions = new Set();
    for (let first = 0; first < 4; first++) {
      for (let second = 0; second < 3; second++) {
        for (let third = 0; third < 2; third++) {
          const samples = [(rank + 0.5) / 4, (first + 0.5) / 4, (second + 0.5) / 3, (third + 0.5) / 2];
          const options = populationOptions(83132799, () => samples.shift());
          positions.add(options.indexOf(83000000));
          assert.equal([...options].sort((a, b) => a - b).indexOf(83000000), rank);
        }
      }
    }
    assert.equal(positions.size, 4);
  }
});

test('population rounds accept only an offered numeric choice once and retain choices', () => {
  const game = round(2);
  const question = currentQuestion(game);
  const options = [...question.populationOptions];
  assert.equal(nextQuestion(game), false);
  assert.equal(answer(game, question.code, codes), false);
  for (const value of [NaN, -1, null, String(options[0]), 123456789]) {
    assert.equal(answerPopulation(game, value), false);
  }
  assert.equal(respond(game), true);
  assert.equal(respond(game, false), false);
  assert.deepEqual(question.populationOptions, options);
  assert.equal(score(game), 1);
  assert.equal(game.answers[0].selected, undefined);
  nextQuestion(game);
  respond(game, false);
  assert.equal(game.finished, false);
  nextQuestion(game);
  assert.equal(game.finished, true);
  assert.equal(answerPopulation(game, options[0]), false);
});

test('population retries regenerate choices without changing source countries', () => {
  const original = JSON.stringify(countries);
  const game = round(2);
  const missed = currentQuestion(game);
  respond(game, false); nextQuestion(game);
  respond(game); nextQuestion(game);
  const retry = retryGame(game, () => 0);
  assert.equal(retry.mode, 'population');
  assert.equal(retry.practice, true);
  assert.deepEqual(retry.questions.map(q => q.code), [missed.code]);
  assert.notDeepEqual(retry.questions[0].populationOptions, missed.populationOptions);
  respond(retry); nextQuestion(retry);
  assert.equal(retryGame(retry), null);
  assert.equal(JSON.stringify(countries), original);
  assert.equal(answerPopulation(createGame(countries, 1), 100), false);
});

test('population mistakes persist alongside old topics and clear after two correct mixed rounds', () => {
  const db = storage();
  const game = round();
  const code = currentQuestion(game).code;
  db.setItem('worldQuizMistakes', JSON.stringify({ version: 1, entries: [{ topic: 'flags', code, streak: 0 }] }));
  let saved = createMistakes(countries, () => db);
  respond(game, false);
  saved.recordAnswer(game);
  saved = createMistakes(countries, () => db);
  assert.equal(saved.count, 2);
  for (let pass = 0; pass < 2; pass++) {
    const mixed = createCorrectionGame(countries, saved.selectQuestions(), () => 0.5);
    while (!mixed.finished) {
      const target = currentQuestion(mixed);
      if (questionTopic(mixed) === 'population') {
        assert.equal(answer(mixed, code, codes), false);
        respond(mixed);
        assert.equal(mixed.answers.at(-1).topic, 'population');
      } else {
        assert.equal(answerPopulation(mixed, 100), false);
        answer(mixed, target.code, codes);
      }
      const result = saved.recordAnswer(mixed);
      assert.equal(result.transition, pass === 0 ? 'correcting' : 'scheduled');
      assert.equal(result.cleared, pass === 1);
      assert.equal(saved.recordAnswer(mixed), null);
      nextQuestion(mixed);
    }
    saved = createMistakes(countries, () => db);
  }
  assert.equal(saved.count, 0);
});

test('population records persist separately while practice rounds remain unranked', () => {
  const db = storage();
  db.setItem('worldQuizHighscores', JSON.stringify({ version: 1, records: { 'quiz:Welt:5': 3 } }));
  let records = createHighscores(countries, () => db);
  const game = round(5);
  game.region = 'Welt';
  for (let i = 0; i < 5; i++) { respond(game, i < 4); nextQuestion(game); }
  assert.equal(records.recordCompletedRound(game).best, 4);
  records = createHighscores(countries, () => db);
  assert.equal(records.getBest('population', 'Welt', 5), 4);
  assert.equal(records.getBest('quiz', 'Welt', 5), 3);
  const practice = retryGame(game);
  practice.region = 'Welt';
  respond(practice); nextQuestion(practice);
  assert.equal(records.recordCompletedRound(practice), null);
  assert.equal(records.resetRecord('population', 'Welt', 5), true);
  assert.equal(records.getBest('quiz', 'Welt', 5), 3);
});
