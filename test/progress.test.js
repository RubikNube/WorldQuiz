import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgress, PROGRESS_TOPICS } from '../src/progress.js';
import { createGame, createMixedGame, createCorrectionGame, answer, answerPopulation,
  currentQuestion, questionTopic, nextQuestion, roundedPopulation, retryGame } from '../src/game.js';
import { createMistakes } from '../src/mistakes.js';
import { createHighscores } from '../src/highscores.js';

const countries = [
  { code: 'DEU', name: 'Deutschland', continent: 'Europa', population: 83000000 },
  { code: 'FRA', name: 'Frankreich', continent: 'Europa', population: 67000000 },
  { code: 'JPN', name: 'Japan', continent: 'Asien', population: 125000000 },
  { code: 'CHN', name: 'China', continent: 'Asien', population: 1400000000 },
];
const rivers = [{ code: 'river-rhine', continent: 'Europa' }, { code: 'river-yangtze', continent: 'Asien' }];
const mountains = [{ code: 'mountain-fuji', continent: 'Asien' }, { code: 'mountain-alps', continent: 'Europa' }];
const key = 'worldQuizProgress';
function storage() {
  const data = new Map();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
}
function tracker(db = storage()) { return createProgress(countries, () => db, rivers, mountains, () => 1000); }
function game(topic = 'quiz', pool = countries, practice = false) {
  return Object.assign(createGame(pool, pool.length, () => .5, practice, topic), { region: 'Welt' });
}
function submit(g, correct = true) {
  const topic = questionTopic(g), target = currentQuestion(g);
  if (topic === 'population') return answerPopulation(g, correct ? roundedPopulation(target.population)
    : target.populationOptions.find(n => n !== roundedPopulation(target.population)));
  const pool = topic === 'river' ? rivers : topic === 'mountain' ? mountains : countries;
  return answer(g, correct ? target.code : pool.find(c => c.code !== target.code).code, new Set(pool.map(c => c.code)));
}
function finish(g, progress) {
  while (!g.finished) {
    if (!g.answers[g.index]) { submit(g); progress.recordAnswer(g); }
    nextQuestion(g);
  }
  return progress.recordCompletedRound(g);
}

test('empty summary includes full coverage pools and no historical migration', () => {
  const db = storage();
  db.setItem('worldQuizHighscores', JSON.stringify({ version: 1, records: { 'quiz:Welt:4': 4 } }));
  const progress = tracker(db);
  assert.deepEqual(progress.getSummary(), { attempts: 0, correct: 0, practice: 0, normal: 0,
    covered: 0, available: 20, recentAttempts: 0, recentCorrect: 0 });
  assert.equal(progress.getSummary({ topic: 'quiz', region: 'Europa' }).available, 2);
  assert.deepEqual(progress.getRecentRounds(), []);
});

test('each first answer counts immediately once, across six topics, without requiring completion', () => {
  const db = storage(), progress = tracker(db);
  for (const topic of PROGRESS_TOPICS) {
    const g = game(topic, topic === 'river' ? rivers : topic === 'mountain' ? mountains : countries);
    assert.equal(progress.recordAnswer(g), false);
    assert.equal(submit(g, false), true);
    assert.equal(progress.recordAnswer(g), true);
    assert.equal(progress.recordAnswer(g), false);
    assert.equal(submit(g), false);
    assert.equal(progress.getSummary({ topic }).attempts, 1);
    assert.equal(progress.getSummary({ topic }).covered, 1);
    assert.equal(progress.recordCompletedRound(g), false);
  }
  assert.equal(progress.getSummary().attempts, 6);
  assert.equal(progress.getSummary().correct, 0);
  assert.equal(tracker(db).getSummary().attempts, 6);
  assert.deepEqual(progress.getRecentRounds(), []);
  assert.equal(progress.recordAnswer(null), false);
});

test('restarts count new attempts, coverage is unique per topic/target, and practice is included', () => {
  const progress = tracker();
  for (let index = 0; index < 3; index++) {
    const g = game('quiz', [countries[0]], index === 2);
    submit(g, index > 0);
    progress.recordAnswer(g);
  }
  const g = game('flags', [countries[0]]);
  submit(g); progress.recordAnswer(g);
  const summary = progress.getSummary();
  assert.equal(summary.attempts, 4);
  assert.equal(summary.correct, 3);
  assert.equal(summary.practice, 1);
  assert.equal(summary.normal, 3);
  assert.equal(summary.covered, 2);
});

test('mixed and correction answers use target continent and underlying topic, and history records practice', () => {
  const progress = tracker();
  const mixed = Object.assign(createMixedGame(countries, rivers, 8, () => .5, mountains), { region: 'Welt' });
  assert.equal(finish(mixed, progress), true);
  assert.equal(progress.recordCompletedRound(mixed), false);
  assert.equal(progress.getSummary({ region: 'Europa' }).attempts + progress.getSummary({ region: 'Asien' }).attempts, 8);
  for (const topic of PROGRESS_TOPICS) assert.ok(progress.getSummary({ topic }).attempts > 0);
  assert.equal(progress.getRecentRounds({ region: 'Europa' }).length, 0, 'round region is the selected region');
  assert.equal(progress.getRecentRounds({ topic: 'river' })[0].total, 8, 'mixed history retains full score');
  const correction = createCorrectionGame(countries, [{ topic: 'population', code: 'JPN' }, { topic: 'river', code: 'river-rhine' }], () => .5, rivers, mountains);
  finish(correction, progress);
  assert.equal(progress.getSummary().practice, 2);
  assert.equal(progress.getSummary({ region: 'Asien', topic: 'population' }).practice, 1);
  assert.equal(progress.getRecentRounds()[0].mode, 'correction');
  assert.equal(progress.getRecentRounds()[0].practice, true);
});

test('retries record answers and completed practice rounds without clearing history', () => {
  const progress = tracker(), g = game('quiz', [countries[0]]);
  submit(g, false); progress.recordAnswer(g); nextQuestion(g); progress.recordCompletedRound(g);
  finish(Object.assign(retryGame(g), { region: 'Welt' }), progress);
  assert.equal(progress.getSummary().attempts, 2);
  assert.equal(progress.getSummary().covered, 1);
  assert.equal(progress.getSummary().practice, 1);
  assert.equal(progress.getRecentRounds().length, 2);
});

test('recent 100 answers are selected after filtering, with bounded buckets and lifetime totals', () => {
  const db = storage(), progress = tracker(db);
  for (const [target, count, correct] of [[countries[0], 110, true], [countries[2], 120, false]]) {
    for (let i = 0; i < count; i++) {
      const g = game('quiz', [target]); submit(g, correct); progress.recordAnswer(g);
    }
  }
  assert.equal(progress.getSummary().attempts, 230);
  assert.equal(progress.getSummary().correct, 110);
  assert.equal(progress.getSummary().recentCorrect, 0);
  assert.equal(progress.getSummary().recentAttempts, 100);
  assert.equal(progress.getSummary({ region: 'Europa' }).recentCorrect, 100);
  assert.equal(progress.getSummary({ region: 'Europa' }).attempts, 110);
  assert.equal(JSON.parse(db.getItem(key)).events.length, 200);
  assert.deepEqual(tracker(db).getSummary({ region: 'Europa' }), progress.getSummary({ region: 'Europa' }));
});

test('round history keeps 100 summaries, displays latest 20 matching, and returns copies', () => {
  const db = storage(), progress = tracker(db);
  for (let i = 0; i < 125; i++) {
    const g = game(i % 2 ? 'quiz' : 'flags', [countries[0]]);
    g.region = i % 2 ? 'Europa' : 'Welt';
    finish(g, progress);
  }
  assert.equal(JSON.parse(db.getItem(key)).rounds.length, 100);
  const rounds = progress.getRecentRounds({ topic: 'quiz', region: 'Europa' });
  assert.equal(rounds.length, 20);
  assert.ok(rounds.every(r => r.mode === 'quiz' && r.region === 'Europa'));
  rounds[0].topics.push('mountain');
  assert.equal(progress.getRecentRounds({ topic: 'mountain' }).length, 0);
  assert.deepEqual(tracker(db).getRecentRounds(), progress.getRecentRounds());
});

test('invalid saved data is ignored and valid entries survive', () => {
  const db = storage();
  for (const raw of ['{', 'null', '{"version":2}', '{"version":1,"entries":{},"events":{},"rounds":{}}']) {
    db.setItem(key, raw);
    assert.equal(tracker(db).getSummary().attempts, 0);
  }
  const progress = tracker(db), g = game('quiz', [countries[0]]);
  finish(g, progress);
  const saved = JSON.parse(db.getItem(key));
  saved.entries.push({ ...saved.entries[0], topic: 'bad' }, { ...saved.entries[0], attempts: -1 }, { ...saved.entries[0], code: 'bad' });
  saved.events.push({ ...saved.events[0], at: -1 }, { ...saved.events[0], practice: 'yes' });
  saved.rounds.push({ ...saved.rounds[0], correct: 5 }, { ...saved.rounds[0], topics: ['bad'] });
  db.setItem(key, JSON.stringify(saved));
  assert.equal(tracker(db).getSummary().attempts, 1);
  assert.equal(tracker(db).getSummary().recentAttempts, 1);
  assert.equal(tracker(db).getRecentRounds().length, 1);
});

test('storage access and write failures preserve session statistics', () => {
  const fail = () => { throw Error('blocked'); };
  for (const provider of [fail, () => ({ getItem: fail }), () => ({ getItem: () => null, setItem: fail })]) {
    const progress = createProgress(countries, provider, rivers, mountains), g = game('quiz', [countries[0]]);
    finish(g, progress);
    assert.equal(progress.persistent, false);
    assert.equal(progress.getSummary().attempts, 1);
    assert.equal(progress.getRecentRounds().length, 1);
  }
});

test('progress is independent of highscore resets and error correction', () => {
  const db = storage(), progress = tracker(db), mistakes = createMistakes(countries, () => db, rivers, mountains);
  const g = game('quiz', [countries[0]]);
  submit(g, false); progress.recordAnswer(g); mistakes.recordAnswer(g);
  assert.equal(mistakes.count, 1);
  for (let i = 0; i < 2; i++) {
    const practice = game('quiz', [countries[0]], true);
    submit(practice); progress.recordAnswer(practice); mistakes.recordAnswer(practice);
  }
  assert.equal(mistakes.count, 0);
  const before = db.getItem(key);
  createHighscores(countries, () => db, rivers, mountains).resetAll();
  assert.equal(db.getItem(key), before);
  assert.equal(progress.getSummary().attempts, 3);
});
