import { currentQuestion, questionTopic, shuffle } from './game.js';

const STORAGE_KEY = 'worldQuizMistakes';

export function createMistakes(countries, storageProvider = () => globalThis.localStorage, rivers = []) {
  const codes = new Set(countries.map(c => c.code));
  const riverCodes = new Set(rivers.map(r => r.code));
  const entries = new Map();
  const recorded = new WeakSet();
  const valid = entry => entry && (entry.topic === 'river' ? riverCodes.has(entry.code)
    : ['quiz', 'capitals', 'flags', 'population'].includes(entry.topic) && codes.has(entry.code))
    && (entry.streak === 0 || entry.streak === 1);
  let storage, persistent = true;
  try {
    storage = storageProvider();
    const raw = storage.getItem(STORAGE_KEY);
    let saved;
    try { saved = JSON.parse(raw); } catch { /* Ignore malformed JSON. */ }
    if (saved?.version === 1 && Array.isArray(saved.entries)) {
      for (const entry of saved.entries) if (valid(entry)) {
        const { topic, code, streak } = entry;
        entries.set(`${topic}:${code}`, { topic, code, streak });
      }
    }
  } catch { persistent = false; }

  return {
    get persistent() { return persistent; },
    get count() { return entries.size; },
    get entries() { return [...entries.values()].map(entry => ({ ...entry })); },
    selectQuestions(random = Math.random) {
      const values = [...entries.values()];
      return [...shuffle(values.filter(e => e.streak === 0), random),
        ...shuffle(values.filter(e => e.streak === 1), random)].slice(0, 10).map(e => ({ ...e }));
    },
    recordAnswer(game) {
      const target = currentQuestion(game);
      const response = game?.answers?.[game.index];
      const topic = questionTopic(game);
      if (!target || !response || response.target !== target.code || recorded.has(response)
        || !valid({ topic, code: target.code, streak: 0 })) return null;
      recorded.add(response);
      const key = `${topic}:${target.code}`;
      const previous = entries.get(key);
      if (response.correct && !previous) return null;
      const streak = response.correct ? previous.streak + 1 : 0;
      if (streak === 2) entries.delete(key);
      else entries.set(key, { topic, code: target.code, streak });
      if (persistent) {
        try { storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries: [...entries.values()] })); }
        catch { persistent = false; }
      }
      return { streak, cleared: streak === 2 };
    },
  };
}
