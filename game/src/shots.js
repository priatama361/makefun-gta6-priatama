// The four deterministic scenes requested by the capture script. Each scene uses the real world,
// renderer and mission data; it only arranges the starting state, so every pixel comes from the
// game's own drawing code and the same seed always gives the same frame.
import { LANDMARKS } from './city.js';
import { CAR, PALETTE, PLAYER } from './config.js';
import { SCREEN_PLAY, SCREEN_STORY, SCREEN_TITLE } from './render.js';

/** Create a live bullet without waiting for a shot. */
function placeBullet(state, x, y, angle, friendly, speed = 700) {
  const bullet = state.bullets.find((item) => !item.active);
  if (!bullet) return;
  bullet.active = true;
  bullet.x = x;
  bullet.y = y;
  bullet.vx = Math.cos(angle) * speed;
  bullet.vy = Math.sin(angle) * speed;
  bullet.life = 1.2;
  bullet.friendly = friendly;
  bullet.damage = 8;
  bullet.color = friendly ? PALETTE.bullet : '#ff6b7d';
}

/** Park a few visible cars at chosen positions. */
function arrangeCars(world, placements) {
  const available = world.state.cars.filter((car) => car.mode !== 'idle');
  placements.forEach((placement, index) => {
    const car = available[index];
    if (!car) return;
    car.mode = placement.mode ?? 'parked';
    car.owner = placement.mode === 'police' ? 'police' : 'world';
    car.x = placement.x;
    car.y = placement.y;
    car.angle = placement.angle ?? 0;
    car.speed = placement.speed ?? 0;
    car.maxSpeed = placement.mode === 'police' ? CAR.policeSpeed : CAR.trafficSpeed;
    car.color = placement.color ?? PALETTE.gold;
    car.health = CAR.maxHealth;
    car.siren = index * 1.6;
  });
}

/** Set up all four staged scenes and return the screen to draw over the arranged world. */
export function stageShot(name, world, effects) {
  const state = world.state;
  world.reset();
  state.elapsed = 14;
  state.toast = null;
  state.briefing = null;
  effects.clear();

  if (name === 'cover') {
    const roadX = 2250;
    state.player.x = roadX;
    state.player.y = 1420;
    state.player.angle = Math.PI / 2;
    state.player.aimAngle = Math.PI / 2;
    state.player.health = 88;
    state.player.armor = 54;
    state.camera.x = roadX;
    state.camera.y = 1450;

    world.startMission(0);
    state.mission.progress.progress = 2;
    state.briefing = null;
    state.wanted = 3;
    state.wantedPoints = 300;
    state.wantedTimer = 12;
    state.spawnTimer = 2.5;
    state.money = 1850;
    state.reputation = 45;
    state.stats.carsStolen = 1;

    arrangeCars(world, [
      { x: roadX, y: 1420, angle: Math.PI / 2, mode: 'player', speed: 210, color: '#ffd23f' },
      { x: roadX - 44, y: 1220, angle: 1.38, mode: 'police', color: '#ffffff', speed: 240 },
      { x: roadX + 52, y: 1260, angle: 1.89, mode: 'police', color: '#ffffff', speed: 225 },
      { x: roadX - 60, y: 1320, angle: 1.12, mode: 'police', color: '#ffffff', speed: 205 },
      { x: roadX - 34, y: 1580, angle: Math.PI / 2, mode: 'traffic', speed: 95, color: '#ff5f6d' },
      { x: roadX + 34, y: 1310, angle: -Math.PI / 2, mode: 'traffic', speed: 85, color: '#38b6a8' },
      { x: roadX - 96, y: 1460, angle: 0, color: '#6c8cff' },
    ]);

    const playerCar = state.cars.find((car) => car.mode === 'player');
    if (playerCar) {
      playerCar.owner = 'player';
      playerCar.maxSpeed = CAR.policeSpeed;
      playerCar.siren = 0;
      state.player.car = playerCar;
      state.player.inCar = true;
    }
    for (const car of state.cars) {
      if (car.mode !== 'police') continue;
      car.retired = 12;
      car.siren = car.id % 2 ? 1.3 : 4.1;
    }

    for (const ped of state.peds.slice(0, 12)) {
      ped.x = roadX + (ped.id % 2 ? -82 : 82) + (ped.id % 3) * 6;
      ped.y = 1300 + Math.floor(ped.id / 2) * 52;
      ped.phase = ped.id;
    }

    effects.burst(2238, 1360, 6, '#d8c9a9', 120, 5);
    effects.update(0.05);
    return { screen: SCREEN_PLAY, time: 1.2 };
  }

  if (name === 'onfoot') {
    state.player.x = 1250;
    state.player.y = 740;
    state.player.aimAngle = 0.2;
    state.camera.x = 1250;
    state.camera.y = 720;
    world.startMission(0);
    state.briefing = null;
    state.money = 1180;
    state.reputation = 32;
    arrangeCars(world, [
      { x: 1360, y: 820, angle: 0, color: '#ff6b6b' },
      { x: 1170, y: 700, angle: Math.PI, mode: 'traffic', speed: 90, color: '#38b6a8' },
      { x: 1330, y: 640, angle: 0.4, mode: 'traffic', speed: 70, color: '#f4f0e2' },
    ]);
    for (const ped of state.peds.slice(0, 9)) {
      ped.x = 1180 + (ped.id % 5) * 82;
      ped.y = 700 + Math.floor(ped.id / 5) * 130;
    }
    return { screen: SCREEN_PLAY, time: 8 };
  }

  if (name === 'combat') {
    state.player.x = 1760;
    state.player.y = 1150;
    state.player.health = 62;
    state.player.armor = 28;
    state.player.aimAngle = -0.4;
    state.wanted = 4;
    state.wantedPoints = 370;
    state.wantedTimer = 9;
    state.camera.x = 1780;
    state.camera.y = 1120;
    world.startMission(2);
    state.briefing = null;
    state.stats.cruisers = 1;
    state.mission.progress.progress = 1;
    state.money = 2640;
    state.reputation = 82;
    arrangeCars(world, [
      { x: 1660, y: 1050, angle: 0.72, mode: 'police', color: '#ffffff', speed: 190 },
      { x: 1900, y: 1080, angle: 2.5, mode: 'police', color: '#ffffff', speed: 160 },
      { x: 1850, y: 1300, angle: -2.1, mode: 'police', color: '#ffffff', speed: 150 },
      { x: 1620, y: 1250, angle: 0, color: '#ffd23f' },
    ]);
    for (let index = 0; index < 3; index += 1) {
      const officer = world.spawnOfficer(false, 1700 + index * 85, 1260 - index * 35);
      if (officer) officer.angle = -1.2;
    }
    placeBullet(state, 1750, 1120, -0.5, true, 950);
    placeBullet(state, 1805, 1100, 2.7, false, 650);
    placeBullet(state, 1690, 1200, -0.9, false, 600);
    effects.burst(1775, 1120, 12, PALETTE.bullet, 180, 4);
    effects.burst(1670, 1060, 10, '#ff8a4c', 150, 5);
    effects.floatText(1660, 1020, 'CRUISER DOWN', PALETTE.cyan, 18);
    effects.addShake(5);
    effects.update(0.05);
    return { screen: SCREEN_PLAY, time: 9 };
  }

  if (name === 'story') {
    state.player.x = LANDMARKS.handoffPickup.x - 90;
    state.player.y = 1630;
    state.player.aimAngle = 0;
    state.camera.x = 2600;
    state.camera.y = 1600;
    world.startMission(1);
    state.money = 1180;
    state.reputation = 32;
    state.wanted = 1;
    state.wantedPoints = 60;
    arrangeCars(world, [
      { x: 2560, y: 1580, angle: 0.1, color: '#ffd23f' },
      { x: 2480, y: 1680, angle: Math.PI, mode: 'traffic', speed: 60, color: '#6c8cff' },
    ]);
    for (const ped of state.peds.slice(0, 5)) {
      ped.x = 2540 + ped.id * 36;
      ped.y = 1690;
    }
    return { screen: SCREEN_STORY, time: 5 };
  }

  world.reset();
  return { screen: SCREEN_TITLE, time: 0 };
}
