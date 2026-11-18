import { BEST_KEY, MUTE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CASH, EVENT_CRASH, EVENT_HIT, EVENT_JOB, EVENT_OVER, EVENT_SHOT, EVENT_WANTED } from './world.js';
import { createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas, world);
const audio = createAudio();

function storedNumber(key) {
  try {
    return Number.parseInt(window.localStorage.getItem(key) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function store(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    return;
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = storedNumber(BEST_KEY);
  let muted = storedNumber(MUTE_KEY) === 1;
  let accumulator = 0;
  let last = performance.now();
  audio.setMuted(muted);
  world.state.stats.best = best;

  function announce(message) {
    status.textContent = message;
  }

  function controlsFrom(presses) {
    const axis = input.axis();
    const aim = renderer.toWorld(input.pointer.x, input.pointer.y, world.state);
    return {
      moveX: axis.x,
      moveY: axis.y,
      sprint: input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
      fire: input.isDown('Mouse0') || input.isDown('KeyJ'),
      handbrake: input.isDown('Space'),
      interactHeld: input.isDown('KeyE'),
      interact: presses.has('KeyE'),
      reload: presses.has('KeyR'),
      switchWeapon: presses.has('KeyQ'),
      aimX: aim.x,
      aimY: aim.y,
    };
  }

  const idle = {
    moveX: 0, moveY: 0, sprint: false, fire: false, handbrake: false,
    interactHeld: false, interact: false, reload: false, switchWeapon: false,
    aimX: world.state.player.x + 100, aimY: world.state.player.y,
  };

  function startGame() {
    audio.unlock();
    world.reset();
    world.state.stats.best = best;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Complete jobs, earn cash, lose the cops.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.stats.earned > best) {
      best = world.state.stats.earned;
      store(BEST_KEY, best);
    }
    world.state.stats.best = best;
    announce(`Game over. Earned ${world.state.stats.earned}. Best ${best}.`);
  }

  function react(events) {
    if (events & EVENT_SHOT) audio.play('shot');
    if (events & EVENT_HIT) {
      audio.play('hit');
      announce(`Hit. ${Math.ceil(world.state.player.health)} health left.`);
    }
    if (events & EVENT_CASH) audio.play('cash');
    if (events & EVENT_CRASH) audio.play('crash');
    if (events & EVENT_JOB) {
      audio.play('job');
      announce(`Job complete. ${world.state.player.money} dollars.`);
    }
    if (events & EVENT_WANTED) audio.play('wanted');
    if (events & EVENT_OVER) {
      audio.play('over');
      endGame();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const presses = input.takePresses();

    if (presses.has('KeyM')) {
      muted = !muted;
      audio.setMuted(muted);
      store(MUTE_KEY, muted ? 1 : 0);
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (presses.has('Space') || presses.has('Enter') || presses.has('Mouse0')) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (presses.has('KeyP') || presses.has('Escape')) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }

    if (screen === SCREEN_TITLE) {
      idle.aimX = world.state.player.x + 120;
      idle.aimY = world.state.player.y - 40;
      while (accumulator >= STEP) {
        world.step(STEP, idle, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      const controls = controlsFrom(presses);
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        react(world.step(STEP, controls));
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }

    audio.setEngine(world.state.player.car ? Math.abs(world.state.player.car.speed) : 0, screen === SCREEN_PLAY && !!world.state.player.car);
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Shores. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
