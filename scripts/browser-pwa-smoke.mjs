// Build first, then start disposable Chromium as described in browser-smoke.mjs.
// Usage: node scripts/browser-pwa-smoke.mjs [debugger-url]
// Serves dist on a temporary localhost port; never changes the published bundle.
import assert from 'node:assert/strict';
import { checkMixedRound } from './browser-mixed.mjs';
import { checkMountainRound } from './browser-mountains.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const directory = resolve('dist');
const workerSource = await readFile(resolve(directory, 'sw.js'), 'utf8');
const updatedWorkers = new Set();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = createServer(async (request, response) => {
  try {
    let path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const updated = updatedWorkers.has(path);
    if (path.startsWith('/WorldQuiz/')) path = path.slice('/WorldQuiz'.length);
    const file = resolve(directory, `.${path.endsWith('/') ? `${path}index.html` : path}`);
    if (!file.startsWith(`${directory}/`)) throw Error('Invalid path');
    const content = path === '/sw.js' && updated
      ? workerSource.replace(/const VERSION = "([a-f0-9]+)";/, 'const VERSION = "$1-update-test";')
      : await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'text/plain', 'Cache-Control': 'no-store' });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let ws;
try {
  const debuggerUrl = process.argv[2] || 'http://127.0.0.1:9223';
  const targets = await (await fetch(`${debuggerUrl}/json`)).json();
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let serial = 0;
  const pending = new Map();
  const exceptions = [];
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) task.reject(message.error);
      else task.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
  });
  function cdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++serial;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function wait(expression) {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error(`Timed out: ${expression}`);
  }
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const ready = () => wait(`document.querySelector('#worldMap') && document.querySelector('#offlineStatus')?.textContent === 'Offline verfügbar'`);
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Network.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  for (const scope of ['/', '/WorldQuiz/']) {
    const base = `${origin}${scope}`;
    await cdp('Page.navigate', { url: base });
    await ready();
    await wait(`navigator.serviceWorker.controller?.scriptURL === new URL('sw.js', location.href).href`);
    const manifest = await cdp('Page.getAppManifest');
    assert.deepEqual(manifest.errors, []);
    assert.equal(JSON.parse(manifest.data).name, 'WorldQuiz');
    const before = await evaluate(`(async()=>({
      cacheNames:await caches.keys(),
      entries:await (await caches.open((await caches.keys()).find(name=>name.startsWith('worldquiz:'+location.href+':')))).keys().then(keys=>keys.length),
      script:navigator.serviceWorker.controller.scriptURL
    }))()`);
    assert.ok(before.entries > 200, 'Complete bundle is cached');
    assert.equal(before.script, `${base}sw.js`);
    // Scopes share localStorage on this origin. Start with an empty mistake pool
    // so the correction check below targets the capital missed in this pass.
    await evaluate(`localStorage.removeItem('worldQuizMistakes');localStorage.setItem('pwa-test-preserve', 'saved')`);
    await cdp('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await cdp('Page.navigate', { url: `${base}?offline-test=1` });
    await ready();
    assert.equal(await evaluate(`localStorage.getItem('pwa-test-preserve')`), 'saved');
    // These profiles have not been opened before going offline.
    for (const code of ['de', 'tv', 'xk', 'tw', 'eh']) {
      await evaluate(`document.querySelector('[data-country="${code}"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
      await wait(`!document.querySelector('#countryInfo').hidden && document.querySelector('#flag').complete && document.querySelector('#flag').naturalWidth > 0`);
    }
    await click('[data-mode="quiz"]');
    await click('#start');
    await wait(`document.querySelector('#question strong')`);
    await evaluate(`(async()=>{
      const countries=await (await fetch('assets/data/countries.json')).json();
      const code=countries.find(country=>country.name===document.querySelector('#question strong').textContent).code;
      document.querySelector('[data-country="'+code+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    })()`);
    assert.equal(await evaluate(`document.querySelector('#progress').value`), 1);
    await cdp('Page.reload');
    await ready();
    await click('[data-mode="capitals"]');
    await click('#start');
    await wait(`document.querySelector('#question strong')`);
    await evaluate(`(async()=>{
      const countries=await (await fetch('assets/data/countries.json')).json();
      const capital=document.querySelector('#question strong').textContent;
      const correct=countries.find(country=>country.capitals.join(' · ')===capital);
      const wrong=countries.find(country=>country.code!==correct.code);
      document.querySelector('[data-country="'+wrong.code+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    })()`);
    assert.equal(await evaluate(`document.querySelector('#progress').value`), 1);
    await cdp('Page.reload');
    await ready();
    await click('[data-mode="correction"]');
    assert.equal(await evaluate(`document.querySelector('#start').disabled`), false);
    await click('#start');
    await wait(`document.querySelector('#question strong')`);
    await evaluate(`(async()=>{
      const countries=await (await fetch('assets/data/countries.json')).json();
      const capital=document.querySelector('#question strong').textContent;
      const code=countries.find(country=>country.capitals.join(' · ')===capital).code;
      document.querySelector('[data-country="'+code+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    })()`);
    assert.equal(await evaluate(`document.querySelector('#progress').value`), 1);
    await cdp('Page.reload');
    await ready();
    for (const width of [320, 1440]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
      assert.ok(await evaluate(`document.querySelector('#offlineStatus').getBoundingClientRect().width > 0`));
    }
    await click('[data-mode="population"]');
    await evaluate(`document.querySelector('#autoNext').checked=false`);
    await click('#start');
    assert.equal(await evaluate(`document.querySelectorAll('#populationChoices button').length`), 4);
    await evaluate(`document.querySelector('[data-country="de"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
    assert.equal(await evaluate(`document.querySelector('#countryInfo').hidden && document.querySelector('#progress').value===0`), true);
    await evaluate(`(async()=>{
      const countries=await (await fetch('assets/data/countries.json')).json();
      const country=countries.find(c=>c.name===document.querySelector('#question strong').textContent);
      const correct=Number(country.population.toPrecision(2));
      [...document.querySelectorAll('#populationChoices button')].find(button=>Number(button.dataset.population)===correct).click();
    })()`);
    assert.equal(await evaluate(`document.querySelector('#progress').value`), 1);
    assert.equal(await evaluate(`document.querySelectorAll('#populationChoices button:disabled').length`), 4);
    assert.equal(await evaluate(`document.querySelectorAll('#populationChoices .populationCorrect').length`), 1);
    await click('[data-mode="flags"]');
    await evaluate(`document.querySelector('#autoNext').checked=false`);
    await click('#start');
    await wait(`document.querySelector('#questionFlag').complete && document.querySelector('#questionFlag').naturalWidth>0`);
    await evaluate(`(async()=>{
      const countries=await (await fetch('assets/data/countries.json')).json();
      const flag=document.querySelector('#questionFlag').getAttribute('src');
      const code=countries.find(country=>country.flag===flag).code;
      document.querySelector('[data-country="'+code+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    })()`);
    assert.equal(await evaluate(`document.querySelector('#progress').value`), 1);
    await click('[data-mode="river"]');
    await click('#start');
    await evaluate(`(async()=>{
      const rivers=await (await fetch('assets/data/rivers.json')).json();
      const river=rivers.find(r=>r.name===document.querySelector('#question strong').textContent);
      document.querySelector('[data-river="'+river.code+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    })()`);
    assert.equal(await evaluate(`document.querySelector('#progress').value`), 1);
    assert.equal(await evaluate(`!document.querySelector('#riverDetails').hidden && document.querySelector('#worldMap').classList.contains('river-mode')`), true);
    await checkMountainRound({ evaluate, click });
    await checkMixedRound({ evaluate, click });
    await cdp('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const savedStorage = await evaluate(`JSON.stringify({...localStorage})`);
    await evaluate(`window.pwaUpdateMarker = 'round-still-open'`);
    updatedWorkers.add(`${scope}sw.js`);
    await evaluate(`(async()=>{await (await navigator.serviceWorker.getRegistration()).update()})()`);
    await wait(`(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting)()`);
    assert.equal(await evaluate(`(async()=> (await navigator.serviceWorker.getRegistration()).active.state)()`), 'activated');
    assert.equal(await evaluate(`document.querySelector('#offlineStatus').textContent`), 'Offline verfügbar');
    assert.equal(await evaluate(`window.pwaUpdateMarker`), 'round-still-open');
    assert.ok(await evaluate(`(async()=> (await caches.keys()).some(name=>name.endsWith('-update-test')))()`));
    // Remove the last client without asking the waiting worker to skipWaiting.
    await cdp('Page.navigate', { url: 'about:blank' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await cdp('Page.navigate', { url: base });
    await ready();
    await wait(`(async()=>{
      const registration=await navigator.serviceWorker.getRegistration();
      const names=(await caches.keys()).filter(name=>name.startsWith('worldquiz:'+new URL('./',location.href).href+':'));
      return !registration.waiting && names.length===1 && names[0].endsWith('-update-test');
    })()`);
    assert.equal(await evaluate(`JSON.stringify({...localStorage})`), savedStorage);
    for (const name of before.cacheNames.filter(name => !name.startsWith(`worldquiz:${base}:`))) {
      assert.ok(await evaluate(`caches.has(${JSON.stringify(name)})`), 'Other scopes retain their caches');
    }
    console.log(`PWA checks passed at ${scope}: manifest, full precache, offline launch, flags, all modes, layouts, waiting update and activation.`);
  }
  assert.deepEqual(exceptions, []);
} finally {
  ws?.close();
  await new Promise(resolve => server.close(resolve));
}
