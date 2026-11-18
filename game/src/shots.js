import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

export function stageShot(name, world) {
  world.stage(name);
  if (name === 'play') return { screen: SCREEN_PLAY, best: 12400 };
  if (name === 'end') return { screen: SCREEN_OVER, best: 12400 };
  return { screen: SCREEN_TITLE, best: 12400 };
}
