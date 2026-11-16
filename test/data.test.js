import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const countries = JSON.parse(await readFile(new URL('../assets/data/countries.json', import.meta.url)));
const svg = await readFile(new URL('../src/world.svg', import.meta.url), 'utf8');
const source = JSON.parse(await readFile(new URL('../assets/data/countries-source.json', import.meta.url)));

test('all 195 UN-set profiles are complete, uniquely keyed, and geographically selectable', async () => {
  assert.equal(countries.length, 195);
  const expected = source.filter(c => c.unMember || ['VA', 'PS'].includes(c.cca2)).map(c => c.cca2.toLowerCase()).sort();
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

test('microstates and island states have markers and antimeridian geometry stays split', () => {
  for (const code of ['va', 'sm', 'mc', 'nr', 'tv', 'ki', 'mt', 'sg', 'li']) {
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
