// Deterministic staged game states for the four real browser captures. Each
// scene calls the same world.stage() a live game uses, so no render is faked.

import { SCREEN_PLAY } from './render.js';

const BEST = { cover: 12450, onfoot: 2860, combat: 6420, story: 12680 };

export function stageShot(name, world) {
  const scene = Object.hasOwn(BEST, name) ? name : 'cover';
  world.stage(scene);
  return { screen: SCREEN_PLAY, best: BEST[scene] };
}
