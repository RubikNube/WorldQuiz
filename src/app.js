import { createMistakes } from './mistakes.js';
import { createHighscores, highscoreMessage } from './highscores.js';
import { eligibleCountries, allowedCounts, createGame, createCorrectionGame, questionTopic, currentQuestion, answer, answerPopulation, roundedPopulation, nextQuestion, score, mistakes, retryGame } from './game.js';
import { createMapZoom } from './map-zoom.js';

const $ = id => document.getElementById(id);
const names = { learn: 'Lernen', quiz: 'Länder finden', capitals: 'Hauptstädte zuordnen', flags: 'Flaggenquiz', population: 'Einwohnerzahl', correction: 'Fehler korrigieren' };
const regionBounds = {
  Afrika: { x: 465, y: 155, width: 315, height: 310 },
  Asien: { x: 650, y: 25, width: 525, height: 355 },
  Europa: { x: 490, y: 18, width: 245, height: 190 },
  Nordamerika: { x: 85, y: 30, width: 390, height: 285 },
  Südamerika: { x: 260, y: 275, width: 265, height: 275 },
  Ozeanien: { x: 860, y: 285, width: 325, height: 220 },
};
let countries, byCode, validCodes, zoom, svg;
let mode = 'learn', game = null, selectedCode = null;
let advanceTimer = null;
let savedMistakes;
let highscores, roundRecord = null, resetTarget = null;
const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const populationLabel = value => `ca. ${number.format(value)}`;
const mobileLayout = matchMedia('(max-width: 1099px)');
const compactLayout = matchMedia('(max-width: 600px)');
const scrollBehavior = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

function sizeMobileMap() {
  const map = document.querySelector('.mapWrap');
  if (!compactLayout.matches) {
    map.style.removeProperty('--mobile-map-height');
    return;
  }
  const questionHeight = $('questionBar').getBoundingClientRect().height;
  const headerHeight = document.querySelector('.mapHeader').getBoundingClientRect().height;
  // The map header includes the zoom controls.
  const available = (window.visualViewport?.height ?? innerHeight)
    - questionHeight - headerHeight - 36;
  map.style.setProperty('--mobile-map-height', `${Math.max(280, Math.floor(available))}px`);
}

// Match BayernQuiz: reveal inline details below the pinned question.
function revealCountryInfo() {
  requestAnimationFrame(() => {
    const card = $('countryInfo');
    if (!card.getClientRects().length) return;
    if (mobileLayout.matches) {
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (viewport?.height ?? innerHeight);
      const stickyHeight = getComputedStyle($('questionBar')).position === 'sticky'
        ? $('questionBar').getBoundingClientRect().height : 0;
      const top = viewportTop + stickyHeight + 12;
      const bottom = viewportBottom - 12;
      const detail = card.getBoundingClientRect();
      const delta = detail.height > bottom - top || detail.top < top
        ? detail.top - top : Math.max(0, detail.bottom - bottom);
      if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: scrollBehavior() });
    } else {
      sizeSidebar();
      const sidebar = document.querySelector('.sidebar');
      const panel = sidebar.getBoundingClientRect();
      const detail = card.getBoundingClientRect();
      const stickyHeight = getComputedStyle($('questionBar')).position === 'sticky'
        ? $('questionBar').getBoundingClientRect().height + 12 : 0;
      const top = panel.top + stickyHeight;
      if (detail.height > sidebar.clientHeight - stickyHeight || detail.top < top) sidebar.scrollTop += detail.top - top;
      else if (detail.bottom > panel.bottom) sidebar.scrollTop += detail.bottom - panel.bottom;
    }
  });
}

function revealMap({ forQuestion = false } = {}) {
  // Wait for closing details and browser scroll adjustments before measuring.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (forQuestion && questionTopic(game) === 'population') {
      if (mobileLayout.matches) $('questionBar').scrollIntoView({ block: 'start', behavior: scrollBehavior() });
      else {
        const sidebar = document.querySelector('.sidebar');
        sidebar.scrollTop += $('questionBar').getBoundingClientRect().top - sidebar.getBoundingClientRect().top;
      }
      return;
    }
    if (forQuestion && (!game || game.finished || !mobileLayout.matches)) return;
    const questionBar = $('questionBar');
    const sticky = mobileLayout.matches && getComputedStyle(questionBar).position === 'sticky';
    const target = forQuestion && !sticky ? questionBar : document.querySelector('.mapWrap');
    const top = (window.visualViewport?.offsetTop ?? 0)
      + (sticky ? questionBar.getBoundingClientRect().height : 0) + 12;
    const delta = target.getBoundingClientRect().top - top;
    if (Math.abs(delta) > 1) window.scrollTo({ top: Math.max(0, scrollY + delta), behavior: scrollBehavior() });
  }));
}

function sizeSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (matchMedia('(min-width: 1100px)').matches) {
    const available = Math.max(260, innerHeight - sidebar.getBoundingClientRect().top - 20);
    sidebar.style.maxHeight = `${available}px`;
  } else sidebar.style.removeProperty('max-height');
}

function closeInfo() {
  $('countryInfo').hidden = true;
  selectedCode = null;
  renderMap();
}

function updateCounts() {
  const pool = eligibleCountries(countries, $('continent').value);
  const previous = Number($('count').value) || 10;
  const options = allowedCounts(pool.length);
  $('count').replaceChildren(...options.map(n => new Option(n === pool.length ? `Alle ${n} Länder` : `${n} Fragen`, n)));
  $('count').value = String(options.includes(previous) ? previous : options.includes(10) ? 10 : options[0]);
  $('poolSummary').textContent = `${pool.length} Länder ${mode === 'learn' ? 'zum Entdecken' : 'im Fragenpool'}`;
}

function renderRecords() {
  const region = $('continent').value;
  const count = Number($('count').value);
  for (const label of document.querySelectorAll('[data-mode-best]')) {
    const best = highscores.getBest(label.dataset.modeBest, region, count);
    label.textContent = `${best === null ? 'Dein Rekord: noch keiner' : `Dein Rekord: ${best}/${count}`} · ${region} · ${count} Fragen`;
  }
  $('highscores').hidden = !['quiz', 'capitals', 'flags', 'population'].includes(mode);
  const best = highscores.getBest(mode, region, count);
  $('personalBest').textContent = `${best === null ? 'Dein Rekord: noch keiner' : `Dein Rekord: ${best}/${count}`} · ${region} · ${count} Fragen`;
  $('highscoreStorage').textContent = highscores.persistent
    ? 'Rekorde werden nur in diesem Browser gespeichert.'
    : 'Rekorde bleiben für diese Sitzung erhalten; dauerhaftes Speichern ist nicht verfügbar.';
  const active = Boolean(game && !game.finished);
  $('resetRecords').disabled = active || !highscores.hasRecords;
  $('resetRecordsHint').hidden = !active;
}

function renderMistakes() {
  const correction = mode === 'correction';
  $('correctionCount').textContent = `${savedMistakes.count} offene Fragen`;
  $('mistakeHelp').hidden = !correction;
  $('mistakeStorage').textContent = savedMistakes.persistent
    ? 'Fehler werden nur in diesem Browser gespeichert.'
    : 'Fehler bleiben für diese Sitzung erhalten; dauerhaftes Speichern ist nicht verfügbar.';
  $('start').disabled = correction && !savedMistakes.count;
  $('newRound').disabled = correction && !savedMistakes.count;
  $('restart').disabled = correction && !savedMistakes.count;
  $('newRound').textContent = correction ? 'Neue Übungsrunde' : 'Neue Runde';
  $('restart').textContent = correction ? 'Übung neu starten' : 'Neu starten';
  $('correctionProgress').textContent = game && !game.finished && game.answers[game.index]
    ? game.correctionMessage ?? '' : '';
  if (correction) $('poolSummary').textContent = `${savedMistakes.count} offene Fragen · Bis zu 10 Fragen pro Runde · Ohne Rekordwertung`;
}

function setupRecordReset() {
  function describeReset() {
    $('resetRecordsDescription').textContent = $('resetAllRecords').checked
      ? 'Alle Rekorde für alle Modi, Regionen und Fragenanzahlen in diesem Browser werden gelöscht.'
      : `Nur der Rekord für ${names[resetTarget.mode]}, ${resetTarget.region}, ${resetTarget.count} Fragen wird gelöscht.`;
  }
  $('resetRecords').addEventListener('click', () => {
    if ((game && !game.finished) || !highscores.hasRecords) return;
    resetTarget = { mode, region: $('continent').value, count: Number($('count').value) };
    const selected = highscores.getBest(resetTarget.mode, resetTarget.region, resetTarget.count) !== null;
    $('resetSelectedLabel').textContent = `Diesen Rekord: ${names[mode]}, ${resetTarget.region}, ${resetTarget.count} Fragen`;
    $('resetSelectedRecord').disabled = !selected;
    $('resetSelectedRecord').checked = selected;
    $('resetAllRecords').checked = !selected;
    $('resetRecordsError').textContent = '';
    $('resetRecordsStatus').textContent = '';
    describeReset();
    $('resetRecordsDialog').showModal();
    $('cancelResetRecords').focus();
  });
  for (const id of ['resetSelectedRecord', 'resetAllRecords']) $(id).addEventListener('change', describeReset);
  $('cancelResetRecords').addEventListener('click', () => $('resetRecordsDialog').close());
  $('resetRecordsDialog').addEventListener('close', () => {
    if ($('resetRecordsDialog').open) return;
    resetTarget = null;
    ($('resetRecords').disabled ? $('personalBest') : $('resetRecords')).focus({ preventScroll: true });
  });
  $('resetRecordsForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!resetTarget || !$('resetRecordsDialog').open) return;
    const all = $('resetAllRecords').checked;
    const success = all ? highscores.resetAll() : highscores.resetRecord(resetTarget.mode, resetTarget.region, resetTarget.count);
    if (!success) {
      $('resetRecordsError').textContent = 'Die Rekorde konnten nicht zurückgesetzt werden. Bitte versuche es erneut.';
      return;
    }
    if (all || (game?.mode === resetTarget.mode && game?.region === resetTarget.region && game?.questions.length === resetTarget.count)) {
      roundRecord = null;
      $('highscoreResult').textContent = '';
    }
    renderRecords();
    $('resetRecordsStatus').textContent = all ? 'Alle Rekorde zurückgesetzt.' : 'Rekord zurückgesetzt.';
    $('resetRecordsDialog').close();
  });
}

function focusRegion() {
  const region = mode === 'correction' ? 'Welt' : $('continent').value;
  $('mapTitleFull').textContent = region === 'Welt' ? 'Die ganze Welt' : region;
  $('mapTitleCompact').textContent = region;
  if (region === 'Welt') zoom.reset();
  else {
    const region = $('continent').value;
    const base = regionBounds[region];
    const anchors = eligibleCountries(countries, region).map(c => c.anchor);
    const left = Math.min(base.x, ...anchors.map(p => p[0]));
    const top = Math.min(base.y, ...anchors.map(p => p[1]));
    const right = Math.max(base.x + base.width, ...anchors.map(p => p[0]));
    const bottom = Math.max(base.y + base.height, ...anchors.map(p => p[1]));
    // Pacific states lie on both sides of the antimeridian. Include both
    // sides rather than dropping Samoa, Tonga, or Kiribati from the viewport.
    zoom.fit({ x: left, y: top, width: right - left, height: bottom - top });
  }
}

function renderMap() {
  if (!svg) return;
  const response = game && !game.finished ? game.answers[game.index] : null;
  svg.querySelectorAll('[data-country]').forEach(el => {
    const code = el.dataset.country;
    const correct = response?.target === code;
    const wrong = response && !response.correct && response.selected === code;
    el.classList.toggle('outside', mode !== 'correction' && $('continent').value !== 'Welt' && byCode.get(code).continent !== $('continent').value);
    el.classList.toggle('selected', selectedCode === code && !correct && !wrong);
    el.classList.toggle('correct', Boolean(correct));
    el.classList.toggle('wrong', Boolean(wrong));
    el.setAttribute('aria-pressed', String(selectedCode === code));
  });
}

function showCountry(code, reveal = false, { scrollToMap = false } = {}) {
  const c = byCode.get(code);
  if (!c) return;
  selectedCode = code;
  $('countryInfo').hidden = false;
  $('countryName').textContent = c.name;
  $('countryContinent').textContent = c.continent;
  $('capital').textContent = c.capitals.join(' · ');
  $('area').textContent = `ca. ${number.format(c.areaKm2)} km²`;
  $('population').textContent = `ca. ${number.format(c.population)} (${c.populationYear})`;
  $('fact').textContent = c.fact;
  $('wikipedia').href = c.wikipediaUrl;
  $('flag').hidden = false;
  $('flagFallback').hidden = true;
  $('flag').alt = `Flagge von ${c.name}`;
  $('flag').src = c.flag;
  if (reveal) zoom.revealPoint(c.anchor);
  renderMap();
  if (scrollToMap) {
    $('mapHost').focus({ preventScroll: true });
    revealMap();
  } else revealCountryInfo();
}

function renderQuestion() {
  renderRecords();
  renderMistakes();
  const active = game && !game.finished;
  document.body.classList.toggle('quizActive', Boolean(active));
  $('quizStats').hidden = !active;
  $('restart').hidden = !active;
  $('results').hidden = !game?.finished;
  $('feedback').textContent = '';
  $('next').hidden = true;
  $('instructions').hidden = false;
  $('questionFlagFrame').hidden = true;
  $('populationChoices').hidden = true;
  $('populationChoices').replaceChildren();
  document.body.classList.toggle('populationQuestion', Boolean(active && questionTopic(game) === 'population'));
  if (!active) {
    $('questionTopic').textContent = mode === 'learn' ? 'DIE WELT ENTDECKEN' : names[mode].toLocaleUpperCase('de-DE');
    $('question').textContent = mode === 'learn' ? 'Welches Land interessiert dich?' : game?.finished ? 'Weiter auf Entdeckungsreise' : 'Bereit für eine Weltreise?';
    if (mode === 'correction' && !game?.finished) $('question').textContent = savedMistakes.count ? 'Bereit, deine Fehler zu korrigieren?' : 'Keine offenen Fehler. Spiele ein Quiz, um schwierige Fragen hier zu sammeln.';
    $('instructions').textContent = 'Klicke auf ein Land oder einen kleinen Länderpunkt, um mehr zu erfahren.';
    return;
  }
  const c = currentQuestion(game);
  const topic = questionTopic(game);
  $('questionTopic').classList.toggle('practiceTopic', game.practice);
  $('questionTopic').textContent = game.practice ? `${mode === 'correction' ? 'FEHLER KORRIGIEREN' : 'FEHLER ÜBEN'} · ${names[topic].toLocaleUpperCase('de-DE')} · OHNE WERTUNG` : names[mode].toLocaleUpperCase('de-DE');
  const strong = document.createElement('strong');
  strong.textContent = topic === 'capitals' ? c.capitals.join(' · ') : c.name;
  const prefix = document.createElement('span');
  prefix.textContent = topic === 'capitals' ? 'Zu welchem Land gehört: ' : 'Wo liegt ';
  if (topic === 'population') {
    $('question').replaceChildren('Wie viele Einwohner hat ', strong, ` ungefähr (${c.populationYear})?`);
    $('populationChoices').hidden = false;
    const response = game.answers[game.index];
    $('populationChoices').replaceChildren(...c.populationOptions.map(value => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.population = String(value);
      button.textContent = populationLabel(value);
      button.disabled = Boolean(response);
      if (response && value === roundedPopulation(c.population)) button.className = 'populationCorrect';
      else if (response && value === response.selectedPopulation) button.className = 'populationWrong';
      button.addEventListener('click', () => {
        if (answerPopulation(game, value)) handleAnswer();
      });
      return button;
    }));
  } else if (topic === 'flags') {
    $('question').textContent = 'Zu welchem Land gehört diese Flagge?';
    $('questionFlagFrame').hidden = false;
    // Keep a failed image visible as a fallback across answer rerenders.
    if ($('questionFlag').getAttribute('src') !== c.flag) {
      $('questionFlag').hidden = false;
      $('questionFlagFallback').hidden = true;
      $('questionFlag').src = c.flag;
    }
  } else if (topic === 'capitals') {
    const fullPrefix = document.createElement('span');
    fullPrefix.className = 'fullCapitalPrompt';
    fullPrefix.textContent = 'Zu welchem Land gehört diese Hauptstadt / dieser Regierungssitz: ';
    prefix.className = 'compactCapitalPrompt';
    $('question').replaceChildren(fullPrefix, prefix, strong, '?');
  } else $('question').replaceChildren(prefix, strong, '?');
  $('instructions').textContent = topic === 'population'
    ? 'Wähle die ungefähre Einwohnerzahl. Die Schätzung bezieht sich auf das angegebene Jahr.'
    : 'Wähle das gesuchte Land auf der Karte.';
  $('questionCount').textContent = `Frage ${game.index + 1}/${game.questions.length}`;
  $('points').textContent = `${score(game)} Punkte`;
  $('progress').max = game.questions.length;
  $('progress').value = game.answers.length;
  $('progressText').textContent = `${game.answers.length} von ${game.questions.length} Fragen beantwortet`;
  const response = game.answers[game.index];
  if (response) {
    $('instructions').hidden = true;
    $('feedback').className = response.correct ? 'good' : 'bad';
    $('feedback').textContent = topic === 'population'
      ? `${response.correct ? 'Richtig!' : `Deine Antwort: ${populationLabel(response.selectedPopulation)}.`} ${c.name}: ${populationLabel(roundedPopulation(c.population))} Einwohner (${c.populationYear}).`
      : response.correct ? `Richtig! Das ist ${c.name}.` : `Deine Antwort: ${byCode.get(response.selected).name}. Richtige Antwort: ${c.name}.`;
    if (topic === 'capitals') $('feedback').textContent += ` Hauptstadt / Regierungssitz: ${c.capitals.join(' · ')}.`;
    $('next').hidden = false;
    $('next').textContent = game.index === game.questions.length - 1 ? 'Ergebnis ansehen' : 'Weiter';
  }
}

function renderResults() {
  const correction = game.mode === 'correction';
  $('correctionSummary').textContent = correction ? `${game.clearedCount} Fragen korrigiert. ${savedMistakes.count ? `${savedMistakes.count} offene Fragen verbleiben.` : 'Alle gespeicherten Fehler korrigiert!'}` : '';
  $('highscoreResult').textContent = highscoreMessage(roundRecord);
  const wrong = mistakes(game);
  $('resultTitle').textContent = `${score(game)} von ${game.questions.length} richtig`;
  $('resultMessage').textContent = game.practice ? 'Übungsrunde abgeschlossen. Jeder Versuch hilft dir beim Lernen.' : 'Gut entdeckt! Erkunde die Karte weiter oder starte eine neue Runde.';
  $('mistakeList').replaceChildren(...wrong.map(a => {
    const topic = a.topic ?? game.mode;
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'secondary small';
    button.textContent = `${a.topic ? `${names[topic]}: ` : ''}${byCode.get(a.target).name}`;
    button.addEventListener('click', () => showCountry(a.target, true, { scrollToMap: true }));
    const text = document.createElement('span');
    const target = byCode.get(a.target);
    text.textContent = topic === 'population'
      ? `Deine Antwort: ${populationLabel(a.selectedPopulation)} · Richtig: ${populationLabel(roundedPopulation(target.population))} Einwohner (${target.populationYear})`
      : `Deine Antwort: ${byCode.get(a.selected).name} · Richtig: ${target.name}`;
    if (topic === 'capitals') text.textContent += ` · Hauptstadt / Regierungssitz: ${byCode.get(a.target).capitals.join(' · ')}`;
    if (topic === 'flags') {
      const flag = document.createElement('img');
      flag.className = 'mistakeFlag';
      flag.src = byCode.get(a.target).flag;
      flag.alt = `Flagge von ${byCode.get(a.target).name}`;
      li.append(flag);
    }
    li.append(button, text);
    return li;
  }));
  $('retry').hidden = correction || !wrong.length;
  $('retry').textContent = `Fehler wiederholen (${wrong.length})`;
  $('perfect').hidden = Boolean(wrong.length);
  $('perfect').textContent = correction ? 'In dieser Runde alles richtig!' : 'Alles richtig!';
  if (game.practice && !correction && !wrong.length) $('resultMessage').textContent = 'Alle Fehler geschafft!';
}

function launch() {
  $('modeCards').hidden = true;
  $('changeMode').hidden = false;
  if (matchMedia('(max-width: 1099px)').matches) $('settings').open = false;
  sizeSidebar();
}

function startRound(practiceGame = null) {
  if (mode === 'correction' && !savedMistakes.count) return;
  cancelAdvance();
  launch();
  game = mode === 'correction' ? createCorrectionGame(countries, savedMistakes.selectQuestions())
    : practiceGame || createGame(eligibleCountries(countries, $('continent').value), Number($('count').value), Math.random, false, mode);
  game.mode = mode;
  game.region = mode === 'correction' ? 'Welt' : $('continent').value;
  roundRecord = null;
  closeInfo();
  focusRegion();
  renderQuestion();
  renderMap();
  revealMap({ forQuestion: true });
}

function chooseMode(nextMode) {
  $('modeDialog').close();
  if (mode === nextMode) return;
  cancelAdvance();
  mode = nextMode;
  game = null;
  $('modeName').textContent = names[mode];
  document.querySelectorAll('.modeCard').forEach(el => {
    el.classList.toggle('selected', el.dataset.mode === mode);
    el.setAttribute('aria-pressed', String(el.dataset.mode === mode));
  });
  $('countField').hidden = mode === 'learn' || mode === 'correction';
  $('regionField').hidden = mode === 'correction';
  $('autoLabel').hidden = mode === 'learn';
  $('start').textContent = mode === 'learn' ? 'Karte erkunden' : mode === 'correction' ? 'Fehler korrigieren' : 'Quiz starten';
  closeInfo();
  updateCounts();
  focusRegion();
  renderQuestion();
  renderMap();
}

function selectCountry(code) {
  if (questionTopic(game) === 'population') {
    if (game.answers[game.index]) showCountry(code);
    return;
  }
  const submitted = answer(game, code, validCodes);
  if (submitted) handleAnswer();
  else showCountry(code);
}

function handleAnswer() {
  const population = questionTopic(game) === 'population';
  const progress = savedMistakes.recordAnswer(game);
  game.correctionMessage = progress ? progress.cleared ? 'Fehler korrigiert!' : progress.streak ? '1 von 2 richtig' : '' : '';
  if (progress?.cleared && game.mode === 'correction') game.clearedCount++;
  renderQuestion();
  if (population) {
    selectedCode = currentQuestion(game).code;
    renderMap();
    $('next').focus({ preventScroll: true });
  } else showCountry(currentQuestion(game).code, true);
  if (game.answers[game.index].correct && $('autoNext').checked) {
    advanceTimer = window.setTimeout(advanceQuestion, 1600);
  }
}

function cancelAdvance() {
  window.clearTimeout(advanceTimer);
  advanceTimer = null;
}

function advanceQuestion() {
  cancelAdvance();
  if (!nextQuestion(game)) return;
  if (game.finished) roundRecord = highscores.recordCompletedRound(game);
  closeInfo();
  renderQuestion();
  renderMap();
  if (game.finished) {
    renderResults();
    $('results').scrollIntoView({ block: 'nearest' });
    $('newRound').focus({ preventScroll: true });
  } else {
    $('questionBar').focus({ preventScroll: true });
    revealMap({ forQuestion: true });
  }
}

async function initialize() {
  const responses = await Promise.all([fetch('assets/data/countries.json'), fetch('world.svg')]);
  if (responses.some(r => !r.ok)) throw new Error('Lokale Kartendaten konnten nicht geladen werden.');
  countries = await responses[0].json();
  highscores = createHighscores(countries);
  savedMistakes = createMistakes(countries);
  setupRecordReset();
  byCode = new Map(countries.map(c => [c.code, c]));
  validCodes = new Set(byCode.keys());
  const documentSvg = new DOMParser().parseFromString(await responses[1].text(), 'image/svg+xml');
  if (documentSvg.querySelector('parsererror')) throw new Error('Die Kartendatei ist ungültig.');
  svg = document.importNode(documentSvg.documentElement, true);
  $('mapHost').replaceChildren(svg);
  for (const el of svg.querySelectorAll('[data-country]')) {
    const c = byCode.get(el.dataset.country);
    el.dataset.anchorX = c.anchor[0];
    el.dataset.anchorY = c.anchor[1];
  }
  // Keep small-country markers at a usable screen size at every zoom level.
  svg.addEventListener('viewchange', ({ detail }) => {
    const rect = svg.getBoundingClientRect();
    const unit = detail.width / Math.max(rect.width, 1);
    svg.querySelectorAll('.marker-hit').forEach(el => el.setAttribute('r', 12 * unit));
    svg.querySelectorAll('.marker-dot').forEach(el => el.setAttribute('r', 3.5 * unit));
  });
  zoom = createMapZoom({ svg, host: $('mapHost'), zoomIn: $('zoomIn'), zoomOut: $('zoomOut'), resetButton: $('resetMap'), percentage: $('zoomPercentage') });
  $('mapHost').addEventListener('click', event => {
    const feature = event.target.closest('[data-country]');
    if (feature) selectCountry(feature.dataset.country);
  });
  $('mapHost').addEventListener('keydown', event => {
    const feature = event.target.closest('[data-country]');
    if (feature && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      feature.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  $('questionFlag').addEventListener('error', () => { $('questionFlag').hidden = true; $('questionFlagFallback').hidden = false; });
  $('flag').addEventListener('error', () => { $('flag').hidden = true; $('flagFallback').hidden = false; });
  document.querySelectorAll('[data-mode]').forEach(el => el.addEventListener('click', () => chooseMode(el.dataset.mode)));
  $('changeMode').addEventListener('click', () => {
    for (const button of document.querySelectorAll('.dialogModes button')) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    $('modeDialog').showModal();
  });
  $('closeDialog').addEventListener('click', () => $('modeDialog').close());
  $('closeInfo').addEventListener('click', () => {
    closeInfo();
    $('mapHost').focus({ preventScroll: true });
  });
  $('start').addEventListener('click', () => {
    if (mode !== 'learn') startRound();
    else { launch(); focusRegion(); }
  });
  $('restart').addEventListener('click', () => startRound(mode !== 'correction' && game.practice ? createGame(game.questions, game.questions.length, Math.random, true, mode) : null));
  $('newRound').addEventListener('click', () => startRound());
  $('retry').addEventListener('click', () => { const practice = retryGame(game); if (practice) startRound(practice); });
  $('next').addEventListener('click', advanceQuestion);
  $('autoNext').addEventListener('change', () => {
    if (!$('autoNext').checked) cancelAdvance();
  });
  $('questionBar').tabIndex = -1;
  $('continent').addEventListener('change', () => { cancelAdvance(); game = null; closeInfo(); updateCounts(); focusRegion(); renderQuestion(); renderMap(); });
  $('count').addEventListener('change', () => {
    cancelAdvance();
    if (game && !game.finished) { game = null; closeInfo(); renderQuestion(); renderMap(); }
    renderRecords();
  });
  updateCounts();
  renderRecords();
  renderMistakes();
  renderMap();
  sizeSidebar();
  const mobileMapObserver = new ResizeObserver(sizeMobileMap);
  for (const element of [$('questionBar'), document.querySelector('.mapHeader'), document.querySelector('.mapToolbar')]) {
    mobileMapObserver.observe(element);
  }
  sizeMobileMap();
  window.addEventListener('resize', sizeMobileMap);
  window.visualViewport?.addEventListener('resize', sizeMobileMap);
  window.addEventListener('resize', sizeSidebar);
  window.addEventListener('scroll', sizeSidebar, { passive: true });
  $('mapHost').setAttribute('aria-busy', 'false');
}

// Avoid an apparent working start button before local content is ready.
$('start').disabled = true;
document.querySelectorAll('[data-mode]').forEach(el => { el.disabled = true; });
initialize().then(() => {
  $('start').disabled = false;
  document.querySelectorAll('[data-mode]').forEach(el => { el.disabled = false; });
}).catch(error => {
  $('mapHost').setAttribute('aria-busy', 'false');
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = 'Die Weltkarte konnte nicht geladen werden. Bitte lade die Seite neu. Starte die App über einen Webserver (npm run serve:dist).';
  $('mapHost').replaceChildren(message);
  console.error(error);
});
