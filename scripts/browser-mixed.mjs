import assert from 'node:assert/strict';
import { checkMountainPhoto } from './browser-mountains.mjs';

// Shared by online desktop/mobile and offline root/subdirectory smoke checks.
export async function checkMixedRound({ evaluate, click }) {
  await click('[data-mode="mixed"]');
  await evaluate(`(()=>{
    for(const [id,value] of [['continent','Europa'],['count','10']]) {
      const field=document.getElementById(id);field.value=value;field.dispatchEvent(new Event('change'));
    }
    document.querySelector('#autoNext').checked=false;
  })()`);
  await click('#start');
  const seen = new Set(), targets = new Set();
  async function current() {
    return evaluate(`(async()=>{
      const countries=await(await fetch('assets/data/countries.json')).json();
      const rivers=await(await fetch('assets/data/rivers.json')).json();
      const mountains=await(await fetch('assets/data/mountains.json')).json();
      const label=document.querySelector('#questionTopic').textContent;
      const topic=label.includes('EINWOHNERZAHL')?'population':label.includes('FLÜSSE FINDEN')?'river':label.includes('BERGE FINDEN')?'mountain':label.includes('FLAGGENQUIZ')?'flags':label.includes('HAUPTSTÄDTE')?'capitals':'quiz';
      const strong=document.querySelector('#question strong')?.textContent;
      const target=topic==='mountain'?mountains.find(q=>q.name===strong):topic==='river'?rivers.find(q=>q.name===strong):countries.find(q=>topic==='flags'?q.flag===document.querySelector('#questionFlag').getAttribute('src'):topic==='capitals'?q.capitals.join(' · ')===strong:q.name===strong);
      return {topic,code:target.code,layer:document.querySelector('#worldMap').classList.contains('river-mode'),mountainLayer:document.querySelector('#worldMap').classList.contains('mountain-mode'),population:!document.querySelector('#populationChoices').hidden};
    })()`);
  }
  async function respond(q, correct) {
    await evaluate(`(async()=>{
      const q=${JSON.stringify(q)},correct=${correct};
      const pool=await(await fetch(q.topic==='mountain'?'assets/data/mountains.json':q.topic==='river'?'assets/data/rivers.json':'assets/data/countries.json')).json();
      const target=pool.find(c=>c.code===q.code);
      if(q.topic==='population') {
        const right=Number(target.population.toPrecision(2));
        [...document.querySelectorAll('#populationChoices button')].find(b=>(Number(b.dataset.population)===right)===correct).click();
      } else {
        const code=correct?q.code:pool.find(c=>c.code!==q.code).code;
        document.querySelector('[data-'+(q.topic==='mountain'?'mountain':q.topic==='river'?'river':'country')+'="'+code+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
      }
    })()`);
    if (q.topic === 'mountain') await checkMountainPhoto(evaluate, q.code);
    else assert.equal(await evaluate(`document.querySelector('#mountainImage').hidden && !document.querySelector('#mountainImage').hasAttribute('src')`), true);
  }
  for (let index = 0; index < 10; index++) {
    const q = await current();
    assert.equal(q.layer, q.topic === 'river');
    assert.equal(q.mountainLayer, q.topic === 'mountain');
    assert.equal(q.population, q.topic === 'population');
    assert.equal(targets.has(q.code), false);
    targets.add(q.code);
    const correct = seen.has(q.topic);
    seen.add(q.topic);
    await respond(q, correct);
    assert.equal(await evaluate(`Number(document.querySelector('#progress').value)`), index + 1);
    await click('#next');
  }
  assert.equal(seen.size, 6);
  assert.equal(await evaluate(`document.querySelector('#resultTitle').textContent`), '4 von 10 richtig');
  assert.equal(await evaluate(`document.querySelectorAll('#mistakeList li').length`), 6);
  // Opening a river result must switch back to the river layer.
  await evaluate(`[...document.querySelectorAll('#mistakeList button')].find(b=>b.textContent.startsWith('Flüsse finden:')).click()`);
  assert.equal(await evaluate(`document.querySelector('#worldMap').classList.contains('river-mode')`), true);
  await evaluate(`[...document.querySelectorAll('#mistakeList button')].find(b=>b.textContent.startsWith('Berge finden:')).click()`);
  assert.equal(await evaluate(`document.querySelector('#worldMap').classList.contains('mountain-mode') && !document.querySelector('#mountainDetails').hidden`), true);
  const before = await evaluate(`localStorage.getItem('worldQuizHighscores')`);
  assert.ok(JSON.parse(before).records['mixed:Europa:10'] >= 4);
  await click('#retry');
  const retryTopics = new Set();
  for (let index = 0; index < 6; index++) {
    const q = await current();
    assert.ok(targets.has(q.code));
    assert.equal(q.layer, q.topic === 'river');
    assert.equal(q.mountainLayer, q.topic === 'mountain');
    retryTopics.add(q.topic);
    await respond(q, true);
    await click('#next');
  }
  assert.equal(retryTopics.size, 6);
  assert.equal(await evaluate(`document.querySelector('#resultTitle').textContent`), '6 von 6 richtig');
  assert.equal(await evaluate(`localStorage.getItem('worldQuizHighscores')`), before);
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true);
}
