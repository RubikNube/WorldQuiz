import { CONTINENTS, eligibleCountries, allowedCounts, score } from "./game.js";

const STORAGE_KEY = "worldQuizHighscores";

// Each topic's data determines its valid round sizes for each region.
export function createHighscores(countries, storageProvider = () => globalThis.localStorage, rivers = []) {
  const counts = new Map(['Welt', ...CONTINENTS].map(region =>
    [region, allowedCounts(eligibleCountries(countries, region).length)]));
  const riverCounts = new Map(['Welt', ...CONTINENTS].map(region =>
    [region, allowedCounts(eligibleCountries(rivers, region).length).filter(n => n > 0)]));
  function validRecord(mode, region, count, points) {
    return ['quiz', 'capitals', 'flags', 'population', 'river'].includes(mode)
      && (mode === 'river' ? riverCounts : counts).get(region)?.includes(count)
      && Number.isInteger(points) && points >= 0 && points <= count;
  }
  const records = new Map();
  const completed = new WeakMap();
  let storage;
  let persistent = true;
  try {
    storage = storageProvider();
    const raw = storage.getItem(STORAGE_KEY);
    let saved;
    try { saved = JSON.parse(raw); } catch { /* Discard malformed data. */ }
    if (saved?.version === 1 && saved.records && typeof saved.records === "object" && !Array.isArray(saved.records)) {
      for (const [key, score] of Object.entries(saved.records)) {
        const [mode, region, countText] = key.split(":");
        const count = Number(countText);
        if (key === `${mode}:${region}:${count}` && validRecord(mode, region, count, score)) records.set(key, score);
      }
    }
  } catch {
    persistent = false;
  }
  const sessionOnly = !persistent;

  function resetTo(next) {
    // A failed persistent reset must leave both copies of the records intact.
    if (!sessionOnly) {
      try {
        if (next.size) storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: Object.fromEntries(next) }));
        else storage.removeItem(STORAGE_KEY);
      } catch {
        return false;
      }
      persistent = true;
    }
    records.clear();
    for (const [key, score] of next) records.set(key, score);
    return true;
  }

  return {
    get persistent() { return persistent; },
    get hasRecords() { return records.size > 0; },
    getBest(mode, region, count) { return records.get(`${mode}:${region}:${count}`) ?? null; },
    resetRecord(mode, region, count) {
      if (!validRecord(mode, region, count, 0)) return false;
      const next = new Map(records);
      if (!next.delete(`${mode}:${region}:${count}`)) return true;
      return resetTo(next);
    },
    resetAll() { return resetTo(new Map()); },
    recordCompletedRound(game) {
      if (!game || game.practice || game.finished !== true || !Array.isArray(game.questions)
        || !Array.isArray(game.answers) || game.answers.length !== game.questions.length
        || !validRecord(game.mode, game.region, game.questions.length, score(game))) return null;
      if (completed.has(game)) return completed.get(game);

      const count = game.questions.length;
      const key = `${game.mode}:${game.region}:${count}`;
      const previous = records.get(key);
      const kind = previous === undefined ? "first" : score(game) > previous ? "improved"
        : score(game) === previous ? "tied" : "lower";
      const best = Math.max(previous ?? 0, score(game));
      const result = { kind, best, count };
      completed.set(game, result);
      if (kind === "first" || kind === "improved") {
        records.set(key, best);
        if (persistent) {
          try {
            storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: Object.fromEntries(records) }));
          } catch {
            persistent = false;
          }
        }
      }
      return result;
    },
  };
}

export function highscoreMessage(result) {
  if (!result) return "";
  const labels = { first: "Erster Rekord", improved: "Neuer Rekord", tied: "Rekord eingestellt", lower: "Dein Rekord" };
  return `${labels[result.kind]}: ${result.best}/${result.count}${result.kind === "lower" ? "." : "!"}`;
}
