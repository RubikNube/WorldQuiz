import assert from 'node:assert/strict';

// Shared by desktop/mobile and offline root/subdirectory smoke checks.
export async function checkMountainRound({ evaluate, click, cdp }) {
  await click('[data-mode="mountain"]');
  await evaluate(`(()=>{
    const region=document.querySelector('#continent');region.value='Europa';region.dispatchEvent(new Event('change'));
    const count=document.querySelector('#count');count.value='5';count.dispatchEvent(new Event('change'));
    document.querySelector('#autoNext').checked=false;
  })()`);
  assert.equal(await evaluate(`document.querySelector('#poolSummary').textContent`), '8 Berge im Fragenpool');
  await evaluate(`document.querySelector('[data-mountain="mountain-zugspitze"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
  assert.equal(await evaluate(`document.querySelector('#countryName').textContent`), 'Zugspitze');
  assert.equal(await evaluate(`document.querySelector('#mountainElevation').textContent`), 'ca. 2.962 m');
  await click('#start');
  let missed;
  for (let index = 0; index < 5; index++) {
    const q = await evaluate(`(async()=>{
      const peaks=await(await fetch('assets/data/mountains.json')).json();
      const target=peaks.find(m=>m.name===document.querySelector('#question strong').textContent);
      return {code:target.code,name:target.name,wrong:peaks.find(m=>m.continent==='Europa'&&m.code!==target.code).code};
    })()`);
    if (!index) missed = q.code;
    assert.equal(await evaluate(`document.querySelector('#worldMap').classList.contains('mountain-mode') && document.querySelector('#riversLayer').hasAttribute('hidden') && [...document.querySelectorAll('[data-country],[data-river]')].every(n=>n.tabIndex===-1)`), true);
    // Country selections cannot submit or reveal profiles during a mountain question.
    await evaluate(`document.querySelector('[data-country="de"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
    assert.equal(await evaluate(`Number(document.querySelector('#progress').value)`), index);
    if (index === 1 && cdp) {
      // Zoom and focus before selecting the actual summit with mouse/touch.
      for (let i = 0; i < 20; i++) await click('#zoomIn');
      const point = await evaluate(`(()=>{
        const node=document.querySelector('[data-mountain="${q.code}"]');node.focus();
        const p=new DOMPoint(Number(node.dataset.anchorX),Number(node.dataset.anchorY)).matrixTransform(document.querySelector('#worldMap').getScreenCTM());
        return {x:p.x,y:p.y,mobile:innerWidth<600};
      })()`);
      await evaluate(`document.querySelector('.mapWrap').scrollIntoView({block:'center',behavior:'instant'})`);
      const position = await evaluate(`(()=>{
        const n=document.querySelector('[data-mountain="${q.code}"]');
        const p=new DOMPoint(Number(n.dataset.anchorX),Number(n.dataset.anchorY)).matrixTransform(document.querySelector('#worldMap').getScreenCTM());return {x:p.x,y:p.y};
      })()`);
      if (point.mobile) {
        await cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
        await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [position] });
        await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp('Emulation.setTouchEmulationEnabled', { enabled: false });
      } else {
        await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...position, button: 'left', clickCount: 1 });
        await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...position, button: 'left', clickCount: 1 });
      }
    } else {
      const code = index ? q.code : q.wrong;
      await evaluate(`(()=>{const n=document.querySelector('[data-mountain="${code}"]');n.focus();n.dispatchEvent(new KeyboardEvent('keydown',{key:'${index % 2 ? ' ' : 'Enter'}',bubbles:true}));})()`);
    }
    assert.equal(await evaluate(`Number(document.querySelector('#progress').value)`), index + 1);
    assert.equal(await evaluate(`document.querySelector('#countryName').textContent`), q.name);
    assert.equal(await evaluate(`document.querySelector('#mountainDetails').hidden`), false);
    await click('#next');
  }
  assert.equal(await evaluate(`document.querySelector('#resultTitle').textContent`), '4 von 5 richtig');
  assert.equal(await evaluate(`document.querySelectorAll('#mistakeList li').length`), 1);
  const before = await evaluate(`localStorage.getItem('worldQuizHighscores')`);
  assert.ok(JSON.parse(before).records['mountain:Europa:5'] >= 4);
  await click('#retry');
  await evaluate(`document.querySelector('[data-mountain="${missed}"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`);
  await click('#next');
  assert.equal(await evaluate(`document.querySelector('#resultTitle').textContent`), '1 von 1 richtig');
  assert.equal(await evaluate(`localStorage.getItem('worldQuizHighscores')`), before);
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true);
}
