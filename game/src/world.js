// The living city simulation: people, traffic, cars to steal, gunplay, the
// wanted system and the story mission machine. Nothing here draws to a canvas;
// it only advances state one fixed step at a time.

import {
  CAR_COLORS, CAR_TYPES, CITY, CITY_HEIGHT, CITY_WIDTH, FIELD, LIMITS,
  PALETTE, PLAYER, POLICE, WANTED, WEAPONS,
} from './config.js';
import { createCity } from './city.js';
import { createEffects } from './effects.js';
import { contactOf, missionAt, rankFor } from './story.js';
import { pick } from './random.js';

export const EVENT_SHOT = 1;
export const EVENT_HIT = 2;
export const EVENT_CASH = 4;
export const EVENT_STORY = 8;
export const EVENT_CRASH = 16;
export const EVENT_OVER = 32;
export const EVENT_ENTER = 64;
export const EVENT_EXIT = 128;
export const EVENT_WANTED = 256;
export const EVENT_RELOAD = 512;
export const EVENT_RANKUP = 1024;
export const EVENT_SHOP = 2048;

const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const LANE = 24;
const SONGS = [
  ['SUN FM', 'Golden Hour - The Palms'],
  ['SUN FM', 'Convertible Weather - Vega Bay'],
  ['COAST 88', 'Boardwalk Boy - Night Transit'],
  ['COAST 88', 'Salt Air - The Tide Readers'],
];

const FREE_CONTRACT = {
  id: 'street-contract',
  title: 'STREET CONTRACT',
  contact: 'tito',
  brief: 'Keep the wheels turning until the next call comes in.',
  reward: 1400,
  rep: 70,
  steps: [
    { kind: 'steal', label: 'FIND A CAR FOR THE RUN' },
    { kind: 'checkpoints', count: 2, label: 'CHECKPOINT 1 / 2' },
  ],
};

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lanePoint(dir, x, y) {
  if (dir === 0) return { x, y: y + LANE };
  if (dir === 2) return { x, y: y - LANE };
  if (dir === 1) return { x: x - LANE, y };
  return { x: x + LANE, y };
}

export function createWorld(random, progress = {}) {
  const city = createCity(random);
  const start = city.spots.start;
  const saved = {
    money: Number.isFinite(progress.money) ? progress.money : PLAYER.cash,
    rep: Number.isFinite(progress.rep) ? progress.rep : 0,
    completed: Number.isFinite(progress.completed) ? progress.completed : 0,
    earned: Number.isFinite(progress.earned) ? progress.earned : 0,
    missionsDone: Number.isFinite(progress.missionsDone) ? progress.missionsDone : 0,
    best: Number.isFinite(progress.best) ? progress.best : 0,
  };

  const player = {
    x: start.x, y: start.y, angle: -Math.PI / 2,
    health: PLAYER.health, armor: PLAYER.armor, money: saved.money,
    wanted: 0, wantedTimer: 0, crimeTimer: 0,
    onFoot: true, car: null, weapon: 'pistol',
    smgUnlocked: saved.completed >= 3,
    ammo: { pistol: WEAPONS.pistol.magazine, smg: WEAPONS.smg.magazine },
    reserve: { pistol: WEAPONS.pistol.reserve, smg: WEAPONS.smg.reserve },
    fireTimer: 0, reload: 0, aimX: start.x + 160, aimY: start.y,
    cause: '',
  };

  const state = {
    player,
    city,
    camera: { x: start.x, y: start.y, shake: 0 },
    traffic: [], cops: [], peds: [], bullets: [], particles: [], pickups: [],
    mission: null,
    toast: { text: '', timer: 0, color: PALETTE.text },
    storyCard: null,
    radio: { station: SONGS[0][0], song: SONGS[0][1], timer: 26 },
    timeOfDay: 0.28,
    elapsed: 0,
    over: false,
    rank: rankFor(saved.rep),
    progress: saved,
    stats: { jobs: 0, earned: saved.earned, kills: 0, time: 0, best: saved.best },
    events: 0,
  };

  const effects = createEffects(state, random);

  function toast(text, color = PALETTE.text) {
    state.toast.text = text;
    state.toast.timer = 3.6;
    state.toast.color = color;
  }

  function blocked(x, y, radius) {
    if (x < radius || y < radius || x > CITY_WIDTH - radius || y > CITY_HEIGHT - radius) return true;
    if (x + radius > (CITY.beachCol + 1) * CITY.cell - CITY.road / 2) return true;
    for (const b of city.buildings) {
      if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return true;
    }
    return false;
  }

  function roadSpot(around = null) {
    let px;
    let py;
    if (around === null) {
      px = 180 + random() * (CITY_WIDTH - 360);
      py = 180 + random() * (CITY_HEIGHT - 360);
    } else {
      const angle = random() * Math.PI * 2;
      const range = 660 + random() * 420;
      px = around.x + Math.cos(angle) * range;
      py = around.y + Math.sin(angle) * range;
    }
    const i = clamp(Math.round(px / CITY.cell), 1, CITY.beachCol);
    const j = clamp(Math.round(py / CITY.cell), 1, CITY.rows - 1);
    const dir = Math.floor(random() * 4);
    const spot = lanePoint(dir, i * CITY.cell, j * CITY.cell);
    spot.dir = dir;
    return spot;
  }

  function makeCar(x, y, dir, typeIndex, color, police = false) {
    const type = police ? POLICE : CAR_TYPES[typeIndex % CAR_TYPES.length];
    return {
      x, y, angle: dir * Math.PI / 2, dir,
      speed: type.maxSpeed * (police ? 0.5 : 0.32 + random() * 0.32),
      cruise: type.maxSpeed * (police ? 0.9 : 0.4 + random() * 0.32),
      maxSpeed: type.maxSpeed, accel: type.accel, turn: type.turn,
      hp: type.hp, length: type.length, width: type.width,
      name: police ? 'CRUISER' : type.name,
      color: police ? PALETTE.cop : color, police,
      siren: random() < 0.5, fireTimer: 1 + random(),
      occupant: true, skid: 0,
    };
  }

  function spawnPed(x, y, cop = false) {
    state.peds.push({
      x, y, angle: random() * Math.PI * 2, timer: random() * 2,
      speed: 48 + random() * 30,
      color: cop ? PALETTE.cop : pick(random, CAR_COLORS),
      panic: 0, cop, hp: cop ? 60 : 40, dead: false,
    });
  }

  function spawnCash(x, y, amount, count) {
    for (let i = 0; i < count && state.pickups.length < LIMITS.pickups; i += 1) {
      state.pickups.push({
        x: x + (random() - 0.5) * 60,
        y: y + (random() - 0.5) * 60,
        amount, type: 'cash', life: 44, bob: random() * 6,
      });
    }
  }

  function spawnSupply(x, y, type) {
    if (state.pickups.length >= LIMITS.pickups) return;
    state.pickups.push({ x, y, amount: 0, type, life: 60, bob: random() * 6 });
  }

  function addWanted(amount, quiet = false) {
    const p = state.player;
    const before = p.wanted;
    p.wanted = clamp(p.wanted + amount, 0, WANTED.max);
    p.wantedTimer = WANTED.cooldown[Math.max(0, p.wanted - 1)];
    p.crimeTimer = 2.4;
    state.events |= EVENT_WANTED;
    if (!quiet && p.wanted > before) toast(`${p.wanted} STAR${p.wanted > 1 ? 'S' : ''} WANTED`, PALETTE.copRed);
  }

  function hurtPlayer(amount, cause) {
    const p = state.player;
    if (state.over || amount <= 0) return;
    const absorbed = Math.min(p.armor, amount * 0.6);
    p.armor -= absorbed;
    p.health -= amount - absorbed;
    effects.shake(amount * 0.5);
    state.events |= EVENT_HIT;
    if (p.health <= 0) {
      p.health = 0;
      state.over = true;
      p.cause = cause;
      state.events |= EVENT_OVER;
    }
  }

  function explode(car) {
    car.hp = 0;
    car.occupant = false;
    effects.burst(car.x, car.y, 36, PALETTE.orange, 280, 1.1);
    effects.smoke(car.x, car.y, 16);
    effects.shake(20);
    state.events |= EVENT_CRASH;
    state.stats.kills += 1;
    const mission = state.mission;
    if (car.police) {
      spawnCash(car.x, car.y, 85, 4);
      if (mission && mission.def.steps[mission.step]?.kind === 'eliminate') {
        mission.done += 1;
        toast(`COP CAR DOWN  ${mission.done} / ${mission.def.steps[mission.step].count}`, PALETTE.money);
      }
    } else if (state.player.car === car) {
      state.player.car = null;
      state.player.onFoot = true;
      state.player.x = car.x + 46;
      state.player.y = car.y + 46;
      hurtPlayer(18, 'WASTED');
    }
  }

  function bullet(x, y, angle, owner, damage, speed, color) {
    if (state.bullets.length >= LIMITS.bullets) return;
    state.bullets.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.05, owner, damage, color,
    });
  }

  function shoot() {
    const p = state.player;
    const weapon = WEAPONS[p.weapon];
    if (p.reload > 0 || p.fireTimer > 0 || p.ammo[p.weapon] <= 0) return;
    const source = p.onFoot ? p : p.car;
    if (!source) return;
    const angle = Math.atan2(p.aimY - source.y, p.aimX - source.x) + (random() - 0.5) * weapon.spread * 2;
    const offset = p.onFoot ? 20 : 32;
    bullet(source.x + Math.cos(angle) * offset, source.y + Math.sin(angle) * offset, angle, 'player', weapon.damage, weapon.speed, PALETTE.windowWarm);
    effects.muzzle(source.x + Math.cos(angle) * 12, source.y + Math.sin(angle) * 12, angle);
    effects.shake(2.4);
    p.ammo[p.weapon] -= 1;
    p.fireTimer = weapon.rate;
    state.events |= EVENT_SHOT;
    if (p.ammo[p.weapon] === 0 && p.reserve[p.weapon] > 0) p.reload = weapon.reload;
  }

  function reload() {
    const p = state.player;
    const weapon = WEAPONS[p.weapon];
    if (p.ammo[p.weapon] >= weapon.magazine || p.reserve[p.weapon] <= 0 || p.reload > 0) return;
    p.reload = weapon.reload;
    state.events |= EVENT_RELOAD;
  }

  function finishReload() {
    const p = state.player;
    const weapon = WEAPONS[p.weapon];
    const taken = Math.min(weapon.magazine - p.ammo[p.weapon], p.reserve[p.weapon]);
    p.ammo[p.weapon] += taken;
    p.reserve[p.weapon] -= taken;
  }

  function nearestCar(maxDistance) {
    const p = state.player;
    if (!p.onFoot) return null;
    let best = null;
    let bestDistance = maxDistance;
    for (const car of state.traffic) {
      if (!car.occupant) continue;
      const d = distance(car, p);
      if (d < bestDistance) {
        bestDistance = d;
        best = car;
      }
    }
    return best;
  }

  function nearestShop(from, range) {
    let best = null;
    let bestDistance = range;
    for (const shop of city.shops) {
      const d = Math.hypot(shop.x - from.x, shop.y - from.y);
      if (d < bestDistance) {
        bestDistance = d;
        best = shop;
      }
    }
    return best;
  }

  function interact() {
    const p = state.player;
    if (!p.onFoot) {
      if (Math.abs(p.car.speed) < 95) {
        p.car.occupant = true;
        p.x = p.car.x + Math.cos(p.car.angle + Math.PI / 2) * 40;
        p.y = p.car.y + Math.sin(p.car.angle + Math.PI / 2) * 40;
        p.onFoot = true;
        p.car = null;
        state.events |= EVENT_EXIT;
      } else toast('TOO FAST TO EXIT', PALETTE.muted);
      return;
    }
    const car = nearestCar(PLAYER.interactRange);
    if (car) {
      car.occupant = true;
      p.onFoot = false;
      p.car = car;
      p.x = car.x;
      p.y = car.y;
      state.events |= EVENT_ENTER;
      return;
    }
    const shop = nearestShop(p, PLAYER.interactRange + 10);
    if (shop && shop.cooldown <= 0) {
      const cash = 140 + Math.floor(random() * 140);
      spawnCash(shop.x, shop.y, 45, 3);
      p.money += cash;
      state.progress.money = p.money;
      state.progress.earned += cash;
      state.stats.earned += cash;
      shop.cooldown = 55;
      addWanted(2);
      toast(`STORE CUT  +$${cash}`, PALETTE.money);
      state.events |= EVENT_SHOP;
      state.events |= EVENT_CASH;
    }
  }

  function driveCar(car, dt, playerControlled, controls) {
    const p = state.player;
    if (playerControlled) {
      const throttle = -controls.moveY;
      const steering = controls.moveX;
      if (throttle > 0) car.speed += car.accel * dt;
      else if (throttle < 0) car.speed -= car.accel * 0.75 * dt;
      else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 150 * dt);
      if (controls.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 330 * dt);
      car.speed = clamp(car.speed, -car.maxSpeed * 0.42, car.maxSpeed);
      const grip = controls.handbrake ? 0.36 : 1;
      const speedFactor = Math.min(1, Math.abs(car.speed) / 90);
      car.angle += steering * car.turn * dt * speedFactor * grip * (car.speed < 0 ? -1 : 1);
      if (controls.handbrake && Math.abs(car.speed) > 170 && random() < 0.4) {
        effects.smoke(car.x - Math.cos(car.angle) * car.length / 2, car.y - Math.sin(car.angle) * car.length / 2, 2);
      }
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (blocked(nx, car.y, car.width * 0.62)) {
        if (Math.abs(car.speed) > 110) {
          effects.sparks(car.x, car.y, 8);
          car.hp -= Math.abs(car.speed) * 0.035;
          effects.shake(Math.abs(car.speed) * 0.016);
          state.events |= EVENT_CRASH;
        }
        car.speed *= -0.24;
      } else car.x = nx;
      if (blocked(car.x, ny, car.width * 0.62)) {
        if (Math.abs(car.speed) > 110) {
          effects.sparks(car.x, car.y, 8);
          car.hp -= Math.abs(car.speed) * 0.035;
          effects.shake(Math.abs(car.speed) * 0.016);
        }
        car.speed *= -0.24;
      } else car.y = ny;
      p.x = car.x;
      p.y = car.y;
      if (car.hp <= 0) explode(car);
      return;
    }

    const chasing = car.police && p.wanted > 0;
    const target = chasing ? (p.car ?? p) : null;
    const boost = chasing && target && distance(car, target) < 1100 ? 1.18 : 1;
    car.speed += clamp(car.cruise * boost - car.speed, -car.accel * dt, car.accel * dt);
    let travel = car.speed * dt;
    let guard = 0;
    while (travel > 0 && guard < 6) {
      guard += 1;
      let cross;
      let dist = 0;
      for (let d = 0; d < 4; d += 1) {
        if (car.dir === 0) { cross = (Math.floor(car.x / CITY.cell) + 1) * CITY.cell; dist = cross - car.x; }
        else if (car.dir === 2) { cross = Math.floor(car.x / CITY.cell) * CITY.cell; dist = car.x - cross; if (dist < 1) { cross -= CITY.cell; dist = car.x - cross; } }
        else if (car.dir === 1) { cross = (Math.floor(car.y / CITY.cell) + 1) * CITY.cell; dist = cross - car.y; }
        else { cross = Math.floor(car.y / CITY.cell) * CITY.cell; dist = car.y - cross; if (dist < 1) { cross -= CITY.cell; dist = car.y - cross; } }
        if (dist > 0) break;
      }
      const step = Math.min(travel, Math.max(0, dist));
      if (car.dir === 0) car.x += step;
      else if (car.dir === 2) car.x -= step;
      else if (car.dir === 1) car.y += step;
      else car.y -= step;
      travel -= step;
      if (dist <= step + 0.001) {
        const options = [car.dir, (car.dir + 1) % 4, (car.dir + 3) % 4];
        let next = car.dir;
        if (chasing && target) {
          let bestDistance = Infinity;
          for (const option of options) {
            const vec = DIRECTIONS[option];
            const d = Math.hypot(car.x + vec[0] * 150 - target.x, car.y + vec[1] * 150 - target.y);
            if (d < bestDistance) { bestDistance = d; next = option; }
          }
        } else {
          const choice = random();
          next = choice < 0.64 ? car.dir : choice < 0.82 ? options[1] : options[2];
        }
        car.dir = next;
        car.angle = next * Math.PI / 2;
        if (next === 0) car.y = cross + LANE;
        else if (next === 2) car.y = cross - LANE;
        else if (next === 3) car.x = cross + LANE;
        else car.x = cross - LANE;
      }
      if (car.dir === 0 || car.dir === 2) {
        const center = Math.round(car.y / CITY.cell) * CITY.cell;
        car.y += (center + (car.dir === 0 ? LANE : -LANE) - car.y) * Math.min(1, dt * 8);
      } else {
        const center = Math.round(car.x / CITY.cell) * CITY.cell;
        car.x += (center + (car.dir === 3 ? LANE : -LANE) - car.x) * Math.min(1, dt * 8);
      }
    }
    if (car.police) {
      car.siren = Math.floor(state.elapsed * 6) % 2 === 0;
      if (chasing && target && distance(car, target) < 180) {
        const want = Math.atan2(target.y - car.y, target.x - car.x);
        let delta = ((want - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        car.angle += clamp(delta, -dt * 1.2, dt * 1.2);
      }
      car.fireTimer -= dt;
      if (p.wanted >= 2 && car.fireTimer <= 0 && distance(car, p) < POLICE.range) {
        const angle = Math.atan2(p.y - car.y, p.x - car.x) + (random() - 0.5) * 0.13;
        bullet(car.x + Math.cos(angle) * 34, car.y + Math.sin(angle) * 34, angle, 'cop', 9, 640, PALETTE.copBlue);
        effects.muzzle(car.x, car.y, angle);
        car.fireTimer = POLICE.fireRate;
        state.events |= EVENT_SHOT;
      }
    }
  }

  function updatePeds(dt) {
    for (let i = state.peds.length - 1; i >= 0; i -= 1) {
      const ped = state.peds[i];
      if (ped.dead) { state.peds.splice(i, 1); continue; }
      const p = state.player;
      const near = distance(ped, p);
      if (ped.cop && p.wanted >= 3 && !state.over) {
        const angle = Math.atan2(p.y - ped.y, p.x - ped.x);
        ped.angle = angle;
        if (near > 95) {
          const nx = ped.x + Math.cos(angle) * 138 * dt;
          const ny = ped.y + Math.sin(angle) * 138 * dt;
          if (!blocked(nx, ny, 8)) { ped.x = nx; ped.y = ny; }
        }
        ped.timer -= dt;
        if (ped.timer <= 0 && near < 440) {
          bullet(ped.x + Math.cos(angle) * 16, ped.y + Math.sin(angle) * 16, angle, 'cop', 8, 600, PALETTE.copBlue);
          effects.muzzle(ped.x, ped.y, angle);
          ped.timer = 1.5 + random();
        }
      } else {
        if (near < 240 && (p.wanted > 0 || (state.events & EVENT_SHOT))) ped.panic = 2.6;
        ped.panic = Math.max(0, ped.panic - dt);
        ped.timer -= dt;
        if (ped.timer <= 0) {
          ped.angle += (random() - 0.5) * (ped.panic > 0 ? 3.2 : 1.4);
          ped.timer = 0.6 + random() * 1.6;
        }
        const speed = ped.panic > 0 ? ped.speed * 2.9 : ped.speed;
        const nx = ped.x + Math.cos(ped.angle) * speed * dt;
        const ny = ped.y + Math.sin(ped.angle) * speed * dt;
        if (blocked(nx, ny, 8)) ped.angle += Math.PI * (0.6 + random() * 0.3);
        else { ped.x = nx; ped.y = ny; }
      }
    }
  }

  function updateBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const shot = state.bullets[i];
      const nx = shot.x + shot.vx * dt;
      const ny = shot.y + shot.vy * dt;
      shot.life -= dt;
      let done = shot.life <= 0 || nx < 0 || ny < 0 || nx > CITY_WIDTH || ny > CITY_HEIGHT;
      if (!done && blocked(nx, ny, 2)) {
        effects.sparks(nx, ny, 4);
        done = true;
      }
      if (!done && shot.owner === 'player') {
        for (const car of state.cops) {
          if (Math.abs(nx - car.x) < car.length * 0.6 && Math.abs(ny - car.y) < car.width * 0.8) {
            car.hp -= shot.damage;
            effects.sparks(nx, ny, 8);
            if (car.hp <= 0) explode(car);
            done = true;
            break;
          }
        }
        if (!done) {
          for (const ped of state.peds) {
            if (ped.cop && Math.hypot(nx - ped.x, ny - ped.y) < 17) {
              ped.dead = true;
              effects.sparks(nx, ny, 10);
              state.stats.kills += 1;
              spawnCash(nx, ny, 65, 2);
              done = true;
              break;
            }
          }
        }
      } else if (!done && !state.over) {
        const p = state.player;
        if (p.onFoot && Math.hypot(nx - p.x, ny - p.y) < PLAYER.radius + 4) {
          hurtPlayer(shot.damage, 'BUSTED');
          done = true;
        } else if (!p.onFoot && p.car && Math.abs(nx - p.car.x) < p.car.length * 0.6 && Math.abs(ny - p.car.y) < p.car.width * 0.85) {
          p.car.hp -= shot.damage;
          effects.sparks(nx, ny, 5);
          if (p.car.hp <= 0) explode(p.car);
          done = true;
        }
      }
      if (done) state.bullets.splice(i, 1);
      else { shot.x = nx; shot.y = ny; }
    }
  }

  function prepareStep(mission) {
    const step = mission.def.steps[mission.step];
    if (!step) return;
    mission.hold = 0;
    mission.timer = 0;
    mission.checkpoints = [];
    mission.done = 0;
    mission.label = step.label;
    const p = state.player;
    if (step.spot && city.spots[step.spot]) {
      mission.x = city.spots[step.spot].x;
      mission.y = city.spots[step.spot].y;
    }
    if (step.kind === 'checkpoints') {
      for (let i = 0; i < step.count; i += 1) {
        const spot = roadSpot(p);
        mission.checkpoints.push({ x: spot.x, y: spot.y });
      }
      mission.x = mission.checkpoints[0].x;
      mission.y = mission.checkpoints[0].y;
      mission.label = `CHECKPOINT 1 / ${step.count}`;
      mission.timer = 68;
    } else if (step.kind === 'escape') {
      mission.timer = 105;
      addWanted(step.wanted ?? (mission.step === 0 ? mission.def.wanted : 2));
    } else if (step.kind === 'eliminate') {
      mission.timer = 120;
      if (mission.step === 0) addWanted(mission.def.wanted ?? 2);
      mission.label = `TAKE DOWN ${step.count} POLICE CARS  0 / ${step.count}`;
    } else if (step.kind === 'steal') {
      const car = nearestCar(400);
      mission.x = car ? car.x : p.x + 140;
      mission.y = car ? car.y : p.y;
    }
  }

  function advanceStep(mission, message) {
    mission.step += 1;
    if (message) toast(message, PALETTE.money);
    if (mission.step >= mission.def.steps.length) completeMission(mission);
    else prepareStep(mission);
  }

  function completeMission(mission) {
    const reward = mission.reward;
    const rep = mission.rep;
    const before = state.rank.name;
    state.progress.money += reward;
    state.progress.rep += rep;
    state.progress.earned += reward;
    state.progress.missionsDone += 1;
    state.progress.completed = Math.max(state.progress.completed, mission.index + 1);
    state.progress.best = Math.max(state.progress.best, reward);
    player.money = state.progress.money;
    player.smgUnlocked = true;
    state.stats.jobs = state.progress.missionsDone;
    state.stats.earned = state.progress.earned;
    state.rank = rankFor(state.progress.rep);
    spawnCash(player.x, player.y, 90, 5);
    spawnSupply(player.x + 70, player.y - 60, 'health');
    toast(`MISSION COMPLETE  +$${reward}  +${rep} REP`, PALETTE.money);
    state.storyCard = {
      title: `${mission.def.title} COMPLETE`,
      contact: mission.contact,
      reward,
      rep,
      rank: state.rank.name,
      timer: 7,
    };
    state.events |= EVENT_STORY;
    if (state.rank.name !== before) {
      state.events |= EVENT_RANKUP;
      toast(`RANK UP  ${state.rank.name}`, PALETTE.money);
    }
    state.mission = buildMission(state.progress.completed);
  }

  function buildMission(index) {
    const freeRoam = index >= 6;
    const def = freeRoam ? { ...FREE_CONTRACT, reward: 1200 + (index - 6) * 180, rep: 70 } : missionAt(index);
    const contact = contactOf(def);
    const mission = {
      index, def, contact: contact.name, contactShort: contact.short,
      step: 0, label: def.steps[0].label,
      x: state.player.x + 160, y: state.player.y,
      timer: 0, hold: 0, done: 0, checkpoints: [],
      reward: def.reward, rep: def.rep, freeRoam,
    };
    state.mission = mission;
    prepareStep(mission);
    return mission;
  }

  function updateMission(dt, controls) {
    const mission = state.mission;
    if (!mission) return;
    const p = state.player;
    const step = mission.def.steps[mission.step];
    if (!step) return;
    const focus = p.onFoot || !p.car ? p : p.car;
    const near = Math.hypot(focus.x - mission.x, focus.y - mission.y);

    if (mission.timer > 0 && ['checkpoints', 'escape', 'eliminate'].includes(step.kind)) {
      mission.timer -= dt;
      if (mission.timer <= 0 && step.kind !== 'checkpoints') {
        toast('THE HEAT GOT AWAY - TRY AGAIN', PALETTE.copRed);
        prepareStep(mission);
        return;
      }
    }

    if (step.kind === 'travel') {
      const rightMode = step.mode === 'any' || (step.mode === 'car' ? !p.onFoot : p.onFoot);
      if (rightMode && near < 110) advanceStep(mission, `MARKER CLEARED  ${mission.def.title}`);
    } else if (step.kind === 'steal') {
      if (!p.onFoot && p.car) advanceStep(mission, 'WHEELS ACQUIRED');
      else {
        const car = nearestCar(400);
        if (car) { mission.x = car.x; mission.y = car.y; }
      }
    } else if (step.kind === 'checkpoints') {
      if (!p.onFoot && p.car && near < 118) {
        mission.checkpoints.shift();
        if (mission.checkpoints.length === 0) advanceStep(mission, 'RUN COMPLETE');
        else {
          mission.x = mission.checkpoints[0].x;
          mission.y = mission.checkpoints[0].y;
          mission.label = `CHECKPOINT ${step.count - mission.checkpoints.length + 1} / ${step.count}`;
          mission.timer += 12;
          addWanted(1, true);
        }
      }
      if (mission.timer <= 0 && step.kind === 'checkpoints') {
        toast('TIME UP - RUN RESTARTED', PALETTE.copRed);
        prepareStep(mission);
      }
    } else if (step.kind === 'pickup') {
      if (p.onFoot && near < 110 && controls.interact) advanceStep(mission, 'CRATE SECURED');
    } else if (step.kind === 'deliver') {
      if (near < 120) advanceStep(mission, 'DROP MADE');
    } else if (step.kind === 'escape') {
      if (p.wanted === 0 && near < 145) advanceStep(mission, 'YOU LOST THEM');
    } else if (step.kind === 'eliminate') {
      mission.label = `TAKE DOWN ${step.count} POLICE CARS  ${mission.done} / ${step.count}`;
      const target = state.cops[0];
      if (target) { mission.x = target.x; mission.y = target.y; }
      if (mission.done >= step.count) advanceStep(mission, 'BLOCK BROKEN');
    }
  }

  function updatePickups(dt) {
    const p = state.player;
    const focus = p.onFoot || !p.car ? p : p.car;
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = state.pickups[i];
      pickup.life -= dt;
      pickup.bob += dt * 5;
      if (Math.hypot(pickup.x - focus.x, pickup.y - focus.y) < 48) {
        if (pickup.type === 'cash') {
          p.money += pickup.amount;
          state.progress.money = p.money;
          state.progress.earned += pickup.amount;
          state.stats.earned += pickup.amount;
          state.events |= EVENT_CASH;
          toast(`+$${pickup.amount}`, PALETTE.money);
        } else if (pickup.type === 'health') p.health = Math.min(100, p.health + 42);
        else if (pickup.type === 'armor') p.armor = Math.min(100, p.armor + 50);
        state.pickups.splice(i, 1);
      } else if (pickup.life <= 0) state.pickups.splice(i, 1);
    }
  }

  function maintainPolice(dt) {
    const p = state.player;
    const desired = state.over ? 0 : Math.min(LIMITS.copCars, p.wanted);
    if (desired === 0) state.cops.length = 0;
    while (state.cops.length < desired) {
      const spot = roadSpot(p);
      state.cops.push(makeCar(spot.x, spot.y, spot.dir, 0, PALETTE.cop, true));
    }
    const footCops = state.over ? 0 : Math.max(0, Math.min(4, p.wanted - 2));
    let count = 0;
    for (const ped of state.peds) if (ped.cop && !ped.dead) count += 1;
    for (let i = count; i < footCops; i += 1) {
      const spot = roadSpot(p);
      spawnPed(spot.x, spot.y, true);
    }
    for (let i = state.cops.length - 1; i >= 0; i -= 1) {
      const car = state.cops[i];
      driveCar(car, dt, false);
      if (distance(car, p) > 2400 || car.hp <= 0) state.cops.splice(i, 1);
    }
    if (p.wanted > 0) {
      let seen = p.crimeTimer > 0;
      for (const car of state.cops) if (distance(car, p) < WANTED.radius) seen = true;
      for (const ped of state.peds) if (ped.cop && distance(ped, p) < WANTED.radius) seen = true;
      if (seen) p.wantedTimer = WANTED.cooldown[p.wanted - 1];
      else {
        p.wantedTimer -= dt;
        if (p.wantedTimer <= 0) {
          p.wanted -= 1;
          p.wantedTimer = WANTED.cooldown[Math.max(0, p.wanted - 1)];
          if (p.wanted === 0) toast('YOU LOST THE COPS', PALETTE.health);
        }
      }
    }
  }

  function step(dt, controls, harmless = false) {
    const p = state.player;
    state.events = 0;
    state.elapsed += dt;
    state.stats.time = state.elapsed;
    state.timeOfDay = (0.28 + state.elapsed / 480) % 1;

    if (!harmless && !state.over) {
      p.fireTimer = Math.max(0, p.fireTimer - dt);
      p.crimeTimer = Math.max(0, p.crimeTimer - dt);
      if (p.reload > 0) {
        p.reload -= dt;
        if (p.reload <= 0) finishReload();
      }
      if (controls.reload) reload();
      if (controls.switchWeapon) {
        if (p.smgUnlocked) {
          p.weapon = p.weapon === 'pistol' ? 'smg' : 'pistol';
          toast(p.weapon.toUpperCase(), PALETTE.muted);
        } else toast('SMG UNLOCKS AFTER THE HARBOR JOB', PALETTE.orange);
      }
      if (controls.fire) shoot();
      if (controls.interact) interact();
      if (p.onFoot) {
        const speed = controls.sprint ? PLAYER.sprint : PLAYER.speed;
        const nx = p.x + controls.moveX * speed * dt;
        const ny = p.y + controls.moveY * speed * dt;
        if (!blocked(nx, p.y, PLAYER.radius)) p.x = nx;
        if (!blocked(p.x, ny, PLAYER.radius)) p.y = ny;
        p.angle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
      } else if (p.car) driveCar(p.car, dt, true, controls);
    }

    for (let i = state.traffic.length - 1; i >= 0; i -= 1) {
      const car = state.traffic[i];
      if (car === p.car) continue;
      driveCar(car, dt, false);
      if (car.hp <= 0) {
        effects.burst(car.x, car.y, 18, PALETTE.orange, 190, 0.9);
        effects.smoke(car.x, car.y, 6);
        state.traffic.splice(i, 1);
      }
    }

    if (!harmless && !state.over) {
      maintainPolice(dt);
      updateMission(dt, controls);
      const focus = p.onFoot || !p.car ? p : p.car;
      for (const car of state.traffic) {
        if (car === p.car) continue;
        if (distance(car, focus) < 34 && Math.abs(car.speed) > 80) {
          car.speed *= 0.55;
          if (p.onFoot) hurtPlayer(7, 'BUSTED');
        }
      }
      for (const ped of state.peds) {
        if (!ped.cop && !p.onFoot && p.car && Math.abs(p.car.speed) > 100 && Math.hypot(ped.x - p.car.x, ped.y - p.car.y) < 32) {
          ped.dead = true;
          p.car.hp -= 3;
          effects.burst(ped.x, ped.y, 5, PALETTE.copRed, 90, 0.4);
        }
      }
      for (const shop of city.shops) shop.cooldown = Math.max(0, shop.cooldown - dt);
    }

    updatePeds(dt);
    updateBullets(dt);
    effects.update(dt);
    updatePickups(dt);

    state.toast.timer = Math.max(0, state.toast.timer - dt);
    if (state.storyCard) {
      state.storyCard.timer -= dt;
      if (state.storyCard.timer <= 0) state.storyCard = null;
    }
    state.radio.timer -= dt;
    if (state.radio.timer <= 0) {
      const song = SONGS[Math.floor(state.elapsed / 26) % SONGS.length];
      state.radio.station = song[0];
      state.radio.song = song[1];
      state.radio.timer = 26;
    }

    const focus = p.onFoot || !p.car ? p : p.car;
    if (focus) {
      state.camera.x += (focus.x - state.camera.x) * Math.min(1, dt * 6);
      state.camera.y += (focus.y - state.camera.y) * Math.min(1, dt * 6);
    }
    state.camera.x = clamp(state.camera.x, FIELD.width / 2, CITY_WIDTH - FIELD.width / 2);
    state.camera.y = clamp(state.camera.y, FIELD.height / 2, CITY_HEIGHT - FIELD.height / 2);
    return state.events;
  }

  function reset() {
    player.x = start.x;
    player.y = start.y;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.armor = PLAYER.armor;
    player.money = state.progress.money;
    player.wanted = 0;
    player.wantedTimer = 0;
    player.crimeTimer = 0;
    player.onFoot = true;
    player.car = null;
    player.weapon = 'pistol';
    player.smgUnlocked = state.progress.completed >= 3;
    player.ammo.pistol = WEAPONS.pistol.magazine;
    player.ammo.smg = WEAPONS.smg.magazine;
    player.reserve.pistol = WEAPONS.pistol.reserve;
    player.reserve.smg = WEAPONS.smg.reserve;
    player.fireTimer = 0;
    player.reload = 0;
    player.aimX = start.x + 180;
    player.aimY = start.y;
    player.cause = '';
    state.camera.x = start.x;
    state.camera.y = start.y;
    state.camera.shake = 0;
    state.traffic.length = 0;
    state.cops.length = 0;
    state.peds.length = 0;
    state.bullets.length = 0;
    state.particles.length = 0;
    state.pickups.length = 0;
    state.elapsed = 0;
    state.over = false;
    state.timeOfDay = 0.28;
    state.toast = { text: '', timer: 0, color: PALETTE.text };
    state.storyCard = null;
    state.radio = { station: SONGS[0][0], song: SONGS[0][1], timer: 26 };
    state.rank = rankFor(state.progress.rep);
    state.stats = {
      jobs: state.progress.missionsDone,
      earned: state.progress.earned,
      kills: 0,
      time: 0,
      best: state.progress.best,
    };
    for (const shop of city.shops) shop.cooldown = 0;
    for (let i = 0; i < LIMITS.traffic; i += 1) {
      const near = i < 12;
      const spot = near ? roadSpot(start) : roadSpot();
      state.traffic.push(makeCar(spot.x, spot.y, spot.dir, Math.floor(random() * CAR_TYPES.length), pick(random, CAR_COLORS)));
    }
    for (let i = 0; i < LIMITS.pedestrians; i += 1) {
      const near = i < 22;
      const spot = near ? roadSpot(start) : roadSpot();
      spawnPed(spot.x + (random() - 0.5) * 110, spot.y + (random() - 0.5) * 110);
    }
    buildMission(state.progress.completed);
  }

  function placePed(x, y, cop = false) {
    spawnPed(x, y, cop);
    const ped = state.peds[state.peds.length - 1];
    ped.timer = 2 + random();
    return ped;
  }

  function stage(name) {
    reset();
    state.timeOfDay = 0.32;
    const anchor = { x: 7 * CITY.cell, y: 6 * CITY.cell };
    const cameraAt = (x, y) => {
      state.camera.x = x;
      state.camera.y = y;
    };
    const clearActors = () => {
      state.traffic.length = 0;
      state.cops.length = 0;
      state.peds.length = 0;
      state.bullets.length = 0;
      state.particles.length = 0;
      state.pickups.length = 0;
    };
    const putCar = (list, x, y, dir, type, color, police, speed) => {
      const car = makeCar(x, y, dir, type, color, police);
      car.speed = speed;
      car.cruise = speed;
      list.push(car);
      return car;
    };

    if (name === 'cover') {
      clearActors();
      const hero = putCar(state.traffic, anchor.x + 120, anchor.y + LANE, 0, 1, '#e94a48', false, 330);
      hero.occupant = true;
      player.x = hero.x;
      player.y = hero.y;
      player.onFoot = false;
      player.car = hero;
      player.angle = 0;
      player.aimX = hero.x + 420;
      player.aimY = hero.y - 40;
      player.health = 84;
      player.armor = 58;
      player.weapon = 'smg';
      player.smgUnlocked = true;
      player.ammo.smg = 24;
      player.wanted = 3;
      player.wantedTimer = WANTED.cooldown[2];
      state.progress.money = 12450;
      state.progress.rep = 1740;
      player.money = state.progress.money;
      state.rank = rankFor(state.progress.rep);
      cameraAt(anchor.x + 20, anchor.y);
      putCar(state.cops, anchor.x - 130, anchor.y + LANE, 0, 0, PALETTE.cop, true, 360);
      putCar(state.cops, anchor.x - 300, anchor.y - LANE, 0, 0, PALETTE.cop, true, 350);
      putCar(state.cops, anchor.x - 470, anchor.y + LANE, 0, 0, PALETTE.cop, true, 345);
      putCar(state.cops, anchor.x - 640, anchor.y - LANE, 0, 0, PALETTE.cop, true, 335);
      putCar(state.traffic, anchor.x + 330, anchor.y - LANE, 0, 0, '#f5d45f', false, 180);
      putCar(state.traffic, anchor.x + 80, anchor.y + CITY.cell + LANE, 0, 2, '#54b9d8', false, 160);
      putCar(state.traffic, anchor.x - LANE, anchor.y - 280, 1, 0, '#f0f0e4', false, 150);
      for (let i = 0; i < 12; i += 1) {
        placePed(anchor.x - 190 + i * 52, anchor.y + (i % 2 ? -60 : 62));
      }
      const mission = state.mission;
      mission.index = 1;
      mission.def = requireMission(1);
      mission.step = 1;
      mission.label = 'CHECKPOINT 2 / 3';
      mission.x = anchor.x + 640;
      mission.y = anchor.y - 140;
      mission.timer = 41;
      mission.contact = 'TITO ALVAREZ';
      effects.sparks(hero.x - 42, hero.y + 10, 10);
      effects.smoke(hero.x - 56, hero.y, 4);
      effects.shake(3);
      toast('3 STARS WANTED', PALETTE.copRed);
      return;
    }

    if (name === 'onfoot') {
      clearActors();
      const spot = city.spots.boardwalk;
      cameraAt(spot.x - 20, spot.y);
      player.x = spot.x - 70;
      player.y = spot.y + 58;
      player.onFoot = true;
      player.car = null;
      player.angle = -0.4;
      player.aimX = player.x + 200;
      player.aimY = player.y - 90;
      state.progress.money = 2860;
      state.progress.rep = 880;
      player.money = state.progress.money;
      state.rank = rankFor(state.progress.rep);
      player.wanted = 0;
      putCar(state.traffic, spot.x + 210, spot.y + LANE, 0, 1, '#ef6c50', false, 210);
      putCar(state.traffic, spot.x - 320, spot.y - LANE, 2, 0, '#f4d35e', false, 190);
      putCar(state.traffic, spot.x - LANE, spot.y + 260, 1, 0, '#5cc7dd', false, 170);
      for (let i = 0; i < 10; i += 1) {
        placePed(spot.x - 250 + i * 62, spot.y + (i % 3 === 0 ? -62 : 66));
      }
      const mission = state.mission;
      mission.index = 2;
      mission.def = requireMission(2);
      mission.step = 0;
      mission.label = 'REACH THE HARBOR';
      mission.x = spot.x + 165;
      mission.y = spot.y - 135;
      mission.contact = 'DANA KESTREL';
      toast('NEW JOB  DANA KESTREL', PALETTE.muted);
      return;
    }

    if (name === 'combat') {
      clearActors();
      const spot = { x: 5 * CITY.cell, y: 5 * CITY.cell };
      cameraAt(spot.x, spot.y);
      player.x = spot.x - 30;
      player.y = spot.y + 60;
      player.onFoot = true;
      player.car = null;
      player.angle = -0.22;
      player.aimX = spot.x + 320;
      player.aimY = spot.y - 40;
      player.weapon = 'smg';
      player.smgUnlocked = true;
      player.ammo.smg = 22;
      player.health = 61;
      player.armor = 34;
      player.wanted = 5;
      player.wantedTimer = WANTED.cooldown[4];
      state.progress.money = 6420;
      state.progress.rep = 1620;
      player.money = state.progress.money;
      state.rank = rankFor(state.progress.rep);
      putCar(state.cops, spot.x + 260, spot.y - LANE, 2, 0, PALETTE.cop, true, 260);
      putCar(state.cops, spot.x - 300, spot.y + LANE, 0, 0, PALETTE.cop, true, 280);
      putCar(state.cops, spot.x + 60, spot.y + 290, 3, 0, PALETTE.cop, true, 250);
      putCar(state.traffic, spot.x + 380, spot.y + LANE, 0, 1, '#f2a13c', false, 140);
      for (let i = 0; i < 5; i += 1) placePed(spot.x - 220 + i * 95, spot.y - 74);
      placePed(spot.x + 170, spot.y - 88, true);
      placePed(spot.x - 150, spot.y + 100, true);
      bullet(player.x + 26, player.y - 6, -0.2, 'player', 18, 1080, PALETTE.windowWarm);
      bullet(player.x + 64, player.y - 16, -0.12, 'player', 18, 1080, PALETTE.windowWarm);
      bullet(spot.x + 300, spot.y - 30, Math.PI + 0.2, 'cop', 9, 640, PALETTE.copBlue);
      bullet(spot.x - 250, spot.y + 60, 0.1, 'cop', 9, 640, PALETTE.copBlue);
      effects.muzzle(player.x + 10, player.y - 2, -0.2);
      effects.sparks(spot.x + 250, spot.y - 24, 12);
      effects.burst(player.x + 30, player.y - 10, 10, PALETTE.copRed, 130, 0.5);
      effects.shake(9);
      const mission = state.mission;
      mission.index = 4;
      mission.def = requireMission(4);
      mission.step = 0;
      mission.label = 'TAKE DOWN 3 POLICE CARS  2 / 3';
      mission.done = 2;
      mission.x = spot.x + 260;
      mission.y = spot.y - LANE;
      mission.contact = 'DANA KESTREL';
      toast('5 STARS WANTED', PALETTE.copRed);
      return;
    }

    if (name === 'story') {
      clearActors();
      const spot = city.spots.safehouse;
      cameraAt(spot.x, spot.y);
      player.x = spot.x - 40;
      player.y = spot.y + 70;
      player.onFoot = true;
      player.car = null;
      player.angle = -0.5;
      player.aimX = spot.x + 180;
      player.aimY = spot.y - 100;
      player.health = 92;
      player.armor = 46;
      player.wanted = 1;
      player.wantedTimer = WANTED.cooldown[0];
      state.progress.money = 12680;
      state.progress.rep = 1620;
      state.progress.completed = 4;
      player.money = state.progress.money;
      state.rank = rankFor(state.progress.rep);
      putCar(state.traffic, spot.x + 170, spot.y - LANE, 0, 1, '#e95d54', false, 90);
      putCar(state.traffic, spot.x - 330, spot.y + LANE, 0, 0, '#f2d269', false, 170);
      putCar(state.cops, spot.x - 460, spot.y - LANE, 0, 0, PALETTE.cop, true, 210);
      for (let i = 0; i < 8; i += 1) placePed(spot.x - 220 + i * 66, spot.y + (i % 2 ? -64 : 64));
      spawnCash(spot.x + 60, spot.y - 30, 100, 5);
      effects.burst(spot.x + 60, spot.y - 20, 14, PALETTE.money, 140, 0.9);
      const mission = state.mission;
      mission.index = 3;
      mission.def = requireMission(3);
      mission.step = 0;
      mission.label = 'REACH THE SAFEHOUSE';
      mission.contact = 'DANA KESTREL';
      state.storyCard = {
        title: 'HEAT WAVE COMPLETE',
        contact: 'DANA KESTREL',
        reward: 3400,
        rep: 300,
        rank: state.rank.name,
        timer: 999,
      };
      toast('MISSION COMPLETE  +$3,400  +300 REP', PALETTE.money);
    }
  }

  function requireMission(index) {
    return missionAt(index);
  }

  reset();
  return { state, city, reset, step, stage, blocked, addWanted, effects, start };
}
