export const CONTINENTS = ['Afrika', 'Asien', 'Europa', 'Nordamerika', 'Südamerika', 'Ozeanien'];

export function eligibleCountries(countries, continent = 'Welt') {
  return continent === 'Welt' ? [...countries] : countries.filter(c => c.continent === continent);
}

export function allowedCounts(total) {
  return [...new Set([5, 10, 15, 20].filter(n => n < total).concat(total))];
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function roundedPopulation(population) {
  if (!Number.isFinite(population) || population <= 0) throw new RangeError('Ungültige Einwohnerzahl');
  return Math.max(1, Number(population.toPrecision(2)));
}

export function populationOptions(population, random = Math.random) {
  const rank = Math.floor(random() * 4);
  const options = Array.from({ length: 4 }, (_, index) =>
    roundedPopulation(population * 2 ** (index - rank)));
  return shuffle(options, random);
}

function populationQuestion(country, random) {
  return { ...country, populationOptions: populationOptions(country.population, random) };
}

export function createGame(countries, count, random = Math.random, practice = false, mode) {
  if (!Number.isInteger(count) || count < 1 || count > countries.length) throw new RangeError('Ungültige Fragenanzahl');
  if (new Set(countries.map(c => c.code)).size !== countries.length) throw new Error('Doppelte Länder');
  const questions = shuffle(countries, random).slice(0, count)
    .map(c => mode === 'population' ? populationQuestion(c, random) : c);
  return { questions, index: 0, answers: [], practice, finished: false, ...(mode ? { mode } : {}) };
}

export function currentQuestion(game) {
  return game && !game.finished ? game.questions[game.index] : null;
}

export function questionTopic(game, question = currentQuestion(game)) {
  return game?.mode === 'correction' ? question?.topic : game?.mode;
}

export function createCorrectionGame(countries, references, random = Math.random, rivers = []) {
  const byCode = new Map(countries.map(c => [c.code, c]));
  const byRiver = new Map(rivers.map(r => [r.code, r]));
  if (!references.length || references.length > 10
    || new Set(references.map(q => `${q.topic}:${q.code}`)).size !== references.length
    || references.some(q => q.topic === 'river' ? !byRiver.has(q.code)
      : !['quiz', 'capitals', 'flags', 'population'].includes(q.topic) || !byCode.has(q.code))) {
    throw new RangeError('Ungültige Fehlerauswahl');
  }
  return {
    questions: shuffle(references.map(q => {
      const country = { ...(q.topic === 'river' ? byRiver : byCode).get(q.code), topic: q.topic };
      return q.topic === 'population' ? populationQuestion(country, random) : country;
    }), random),
    index: 0, answers: [], practice: true, finished: false, mode: 'correction', region: 'Welt', clearedCount: 0,
  };
}

export function answer(game, code, validCodes) {
  if (!game || game.finished || questionTopic(game) === 'population'
    || game.answers.length > game.index || !validCodes.has(code)) return false;
  const target = currentQuestion(game);
  // A valid code from the other map layer must never submit an answer.
  if (code.startsWith('river-') !== (questionTopic(game) === 'river')) return false;
  game.answers.push({ target: target.code, selected: code, correct: code === target.code,
    ...(game.mode === 'correction' ? { topic: target.topic } : {}) });
  return true;
}

export function answerPopulation(game, selectedPopulation) {
  if (!game || game.finished || questionTopic(game) !== 'population'
    || game.answers.length > game.index) return false;
  const target = currentQuestion(game);
  if (!target.populationOptions.includes(selectedPopulation)) return false;
  game.answers.push({ target: target.code, selectedPopulation,
    correct: selectedPopulation === roundedPopulation(target.population),
    ...(game.mode === 'correction' ? { topic: target.topic } : {}) });
  return true;
}

export function nextQuestion(game) {
  if (!game || game.finished || game.answers.length <= game.index) return false;
  if (game.index === game.questions.length - 1) game.finished = true;
  else game.index++;
  return true;
}

export function score(game) { return game.answers.filter(a => a.correct).length; }
export function mistakes(game) { return game.answers.filter(a => !a.correct); }
export function retryGame(game, random = Math.random) {
  if (game.mode === 'correction') return null;
  const codes = new Set(mistakes(game).map(a => a.target));
  if (!game.finished || !codes.size) return null;
  const questions = game.questions.filter(c => codes.has(c.code));
  return createGame(questions, questions.length, random, true, game.mode);
}
