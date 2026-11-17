import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const countries = JSON.parse(await readFile(new URL('../assets/data/countries.json', import.meta.url)));
const svg = await readFile(new URL('../src/world.svg', import.meta.url), 'utf8');
const source = JSON.parse(await readFile(new URL('../assets/data/countries-source.json', import.meta.url)));
const features = JSON.parse(await readFile(new URL('../assets/data/world-source.geojson', import.meta.url))).features;

test('all population estimates and reference years match the bundled map source', () => {
  for (const c of countries) {
    const original = source.find(s => s.cca2.toLowerCase() === c.code);
    const feature = features.find(f => f.properties.ADM0_A3 === original.cca3)
      || features.find(f => f.properties.ISO_A2_EH === original.cca2);
    assert.ok(Number.isInteger(c.population) && c.population > 0, c.code);
    assert.ok(Number.isInteger(c.populationYear), c.code);
    assert.equal(c.population, Math.round(feature.properties.POP_EST), c.code);
    assert.equal(c.populationYear, feature.properties.POP_YEAR, c.code);
  }
});

test('all 198 selected profiles are complete, uniquely keyed, and geographically selectable', async () => {
  assert.equal(countries.length, 198);
  const expected = source.filter(c => c.unMember || ['VA', 'PS', 'XK', 'TW', 'EH'].includes(c.cca2)).map(c => c.cca2.toLowerCase()).sort();
  assert.deepEqual(countries.map(c => c.code).sort(), expected);
  const targets = [...svg.matchAll(/data-country="([a-z]{2})"/g)].map(m => m[1]);
  assert.deepEqual([...new Set(targets)].sort(), expected);
  for (const c of countries) {
    assert.match(c.code, /^[a-z]{2}$/);
    assert.ok(c.name && c.capitals.length && c.capitals.every(Boolean) && c.continent && c.fact);
    assert.ok(c.areaKm2 > 0);
    assert.ok(c.anchor.every(Number.isFinite));
    assert.match(c.wikipediaUrl, /^https:\/\/de\.wikipedia\.org\/wiki\//);
    assert.ok(c.sourceUrls.length);
    await access(new URL(`../${c.flag}`, import.meta.url));
    const flag = await readFile(new URL(`../${c.flag}`, import.meta.url), 'utf8');
    assert.match(flag, /<svg/);
    assert.doesNotMatch(flag, /<script|<foreignObject|(?:href|src)=["']https?:/i);
  }
});

test('Kosovo, Taiwan, and Western Sahara have selectable profiles in their regions', () => {
  for (const [code, name, region] of [['xk', 'Kosovo', 'Europa'], ['tw', 'Taiwan', 'Asien'], ['eh', 'Westsahara', 'Afrika']]) {
    const country = countries.find(c => c.code === code);
    assert.equal(country.name, name);
    assert.equal(country.continent, region);
    assert.match(svg, new RegExp(`<path class="country" data-country="${code}" role="button" tabindex="0" aria-label="${name}"`));
  }
  assert.deepEqual(countries.find(c => c.code === 'eh').capitals, ['El Aaiún (beansprucht)']);
  assert.equal(countries.find(c => c.code === 'eh').populationYear, 2017);
});

test('microstates and island states have markers and antimeridian geometry stays split', () => {
  for (const code of ['va', 'sm', 'mc', 'nr', 'tv', 'ki', 'mt', 'sg', 'li', 'xk']) {
    assert.equal(countries.find(c => c.code === code).marker, true, code);
    assert.match(svg, new RegExp(`class="country marker" data-country="${code}"`));
  }
  for (const match of svg.matchAll(/ d="([^"]+)"/g)) {
    for (const ring of match[1].split('M').filter(Boolean)) {
      const points = ring.replace('Z', '').split('L').map(p => p.split(',').map(Number));
      for (let i = 1; i < points.length; i++) assert.ok(Math.abs(points[i][0] - points[i - 1][0]) < 650, 'No world-spanning seam');
    }
  }
});
