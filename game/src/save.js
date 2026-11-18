import { SAVE_KEY } from './config.js';

export function freshProgress() {
  return { money: 350, reputation: 0, missionIndex: 0, completed: 0, bestRank: 0, seenIntro: false };
}

export function loadProgress() {
  const fallback = freshProgress();
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return fallback;
    return {
      money: Number.isFinite(parsed.money) ? Math.max(0, Math.floor(parsed.money)) : fallback.money,
      reputation: Number.isFinite(parsed.reputation) ? Math.max(0, Math.floor(parsed.reputation)) : 0,
      missionIndex: Number.isInteger(parsed.missionIndex) ? Math.max(0, Math.min(6, parsed.missionIndex)) : 0,
      completed: Number.isFinite(parsed.completed) ? Math.max(0, Math.floor(parsed.completed)) : 0,
      bestRank: Number.isFinite(parsed.bestRank) ? Math.max(0, Math.floor(parsed.bestRank)) : 0,
      seenIntro: parsed.seenIntro === true,
    };
  } catch {
    return fallback;
  }
}

export function saveProgress(progress) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  } catch {
    return false;
  }
  return true;
}

export function clearProgress() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    return false;
  }
  return true;
}
