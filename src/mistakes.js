import { currentQuestion, questionTopic, shuffle } from './game.js';

const STORAGE_KEY = 'worldQuizMistakes';
export const REVIEW_INTERVALS = Object.freeze([1, 3, 7, 14, 30, 30, 30]);
const DAY = 24 * 60 * 60 * 1000;
const timestamp = value => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;

export function createMistakes(countries, storageProvider = () => globalThis.localStorage, rivers = [], mountains = [], clock = Date.now) {
  const codes = new Set(countries.map(c => c.code));
  const riverCodes = new Set(rivers.map(r => r.code));
  const mountainCodes = new Set(mountains.map(m => m.code));
  const entries = new Map();
  const recorded = new WeakSet();
  const validTarget = entry => entry && (entry.topic === 'mountain' ? mountainCodes.has(entry.code) : entry.topic === 'river' ? riverCodes.has(entry.code)
    : ['quiz', 'capitals', 'flags', 'population'].includes(entry.topic) && codes.has(entry.code));
  const valid = entry => validTarget(entry) && (entry.status === 'correction'
    ? entry.streak === 0 || entry.streak === 1
    : entry.status === 'review' && Number.isInteger(entry.stage) && entry.stage >= 0
      && entry.stage < REVIEW_INTERVALS.length && timestamp(entry.dueAt));
  let storage, persistent = true;
  function save() {
    if (!persistent) return;
    try { storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, entries: [...entries.values()] })); }
    catch { persistent = false; }
  }
  try {
    storage = storageProvider();
    const raw = storage.getItem(STORAGE_KEY);
    let saved;
    try { saved = JSON.parse(raw); } catch { /* Ignore malformed JSON. */ }
    if ([1, 2].includes(saved?.version) && Array.isArray(saved.entries)) {
      for (const entry of saved.entries) {
        const candidate = saved.version === 1 && entry ? { ...entry, status: 'correction' } : entry;
        if (!valid(candidate)) continue;
        const { topic, code, status, streak, stage, dueAt } = candidate;
        entries.set(`${topic}:${code}`, status === 'correction'
          ? { topic, code, status, streak } : { topic, code, status, stage, dueAt });
      }
      if (saved.version === 1) save();
    }
  } catch { persistent = false; }

  return {
    get persistent() { return persistent; },
    get count() { return [...entries.values()].filter(e => e.status === 'correction').length; },
    get dueCount() {
      const now = clock();
      return [...entries.values()].filter(e => e.status === 'review' && e.dueAt <= now).length;
    },
    get reviewCount() { return [...entries.values()].filter(e => e.status === 'review').length; },
    get nextDueAt() {
      const dates = [...entries.values()].filter(e => e.status === 'review').map(e => e.dueAt);
      return dates.length ? Math.min(...dates) : null;
    },
    get entries() { return [...entries.values()].map(entry => ({ ...entry })); },
    selectQuestions(random = Math.random) {
      const values = [...entries.values()], now = clock();
      return [...shuffle(values.filter(e => e.status === 'correction' && e.streak === 0), random),
        ...shuffle(values.filter(e => e.status === 'correction' && e.streak === 1), random),
        ...shuffle(values.filter(e => e.status === 'review' && e.dueAt <= now), random).sort((a, b) => a.dueAt - b.dueAt)]
        .slice(0, 10).map(e => ({ ...e }));
    },
    recordAnswer(game) {
      const target = currentQuestion(game);
      const response = game?.answers?.[game.index];
      const topic = questionTopic(game);
      if (!target || !response || response.target !== target.code || recorded.has(response)
        || !validTarget({ topic, code: target.code })) return null;
      recorded.add(response);
      const key = `${topic}:${target.code}`, previous = entries.get(key), now = clock();
      if (response.correct && (!previous || (previous.status === 'review' && previous.dueAt > now))) return null;
      let entry, result;
      if (!response.correct) {
        entry = { topic, code: target.code, status: 'correction', streak: 0 };
        result = { transition: previous ? 'reopened' : 'added', streak: 0, cleared: false };
      } else if (previous.status === 'correction' && previous.streak === 0) {
        entry = { ...previous, streak: 1 };
        result = { transition: 'correcting', streak: 1, cleared: false };
      } else if (previous.status === 'review' && previous.stage === REVIEW_INTERVALS.length - 1) {
        result = { transition: 'graduated', cleared: false };
      } else {
        const stage = previous.status === 'correction' ? 0 : previous.stage + 1;
        entry = { topic, code: target.code, status: 'review', stage, dueAt: now + REVIEW_INTERVALS[stage] * DAY };
        result = { transition: previous.status === 'correction' ? 'scheduled' : 'reviewed',
          cleared: previous.status === 'correction', dueAt: entry.dueAt };
      }
      if (entry) entries.set(key, entry);
      else entries.delete(key);
      save();
      return result;
    },
  };
}
