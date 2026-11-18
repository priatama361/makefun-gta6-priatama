import { FIELD, SHOT_SECONDS, STEP } from './config.js';
import { angleTowards, distanceBetween } from './random.js';
import { SCREEN_BRIEF, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SCENE_INDEX = { cover: 0, onfoot: 3, combat: 2, story: 5 };

export function stageShot(name, world, city) {
  const scene = Object.hasOwn(SCENE_INDEX, name) ? name : 'cover';
  const progress = {
    money: scene === 'cover' ? 350 : scene === 'story' ? 12450 : 4980,
    reputation: scene === 'cover' ? 0 : scene === 'story' ? 205 : 96,
    missionIndex: scene === 'cover' ? 0 : scene === 'story' ? 5 : SCENE_INDEX[scene],
    completed: scene === 'cover' ? 0 : SCENE_INDEX[scene],
    bestRank: 0,
    seenIntro: true,
  };
  world.reset(progress);
  if (scene !== 'cover' && scene !== 'story') world.startMission(SCENE_INDEX[scene]);
  if (scene === 'onfoot') {
    const spot = city.findLandmark('shop1');
    world.state.player.x = spot.x - 58;
    world.state.player.y = spot.y + 22;
  }
  if (scene === 'combat') {
    world.addWanted(4.2);
    world.state.player.health = 100;
    world.state.player.armor = 80;
    world.state.player.invulnerable = 999;
    const square = city.findLandmark('garage');
    world.state.player.x = square.x;
    world.state.player.y = square.y;
  }
  if (scene === 'story') world.startMission(5);

  const seconds = SHOT_SECONDS[scene] ?? 3;
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const state = world.state;
    const objective = world.currentObjective();
    let axis = { x: 0, y: 0 };
    if (objective !== null && objective.type === 'goto' && state.player.car !== null) {
      const target = city.findLandmark(objective.place);
      axis = { x: Math.sign(target.x - state.player.x) * 0.4, y: -Math.abs(Math.sign(target.y - state.player.y)) };
    }
    let aimX = state.player.x + Math.cos(state.player.aim) * 200;
    let aimY = state.player.y + Math.sin(state.player.aim) * 200;
    if (scene === 'combat' && state.cops.length > 0) {
      aimX = state.cops[0].x;
      aimY = state.cops[0].y;
    }
    world.step(STEP, {
      axis,
      aimX,
      aimY,
      firing: scene === 'combat' && index % 9 < 2,
      sprint: false,
    });
    if (state.phase === 'dead') break;
  }
  if (scene === 'story') world.state.phase = 'brief';
  return { screen: scene === 'cover' ? SCREEN_TITLE : scene === 'story' ? SCREEN_BRIEF : SCREEN_PLAY };
}
