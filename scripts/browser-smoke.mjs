// Start `npm run serve:dist` and a disposable Chromium instance first:
// chromium --headless --remote-debugging-port=9223 --user-data-dir=/tmp/worldquiz-browser about:blank
// Then: node scripts/browser-smoke.mjs [app-url] [debugger-url]
import assert from 'node:assert/strict';
import { checkMixedRound } from './browser-mixed.mjs';
import { checkMountainRound } from './browser-mountains.mjs';
import { writeFile } from 'node:fs/promises';

const base = process.argv[2] || 'http://localhost:8000/';
const debuggerUrl = process.argv[3] || 'http://127.0.0.1:9223';
const targets = await (await fetch(`${debuggerUrl}/json`)).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
let serial = 0;
const pending = new Map(), exceptions = [], requests = [], failures = [];
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const promise = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) promise.reject(message.error);
    else promise.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    console.error('Browser console:', message.params.args.map(a => a.description || a.value).join(' '));
  }
  if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
  if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) failures.push(message.params.response.url);
});
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const response = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
}
async function wait(expression) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(`Timed out: ${expression}`);
}
async function settleLayout() {
  await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
}
async function waitForInfo() {
  await settleLayout();
  await wait(`(()=>{
    const card=document.querySelector('#countryInfo').getBoundingClientRect();
    const question=document.querySelector('#questionBar');
    const top=(getComputedStyle(question).position==='sticky'?question.getBoundingClientRect().height:0)+12;
    return card.top>=top-2 && (card.height>innerHeight-top-12 || card.bottom<=innerHeight-10);
  })()`);
}
async function waitForQuestionMap() {
  await settleLayout();
  await wait(`(()=>{
    const question=document.querySelector('#questionBar');
    const sticky=getComputedStyle(question).position==='sticky';
    const target=sticky?document.querySelector('.mapWrap'):question;
    const top=document.body.classList.contains('populationQuestion')?0:(sticky?question.getBoundingClientRect().height:0)+12;
    return Math.abs(target.getBoundingClientRect().top-top)<2;
  })()`);
}
async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  if (selector==='#next' && await evaluate(`matchMedia('(max-width:1099px)').matches&&!document.querySelector('#quizStats').hidden`)) await waitForQuestionMap();
}
const choose = (id, value) => evaluate(`document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(value)};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event('change'))`);
const countryClick = code => evaluate(`document.querySelector('[data-country="${code}"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
async function correct() {
  if (await evaluate(`matchMedia('(max-width:1099px)').matches && document.querySelector('#countryInfo').hidden`)) await waitForQuestionMap();
  const code = await evaluate(`window.testCountries.find(c=>(document.querySelector('#question .fullCapitalPrompt')!==null?c.capitals.join(' · '):c.name)===document.querySelector('#question strong').textContent).code`);
  await countryClick(code);
  if (await evaluate(`matchMedia('(max-width:1099px)').matches`)) await waitForInfo();
}
async function checkPopulationHighlight() {
  assert.equal(await evaluate(`(()=>{
    const target=window.testCountries.find(c=>c.name===document.querySelector('#question strong').textContent);
    const elements=[...document.querySelectorAll('#worldMap [data-country]')];
    return target && elements.some(el=>el.dataset.country===target.code)
      && elements.every(el=>el.classList.contains('selected')===(el.dataset.country===target.code)
        && el.getAttribute('aria-pressed')===String(el.dataset.country===target.code)
        && !el.classList.contains('correct') && !el.classList.contains('wrong'));
  })()`), true, 'Only the population question country and its markers are highlighted before answering');
  assert.equal(await evaluate(`document.querySelector('#countryInfo').hidden`), true);
}

async function populationRound(width) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 600 });
  await cdp('Page.reload');
  await wait(`document.querySelector('#mapHost').getAttribute('aria-busy')==='false'`);
  await evaluate(`(async()=>{window.testCountries=await (await fetch('assets/data/countries.json')).json();document.querySelector('#autoNext').checked=false})()`);
  await click('[data-mode="population"]');
  await choose('continent', 'Europa'); await choose('count', '5');
  await click('#start');
  await wait(`document.querySelectorAll('#populationChoices button').length===4`);
  await checkPopulationHighlight();
  await countryClick('de');
  await checkPopulationHighlight();
  assert.equal(await evaluate(`document.querySelector('#countryInfo').hidden && document.querySelector('#progress').value===0`), true);
  assert.equal(await evaluate(`document.querySelector('#question').textContent.includes('ungefähr (')`), true);
  await evaluate(`document.querySelector('#populationChoices button').focus()`);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert.equal(await evaluate(`document.querySelector('#progress').value`), 1);
  assert.equal(await evaluate(`document.querySelectorAll('#populationChoices button:disabled').length`), 4);
  assert.equal(await evaluate(`(()=>{
    const code=window.testCountries.find(c=>c.name===document.querySelector('#question strong').textContent).code;
    return [...document.querySelectorAll('#worldMap [data-country]')].every(el=>
      el.classList.contains('correct')===(el.dataset.country===code) && !el.classList.contains('selected'));
  })()`), true, 'Answered population country retains the green highlight');
  const correctPopulation = `Number(window.testCountries.find(c=>c.name===document.querySelector('#question strong').textContent).population.toPrecision(2))`;
  await countryClick('de');
  assert.equal(await evaluate(`document.querySelector('#countryInfo').hidden`), false);
  await click('#next');
  assert.equal(await evaluate(`document.querySelector('#countryInfo').hidden`), true);
  for (let i = 1; i < 5; i++) {
    await checkPopulationHighlight();
    await evaluate(`(()=>{const right=${correctPopulation};[...document.querySelectorAll('#populationChoices button')].find(b=>Number(b.dataset.population)${i === 1 ? '!==' : '==='}right).click()})()`);
    await click('#next');
  }
  assert.equal(await evaluate(`document.querySelector('#results').hidden`), false);
  assert.ok(await evaluate(`document.querySelector('#highscoreResult').textContent.length>0`));
  assert.ok(await evaluate(`document.querySelector('#mistakeList').textContent.includes('Einwohner (')`));
  await click('#retry');
  while (!await evaluate(`document.querySelector('#results').hidden===false`)) {
    await checkPopulationHighlight();
    await evaluate(`(()=>{const right=${correctPopulation};[...document.querySelectorAll('#populationChoices button')].find(b=>Number(b.dataset.population)===right).click()})()`);
    await click('#next');
  }
  assert.equal(await evaluate(`document.querySelector('#mistakeList').children.length`), 0);
  assert.equal(await evaluate(`document.querySelector('#highscoreResult').textContent`), '');
  await click('#newRound');
  await click('#restart');
  assert.equal(await evaluate(`document.querySelector('#progress').value`), 0);
  await checkPopulationHighlight();
  await wait(`(()=>{const r=document.querySelector('#populationChoices').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()`);
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true);
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('#populationChoices button')).every(b=>b.getBoundingClientRect().height>=44)`), true);
  await screenshot(`/tmp/worldquiz-population-${width}.png`);
  // Mixed correction rounds must switch input types, including after reload.
  await evaluate(`localStorage.setItem('worldQuizMistakes',JSON.stringify({version:1,entries:[{topic:'population',code:'de',streak:0},{topic:'flags',code:'de',streak:0}]}))`);
  await cdp('Page.reload');
  await wait(`document.querySelector('#mapHost').getAttribute('aria-busy')==='false'`);
  await evaluate(`(async()=>{window.testCountries=await(await fetch('assets/data/countries.json')).json();document.querySelector('#autoNext').checked=false})()`);
  await click('[data-mode="correction"]'); await click('#start');
  for (let pass = 0; pass < 2; pass++) {
    for (let question = 0; question < 2; question++) {
      if (await evaluate(`!document.querySelector('#populationChoices').hidden`)) {
        await checkPopulationHighlight();
        await evaluate(`(async()=>{const countries=await(await fetch('assets/data/countries.json')).json();const right=Number(countries.find(c=>c.code==='de').population.toPrecision(2));[...document.querySelectorAll('#populationChoices button')].find(b=>Number(b.dataset.population)===right).click()})()`);
      } else {
        assert.equal(await evaluate(`document.querySelectorAll('#worldMap .selected,#worldMap .correct,#worldMap .wrong').length`), 0, 'Flag questions do not reveal their country');
        await countryClick('de');
      }
      await click('#next');
    }
    if (!pass) await click('#newRound');
  }
  assert.equal(await evaluate(`document.querySelector('#correctionCount').textContent`), '0 offene Fragen');
  await click('[data-mode="population"]');
  await click('#start');
  await evaluate(`(async()=>{window.testCountries=await(await fetch('assets/data/countries.json')).json();document.querySelector('#autoNext').checked=true})()`);
  await evaluate(`(()=>{const right=${correctPopulation};[...document.querySelectorAll('#populationChoices button')].find(b=>Number(b.dataset.population)===right).click()})()`);
  await wait(`document.querySelector('#questionCount').textContent==='Frage 2/10'`);
  assert.equal(await evaluate(`document.querySelectorAll('#populationChoices button:not(:disabled)').length`), 4);
  await checkPopulationHighlight();
}

async function flagsRound(width) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  await cdp('Page.reload');
  await wait(`document.querySelector('#mapHost').getAttribute('aria-busy')==='false'`);
  await evaluate(`(async()=>{window.testCountries=await (await fetch('assets/data/countries.json')).json();document.querySelector('#autoNext').checked=false})()`);
  await click('[data-mode="flags"]');
  await choose('continent', 'Welt'); await choose('count', '5');
  await click('#start');
  if (width < 600) await waitForQuestionMap();
  const target = () => evaluate(`window.testCountries.find(c=>c.flag===document.querySelector('#questionFlag').getAttribute('src'))`);
  const missed = await target();
  let previous;
  for (let i = 0; i < 5; i++) {
    await wait(`document.querySelector('#questionFlag').complete && document.querySelector('#questionFlag').naturalWidth>0`);
    const country = await target();
    assert.notEqual(country.code, previous);
    previous = country.code;
    assert.equal(await evaluate(`document.querySelector('#question').textContent`), 'Zu welchem Land gehört diese Flagge?');
    assert.equal(await evaluate(`document.querySelector('#questionFlag').alt`), 'Gesuchte Flagge');
    assert.equal(await evaluate(`document.querySelector('#countryInfo').hidden`), true);
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true);
    if (width < 600) {
      assert.ok(await evaluate(`document.querySelector('#questionBar').getBoundingClientRect().height<innerHeight/2`));
    }
    if (i === 0) {
      await click('#changeMode'); await click('.dialogModes [data-mode="flags"]');
      assert.equal((await target()).code, country.code, 'same mode preserves the question');
      await countryClick(country.code === 'de' ? 'fr' : 'de');
      await countryClick(country.code);
      assert.equal(await evaluate(`document.querySelector('#points').textContent`), '0 Punkte');
    } else {
      await evaluate(`(()=>{const el=document.querySelector('[data-country="${country.code}"]');el.focus();el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()`);
    }
    assert.ok((await evaluate(`document.querySelector('#feedback').textContent`)).includes(country.name));
    if (i === 0) await screenshot(`/tmp/worldquiz-flags-${width}.png`);
    await click('#next');
  }
  assert.equal(await evaluate(`document.querySelector('#resultTitle').textContent`), '4 von 5 richtig');
  assert.equal(await evaluate(`document.querySelector('#questionFlagFrame').hidden`), true);
  assert.equal(await evaluate(`document.querySelector('#mistakeList .mistakeFlag').getAttribute('src')`), missed.flag);
  const best = await evaluate(`JSON.parse(localStorage.getItem('worldQuizHighscores')).records['flags:Welt:5']`);
  assert.ok(best >= 4);
  assert.ok(await evaluate(`JSON.parse(localStorage.getItem('worldQuizMistakes')).entries.some(e=>e.topic==='flags'&&e.code==='${missed.code}')`));
  await click('#retry');
  assert.equal((await target()).code, missed.code);
  await countryClick(missed.code); await click('#next');
  assert.equal(await evaluate(`document.querySelector('#highscoreResult').textContent`), '');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('worldQuizHighscores')).records['flags:Welt:5']`), best);
  // Confirm varied aspect ratios fit the prompt without cropping or overflow.
  await click('#newRound');
  for (const code of ['np', 'ch', 'qa']) {
    await evaluate(`document.querySelector('#questionFlag').src=window.testCountries.find(c=>c.code==='${code}').flag`);
    await wait(`document.querySelector('#questionFlag').complete && document.querySelector('#questionFlag').naturalWidth>0`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('#questionFlag')).objectFit`), 'contain');
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true);
  }
  await cdp('Network.setBlockedURLs', { urls: ['*flag-unavailable.svg'] });
  await evaluate(`document.querySelector('#questionFlag').src='flag-unavailable.svg'`);
  await wait(`!document.querySelector('#questionFlagFallback').hidden`);
  assert.equal(await evaluate(`document.querySelector('#progress').value`), 0);
  await cdp('Network.setBlockedURLs', { urls: [] });
  await click('#changeMode'); await click('.dialogModes [data-mode="quiz"]');
  assert.equal(await evaluate(`document.querySelector('#questionFlagFrame').hidden`), true);
}
async function checkRivers() {
  const ready = () => wait(`document.querySelector('#worldMap') && document.querySelector('#mapHost').getAttribute('aria-busy')==='false'`);
  const riverClick = code => evaluate(`document.querySelector('[data-river="${code}"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  const target = () => evaluate(`window.testRivers.find(r=>r.name===document.querySelector('#question strong').textContent)`);
  for (const width of [1440, 320, 390]) {
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: width === 1440 ? 1000 : 844, deviceScaleFactor: 1, mobile: width < 600 });
    await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await evaluate(`localStorage.removeItem('worldQuizMistakes');localStorage.removeItem('worldQuizHighscores')`);
    await cdp('Page.reload'); await ready();
    await evaluate(`(async()=>{window.testRivers=await (await fetch('assets/data/rivers.json')).json();document.querySelector('#autoNext').checked=false})()`);
    await click('[data-mode="river"]');
    await choose('continent', 'Ozeanien');
    assert.equal(await evaluate(`document.querySelector('#count').value`), '4');
    assert.equal(await evaluate(`document.querySelector('#count option').textContent`), 'Alle 4 Flüsse');
    assert.match(await evaluate(`document.querySelector('[data-mode-best="quiz"]').textContent`), /10 Fragen/);
    await choose('continent', 'Europa'); await choose('count', '5');
    assert.equal(await evaluate(`document.querySelectorAll('[data-country][tabindex="0"]').length`), 0);
    assert.equal(await evaluate(`document.querySelectorAll('[data-river][tabindex="0"]').length`), 38);
    await countryClick('de');
    assert.equal(await evaluate(`document.querySelector('#countryInfo').hidden`), true);
    // Keyboard selection preserves native topic behavior and shows river details.
    await evaluate(`(()=>{const node=document.querySelector('[data-river="river-rhein"]');node.focus();node.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()`);
    assert.equal(await evaluate(`document.querySelector('#countryName').textContent`), 'Rhein');
    assert.equal(await evaluate(`document.querySelector('#countryDetails').hidden && !document.querySelector('#riverDetails').hidden && document.querySelector('#flag').parentElement.hidden`), true);
    await click('#closeInfo');
    // Clicking a point on the Rhine resolves to it even if another hit stroke receives the event.
    await evaluate(`(()=>{
      const svg=document.querySelector('#worldMap'),r=window.testRivers.find(r=>r.code==='river-rhein');
      const p=new DOMPoint(...r.anchor).matrixTransform(svg.getScreenCTM());
      document.querySelector('[data-river="river-seine"] .river-hit').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1,clientX:p.x,clientY:p.y}));
    })()`);
    assert.equal(await evaluate(`document.querySelector('#countryName').textContent`), 'Rhein');
    await click('#start');
    if (width < 600) await waitForQuestionMap();
    assert.equal(await evaluate(`document.querySelector('#countryInfo').hidden`), true);
    // Pinch/drag gestures must never submit a river answer.
    await click('#zoomIn');
    await evaluate(`document.querySelector('#mapHost').scrollIntoView({block:'center'})`);
    const position = await evaluate(`(()=>{const r=document.querySelector('#worldMap').getBoundingClientRect();return {x:r.x+r.width/2,y:Math.max(r.y+50,130)}})()`);
    if (width < 600) {
      await cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
      const beforePinch = await evaluate(`document.querySelector('#worldMap').getAttribute('viewBox')`);
      await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: position.x-20, y: position.y, id: 0 }, { x: position.x+20, y: position.y, id: 1 }] });
      await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: position.x-55, y: position.y, id: 0 }, { x: position.x+55, y: position.y, id: 1 }] });
      await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.equal(await evaluate(`document.querySelector('#progress').value`), 0);
      assert.notEqual(await evaluate(`document.querySelector('#worldMap').getAttribute('viewBox')`), beforePinch);
      await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
      await new Promise(resolve => setTimeout(resolve, 400));
    }
    const beforeDrag = await evaluate(`document.querySelector('#worldMap').getAttribute('viewBox')`);
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: position.x, y: position.y, button: 'left', clickCount: 1 });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: position.x + 45, y: position.y + 25, button: 'left', buttons: 1 });
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: position.x + 45, y: position.y + 25, button: 'left', clickCount: 1 });
    assert.equal(await evaluate(`document.querySelector('#progress').value`), 0);
    assert.notEqual(await evaluate(`document.querySelector('#worldMap').getAttribute('viewBox')`), beforeDrag);
    await new Promise(resolve => setTimeout(resolve, 400));
    await click('#restart');
    const missed = await target();
    let wrong = await evaluate(`window.testRivers.find(r=>r.name!==document.querySelector('#question strong').textContent)`);
    await riverClick(wrong.code);
    if (width < 600) await waitForInfo();
    assert.equal(await evaluate(`document.querySelector('[data-river="${missed.code}"]').classList.contains('correct')`), true);
    assert.equal(await evaluate(`document.querySelector('[data-river="${wrong.code}"]').classList.contains('wrong')`), true);
    assert.match(await evaluate(`document.querySelector('#feedback').textContent`), new RegExp(missed.name));
    assert.match(await evaluate(`document.querySelector('#feedback').textContent`), new RegExp(wrong.name));
    await riverClick('river-waikato');
    assert.equal(await evaluate(`document.querySelector('#progress').value`), 1);
    assert.equal(await evaluate(`document.querySelector('[data-river="${wrong.code}"]').classList.contains('wrong')`), true);
    assert.equal(await evaluate(`document.querySelector('#points').textContent`), '0 Punkte');
    await click('#next');
    for (let i = 1; i < 5; i++) {
      await riverClick((await target()).code);
      if (width < 600) await waitForInfo();
      if (i === 1) await screenshot(`/tmp/worldquiz-rivers-${width}.png`);
      await click('#next');
    }
    assert.equal(await evaluate(`document.querySelector('#resultTitle').textContent`), '4 von 5 richtig');
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('worldQuizHighscores')).records['river:Europa:5']`), 4);
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true);
    await click('#mistakeList button');
    assert.equal(await evaluate(`document.querySelector('#countryName').textContent`), missed.name);
    assert.equal(await evaluate(`document.querySelector('#worldMap').classList.contains('river-mode')`), true);
    await click('#retry');
    assert.equal((await target()).code, missed.code);
    await riverClick(missed.code); await click('#next');
    assert.equal(await evaluate(`document.querySelector('#highscoreResult').textContent`), '');
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('worldQuizMistakes')).entries.find(e=>e.code==='${missed.code}').streak`), 1);
    // Real pointer/touch selection of an actual course at its revealed anchor.
    await click('#newRound');
    if (width < 600) await waitForQuestionMap();
    else await settleLayout();
    const tapTarget = await target();
    await evaluate(`document.querySelector('[data-river="${tapTarget.code}"]').focus();document.querySelector('#mapHost').scrollIntoView({block:'center'})`);
    await settleLayout();
    const tap = await evaluate(`(()=>{const r=window.testRivers.find(r=>r.code==='${tapTarget.code}');const p=new DOMPoint(...r.anchor).matrixTransform(document.querySelector('#worldMap').getScreenCTM());return {x:p.x,y:p.y}})()`);
    if (width < 600) {
      await cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
      await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...tap, id: 0 }] });
      await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...tap, button: 'left', clickCount: 1 });
      await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...tap, button: 'left', clickCount: 1 });
    }
    await wait(`document.querySelector('#progress').value===1`);
    assert.equal(await evaluate(`document.querySelector('#points').textContent`), '1 Punkte');
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
    // Mixed saved errors change the active layer, preserve country settings, and support result links.
    await evaluate(`localStorage.setItem('worldQuizMistakes',JSON.stringify({version:1,entries:[{topic:'river',code:'river-rhein',streak:1},{topic:'quiz',code:'de',streak:0}]}))`);
    await cdp('Page.reload'); await ready();
    await evaluate(`document.querySelector('#autoNext').checked=false`);
    await click('[data-mode="correction"]'); await click('#start');
    const topics = new Set();
    for (let i = 0; i < 2; i++) {
      const river = await evaluate(`document.querySelector('#worldMap').classList.contains('river-mode')`);
      topics.add(river ? 'river' : 'quiz');
      if (river) await riverClick('river-rhein');
      else await countryClick('fr');
      await click('#next');
    }
    assert.equal(topics.size, 2);
    assert.match(await evaluate(`document.querySelector('#correctionSummary').textContent`), /1 Fragen korrigiert. 1 offene Fragen/);
    await click('#mistakeList button');
    assert.equal(await evaluate(`document.querySelector('#countryName').textContent`), 'Deutschland');
    assert.equal(await evaluate(`document.querySelector('#worldMap').classList.contains('river-mode')`), false);
    assert.equal(await evaluate(`document.querySelector('#riverDetails').hidden && !document.querySelector('#countryDetails').hidden`), true);
    await click('#changeMode'); await click('.dialogModes [data-mode="learn"]');
    assert.equal(await evaluate(`document.querySelector('#riversLayer').hasAttribute('hidden')`), true);
    assert.equal(await evaluate(`document.querySelectorAll('[data-country][tabindex="0"]').length>198`), true);
    assert.equal(await evaluate(`document.querySelectorAll('[data-river][tabindex="0"]').length`), 0);
  }
  await cdp('Emulation.setEmulatedMedia', { features: [] });
}

async function checkCorrections() {
  const ready = () => wait(`document.querySelector('#worldMap') && document.querySelector('#mapHost').getAttribute('aria-busy')==='false'`);
  const saved = () => evaluate(`JSON.parse(localStorage.getItem('worldQuizMistakes'))?.entries ?? []`);
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  for (const width of [1440, 320]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: width === 320 ? 844 : 1000, deviceScaleFactor: 1, mobile: width === 320 });
    await evaluate(`localStorage.removeItem('worldQuizMistakes')`);
    await cdp('Page.reload'); await ready();
    await click('[data-mode="correction"]');
    assert.equal(await evaluate(`document.querySelector('#start').disabled`), true);
    assert.equal(await evaluate(`document.querySelector('#regionField').hidden && document.querySelector('#countField').hidden && document.querySelector('#highscores').hidden`), true);
    await click('[data-mode="quiz"]');
    await choose('continent', 'Europa'); await choose('count', '5');
    await evaluate(`document.querySelector('#autoNext').checked=false`);
    await click('#start');
    const target = await evaluate(`document.querySelector('#question strong').textContent`);
    const wrong = await evaluate(`(async()=>{window.testCountries=await (await fetch('assets/data/countries.json')).json();return window.testCountries.find(c=>c.name!==${JSON.stringify(target)}).code})()`);
    await countryClick(wrong);
    assert.equal((await saved()).length, 1, 'mistake saves before completing round');
    await cdp('Page.reload'); await ready();
    assert.equal(await evaluate(`document.querySelector('#correctionCount').textContent`), '1 offene Fragen');
    // Seed both topics for the same country, with different progress.
    await evaluate(`localStorage.setItem('worldQuizMistakes',JSON.stringify({version:1,entries:[{topic:'quiz',code:'de',streak:0},{topic:'capitals',code:'de',streak:1}]}))`);
    await cdp('Page.reload'); await ready();
    await evaluate(`(async()=>{window.testCountries=await (await fetch('assets/data/countries.json')).json();document.querySelector('#autoNext').checked=false})()`);
    await click('[data-mode="quiz"]'); await choose('continent', 'Europa'); await choose('count', '5');
    await click('[data-mode="correction"]');
    await screenshot(`/tmp/worldquiz-correction-card-${width}.png`);
    await click('#start');
    assert.equal(await evaluate(`document.querySelector('#mapTitleFull').textContent`), 'Die ganze Welt');
    const topics = new Set();
    for (let i = 0; i < 2; i++) {
      const capital = await evaluate(`!!document.querySelector('#question .fullCapitalPrompt')`);
      topics.add(capital ? 'capitals' : 'quiz');
      await correct();
      assert.equal(await evaluate(`document.querySelector('#correctionProgress').textContent`), capital ? 'Fehler korrigiert!' : '1 von 2 richtig');
      if (i === 0) await screenshot(`/tmp/worldquiz-correction-answer-${width}.png`);
      await click('#next');
    }
    assert.equal(topics.size, 2);
    assert.match(await evaluate(`document.querySelector('#correctionSummary').textContent`), /1 Fragen korrigiert. 1 offene Fragen/);
    assert.equal(await evaluate(`document.querySelector('#retry').hidden`), true);
    assert.equal(await evaluate(`document.querySelector('#highscoreResult').textContent`), '');
    await click('#newRound');
    assert.equal(await evaluate(`document.querySelector('#questionCount').textContent`), 'Frage 1/1');
    await correct();
    assert.deepEqual(await saved(), []);
    assert.equal(await evaluate(`document.querySelector('#restart').disabled`), true);
    await click('#next');
    assert.match(await evaluate(`document.querySelector('#correctionSummary').textContent`), /Alle gespeicherten Fehler korrigiert/);
    assert.equal(await evaluate(`document.querySelector('#newRound').disabled && document.querySelector('#start').disabled`), true);
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true);
    await click('#changeMode'); await click('.dialogModes [data-mode="quiz"]');
    assert.equal(await evaluate(`document.querySelector('#continent').value`), 'Europa');
    assert.equal(await evaluate(`document.querySelector('#count').value`), '5');
    // Restart samples current entries after one question has been cleared.
    await evaluate(`localStorage.setItem('worldQuizMistakes',JSON.stringify({version:1,entries:[{topic:'quiz',code:'de',streak:1},{topic:'capitals',code:'de',streak:1}]}))`);
    await cdp('Page.reload'); await ready();
    await evaluate(`document.querySelector('#autoNext').checked=false`);
    await click('[data-mode="correction"]'); await click('#start');
    await countryClick('de'); await click('#restart');
    assert.equal(await evaluate(`document.querySelector('#questionCount').textContent`), 'Frage 1/1');
    await countryClick('fr'); await click('#next');
    assert.equal((await saved())[0].streak, 0);
    assert.equal(await evaluate(`document.querySelector('#retry').hidden`), true);
    // Auto-advance commits and clears a single saved entry.
    await click('#newRound');
    await evaluate(`document.querySelector('#autoNext').checked=true`);
    await countryClick('de');
    await wait(`!document.querySelector('#results').hidden`);
    assert.equal((await saved())[0].streak, 1);
    await click('#newRound'); await countryClick('de');
    await wait(`!document.querySelector('#results').hidden`);
    assert.deepEqual(await saved(), []);
  }
}
async function capitalsRound(all = false) {
  await click('#changeMode');
  await click('.dialogModes [data-mode="capitals"]');
  await choose('continent', 'Welt');
  const total = all ? 198 : 5;
  await choose('count', String(total));
  await click('#start');
  if (!all) await waitForQuestionMap();
  if (!all) {
    // Stress the responsive prompt with the longest complete capital label.
    const original = await evaluate(`document.querySelector('#question strong').textContent`);
    await evaluate(`document.querySelector('#question strong').textContent=window.testCountries.map(c=>c.capitals.join(' · ')).sort((a,b)=>b.length-a.length)[0]`);
    await settleLayout();
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.compactCapitalPrompt')).display`), 'inline');
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true);
    assert.ok(await evaluate(`document.querySelector('#mapHost').getBoundingClientRect().height>=280`));
    await screenshot('/tmp/worldquiz-mobile-long-capital.png');
    await evaluate(`document.querySelector('#question strong').textContent=${JSON.stringify(original)}`);
    await settleLayout();
  }
  assert.match(await evaluate(`document.querySelector('#questionTopic').textContent`), /HAUPTSTÄDTE ZUORDNEN/);
  const seen = new Set();
  let missed;
  for (let i = 0; i < total; i++) {
    const prompt = await evaluate(`document.querySelector('#question strong').textContent`);
    const target = await evaluate(`window.testCountries.find(c=>c.capitals.join(' · ')===document.querySelector('#question strong').textContent)`);
    assert.ok(target, 'Prompt preserves all capitals and qualifiers');
    assert.equal(seen.has(target.code), false);
    seen.add(target.code);
    assert.equal(await evaluate(`document.querySelector('#countryInfo').hidden`), true);
    if (i === 0) {
      missed = target;
      await countryClick(target.code === 'de' ? 'fr' : 'de');
      await correct();
      assert.equal(await evaluate(`document.querySelector('#points').textContent`), '0 Punkte');
      await click('#changeMode');
      await click('.dialogModes [data-mode="capitals"]');
      assert.equal(await evaluate(`document.querySelector('#question strong').textContent`), prompt);
      assert.equal(await evaluate(`document.querySelector('#progress').value`), 1);
    } else await correct();
    const feedback = await evaluate(`document.querySelector('#feedback').textContent`);
    assert.ok(feedback.includes(target.name));
    assert.ok(feedback.includes(prompt));
    await click('#next');
  }
  if (all) assert.equal(seen.size, 198);
  assert.equal(await evaluate(`document.querySelector('#resultTitle').textContent`), `${total - 1} von ${total} richtig`);
  assert.ok((await evaluate(`document.querySelector('#mistakeList').textContent`)).includes(missed.capitals.join(' · ')));
  if (!all) {
    await click('#mistakeList button');
    await waitForInfo();
    await click('#closeInfo');
    assert.equal(await evaluate(`document.activeElement.id`), 'mapHost');
  }
  await click('#retry');
  await click('#restart');
  if (!all) assert.equal(await evaluate(`document.querySelector('.practiceTopic').getBoundingClientRect().height>0`), true);
  assert.equal(await evaluate(`document.querySelector('#question strong').textContent`), missed.capitals.join(' · '));
  assert.equal(await evaluate(`document.querySelector('#questionCount').textContent`), 'Frage 1/1');
  await evaluate(`document.querySelector('[data-country="${missed.code}"]').focus()`);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert.equal(await evaluate(`document.querySelector('#progress').value`), 1);
  await click('#next');
  assert.equal(await evaluate(`document.querySelector('#retry').hidden`), true);
  await click('#newRound');
  await click('#restart');
  assert.equal(await evaluate(`document.querySelector('#questionCount').textContent`), `Frage 1/${total}`);
  assert.match(await evaluate(`document.querySelector('#questionTopic').textContent`), /HAUPTSTÄDTE ZUORDNEN/);
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth`), true);
  await screenshot(all ? '/tmp/worldquiz-capitals-desktop.png' : '/tmp/worldquiz-capitals-mobile.png');
  await click('#changeMode');
  await click('.dialogModes [data-mode="quiz"]');
  assert.equal(await evaluate(`document.querySelector('#quizStats').hidden`), true);
}
async function checkRecords() {
  const saved = () => evaluate(`JSON.parse(localStorage.getItem('worldQuizHighscores'))?.records ?? {}`);
  const best = () => evaluate(`document.querySelector('#personalBest').textContent`);
  const ready = () => wait(`document.querySelector('#worldMap') && document.querySelector('#mapHost').getAttribute('aria-busy')==='false'`);
  await evaluate(`localStorage.removeItem('worldQuizHighscores')`);
  await cdp('Page.reload'); await ready();
  await evaluate(`(async()=>{window.testCountries=await (await fetch('assets/data/countries.json')).json();document.querySelector('#autoNext').checked=false})()`);
  await click('[data-mode="quiz"]');
  await choose('count', '5');
  assert.match(await best(), /noch keiner/);
  await click('#start');
  assert.equal(await evaluate(`document.querySelector('#resetRecords').disabled`), true);
  for (let i = 0; i < 5; i++) {
    if (i === 0) {
      const wrong = await evaluate(`window.testCountries.find(c=>c.name!==document.querySelector('#question strong').textContent).code`);
      await countryClick(wrong);
    } else await correct();
    if (i < 4) await click('#next');
  }
  assert.deepEqual(await saved(), {}, 'last answer alone does not save a record');
  await click('#next');
  assert.equal((await saved())['quiz:Welt:5'], 4);
  assert.equal(await evaluate(`document.querySelector('#highscoreResult').textContent`), 'Erster Rekord: 4/5!');
  assert.match(await evaluate(`document.querySelector('[data-mode-best="quiz"]').textContent`), /4\/5/);
  await click('#retry');
  await correct(); await click('#next');
  assert.deepEqual(await saved(), { 'quiz:Welt:5': 4 });
  assert.equal(await evaluate(`document.querySelector('#highscoreResult').textContent`), '');
  await choose('continent', 'Europa');
  assert.match(await best(), /noch keiner/);
  await choose('continent', 'Welt');
  await choose('count', '10');
  assert.match(await best(), /noch keiner/);
  await choose('count', '5');
  assert.match(await best(), /4\/5/);
  await click('#changeMode'); await click('.dialogModes [data-mode="capitals"]');
  assert.match(await best(), /noch keiner/);
  await click('#start'); await correct(); await click('#restart');
  assert.deepEqual(await saved(), { 'quiz:Welt:5': 4 }, 'abandoned and restarted rounds do not save');
  await choose('continent', 'Europa');
  await click('#start');
  for (let i = 0; i < 5; i++) { await correct(); await click('#next'); }
  assert.equal((await saved())['capitals:Europa:5'], 5);
  // The existing auto-advance path must commit the final answer exactly once.
  await click('#newRound');
  for (let i = 0; i < 4; i++) { await correct(); await click('#next'); }
  await evaluate(`document.querySelector('#autoNext').checked=true`);
  await correct();
  await wait(`!document.querySelector('#results').hidden`);
  assert.equal(await evaluate(`document.querySelector('#highscoreResult').textContent`), 'Rekord eingestellt: 5/5!');
  await cdp('Page.reload'); await ready();
  await click('[data-mode="quiz"]'); await choose('count', '5');
  assert.match(await best(), /4\/5/);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 667, deviceScaleFactor: 1, mobile: true });
  await click('#resetRecords');
  assert.equal(await evaluate(`document.activeElement.id`), 'cancelResetRecords');
  assert.equal(await evaluate(`document.querySelector('#resetRecordsDialog').scrollWidth<=document.querySelector('#resetRecordsDialog').clientWidth`), true);
  await screenshot('/tmp/worldquiz-records-mobile.png');
  await click('#cancelResetRecords');
  await wait(`document.activeElement.id==='resetRecords'`);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  assert.equal((await saved())['quiz:Welt:5'], 4);
  await click('#resetRecords');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await wait(`!document.querySelector('#resetRecordsDialog').open`);
  assert.equal((await saved())['quiz:Welt:5'], 4);
  // A failed reset keeps the dialog open and both copies intact.
  await evaluate(`window.originalRemove=Storage.prototype.removeItem;Storage.prototype.removeItem=function(k){if(k==='worldQuizHighscores')throw Error('blocked');return window.originalRemove.call(this,k)};window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='worldQuizHighscores')throw Error('blocked');return window.originalSet.call(this,k,v)}`);
  await click('#resetRecords'); await click('#resetRecordsForm button[type="submit"]');
  assert.equal(await evaluate(`document.querySelector('#resetRecordsDialog').open`), true);
  assert.match(await evaluate(`document.querySelector('#resetRecordsError').textContent`), /nicht zurückgesetzt/);
  assert.equal((await saved())['quiz:Welt:5'], 4);
  await evaluate(`Storage.prototype.removeItem=window.originalRemove;Storage.prototype.setItem=window.originalSet`);
  await click('#resetRecordsForm button[type="submit"]');
  assert.deepEqual(await saved(), { 'capitals:Europa:5': 5 });
  await click('#resetRecords');
  assert.equal(await evaluate(`document.querySelector('#resetSelectedRecord').disabled && document.querySelector('#resetAllRecords').checked`), true);
  await click('#resetRecordsForm button[type="submit"]');
  assert.deepEqual(await saved(), {});
  assert.equal(await evaluate(`document.querySelector('#resetRecords').disabled`), true);
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window, 'localStorage', { configurable:true, get(){throw Error('blocked storage')} })` }).then(async ({identifier}) => {
    await cdp('Page.reload'); await ready();
    await click('[data-mode="quiz"]');
    assert.match(await evaluate(`document.querySelector('#highscoreStorage').textContent`), /für diese Sitzung/);
    await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  });
  await cdp('Page.reload'); await ready();
  await evaluate(`(async()=>{window.testCountries=await (await fetch('assets/data/countries.json')).json()})()`);
}
async function screenshot(path) {
  const response = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path, Buffer.from(response.data, 'base64'));
}
async function checkFooterHelp() {
  assert.equal(await evaluate(`document.querySelectorAll('footer .mapHelp,footer .mapLegend').length===2 && !document.querySelector('.mapWrap .mapHelp,.mapWrap .mapLegend')`), true);
  assert.equal(await evaluate(`document.querySelector('.mapHelp').open`), false);
  const mapHeight = await evaluate(`document.querySelector('.mapWrap').getBoundingClientRect().height`);
  await evaluate(`document.querySelector('.mapHelp').open=true`);
  await settleLayout();
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true);
  assert.equal(await evaluate(`document.querySelector('.mapWrap').getBoundingClientRect().height`), mapHeight);
  await evaluate(`document.querySelector('.mapHelp').open=false`);
}
try {
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Network.enable');
  await cdp('Network.setCacheDisabled', { cacheDisabled: true });
  // Exercise the current build; the separate PWA suite verifies cached versions.
  await cdp('Network.setBypassServiceWorker', { bypass: true });
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: base });
  await wait(`document.querySelector('#worldMap') && document.querySelector('#mapHost').getAttribute('aria-busy')==='false'`);
  if (process.argv.includes('--rivers-only')) {
    await checkRivers();
  } else {
  await checkFooterHelp();
  await evaluate(`(async()=>{window.testCountries=await (await fetch('assets/data/countries.json')).json()})()`);
  await checkRecords();
  assert.equal(await evaluate(`document.querySelectorAll('#worldMap [data-country]').length>=198`), true);
  for (const [code, name] of [['xk', 'Kosovo'], ['tw', 'Taiwan'], ['eh', 'Westsahara']]) {
    await evaluate(`(()=>{
      const target=document.querySelector('path[data-country="${code}"]');
      target.focus();
      target.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    })()`);
    assert.equal(await evaluate(`document.querySelector('#countryName').textContent`), name);
    await wait(`document.querySelector('#flag').complete && document.querySelector('#flag').naturalWidth>0`);
    assert.equal(await evaluate(`document.querySelector('#flag').getAttribute('src')`), `assets/flags/${code}.svg`);
  }
  await countryClick('fr');
  assert.equal(await evaluate(`document.querySelector('#countryName').textContent`), 'Frankreich');
  await wait(`document.querySelector('#flag').complete && document.querySelector('#flag').naturalWidth>0`);
  await screenshot('/tmp/worldquiz-desktop.png');
  // A missing flag must leave the rest of the profile usable.
  await cdp('Network.setBlockedURLs', { urls: ['*assets/flags/de.svg'] });
  await countryClick('de');
  await wait(`!document.querySelector('#flagFallback').hidden`);
  assert.equal(await evaluate(`document.querySelector('#capital').textContent`), 'Berlin');
  assert.equal(await evaluate(`document.querySelector('#population').textContent`), 'ca. 83.132.799 (2019)');
  await cdp('Network.setBlockedURLs', { urls: [] });
  await countryClick('va');
  assert.equal(await evaluate(`document.querySelector('#countryName').textContent`), 'Vatikanstadt');
  assert.equal(await evaluate(`document.querySelector('#population').textContent`), 'ca. 825 (2019)');
  await click('#closeInfo');
  await click('[data-mode="quiz"]');
  for (const continent of ['Afrika', 'Asien', 'Europa', 'Nordamerika', 'Südamerika', 'Ozeanien']) {
    await choose('continent', continent);
    const hidden = await evaluate(`(()=>{const v=document.querySelector('#worldMap').viewBox.baseVal;return window.testCountries.filter(c=>c.continent===${JSON.stringify(continent)}).filter(c=>c.anchor[0]<v.x||c.anchor[0]>v.x+v.width||c.anchor[1]<v.y||c.anchor[1]>v.y+v.height).map(c=>c.code)})()`);
    assert.deepEqual(hidden, [], `${continent}: all target anchors must remain in view`);
  }
  await choose('continent', 'Europa');
  assert.match(await evaluate(`document.querySelector('#poolSummary').textContent`), /Länder im Fragenpool/);
  await choose('count', '5');
  await click('#start');
  assert.equal(await evaluate(`document.querySelector('#countryInfo').hidden`), true);
  assert.equal(await evaluate(`document.querySelector('#modeCards').hidden`), true);
  assert.match(await evaluate(`document.querySelector('#questionCount').textContent`), /1\/5/);
  // Context areas never submit answers.
  await evaluate(`document.querySelector('.context').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
  assert.equal(await evaluate(`document.querySelector('#next').hidden`), true);
  const target = await evaluate(`document.querySelector('#question strong').textContent`);
  const wrong = await evaluate(`window.testCountries.find(c=>c.name!==document.querySelector('#question strong').textContent).code`);
  await countryClick(wrong);
  assert.match(await evaluate(`document.querySelector('#feedback').textContent`), /Deine Antwort:/);
  assert.equal(await evaluate(`document.querySelector('#countryName').textContent`), target);
  assert.equal(await evaluate(`document.querySelector('#progress').value`), 1);
  await correct();
  assert.match(await evaluate(`document.querySelector('#points').textContent`), /^0 Punkte$/);
  // Closing the mode chooser preserves the current question and response.
  await click('#changeMode');
  await click('#closeDialog');
  assert.equal(await evaluate(`document.querySelector('#question strong').textContent`), target);
  assert.equal(await evaluate(`document.querySelector('#progress').value`), 1);
  for (let i = 1; i < 5; i++) { await click('#next'); await correct(); }
  assert.equal(await evaluate(`document.querySelector('#progress').value`), 5);
  assert.equal(await evaluate(`document.querySelector('#results').hidden`), true);
  await click('#next');
  assert.match(await evaluate(`document.querySelector('#resultTitle').textContent`), /^4 von 5/);
  assert.equal(await evaluate(`document.querySelectorAll('#mistakeList li').length`), 1);
  await click('#retry');
  assert.match(await evaluate(`document.querySelector('#questionCount').textContent`), /1\/1/);
  await correct(); await click('#next');
  assert.equal(await evaluate(`document.querySelector('#retry').hidden`), true);
  assert.match(await evaluate(`document.querySelector('#resultMessage').textContent`), /Alle Fehler geschafft/);
  await click('#newRound');
  assert.match(await evaluate(`document.querySelector('#questionCount').textContent`), /1\/5/);
  // Actual mouse movement must pan without registering a country answer.
  const rect = await evaluate(`(()=>{const r=document.querySelector('#worldMap').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y });
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x + 80, y: rect.y + 20, button: 'left', buttons: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x + 80, y: rect.y + 20, button: 'left', clickCount: 1 });
  assert.equal(await evaluate(`document.querySelector('#progress').value`), 0);
  // Keyboard country selection works immediately after dragging.
  await evaluate(`document.querySelector('[data-country="de"]').focus()`);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert.equal(await evaluate(`document.querySelector('#progress').value`), 1);
  await choose('continent', 'Welt');
  assert.equal(await evaluate(`document.querySelector('#quizStats').hidden`), true);
  await click('#resetMap');
  await evaluate(`document.querySelector('#mapHost').focus()`);
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: '+', code: 'Equal' });
  assert.notEqual(await evaluate(`document.querySelector('#zoomPercentage').textContent`), '100 %');
  for (let i = 0; i < 20; i++) await click('#zoomIn');
  assert.equal(await evaluate(`document.querySelector('#zoomPercentage').textContent`), '3200 %');
  const diameter = await evaluate(`document.querySelector('.marker-dot').getBoundingClientRect().width`);
  assert.ok(diameter > 6 && diameter < 8, `Marker screen diameter ${diameter}`);
  await click('#resetMap');
  await capitalsRound(true);
  // Mobile layout and touch map gestures.
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await cdp('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
  // Load in the mobile configuration, as a phone would, so Chromium rebuilds
  // compositor touch-handler regions after the desktop viewport tests.
  await cdp('Page.navigate', { url: base });
  await wait(`document.querySelector('#worldMap') && document.querySelector('#mapHost').getAttribute('aria-busy')==='false'`);
  await evaluate(`(async()=>{window.testCountries=await (await fetch('assets/data/countries.json')).json()})()`);
  // Match BayernQuiz: details remain inline and scroll into the visible viewport.
  await click('#start');
  await evaluate(`document.querySelector('#mapHost').scrollIntoView({block:'start'})`);
  for (const [width, height] of [[320, 667], [390, 844], [375, 667], [844, 390]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await settleLayout();
    const mobileZoom = await evaluate(`document.querySelector('#worldMap').getAttribute('viewBox')`);
    await countryClick('de');
    await waitForInfo();
    assert.equal(await evaluate(`document.querySelector('#countryInfo').parentElement.className`), 'sidebar');
    assert.equal(await evaluate(`document.querySelector('dialog[open]')===null`), true);
    assert.equal(await evaluate(`getComputedStyle(document.documentElement).overflow!=='hidden'`), true);
    assert.equal(await evaluate(`document.querySelector('#worldMap').getAttribute('viewBox')`), mobileZoom);
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true);
    assert.equal(await evaluate(`(()=>{const label=document.querySelector('#population').previousElementSibling;return label.getBoundingClientRect().height<=parseFloat(getComputedStyle(label).lineHeight)+1})()`), true, 'Population label fits on one line');
    for (const code of ['cn', 'za', 'bo', 'va']) {
      await countryClick(code);
      assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true, `${code}: no horizontal overflow`);
      assert.equal(await evaluate(`document.querySelector('#population').textContent`), await evaluate(`(()=>{const c=window.testCountries.find(c=>c.code==='${code}');return 'ca. '+new Intl.NumberFormat('de-DE').format(c.population)+' ('+c.populationYear+')'})()`));
    }
    if (width === 320 || width === 390) await screenshot(`/tmp/worldquiz-population-${width}.png`);
  }
  // Tall cards align their beginning; reduced motion uses immediate scrolling.
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await countryClick('fr');
  await evaluate(`document.querySelector('#fact').textContent='Lange Länderinformationen. '.repeat(100)`);
  await waitForInfo();
  assert.equal(await evaluate(`document.querySelector('#countryInfo').getBoundingClientRect().height>innerHeight`), true);
  await click('#closeInfo');
  assert.equal(await evaluate(`document.activeElement.id`), 'mapHost');
  assert.equal(await evaluate(`document.querySelector('#countryInfo').hidden`), true);
  await cdp('Emulation.setEmulatedMedia', { features: [] });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await click('[data-mode="quiz"]');
  await choose('count', '5');
  await click('#start');
  await waitForQuestionMap();
  assert.equal(await evaluate(`document.querySelector('#settings').open`), false);
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth`), true);
  for (const [width, height] of [[320, 667], [375, 667], [390, 844]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await click('#restart');
    await waitForQuestionMap();
    const layout = await evaluate(`(()=>{
      const map=document.querySelector('#mapHost').getBoundingClientRect();
      const controls=document.querySelector('.mapToolbar').getBoundingClientRect();
      return {mapHeight:map.height,mapTop:map.top,mapBottom:map.bottom,controlsTop:controls.top,
        controlsBottom:controls.bottom,viewport:visualViewport.height,
        overflow:document.documentElement.scrollWidth>innerWidth,
        touchTargets:[...document.querySelectorAll('.mapToolbar button,#restart')].every(b=>b.getBoundingClientRect().height>=44)};
    })()`);
    assert.ok(layout.mapHeight >= height * .6, `${width}: map uses at least 60% of viewport (${layout.mapHeight}px)`);
    assert.ok(layout.mapTop >= 0 && layout.controlsBottom <= layout.viewport, `${width}: map and controls fit on screen`);
    assert.ok(layout.controlsBottom <= layout.mapTop, `${width}: controls stay above the map`);
    assert.equal(layout.overflow, false);
    assert.equal(layout.touchTargets, true);
    await checkFooterHelp();
    await screenshot(`/tmp/worldquiz-compact-${width}.png`);
  }
  await cdp('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  await click('#restart');
  await waitForQuestionMap();
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#questionBar')).position`), 'static');
  assert.equal(await evaluate(`document.documentElement.scrollHeight>innerHeight && document.documentElement.scrollWidth<=innerWidth`), true);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await click('#restart');
  await waitForQuestionMap();
  await screenshot('/tmp/worldquiz-mobile.png');
  // Use the upper part of the map so the gesture stays inside Chromium's
  // headless input surface as well as the emulated phone viewport.
  const touch = await evaluate(`(()=>{const r=document.querySelector('#worldMap').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+45}})()`);
  await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touch.x - 25, y: touch.y, id: 0 }, { x: touch.x + 25, y: touch.y, id: 1 }] });
  await new Promise(resolve => setTimeout(resolve, 80));
  await cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touch.x - 70, y: touch.y, id: 0 }, { x: touch.x + 70, y: touch.y, id: 1 }] });
  await new Promise(resolve => setTimeout(resolve, 80));
  await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await evaluate(`document.querySelector('#progress').value`), 0);
  await wait(`document.querySelector('#zoomPercentage').textContent!=='100 %'`);
  await correct();
  await screenshot('/tmp/worldquiz-mobile-answer.png');
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=window.innerWidth`), true);
  await capitalsRound();
  await checkCorrections();
  await flagsRound(1440);
  await flagsRound(320);
  await populationRound(1440);
  await populationRound(320);
  await checkRivers();
  for (const width of [1440, 320]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 600 });
    await checkMountainRound({ evaluate, click, cdp });
    await checkMixedRound({ evaluate, click });
  }
  }
  assert.deepEqual(exceptions, []);
  assert.deepEqual(failures, []);
  assert.ok(requests.every(url => url.startsWith(new URL(base).origin) || url.startsWith('data:')), 'No external API or image requests');
  if (process.argv.includes('--rivers-only')) {
    console.log('River browser checks passed: regional pools, exploration, scoring, records, retry, mixed corrections, keyboard, overlap, mouse, touch, drag, pinch, desktop/mobile, local requests.');
    console.log('Screenshots: /tmp/worldquiz-rivers-1440.png, /tmp/worldquiz-rivers-320.png, /tmp/worldquiz-rivers-390.png');
  } else {
    console.log('Browser checks passed: profiles, flag fallback, country/capitals/flag/population/river/mountain/mixed quizzes, all 198 capital prompts, scoring, practice, saved corrections, records, reset dialogs, keyboard, drag, pinch, desktop/mobile, local requests.');
    console.log('Screenshots: /tmp/worldquiz-desktop.png, /tmp/worldquiz-mobile.png, /tmp/worldquiz-mobile-answer.png, /tmp/worldquiz-rivers-320.png');
  }
} finally {
  ws.close();
}
