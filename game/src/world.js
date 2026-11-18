import {
  CAR_TYPES, CITY, CITY_HEIGHT, CITY_WIDTH, FIELD, LIMITS, MISSION, PALETTE,
  PLAYER, POLICE, WANTED, WEAPONS,
} from './config.js';

export const EVENT_SHOT = 1;
export const EVENT_HIT = 2;
export const EVENT_CASH = 4;
export const EVENT_JOB = 8;
export const EVENT_CRASH = 16;
export const EVENT_OVER = 32;
export const EVENT_ENTER = 64;
export const EVENT_EXIT = 128;
export const EVENT_WANTED = 256;
export const EVENT_RELOAD = 512;

const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const LANE = 24;
const CAR_COLORS = ['#e94f5a', '#f2a33c', '#4ad3c2', '#d8dfe9', '#7b6ce0', '#2f8fd8', '#e8e1c8', '#8ecf62', '#c25c8d'];
const SONGS = [
  ['NEON FM', 'Midnight Drive - The Satellites'],
  ['NEON FM', 'Palm Trees & Static - Vega Bay'],
  ['CRYSTAL 88', 'Afterglow - The Palm Readers'],
  ['CRYSTAL 88', 'Fast Lane - Night Transit'],
];

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

export function createWorld(random) {
  const buildings = [];
  const trees = [];
  const shops = [];
  const blockStyles = [];
  const start = { x: 7 * CITY.cell + 80, y: 5 * CITY.cell + 70 };
  const safehouse = { x: 8 * CITY.cell + 60, y: 6 * CITY.cell + 60 };

  for (let i = 0; i < CITY.cols; i += 1) {
    for (let j = 0; j < CITY.rows; j += 1) {
      const x = i * CITY.cell + CITY.road / 2 + 8;
      const y = j * CITY.cell + CITY.road / 2 + 8;
      const size = CITY.cell - CITY.road - 16;
      let style = 'buildings';
      if (i >= CITY.beachCol + 1) style = 'water';
      else if (i === CITY.beachCol) style = 'sand';
      else if (random() < 0.13) style = 'park';
      blockStyles.push(style);

      if (style === 'buildings') {
        const split = random();
        const rects = split < 0.28
          ? [[0, 0, size, size]]
          : split < 0.7
            ? [[0, 0, size * 0.56, size], [size * 0.6, 0, size * 0.4, size * 0.58], [size * 0.6, size * 0.62, size * 0.4, size * 0.38]]
            : [[0, 0, size * 0.48, size * 0.48], [size * 0.52, 0, size * 0.48, size * 0.48], [0, size * 0.52, size * 0.48, size * 0.48], [size * 0.52, size * 0.52, size * 0.48, size * 0.48]];
        for (const rect of rects) {
          const b = {
            x: x + rect[0], y: y + rect[1], w: rect[2], h: rect[3],
            color: PALETTE.building[Math.floor(random() * PALETTE.building.length)],
            floors: 2 + Math.floor(random() * 7),
            seed: Math.floor(random() * 100000),
            top: random() < 0.22 ? 'sign' : random() < 0.3 ? 'tank' : 'plain',
            sign: ['NOVA', 'PIZZA', '24H', 'MOTEL', 'ARCADE', 'BAY FM'][Math.floor(random() * 6)],
            shop: false,
          };
          buildings.push(b);
          if (random() < 0.07) {
            b.shop = true;
            b.door = { x: b.x + b.w / 2, y: b.y + b.h + 14 };
            shops.push(b.door);
          }
        }
      } else if (style === 'park') {
        for (let t = 0; t < 9; t += 1) {
          trees.push({ x: x + 16 + random() * (size - 32), y: y + 16 + random() * (size - 32), r: 12 + random() * 8 });
        }
      } else if (style === 'sand') {
        for (let t = 0; t < 5; t += 1) {
          trees.push({ x: x + 12 + random() * (size - 24), y: y + 12 + random() * (size - 24), r: 13 + random() * 7, palm: true });
        }
      }
    }
  }
  if (shops.length < 6) {
    for (const b of buildings.slice(0, 12)) {
      const door = { x: b.x + b.w / 2, y: b.y + b.h + 14 };
      b.shop = true;
      shops.push(door);
      if (shops.length >= 6) break;
    }
  }

  const player = {
    x: start.x, y: start.y, angle: -Math.PI / 2,
    health: PLAYER.health, armor: PLAYER.armor, money: PLAYER.cash,
    wanted: 0, wantedTimer: 0, crimeTimer: 0,
    onFoot: true, car: null, weapon: 'pistol',
    ammo: { pistol: WEAPONS.pistol.magazine, smg: WEAPONS.smg.magazine },
    reserve: { pistol: WEAPONS.pistol.reserve, smg: WEAPONS.smg.reserve },
    fireTimer: 0, reload: 0, aimX: start.x + 100, aimY: start.y,
    cause: '',
  };
  const state = {
    player,
    camera: { x: start.x, y: start.y, shake: 0 },
    traffic: [], cops: [], peds: [], bullets: [], particles: [], pickups: [],
    mission: null,
    toast: { text: '', timer: 0, color: PALETTE.text },
    radio: { station: SONGS[0][0], song: SONGS[0][1], timer: 26 },
    timeOfDay: 0.62,
    elapsed: 0,
    over: false,
    stats: { jobs: 0, earned: 0, kills: 0, time: 0, best: 0 },
    events: 0,
  };

  function blocked(x, y, radius) {
    if (x < radius || y < radius || x > CITY_WIDTH - radius || y > CITY_HEIGHT - radius) return true;
    if (x + radius > (CITY.beachCol + 1) * CITY.cell - CITY.road / 2) return true;
    for (let index = 0; index < buildings.length; index += 1) {
      const b = buildings[index];
      if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return true;
    }
    return false;
  }

  function toast(text, color = PALETTE.text) {
    state.toast.text = text;
    state.toast.timer = 3.4;
    state.toast.color = color;
  }

  function makeCar(x, y, dir, typeIndex, color, police = false) {
    const type = police ? POLICE : CAR_TYPES[typeIndex];
    return {
      x, y, angle: dir * Math.PI / 2, dir,
      speed: type.maxSpeed * (police ? 0.55 : 0.35 + random() * 0.3),
      cruise: type.maxSpeed * (police ? 0.92 : 0.42 + random() * 0.3),
      maxSpeed: type.maxSpeed, accel: type.accel, turn: type.turn,
      hp: type.hp, length: type.length, width: type.width,
      color: police ? PALETTE.cop : color, police,
      siren: random() < 0.5, fireTimer: 1 + random(),
      occupant: true, skid: 0,
    };
  }

  function roadSpot(around = null) {
    let px;
    let py;
    if (around === null) {
      px = 120 + random() * (CITY_WIDTH - 240);
      py = 120 + random() * (CITY_HEIGHT - 240);
    } else {
      const angle = random() * Math.PI * 2;
      const range = 700 + random() * 420;
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

  function spawnPed(x, y) {
    state.peds.push({
      x, y, angle: random() * Math.PI * 2, timer: random() * 2,
      speed: 48 + random() * 28, color: CAR_COLORS[Math.floor(random() * CAR_COLORS.length)],
      panic: 0, cop: false, hp: 40, dead: false,
    });
  }

  function spawnCash(x, y, amount, count) {
    for (let index = 0; index < count && state.pickups.length < LIMITS.pickups; index += 1) {
      state.pickups.push({
        x: x + (random() - 0.5) * 52, y: y + (random() - 0.5) * 52,
        amount, type: 'cash', life: 42, bob: random() * 6,
      });
    }
  }

  function nearestShop(from) {
    let best = shops[0] ?? { x: start.x + 150, y: start.y };
    let bestDistance = Infinity;
    for (const door of shops) {
      const d = Math.hypot(door.x - from.x, door.y - from.y);
      if (d < bestDistance) {
        bestDistance = d;
        best = door;
      }
    }
    return best;
  }

  function beginJob() {
    const kind = state.stats.jobs % 3;
    const reward = MISSION.rewards[Math.min(state.stats.jobs, MISSION.rewards.length - 1)];
    const p = state.player;
    if (kind === 0) {
      const door = nearestShop(p);
      state.mission = { type: 'robbery', stage: 0, x: door.x, y: door.y, tx: 0, ty: 0, timer: 0, hold: 0, reward, label: 'ROB THE STORE', checkpoints: [] };
    } else if (kind === 1) {
      const spot = roadSpot(p);
      state.mission = { type: 'delivery', stage: 0, x: spot.x, y: spot.y, tx: 0, ty: 0, timer: 0, hold: 0, reward, label: 'COLLECT THE PACKAGE', checkpoints: [] };
    } else {
      state.mission = { type: 'race', stage: 0, x: p.x, y: p.y, tx: 0, ty: 0, timer: 0, hold: 0, reward, label: 'STEAL A CAR', checkpoints: [] };
    }
  }

  function finishJob(bonus = 0) {
    const job = state.mission;
    const reward = job.reward + bonus;
    state.player.money += reward;
    state.stats.jobs += 1;
    state.stats.earned += reward;
    toast(`JOB COMPLETE  +$${reward}`, PALETTE.money);
    state.events |= EVENT_JOB;
    beginJob();
  }

  function addWanted(amount) {
    const p = state.player;
    p.wanted = clamp(p.wanted + amount, 0, WANTED.max);
    p.wantedTimer = WANTED.cooldown[Math.max(0, p.wanted - 1)];
    p.crimeTimer = 2;
    state.events |= EVENT_WANTED;
    if (amount > 0) toast(`${p.wanted} STAR${p.wanted > 1 ? 'S' : ''} WANTED`, PALETTE.copRed);
  }

  function hurtPlayer(amount, cause) {
    const p = state.player;
    if (state.over || amount <= 0) return;
    const absorbed = Math.min(p.armor, amount * 0.65);
    p.armor -= absorbed;
    p.health -= amount - absorbed;
    state.camera.shake = Math.min(18, state.camera.shake + amount * 0.45);
    state.events |= EVENT_HIT;
    if (p.health <= 0) {
      p.health = 0;
      state.over = true;
      p.cause = cause;
      state.events |= EVENT_OVER;
    }
  }

  function particles(x, y, count, color, power, life = 0.6) {
    for (let index = 0; index < count && state.particles.length < LIMITS.particles; index += 1) {
      const angle = random() * Math.PI * 2;
      const speed = power * (0.25 + random() * 0.9);
      state.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: life * (0.5 + random()), max: life, color, size: 2 + random() * 4,
      });
    }
  }

  function explode(car) {
    car.hp = 0;
    car.occupant = false;
    particles(car.x, car.y, 40, PALETTE.orange, 260, 1.1);
    particles(car.x, car.y, 22, '#3b3f4a', 110, 1.8);
    state.camera.shake = 22;
    state.events |= EVENT_CRASH;
    state.stats.kills += 1;
    if (car.police) {
      spawnCash(car.x, car.y, 75, 4);
      toast('COP CAR DOWN', PALETTE.money);
    } else if (state.player.car === car) {
      state.player.car = null;
      state.player.onFoot = true;
      state.player.x = car.x + 46;
      state.player.y = car.y + 46;
      hurtPlayer(22, 'WASTED');
    }
  }

  function bullet(x, y, angle, owner, damage, speed, color) {
    if (state.bullets.length >= LIMITS.bullets) return;
    state.bullets.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1.1, owner, damage, color,
    });
  }

  function shoot() {
    const p = state.player;
    const weapon = WEAPONS[p.weapon];
    if (p.reload > 0 || p.fireTimer > 0 || p.ammo[p.weapon] <= 0) return;
    const source = p.onFoot ? p : p.car;
    const angle = Math.atan2(p.aimY - source.y, p.aimX - source.x) + (random() - 0.5) * weapon.spread * 2;
    const offset = p.onFoot ? 20 : 30;
    bullet(source.x + Math.cos(angle) * offset, source.y + Math.sin(angle) * offset, angle, 'player', weapon.damage, weapon.speed, PALETTE.money);
    state.camera.shake = Math.min(10, state.camera.shake + 2.2);
    p.ammo[p.weapon] -= 1;
    p.fireTimer = weapon.rate;
    state.events |= EVENT_SHOT;
    if (p.ammo[p.weapon] === 0 && p.reserve[p.weapon] > 0) p.reload = weapon.reload;
  }

  function reload() {
    const p = state.player;
    const weapon = WEAPONS[p.weapon];
    if (p.onFoot === false && p.car === null) return;
    if (p.ammo[p.weapon] >= weapon.magazine || p.reserve[p.weapon] <= 0 || p.reload > 0) return;
    p.reload = weapon.reload;
    state.events |= EVENT_RELOAD;
  }

  function finishReload() {
    const p = state.player;
    const weapon = WEAPONS[p.weapon];
    const need = weapon.magazine - p.ammo[p.weapon];
    const taken = Math.min(need, p.reserve[p.weapon]);
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

  function interact() {
    const p = state.player;
    if (!p.onFoot) {
      if (Math.abs(p.car.speed) < 90) {
        p.car.occupant = true;
        p.x = p.car.x + Math.cos(p.car.angle + Math.PI / 2) * 40;
        p.y = p.car.y + Math.sin(p.car.angle + Math.PI / 2) * 40;
        p.onFoot = true;
        p.car = null;
        state.events |= EVENT_EXIT;
      } else {
        toast('TOO FAST TO EXIT', PALETTE.muted);
      }
      return;
    }
    const car = nearestCar(PLAYER.interactRange);
    if (car && (state.mission.type !== 'race' || state.mission.stage !== 1)) {
      car.occupant = true;
      p.onFoot = false;
      p.car = car;
      p.x = car.x;
      p.y = car.y;
      state.events |= EVENT_ENTER;
      return;
    }
    const job = state.mission;
    const nearJob = Math.hypot(p.x - job.x, p.y - job.y) < PLAYER.interactRange + 20;
    if (job.type === 'delivery' && nearJob && job.stage === 0) {
      const dest = roadSpot(p);
      job.stage = 1;
      job.x = dest.x;
      job.y = dest.y;
      job.timer = MISSION.deliveryTime;
      job.label = 'DELIVER TO THE MARKER';
      toast('PACKAGE COLLECTED', PALETTE.money);
      state.events |= EVENT_JOB;
      return;
    }
  }

  function driveCar(car, controls, dt, playerControlled) {
    const p = state.player;
    const throttle = playerControlled ? -controls.moveY : 0;
    const steering = playerControlled ? controls.moveX : 0;
    if (playerControlled) {
      if (throttle > 0) car.speed += car.accel * dt;
      else if (throttle < 0) car.speed -= car.accel * 0.7 * dt;
      else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 150 * dt);
      if (controls.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 320 * dt);
      car.speed = clamp(car.speed, -car.maxSpeed * 0.42, car.maxSpeed);
      const grip = controls.handbrake ? 0.35 : 1;
      const speedFactor = Math.min(1, Math.abs(car.speed) / 90);
      car.angle += steering * car.turn * dt * speedFactor * grip * (car.speed < 0 ? -1 : 1);
      if (controls.handbrake && Math.abs(car.speed) > 160 && random() < 0.35) {
        state.particles.push({
          x: car.x - Math.cos(car.angle) * car.length / 2,
          y: car.y - Math.sin(car.angle) * car.length / 2,
          vx: 0, vy: 0, life: 0.9, max: 0.9, color: '#171b25', size: 7,
        });
      }
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (blocked(nx, car.y, car.width * 0.62)) {
        if (Math.abs(car.speed) > 100) {
          particles(car.x, car.y, 6, PALETTE.orange, 110, 0.4);
          car.hp -= Math.abs(car.speed) * 0.035;
          state.events |= EVENT_CRASH;
          state.camera.shake = Math.min(12, state.camera.shake + Math.abs(car.speed) * 0.014);
        }
        car.speed *= -0.25;
      } else car.x = nx;
      if (blocked(car.x, ny, car.width * 0.62)) {
        if (Math.abs(car.speed) > 100) {
          particles(car.x, car.y, 6, PALETTE.orange, 110, 0.4);
          car.hp -= Math.abs(car.speed) * 0.035;
        }
        car.speed *= -0.25;
      } else car.y = ny;
      p.x = car.x;
      p.y = car.y;
      if (car.hp <= 0) explode(car);
      return;
    }

    car.speed += clamp(car.cruise - car.speed, -car.accel * dt, car.accel * dt);
    let travel = car.speed * dt;
    let guard = 0;
    while (travel > 0 && guard < 5) {
      guard += 1;
      let cross;
      let dist;
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
        if (car.police && random() < 0.85) {
          let bestDistance = Infinity;
          for (const option of options) {
            const vec = DIRECTIONS[option];
            const d = Math.hypot(car.x + vec[0] * 120 - p.x, car.y + vec[1] * 120 - p.y);
            if (d < bestDistance) { bestDistance = d; next = option; }
          }
        } else {
          const choice = random();
          next = choice < 0.62 ? car.dir : choice < 0.81 ? options[1] : options[2];
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
        const want = center + (car.dir === 0 ? LANE : -LANE);
        car.y += (want - car.y) * Math.min(1, dt * 8);
      } else {
        const center = Math.round(car.x / CITY.cell) * CITY.cell;
        const want = center + (car.dir === 3 ? LANE : -LANE);
        car.x += (want - car.x) * Math.min(1, dt * 8);
      }
    }
    if (car.police) {
      car.siren = Math.floor(state.elapsed * 6) % 2 === 0;
      car.fireTimer -= dt;
      if (p.wanted >= 2 && car.fireTimer <= 0 && distance(car, p) < POLICE.range) {
        const angle = Math.atan2(p.y - car.y, p.x - car.x) + (random() - 0.5) * 0.14;
        bullet(car.x + Math.cos(angle) * 32, car.y + Math.sin(angle) * 32, angle, 'cop', 9, 620, PALETTE.copBlue);
        car.fireTimer = POLICE.fireRate;
        state.events |= EVENT_SHOT;
      }
    }
  }

  function updatePeds(dt) {
    for (let index = state.peds.length - 1; index >= 0; index -= 1) {
      const ped = state.peds[index];
      if (ped.dead) { state.peds.splice(index, 1); continue; }
      const p = state.player;
      const near = distance(ped, p);
      if (ped.cop && p.wanted >= 3 && !state.over) {
        const angle = Math.atan2(p.y - ped.y, p.x - ped.x);
        ped.angle = angle;
        const speed = 128;
        if (near > 90) {
          const nx = ped.x + Math.cos(angle) * speed * dt;
          const ny = ped.y + Math.sin(angle) * speed * dt;
          if (!blocked(nx, ny, 8)) { ped.x = nx; ped.y = ny; }
        }
        ped.timer -= dt;
        if (ped.timer <= 0 && near < 420) {
          bullet(ped.x + Math.cos(angle) * 16, ped.y + Math.sin(angle) * 16, angle, 'cop', 8, 580, PALETTE.copBlue);
          ped.timer = 1.5 + random();
        }
      } else {
        if (near < 230 && (p.wanted > 0 || state.events & EVENT_SHOT)) ped.panic = 2.5;
        ped.panic = Math.max(0, ped.panic - dt);
        ped.timer -= dt;
        if (ped.timer <= 0) {
          ped.angle += (random() - 0.5) * (ped.panic > 0 ? 3 : 1.4);
          ped.timer = 0.6 + random() * 1.6;
        }
        const speed = ped.panic > 0 ? ped.speed * 2.8 : ped.speed;
        const nx = ped.x + Math.cos(ped.angle) * speed * dt;
        const ny = ped.y + Math.sin(ped.angle) * speed * dt;
        if (blocked(nx, ny, 8)) ped.angle += Math.PI * (0.6 + random() * 0.3);
        else { ped.x = nx; ped.y = ny; }
      }
    }
  }

  function updateBullets(dt) {
    for (let index = state.bullets.length - 1; index >= 0; index -= 1) {
      const shot = state.bullets[index];
      const nx = shot.x + shot.vx * dt;
      const ny = shot.y + shot.vy * dt;
      shot.life -= dt;
      let done = shot.life <= 0 || nx < 0 || ny < 0 || nx > CITY_WIDTH || ny > CITY_HEIGHT;
      if (!done && blocked(nx, ny, 2)) {
        particles(nx, ny, 3, '#ffd88a', 70, 0.24);
        done = true;
      }
      if (!done && shot.owner === 'player') {
        for (const car of state.cops) {
          if (Math.abs(nx - car.x) < car.length * 0.55 && Math.abs(ny - car.y) < car.width * 0.75) {
            car.hp -= shot.damage;
            particles(nx, ny, 5, PALETTE.copBlue, 90, 0.35);
            if (car.hp <= 0) explode(car);
            done = true;
            break;
          }
        }
        if (!done) {
          for (const ped of state.peds) {
            if (ped.cop && Math.hypot(nx - ped.x, ny - ped.y) < 16) {
              ped.dead = true;
              particles(nx, ny, 8, PALETTE.copRed, 110, 0.5);
              state.stats.kills += 1;
              spawnCash(nx, ny, 60, 2);
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
        } else if (!p.onFoot && p.car && Math.abs(nx - p.car.x) < p.car.length * 0.55 && Math.abs(ny - p.car.y) < p.car.width * 0.8) {
          p.car.hp -= shot.damage;
          particles(nx, ny, 3, PALETTE.copBlue, 70, 0.3);
          if (p.car.hp <= 0) explode(p.car);
          done = true;
        }
      }
      if (done) state.bullets.splice(index, 1);
      else { shot.x = nx; shot.y = ny; }
    }
  }

  function updateMission(dt, controls) {
    const job = state.mission;
    const p = state.player;
    if (!job) return;
    const focus = p.onFoot ? p : p.car;
    const near = Math.hypot(focus.x - job.x, focus.y - job.y);
    if (job.type === 'robbery' && job.stage === 0) {
      if (near < PLAYER.interactRange + 20 && p.onFoot) {
        if (controls.interactHeld) job.hold += dt;
        else job.hold = Math.max(0, job.hold - dt * 2);
        if (job.hold >= MISSION.robberyHold) {
          spawnCash(job.x, job.y, 190, 5);
          addWanted(2);
          job.type = 'escape';
          job.stage = 1;
          job.x = safehouse.x;
          job.y = safehouse.y;
          job.timer = 75;
          job.label = 'REACH THE SAFEHOUSE';
          toast('STORE ROBBED - GET OUT OF THERE', PALETTE.money);
          state.events |= EVENT_JOB;
        }
      } else job.hold = Math.max(0, job.hold - dt * 2);
    } else if (job.stage === 1) {
      job.timer -= dt;
      if (job.type === 'escape') {
        if (p.wanted === 0 && near < 120) finishJob(350);
        else if (job.timer <= 0) {
          toast('HEAT LOST THE JOB', PALETTE.copRed);
          beginJob();
        }
      } else if (job.type === 'delivery') {
        if (near < 110) finishJob();
        else if (job.timer <= 0) {
          toast('DELIVERY FAILED', PALETTE.copRed);
          beginJob();
        }
      } else if (job.type === 'race') {
        if (job.checkpoints.length === 0) {
          job.checkpoints = [];
          for (let index = 0; index < 3; index += 1) {
            const spot = roadSpot({ x: p.x, y: p.y });
            job.checkpoints.push({ x: spot.x, y: spot.y });
          }
          job.x = job.checkpoints[0].x;
          job.y = job.checkpoints[0].y;
          job.label = 'CHECKPOINT 1 / 3';
          job.timer = MISSION.raceTime;
        } else if (near < 120) {
          job.checkpoints.shift();
          if (job.checkpoints.length === 0) finishJob();
          else {
            job.x = job.checkpoints[0].x;
            job.y = job.checkpoints[0].y;
            job.label = `CHECKPOINT ${4 - job.checkpoints.length} / 3`;
            addWanted(1);
          }
        } else if (job.timer <= 0) {
          toast('RACE FAILED', PALETTE.copRed);
          beginJob();
        }
      }
    } else if (job.type === 'race' && !p.onFoot && job.stage === 0) {
      job.stage = 1;
      toast('RACE STARTED', PALETTE.money);
    }
  }

  function step(dt, controls, harmless = false) {
    const p = state.player;
    state.events = 0;
    state.elapsed += dt;
    state.stats.time = state.elapsed;
    state.timeOfDay = (0.62 + state.elapsed / 320) % 1;
    state.camera.shake = Math.max(0, state.camera.shake - dt * 26);

    if (!harmless) {
      p.fireTimer = Math.max(0, p.fireTimer - dt);
      p.crimeTimer = Math.max(0, p.crimeTimer - dt);
      if (p.reload > 0) {
        p.reload -= dt;
        if (p.reload <= 0) finishReload();
      }
      if (controls.reload) reload();
      if (controls.switchWeapon) {
        p.weapon = p.weapon === 'pistol' ? 'smg' : 'pistol';
        toast(p.weapon.toUpperCase(), PALETTE.muted);
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
      } else if (p.car) {
        driveCar(p.car, controls, dt, true);
      }
    }

    for (let index = state.traffic.length - 1; index >= 0; index -= 1) {
      const car = state.traffic[index];
      if (car === p.car) continue;
      driveCar(car, controls, dt, false);
      if (car.hp <= 0) {
        particles(car.x, car.y, 18, PALETTE.orange, 180, 0.9);
        state.traffic.splice(index, 1);
      }
    }

    if (!harmless && !state.over) {
      const desired = Math.min(LIMITS.copCars, p.wanted);
      if (desired === 0) state.cops.length = 0;
      while (state.cops.length < desired) {
        const spot = roadSpot(p);
        state.cops.push(makeCar(spot.x, spot.y, spot.dir, 0, PALETTE.cop, true));
      }
      const footCops = Math.max(0, Math.min(4, p.wanted - 2));
      let count = 0;
      for (const ped of state.peds) if (ped.cop && !ped.dead) count += 1;
      for (let index = count; index < footCops; index += 1) {
        const spot = roadSpot(p);
        const ped = { x: spot.x, y: spot.y, angle: 0, timer: 1, speed: 110, color: PALETTE.cop, panic: 0, cop: true, hp: 60, dead: false };
        state.peds.push(ped);
      }
      for (let index = state.cops.length - 1; index >= 0; index -= 1) {
        const car = state.cops[index];
        driveCar(car, controls, dt, false);
        if (distance(car, p) > 2200 || car.hp <= 0) state.cops.splice(index, 1);
      }
      if (p.wanted > 0) {
        let seen = false;
        for (const car of state.cops) if (distance(car, p) < WANTED.radius) seen = true;
        for (const ped of state.peds) if (ped.cop && distance(ped, p) < WANTED.radius) seen = true;
        if (seen || p.crimeTimer > 0) p.wantedTimer = WANTED.cooldown[p.wanted - 1];
        else {
          p.wantedTimer -= dt;
          if (p.wantedTimer <= 0) {
            p.wanted -= 1;
            p.wantedTimer = WANTED.cooldown[Math.max(0, p.wanted - 1)];
            if (p.wanted === 0) toast('YOU LOST THE COPS', PALETTE.health);
          }
        }
      }
      updateMission(dt, controls);
      for (const car of state.traffic) {
        if (car === p.car) continue;
        const focus = p.onFoot ? p : p.car;
        if (distance(car, focus) < 32 && Math.abs(car.speed) > 70) {
          car.speed *= 0.55;
          if (p.onFoot && !harmless) hurtPlayer(9, 'BUSTED');
        }
      }
      for (const ped of state.peds) {
        if (!ped.cop && !p.onFoot && p.car && Math.abs(p.car.speed) > 90 && Math.hypot(ped.x - p.car.x, ped.y - p.car.y) < 30) {
          ped.dead = true;
          p.car.hp -= 4;
          particles(ped.x, ped.y, 4, PALETTE.copRed, 90, 0.4);
        }
      }
    }

    updatePeds(dt);
    updateBullets(dt);

    for (let index = state.particles.length - 1; index >= 0; index -= 1) {
      const part = state.particles[index];
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.vx *= 1 - dt * 2.4;
      part.vy *= 1 - dt * 2.4;
      part.life -= dt;
      if (part.life <= 0) state.particles.splice(index, 1);
    }

    for (let index = state.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = state.pickups[index];
      pickup.life -= dt;
      pickup.bob += dt * 5;
      const focus = p.onFoot ? p : p.car;
      if (Math.hypot(pickup.x - focus.x, pickup.y - focus.y) < 46) {
        if (pickup.type === 'cash') {
          p.money += pickup.amount;
          state.stats.earned += pickup.amount;
          state.events |= EVENT_CASH;
          toast(`+$${pickup.amount}`, PALETTE.money);
        } else if (pickup.type === 'health') {
          p.health = Math.min(100, p.health + 40);
        } else if (pickup.type === 'armor') {
          p.armor = Math.min(100, p.armor + 50);
        }
        state.pickups.splice(index, 1);
      } else if (pickup.life <= 0) state.pickups.splice(index, 1);
    }

    state.toast.timer = Math.max(0, state.toast.timer - dt);
    state.radio.timer -= dt;
    if (state.radio.timer <= 0) {
      const song = SONGS[Math.floor(state.elapsed / 26) % SONGS.length];
      state.radio.station = song[0];
      state.radio.song = song[1];
      state.radio.timer = 26;
    }

    const focus = p.onFoot && p.car === null ? p : p.car;
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
    player.money = PLAYER.cash;
    player.wanted = 0;
    player.wantedTimer = 0;
    player.crimeTimer = 0;
    player.onFoot = true;
    player.car = null;
    player.weapon = 'pistol';
    player.ammo.pistol = WEAPONS.pistol.magazine;
    player.ammo.smg = WEAPONS.smg.magazine;
    player.reserve.pistol = WEAPONS.pistol.reserve;
    player.reserve.smg = WEAPONS.smg.reserve;
    player.fireTimer = 0;
    player.reload = 0;
    player.aimX = start.x + 160;
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
    state.timeOfDay = 0.62;
    state.stats = { jobs: 0, earned: 0, kills: 0, time: 0, best: state.stats.best };
    state.toast = { text: '', timer: 0, color: PALETTE.text };
    state.radio = { station: SONGS[0][0], song: SONGS[0][1], timer: 26 };
    for (let index = 0; index < LIMITS.traffic; index += 1) {
      const spot = roadSpot();
      state.traffic.push(makeCar(spot.x, spot.y, spot.dir, Math.floor(random() * CAR_TYPES.length), CAR_COLORS[Math.floor(random() * CAR_COLORS.length)]));
    }
    for (let index = 0; index < LIMITS.pedestrians; index += 1) {
      const spot = roadSpot();
      spawnPed(spot.x + (random() - 0.5) * 120, spot.y + (random() - 0.5) * 120);
    }
    beginJob();
  }

  function stage(name) {
    reset();
    state.timeOfDay = 0.73;
    const job = state.mission;
    if (name === 'start') {
      player.x = start.x;
      player.y = start.y;
      player.aimX = start.x + 190;
      player.aimY = start.y - 60;
      player.money = 250;
      state.camera.x = start.x;
      state.camera.y = start.y;
      job.type = 'robbery';
      job.stage = 0;
      job.x = nearestShop(start).x;
      job.y = nearestShop(start).y;
      for (let index = 0; index < 3; index += 1) {
        const spot = roadSpot(start);
        state.cops.push(makeCar(spot.x, spot.y, spot.dir, 0, PALETTE.cop, true));
      }
      return;
    }
    const focusX = 7 * CITY.cell + 40;
    const focusY = 6 * CITY.cell + 40;
    const hero = makeCar(focusX, focusY, 0, 1, '#e9414f');
    hero.speed = 320;
    hero.cruise = 440;
    hero.occupant = true;
    hero.hp = 78;
    state.traffic.push(hero);
    player.x = focusX;
    player.y = focusY;
    player.onFoot = false;
    player.car = hero;
    player.money = 3450;
    player.ammo.smg = 24;
    player.weapon = 'smg';
    player.health = 82;
    player.armor = 55;
    state.camera.x = focusX;
    state.camera.y = focusY;
    state.camera.shake = 4;
    for (let index = 0; index < 4; index += 1) {
      const spot = roadSpot({ x: focusX - 260 - index * 60, y: focusY + (index % 2 ? 120 : -120) });
      const car = makeCar(spot.x, spot.y, 0, 0, PALETTE.cop, true);
      car.speed = 330;
      car.siren = index % 2 === 0;
      state.cops.push(car);
    }
    for (let index = 0; index < 3; index += 1) {
      const angle = -0.1 + index * 0.18;
      bullet(focusX + 80 + index * 30, focusY - 90 + index * 20, angle, 'cop', 9, 620, PALETTE.copBlue);
    }
    particles(focusX - 30, focusY + 10, 12, PALETTE.orange, 150, 0.8);
    if (name === 'end') {
      state.over = true;
      player.cause = 'WASTED';
      player.health = 0;
      hero.hp = 0;
      hero.occupant = false;
      player.onFoot = true;
      player.car = null;
      player.x = focusX + 62;
      player.y = focusY + 34;
      player.wanted = 4;
      player.money = 12400;
      state.stats = { jobs: 5, earned: 12400, kills: 12, time: 842, best: 12400 };
      state.camera.shake = 9;
      particles(hero.x, hero.y, 46, PALETTE.orange, 280, 1.4);
      spawnCash(hero.x + 30, hero.y - 20, 100, 4);
      return;
    }
    player.wanted = 3;
    player.wantedTimer = 15;
    job.type = 'escape';
    job.stage = 1;
    job.timer = 52;
    job.label = 'REACH THE SAFEHOUSE';
    job.x = safehouse.x;
    job.y = safehouse.y;
    state.stats.jobs = 2;
    state.stats.earned = 4200;
    state.stats.kills = 4;
    state.stats.time = 316;
    state.toast = { text: '3 STARS WANTED', timer: 3, color: PALETTE.copRed };
  }

  reset();
  return { state, reset, step, stage, blocked, buildings, trees, blockStyles, start, safehouse };
}
