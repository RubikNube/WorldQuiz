import { CONTINENTS, currentQuestion, questionTopic } from './game.js';

export const PROGRESS_TOPICS = ['quiz', 'capitals', 'flags', 'population', 'river', 'mountain'];
const KEY = 'worldQuizProgress';
const integer = n => Number.isSafeInteger(n) && n >= 0;
const timestamp = n => integer(n) && n <= 8640000000000000;

export function createProgress(countries, storageProvider = () => globalThis.localStorage, rivers = [], mountains = [], clock = Date.now) {
  const targets = new Map(PROGRESS_TOPICS.map(topic => [topic, new Map(
    (topic === 'river' ? rivers : topic === 'mountain' ? mountains : countries).map(target => [target.code, target]))]));
  const validTarget = (topic, code) => targets.get(topic)?.has(code);
  let entries = new Map(), buckets = new Map(), rounds = [], sequence = 0;
  const answered = new WeakSet(), completed = new WeakSet();
  let storage, persistent = true;
  const validEvent = e => e && validTarget(e.topic, e.code) && typeof e.correct === 'boolean'
    && typeof e.practice === 'boolean' && timestamp(e.at) && integer(e.sequence);
  const validRound = r => r && ['mixed', 'correction', ...PROGRESS_TOPICS].includes(r.mode)
    && ['Welt', ...CONTINENTS].includes(r.region) && typeof r.practice === 'boolean'
    && timestamp(r.at) && integer(r.sequence) && integer(r.total) && r.total > 0
    && integer(r.correct) && r.correct <= r.total && Array.isArray(r.topics) && r.topics.length > 0
    && r.topics.every(topic => PROGRESS_TOPICS.includes(topic));
  const newest = (a, b) => b.sequence - a.sequence;
  function addEvent(event) {
    const key = `${targets.get(event.topic).get(event.code).continent}:${event.topic}`;
    buckets.set(key, [event, ...(buckets.get(key) ?? [])].sort(newest).slice(0, 100));
  }
  try {
    storage = storageProvider();
    const raw = storage.getItem(KEY);
    let saved;
    try { saved = JSON.parse(raw); } catch { /* Ignore malformed JSON. */ }
    if (saved?.version === 1) {
      for (const entry of Array.isArray(saved.entries) ? saved.entries : []) {
        if (entry && validTarget(entry.topic, entry.code) && integer(entry.attempts) && entry.attempts > 0
          && integer(entry.correct) && entry.correct <= entry.attempts && integer(entry.practice)
          && entry.practice <= entry.attempts) {
          entries.set(`${entry.topic}:${entry.code}`, { topic: entry.topic, code: entry.code,
            attempts: entry.attempts, correct: entry.correct, practice: entry.practice });
        }
      }
      for (const event of Array.isArray(saved.events) ? saved.events : []) if (validEvent(event)) {
        addEvent({ topic: event.topic, code: event.code, correct: event.correct, practice: event.practice,
          at: event.at, sequence: event.sequence });
        sequence = Math.max(sequence, event.sequence);
      }
      rounds = (Array.isArray(saved.rounds) ? saved.rounds : []).filter(validRound).map(r => ({
        mode: r.mode, region: r.region, practice: r.practice, at: r.at, sequence: r.sequence,
        total: r.total, correct: r.correct, topics: [...new Set(r.topics)],
      })).sort(newest).slice(0, 100);
      for (const round of rounds) sequence = Math.max(sequence, round.sequence);
    }
  } catch { persistent = false; }
  function save() {
    if (!persistent) return;
    try {
      storage.setItem(KEY, JSON.stringify({ version: 1, entries: [...entries.values()],
        events: [...buckets.values()].flat(), rounds }));
    } catch { persistent = false; }
  }
  function matches(topic, code, filter) {
    return (!filter.topic || filter.topic === topic)
      && (!filter.region || filter.region === 'Welt' || targets.get(topic).get(code).continent === filter.region);
  }
  return {
    get persistent() { return persistent; },
    recordAnswer(game) {
      const target = currentQuestion(game), response = game?.answers?.[game.index], topic = questionTopic(game);
      if (!target || !response || response.target !== target.code || typeof response.correct !== 'boolean'
        || !validTarget(topic, target.code) || answered.has(response)) return false;
      answered.add(response);
      const key = `${topic}:${target.code}`;
      const entry = entries.get(key) ?? { topic, code: target.code, attempts: 0, correct: 0, practice: 0 };
      entry.attempts++;
      entry.correct += Number(response.correct);
      entry.practice += Number(Boolean(game.practice));
      entries.set(key, entry);
      addEvent({ topic, code: target.code, correct: response.correct, practice: Boolean(game.practice),
        at: clock(), sequence: ++sequence });
      save();
      return true;
    },
    recordCompletedRound(game) {
      if (!game || !game.finished || completed.has(game) || !Array.isArray(game.questions)
        || !game.questions.length || !Array.isArray(game.answers) || game.answers.length !== game.questions.length
        || !['mixed', 'correction', ...PROGRESS_TOPICS].includes(game.mode)
        || !['Welt', ...CONTINENTS].includes(game.region)
        || game.questions.some((q, index) => !validTarget(questionTopic(game, q), q.code)
          || game.answers[index]?.target !== q.code || typeof game.answers[index]?.correct !== 'boolean')) return false;
      completed.add(game);
      rounds.unshift({ mode: game.mode, region: game.region, practice: Boolean(game.practice),
        at: clock(), sequence: ++sequence, total: game.questions.length,
        correct: game.answers.filter(a => a.correct).length,
        topics: [...new Set(game.questions.map(q => questionTopic(game, q)))] });
      rounds = rounds.slice(0, 100);
      save();
      return true;
    },
    getSummary(filter = {}) {
      const selected = [...entries.values()].filter(e => matches(e.topic, e.code, filter));
      const recent = [...buckets.values()].flat().filter(e => matches(e.topic, e.code, filter)).sort(newest).slice(0, 100);
      let available = 0;
      for (const [topic, pool] of targets) for (const code of pool.keys()) if (matches(topic, code, filter)) available++;
      const attempts = selected.reduce((n, e) => n + e.attempts, 0);
      const practice = selected.reduce((n, e) => n + e.practice, 0);
      return { attempts, correct: selected.reduce((n, e) => n + e.correct, 0), practice, normal: attempts - practice,
        covered: selected.length, available, recentAttempts: recent.length, recentCorrect: recent.filter(e => e.correct).length };
    },
    getRecentRounds({ topic, region } = {}) {
      return rounds.filter(r => (!topic || r.topics.includes(topic)) && (!region || region === 'Welt' || r.region === region))
        .slice(0, 20).map(r => ({ ...r, topics: [...r.topics] }));
    },
  };
}
