import { CAR, COMBAT, ECONOMY, PLAYER, TRAFFIC, WANTED } from './config.js';
import { angleTowards, clampValue, distanceBetween, pickOne, randomBetween, randomInt, shortestAngle } from './random.js';
import { MISSIONS, missionForIndex } from './story.js';
import { createEffects } from './effects.js';
import { freshProgress } from './save.js';

export const EVENT_NONE = 0;
export const EVENT_MISSION_DONE = 1;
export const EVENT_GAME_OVER = 2;
export const EVENT_OBJECTIVE = 4;
export const EVENT_SHOT = 8;
export const EVENT_HIT = 16;
export const EVENT_PICKUP = 32;
export const EVENT_WANTED = 64;
export const EVENT_VEHICLE = 128;
export const EVENT_WIN = 256;

const silentAudio = { play() {}, engine() {}, update() {} };

export function createWorld(random, city, audio = silentAudio) {
  const fx = createEffects(random);
  const state = {
    time: 0,
    phase: 'brief',
    money: 350,
    reputation: 0,
    missionIndex: 0,
    mission: null,
    objectiveIndex: 0,
    takedowns: { police: 0, guard: 0 },
    wanted: 0,
    crimeTimer: 0,
    missionElapsed: 0,
    rivalFinished: false,
    player: {
      x: 0,
      y: 0,
      angle: -Math.PI / 2,
      aim: -Math.PI / 2,
      health: PLAYER.maxHealth,
      armor: 35,
      car: null,
      fireTimer: 0,
      reloadTimer: 0,
      ammo: COMBAT.magazine,
      invulnerable: 0,
      walkPhase: 0,
      speed: 0,
    },
    cars: [],
    pedestrians: [],
    cops: [],
    bullets: [],
    pickups: [],
    fx,
  };

  let progress = freshProgress();

  function roadSpotNear(x, y, minDistance = 320) {
    const column = Math.floor(x / 340);
    const row = Math.floor(y / 340);
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidateColumn = clampValue(column + randomInt(random, -3, 3), 1, city.columns);
      const candidateRow = clampValue(row + randomInt(random, -3, 3), 1, city.rows);
      const point = city.roadPoint(candidateColumn, candidateRow);
      if (distanceBetween(point.x, point.y, x, y) >= minDistance) return point;
    }
    return city.findLandmark('precinct');
  }

  function makeCar(kind, x, y, angle, color, model = 0) {
    return {
      kind,
      x,
      y,
      angle,
      speed: 0,
      color,
      model,
      health: 100,
      fireTimer: randomBetween(random, 0.4, 1.4),
      siren: random() * 6.28,
      direction: random() < 0.5 ? -1 : 1,
      gate: 0,
      alive: true,
    };
  }

  function spawnTrafficCar() {
    const vertical = random() < 0.5;
    const column = randomInt(random, 1, city.columns);
    const row = randomInt(random, 1, city.rows);
    if (vertical) {
      const x = city.roadPoint(column, row).x + (random() < 0.5 ? -13 : 13);
      const direction = random() < 0.5 ? -1 : 1;
      return makeCar('traffic', x, randomBetween(random, 100, 2900), direction > 0 ? Math.PI / 2 : -Math.PI / 2, pickOne(random, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), randomInt(random, 0, 2));
    }
    const y = city.roadPoint(column, row).y + (random() < 0.5 ? -13 : 13);
    const direction = random() < 0.5 ? -1 : 1;
    return makeCar('traffic', randomBetween(random, 300, 4000), y, direction > 0 ? 0 : Math.PI, pickOne(random, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), randomInt(random, 0, 2));
  }

  function spawnPedestrian() {
    const point = city.roadPoint(randomInt(random, 1, city.columns), randomInt(random, 1, city.rows));
    return {
      x: point.x + randomBetween(random, -22, 22),
      y: point.y + randomBetween(random, -22, 22),
      angle: random() * Math.PI * 2,
      speed: randomBetween(random, 38, 70),
      timer: randomBetween(random, 1, 5),
      color: pickOne(random, ['#ffd166', '#ef476f', '#4cc9f0', '#f8f4e6', '#8ac926', '#ff9f1c']),
      alive: true,
      panic: 0,
      phase: random() * 6.28,
    };
  }

  function reset(nextProgress) {
    progress = nextProgress ?? freshProgress();
    state.time = 0;
    state.money = progress.money;
    state.reputation = progress.reputation;
    state.missionIndex = progress.missionIndex;
    state.mission = missionForIndex(progress.missionIndex);
    state.objectiveIndex = 0;
    state.takedowns.police = 0;
    state.takedowns.guard = 0;
    state.wanted = 0;
    state.crimeTimer = 0;
    state.missionElapsed = 0;
    state.rivalFinished = false;
    state.phase = progress.missionIndex >= MISSIONS.length ? 'won' : 'brief';

    const start = city.findLandmark('garage');
    state.player.x = start.x;
    state.player.y = start.y + 46;
    state.player.angle = -Math.PI / 2;
    state.player.aim = -Math.PI / 2;
    state.player.health = PLAYER.maxHealth;
    state.player.armor = 35;
    state.player.car = null;
    state.player.fireTimer = 0;
    state.player.reloadTimer = 0;
    state.player.ammo = COMBAT.magazine;
    state.player.invulnerable = 0;
    state.player.speed = 0;

    state.cars.length = 0;
    for (const parked of city.parked) state.cars.push(makeCar('parked', parked.x, parked.y, parked.angle, parked.color, parked.model));
    for (let index = 0; index < TRAFFIC.count; index += 1) state.cars.push(spawnTrafficCar());
    state.pedestrians.length = 0;
    for (let index = 0; index < TRAFFIC.pedestrianCount; index += 1) state.pedestrians.push(spawnPedestrian());
    state.cops.length = 0;
    state.bullets.length = 0;
    state.pickups.length = 0;
    fx.reset();
  }

  function isMissionActive(title) {
    return state.mission !== null && state.phase === 'play' && state.mission.title === title;
  }

  function currentObjective() {
    if (state.mission === null) return null;
    return state.mission.objectives[state.objectiveIndex] ?? null;
  }

  function startMission(index) {
    state.missionIndex = clampValue(index, 0, MISSIONS.length - 1);
    state.mission = missionForIndex(state.missionIndex);
    state.objectiveIndex = 0;
    state.takedowns.police = 0;
    state.takedowns.guard = 0;
    state.missionElapsed = 0;
    state.rivalFinished = false;
    state.phase = 'play';
    audio.play('ui');
    if (state.mission.title === 'POLICE TAKEDOWN') {
      state.wanted = Math.max(state.wanted, 2);
      for (let index = 0; index < 3; index += 1) spawnCop();
    }
    if (state.mission.title === 'STREET RACE') {
      const start = city.findLandmark('race1');
      const rival = makeCar('rival', start.x - 150, start.y, 0, '#ff5252', 1);
      rival.gate = 0;
      state.cars.push(rival);
    }
    if (state.mission.title === 'FINAL SCORE') {
      const villa = city.findLandmark('villa');
      for (let index = 0; index < 4; index += 1) {
        state.cops.push({
          x: villa.x + randomBetween(random, -110, 110),
          y: villa.y + randomBetween(random, -110, 110),
          angle: random() * 6.28,
          health: 55,
          fireTimer: randomBetween(random, 0.5, 1.8),
          kind: 'guard',
          alive: true,
          panic: 0,
        });
      }
    }
  }

  function prepareBrief(index) {
    state.missionIndex = clampValue(index, 0, MISSIONS.length - 1);
    state.mission = missionForIndex(state.missionIndex);
    state.objectiveIndex = 0;
    state.phase = 'brief';
  }

  function finishIntermission() {
    const next = state.missionIndex + 1;
    progress.missionIndex = next;
    progress.completed = next;
    progress.money = state.money;
    progress.reputation = state.reputation;
    if (next >= MISSIONS.length) {
      state.phase = 'won';
      return EVENT_WIN;
    }
    prepareBrief(next);
    return EVENT_NONE;
  }

  function respawn() {
    const start = city.findLandmark('garage');
    state.player.x = start.x;
    state.player.y = start.y + 46;
    state.player.health = PLAYER.maxHealth;
    state.player.armor = 35;
    state.player.ammo = COMBAT.magazine;
    state.player.invulnerable = 2;
    state.player.car = null;
    state.player.speed = 0;
    state.wanted = 0;
    state.cops.length = 0;
    state.bullets.length = 0;
    state.phase = state.mission === null ? 'brief' : 'play';
  }

  function addWanted(amount) {
    const before = Math.ceil(state.wanted);
    state.wanted = clampValue(state.wanted + amount, 0, WANTED.stars);
    state.crimeTimer = 3;
    if (Math.ceil(state.wanted) > before) {
      fx.message(state.player.x, state.player.y - 34, 'WANTED', '#ff5252');
      audio.play('siren');
    }
    if (state.wanted === 0) state.cops.length = 0;
  }

  function nearestCar(x, y, range) {
    let best = null;
    let bestDistance = range;
    for (const car of state.cars) {
      if (!car.alive) continue;
      const distance = distanceBetween(x, y, car.x, car.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = car;
      }
    }
    return best;
  }

  function toggleVehicle() {
    if (state.phase !== 'play') return false;
    const player = state.player;
    if (player.car !== null) {
      const car = player.car;
      const side = car.angle + Math.PI / 2;
      player.x = car.x + Math.cos(side) * (CAR.width + 8);
      player.y = car.y + Math.sin(side) * (CAR.width + 8);
      player.car = null;
      car.speed = 0;
      car.kind = car.kind === 'police' ? 'police' : car.kind;
      audio.play('carjack');
      return true;
    }
    const car = nearestCar(player.x, player.y, PLAYER.interactRange);
    if (car === null) return false;
    player.car = car;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    if (car.kind === 'parked') {
      car.kind = 'player';
      addWanted(WANTED.starForCar);
      fx.message(car.x, car.y - 35, 'CAR TAKEN', '#ffd45e');
    } else if (car.kind === 'police') {
      car.kind = 'player';
      addWanted(2);
      fx.message(car.x, car.y - 35, 'POLICE CAR!', '#ff5252');
    } else if (car.kind === 'traffic') {
      car.kind = 'player';
      addWanted(0.35);
    } else if (car.kind === 'rival') {
      car.kind = 'player';
    }
    car.speed = 0;
    audio.play('carjack');
    return true;
  }

  function fireBullet(originX, originY, angle, owner, damage) {
    state.bullets.push({
      x: originX + Math.cos(angle) * 16,
      y: originY + Math.sin(angle) * 16,
      vx: Math.cos(angle) * COMBAT.bulletSpeed,
      vy: Math.sin(angle) * COMBAT.bulletSpeed,
      life: COMBAT.bulletLife,
      owner,
      damage,
    });
    fx.burst(originX + Math.cos(angle) * 18, originY + Math.sin(angle) * 18, '#fff1a8', 4, 90, 0.18);
    fx.kick(owner === 'player' ? 3.2 : 0.8);
  }

  function defeatTarget(target, type) {
    fx.burst(target.x, target.y, '#ffb703', 14, 210, 0.65);
    fx.message(target.x, target.y - 30, `+$${ECONOMY.takedownCash}`, '#4ddb8d');
    state.money += ECONOMY.takedownCash;
    audio.play('cash');
    if (type === 'police' || type === 'guard') {
      state.takedowns[type] += 1;
      addWanted(type === 'police' ? 0.7 : 0.35);
      state.pickups.push({ x: target.x, y: target.y, kind: 'cash', life: 18, amount: 60 });
    }
  }

  function hurtPlayer(amount, source) {
    const player = state.player;
    if (player.invulnerable > 0 || state.phase !== 'play') return;
    const absorbed = Math.min(player.armor, amount * COMBAT.armorAbsorb);
    player.armor -= absorbed;
    player.health -= amount - absorbed;
    player.invulnerable = 0.35;
    fx.burst(player.x, player.y, '#ff6b5e', 8, 130, 0.4);
    fx.kick(7, '#ff5252');
    audio.play('hurt');
    if (source === 'police') addWanted(0.25);
    if (player.health <= 0) {
      player.health = 0;
      state.phase = 'dead';
      fx.kick(16, '#ff5252');
    }
  }

  function updatePlayer(dt, command) {
    const player = state.player;
    player.fireTimer = Math.max(0, player.fireTimer - dt);
    player.reloadTimer = Math.max(0, player.reloadTimer - dt);
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    const axis = command.axis ?? { x: 0, y: 0 };
    player.aim = angleTowards(player.x, player.y, command.aimX ?? player.x + 1, command.aimY ?? player.y);

    if (player.car !== null) {
      const car = player.car;
      const throttle = -axis.y;
      if (throttle > 0) car.speed += CAR.engine * dt;
      else if (throttle < 0) car.speed -= CAR.brake * dt;
      else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.friction * dt);
      if (axis.y > 0 && car.speed < 0) car.speed = Math.min(car.speed + CAR.engine * dt, 0);
      car.speed = clampValue(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      const steering = axis.x * CAR.steer * dt * Math.min(1, Math.abs(car.speed) / 110) * Math.sign(car.speed || 1);
      car.angle += steering;
      const moveX = Math.cos(car.angle) * car.speed * dt;
      const moveY = Math.sin(car.angle) * car.speed * dt;
      const moved = city.slideMove(car.x, car.y, moveX, moveY, 24);
      if (moved.hit && Math.abs(car.speed) > 90) {
        hurtPlayer(Math.min(14, Math.abs(car.speed) * CAR.collisionDamage / 100), 'crash');
        fx.burst(car.x, car.y, '#f2dda4', 8, 120, 0.35);
        audio.play('crash');
      }
      car.x = moved.x;
      car.y = moved.y;
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      player.speed = car.speed;
      if (Math.abs(car.speed) > 40 && random() < 0.16) fx.puff(car.x - Math.cos(car.angle) * 28, car.y - Math.sin(car.angle) * 28, 'rgba(255,255,255,0.5)', 2);
    } else {
      const length = Math.hypot(axis.x, axis.y);
      const speed = command.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      const scale = length > 0 ? speed / length : 0;
      const moved = city.slideMove(player.x, player.y, axis.x * scale * dt, axis.y * scale * dt, PLAYER.radius);
      player.x = moved.x;
      player.y = moved.y;
      player.angle = player.aim;
      player.speed = length * speed;
      player.walkPhase += dt * (length > 0 ? 12 : 3);
    }

    if (command.firing && player.fireTimer === 0 && player.reloadTimer === 0 && state.phase === 'play') {
      if (player.ammo <= 0) {
        player.reloadTimer = COMBAT.reloadTime;
        player.ammo = COMBAT.magazine;
        audio.play('ui');
      } else {
        player.ammo -= 1;
        player.fireTimer = COMBAT.fireDelay;
        fireBullet(player.x, player.y, player.aim, 'player', COMBAT.playerDamage);
        audio.play('shot');
        addWanted(WANTED.starForShot);
      }
    }
  }

  function updateCars(dt) {
    for (const car of state.cars) {
      if (!car.alive || car === state.player.car) continue;
      if (car.kind === 'traffic') {
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        if (car.x < WORLD_MIN_X || car.x > 4150 || car.y < 30 || car.y > 3060) {
          car.x = clampValue(car.x, 320, 4100);
          car.y = clampValue(car.y, 40, 3040);
          car.angle += Math.PI;
        }
      } else if (car.kind === 'police') {
        updatePoliceCar(car, dt);
      } else if (car.kind === 'rival') {
        updateRivalCar(car, dt);
      }
      car.siren += dt * 9;
    }
  }

  const WORLD_MIN_X = 300;

  function updatePoliceCar(car, dt) {
    const player = state.player;
    const targetAngle = angleTowards(car.x, car.y, player.x, player.y);
    const turn = shortestAngle(car.angle, targetAngle);
    car.angle += clampValue(turn, -2.2 * dt, 2.2 * dt);
    const distance = distanceBetween(car.x, car.y, player.x, player.y);
    const desired = distance > 90 ? 240 : 0;
    car.speed += (desired - car.speed) * dt * 2;
    const moved = city.slideMove(car.x, car.y, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, 24);
    if (moved.hit) car.speed *= 0.35;
    car.x = moved.x;
    car.y = moved.y;
    if (distance < 44 && player.invulnerable === 0) {
      hurtPlayer(6, 'police');
      fx.burst(player.x, player.y, '#ffd45e', 5, 100, 0.3);
    }
  }

  function updateRivalCar(car, dt) {
    if (!isMissionActive('STREET RACE')) return;
    const gates = ['race1', 'race2', 'race3', 'race4'];
    const target = city.findLandmark(gates[Math.min(car.gate, gates.length - 1)]);
    const distance = distanceBetween(car.x, car.y, target.x, target.y);
    if (distance < 90) {
      car.gate += 1;
      if (car.gate >= gates.length) {
        state.rivalFinished = true;
        return;
      }
    }
    const targetAngle = angleTowards(car.x, car.y, target.x, target.y);
    car.angle += clampValue(shortestAngle(car.angle, targetAngle), -2.5 * dt, 2.5 * dt);
    car.speed += (280 - car.speed) * dt * 2;
    const moved = city.slideMove(car.x, car.y, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, 24);
    if (moved.hit) {
      car.speed *= 0.4;
      car.angle += 0.4;
    }
    car.x = moved.x;
    car.y = moved.y;
  }

  function spawnCop() {
    const point = roadSpotNear(state.player.x, state.player.y);
    state.cops.push({
      x: point.x,
      y: point.y,
      angle: random() * 6.28,
      health: 48,
      fireTimer: randomBetween(random, 0.6, 1.8),
      kind: 'police',
      alive: true,
      panic: 0,
    });
  }

  function spawnPoliceCar() {
    const point = roadSpotNear(state.player.x, state.player.y, 420);
    state.cars.push(makeCar('police', point.x, point.y, random() * 6.28, '#20304a', 0));
  }

  function updatePolicePresence(dt) {
    const wantedCars = Math.ceil(state.wanted);
    const wantedCops = state.wanted >= 2 ? Math.ceil(state.wanted) + 1 : 0;
    const neededCops = isMissionActive('POLICE TAKEDOWN') ? Math.max(wantedCops, 3 - state.takedowns.police) : wantedCops;
    let policeCars = state.cars.filter((car) => car.kind === 'police' && car.alive).length;
    let footCops = state.cops.filter((cop) => cop.kind === 'police' && cop.alive).length;
    if (policeCars < wantedCars && state.wanted > 0) {
      spawnPoliceCar();
      policeCars += 1;
    }
    if (footCops < neededCops && (state.wanted > 0 || isMissionActive('POLICE TAKEDOWN'))) {
      spawnCop();
      footCops += 1;
    }
    if (state.wanted > 0) {
      let nearest = Infinity;
      for (const car of state.cars) if (car.kind === 'police') nearest = Math.min(nearest, distanceBetween(car.x, car.y, state.player.x, state.player.y));
      for (const cop of state.cops) if (cop.kind === 'police') nearest = Math.min(nearest, distanceBetween(cop.x, cop.y, state.player.x, state.player.y));
      state.crimeTimer = nearest < WANTED.sightRange ? 3 : Math.max(0, state.crimeTimer - dt);
      if (state.crimeTimer === 0) state.wanted = Math.max(0, state.wanted - dt / WANTED.decayTime);
      if (state.wanted <= 0.05) {
        state.wanted = 0;
        for (const car of state.cars) if (car.kind === 'police') car.alive = false;
        for (const cop of state.cops) if (cop.kind === 'police') cop.alive = false;
      }
    }
  }

  function updateCops(dt) {
    for (const cop of state.cops) {
      if (!cop.alive) continue;
      const distance = distanceBetween(cop.x, cop.y, state.player.x, state.player.y);
      const guardMode = cop.kind === 'guard';
      if (guardMode && distance > 430) continue;
      const targetAngle = angleTowards(cop.x, cop.y, state.player.x, state.player.y);
      cop.angle += clampValue(shortestAngle(cop.angle, targetAngle), -3 * dt, 3 * dt);
      if (distance > (guardMode ? 220 : 250)) {
        const moved = city.slideMove(cop.x, cop.y, Math.cos(cop.angle) * 135 * dt, Math.sin(cop.angle) * 135 * dt, PLAYER.radius);
        cop.x = moved.x;
        cop.y = moved.y;
      }
      cop.fireTimer -= dt;
      if (distance < COMBAT.range && cop.fireTimer <= 0 && state.phase === 'play') {
        cop.fireTimer = COMBAT.policeFireDelay + randomBetween(random, -0.3, 0.5);
        const spread = randomBetween(random, -0.09, 0.09);
        fireBullet(cop.x, cop.y, cop.angle + spread, 'enemy', COMBAT.policeDamage);
        audio.play('shot');
      }
    }
    for (let index = state.cops.length - 1; index >= 0; index -= 1) {
      if (!state.cops[index].alive) state.cops.splice(index, 1);
    }
  }

  function updatePedestrians(dt) {
    for (const pedestrian of state.pedestrians) {
      if (!pedestrian.alive) continue;
      pedestrian.timer -= dt;
      pedestrian.panic = Math.max(0, pedestrian.panic - dt);
      const threat = state.wanted > 0 ? distanceBetween(pedestrian.x, pedestrian.y, state.player.x, state.player.y) : Infinity;
      if (threat < 230) pedestrian.panic = 1.8;
      if (pedestrian.timer <= 0) {
        pedestrian.timer = randomBetween(random, 2, 6);
        pedestrian.angle += randomBetween(random, -1.4, 1.4);
      }
      if (pedestrian.panic > 0) pedestrian.angle = angleTowards(pedestrian.x, pedestrian.y, state.player.x, state.player.y) + Math.PI;
      const speed = pedestrian.panic > 0 ? pedestrian.speed * 2.4 : pedestrian.speed;
      const moved = city.slideMove(pedestrian.x, pedestrian.y, Math.cos(pedestrian.angle) * speed * dt, Math.sin(pedestrian.angle) * speed * dt, 9);
      pedestrian.x = moved.x;
      pedestrian.y = moved.y;
      pedestrian.phase += dt * 6;
      if (state.player.car !== null && distanceBetween(pedestrian.x, pedestrian.y, state.player.x, state.player.y) < 28 && Math.abs(state.player.car.speed) > 45) {
        pedestrian.alive = false;
        fx.burst(pedestrian.x, pedestrian.y, '#ff6b5e', 7, 110, 0.4);
        state.money = Math.max(0, state.money + ECONOMY.pedestrianFine);
        fx.message(state.player.x, state.player.y - 40, 'HIT AND RUN -$250', '#ff5252');
        addWanted(WANTED.starForHit);
        audio.play('crash');
      }
    }
    for (let index = state.pedestrians.length - 1; index >= 0; index -= 1) {
      if (!state.pedestrians[index].alive) {
        state.pedestrians.splice(index, 1);
        if (state.pedestrians.length < TRAFFIC.pedestrianCount && random() < 0.3) state.pedestrians.push(spawnPedestrian());
      }
    }
  }

  function updateBullets(dt) {
    for (let index = state.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = state.bullets[index];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      let consumed = bullet.life <= 0 || city.blockedAt(bullet.x, bullet.y, 2);
      if (!consumed && bullet.owner === 'player') {
        for (const cop of state.cops) {
          if (!cop.alive || distanceBetween(bullet.x, bullet.y, cop.x, cop.y) > 17) continue;
          cop.health -= bullet.damage;
          fx.burst(bullet.x, bullet.y, '#ffd45e', 5, 120, 0.3);
          if (cop.health <= 0) {
            cop.alive = false;
            defeatTarget(cop, cop.kind);
          }
          consumed = true;
          break;
        }
        if (!consumed) {
          for (const car of state.cars) {
            if (!car.alive || car.kind === 'player' || car.kind === 'parked' || distanceBetween(bullet.x, bullet.y, car.x, car.y) > 28) continue;
            car.health -= bullet.damage;
            fx.burst(bullet.x, bullet.y, '#ffffff', 4, 100, 0.25);
            if (car.health <= 0) {
              car.alive = false;
              defeatTarget(car, car.kind === 'police' || car.kind === 'rival' ? 'police' : 'traffic');
            }
            consumed = true;
            break;
          }
        }
        if (!consumed) {
          for (const pedestrian of state.pedestrians) {
            if (!pedestrian.alive || distanceBetween(bullet.x, bullet.y, pedestrian.x, pedestrian.y) > 12) continue;
            pedestrian.alive = false;
            fx.burst(bullet.x, bullet.y, '#ff6b5e', 6, 120, 0.35);
            addWanted(WANTED.starForHit);
            consumed = true;
            break;
          }
        }
      } else if (!consumed && bullet.owner === 'enemy') {
        if (distanceBetween(bullet.x, bullet.y, state.player.x, state.player.y) < (state.player.car === null ? 16 : 24)) {
          hurtPlayer(bullet.damage, 'police');
          consumed = true;
        }
      }
      if (consumed) state.bullets.splice(index, 1);
    }
  }

  function updatePickups(dt) {
    for (let index = state.pickups.length - 1; index >= 0; index -= 1) {
      const pickup = state.pickups[index];
      pickup.life -= dt;
      if (pickup.life <= 0) {
        state.pickups.splice(index, 1);
        continue;
      }
      if (distanceBetween(pickup.x, pickup.y, state.player.x, state.player.y) < 32) {
        if (pickup.kind === 'cash') state.money += pickup.amount;
        else if (pickup.kind === 'health') state.player.health = Math.min(PLAYER.maxHealth, state.player.health + ECONOMY.healthPickup);
        else state.player.armor = Math.min(PLAYER.maxArmor, state.player.armor + ECONOMY.armorPickup);
        fx.message(pickup.x, pickup.y - 24, pickup.kind === 'cash' ? `+$${pickup.amount}` : pickup.kind === 'health' ? '+HEALTH' : '+ARMOR', '#4ddb8d');
        audio.play('pickup');
        state.pickups.splice(index, 1);
      }
    }
  }

  function completeMission() {
    const mission = state.mission;
    if (mission === null) return EVENT_NONE;
    state.money += mission.reward.money;
    state.reputation += mission.reward.reputation;
    progress.money = state.money;
    progress.reputation = state.reputation;
    state.phase = 'intermission';
    fx.message(state.player.x, state.player.y - 44, 'JOB COMPLETE', '#ffd45e');
    fx.kick(6, '#ffd45e');
    audio.play('mission');
    return EVENT_MISSION_DONE;
  }

  function checkObjectives() {
    const objective = currentObjective();
    if (objective === null || state.phase !== 'play') return EVENT_NONE;
    let done = false;
    if (objective.type === 'goto') {
      const target = city.findLandmark(objective.place);
      done = distanceBetween(state.player.x, state.player.y, target.x, target.y) <= objective.radius && (!objective.needVehicle || state.player.car !== null);
    } else if (objective.type === 'takedown') {
      done = state.takedowns[objective.kind] >= objective.count;
    }
    if (!done) return EVENT_NONE;
    state.objectiveIndex += 1;
    audio.play('pickup');
    if (state.objectiveIndex >= state.mission.objectives.length) return completeMission();
    fx.message(state.player.x, state.player.y - 38, 'OBJECTIVE COMPLETE', '#4ddb8d');
    return EVENT_OBJECTIVE;
  }

  function step(dt, command = {}) {
    let events = EVENT_NONE;
    state.time += dt;
    if (state.phase !== 'play') {
      fx.update(dt);
      audio.engine(0, false);
      return events;
    }
    state.missionElapsed += dt;
    updatePlayer(dt, command);
    updateCars(dt);
    updatePolicePresence(dt);
    updateCops(dt);
    updatePedestrians(dt);
    updateBullets(dt);
    updatePickups(dt);
    fx.update(dt);
    if (Math.floor(state.time) % 5 === 0 && state.cars.length > 240) {
      for (let index = state.cars.length - 1; index >= 0; index -= 1) {
        const car = state.cars[index];
        if (!car.alive && car !== state.player.car) state.cars.splice(index, 1);
      }
    }
    audio.engine(state.player.car === null ? 0 : state.player.car.speed, state.player.car !== null);
    audio.update(dt, state.wanted);
    events |= checkObjectives();
    if (state.phase === 'dead') events |= EVENT_GAME_OVER;
    return events;
  }

  function objectiveText() {
    const objective = currentObjective();
    if (objective === null || state.mission === null) return 'FREE ROAM — take a job at a contact';
    if (objective.type === 'takedown') {
      return `${objective.label.split(' (')[0]} (${state.takedowns[objective.kind]}/${objective.count})`;
    }
    const target = city.findLandmark(objective.place);
    const distance = Math.round(distanceBetween(state.player.x, state.player.y, target.x, target.y));
    return `${objective.label} — ${distance}m`;
  }

  function resetTakedowns() {
    state.takedowns.police = 0;
    state.takedowns.guard = 0;
  }

  reset(progress);
  return {
    state,
    reset,
    step,
    startMission,
    prepareBrief,
    finishIntermission,
    respawn,
    addWanted,
    toggleVehicle,
    objectiveText,
    currentObjective,
    resetTakedowns,
    isMissionActive,
  };
}
