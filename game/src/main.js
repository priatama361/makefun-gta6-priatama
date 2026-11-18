// Boot and the main loop. Input is sampled every frame; the simulation advances in fixed 1/60 s
// steps and the renderer paints whatever state exists. Screens are title, play, paused, game over
// and victory. ?shot=cover|onfoot|combat|story stages a scene for the capture script.
import { FIELD, STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createEffects } from './effects.js';
import { createWorld, EVENT_CASH, EVENT_CRASH, EVENT_HIT, EVENT_MISSION, EVENT_OVER, EVENT_SIREN, EVENT_SHOT } from './world.js';
import { createInput, ACTION_CONFIRM, ACTION_INTERACT, ACTION_PAUSE, ACTION_RESTART } from './input.js';
import { createAudio } from './audio.js';
import { clearProgress, loadProgress, saveProgress } from './save.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedValue = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedValue) ? seedValue : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const city = createCity(random);
const effects = createEffects(random);
const world = createWorld(random, city, effects);
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

// A small read-only inspection hook: useful for checking a run in a browser console and for the
// local smoke test. It never changes the rules or the rendering.
window.__solana = {
  state: world.state,
  get screen() { return activeScreen; },
  get seed() { return seed; },
  world,
};

let activeScreen = shot ? 'shot' : SCREEN_TITLE;

/** Save the fields that matter between visits. */
function persist() {
  const state = world.state;
  saveProgress({
    missionIndex: state.victory ? 6 : state.mission.index,
    money: state.money,
    reputation: state.reputation,
    completed: state.victory,
    bestTime: state.elapsed,
  });
}

/** Play the sound cues attached to world events and speak important changes. */
function reactToEvents(events) {
  if (events & EVENT_SHOT) audio.play('shot');
  if (events & EVENT_SIREN) {
    audio.play('siren');
    status.textContent = 'Police response!';
  }
  if (events & (EVENT_HIT | EVENT_CRASH)) audio.play(events & EVENT_CRASH ? 'crash' : 'hit');
  if (events & EVENT_CASH) audio.play('cash');
  if (events & EVENT_MISSION) {
    audio.play('mission');
    status.textContent = `Job complete. ${world.state.money} dollars, ${world.state.reputation} reputation.`;
  }
  if (events & EVENT_OVER) status.textContent = 'Game over. Press R to restart.';
  if (events & (EVENT_CASH | EVENT_MISSION | EVENT_OVER)) persist();
}

/** Build the control snapshot one simulation step needs. */
function controlSnapshot() {
  const pointer = renderer.toField(input.pointer().x, input.pointer().y);
  const camera = world.state.camera;
  return {
    axisX: input.axisX(),
    axisY: input.axisY(),
    firing: input.firing(),
    handbrake: input.handbrake(),
    sprinting: input.sprinting(),
    actions: input.takeActions(),
    aim: { x: pointer.x - FIELD.width / 2 + camera.x, y: pointer.y - FIELD.height / 2 + camera.y },
  };
}

/** Paint a staged scene without advancing the world. */
function runShot(name) {
  const scene = stageShot(name, world, effects);
  let frames = 0;
  function paint() {
    frames += 1;
    renderer.draw(world.state, scene.screen, {
      effects,
      targets: world.targets(),
      objective: world.objectiveText(),
      time: scene.time + frames / 60,
      showPrompt: name !== 'story',
    });
    if (frames < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

/** The playable game loop. */
function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function begin(fresh) {
    if (fresh) clearProgress();
    world.reset(fresh ? null : loadProgress());
    accumulator = 0;
    screen = world.state.victory ? SCREEN_VICTORY : SCREEN_PLAY;
    audio.resume();
    audio.play('enter');
    status.textContent = 'Playing Solana Bay.';
  }

  function handleActions(actions) {
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) begin(false);
    else if (actions & ACTION_CONFIRM && (screen === SCREEN_OVER || screen === SCREEN_VICTORY)) begin(true);
    else if (actions & ACTION_CONFIRM && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      status.textContent = 'Playing.';
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      status.textContent = 'Paused.';
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      status.textContent = 'Playing.';
    } else if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) begin(true);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const controls = controlSnapshot();
    handleActions(controls.actions);
    activeScreen = screen;
    if (screen === SCREEN_PLAY) {
      let steps = 0;
      while (accumulator >= STEP && steps < 8 && screen === SCREEN_PLAY) {
        const events = world.step(STEP, controls);
        reactToEvents(events);
        if (events & EVENT_OVER) screen = SCREEN_OVER;
        if (world.state.victory) {
          screen = SCREEN_VICTORY;
          persist();
        }
        controls.actions = 0;
        controls.firing = input.firing();
        accumulator -= STEP;
        steps += 1;
      }
      audio.setEngine(world.state.player.car?.speed ?? 0, Boolean(world.state.player.inCar));
    } else {
      accumulator = 0;
      audio.setEngine(0, false);
    }
    renderer.draw(world.state, screen, {
      effects,
      targets: world.targets(),
      objective: world.objectiveText(),
      time: now / 1000,
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      status.textContent = 'Paused.';
    }
  });

  status.textContent = 'Solana Bay. Press Enter or click to start.';
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
