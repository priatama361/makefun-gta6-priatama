// Local persistence for money, reputation, rank progress and story position.
// Storage can be disabled or full, so every access is guarded and the game
// still runs with an in-memory copy when the browser refuses to save.

import { SAVE_KEY } from './config.js';

const BLANK = {
  money: 400,
  rep: 0,
  completed: 0,
  earned: 0,
  missionsDone: 0,
  best: 0,
};

function whole(value, fallback, low, high) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(low, Math.min(high, number));
}

export function createSave(storage = window.localStorage) {
  let data = { ...BLANK };

  function load() {
    try {
      const raw = storage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          data = {
            money: whole(parsed.money, BLANK.money, 0, 999999999),
            rep: whole(parsed.rep, 0, 0, 999999999),
            completed: whole(parsed.completed, 0, 0, 99),
            earned: whole(parsed.earned, 0, 0, 999999999),
            missionsDone: whole(parsed.missionsDone, 0, 0, 99999),
            best: whole(parsed.best, 0, 0, 999999999),
          };
        }
      }
    } catch {
      data = { ...BLANK };
    }
    return data;
  }

  function commit(next) {
    data = { ...data, ...next };
    try {
      storage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Progress stays in memory for this session when storage is unavailable.
    }
    return data;
  }

  function reset() {
    data = { ...BLANK };
    try {
      storage.removeItem(SAVE_KEY);
    } catch {
      // Nothing else to do: the in-memory copy is already clean.
    }
    return data;
  }

  return { load, commit, reset, data: () => ({ ...data }) };
}
