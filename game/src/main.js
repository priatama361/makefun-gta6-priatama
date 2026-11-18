// Thin browser boot: wire input, simulation, sound, rendering and saving, then
// run a fixed-step loop. The URL's shot parameter renders a staged still.

import { MUTE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createSave } from './save.js';
import {
  createWorld, EVENT_CASH, EVENT_CRASH, EVENT_ENTER, EVENT_EXIT, EVENT_HIT,
  EVENT_OVER, EVENT_RANKUP, EVENT_SHOP, EVENT_SHOT, EVENT_STORY, EVENT_WANTED,
} from './world.js';
import { createInput } from './input.js';
import {
  createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE,
} from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.2;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const save = createSave();
const progress = save.load();
const world = createWorld(createRandom(seed), progress);
const renderer = createRenderer(canvas, world);
const audio = createAudio();

function storedMute() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function storeMute(value) {
  try {
    window.localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Sound preference simply does not persist when storage is blocked.
  }
}

function persist() {
  const p = world.state.progress;
  const next = save.commit({
    money: p.money,
    rep: p.rep,
    completed: p.completed,
    earned: p.earned,
    missionsDone: p.missionsDone,
    best: Math.max(p.best, save.data().best),
  });
  world.state.stats.best = next.best;
  return next;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = save.data().best;
  let muted = storedMute();
  let accumulator = 0;
  let saveTimer = 0;
  let last = performance.now();
  audio.setMuted(muted);

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
    aimX: world.state.player.x + 160, aimY: world.state.player.y,
  };

  function startGame() {
    audio.unlock();
    world.reset();
    best = persist().best;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing Solana Bay. Drive to the marker and follow the story.');
  }

  function newStory() {
    const blank = save.reset();
    Object.assign(world.state.progress, blank);
    world.state.rank.name = 'STREET ROOKIE';
    world.reset();
    best = blank.best;
    screen = SCREEN_TITLE;
    announce('New story started. Progress cleared.');
  }

  function react(events) {
    if (events & EVENT_SHOT) audio.play('shot');
    if (events & EVENT_HIT) {
      audio.play('hit');
      announce(`Hit. ${Math.ceil(world.state.player.health)} health left.`);
    }
    if (events & EVENT_CASH) audio.play('cash');
    if (events & EVENT_CRASH) audio.play('crash');
    if (events & EVENT_ENTER) audio.play('enter');
    if (events & EVENT_EXIT) audio.play('enter');
    if (events & EVENT_SHOP) audio.play('shop');
    if (events & EVENT_WANTED) audio.play('wanted');
    if (events & EVENT_STORY) {
      audio.play('story');
      persist();
      const job = world.state.mission;
      announce(`Mission complete. Next: ${job.def.title}.`);
    }
    if (events & EVENT_RANKUP) {
      audio.play('rankup');
      announce(`Rank up: ${world.state.rank.name}.`);
    }
    if (events & EVENT_OVER) {
      audio.play('over');
      persist();
      screen = SCREEN_OVER;
      announce('Busted. Press space to carry on from your last save.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const delta = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += delta;
    last = now;
    const presses = input.takePresses();

    if (presses.has('KeyM')) {
      muted = !muted;
      audio.setMuted(muted);
      storeMute(muted);
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (presses.has('KeyN') && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) newStory();
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
      idle.aimX = world.state.player.x + 160;
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
      saveTimer += delta;
      if (saveTimer > 8) {
        saveTimer = 0;
        persist();
      }
    } else accumulator = 0;

    audio.setEngine(world.state.player.car ? Math.abs(world.state.player.car.speed) : 0, screen === SCREEN_PLAY && !!world.state.player.car);
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      persist();
      announce('Paused.');
    }
  });
  window.addEventListener('beforeunload', persist);

  announce('Solana Bay. Press Space to start, N on the title for a new story.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
