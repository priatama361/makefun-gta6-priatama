import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createWorld, EVENT_GAME_OVER, EVENT_MISSION_DONE, EVENT_OBJECTIVE } from './world.js';
import { createRenderer, SCREEN_BRIEF, SCREEN_INTERMISSION, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { ACTION_CONFIRM, ACTION_MAP, ACTION_PAUSE, ACTION_RESTART, ACTION_VEHICLE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { clearProgress, freshProgress, loadProgress, saveProgress } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedValue = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedValue) ? seedValue : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const city = createCity(createRandom(seed ^ 0x51f0a7c3));
const audio = createAudio();
const world = createWorld(createRandom(seed ^ 0x1b873593), city, audio);
const renderer = createRenderer(canvas, city);
const input = createInput(canvas);

function announce(message) {
  status.textContent = message;
}

function persist() {
  const state = world.state;
  saveProgress({
    money: state.money,
    reputation: state.reputation,
    missionIndex: state.phase === 'intermission' ? state.missionIndex + 1 : state.missionIndex,
    completed: Math.max(state.missionIndex, state.phase === 'intermission' ? state.missionIndex + 1 : 0),
    bestRank: state.reputation,
    seenIntro: true,
  });
}

function runShot(name) {
  const scene = stageShot(name, world, city);
  let frames = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, world);
    frames += 1;
    if (frames < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let progress = loadProgress();
  let accumulator = 0;
  let saveTimer = 0;
  let last = performance.now();
  world.reset(progress);

  function beginRun() {
    audio.unlock();
    progress = loadProgress();
    world.reset(progress);
    renderer.resetCamera();
    screen = world.state.phase === 'brief' ? SCREEN_BRIEF : world.state.phase === 'won' ? SCREEN_WIN : SCREEN_PLAY;
    announce(`Solana Bay. ${world.objectiveText()}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) beginRun();
    } else if (screen === SCREEN_BRIEF) {
      if (actions & ACTION_CONFIRM) {
        world.startMission(world.state.missionIndex);
        screen = SCREEN_PLAY;
        persist();
        announce(`Accepted ${world.state.mission.title}. ${world.objectiveText()}.`);
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & ACTION_VEHICLE && world.toggleVehicle()) {
        announce(world.state.player.car === null ? 'On foot.' : 'Driving.');
      } else if (actions & ACTION_MAP) {
        announce(`${world.objectiveText()}. Cash ${world.state.money}. Reputation ${world.state.reputation}.`);
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_INTERMISSION) {
      if (actions & ACTION_CONFIRM) {
        world.finishIntermission();
        persist();
        screen = world.state.phase === 'won' ? SCREEN_WIN : SCREEN_BRIEF;
        announce(world.state.phase === 'won' ? 'King of Solana Bay.' : `Next job: ${world.state.mission.title}.`);
      }
    } else if (screen === SCREEN_OVER) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) {
        world.respawn();
        renderer.resetCamera();
        screen = SCREEN_PLAY;
        announce(`Respawned. ${world.objectiveText()}.`);
      }
    } else if (screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        clearProgress();
        progress = freshProgress();
        world.reset(progress);
        screen = SCREEN_TITLE;
        announce('New run ready. Press Enter to start.');
      }
    }
  }

  function simulate(dt) {
    const aim = renderer.aimWorld(input.pointer);
    const events = world.step(dt, {
      axis: input.axis(),
      aimX: aim.x,
      aimY: aim.y,
      firing: input.firing(),
      sprint: input.sprinting(),
    });
    if (events & EVENT_MISSION_DONE) {
      persist();
      screen = SCREEN_INTERMISSION;
      announce(`${world.state.mission.title} complete.`);
    } else if (events & EVENT_GAME_OVER) {
      persist();
      screen = SCREEN_OVER;
      announce('Busted. Press R to respawn.');
    } else if (events & EVENT_OBJECTIVE) {
      announce(world.objectiveText());
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        simulate(STEP);
        accumulator -= STEP;
        saveTimer += STEP;
        if (saveTimer >= 8) {
          saveTimer = 0;
          persist();
        }
      }
    } else {
      accumulator = 0;
      if (screen === SCREEN_TITLE || screen === SCREEN_BRIEF) world.step(STEP * 0.35, { axis: { x: 0, y: 0 }, firing: false });
    }
    renderer.draw(world.state, screen, world);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      persist();
      announce('Paused.');
    }
  });

  window.addEventListener('blur', () => {
    if (screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      persist();
      announce('Paused.');
    }
  });

  window.__solana = {
    world,
    city,
    renderer,
    getScreen: () => screen,
    setScreen: (next) => { screen = next; },
  };

  announce('Solana Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
