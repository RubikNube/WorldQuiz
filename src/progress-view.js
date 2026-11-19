import { CONTINENTS } from './game.js';
import { PROGRESS_TOPICS } from './progress.js';

export function setupProgressView({ progress, savedMistakes, targets, names, cancelAdvance, isActive, chooseCorrection }) {
  const $ = id => document.getElementById(id);
  const dialog = $('learningProgressDialog');
  const number = new Intl.NumberFormat('de-DE');
  const date = new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' });
  const accuracy = (correct, total) => total ? `${Math.round(correct / total * 100)} % (${number.format(correct)}/${number.format(total)})` : 'Noch keine Antworten';
  function element(tag, text) {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  }
  const filter = () => ({ topic: $('progressTopic').value, region: $('progressRegion').value });
  function table(bodyId, values, type) {
    const selected = filter();
    $(bodyId).replaceChildren(...values.map(value => {
      const summary = progress.getSummary({ ...selected, [type]: value });
      const row = document.createElement('tr');
      const heading = element('th', type === 'topic' ? names[value] : value);
      heading.scope = 'row';
      row.append(heading, element('td', accuracy(summary.correct, summary.attempts)),
        element('td', `${summary.covered}/${summary.available}`));
      return row;
    }));
  }
  function render() {
    const selected = filter(), summary = progress.getSummary(selected);
    $('progressStorage').textContent = progress.persistent
      ? 'Lernfortschritt wird nur in diesem Browser gespeichert.'
      : 'Lernfortschritt bleibt für diese Sitzung erhalten; dauerhaftes Speichern ist nicht verfügbar.';
    $('progressMetrics').replaceChildren(...[
      ['Beantwortete Fragen', number.format(summary.attempts)],
      ['Insgesamt richtig', accuracy(summary.correct, summary.attempts)],
      ['Letzte 100 Antworten', accuracy(summary.recentCorrect, summary.recentAttempts)],
      ['Normales Quiz / Übung', `${number.format(summary.normal)} / ${number.format(summary.practice)}`],
      ['Abdeckung', `${summary.covered}/${summary.available} Fragen ausprobiert`],
    ].map(([label, value]) => {
      const card = document.createElement('div');
      card.append(element('dt', label), element('dd', value));
      return card;
    }));
    $('progressEmpty').hidden = summary.attempts > 0;
    table('progressTopics', selected.topic ? [selected.topic] : PROGRESS_TOPICS, 'topic');
    table('progressRegions', selected.region === 'Welt' ? CONTINENTS : [selected.region], 'region');
    const rounds = progress.getRecentRounds(selected);
    $('progressRoundsEmpty').hidden = rounds.length > 0;
    $('progressRounds').replaceChildren(...rounds.map(round => element('li',
      `${date.format(round.at)} · ${names[round.mode]} · ${round.region} · ${round.correct}/${round.total} richtig${round.practice ? ' · Übung' : ''}`)));
    const errors = savedMistakes.entries.filter(entry => (!selected.topic || entry.topic === selected.topic)
      && (selected.region === 'Welt' || targets.get(entry.code).continent === selected.region))
      .sort((a, b) => names[a.topic].localeCompare(names[b.topic], 'de') || targets.get(a.code).name.localeCompare(targets.get(b.code).name, 'de'));
    $('progressErrorsEmpty').hidden = errors.length > 0;
    $('progressErrors').replaceChildren(...errors.map(entry => element('li',
      `${names[entry.topic]}: ${targets.get(entry.code).name} · ${entry.streak} von 2 richtig`)));
    $('progressCorrect').disabled = isActive() || !savedMistakes.count;
    $('progressCorrectHint').hidden = !isActive();
  }
  $('progressTopic').append(...PROGRESS_TOPICS.map(topic => new Option(names[topic], topic)));
  $('progressRegion').append(...CONTINENTS.map(region => new Option(region, region)));
  $('progressTopic').addEventListener('change', render);
  $('progressRegion').addEventListener('change', render);
  $('openProgress').addEventListener('click', () => {
    cancelAdvance();
    render();
    dialog.showModal();
  });
  $('closeProgress').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => $('openProgress').focus({ preventScroll: true }));
  $('progressCorrect').addEventListener('click', () => {
    if (isActive() || !savedMistakes.count) return;
    dialog.close();
    chooseCorrection();
  });
  $('openProgress').disabled = false;
}
