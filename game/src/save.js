// Browser-local progression. Saving is best effort: a private window can refuse localStorage and
// the game simply continues with the current session's progress.
import { SAVE_KEY } from './config.js';

/** Read a saved run, returning a fresh default when nothing valid is stored. */
export function loadProgress() {
  const empty = { missionIndex: 0, money: 250, reputation: 0, stars: 0, completed: false, bestTime: 0 };
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return empty;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return empty;
    return {
      missionIndex: Math.max(0, Math.min(6, Number(data.missionIndex) || 0)),
      money: Math.max(0, Number(data.money) || 0),
      reputation: Math.max(0, Number(data.reputation) || 0),
      stars: Math.max(0, Number(data.stars) || 0),
      completed: Boolean(data.completed),
      bestTime: Math.max(0, Number(data.bestTime) || 0),
    };
  } catch {
    return empty;
  }
}

/** Store the given run. */
export function saveProgress(progress) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore disabled or full storage.
  }
}

/** Remove the saved run so the next start is a fresh STREET ROOKIE. */
export function clearProgress() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore disabled storage.
  }
}
