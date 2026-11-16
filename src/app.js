import { eligibleCountries, allowedCounts, createGame, currentQuestion, answer, nextQuestion, score, mistakes, retryGame } from './game.js';
import { createMapZoom } from './map-zoom.js';

const $ = id => document.getElementById(id);
const names = { learn: 'Lernen', quiz: 'Länder finden', capitals: 'Hauptstädte zuordnen' };
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
const number = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const mobileLayout = matchMedia('(max-width: 1099px)');
const scrollBehavior = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

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

function revealQuestionMap() {
  // Wait for closing details and browser scroll adjustments before measuring.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!game || game.finished || !mobileLayout.matches) return;
    const questionBar = $('questionBar');
    const sticky = getComputedStyle(questionBar).position === 'sticky';
    const target = sticky ? document.querySelector('.mapWrap') : questionBar;
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

function focusRegion() {
  $('mapTitle').textContent = $('continent').value === 'Welt' ? 'Die ganze Welt' : $('continent').value;
  if ($('continent').value === 'Welt') zoom.reset();
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
    el.classList.toggle('outside', $('continent').value !== 'Welt' && byCode.get(code).continent !== $('continent').value);
    el.classList.toggle('selected', selectedCode === code && !correct && !wrong);
    el.classList.toggle('correct', Boolean(correct));
    el.classList.toggle('wrong', Boolean(wrong));
    el.setAttribute('aria-pressed', String(selectedCode === code));
  });
}

function showCountry(code, reveal = false) {
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
  revealCountryInfo();
}

function renderQuestion() {
  const active = game && !game.finished;
  document.body.classList.toggle('quizActive', Boolean(active));
  $('quizStats').hidden = !active;
  $('restart').hidden = !active;
  $('results').hidden = !game?.finished;
  $('feedback').textContent = '';
  $('next').hidden = true;
  $('instructions').hidden = false;
  if (!active) {
    $('questionTopic').textContent = mode === 'learn' ? 'DIE WELT ENTDECKEN' : names[mode].toLocaleUpperCase('de-DE');
    $('question').textContent = mode === 'learn' ? 'Welches Land interessiert dich?' : game?.finished ? 'Weiter auf Entdeckungsreise' : 'Bereit für eine Weltreise?';
    $('instructions').textContent = 'Klicke auf ein Land oder einen kleinen Länderpunkt, um mehr zu erfahren.';
    return;
  }
  const c = currentQuestion(game);
  $('questionTopic').textContent = game.practice ? 'FEHLER ÜBEN · OHNE WERTUNG' : names[mode].toLocaleUpperCase('de-DE');
  const strong = document.createElement('strong');
  strong.textContent = mode === 'capitals' ? c.capitals.join(' · ') : c.name;
  $('question').replaceChildren(mode === 'capitals'
    ? 'Zu welchem Land gehört diese Hauptstadt / dieser Regierungssitz: '
    : 'Wo liegt ', strong, '?');
  $('instructions').textContent = 'Wähle das gesuchte Land auf der Karte.';
  $('questionCount').textContent = `Frage ${game.index + 1}/${game.questions.length}`;
  $('points').textContent = `${score(game)} Punkte`;
  $('progress').max = game.questions.length;
  $('progress').value = game.answers.length;
  $('progressText').textContent = `${game.answers.length} von ${game.questions.length} Fragen beantwortet`;
  const response = game.answers[game.index];
  if (response) {
    $('instructions').hidden = true;
    $('feedback').className = response.correct ? 'good' : 'bad';
    $('feedback').textContent = response.correct ? `Richtig! Das ist ${c.name}.` : `Deine Antwort: ${byCode.get(response.selected).name}. Richtige Antwort: ${c.name}.`;
    if (mode === 'capitals') $('feedback').textContent += ` Hauptstadt / Regierungssitz: ${c.capitals.join(' · ')}.`;
    $('next').hidden = false;
    $('next').textContent = game.index === game.questions.length - 1 ? 'Ergebnis ansehen' : 'Weiter';
  }
}

function renderResults() {
  const wrong = mistakes(game);
  $('resultTitle').textContent = `${score(game)} von ${game.questions.length} richtig`;
  $('resultMessage').textContent = game.practice ? 'Übungsrunde abgeschlossen. Jeder Versuch hilft dir beim Lernen.' : 'Gut entdeckt! Erkunde die Karte weiter oder starte eine neue Runde.';
  $('mistakeList').replaceChildren(...wrong.map(a => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'secondary small';
    button.textContent = byCode.get(a.target).name;
    button.addEventListener('click', () => showCountry(a.target, true));
    const text = document.createElement('span');
    text.textContent = `Deine Antwort: ${byCode.get(a.selected).name} · Richtig: ${byCode.get(a.target).name}`;
    if (mode === 'capitals') text.textContent += ` · Hauptstadt / Regierungssitz: ${byCode.get(a.target).capitals.join(' · ')}`;
    li.append(button, text);
    return li;
  }));
  $('retry').hidden = !wrong.length;
  $('retry').textContent = `Fehler wiederholen (${wrong.length})`;
  $('perfect').hidden = Boolean(wrong.length);
  if (game.practice && !wrong.length) $('resultMessage').textContent = 'Alle Fehler geschafft!';
}

function launch() {
  $('modeCards').hidden = true;
  $('changeMode').hidden = false;
  if (matchMedia('(max-width: 1099px)').matches) $('settings').open = false;
  sizeSidebar();
}

function startRound(practiceGame = null) {
  launch();
  game = practiceGame || createGame(eligibleCountries(countries, $('continent').value), Number($('count').value));
  closeInfo();
  focusRegion();
  renderQuestion();
  renderMap();
  revealQuestionMap();
}

function chooseMode(nextMode) {
  $('modeDialog').close();
  if (mode === nextMode) return;
  mode = nextMode;
  game = null;
  $('modeName').textContent = names[mode];
  document.querySelectorAll('.modeCard').forEach(el => {
    el.classList.toggle('selected', el.dataset.mode === mode);
    el.setAttribute('aria-pressed', String(el.dataset.mode === mode));
  });
  $('countField').hidden = mode === 'learn';
  $('start').textContent = mode === 'learn' ? 'Karte erkunden' : 'Quiz starten';
  closeInfo();
  updateCounts();
  focusRegion();
  renderQuestion();
}

function selectCountry(code) {
  const submitted = answer(game, code, validCodes);
  if (submitted) {
    renderQuestion();
    showCountry(currentQuestion(game).code, true);
  } else showCountry(code);
}

async function initialize() {
  const responses = await Promise.all([fetch('assets/data/countries.json'), fetch('world.svg')]);
  if (responses.some(r => !r.ok)) throw new Error('Lokale Kartendaten konnten nicht geladen werden.');
  countries = await responses[0].json();
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
  $('restart').addEventListener('click', () => startRound(game.practice ? createGame(game.questions, game.questions.length, Math.random, true) : null));
  $('newRound').addEventListener('click', () => startRound());
  $('retry').addEventListener('click', () => { const practice = retryGame(game); if (practice) startRound(practice); });
  function advanceQuestion() {
    if (!nextQuestion(game)) return;
    closeInfo();
    renderQuestion();
    renderMap();
    if (game.finished) {
      renderResults();
      $('results').scrollIntoView({ block: 'nearest' });
      $('newRound').focus({ preventScroll: true });
    } else {
      $('questionBar').focus({ preventScroll: true });
      revealQuestionMap();
    }
  }
  $('next').addEventListener('click', advanceQuestion);
  $('questionBar').tabIndex = -1;
  $('continent').addEventListener('change', () => { game = null; closeInfo(); updateCounts(); focusRegion(); renderQuestion(); renderMap(); });
  $('count').addEventListener('change', () => {
    if (game && !game.finished) { game = null; closeInfo(); renderQuestion(); renderMap(); }
  });
  updateCounts();
  renderMap();
  sizeSidebar();
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
