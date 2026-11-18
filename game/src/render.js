// All drawing for SOLANA BAY: a warm daylight city, the sea, palms, cars, people, the HUD and the
// title / briefing / pause / end cards. The 1280x720 logical frame is scaled and letterboxed into
// whatever canvas the browser gives us.
import { CAR, FIELD, FONT, PALETTE, PLAYER, WORLD } from './config.js';
import { clamp, distance } from './random.js';
import { MISSIONS, RANKS, formatTime, rankFor, rankFraction } from './story.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_STORY = 'story';
export const SCREEN_VICTORY = 'victory';

const FONT_CACHE = new Map();

/** Canvas text helper using a small font cache. */
function label(ctx, value, x, y, size, color = PALETTE.text, weight = 600, align = 'left') {
  const key = `${weight} ${size}`;
  if (!FONT_CACHE.has(key)) FONT_CACHE.set(key, `${weight} ${size}px ${FONT}`);
  ctx.font = FONT_CACHE.get(key);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

/** Fill a rounded rectangle path. */
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Word-wrap text and return the lines. */
function wrap(ctx, text, maxWidth, size, weight = 500) {
  const key = `${weight} ${size}`;
  if (!FONT_CACHE.has(key)) FONT_CACHE.set(key, `${weight} ${size}px ${FONT}`);
  ctx.font = FONT_CACHE.get(key);
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Create the renderer and its resize / pointer mapping behaviour. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, dpr: 1 };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    view.dpr = dpr;
    const width = Math.max(1, Math.round(window.innerWidth * dpr));
    const height = Math.max(1, Math.round(window.innerHeight * dpr));
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Convert a browser pointer location into the fixed logical frame. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * view.dpr - view.x) / view.scale,
      y: ((clientY - rect.top) * view.dpr - view.y) / view.scale,
    };
  }

  function visibleBounds(camera) {
    return {
      left: camera.x - FIELD.width / 2 - 80,
      right: camera.x + FIELD.width / 2 + 80,
      top: camera.y - FIELD.height / 2 - 80,
      bottom: camera.y + FIELD.height / 2 + 80,
    };
  }

  /** The sea, its waves, the harbor dock and the little boat. */
  function drawSea(camera, time, bounds) {
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(WORLD.shoreX - 80, bounds.top - 100, WORLD.width - WORLD.shoreX + 200, bounds.bottom - bounds.top + 200);
    const gradient = ctx.createLinearGradient(WORLD.shoreX, 0, WORLD.width, 0);
    gradient.addColorStop(0, '#38c4d8');
    gradient.addColorStop(1, PALETTE.sea);
    ctx.fillStyle = gradient;
    ctx.fillRect(WORLD.shoreX - 80, bounds.top - 100, WORLD.width - WORLD.shoreX + 200, bounds.bottom - bounds.top + 200);

    ctx.lineWidth = 3;
    for (let y = Math.max(0, Math.floor(bounds.top / 56) * 56); y < bounds.bottom; y += 56) {
      ctx.beginPath();
      for (let x = Math.max(WORLD.shoreX, bounds.left); x < Math.min(WORLD.width, bounds.right); x += 24) {
        const wave = Math.sin((x + time * 34) * 0.014 + y * 0.03) * 5;
        if (x === Math.max(WORLD.shoreX, bounds.left)) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.20)';
      ctx.stroke();
    }

    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(WORLD.shoreX - 66, bounds.top - 100, 66, bounds.bottom - bounds.top + 200);
    ctx.fillStyle = PALETTE.seaFoam;
    ctx.globalAlpha = 0.65;
    ctx.fillRect(WORLD.shoreX - 4, bounds.top - 100, 8, bounds.bottom - bounds.top + 200);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#b98d5c';
    ctx.fillRect(WORLD.shoreX - 6, 1540, 450, 176);
    ctx.fillStyle = '#d8ab72';
    for (let x = WORLD.shoreX; x < WORLD.shoreX + 440; x += 22) ctx.fillRect(x, 1545, 3, 166);
    ctx.fillStyle = 'rgba(80,55,40,0.25)';
    for (let y = 1550; y < 1710; y += 22) ctx.fillRect(WORLD.shoreX - 6, y, 450, 3);

    ctx.fillStyle = '#8c5d42';
    roundRect(ctx, 2640, 1560, 230, 62, 22);
    ctx.fill();
    ctx.fillStyle = '#f6e7c6';
    roundRect(ctx, 2665, 1568, 92, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(2740, 1574, 66, 8);
    ctx.fillStyle = '#fff4d0';
    ctx.fillRect(2862, 1560, 4, 70);
    label(ctx, 'SOLANA QUEEN', 2755, 1552, 14, PALETTE.text, 700, 'center');

    ctx.fillStyle = '#c89258';
    for (const [x, y] of [[2590, 1590], [2620, 1660], [2610, 1690], [2900, 1680]]) {
      ctx.fillRect(x, y, 34, 28);
      ctx.strokeStyle = '#8c5d42';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, 34, 28);
    }
  }

  /** Ground, sidewalk, roads and lane markings. */
  function drawGround(city, bounds) {
    ctx.fillStyle = PALETTE.land;
    ctx.fillRect(0, 0, WORLD.shoreX - 64, WORLD.height);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = 0; x < WORLD.shoreX - 64; x += 180) ctx.fillRect(x, 0, 90, WORLD.height);

    for (const park of city.parks) {
      if (park.x + park.w < bounds.left || park.x > bounds.right || park.y + park.h < bounds.top || park.y > bounds.bottom) continue;
      ctx.fillStyle = PALETTE.park;
      roundRect(ctx, park.x, park.y, park.w, park.h, 14);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,245,205,0.5)';
      ctx.fillRect(park.x + park.w / 2 - 12, park.y, 24, park.h);
      ctx.fillRect(park.x, park.y + park.h / 2 - 12, park.w, 24);
    }

    const half = WORLD.roadWidth / 2;
    ctx.fillStyle = PALETTE.sidewalk;
    for (const x of city.roadsV) ctx.fillRect(x - half - 12, 0, WORLD.roadWidth + 24, WORLD.height);
    for (const y of city.roadsH) ctx.fillRect(0, y - half - 12, WORLD.shoreX - 64, WORLD.roadWidth + 24);

    ctx.fillStyle = PALETTE.road;
    for (const x of city.roadsV) ctx.fillRect(x - half, 0, WORLD.roadWidth, WORLD.height);
    for (const y of city.roadsH) ctx.fillRect(0, y - half, WORLD.shoreX - 64, WORLD.roadWidth);

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    for (const x of city.roadsV) {
      ctx.beginPath();
      ctx.moveTo(x - half + 4, 0);
      ctx.lineTo(x - half + 4, WORLD.height);
      ctx.moveTo(x + half - 4, 0);
      ctx.lineTo(x + half - 4, WORLD.height);
      ctx.stroke();
    }
    for (const y of city.roadsH) {
      ctx.beginPath();
      ctx.moveTo(0, y - half + 4);
      ctx.lineTo(WORLD.shoreX - 64, y - half + 4);
      ctx.moveTo(0, y + half - 4);
      ctx.lineTo(WORLD.shoreX - 64, y + half - 4);
      ctx.stroke();
    }

    ctx.setLineDash([22, 26]);
    ctx.strokeStyle = PALETTE.lane;
    ctx.lineWidth = 3;
    for (const x of city.roadsV) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.height);
      ctx.stroke();
    }
    for (const y of city.roadsH) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.shoreX - 64, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (const y of city.roadsH) {
      for (const x of city.roadsV) ctx.fillRect(x - half + 8, y - half + 8, WORLD.roadWidth - 16, WORLD.roadWidth - 16);
    }
  }

  /** Sunlit block buildings with a cast shadow, roof detail and the odd shop awning. */
  function drawBuildings(city, bounds) {
    for (const building of city.buildings) {
      if (building.x + building.w < bounds.left || building.x > bounds.right || building.y + building.h < bounds.top || building.y > bounds.bottom) continue;
      ctx.fillStyle = PALETTE.shadow;
      roundRect(ctx, building.x + 9, building.y + 11, building.w, building.h, 6);
      ctx.fill();
      ctx.fillStyle = building.wall;
      roundRect(ctx, building.x, building.y, building.w, building.h, 6);
      ctx.fill();
      ctx.fillStyle = building.roof;
      roundRect(ctx, building.x + 9, building.y + 9, building.w - 18, building.h - 18, 4);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.30)';
      ctx.lineWidth = 2;
      for (let y = building.y + 22; y < building.y + building.h - 12; y += 24) {
        ctx.beginPath();
        ctx.moveTo(building.x + 14, y);
        ctx.lineTo(building.x + building.w - 14, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(80,55,45,0.25)';
      ctx.fillRect(building.x + building.w * 0.28, building.y + building.h * 0.32, 26, 20);
      ctx.fillRect(building.x + building.w * 0.65, building.y + building.h * 0.62, 20, 18);
      if (building.sign) {
        ctx.fillStyle = building.signColor;
        ctx.fillRect(building.x + 8, building.y - 7, Math.min(72, building.w - 16), 9);
        ctx.fillStyle = 'rgba(40,30,30,0.35)';
        ctx.fillRect(building.x + 8, building.y + 2, Math.min(72, building.w - 16), 4);
      }
    }
  }

  /** Palm trees with a shadow, trunk and six windswept fronds. */
  function drawPalms(city, bounds, time) {
    for (const palm of city.palms) {
      if (palm.x < bounds.left - 60 || palm.x > bounds.right + 60 || palm.y < bounds.top - 60 || palm.y > bounds.bottom + 60) continue;
      const sway = Math.sin(time * 0.9 + palm.phase) * 0.09;
      ctx.fillStyle = 'rgba(70,50,35,0.25)';
      ctx.beginPath();
      ctx.ellipse(palm.x + 12, palm.y + 12, palm.size * 0.8, palm.size * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.trunk;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y);
      ctx.lineTo(palm.x + sway * 30, palm.y - palm.size * 0.9);
      ctx.stroke();
      const topX = palm.x + sway * 30;
      const topY = palm.y - palm.size * 0.9;
      for (let frond = 0; frond < 6; frond += 1) {
        const angle = (frond / 6) * Math.PI * 2 + sway;
        ctx.save();
        ctx.translate(topX, topY);
        ctx.rotate(angle);
        ctx.fillStyle = frond % 2 ? PALETTE.palmDark : PALETTE.palm;
        ctx.beginPath();
        ctx.ellipse(palm.size * 0.5, 0, palm.size * 0.62, palm.size * 0.19, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#8a5a3c';
      ctx.beginPath();
      ctx.arc(topX, topY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** One vehicle, drawn nose toward +x in local space. */
  function drawCar(car, time) {
    const length = CAR.length;
    const width = CAR.width;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(50,40,35,0.3)';
    roundRect(ctx, -length / 2 + 7, -width / 2 + 8, length, width, 9);
    ctx.fill();
    if (car.mode === 'wreck') {
      ctx.fillStyle = '#6e6a66';
      roundRect(ctx, -length / 2, -width / 2, length, width, 9);
      ctx.fill();
      ctx.fillStyle = '#403c39';
      roundRect(ctx, -12, -width / 2 + 5, 24, width - 10, 4);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = car.color;
    roundRect(ctx, -length / 2, -width / 2, length, width, 9);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,40,60,0.55)';
    roundRect(ctx, -8, -width / 2 + 4, 28, width - 8, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(ctx, -28, -width / 2 + 5, 15, width - 10, 3);
    ctx.fill();
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(length / 2 - 4, -width / 2 + 4, 5, 8);
    ctx.fillRect(length / 2 - 4, width / 2 - 12, 5, 8);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(-length / 2, -width / 2 + 4, 4, 8);
    ctx.fillRect(-length / 2, width / 2 - 12, 4, 8);
    if (car.mode === 'police') {
      ctx.fillStyle = '#f3f6ff';
      roundRect(ctx, -22, -width / 2 - 1, 36, width + 2, 4);
      ctx.fill();
      const on = Math.sin(car.siren) > 0;
      ctx.fillStyle = on ? PALETTE.policeRed : '#933244';
      ctx.fillRect(-16, -width / 2 - 2, 14, 9);
      ctx.fillStyle = on ? '#4a6eb0' : PALETTE.policeBlue;
      ctx.fillRect(-16, width / 2 - 7, 14, 9);
      ctx.fillStyle = on ? 'rgba(255,79,94,0.20)' : 'rgba(47,127,240,0.20)';
      ctx.beginPath();
      ctx.moveTo(length / 2, 0);
      ctx.lineTo(length / 2 + 95, -70);
      ctx.lineTo(length / 2 + 95, 70);
      ctx.closePath();
      ctx.fill();
    }
    if (car.mode === 'player') {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      roundRect(ctx, -length / 2 - 3, -width / 2 - 3, length + 6, width + 6, 11);
      ctx.stroke();
    }
    if (car.mode === 'rival') {
      ctx.fillStyle = '#ff4f7d';
      ctx.fillRect(-2, -width / 2 - 5, 18, 5);
      ctx.fillRect(-2, width / 2, 18, 5);
    }
    ctx.restore();
  }

  /** A walking pedestrian. */
  function drawPed(ped) {
    ctx.fillStyle = 'rgba(50,40,35,0.25)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 4, ped.y + 7, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (ped.down > 0) {
      ctx.fillStyle = ped.color;
      roundRect(ctx, ped.x - 13, ped.y - 4, 26, 10, 5);
      ctx.fill();
      return;
    }
    const bob = Math.sin(ped.phase) * 2;
    ctx.strokeStyle = '#3d4356';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ped.x - 4, ped.y + 2);
    ctx.lineTo(ped.x - 6 - Math.sin(ped.phase) * 4, ped.y + 11);
    ctx.moveTo(ped.x + 4, ped.y + 2);
    ctx.lineTo(ped.x + 6 + Math.sin(ped.phase) * 4, ped.y + 11);
    ctx.stroke();
    ctx.fillStyle = ped.color;
    roundRect(ctx, ped.x - 8, ped.y - 12 + bob, 16, 17, 6);
    ctx.fill();
    ctx.fillStyle = '#e8b894';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 17 + bob, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  /** A police officer or villa guard. */
  function drawOfficer(officer) {
    ctx.fillStyle = 'rgba(50,40,35,0.28)';
    ctx.beginPath();
    ctx.ellipse(officer.x + 4, officer.y + 7, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = officer.guard ? '#d2704f' : PALETTE.police;
    roundRect(ctx, officer.x - 10, officer.y - 14, 20, 20, 6);
    ctx.fill();
    ctx.fillStyle = officer.guard ? '#ffd23f' : '#8fc3ff';
    ctx.fillRect(officer.x - 10, officer.y - 7, 20, 4);
    ctx.fillStyle = '#e8b894';
    ctx.beginPath();
    ctx.arc(officer.x, officer.y - 19, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d2a3c';
    ctx.fillRect(officer.x - 6, officer.y - 21, 12, 4);
    ctx.strokeStyle = '#333b4b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(officer.x, officer.y - 8);
    ctx.lineTo(officer.x + Math.cos(officer.angle) * 17, officer.y - 8 + Math.sin(officer.angle) * 12);
    ctx.stroke();
  }

  /** Mara "Sunny" Vega, on foot or riding her current car. */
  function drawPlayer(player, time) {
    if (player.inCar) return;
    const blink = player.invuln > 0 && Math.floor(player.invuln * 14) % 2 === 0;
    if (blink) return;
    const bob = Math.sin(player.walkPhase) * 2;
    ctx.fillStyle = 'rgba(50,40,35,0.32)';
    ctx.beginPath();
    ctx.ellipse(player.x + 5, player.y + 9, 15, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#263245';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(player.x - 5, player.y + 2);
    ctx.lineTo(player.x - 7 - Math.sin(player.walkPhase) * 5, player.y + 13);
    ctx.moveTo(player.x + 5, player.y + 2);
    ctx.lineTo(player.x + 7 + Math.sin(player.walkPhase) * 5, player.y + 13);
    ctx.stroke();
    ctx.fillStyle = PALETTE.playerDark;
    roundRect(ctx, player.x - 10, player.y - 8 + bob, 20, 14, 5);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    roundRect(ctx, player.x - 11, player.y - 17 + bob, 22, 18, 7);
    ctx.fill();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - 11 + bob);
    ctx.lineTo(player.x + Math.cos(player.aimAngle) * 23, player.y - 11 + bob + Math.sin(player.aimAngle) * 18);
    ctx.stroke();
    ctx.fillStyle = '#f1c39d';
    ctx.beginPath();
    ctx.arc(player.x, player.y - 23 + bob, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8b4d34';
    ctx.beginPath();
    ctx.arc(player.x, player.y - 28 + bob, 8, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#263245';
    ctx.fillRect(player.x - 7, player.y - 24 + bob, 14, 3);
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(player.x, player.y - 48 + Math.sin(time * 2) * 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Animated objective rings and a guide line to the current target. */
  function drawMarkers(state, targets) {
    const pulse = (Math.sin(state.elapsed * 4) + 1) / 2;
    for (const target of targets) {
      if (!target) continue;
      const radius = 44 + pulse * 8;
      ctx.strokeStyle = 'rgba(255,210,63,0.95)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(target.x, target.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(target.x, target.y, radius - 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,210,63,0.18)';
      ctx.beginPath();
      ctx.arc(target.x, target.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.rotate(Math.PI / 4 + state.elapsed * 0.6);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(-9, -9, 18, 18);
      ctx.restore();
      label(ctx, target.label ?? 'OBJECTIVE', target.x, target.y - radius - 14, 15, PALETTE.text, 800, 'center');
    }
    const target = targets[0];
    if (target && distance(target.x, target.y, state.player.x, state.player.y) > 180) {
      ctx.setLineDash([12, 14]);
      ctx.strokeStyle = 'rgba(255,210,63,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(state.player.x, state.player.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /** The complete world view under the HUD. */
  function drawWorld(state, extras) {
    const effects = extras.effects;
    const shake = effects ? effects.offset() : { x: 0, y: 0, flash: 0 };
    const camera = state.camera;
    const bounds = visibleBounds(camera);
    ctx.save();
    ctx.translate(Math.round(FIELD.width / 2 - camera.x + shake.x), Math.round(FIELD.height / 2 - camera.y + shake.y));
    drawSea(camera, state.elapsed, bounds);
    drawGround(state.city, bounds);
    drawBuildings(state.city, bounds);
    drawPalms(state.city, bounds, state.elapsed);
    drawMarkers(state, extras.targets ?? []);
    for (const car of state.cars) {
      if (car.mode === 'idle') continue;
      if (car.x < bounds.left - 80 || car.x > bounds.right + 80 || car.y < bounds.top - 80 || car.y > bounds.bottom + 80) continue;
      drawCar(car, state.elapsed);
    }
    for (const ped of state.peds) {
      if (ped.x < bounds.left || ped.x > bounds.right || ped.y < bounds.top || ped.y > bounds.bottom) continue;
      drawPed(ped);
    }
    for (const officer of state.officers) {
      if (officer.mode === 'idle') continue;
      drawOfficer(officer);
    }
    drawPlayer(state.player, state.elapsed);
    ctx.lineCap = 'round';
    for (const bullet of state.bullets) {
      if (!bullet.active) continue;
      ctx.strokeStyle = bullet.color;
      ctx.lineWidth = bullet.friendly ? 4 : 5;
      ctx.beginPath();
      ctx.moveTo(bullet.x, bullet.y);
      ctx.lineTo(bullet.x - bullet.vx * 0.016, bullet.y - bullet.vy * 0.016);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    if (effects) effects.draw(ctx);
    ctx.restore();
    if (shake.flash > 0) {
      ctx.fillStyle = `rgba(255,250,220,${shake.flash * 3})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  /** Panel helper used throughout the HUD and cards. */
  function panel(x, y, w, h, alpha = 0.86) {
    ctx.fillStyle = `rgba(19,28,44,${alpha})`;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function bar(x, y, w, h, value, max, color) {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    const fill = clamp(value / max, 0, 1);
    if (fill > 0) {
      ctx.fillStyle = color;
      roundRect(ctx, x, y, Math.max(h, w * fill), h, h / 2);
      ctx.fill();
    }
  }

  /** Top-right live minimap centred on the player. */
  function drawMinimap(state) {
    const x = FIELD.width - 208;
    const y = 18;
    const size = 190;
    panel(x, y, size, size + 22, 0.9);
    label(ctx, 'SOLANA BAY', x + size / 2, y + 19, 13, PALETTE.gold, 800, 'center');
    const mapX = x + 8;
    const mapY = y + 26;
    const mapSize = size - 16;
    ctx.save();
    roundRect(ctx, mapX, mapY, mapSize, mapSize, 8);
    ctx.clip();
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.fillStyle = '#ece0bd';
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    const scale = 0.17;
    const originX = mapX + mapSize / 2 - state.player.x * scale;
    const originY = mapY + mapSize / 2 - state.player.y * scale;
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(originX + WORLD.shoreX * scale, mapY, 400, mapSize);
    ctx.fillStyle = '#b6a582';
    for (const road of state.city.roadsV) ctx.fillRect(originX + (road - WORLD.roadWidth / 2) * scale, mapY, WORLD.roadWidth * scale, mapSize);
    for (const road of state.city.roadsH) ctx.fillRect(mapX, originY + (road - WORLD.roadWidth / 2) * scale, mapSize, WORLD.roadWidth * scale);
    ctx.fillStyle = '#c69a76';
    for (const building of state.city.buildings) ctx.fillRect(originX + building.x * scale, originY + building.y * scale, Math.max(2, building.w * scale), Math.max(2, building.h * scale));
    for (const target of extrasTargets) {
      if (!target) continue;
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(originX + target.x * scale, originY + target.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) {
      if (car.mode !== 'police') continue;
      ctx.fillStyle = PALETTE.policeRed;
      ctx.fillRect(originX + car.x * scale - 2, originY + car.y * scale - 2, 4, 4);
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mapX + mapSize / 2, mapY + mapSize / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  let extrasTargets = [];

  /** The always-visible game HUD. */
  function drawHud(state, extras) {
    extrasTargets = extras.targets ?? [];
    panel(18, 18, 268, 116, 0.88);
    label(ctx, 'MARA "SUNNY" VEGA', 32, 40, 14, PALETTE.gold, 800);
    label(ctx, `$${state.money.toLocaleString()}`, 32, 76, 28, PALETTE.text, 800);
    label(ctx, rankFor(state.reputation), 32, 98, 12, PALETTE.muted, 700);
    bar(166, 48, 104, 9, state.player.health, PLAYER.maxHealth, PALETTE.red);
    bar(166, 68, 104, 9, state.player.armor, PLAYER.maxArmor, PALETTE.cyan);
    label(ctx, 'HP', 148, 57, 10, PALETTE.muted, 700, 'right');
    label(ctx, 'AR', 148, 77, 10, PALETTE.muted, 700, 'right');

    if (state.wanted > 0) {
      panel(410, 18, 460, 54, 0.82);
      label(ctx, 'WANTED', 640, 40, 12, '#ffd23f', 800, 'center');
      for (let star = 0; star < 5; star += 1) {
        const filled = star < state.wanted;
        const cx = 480 + star * 80;
        ctx.fillStyle = filled ? PALETTE.gold : 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        const cy = 60;
        for (let point = 0; point < 10; point += 1) {
          const angle = -Math.PI / 2 + (point * Math.PI) / 5;
          const radius = point % 2 ? 6 : 13;
          const px = cx + Math.cos(angle) * radius;
          const py = cy + Math.sin(angle) * radius;
          if (point === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    drawMinimap(state);

    const mission = MISSIONS[state.mission.index];
    panel(18, FIELD.height - 156, 464, 138, 0.9);
    if (mission) {
      label(ctx, `JOB ${state.mission.index + 1}/6  -  ${mission.title}`, 34, FIELD.height - 130, 16, PALETTE.gold, 800);
      label(ctx, extras.objective ?? '', 34, FIELD.height - 105, 16, PALETTE.text, 600);
      label(ctx, mission.hint, 34, FIELD.height - 82, 12, PALETTE.muted, 500);
    } else {
      label(ctx, 'ALL JOBS COMPLETE', 34, FIELD.height - 130, 16, PALETTE.gold, 800);
      label(ctx, 'Solana Bay belongs to Sunny Vega.', 34, FIELD.height - 105, 16, PALETTE.text, 600);
    }
    const segmentWidth = 64;
    for (let index = 0; index < 6; index += 1) {
      ctx.fillStyle = index < state.mission.index ? PALETTE.gold : index === state.mission.index ? PALETTE.cyan : 'rgba(255,255,255,0.2)';
      roundRect(ctx, 34 + index * (segmentWidth + 7), FIELD.height - 50, segmentWidth, 7, 3);
      ctx.fill();
    }

    panel(FIELD.width - 342, FIELD.height - 76, 324, 58, 0.78);
    label(ctx, 'WASD drive / walk   E enter   F interact', FIELD.width - 330, FIELD.height - 52, 12, PALETTE.text, 600);
    label(ctx, 'MOUSE aim   CLICK fire   P pause', FIELD.width - 330, FIELD.height - 32, 12, PALETTE.muted, 600);

    if (state.toast) {
      const width = Math.min(700, 90 + state.toast.text.length * 8.5);
      const x = (FIELD.width - width) / 2;
      const y = FIELD.height - 208;
      panel(x, y, width, 46, 0.92);
      label(ctx, state.toast.text, FIELD.width / 2, y + 30, 16, state.toast.color, 800, 'center');
    }
  }

  /** Dim the world behind a screen card. */
  function dim(alpha = 0.72) {
    ctx.fillStyle = `rgba(11,22,38,${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  /** The opening screen: title, hero copy and the six-job itinerary. */
  function drawTitle(state, extras) {
    dim(0.52);
    const gradient = ctx.createLinearGradient(120, 90, 1160, 620);
    gradient.addColorStop(0, 'rgba(255,196,90,0.22)');
    gradient.addColorStop(1, 'rgba(12,28,48,0.1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(60, 70, 1160, 580);

    ctx.fillStyle = 'rgba(255,210,63,0.16)';
    ctx.beginPath();
    ctx.arc(1050, 160, 120, 0, Math.PI * 2);
    ctx.fill();

    label(ctx, 'SUN COAST  /  OPEN WORLD CRIME', 640, 152, 17, PALETTE.gold, 800, 'center');
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 7;
    label(ctx, 'SOLANA BAY', 640, 246, 82, PALETTE.text, 900, 'center');
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    label(ctx, 'The sun is hot. The heat is hotter.', 640, 286, 20, PALETTE.muted, 600, 'center');

    const cardY = 330;
    panel(150, cardY, 460, 230, 0.9);
    label(ctx, 'MARA "SUNNY" VEGA', 178, cardY + 38, 23, PALETTE.gold, 900);
    label(ctx, 'GETAWAY DRIVER', 178, cardY + 62, 13, PALETTE.cyan, 800);
    const heroLines = wrap(ctx, 'Six jobs. One coastline. Drive stolen cars through sunlit streets, take Tito\'s calls, run Dana\'s errands, and leave the patrols eating your dust.', 404, 17, 500);
    heroLines.forEach((line, index) => label(ctx, line, 178, cardY + 96 + index * 25, 17, PALETTE.text, 500));

    panel(650, cardY, 480, 230, 0.88);
    label(ctx, 'THE JOB CHAIN', 678, cardY + 38, 18, PALETTE.gold, 800);
    MISSIONS.forEach((mission, index) => {
      const y = cardY + 68 + index * 26;
      label(ctx, String(index + 1).padStart(2, '0'), 680, y, 13, index === 0 ? PALETTE.cyan : PALETTE.muted, 800);
      label(ctx, mission.title, 714, y, 14, PALETTE.text, 700);
      label(ctx, `$${mission.reward.toLocaleString()}`, 1100, y, 13, PALETTE.gold, 700, 'right');
    });

    const pulse = 0.6 + Math.sin((extras.time ?? 0) * 3) * 0.4;
    ctx.globalAlpha = pulse;
    label(ctx, 'PRESS ENTER OR CLICK TO START', 640, 626, 24, PALETTE.gold, 900, 'center');
    ctx.globalAlpha = 1;
    label(ctx, 'WASD / arrows  -  E enter car  -  mouse aim + click fire  -  P pause', 640, 668, 13, PALETTE.muted, 600, 'center');
  }

  /** The current mission's briefing card, also used by the staged story screenshot. */
  function drawBriefing(state, extras) {
    const mission = state.briefing ?? MISSIONS[state.mission.index] ?? MISSIONS[0];
    const number = state.briefing?.number ?? Math.min(6, state.mission.index + 1);
    const width = 760;
    const height = 414;
    const x = (FIELD.width - width) / 2;
    const y = 122;
    dim(0.46);
    panel(x, y, width, height, 0.95);
    ctx.fillStyle = PALETTE.gold;
    roundRect(ctx, x + 28, y + 26, 130, 34, 8);
    ctx.fill();
    label(ctx, `JOB ${number} / 6`, x + 93, y + 50, 14, '#1b283d', 900, 'center');

    ctx.fillStyle = '#e8b894';
    ctx.beginPath();
    ctx.arc(x + 82, y + 112, 28, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, mission.contact.split(' ').map((part) => part[0]).join(''), x + 82, y + 122, 24, '#2b3a52', 900, 'center');
    label(ctx, mission.contact, x + 128, y + 106, 18, PALETTE.cyan, 800);
    label(ctx, mission.title, x + 128, y + 135, 29, PALETTE.text, 900);

    const lines = wrap(ctx, mission.brief ?? mission.text ?? '', width - 72, 19, 500);
    lines.forEach((line, index) => label(ctx, line, x + 36, y + 190 + index * 27, 19, PALETTE.text, 500));

    const bottom = y + height - 112;
    panel(x + 30, bottom, width - 60, 74, 0.75);
    label(ctx, 'OBJECTIVE', x + 48, bottom + 27, 12, PALETTE.gold, 800);
    label(ctx, mission.objective, x + 48, bottom + 51, 16, PALETTE.text, 700);
    label(ctx, 'PAY', x + 560, bottom + 27, 12, PALETTE.gold, 800);
    label(ctx, `$${mission.reward.toLocaleString()}`, x + 560, bottom + 51, 17, PALETTE.green, 800);
    label(ctx, 'REP', x + 668, bottom + 27, 12, PALETTE.gold, 800);
    label(ctx, `+${mission.reputation}`, x + 668, bottom + 51, 17, PALETTE.cyan, 800);

    const dots = 6;
    for (let index = 0; index < dots; index += 1) {
      ctx.fillStyle = index < number - 1 ? PALETTE.gold : index === number - 1 ? PALETTE.cyan : 'rgba(255,255,255,0.24)';
      ctx.beginPath();
      ctx.arc(x + width / 2 + (index - (dots - 1) / 2) * 24, y + height - 20, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (extras.showPrompt !== false) label(ctx, 'PRESS ENTER TO GET TO WORK', FIELD.width / 2, y + height + 44, 18, PALETTE.gold, 800, 'center');
  }

  /** Pause, game-over and victory screens. */
  function drawEndCard(state, screen) {
    dim(0.78);
    const width = 620;
    const height = 340;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    panel(x, y, width, height, 0.96);
    const over = screen === SCREEN_OVER;
    const victory = screen === SCREEN_VICTORY;
    const heading = over ? 'GAME OVER' : victory ? 'KING OF SOLANA BAY' : 'PAUSED';
    const color = over ? PALETTE.red : victory ? PALETTE.gold : PALETTE.cyan;
    label(ctx, heading, FIELD.width / 2, y + 72, over ? 52 : 43, color, 900, 'center');
    label(ctx, over ? 'Sunny went down. The bay keeps no prisoners.' : victory ? 'Six jobs paid in full. The Sun Coast answer to Sunny Vega.' : 'The city waits for you.', FIELD.width / 2, y + 112, 16, PALETTE.muted, 600, 'center');

    const stats = [
      ['MONEY EARNED', `$${state.totalEarned.toLocaleString()}`],
      ['REPUTATION', `${state.reputation}  /  ${rankFor(state.reputation)}`],
      ['CRUISERS DOWN', String(state.stats.cruisers)],
      ['CARS TAKEN', String(state.stats.carsStolen)],
    ];
    stats.forEach(([key, value], index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const statX = x + 62 + column * 270;
      const statY = y + 165 + row * 58;
      label(ctx, key, statX, statY, 11, PALETTE.muted, 700);
      label(ctx, value, statX, statY + 25, 20, PALETTE.text, 800);
    });
    label(ctx, over ? 'PRESS R OR ENTER TO RESTART' : victory ? 'PRESS R FOR A FRESH RUN' : 'PRESS P OR ESC TO RESUME', FIELD.width / 2, y + height - 30, 17, PALETTE.gold, 800, 'center');
  }

  /** Paint one complete logical frame. */
  function draw(state, screen, extras = {}) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c1626';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.textBaseline = 'alphabetic';
    drawWorld(state, extras);

    if (screen === SCREEN_TITLE) {
      drawTitle(state, extras);
      return;
    }
    drawHud(state, extras);
    if (screen === SCREEN_STORY) drawBriefing(state, extras);
    else if (screen === SCREEN_PAUSED) drawEndCard(state, screen);
    else if (screen === SCREEN_OVER) drawEndCard(state, screen);
    else if (screen === SCREEN_VICTORY) drawEndCard(state, screen);
    else if (state.briefing && screen === SCREEN_PLAY) drawBriefing(state, extras);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize, toField };
}
