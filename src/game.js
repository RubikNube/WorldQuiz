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

export function createGame(countries, count, random = Math.random, practice = false) {
  if (!Number.isInteger(count) || count < 1 || count > countries.length) throw new RangeError('Ungültige Fragenanzahl');
  if (new Set(countries.map(c => c.code)).size !== countries.length) throw new Error('Doppelte Länder');
  return { questions: shuffle(countries, random).slice(0, count), index: 0, answers: [], practice, finished: false };
}

export function currentQuestion(game) {
  return game && !game.finished ? game.questions[game.index] : null;
}

export function questionTopic(game, question = currentQuestion(game)) {
  return game?.mode === 'correction' ? question?.topic : game?.mode;
}

export function createCorrectionGame(countries, references, random = Math.random) {
  const byCode = new Map(countries.map(c => [c.code, c]));
  if (!references.length || references.length > 10
    || new Set(references.map(q => `${q.topic}:${q.code}`)).size !== references.length
    || references.some(q => !['quiz', 'capitals', 'flags'].includes(q.topic) || !byCode.has(q.code))) {
    throw new RangeError('Ungültige Fehlerauswahl');
  }
  return {
    questions: shuffle(references.map(q => ({ ...byCode.get(q.code), topic: q.topic })), random),
    index: 0, answers: [], practice: true, finished: false, mode: 'correction', region: 'Welt', clearedCount: 0,
  };
}

export function answer(game, code, validCodes) {
  if (!game || game.finished || game.answers.length > game.index || !validCodes.has(code)) return false;
  const target = currentQuestion(game);
  game.answers.push({ target: target.code, selected: code, correct: code === target.code,
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
  return createGame(questions, questions.length, random, true);
}
