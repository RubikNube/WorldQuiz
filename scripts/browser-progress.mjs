import assert from 'node:assert/strict';

export async function checkProgress({ evaluate, click, cdp, wait }) {
  await evaluate(`localStorage.removeItem('worldQuizProgress');localStorage.removeItem('worldQuizMistakes')`);
  await cdp('Page.reload');
  await wait(`document.querySelector('#worldMap') && !document.querySelector('#openProgress').disabled`);
  await click('#openProgress');
  assert.equal(await evaluate(`document.querySelector('#learningProgressDialog').open`), true);
  assert.equal(await evaluate(`document.querySelector('#progressEmpty').hidden`), false);
  assert.equal(await evaluate(`document.querySelector('#progressMetrics dd').textContent`), '0');
  await click('#closeProgress');
  await wait(`document.activeElement.id==='openProgress'`);
  await click('[data-mode="quiz"]');
  await evaluate(`(()=>{
    for(const [id,value] of [['continent','Europa'],['count','5']]) {
      const field=document.getElementById(id);field.value=value;field.dispatchEvent(new Event('change'));
    }
    document.querySelector('#autoNext').checked=true;
  })()`);
  await click('#start');
  async function respond(correct) {
    await evaluate(`(async()=>{
      const countries=await(await fetch('assets/data/countries.json')).json();
      const name=document.querySelector('#question strong').textContent;
      const target=countries.find(c=>(c.name===name)===${correct});
      document.querySelector('[data-country="'+target.code+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    })()`);
  }
  await respond(true);
  await click('#openProgress');
  assert.equal(await evaluate(`document.querySelector('#progressCorrect').disabled`), true);
  await evaluate(`new Promise(resolve=>setTimeout(resolve,1800))`);
  assert.equal(await evaluate(`document.querySelector('#questionCount').textContent`), 'Frage 1/5');
  assert.equal(await evaluate(`document.querySelector('#progressMetrics dd').textContent`), '1');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await wait(`!document.querySelector('#learningProgressDialog').open && document.activeElement.id==='openProgress'`);
  await evaluate(`document.querySelector('#autoNext').checked=false`);
  await click('#next');
  for (let index = 1; index < 5; index++) {
    await respond(index !== 1);
    await click('#next');
  }
  await click('#openProgress');
  const metrics = await evaluate(`[...document.querySelectorAll('#progressMetrics dd')].map(e=>e.textContent)`);
  assert.equal(metrics[0], '5');
  assert.equal(metrics[1], '80 % (4/5)');
  assert.equal(await evaluate(`document.querySelectorAll('#progressRounds li').length`), 1);
  assert.equal(await evaluate(`document.querySelectorAll('#progressErrors li').length`), 1);
  await evaluate(`document.querySelector('#progressTopic').value='flags';document.querySelector('#progressTopic').dispatchEvent(new Event('change'))`);
  assert.equal(await evaluate(`document.querySelector('#progressMetrics dd').textContent`), '0');
  assert.equal(await evaluate(`document.querySelector('#progressRoundsEmpty').hidden`), false);
  assert.equal(await evaluate(`document.querySelector('#continent').value`), 'Europa');
  await evaluate(`document.querySelector('#progressTopic').value='quiz';document.querySelector('#progressTopic').dispatchEvent(new Event('change'))`);
  await evaluate(`document.querySelector('#progressRegion').value='Asien';document.querySelector('#progressRegion').dispatchEvent(new Event('change'))`);
  assert.equal(await evaluate(`document.querySelector('#progressMetrics dd').textContent`), '0');
  await evaluate(`document.querySelector('#progressRegion').value='Europa';document.querySelector('#progressRegion').dispatchEvent(new Event('change'))`);
  assert.equal(await evaluate(`document.querySelector('#progressMetrics dd').textContent`), '5');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate(`(()=>{
    const dialog=document.querySelector('#learningProgressDialog'),rect=dialog.getBoundingClientRect();
    return rect.left>=0 && rect.right<=innerWidth && dialog.scrollWidth<=dialog.clientWidth && document.documentElement.scrollWidth<=innerWidth;
  })()`), true);
  await cdp('Page.captureScreenshot', { format: 'png' }).then(async result => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile('/tmp/worldquiz-progress-mobile.png', Buffer.from(result.data, 'base64'));
  });
  await click('#progressCorrect');
  assert.equal(await evaluate(`document.querySelector('#modeName').textContent`), 'Fehler & Wiederholen');
  assert.equal(await evaluate(`document.querySelector('#quizStats').hidden`), true, 'select correction without starting it');
  await click('#start');
  await respond(true);
  await click('#openProgress');
  assert.equal(await evaluate(`document.querySelector('#progressMetrics dd').textContent`), '6');
  assert.equal(await evaluate(`document.querySelectorAll('#progressMetrics dd')[3].textContent`), '5 / 1');
  assert.match(await evaluate(`document.querySelector('#progressErrors').textContent`), /1 von 2 richtig/);
  await cdp('Page.reload');
  await wait(`document.querySelector('#worldMap') && !document.querySelector('#openProgress').disabled`);
  await click('#openProgress');
  assert.equal(await evaluate(`document.querySelector('#progressMetrics dd').textContent`), '6');
  assert.equal(await evaluate(`document.querySelectorAll('#progressRounds li').length`), 1, 'unfinished practice is not a completed round');
  await click('#closeProgress');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
}
