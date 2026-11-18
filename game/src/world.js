// The simulation: driving, stealing, traffic, pedestrians, shooting, wanted police, the six jobs,
// money and reputation. Drawing lives in render.js; this file only changes state and returns event
// flags for the caller to turn into sound and announcements.
import { CAR, MISSION, PLAYER, POLICE, WORLD } from './config.js';
import { angleDelta, clamp, distance } from './random.js';
import { LANDMARKS, hitsBuilding, isWater, nearestRoad } from './city.js';
import { MISSIONS, createMissionProgress, currentMission } from './story.js';

export const EVENT_SHOT = 1;
export const EVENT_HIT = 2;
export const EVENT_CASH = 4;
export const EVENT_SIREN = 8;
export const EVENT_OVER = 16;
export const EVENT_MISSION = 32;
export const EVENT_ENTER = 64;
export const EVENT_CRASH = 128;
export const EVENT_FAIL = 256;

const CAR_COLORS = ['#f2545b', '#ffd23f', '#38b6a8', '#6c8cff', '#f28f3b', '#f7f2e6', '#9d6bdb', '#2fb56b'];
const PED_COLORS = ['#ff7f7f', '#ffd166', '#64d2b2', '#8ea9ff', '#f2a6d8', '#f6f1e4'];
const MAX_BULLETS = 180;

/** A blank car record; the pool is created once and recycled by changing `mode`. */
function blankCar(index) {
  return {
    id: index, mode: 'idle', x: 0, y: 0, angle: 0, speed: 0, maxSpeed: CAR.trafficSpeed,
    color: CAR_COLORS[index % CAR_COLORS.length], health: CAR.maxHealth, owner: 'world',
    axis: 'h', dir: 0, next: 0, timer: 0, retired: 0, siren: 0, flash: 0,
  };
}

/** A blank pedestrian record. */
function blankPed(index) {
  return {
    id: index, x: 0, y: 0, angle: 0, speed: 45, color: PED_COLORS[index % PED_COLORS.length],
    timer: 0, down: 0, phase: index * 0.7,
  };
}

/** A blank on-foot law enforcer / villa guard. */
function blankOfficer(index) {
  return {
    id: index, mode: 'idle', x: 0, y: 0, angle: 0, speed: POLICE.officerSpeed,
    health: POLICE.officerHealth, timer: 0, guard: false, fireTimer: 0,
  };
}

/** A blank bullet record. */
function blankBullet(index) {
  return { id: index, active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, friendly: true, damage: 10, color: '#fff' };
}

export function createWorld(random, city, effects) {
  const cars = [];
  const peds = [];
  const officers = [];
  const bullets = [];
  for (let index = 0; index < 52; index += 1) cars.push(blankCar(index));
  for (let index = 0; index < 34; index += 1) peds.push(blankPed(index));
  for (let index = 0; index < 14; index += 1) officers.push(blankOfficer(index));
  for (let index = 0; index < MAX_BULLETS; index += 1) bullets.push(blankBullet(index));

  const player = {
    x: LANDMARKS.start.x, y: LANDMARKS.start.y, angle: 0, aimAngle: 0, moveAngle: 0,
    health: PLAYER.maxHealth, armor: PLAYER.maxArmor, inCar: false, car: null,
    fireCooldown: 0, invuln: 0, walkPhase: 0,
  };

  const state = {
    city, player, cars, peds, officers, bullets,
    camera: { x: player.x, y: player.y },
    money: 250, reputation: 0, wanted: 0, wantedPoints: 0, wantedTimer: 0,
    spawnTimer: 0, elapsed: 0, gameOver: false, victory: false,
    mission: { index: 0, progress: createMissionProgress() },
    briefing: null, toast: null, totalEarned: 0,
    stats: { cruisers: 0, guards: 0, carsStolen: 0, distance: 0 },
  };

  function toast(text, seconds = 3.4, color = '#ffd23f') {
    state.toast = { text, time: seconds, color };
  }

  function showBriefing(mission) {
    state.briefing = {
      number: state.mission.index + 1,
      title: mission.title,
      contact: mission.contact,
      text: mission.brief,
      objective: mission.objective,
      reward: mission.reward,
      reputation: mission.reputation,
      time: 7,
    };
  }

  /** Put a traffic car on a road somewhere near the player. */
  function placeTrafficCar(car) {
    const vertical = random.chance(0.5);
    car.mode = 'traffic';
    car.owner = 'world';
    car.health = CAR.maxHealth;
    car.maxSpeed = CAR.trafficSpeed * random.range(0.75, 1.25);
    car.color = random.pick(CAR_COLORS);
    const lane = 34;
    if (vertical) {
      const road = random.pick(WORLD.verticalRoads);
      car.axis = 'v';
      car.dir = random.chance(0.5) ? 1 : 3;
      car.x = road + (car.dir === 1 ? -lane : lane);
      car.y = clamp(player.y + random.range(-900, 900), 110, WORLD.height - 110);
      car.angle = car.dir * Math.PI / 2;
      car.next = nextIntersection('v', car.dir, car.y);
    } else {
      const road = random.pick(WORLD.horizontalRoads);
      car.axis = 'h';
      car.dir = random.chance(0.5) ? 0 : 2;
      car.y = road + (car.dir === 0 ? lane : -lane);
      car.x = clamp(player.x + random.range(-950, 950), 110, WORLD.shoreX - 110);
      car.angle = car.dir * Math.PI / 2;
      car.next = nextIntersection('h', car.dir, car.x);
    }
    car.speed = car.maxSpeed * 0.8;
  }

  /** The next intersection coordinate ahead of `position` along an axis and direction. */
  function nextIntersection(axis, dir, position) {
    const roads = axis === 'v' ? WORLD.horizontalRoads : WORLD.verticalRoads;
    if (dir === 0 || dir === 1) {
      for (const road of roads) if (road > position + 2) return road;
      return roads[roads.length - 1];
    }
    for (let index = roads.length - 1; index >= 0; index -= 1) if (roads[index] < position - 2) return roads[index];
    return roads[0];
  }

  /** Recycle a car that has wandered far away. */
  function recycleTrafficCar(car) {
    if (distance(car.x, car.y, player.x, player.y) > 1700) placeTrafficCar(car);
  }

  function placePed(ped) {
    const vertical = random.chance(0.5);
    const lane = random.range(72, 104) * (random.chance(0.5) ? 1 : -1);
    if (vertical) {
      ped.x = random.pick(WORLD.verticalRoads) + lane;
      ped.y = random.range(110, WORLD.height - 110);
    } else {
      ped.x = random.pick(WORLD.verticalRoads) + lane;
      ped.y = random.pick(WORLD.horizontalRoads) + lane;
    }
    ped.x = clamp(ped.x, 60, WORLD.shoreX - 60);
    ped.y = clamp(ped.y, 60, WORLD.height - 60);
    if (hitsBuilding(city, ped.x, ped.y, 8)) {
      ped.x = random.pick(WORLD.verticalRoads) + 95;
      ped.y = random.pick(WORLD.horizontalRoads) + 95;
    }
    ped.angle = random.range(0, Math.PI * 2);
    ped.timer = random.range(1, 4);
    ped.down = 0;
  }

  /** Spawn a patrol car at a road point away from the player but in view. */
  function spawnPoliceCar(guardMode = false) {
    const car = cars.find((item) => item.mode === 'idle' || item.mode === 'wreck' || item.mode === 'leaving');
    if (!car) return null;
    const nearRoad = nearestRoad(player.x, player.y);
    const side = random.chance(0.5) ? 1 : -1;
    car.mode = 'police';
    car.owner = 'police';
    car.health = CAR.maxHealth;
    car.maxSpeed = CAR.policeSpeed;
    car.speed = CAR.policeSpeed * 0.65;
    car.x = clamp(nearRoad.x + side * random.range(430, 720), 90, WORLD.shoreX - 90);
    car.y = clamp(nearRoad.y + side * random.range(430, 720), 90, WORLD.height - 90);
    if (hitsBuilding(city, car.x, car.y, 30)) {
      car.x = clamp(nearRoad.x, 90, WORLD.shoreX - 90);
      car.y = clamp(nearRoad.y, 90, WORLD.height - 90);
    }
    car.angle = Math.atan2(player.y - car.y, player.x - car.x);
    car.siren = random.range(0, 6.28);
    car.retired = guardMode ? 0 : 9;
    return car;
  }

  function spawnOfficer(guard = false, x = 0, y = 0) {
    const officer = officers.find((item) => item.mode === 'idle');
    if (!officer) return null;
    officer.mode = guard ? 'guard' : 'police';
    officer.guard = guard;
    officer.health = guard ? 78 : POLICE.officerHealth;
    officer.speed = guard ? 118 : POLICE.officerSpeed;
    officer.x = x;
    officer.y = y;
    officer.timer = 0;
    officer.fireTimer = random.range(0.4, 1.4);
    return officer;
  }

  /** Start the given ordered job and prepare anything that job needs in the world. */
  function startMission(index) {
    if (index < 0 || index >= MISSIONS.length) return;
    state.mission.index = index;
    state.mission.progress = createMissionProgress();
    const mission = MISSIONS[index];
    showBriefing(mission);
    if (mission.kind === 'takedown') {
      state.mission.progress.baseline = state.stats.cruisers;
      addWanted(200, true);
      state.spawnTimer = 0.2;
      spawnPoliceCar();
      spawnPoliceCar();
    } else if (mission.kind === 'shopping') {
      state.mission.progress.timer = MISSION.shoppingSeconds;
    } else if (mission.kind === 'race') {
      const car = cars.find((item) => item.mode === 'idle');
      if (car) {
        car.mode = 'rival';
        car.owner = 'rival';
        car.health = CAR.maxHealth;
        car.maxSpeed = CAR.rivalSpeed;
        car.speed = 0;
        car.x = LANDMARKS.raceGates[0].x + 75;
        car.y = LANDMARKS.raceGates[0].y - 70;
        car.angle = 0;
      }
    } else if (mission.kind === 'final') {
      state.wanted = Math.max(state.wanted, 2);
      state.wantedPoints = Math.max(state.wantedPoints, 200);
      const villa = LANDMARKS.villa;
      const spots = [[-85, -40], [95, -35], [-80, 100], [90, 105], [10, 145]];
      for (const [dx, dy] of spots) spawnOfficer(true, villa.x + dx, villa.y + dy);
    }
  }

  /** Award the current job, announce it and open the next one (or win the game). */
  function completeMission() {
    const mission = currentMission(state.mission.index);
    if (!mission) return 0;
    state.money += mission.reward;
    state.reputation += mission.reputation;
    state.totalEarned += mission.reward;
    effects.floatText(player.x, player.y - 60, `+$${mission.reward}`, '#ffd23f', 26);
    toast(`${mission.title} complete  +$${mission.reward}  +${mission.reputation} REP`, 4.5, '#69df9a');
    const next = state.mission.index + 1;
    if (next >= MISSIONS.length) {
      state.victory = true;
      state.mission.index = MISSIONS.length;
      state.mission.progress = createMissionProgress();
    } else {
      startMission(next);
    }
    return EVENT_CASH | EVENT_MISSION;
  }

  /** Increase heat; a new star triggers the siren cue. */
  function addWanted(points, silent = false) {
    if (state.gameOver) return 0;
    const before = state.wanted;
    state.wantedPoints = Math.min(560, state.wantedPoints + points);
    state.wantedTimer = POLICE.decayDelay;
    state.wanted = clamp(Math.ceil(state.wantedPoints / POLICE.wantedPerStar), 0, 5);
    return !silent && state.wanted > before ? EVENT_SIREN : 0;
  }

  /** Apply damage to the player, armor first. */
  function damagePlayer(amount) {
    if (player.invuln > 0 || state.gameOver) return 0;
    let remaining = amount;
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, remaining * 0.7);
      player.armor -= absorbed;
      remaining -= absorbed;
    }
    player.health -= remaining;
    player.invuln = 0.34;
    effects.burst(player.x, player.y, 8, '#ff8b6b', 150, 4);
    effects.addShake(5);
    if (player.health <= 0) {
      player.health = 0;
      state.gameOver = true;
      return EVENT_OVER | EVENT_HIT;
    }
    return EVENT_HIT;
  }

  /** Fire one bullet from the player toward the current aim point. */
  function firePlayer(aimX, aimY) {
    const angle = Math.atan2(aimY - player.y, aimX - player.x) + random.range(-0.035, 0.035);
    const bullet = bullets.find((item) => !item.active);
    if (!bullet) return 0;
    bullet.active = true;
    bullet.x = player.x + Math.cos(angle) * 24;
    bullet.y = player.y + Math.sin(angle) * 24;
    bullet.vx = Math.cos(angle) * PLAYER.bulletSpeed;
    bullet.vy = Math.sin(angle) * PLAYER.bulletSpeed;
    bullet.life = 0.9;
    bullet.friendly = true;
    bullet.damage = PLAYER.bulletDamage;
    bullet.color = PALETTE_BULLET;
    effects.muzzle(player.x, player.y, angle);
    return EVENT_SHOT | addWanted(9, true);
  }

  /** Fire a bullet from an officer or police car toward the player. */
  function fireEnemy(x, y, inaccuracy, damage, speed = 620) {
    const bullet = bullets.find((item) => !item.active);
    if (!bullet) return;
    const angle = Math.atan2(player.y - y, player.x - x) + random.range(-inaccuracy, inaccuracy);
    bullet.active = true;
    bullet.x = x + Math.cos(angle) * 20;
    bullet.y = y + Math.sin(angle) * 20;
    bullet.vx = Math.cos(angle) * speed;
    bullet.vy = Math.sin(angle) * speed;
    bullet.life = 1.6;
    bullet.friendly = false;
    bullet.damage = damage;
    bullet.color = '#ff6b7d';
    effects.muzzle(x, y, angle);
  }

  /** Enter the closest vehicle, or leave the current one. */
  function handleVehicleInteraction() {
    if (player.inCar && player.car) {
      const car = player.car;
      const side = car.angle + Math.PI / 2;
      player.x = car.x + Math.cos(side) * 52;
      player.y = car.y + Math.sin(side) * 52;
      if (hitsBuilding(city, player.x, player.y, PLAYER.radius) || isWater(player.x, player.y)) {
        player.x = car.x - Math.cos(side) * 52;
        player.y = car.y - Math.sin(side) * 52;
      }
      player.inCar = false;
      player.car = null;
      car.mode = 'parked';
      car.owner = 'world';
      car.speed = 0;
      return EVENT_ENTER;
    }
    let nearest = null;
    let nearestDistance = PLAYER.interactRange;
    for (const car of cars) {
      if (car.mode === 'idle' || car.mode === 'wreck') continue;
      if (car.speed > 135) continue;
      const delta = distance(car.x, car.y, player.x, player.y);
      if (delta < nearestDistance) {
        nearestDistance = delta;
        nearest = car;
      }
    }
    if (!nearest) return 0;
    const previousOwner = nearest.owner;
    nearest.mode = 'player';
    nearest.owner = 'player';
    nearest.speed = Math.max(0, nearest.speed * 0.4);
    player.inCar = true;
    player.car = nearest;
    player.x = nearest.x;
    player.y = nearest.y;
    state.stats.carsStolen += 1;
    effects.floatText(player.x, player.y - 48, previousOwner === 'police' ? 'HOT WHEELS!' : 'CAR TAKEN', '#7de8ff', 18);
    return EVENT_ENTER | addWanted(previousOwner === 'police' ? 90 : 34, true);
  }

  /** The markers the player is currently meant to reach. */
  function targets() {
    const mission = currentMission(state.mission.index);
    if (!mission || state.victory) return [];
    const progress = state.mission.progress;
    if (mission.kind === 'checkpoints') return [LANDMARKS.checkpoints[progress.progress] ?? LANDMARKS.checkpoints[0]];
    if (mission.kind === 'handoff') return [progress.stage === 0 ? LANDMARKS.handoffPickup : LANDMARKS.handoffDrop];
    if (mission.kind === 'shopping') return [LANDMARKS.shops[progress.progress] ?? LANDMARKS.shops[0]];
    if (mission.kind === 'race') return [LANDMARKS.raceGates[progress.progress] ?? LANDMARKS.raceGates[0]];
    if (mission.kind === 'takedown') {
      const police = cars.filter((item) => item.mode === 'police');
      return police.length ? [{ x: police[0].x, y: police[0].y, label: 'PATROL CRUISER' }] : [];
    }
    if (mission.kind === 'final') {
      if (progress.stage === 0) {
        const guard = officers.find((item) => item.mode === 'guard');
        return guard ? [{ x: guard.x, y: guard.y, label: 'VILLA GUARD' }] : [];
      }
      return [LANDMARKS.escape];
    }
    return [];
  }

  /** A one-line objective for the HUD. */
  function objectiveText() {
    const mission = currentMission(state.mission.index);
    if (!mission) return state.victory ? 'ALL JOBS COMPLETE - KING OF SOLANA BAY' : '';
    const progress = state.mission.progress;
    if (mission.kind === 'checkpoints') return `Checkpoints ${Math.min(progress.progress, 3)}/3`;
    if (mission.kind === 'handoff') return progress.stage === 0 ? 'Pick up the crate at the harbor' : 'Deliver the crate to the market';
    if (mission.kind === 'takedown') return `Police cruisers destroyed ${Math.min(progress.progress, 3)}/3`;
    if (mission.kind === 'shopping') return `Boutiques ${Math.min(progress.progress, 3)}/3  -  ${Math.ceil(progress.timer)}s left`;
    if (mission.kind === 'race') return `Race gates ${Math.min(progress.progress, 4)}/4  (rival ${Math.min(progress.rivalProgress, 4)}/4)`;
    if (mission.kind === 'final') return progress.stage === 0 ? `Villa guards left ${progress.progress}/5` : 'Reach the escape boat';
    return mission.objective;
  }

  /** Move a body and slide along walls instead of sticking to them. */
  function moveWithWalls(body, dx, dy, radius) {
    const nextX = clamp(body.x + dx, radius, WORLD.width - radius);
    const canX = !isWater(nextX, body.y) && !hitsBuilding(city, nextX, body.y, radius);
    if (canX) body.x = nextX;
    const nextY = clamp(body.y + dy, radius, WORLD.height - radius);
    const canY = !isWater(body.x, nextY) && !hitsBuilding(city, body.x, nextY, radius);
    if (canY) body.y = nextY;
    return canX && canY;
  }

  function updatePlayer(dt, controls) {
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.invuln = Math.max(0, player.invuln - dt);

    if (controls.aim && Number.isFinite(controls.aim.x)) {
      player.aimAngle = Math.atan2(controls.aim.y - player.y, controls.aim.x - player.x);
    }

    if (player.inCar && player.car) {
      const car = player.car;
      const throttle = -controls.axisY;
      const steer = controls.axisX;
      if (controls.handbrake) car.speed *= 0.94;
      if (throttle > 0) car.speed += CAR.accel * dt * (car.maxSpeed > 250 ? 1.2 : 1);
      else if (throttle < 0) car.speed -= (car.speed > 10 ? CAR.brake : CAR.reverse) * dt;
      else car.speed *= 1 - CAR.friction * dt;
      car.speed = clamp(car.speed, -130, car.maxSpeed);
      const steering = CAR.steer * Math.min(1, Math.abs(car.speed) / 85) * (car.speed < 0 ? -1 : 1) * (controls.handbrake ? 1.4 : 1);
      car.angle += steer * steering * dt;
      const beforeX = car.x;
      const beforeY = car.y;
      moveWithWalls(car, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, 30);
      if (Math.abs(beforeX - car.x) + Math.abs(beforeY - car.y) < Math.abs(car.speed * dt) * 0.4) {
        if (Math.abs(car.speed) > 120) {
          effects.burst(car.x, car.y, 7, '#ffd9a0', 130, 4);
          effects.addShake(4);
          car.health -= 5;
          player.health -= 0.8;
        }
        car.speed *= -0.24;
      }
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      state.stats.distance += Math.abs(car.speed) * dt;
      if (Math.abs(car.speed) > 30 && random.chance(dt * 3)) effects.burst(car.x - Math.cos(car.angle) * 32, car.y - Math.sin(car.angle) * 32, 1, '#d8c9a9', 30, 6);
    } else {
      let dx = controls.axisX;
      let dy = controls.axisY;
      const length = Math.hypot(dx, dy);
      if (length > 0) {
        dx /= length;
        dy /= length;
        const speed = controls.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
        moveWithWalls(player, dx * speed * dt, dy * speed * dt, PLAYER.radius);
        player.moveAngle = Math.atan2(dy, dx);
        player.angle = player.moveAngle;
        player.walkPhase += dt * (controls.sprinting ? 15 : 10);
        state.stats.distance += speed * dt;
      }
    }

    if (controls.firing && player.fireCooldown <= 0 && !state.gameOver) {
      const aim = controls.aim ?? { x: player.x + Math.cos(player.aimAngle) * 100, y: player.y + Math.sin(player.aimAngle) * 100 };
      player.fireCooldown = PLAYER.fireDelay;
      return firePlayer(aim.x, aim.y);
    }
    return 0;
  }

  /** Advance a road-going traffic car through the grid and take random turns. */
  function updateTrafficCar(car, dt) {
    car.speed += (car.maxSpeed - car.speed) * dt * 0.7;
    const move = car.speed * dt;
    if (car.axis === 'h') car.x += (car.dir === 0 ? 1 : -1) * move;
    else car.y += (car.dir === 1 ? 1 : -1) * move;

    const passed = car.dir === 0 || car.dir === 1 ? car.next - 1 : car.next + 1;
    const crossed = car.dir === 0 ? car.x >= passed : car.dir === 2 ? car.x <= passed : car.dir === 1 ? car.y >= passed : car.y <= passed;
    if (crossed) {
      const junction = car.next;
      const straight = car.dir;
      const turn = random.chance(0.28) ? (random.chance(0.5) ? (straight + 1) % 4 : (straight + 3) % 4) : straight;
      car.dir = turn;
      car.angle = turn * Math.PI / 2;
      const lane = 34;
      if (car.axis === 'h') {
        if (turn === 1) {
          car.x = junction - lane;
          car.axis = 'v';
          car.next = nextIntersection('v', turn, car.y);
        } else if (turn === 3) {
          car.x = junction + lane;
          car.axis = 'v';
          car.next = nextIntersection('v', turn, car.y);
        } else {
          car.next = nextIntersection('h', turn, car.x);
        }
      } else {
        if (turn === 0) {
          car.y = junction + lane;
          car.axis = 'h';
          car.next = nextIntersection('h', turn, car.x);
        } else if (turn === 2) {
          car.y = junction - lane;
          car.axis = 'h';
          car.next = nextIntersection('h', turn, car.x);
        } else {
          car.next = nextIntersection('v', turn, car.y);
        }
      }
    }
    recycleTrafficCar(car);
  }

  /** Steer a pursuing car toward a point, with a nudge away from buildings. */
  function driveToward(car, targetX, targetY, dt, aggression = 1) {
    let angle = Math.atan2(targetY - car.y, targetX - car.x);
    const aheadX = car.x + Math.cos(car.angle) * 60;
    const aheadY = car.y + Math.sin(car.angle) * 60;
    if (hitsBuilding(city, aheadX, aheadY, 32) || isWater(aheadX, aheadY)) angle += random.chance(0.5) ? 1.1 : -1.1;
    const delta = angleDelta(car.angle, angle);
    car.angle += clamp(delta, -2.6 * dt, 2.6 * dt);
    const distanceToTarget = distance(car.x, car.y, targetX, targetY);
    const desired = distanceToTarget < 120 ? car.maxSpeed * 0.35 : car.maxSpeed;
    car.speed += (desired * aggression - car.speed) * dt * 1.5;
    const beforeX = car.x;
    const beforeY = car.y;
    moveWithWalls(car, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, 29);
    if (Math.abs(beforeX - car.x) + Math.abs(beforeY - car.y) < Math.abs(car.speed * dt) * 0.35) car.speed *= -0.2;
  }

  function updateCars(dt) {
    for (const car of cars) {
      if (car.mode === 'idle' || car.mode === 'wreck' || car.mode === 'player') continue;
      car.siren += dt * 12;
      if (car.mode === 'traffic') {
        updateTrafficCar(car, dt);
      } else if (car.mode === 'police') {
        if (state.wanted === 0) car.retired -= dt;
        if (car.retired <= 0) {
          car.mode = 'leaving';
          continue;
        }
        driveToward(car, player.x, player.y, dt, 1);
        const gap = distance(car.x, car.y, player.x, player.y);
        if (state.wanted >= 2 && gap < POLICE.range && gap > 100 && random.chance(dt * (0.7 + state.wanted * 0.22))) {
          fireEnemy(car.x, car.y, 0.09, 8, 600);
        }
        if (gap < 58 && Math.abs(car.speed) > 90) {
          effects.burst((car.x + player.x) / 2, (car.y + player.y) / 2, 6, '#fff0b0', 150, 4);
          car.speed *= 0.5;
          damagePlayer(7);
        }
      } else if (car.mode === 'rival') {
        const mission = currentMission(state.mission.index);
        if (!mission || mission.kind !== 'race') {
          car.mode = 'traffic';
          placeTrafficCar(car);
          continue;
        }
        const gate = state.mission.progress.rivalProgress < 4 ? LANDMARKS.raceGates[state.mission.progress.rivalProgress] : LANDMARKS.raceGates[0];
        driveToward(car, gate.x, gate.y, dt, 1);
        if (distance(car.x, car.y, gate.x, gate.y) < 90 && state.mission.progress.rivalProgress < 4) {
          state.mission.progress.rivalProgress += 1;
          effects.floatText(car.x, car.y - 40, 'RIVAL GATE', '#ff8f8f', 18);
        }
      } else if (car.mode === 'leaving') {
        driveToward(car, car.x + Math.cos(car.angle) * 400, car.y + Math.sin(car.angle) * 400, dt, 1.2);
        if (distance(car.x, car.y, player.x, player.y) > 1200) car.mode = 'idle';
      }
    }
  }

  function updatePeds(dt) {
    for (const ped of peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) placePed(ped);
        continue;
      }
      ped.timer -= dt;
      if (ped.timer <= 0) {
        ped.angle += random.range(-1.4, 1.4);
        ped.timer = random.range(1.4, 4.5);
      }
      const beforeX = ped.x;
      const beforeY = ped.y;
      moveWithWalls(ped, Math.cos(ped.angle) * ped.speed * dt, Math.sin(ped.angle) * ped.speed * dt, 9);
      if (beforeX === ped.x && beforeY === ped.y) ped.angle += 1.6;
      ped.phase += dt * 8;
      if (distance(ped.x, ped.y, player.x, player.y) < 150) {
        const away = Math.atan2(ped.y - player.y, ped.x - player.x);
        ped.angle += angleDelta(ped.angle, away) * dt * 2;
      }
    }
  }

  function updateOfficers(dt) {
    for (const officer of officers) {
      if (officer.mode === 'idle') continue;
      officer.fireTimer -= dt;
      const gap = distance(officer.x, officer.y, player.x, player.y);
      const engaged = officer.guard ? gap < 620 : (state.wanted > 0 || gap < 400);
      if (!engaged) {
        officer.mode = 'idle';
        continue;
      }
      if (gap > 135) {
        let angle = Math.atan2(player.y - officer.y, player.x - officer.x);
        if (hitsBuilding(city, officer.x + Math.cos(angle) * 35, officer.y + Math.sin(angle) * 35, 10)) angle += 1.3;
        officer.angle += clamp(angleDelta(officer.angle, angle), -3 * dt, 3 * dt);
        moveWithWalls(officer, Math.cos(officer.angle) * officer.speed * dt, Math.sin(officer.angle) * officer.speed * dt, 12);
      } else {
        officer.angle = Math.atan2(player.y - officer.y, player.x - officer.x);
        if (gap < 26 && officer.fireTimer <= 0) {
          officer.fireTimer = 1.2;
          damagePlayer(6);
        }
      }
      if (officer.fireTimer <= 0 && gap < 520) {
        officer.fireTimer = random.range(0.9, 1.8);
        fireEnemy(officer.x, officer.y, officer.guard ? 0.1 : 0.14, officer.guard ? 10 : 8, 540);
      }
    }
  }

  function damageCar(car, amount) {
    if (car.mode === 'wreck') return 0;
    car.health -= amount;
    effects.burst(car.x, car.y, 4, '#ffd27d', 110, 3);
    if (car.health > 0) return 0;
    car.mode = 'wreck';
    car.speed = 0;
    effects.burst(car.x, car.y, 22, '#ff8a4c', 280, 7);
    effects.addShake(10);
    if (car.owner === 'police') {
      state.stats.cruisers += 1;
      effects.floatText(car.x, car.y - 40, 'CRUISER DOWN +$150', '#7de8ff', 17);
      state.money += 150;
      return EVENT_CRASH | EVENT_CASH | addWanted(45, true);
    }
    return EVENT_CRASH | addWanted(20, true);
  }

  function updateBullets(dt) {
    let events = 0;
    for (const bullet of bullets) {
      if (!bullet.active) continue;
      bullet.life -= dt;
      if (bullet.life <= 0) {
        bullet.active = false;
        continue;
      }
      const previousX = bullet.x;
      const previousY = bullet.y;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (isWater(bullet.x, bullet.y) || hitsBuilding(city, bullet.x, bullet.y, 2)) {
        bullet.active = false;
        effects.burst(bullet.x, bullet.y, 3, '#fff2c0', 80, 2);
        continue;
      }
      if (bullet.friendly) {
        let consumed = false;
        for (const car of cars) {
          if (car.mode !== 'police' && car.mode !== 'rival') continue;
          if (distance(bullet.x, bullet.y, car.x, car.y) < 33) {
            events |= damageCar(car, bullet.damage);
            bullet.active = false;
            consumed = true;
            break;
          }
        }
        if (consumed) continue;
        for (const officer of officers) {
          if (officer.mode === 'idle') continue;
          if (distance(bullet.x, bullet.y, officer.x, officer.y) < 17) {
            officer.health -= bullet.damage;
            effects.burst(officer.x, officer.y, 6, '#ffd27d', 130, 3);
            if (officer.health <= 0) {
              officer.mode = 'idle';
              effects.floatText(officer.x, officer.y - 30, 'DOWN', '#ff6b6b', 16);
              if (officer.guard) {
                state.stats.guards += 1;
                state.money += 100;
                events |= EVENT_CASH | addWanted(20, true);
              } else events |= addWanted(35, true);
            }
            bullet.active = false;
            consumed = true;
            break;
          }
        }
        if (consumed) continue;
        for (const ped of peds) {
          if (ped.down > 0) continue;
          if (distance(bullet.x, bullet.y, ped.x, ped.y) < 13) {
            ped.down = 6;
            effects.burst(ped.x, ped.y, 5, '#ff9d9d', 90, 3);
            events |= addWanted(70, true);
            bullet.active = false;
            consumed = true;
            break;
          }
        }
        if (consumed) continue;
      } else {
        const hitRadius = player.inCar ? 36 : 18;
        if (distance(bullet.x, bullet.y, player.x, player.y) < hitRadius) {
          bullet.active = false;
          events |= damagePlayer(bullet.damage);
          if (player.inCar && player.car) {
            player.car.health -= bullet.damage * 0.4;
            if (player.car.health <= 0) {
              effects.burst(player.car.x, player.car.y, 18, '#ff9d5c', 240, 6);
              player.car.mode = 'wreck';
              player.inCar = false;
              player.car = null;
              player.health -= 12;
              toast('WRECKED! On foot now.', 3, '#ff8a8a');
            }
          }
        }
      }
      if (bullet.active && (Math.abs(bullet.x - previousX) + Math.abs(bullet.y - previousY) < 0.1)) bullet.active = false;
    }
    return events;
  }

  /** Handle car-to-car and car-to-pedestrian contact. */
  function updateCollisions(dt) {
    let events = 0;
    const playerCar = player.car;
    if (player.inCar && playerCar) {
      for (const car of cars) {
        if (car === playerCar || car.mode === 'idle' || car.mode === 'wreck') continue;
        if (distance(car.x, car.y, playerCar.x, playerCar.y) < 62) {
          const angle = Math.atan2(car.y - playerCar.y, car.x - playerCar.x);
          playerCar.x -= Math.cos(angle) * 3;
          playerCar.y -= Math.sin(angle) * 3;
          car.x += Math.cos(angle) * 3;
          car.y += Math.sin(angle) * 3;
          if (Math.abs(playerCar.speed) > 130 && random.chance(dt * 12)) {
            effects.burst(playerCar.x, playerCar.y, 5, '#fff0c0', 120, 3);
            events |= EVENT_CRASH;
            playerCar.health -= 3;
          }
        }
      }
      for (const ped of peds) {
        if (ped.down > 0) continue;
        if (distance(ped.x, ped.y, playerCar.x, playerCar.y) < 42 && Math.abs(playerCar.speed) > 55) {
          ped.down = 7;
          effects.burst(ped.x, ped.y, 10, '#ffb0a0', 180, 4);
          events |= addWanted(65, true);
          playerCar.speed *= 0.78;
          toast('Hit a pedestrian - witnesses called the police!', 3, '#ff8a8a');
        }
      }
    }
    return events;
  }

  /** Check the current job's proximity and interaction objectives. */
  function updateMission(dt, interact) {
    const mission = currentMission(state.mission.index);
    if (!mission) return 0;
    const progress = state.mission.progress;
    progress.flash = Math.max(0, progress.flash - dt);
    let events = 0;
    const goals = targets();
    const goal = goals[0];
    const nearGoal = goal ? distance(player.x, player.y, goal.x, goal.y) < MISSION.interactRange : false;

    if (mission.kind === 'checkpoints' && nearGoal && player.inCar) {
      progress.progress += 1;
      progress.flash = 0.8;
      effects.floatText(goal.x, goal.y - 45, `CHECKPOINT ${progress.progress}/3`, '#7de8ff', 20);
      state.money += 75;
      events |= EVENT_CASH;
      if (progress.progress >= 3) events |= completeMission();
    } else if (mission.kind === 'handoff' && interact && nearGoal) {
      if (progress.stage === 0) {
        progress.stage = 1;
        toast('Crate secured. Take it to the market back room.', 4, '#7de8ff');
        effects.floatText(goal.x, goal.y - 45, '+CRATE', '#ffd23f', 22);
      } else {
        events |= completeMission();
      }
    } else if (mission.kind === 'takedown' && state.stats.cruisers - (progress.baseline ?? 0) > progress.progress) {
      progress.progress = Math.min(3, state.stats.cruisers - (progress.baseline ?? 0));
      if (progress.progress >= 3) {
        events |= completeMission();
      } else {
        state.spawnTimer = Math.min(state.spawnTimer, 0.5);
      }
    } else if (mission.kind === 'shopping') {
      progress.timer -= dt;
      if (nearGoal && interact) {
        progress.progress += 1;
        progress.flash = 0.8;
        state.money += 120;
        effects.floatText(goal.x, goal.y - 45, `BOUTIQUE ${progress.progress}/3`, '#ff9ed8', 18);
        events |= EVENT_CASH;
        if (progress.progress >= 3) events |= completeMission();
      } else if (progress.timer <= 0) {
        progress.timer = MISSION.shoppingSeconds;
        progress.progress = 0;
        toast('Time up! Dana says run it again.', 3.5, '#ff8a8a');
        events |= EVENT_FAIL;
      }
    } else if (mission.kind === 'race') {
      if (nearGoal && player.inCar) {
        progress.progress += 1;
        progress.flash = 0.8;
        effects.floatText(goal.x, goal.y - 45, `GATE ${progress.progress}/4`, '#7de8ff', 20);
        if (progress.progress >= 4) events |= completeMission();
      }
      if (progress.rivalProgress >= 4 && progress.progress < 4) {
        progress.rivalProgress = 0;
        progress.progress = 0;
        for (const car of cars) {
          if (car.mode === 'rival') {
            car.x = LANDMARKS.raceGates[0].x + 75;
            car.y = LANDMARKS.raceGates[0].y - 70;
            car.angle = 0;
          }
        }
        toast('Rival won. Reset at the start line - go again!', 4, '#ff8a8a');
        events |= EVENT_FAIL;
      }
    } else if (mission.kind === 'final') {
      if (progress.stage === 0) {
        progress.progress = Math.min(5, state.stats.guards);
        if (progress.progress >= 5) {
          progress.stage = 1;
          toast('Villa clear! Get to the escape boat.', 4.5, '#69df9a');
        }
      } else if (nearGoal && interact) {
        events |= completeMission();
      }
    }
    return events;
  }

  /** Maintain heat, spawn responders and slowly forget old crimes. */
  function updateWanted(dt) {
    let events = 0;
    if (state.wantedTimer > 0) state.wantedTimer -= dt;
    else if (state.wantedPoints > 0) {
      state.wantedPoints = Math.max(0, state.wantedPoints - 16 * dt);
      state.wanted = clamp(Math.ceil(state.wantedPoints / POLICE.wantedPerStar), 0, 5);
    }
    state.spawnTimer -= dt;
    if (state.wanted > 0 && state.spawnTimer <= 0) {
      const cruisers = cars.filter((item) => item.mode === 'police').length;
      const officersActive = officers.filter((item) => item.mode === 'police').length;
      const carLimit = Math.min(POLICE.maxCars, 1 + state.wanted);
      if (cruisers < carLimit) {
        spawnPoliceCar();
        events |= EVENT_SIREN;
      }
      if (state.wanted >= 3 && officersActive < state.wanted) spawnOfficer(false, player.x + random.range(-300, 300), player.y + random.range(-300, 300));
      state.spawnTimer = Math.max(2.2, 6.5 - state.wanted * 0.8);
    }
    return events;
  }

  function updateCamera(dt) {
    const targetX = clamp(player.x, 640, WORLD.width - 640);
    const targetY = clamp(player.y, 360, WORLD.height - 360);
    state.camera.x += (targetX - state.camera.x) * Math.min(1, dt * 6);
    state.camera.y += (targetY - state.camera.y) * Math.min(1, dt * 6);
    state.camera.x = clamp(state.camera.x, 640, WORLD.width - 640);
    state.camera.y = clamp(state.camera.y, 360, WORLD.height - 360);
  }

  /** Reset to a clean run (or a saved point) and repopulate the city. */
  function reset(progress = null) {
    for (const car of cars) car.mode = 'idle';
    for (const ped of peds) ped.mode = undefined;
    for (const officer of officers) officer.mode = 'idle';
    for (const bullet of bullets) bullet.active = false;
    effects.clear();

    player.x = LANDMARKS.start.x;
    player.y = LANDMARKS.start.y;
    player.angle = 0;
    player.aimAngle = 0;
    player.health = PLAYER.maxHealth;
    player.armor = PLAYER.maxArmor;
    player.inCar = false;
    player.car = null;
    player.fireCooldown = 0;
    player.invuln = 0;
    player.walkPhase = 0;

    state.money = progress ? progress.money : 250;
    state.reputation = progress ? progress.reputation : 0;
    state.wanted = 0;
    state.wantedPoints = 0;
    state.wantedTimer = 0;
    state.spawnTimer = 1;
    state.elapsed = 0;
    state.gameOver = false;
    state.victory = false;
    state.briefing = null;
    state.toast = null;
    state.totalEarned = 0;
    state.stats = { cruisers: 0, guards: 0, carsStolen: 0, distance: 0 };
    state.mission = { index: progress ? progress.missionIndex : 0, progress: createMissionProgress() };
    state.camera.x = player.x;
    state.camera.y = player.y;

    const spots = [{ x: 548, y: 740, angle: 0 }, ...city.parkingSpots];
    let index = 0;
    for (const spot of spots) {
      if (index >= 20) break;
      const car = cars[index];
      car.mode = 'parked';
      car.owner = 'world';
      car.x = spot.x;
      car.y = spot.y;
      car.angle = spot.angle;
      car.speed = 0;
      car.health = CAR.maxHealth;
      car.maxSpeed = CAR.trafficSpeed;
      car.color = CAR_COLORS[index % CAR_COLORS.length];
      if (hitsBuilding(city, car.x, car.y, 30) || isWater(car.x, car.y)) car.mode = 'idle';
      index += 1;
    }
    for (let traffic = 0; traffic < 14 && index < cars.length; traffic += 1, index += 1) placeTrafficCar(cars[index]);
    for (const ped of peds) placePed(ped);

    if (state.mission.index > 0 && state.mission.index < MISSIONS.length) startMission(state.mission.index);
    if (progress && progress.completed) {
      state.victory = true;
      state.mission.index = MISSIONS.length;
    }
  }

  /** Advance one fixed step. `controls` is the small snapshot assembled by main.js. */
  function step(dt, controls) {
    let events = 0;
    if (state.gameOver || state.victory) {
      effects.update(dt);
      updateCamera(dt);
      return 0;
    }
    state.elapsed += dt;
    effects.update(dt);
    if (state.toast) {
      state.toast.time -= dt;
      if (state.toast.time <= 0) state.toast = null;
    }
    if (state.briefing) {
      state.briefing.time -= dt;
      if (state.briefing.time <= 0) state.briefing = null;
    }

    const interact = Boolean(controls.actions & 4);
    if (interact) events |= handleVehicleInteraction();
    events |= updatePlayer(dt, controls);
    updateCars(dt);
    updatePeds(dt);
    updateOfficers(dt);
    events |= updateBullets(dt);
    events |= updateCollisions(dt);
    events |= updateMission(dt, interact);
    events |= updateWanted(dt);
    updateCamera(dt);
    if (state.gameOver) events |= EVENT_OVER;
    return events;
  }

  reset();
  return {
    state, reset, step, startMission, addWanted, damagePlayer, toast, showBriefing,
    targets, objectiveText, spawnPoliceCar, spawnOfficer, completeMission, damageCar,
  };
}

const PALETTE_BULLET = '#fff3b0';
