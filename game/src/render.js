import { CAR, COMBAT, FIELD, FONT, PALETTE, WORLD } from './config.js';
import { clampValue } from './random.js';
import { CONTACTS, MISSIONS, nextRankReputation, rankForReputation, rankName } from './story.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_BRIEF = 'brief';
export const SCREEN_INTERMISSION = 'intermission';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const MINIMAP = { x: FIELD.width - 210, y: 20, w: 190, h: 150, range: 1050 };

export function createRenderer(canvas, city) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, dpr: 1 };
  const camera = { x: 620, y: 400, ready: false };
  const fonts = new Map();

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(window.innerWidth * dpr));
    const height = Math.max(1, Math.round(window.innerHeight * dpr));
    canvas.width = width;
    canvas.height = height;
    view.dpr = dpr;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function font(size, weight = '600') {
    const key = `${weight} ${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align = 'left', weight = '600') {
    context.font = font(size, weight);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'middle';
    context.fillText(value, x, y);
  }

  function panel(x, y, w, h, alpha = 0.92) {
    context.fillStyle = `rgba(14, 30, 40, ${alpha})`;
    context.fillRect(x, y, w, h);
    context.strokeStyle = 'rgba(255, 212, 94, 0.55)';
    context.lineWidth = 2;
    context.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  function bar(x, y, w, h, ratio, color, label) {
    context.fillStyle = 'rgba(0, 0, 0, 0.42)';
    context.fillRect(x, y, w, h);
    context.fillStyle = color;
    context.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * clampValue(ratio, 0, 1)), h - 4);
    text(label, x + 6, y + h / 2 + 1, 12, PALETTE.text, 'left', '700');
  }

  function star(x, y, radius, filled) {
    context.beginPath();
    for (let point = 0; point < 10; point += 1) {
      const angle = -Math.PI / 2 + point * Math.PI / 5;
      const distance = point % 2 === 0 ? radius : radius * 0.44;
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance;
      if (point === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fillStyle = filled ? PALETTE.gold : 'rgba(10, 24, 30, 0.55)';
    context.fill();
    context.strokeStyle = filled ? '#fff3c4' : 'rgba(255,255,255,0.45)';
    context.lineWidth = 1.5;
    context.stroke();
  }

  function visibleBounds() {
    return {
      left: camera.x - FIELD.width / 2 - 80,
      right: camera.x + FIELD.width / 2 + 80,
      top: camera.y - FIELD.height / 2 - 80,
      bottom: camera.y + FIELD.height / 2 + 80,
    };
  }

  function drawTerrain(state) {
    const bounds = visibleBounds();
    context.fillStyle = PALETTE.ground;
    context.fillRect(Math.max(0, bounds.left), Math.max(0, bounds.top), Math.min(WORLD.width, bounds.right) - Math.max(0, bounds.left), Math.min(WORLD.height, bounds.bottom) - Math.max(0, bounds.top));

    context.fillStyle = PALETTE.sand;
    context.fillRect(Math.max(0, bounds.left), Math.max(0, bounds.top), Math.max(0, WORLD.coast - bounds.left), Math.min(WORLD.height, bounds.bottom) - Math.max(0, bounds.top));
    context.fillStyle = PALETTE.sandDark;
    context.fillRect(Math.max(WORLD.coast, bounds.left), Math.max(0, bounds.top), Math.max(0, WORLD.beach - Math.max(WORLD.coast, bounds.left)), Math.min(WORLD.height, bounds.bottom) - Math.max(0, bounds.top));

    context.fillStyle = PALETTE.ocean;
    context.fillRect(Math.max(0, bounds.left), Math.max(0, bounds.top), Math.max(0, Math.min(bounds.right, WORLD.coast) - bounds.left), Math.min(WORLD.height, bounds.bottom) - Math.max(0, bounds.top));
    context.strokeStyle = PALETTE.foam;
    context.lineWidth = 3;
    const waveStart = Math.floor(Math.max(0, bounds.top) / 70) * 70;
    for (let y = waveStart; y < Math.min(bounds.bottom, WORLD.height); y += 70) {
      const shift = Math.sin(state.time * 1.4 + y * 0.01) * 14;
      context.beginPath();
      context.moveTo(Math.max(0, bounds.left), y);
      for (let x = Math.max(0, bounds.left); x < Math.min(bounds.right, WORLD.coast - 4); x += 34) {
        context.lineTo(x, y + Math.sin(x * 0.04 + state.time * 2) * 4 + shift * 0.2);
      }
      context.stroke();
    }

    const firstColumn = Math.max(0, Math.floor(bounds.left / WORLD.pitch));
    const lastColumn = Math.min(city.columns, Math.ceil(bounds.right / WORLD.pitch));
    const firstRow = Math.max(0, Math.floor(bounds.top / WORLD.pitch));
    const lastRow = Math.min(city.rows, Math.ceil(bounds.bottom / WORLD.pitch));
    context.fillStyle = PALETTE.road;
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      context.fillRect(column * WORLD.pitch, Math.max(0, bounds.top), WORLD.road, Math.min(bounds.bottom, WORLD.height) - Math.max(0, bounds.top));
    }
    for (let row = firstRow; row <= lastRow; row += 1) {
      context.fillRect(Math.max(WORLD.coast, bounds.left), row * WORLD.pitch, Math.min(bounds.right, WORLD.width) - Math.max(WORLD.coast, bounds.left), WORLD.road);
    }
    context.strokeStyle = PALETTE.roadLine;
    context.lineWidth = 2;
    context.setLineDash([16, 20]);
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      context.beginPath();
      context.moveTo(column * WORLD.pitch + WORLD.road / 2, Math.max(0, bounds.top));
      context.lineTo(column * WORLD.pitch + WORLD.road / 2, Math.min(bounds.bottom, WORLD.height));
      context.stroke();
    }
    for (let row = firstRow; row <= lastRow; row += 1) {
      context.beginPath();
      context.moveTo(Math.max(WORLD.coast, bounds.left), row * WORLD.pitch + WORLD.road / 2);
      context.lineTo(Math.min(bounds.right, WORLD.width), row * WORLD.pitch + WORLD.road / 2);
      context.stroke();
    }
    context.setLineDash([]);
  }

  function drawBuildings() {
    const bounds = visibleBounds();
    for (const building of city.buildings) {
      if (building.x + building.w < bounds.left || building.x > bounds.right || building.y + building.h < bounds.top || building.y > bounds.bottom) continue;
      context.fillStyle = PALETTE.shadow;
      context.fillRect(building.x + 8, building.y + 9, building.w, building.h);
      context.fillStyle = building.color;
      context.fillRect(building.x, building.y, building.w, building.h);
      context.fillStyle = building.roof;
      context.fillRect(building.x + 7, building.y + 7, building.w - 14, building.h - 14);
      const rows = Math.max(1, Math.floor(building.h / 48));
      const columns = Math.max(1, Math.floor(building.w / 46));
      context.fillStyle = PALETTE.window;
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          if ((row + column) % 3 === 0) continue;
          context.fillRect(building.x + 14 + column * 44, building.y + 14 + row * 44, 20, 18);
        }
      }
      if (building.shop !== null) {
        const landmark = city.findLandmark(building.shop);
        context.fillStyle = PALETTE.awning;
        context.fillRect(building.x - 4, building.y + building.h - 26, building.w + 8, 24);
        for (let stripe = 0; stripe < building.w + 8; stripe += 24) {
          context.fillStyle = stripe % 48 === 0 ? '#fff4d6' : PALETTE.awning;
          context.fillRect(building.x - 4 + stripe, building.y + building.h - 26, 12, 24);
        }
        text(landmark.label, building.x + building.w / 2, building.y + building.h - 13, 11, '#fffdf0', 'center', '800');
      }
    }
  }

  function drawPalms() {
    const bounds = visibleBounds();
    for (const palm of city.palms) {
      if (palm.x < bounds.left || palm.x > bounds.right || palm.y < bounds.top || palm.y > bounds.bottom) continue;
      const size = 20 * palm.scale;
      context.fillStyle = PALETTE.shadow;
      context.beginPath();
      context.ellipse(palm.x + 8, palm.y + 10, size * 0.8, size * 0.34, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.palmTrunk;
      context.lineWidth = 5 * palm.scale;
      context.beginPath();
      context.moveTo(palm.x, palm.y + size * 0.4);
      context.lineTo(palm.x + 3 * palm.scale, palm.y - size * 0.6);
      context.stroke();
      for (let leaf = 0; leaf < 6; leaf += 1) {
        const angle = leaf * Math.PI / 3;
        context.strokeStyle = leaf % 2 === 0 ? PALETTE.palmLeaf : PALETTE.palmLeafLight;
        context.lineWidth = 4 * palm.scale;
        context.beginPath();
        context.moveTo(palm.x + 3 * palm.scale, palm.y - size * 0.6);
        context.quadraticCurveTo(palm.x + Math.cos(angle) * size, palm.y - size * 0.6 + Math.sin(angle) * size * 0.7, palm.x + Math.cos(angle) * size * 1.35, palm.y - size * 0.35 + Math.sin(angle) * size);
        context.stroke();
      }
    }
  }

  function drawCar(car, isPlayer) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    const color = typeof car.color === 'number' ? PALETTE.carColors[car.color % PALETTE.carColors.length] : car.color;
    context.fillStyle = PALETTE.shadow;
    context.fillRect(-CAR.length / 2 + 5, -CAR.width / 2 + 6, CAR.length, CAR.width);
    context.fillStyle = car.kind === 'police' ? PALETTE.police : color;
    context.fillRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width);
    context.fillStyle = 'rgba(255,255,255,0.22)';
    context.fillRect(-CAR.length / 2 + 14, -CAR.width / 2 + 4, 22, CAR.width - 8);
    context.fillStyle = '#24313c';
    context.fillRect(-CAR.length / 2 + 8, -CAR.width / 2 + 3, 16, CAR.width - 6);
    context.fillStyle = '#f7e7a8';
    context.fillRect(CAR.length / 2 - 4, -CAR.width / 2 + 3, 4, 6);
    context.fillRect(CAR.length / 2 - 4, CAR.width / 2 - 9, 4, 6);
    if (car.kind === 'police') {
      context.fillStyle = Math.sin(car.siren) > 0 ? '#ff3b3b' : '#3b6bff';
      context.fillRect(-3, -CAR.width / 2 - 3, 11, 6);
      context.fillStyle = Math.sin(car.siren) > 0 ? '#3b6bff' : '#ff3b3b';
      context.fillRect(-3, CAR.width / 2 - 3, 11, 6);
      context.fillStyle = '#f4f6ff';
      context.fillRect(-CAR.length / 2 + 4, -2, CAR.length - 8, 4);
    }
    if (car.kind === 'rival') {
      context.fillStyle = '#ffd45e';
      context.fillRect(-CAR.length / 2 + 2, -3, CAR.length - 4, 6);
    }
    if (isPlayer) {
      context.strokeStyle = '#fff8e7';
      context.lineWidth = 2;
      context.strokeRect(-CAR.length / 2 - 2, -CAR.width / 2 - 2, CAR.length + 4, CAR.width + 4);
    }
    context.restore();
  }

  function drawPerson(x, y, angle, color, isPlayer, phase = 0, weapon = false) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = PALETTE.shadow;
    context.beginPath();
    context.ellipse(4, 6, 12, 6, 0, 0, Math.PI * 2);
    context.fill();
    const wobble = isPlayer ? Math.sin(phase) * 2 : 0;
    context.strokeStyle = '#2d3540';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(-6, -5 + wobble);
    context.lineTo(6, 5 - wobble);
    context.moveTo(-6, 5 + wobble);
    context.lineTo(6, -5 - wobble);
    context.stroke();
    context.fillStyle = color;
    context.beginPath();
    context.arc(0, 0, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f6d3ae';
    context.beginPath();
    context.arc(3, 0, 6, 0, Math.PI * 2);
    context.fill();
    if (weapon) {
      context.strokeStyle = '#26323a';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(7, 0);
      context.lineTo(21, 0);
      context.stroke();
    }
    context.restore();
  }

  function drawMarker(point, label, color, time, scale = 1) {
    const pulse = 1 + Math.sin(time * 4) * 0.12;
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(point.x, point.y, 30 * pulse * scale, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(point.x, point.y, 46 * pulse * scale, 0, Math.PI * 2);
    context.globalAlpha = 0.4;
    context.stroke();
    context.globalAlpha = 1;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(point.x, point.y - 14);
    context.lineTo(point.x + 12, point.y);
    context.lineTo(point.x, point.y + 14);
    context.lineTo(point.x - 12, point.y);
    context.closePath();
    context.fill();
    context.font = font(14, '800');
    const width = context.measureText(label).width + 18;
    context.fillStyle = 'rgba(14, 30, 40, 0.85)';
    context.fillRect(point.x - width / 2, point.y - 66, width, 24);
    text(label, point.x, point.y - 54, 13, PALETTE.text, 'center', '800');
  }

  function drawWorld(state, world) {
    drawTerrain(state);
    drawBuildings();
    drawPalms();

    const objective = world.currentObjective();
    if (state.phase === 'play' && objective !== null && objective.type === 'goto') {
      drawMarker(city.findLandmark(objective.place), city.findLandmark(objective.place).label, PALETTE.gold, state.time);
    }
    if (state.phase === 'brief' || state.phase === 'play') {
      const contactName = state.mission === null ? 'Tito' : state.mission.contact;
      const contact = city.findLandmark(contactName === 'Dana' ? 'dana' : 'tito');
      drawMarker(contact, CONTACTS[contactName].name, CONTACTS[contactName].color, state.time + 1.2, 0.8);
    }

    for (const pickup of state.pickups) {
      context.save();
      context.translate(pickup.x, pickup.y);
      context.rotate(state.time * 2);
      context.fillStyle = pickup.kind === 'cash' ? '#4ddb8d' : pickup.kind === 'health' ? '#ff6b5e' : '#5bb8ff';
      context.fillRect(-9, -9, 18, 18);
      context.fillStyle = PALETTE.text;
      context.fillRect(-5, -2, 10, 4);
      context.restore();
    }

    const bounds = visibleBounds();
    for (const car of state.cars) {
      if (!car.alive || car.x < bounds.left - 50 || car.x > bounds.right + 50 || car.y < bounds.top - 50 || car.y > bounds.bottom + 50) continue;
      drawCar(car, car === state.player.car);
    }
    for (const pedestrian of state.pedestrians) {
      if (pedestrian.x < bounds.left || pedestrian.x > bounds.right || pedestrian.y < bounds.top || pedestrian.y > bounds.bottom) continue;
      drawPerson(pedestrian.x, pedestrian.y, pedestrian.angle, pedestrian.color, false, pedestrian.phase);
    }
    for (const cop of state.cops) {
      if (!cop.alive) continue;
      const color = cop.kind === 'guard' ? '#9b3b52' : '#234a8f';
      drawPerson(cop.x, cop.y, cop.angle, color, false, 0, true);
      context.fillStyle = cop.kind === 'guard' ? '#ff6b5e' : '#ffd45e';
      context.fillRect(cop.x - 4, cop.y - 21, 8, 5);
    }
    if (state.player.car === null && state.phase !== 'dead') {
      drawPerson(state.player.x, state.player.y, state.player.aim, '#f45b4d', true, state.player.walkPhase, true);
    }
    for (const bullet of state.bullets) {
      context.strokeStyle = bullet.owner === 'player' ? '#fff3a8' : '#ffb0a0';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(bullet.x, bullet.y);
      context.lineTo(bullet.x - bullet.vx * 0.014, bullet.y - bullet.vy * 0.014);
      context.stroke();
    }
    state.fx.draw(context);

    for (const message of state.fx.messages) {
      context.font = font(18, '800');
      context.fillStyle = 'rgba(8, 20, 26, 0.7)';
      const width = context.measureText(message.label).width + 14;
      context.fillRect(message.x - width / 2, message.y - 13, width, 26);
      text(message.label, message.x, message.y, 16, message.color, 'center', '800');
    }
  }

  function drawMinimap(state, world) {
    panel(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h, 0.86);
    const scale = MINIMAP.w / MINIMAP.range;
    const centerX = state.player.x;
    const centerY = state.player.y;
    const toMapX = (x) => MINIMAP.x + MINIMAP.w / 2 + (x - centerX) * scale;
    const toMapY = (y) => MINIMAP.y + MINIMAP.h / 2 + (y - centerY) * scale;
    context.save();
    context.beginPath();
    context.rect(MINIMAP.x + 2, MINIMAP.y + 2, MINIMAP.w - 4, MINIMAP.h - 4);
    context.clip();
    context.fillStyle = '#d8c597';
    context.fillRect(MINIMAP.x, MINIMAP.y, MINIMAP.w, MINIMAP.h);
    const firstColumn = Math.max(0, Math.floor((centerX - MINIMAP.range / 2) / WORLD.pitch));
    const lastColumn = Math.min(city.columns, Math.ceil((centerX + MINIMAP.range / 2) / WORLD.pitch));
    const firstRow = Math.max(0, Math.floor((centerY - MINIMAP.range / 2) / WORLD.pitch));
    const lastRow = Math.min(city.rows, Math.ceil((centerY + MINIMAP.range / 2) / WORLD.pitch));
    context.fillStyle = PALETTE.road;
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      context.fillRect(toMapX(column * WORLD.pitch), MINIMAP.y, WORLD.road * scale, MINIMAP.h);
    }
    for (let row = firstRow; row <= lastRow; row += 1) {
      context.fillRect(MINIMAP.x, toMapY(row * WORLD.pitch), MINIMAP.w, WORLD.road * scale);
    }
    context.fillStyle = PALETTE.ocean;
    context.fillRect(MINIMAP.x, MINIMAP.y, Math.max(0, toMapX(WORLD.coast) - MINIMAP.x), MINIMAP.h);
    for (const building of city.nearbyBuildings(centerX, centerY)) {
      context.fillStyle = '#a9815e';
      context.fillRect(toMapX(building.x), toMapY(building.y), Math.max(2, building.w * scale), Math.max(2, building.h * scale));
    }
    const objective = world.currentObjective();
    if (objective !== null && objective.type === 'goto') {
      const target = city.findLandmark(objective.place);
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(toMapX(target.x), toMapY(target.y), 6, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (car.kind !== 'police' || !car.alive) continue;
      context.fillStyle = '#ff4d4d';
      context.fillRect(toMapX(car.x) - 2, toMapY(car.y) - 2, 5, 5);
    }
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(MINIMAP.x + MINIMAP.w / 2, MINIMAP.y + MINIMAP.h / 2, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(MINIMAP.x + MINIMAP.w / 2, MINIMAP.y + MINIMAP.h / 2);
    context.lineTo(MINIMAP.x + MINIMAP.w / 2 + Math.cos(state.player.angle) * 14, MINIMAP.y + MINIMAP.h / 2 + Math.sin(state.player.angle) * 14);
    context.stroke();
    context.restore();
    text('SOLANA BAY', MINIMAP.x + 8, MINIMAP.y + MINIMAP.h - 12, 11, PALETTE.text, 'left', '800');
  }

  function drawHud(state, world) {
    panel(18, 18, 330, 116);
    text('SOLANA BAY', 32, 38, 15, PALETTE.gold, 'left', '800');
    bar(32, 54, 180, 17, state.player.health / 100, PALETTE.health, `HP ${Math.ceil(state.player.health)}`);
    bar(32, 76, 180, 17, state.player.armor / 100, PALETTE.armor, `ARMOR ${Math.ceil(state.player.armor)}`);
    text(`$${state.money.toLocaleString('en-US')}`, 230, 63, 22, PALETTE.text, 'left', '800');
    const rank = rankForReputation(state.reputation);
    text(rankName(rank), 230, 88, 12, PALETTE.gold, 'left', '800');
    const next = nextRankReputation(state.reputation);
    if (next !== null) text(`NEXT ${next} REP`, 230, 108, 11, PALETTE.muted, 'left', '600');
    else text('MAX RANK', 230, 108, 11, PALETTE.gold, 'left', '800');

    if (state.wanted > 0) {
      const stars = Math.ceil(state.wanted);
      const totalWidth = 5 * 34;
      const startX = FIELD.width / 2 - totalWidth / 2 + 17;
      text('WANTED', FIELD.width / 2, 28, 13, PALETTE.gold, 'center', '800');
      for (let index = 0; index < 5; index += 1) star(startX + index * 34, 56, 12, index < stars);
    }

    drawMinimap(state, world);

    panel(18, FIELD.height - 96, 560, 78);
    text('CURRENT JOB', 34, FIELD.height - 76, 12, PALETTE.gold, 'left', '800');
    text(state.mission === null ? 'FREE ROAM' : state.mission.title, 34, FIELD.height - 53, 21, PALETTE.text, 'left', '800');
    text(world.objectiveText(), 34, FIELD.height - 27, 15, PALETTE.muted, 'left', '600');

    panel(FIELD.width - 246, FIELD.height - 96, 228, 78);
    if (state.player.car !== null) {
      const speed = Math.round(Math.abs(state.player.car.speed) * 0.45);
      text(String(speed), FIELD.width - 224, FIELD.height - 62, 38, PALETTE.text, 'left', '800');
      text('MPH', FIELD.width - 158, FIELD.height - 53, 16, PALETTE.gold, 'left', '800');
      text(state.player.car.speed < -5 ? 'REVERSE' : 'DRIVING', FIELD.width - 224, FIELD.height - 28, 13, PALETTE.muted, 'left', '600');
    } else {
      text('AMMO', FIELD.width - 224, FIELD.height - 68, 13, PALETTE.gold, 'left', '800');
      text(`${state.player.ammo} / ${COMBAT.magazine}`, FIELD.width - 224, FIELD.height - 40, 28, PALETTE.text, 'left', '800');
      text(state.player.reloadTimer > 0 ? 'RELOADING' : 'PISTOL', FIELD.width - 224, FIELD.height - 22, 12, PALETTE.muted, 'left', '600');
    }
    text('E car  •  P pause  •  M map', FIELD.width / 2, FIELD.height - 12, 12, 'rgba(255,248,231,0.75)', 'center', '600');
  }

  function overlayPanel(width, height) {
    context.fillStyle = 'rgba(7, 20, 27, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    panel(x, y, width, height, 0.97);
    return { x, y };
  }

  function drawTitle(state) {
    const box = overlayPanel(760, 520);
    const glow = context.createLinearGradient(0, box.y, 0, box.y + 150);
    glow.addColorStop(0, '#ffd45e');
    glow.addColorStop(1, '#ff8f5e');
    context.fillStyle = glow;
    context.font = font(74, '800');
    context.textAlign = 'center';
    context.fillText('SOLANA BAY', FIELD.width / 2, box.y + 112);
    text('MARA "SUNNY" VEGA  •  GETAWAY DRIVER', FIELD.width / 2, box.y + 158, 19, PALETTE.text, 'center', '800');
    const lines = [
      'Six jobs. Two contacts. One sun-soaked city that never slows down.',
      'WASD / arrows to move and drive   •   mouse to aim   •   click or Space to fire',
      'E to enter or leave cars   •   Shift to sprint   •   P to pause',
      'Money, reputation and ranks save automatically in this browser.',
    ];
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, box.y + 215 + index * 34, 16, PALETTE.muted, 'center', '600');
    }
    const pulse = 0.65 + Math.sin(state.time * 3) * 0.35;
    context.globalAlpha = pulse;
    text('PRESS ENTER OR CLICK TO START', FIELD.width / 2, box.y + 430, 24, PALETTE.gold, 'center', '800');
    context.globalAlpha = 1;
    text(`SAVED: ${state.money.toLocaleString('en-US')}  •  ${rankName(rankForReputation(state.reputation))}`, FIELD.width / 2, box.y + 475, 14, PALETTE.text, 'center', '600');
  }

  function drawBrief(state) {
    const mission = state.mission ?? MISSIONS[0];
    const contact = CONTACTS[mission.contact];
    const box = overlayPanel(720, 430);
    text(`BRIEFING FROM ${contact.name}`, FIELD.width / 2, box.y + 54, 16, contact.color, 'center', '800');
    text(mission.title, FIELD.width / 2, box.y + 104, 42, PALETTE.text, 'center', '800');
    for (let index = 0; index < mission.brief.length; index += 1) {
      text(mission.brief[index], FIELD.width / 2, box.y + 158 + index * 32, 17, PALETTE.muted, 'center', '600');
    }
    text(`REWARD  $${mission.reward.money.toLocaleString('en-US')}   •   +${mission.reward.reputation} REP`, FIELD.width / 2, box.y + 310, 19, PALETTE.gold, 'center', '800');
    text('PRESS ENTER TO ACCEPT THE JOB', FIELD.width / 2, box.y + 370, 20, PALETTE.text, 'center', '800');
  }

  function drawIntermission(state) {
    const mission = state.mission ?? MISSIONS[0];
    const box = overlayPanel(640, 340);
    text('JOB COMPLETE', FIELD.width / 2, box.y + 64, 40, PALETTE.gold, 'center', '800');
    text(mission.title, FIELD.width / 2, box.y + 116, 22, PALETTE.text, 'center', '800');
    text(mission.success, FIELD.width / 2, box.y + 162, 16, PALETTE.muted, 'center', '600');
    text(`PAID  $${mission.reward.money.toLocaleString('en-US')}   •   +${mission.reward.reputation} REP`, FIELD.width / 2, box.y + 214, 20, PALETTE.health, 'center', '800');
    text('PRESS ENTER FOR THE NEXT JOB', FIELD.width / 2, box.y + 282, 18, PALETTE.text, 'center', '800');
  }

  function drawPaused() {
    const box = overlayPanel(540, 260);
    text('PAUSED', FIELD.width / 2, box.y + 74, 44, PALETTE.gold, 'center', '800');
    text('The bay can wait.', FIELD.width / 2, box.y + 128, 18, PALETTE.muted, 'center', '600');
    text('PRESS P OR ESC TO RESUME', FIELD.width / 2, box.y + 194, 18, PALETTE.text, 'center', '800');
  }

  function drawOver(state) {
    const box = overlayPanel(600, 300);
    text('BUSTED', FIELD.width / 2, box.y + 72, 46, PALETTE.danger, 'center', '800');
    text('Sunny is out of the game for now.', FIELD.width / 2, box.y + 126, 18, PALETTE.muted, 'center', '600');
    text(`CASH $${state.money.toLocaleString('en-US')}  •  REP ${state.reputation}`, FIELD.width / 2, box.y + 174, 18, PALETTE.gold, 'center', '800');
    text('PRESS R OR ENTER TO RESPAWN', FIELD.width / 2, box.y + 240, 19, PALETTE.text, 'center', '800');
  }

  function drawWin(state) {
    const box = overlayPanel(680, 360);
    text('KING OF SOLANA BAY', FIELD.width / 2, box.y + 80, 42, PALETTE.gold, 'center', '800');
    text('All six jobs are in the books. The Sun Coast belongs to Sunny.', FIELD.width / 2, box.y + 140, 18, PALETTE.text, 'center', '700');
    text(`FINAL CASH $${state.money.toLocaleString('en-US')}  •  REPUTATION ${state.reputation}`, FIELD.width / 2, box.y + 196, 20, PALETTE.health, 'center', '800');
    text('PRESS ENTER FOR A NEW RUN', FIELD.width / 2, box.y + 278, 18, PALETTE.muted, 'center', '800');
  }

  function draw(state, screen, world) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#10202a';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    if (!camera.ready) {
      camera.x = state.player.x;
      camera.y = state.player.y;
      camera.ready = true;
    }
    camera.x += (state.player.x - camera.x) * 0.1;
    camera.y += (state.player.y - camera.y) * 0.1;
    camera.x = clampValue(camera.x, FIELD.width / 2, WORLD.width - FIELD.width / 2);
    camera.y = clampValue(camera.y, FIELD.height / 2, WORLD.height - FIELD.height / 2);

    const shake = state.fx.state.shake;
    const shakeX = shake > 0 ? Math.sin(state.time * 91) * shake : 0;
    const shakeY = shake > 0 ? Math.cos(state.time * 77) * shake : 0;
    context.save();
    context.translate(FIELD.width / 2 - camera.x + shakeX, FIELD.height / 2 - camera.y + shakeY);
    drawWorld(state, world);
    context.restore();

    if (state.fx.state.flash > 0) {
      context.globalAlpha = state.fx.state.flash;
      context.fillStyle = state.fx.state.flashColor;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      context.globalAlpha = 1;
    }

    if (screen !== SCREEN_TITLE) drawHud(state, world);
    if (screen === SCREEN_TITLE) drawTitle(state);
    else if (screen === SCREEN_BRIEF) drawBrief(state);
    else if (screen === SCREEN_INTERMISSION) drawIntermission(state);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state);
    else if (screen === SCREEN_WIN) drawWin(state);
  }

  function aimWorld(pointer) {
    const deviceX = pointer.x * view.dpr;
    const deviceY = pointer.y * view.dpr;
    const logicalX = (deviceX - view.x) / view.scale;
    const logicalY = (deviceY - view.y) / view.scale;
    return {
      x: camera.x + logicalX - FIELD.width / 2,
      y: camera.y + logicalY - FIELD.height / 2,
    };
  }

  function resetCamera() {
    camera.ready = false;
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, aimWorld, resize, resetCamera, camera };
}
