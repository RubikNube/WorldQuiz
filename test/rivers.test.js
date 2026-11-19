import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { CONTINENTS, eligibleCountries, allowedCounts, createGame, createCorrectionGame,
  currentQuestion, questionTopic, answer, nextQuestion, score, retryGame } from '../src/game.js';
import { createMistakes } from '../src/mistakes.js';
import { createHighscores } from '../src/highscores.js';
import { distanceToSegment, nearestRiver } from '../src/rivers.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const rivers = JSON.parse(await read('assets/data/rivers.json'));
const countries = JSON.parse(await read('assets/data/countries.json'));
const svg = await read('src/world.svg');
const riverCodes = new Set(rivers.map(r => r.code));
const allCodes = new Set([...riverCodes, ...countries.map(c => c.code)]);
const storage = () => {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
};

test('38 rivers have complete profiles, source geometry, on-course anchors and regional pools', async () => {
  assert.equal(rivers.length, 38);
  assert.equal(riverCodes.size, 38);
  const snapshot = JSON.parse(await read('assets/data/rivers-source.geojson'));
  const sourceIds = new Set(snapshot.features.map(f => f.id));
  const targets = [...svg.matchAll(/data-river="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(targets.sort(), [...riverCodes].sort());
  for (const r of rivers) {
    assert.match(r.code, /^river-[a-z-]+$/);
    assert.ok(r.name && CONTINENTS.includes(r.continent) && r.lengthKm > 0);
    assert.match(r.wikipediaUrl, /^https:\/\/de\.wikipedia\.org\/wiki\//);
    assert.ok(r.sourceUrls.length >= 2 && r.sourceFeatureIds.every(id => sourceIds.has(id)));
    assert.ok(r.anchor.every(Number.isFinite) && Object.values(r.bounds).every(Number.isFinite));
    const path = svg.match(new RegExp(`data-river="${r.code}"[^>]*><path class="river-line" d="([^"]+)"`))[1];
    assert.ok(path.includes(r.anchor.join(',')), `${r.name}: anchor is a course vertex`);
    const points = [...path.matchAll(/(?:M|L)([\d.-]+),([\d.-]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
    assert.ok(points.length > 2);
    assert.ok(points.every(([x, y]) => x >= 0 && x <= 1200 && y >= 0 && y <= 590));
  }
  for (const region of ['Welt', ...CONTINENTS]) {
    const pool = eligibleCountries(rivers, region);
    const counts = allowedCounts(pool.length);
    assert.ok(pool.length > 0);
    assert.equal(counts.at(-1), pool.length);
    assert.ok(counts.every(n => n > 0 && n <= pool.length));
    const game = createGame(pool, pool.length, () => .5, false, 'river');
    assert.equal(new Set(game.questions.map(q => q.code)).size, pool.length);
  }
  assert.deepEqual(allowedCounts(eligibleCountries(rivers, 'Ozeanien').length), [4]);
  const mackenzie = snapshot.features.filter(f => rivers.find(r => r.code === 'river-mackenzie').sourceFeatureIds.includes(f.id));
  assert.ok(mackenzie.every(f => f.properties.rivernum === 34), 'Exclude the Australian namesake');
  // Upstream Paraguay is mislabeled Paraná in Natural Earth; never highlight it.
  const parana = rivers.find(r => r.code === 'river-parana');
  assert.ok(parana.bounds.y > 370, 'Paraná does not extend north into Paraguay headwaters');
});

test('Jangtsekiang connects the headwaters to the lower course through Chang Jiang', async () => {
  const snapshot = JSON.parse(await read('assets/data/rivers-source.geojson'));
  const river = rivers.find(r => r.code === 'river-jangtsekiang');
  const lines = snapshot.features.filter(f => river.sourceFeatureIds.includes(f.id)).flatMap(f =>
    f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates]);
  const west = lines.reduce((best, line, index) => line[0][0] < lines[best][0][0] ? index : best, 0);
  const east = lines.findIndex(line => line.some(([lon]) => lon > 119));
  assert.ok(east >= 0, 'Lower course reaches eastern China');
  const reached = new Set([west]), pending = [west];
  while (pending.length) {
    const line = lines[pending.pop()];
    for (let i = 0; i < lines.length; i++) {
      if (reached.has(i)) continue;
      // Natural Earth leaves tiny seams between separately named sections.
      const adjacent = [line[0], line.at(-1)].some(a => [lines[i][0], lines[i].at(-1)]
        .some(b => Math.hypot(a[0] - b[0], a[1] - b[1]) < .02));
      if (adjacent) { reached.add(i); pending.push(i); }
    }
  }
  assert.ok(reached.has(east), 'Main course has no missing middle section');
});

test('Donau connects the German headwaters through Austria to the Black Sea', async () => {
  const snapshot = JSON.parse(await read('assets/data/rivers-source.geojson'));
  const river = rivers.find(r => r.code === 'river-donau');
  const features = snapshot.features.filter(f => river.sourceFeatureIds.includes(f.id));
  assert.deepEqual(features.map(f => f.properties.name).sort(), ['Danube', 'Donau']);
  const lines = features.flatMap(f => f.geometry.type === 'MultiLineString'
    ? f.geometry.coordinates : [f.geometry.coordinates]);
  const west = lines.findIndex(line => line.some(([lon, lat]) => lon < 8.3 && lat > 47.9 && lat < 48.2));
  const east = lines.findIndex(line => line.some(([lon, lat]) => lon > 28.7 && lat > 45 && lat < 45.5));
  assert.ok(west >= 0, 'Upper course reaches the German headwaters');
  assert.ok(east >= 0, 'Lower course reaches the Black Sea');
  const reached = new Set([west]), pending = [west];
  while (pending.length) {
    const line = lines[pending.pop()];
    for (let i = 0; i < lines.length; i++) {
      if (reached.has(i)) continue;
      const adjacent = [line[0], line.at(-1)].some(a => [lines[i][0], lines[i].at(-1)]
        .some(b => Math.hypot(a[0] - b[0], a[1] - b[1]) < .02));
      if (adjacent) { reached.add(i); pending.push(i); }
    }
  }
  assert.ok(reached.has(east), 'Upper and lower courses connect without a missing section');
  const path = svg.match(/data-river="river-donau"[^>]*><path class="river-line" d="([^"]+)"/)[1];
  assert.equal(path.split('M').filter(Boolean).length, lines.length, 'Every source section is rendered');
});

test('Rhein includes Alpine headwaters, Lake Constance, the border course and Dutch delta', async () => {
  const snapshot = JSON.parse(await read('assets/data/rivers-source.geojson'));
  const river = rivers.find(r => r.code === 'river-rhein');
  const features = snapshot.features.filter(f => river.sourceFeatureIds.includes(f.id));
  assert.deepEqual(features.map(f => f.properties.name).sort(),
    ['Lek', 'Nederrijn', 'Rhein', 'Rhein', 'Rhin', 'Rhine', 'Waal']);
  assert.ok(features.some(f => f.properties.featurecla === 'Lake Centerline'), 'Lake Constance crossing is included');
  const lines = features.flatMap(f => f.geometry.type === 'MultiLineString'
    ? f.geometry.coordinates : [f.geometry.coordinates]);
  const headwaters = lines.findIndex(line => line.some(([lon, lat]) => lon > 8.6 && lon < 8.8 && lat < 46.7));
  const lower = lines.findIndex(line => [line[0], line.at(-1)]
    .some(([lon, lat]) => lon > 4.9 && lon < 5 && lat > 51.8));
  assert.ok(headwaters >= 0, 'Upper course reaches the Swiss Alps');
  assert.ok(lower >= 0, 'Lower course reaches the Netherlands');
  const reached = new Set([headwaters]), pending = [headwaters];
  while (pending.length) {
    const line = lines[pending.pop()];
    for (let i = 0; i < lines.length; i++) {
      if (reached.has(i)) continue;
      // Allow only the tiny seams in the source, including the Alpine confluence.
      const adjacent = [line[0], line.at(-1)].some(a => [lines[i][0], lines[i].at(-1)]
        .some(b => Math.hypot(a[0] - b[0], a[1] - b[1]) < .02));
      if (adjacent) { reached.add(i); pending.push(i); }
    }
  }
  assert.ok(reached.has(lower), 'Alpine and lower courses connect through Lake Constance and the border course');
  assert.ok(lines.some(line => line.some(([lon, lat]) => lon < 4.1 && lat > 51.8)), 'Delta reaches the coast');
  const path = svg.match(/data-river="river-rhein"[^>]*><path class="river-line" d="([^"]+)"/)[1];
  assert.equal(path.split('M').filter(Boolean).length, lines.length, 'All sections render without bridging open-water gaps');
});

test('offline data generation reproduces committed country, river and mountain artifacts', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'worldquiz-rivers-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'src'));
  await cp(new URL('../scripts/', import.meta.url), join(directory, 'scripts'), { recursive: true });
  await cp(new URL('../assets/data/', import.meta.url), join(directory, 'assets/data'), { recursive: true });
  execFileSync('python3', [join(directory, 'scripts/generate-data.py')]);
  execFileSync('python3', ['-c', 'import sys, xml.etree.ElementTree as ET; ET.parse(sys.argv[1])', join(directory, 'src/world.svg')]);
  for (const file of ['assets/data/countries.json', 'assets/data/rivers.json', 'assets/data/mountains.json', 'src/world.svg']) {
    assert.equal(await readFile(join(directory, file), 'utf8'), await read(file), file);
  }
});

test('river answers ignore country codes, score once and support a one-river retry', () => {
  const game = createGame(rivers, 1, () => .5, false, 'river');
  assert.equal(answer(game, 'de', allCodes), false);
  assert.equal(answer(game, 'river-unknown', riverCodes), false);
  assert.equal(nextQuestion(game), false);
  const target = currentQuestion(game).code;
  const wrong = rivers.find(r => r.code !== target).code;
  assert.equal(answer(game, wrong, riverCodes), true);
  assert.equal(answer(game, target, riverCodes), false);
  assert.equal(score(game), 0);
  nextQuestion(game);
  const retry = retryGame(game, () => .5);
  assert.equal(retry.mode, 'river');
  assert.equal(retry.practice, true);
  assert.equal(retry.questions.length, 1);
  assert.equal(currentQuestion(retry).code, target);
  const country = createGame(countries, 1, () => .5, false, 'quiz');
  assert.equal(answer(country, target, allCodes), false);
});

test('mixed corrections validate topic-specific targets and preserve river streaks on reload', () => {
  const store = storage();
  store.setItem('worldQuizMistakes', JSON.stringify({ version: 1, entries: [
    { topic: 'quiz', code: 'de', streak: 1 },
    { topic: 'river', code: 'river-rhein', streak: 0 },
    { topic: 'river', code: 'de', streak: 0 },
    { topic: 'flags', code: 'river-rhein', streak: 0 },
  ] }));
  let mistakes = createMistakes(countries, () => store, rivers);
  assert.equal(mistakes.count, 2);
  const refs = mistakes.selectQuestions(() => .5);
  assert.equal(refs[0].topic, 'river', 'Unanswered errors retain selection priority');
  const correction = createCorrectionGame(countries, refs, () => .999, rivers);
  for (let i = 0; i < 2; i++) {
    const topic = questionTopic(correction);
    answer(correction, currentQuestion(correction).code, topic === 'river' ? riverCodes : allCodes);
    const progress = mistakes.recordAnswer(correction);
    assert.equal(progress.cleared, topic === 'quiz');
    assert.equal(mistakes.recordAnswer(correction), null, 'Do not double-record an answer');
    nextQuestion(correction);
  }
  mistakes = createMistakes(countries, () => store, rivers);
  assert.deepEqual(mistakes.entries, [{ topic: 'river', code: 'river-rhein', streak: 1 }]);
  const second = createCorrectionGame(countries, mistakes.selectQuestions(), () => .5, rivers);
  answer(second, 'river-rhein', riverCodes);
  assert.equal(mistakes.recordAnswer(second).cleared, true);
  assert.equal(mistakes.count, 0);
  for (const ref of [{ topic: 'river', code: 'de' }, { topic: 'quiz', code: 'river-rhein' }]) {
    assert.throws(() => createCorrectionGame(countries, [ref], () => .5, rivers), RangeError);
  }
  assert.throws(() => createCorrectionGame(countries, [{ topic: 'river', code: 'river-rhein' }]), RangeError);
  const wrong = createGame([rivers[0]], 1, () => .5, false, 'river');
  answer(wrong, rivers[1].code, riverCodes);
  mistakes.recordAnswer(wrong);
  assert.equal(createMistakes(countries, () => store, rivers).entries[0].streak, 0);
});

test('river records use river pool sizes, coexist with country records, reset and exclude practice', () => {
  const store = storage();
  store.setItem('worldQuizHighscores', JSON.stringify({ version: 1, records: {
    'quiz:Welt:5': 4, 'river:Ozeanien:4': 2, 'river:Ozeanien:10': 9,
  } }));
  let records = createHighscores(countries, () => store, rivers);
  assert.equal(records.getBest('quiz', 'Welt', 5), 4);
  assert.equal(records.getBest('river', 'Ozeanien', 4), 2);
  assert.equal(records.getBest('river', 'Ozeanien', 10), null);
  const game = createGame(eligibleCountries(rivers, 'Ozeanien'), 4, () => .5, false, 'river');
  game.region = 'Ozeanien';
  for (let i = 0; i < 4; i++) {
    answer(game, currentQuestion(game).code, riverCodes);
    nextQuestion(game);
  }
  assert.equal(records.recordCompletedRound({ ...game, practice: true }), null);
  assert.equal(records.recordCompletedRound(game).kind, 'improved');
  records = createHighscores(countries, () => store, rivers);
  assert.equal(records.getBest('river', 'Ozeanien', 4), 4);
  assert.equal(records.resetRecord('river', 'Ozeanien', 4), true);
  assert.equal(records.getBest('river', 'Ozeanien', 4), null);
  assert.equal(records.getBest('quiz', 'Welt', 5), 4);
});

test('nearest-course selection uses segments and does not connect separate subpaths', t => {
  assert.equal(distanceToSegment({ x: 4, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 3);
  const original = globalThis.DOMPoint;
  globalThis.DOMPoint = class {
    constructor(x, y) { this.x = x; this.y = y; }
    matrixTransform() { return this; }
  };
  t.after(() => { if (original) globalThis.DOMPoint = original; else delete globalThis.DOMPoint; });
  const route = d => ({ querySelector: () => ({ getAttribute: () => d }) });
  const a = route('M0,0L100,0M0,100L100,100');
  const b = route('M0,45L100,45');
  const svg = { getScreenCTM: () => ({ inverse: () => ({}) }), querySelectorAll: () => [a, b] };
  assert.equal(nearestRiver(svg, 50, 1, b), a, 'Wide hit area must not steal a nearer river');
  assert.equal(nearestRiver(svg, 50, 49, a), b, 'Disconnected subpaths stay separate');
  assert.equal(nearestRiver({ getScreenCTM: () => null }, 0, 0, a), a);
});
