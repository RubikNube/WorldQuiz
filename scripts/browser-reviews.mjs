import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

export async function checkReviews({ evaluate, click, cdp, wait }) {
  const now = Date.UTC(2026, 0, 1), day = 86400000;
  const script = await cdp('Page.addScriptToEvaluateOnNewDocument', { source:
    `window.reviewTestNow=${now};Date.now=()=>window.reviewTestNow;` });
  const ready = () => wait(`document.querySelector('#worldMap') && !document.querySelector('#openProgress').disabled`);
  try {
    for (const width of [1440, 320]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 320 });
      await evaluate(`localStorage.setItem('worldQuizMistakes',JSON.stringify({version:2,entries:[
        {topic:'quiz',code:'de',status:'correction',streak:1},
        {topic:'capitals',code:'de',status:'review',stage:0,dueAt:${now - day}},
        {topic:'flags',code:'fr',status:'review',stage:6,dueAt:${now}},
        {topic:'population',code:'de',status:'review',stage:0,dueAt:${now + 2 * day}}
      ]}))`);
      await cdp('Page.reload'); await ready();
      await evaluate(`document.querySelector('#autoNext').checked=false`);
      assert.equal(await evaluate(`document.querySelector('#correctionCount').textContent`), '1 offene Fehler · 2 Wiederholungen fällig');
      await click('#openProgress');
      assert.equal(await evaluate(`document.querySelectorAll('#progressErrors li').length`), 1);
      assert.equal(await evaluate(`document.querySelectorAll('#progressReviews li').length`), 3);
      await evaluate(`document.querySelector('#progressTopic').value='flags';document.querySelector('#progressTopic').dispatchEvent(new Event('change'))`);
      assert.match(await evaluate(`document.querySelector('#progressReviews').textContent`), /6 von 7 Wiederholungen geschafft · Fällig seit/);
      assert.equal(await evaluate(`document.querySelectorAll('#progressErrors li').length`), 0);
      await evaluate(`document.querySelector('#progressReviews').scrollIntoView({block:'center'})`);
      const screenshot = await cdp('Page.captureScreenshot', { format: 'png' });
      await writeFile(`/tmp/worldquiz-reviews-${width}.png`, Buffer.from(screenshot.data, 'base64'));
      await click('#progressCorrect');
      await click('#start');
      const feedback = [];
      for (let i = 0; i < 3; i++) {
        const flags = await evaluate(`!document.querySelector('#questionFlagFrame').hidden`);
        const code = flags ? 'fr' : 'de';
        await evaluate(`document.querySelector('[data-country="${code}"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
        feedback.push(await evaluate(`document.querySelector('#correctionProgress').textContent`));
        await click('#next');
      }
      assert.ok(feedback.some(s => s.startsWith('Fehler korrigiert! Wiederholung am')));
      assert.ok(feedback.some(s => s.startsWith('Wiederholung geschafft! Nächster Termin:')));
      assert.ok(feedback.includes('Geschafft! Aus der Wiederholungsliste entfernt.'));
      assert.match(await evaluate(`document.querySelector('#correctionSummary').textContent`), /1 Fragen korrigiert\. 2 erfolgreiche Wiederholungen, davon 1 abgeschlossen/);
      assert.equal(await evaluate(`document.querySelector('#newRound').disabled`), true);
      assert.match(await evaluate(`document.querySelector('#poolSummary').textContent`), /Nächste Wiederholung am/);
      assert.equal(await evaluate(`document.querySelector('#highscoreResult').textContent`), '');
      // Reload retains schedules and graduation, with nothing currently due.
      await cdp('Page.reload'); await ready();
      await click('[data-mode="correction"]');
      assert.equal(await evaluate(`document.querySelector('#start').disabled`), true);
      assert.equal(await evaluate(`JSON.parse(localStorage.getItem('worldQuizMistakes')).entries.length`), 3);
      // The production clock captured our wrapper at startup. Visibility refresh
      // must make the newly due question available without requiring reload.
      await evaluate(`window.reviewTestNow=${now + day};document.dispatchEvent(new Event('visibilitychange'))`);
      assert.equal(await evaluate(`document.querySelector('#start').disabled`), false);
      await click('#start');
      assert.equal(await evaluate(`document.querySelector('#questionCount').textContent`), 'Frage 1/1');
      await evaluate(`window.reviewTestNow=${now + 10 * day};document.dispatchEvent(new Event('visibilitychange'))`);
      assert.equal(await evaluate(`document.querySelector('#questionCount').textContent`), 'Frage 1/1', 'newly due questions do not enter an active round');
      await evaluate(`document.querySelector('#autoNext').checked=false;document.querySelector('[data-country="de"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))`);
      await click('#next');
      assert.equal(await evaluate(`JSON.parse(localStorage.getItem('worldQuizMistakes')).entries.find(e=>e.topic==='quiz').dueAt`), now + 13 * day);
      await click('#openProgress');
      assert.equal(await evaluate(`document.querySelectorAll('#progressReviews li').length`), 3);
      assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true);
      await click('#closeProgress');
    }
  } finally {
    await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.identifier });
    await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await cdp('Page.reload'); await ready();
  }
}
