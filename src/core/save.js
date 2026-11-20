/**
 * Save / continue.
 *
 * A run is checkpointed at every room transition, so CONTINUE asks for a
 * confirmed NEW GAME and then replays the same dungeon with the player's
 * accumulated level, souls and flasks.
 */
const KEY = 'shattered-crown/save/v1';

export function getSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !data.seed) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

export function hasSave() {
  return !!getSave();
}
