// The hand-built city layout: roads, lots, buildings, palms, parks and the story landmarks.
// Everything is deterministic from the seed so a screenshot scene is identical every run.
import { WORLD } from './config.js';

export const LANDMARKS = {
  start: { x: 430, y: 740 },
  checkpoints: [
    { x: 750, y: 700, label: 'PIER 9 GATE' },
    { x: 1750, y: 1150, label: 'SUN AVE TURN' },
    { x: 2250, y: 1600, label: 'HARBOR APPROACH' },
  ],
  handoffPickup: { x: 2740, y: 1630, label: 'HARBOR DOCK' },
  handoffDrop: { x: 810, y: 1190, label: 'MARKET BACK ROOM' },
  shops: [
    { x: 470, y: 470, label: 'PALETTI BOUTIQUE' },
    { x: 980, y: 960, label: 'SUNWAVE STUDIO' },
    { x: 1980, y: 1460, label: 'CORAL CORNER' },
  ],
  raceGates: [
    { x: 250, y: 2050, label: 'GATE 1 / SOUTH STRIP' },
    { x: 1250, y: 1600, label: 'GATE 2 / CANAL' },
    { x: 2250, y: 700, label: 'GATE 3 / PALM ROW' },
    { x: 1750, y: 250, label: 'GATE 4 / SKYLINE' },
  ],
  villa: { x: 2350, y: 380, label: 'VEGA VILLA' },
  escape: { x: 2700, y: 1620, label: 'ESCAPE BOAT' },
};

/** True when a point is in the sea and not on the harbor dock. */
export function isWater(x, y) {
  if (x < WORLD.shoreX) return false;
  const onDock = x < 2960 && y > 1545 && y < 1715;
  const onEscape = x < 2820 && y > 1545 && y < 1715;
  return !(onDock || onEscape);
}

/** True when a circular body would hit one of the solid building rectangles. */
export function hitsBuilding(city, x, y, radius) {
  for (let index = 0; index < city.buildings.length; index += 1) {
    const b = city.buildings[index];
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return true;
  }
  return false;
}

/** Nearest road centre to a coordinate; used by traffic and the police pathing. */
export function nearestRoad(x, y) {
  let bestV = WORLD.verticalRoads[0];
  let bestVD = Infinity;
  for (const road of WORLD.verticalRoads) {
    const delta = Math.abs(road - x);
    if (delta < bestVD) {
      bestVD = delta;
      bestV = road;
    }
  }
  let bestH = WORLD.horizontalRoads[0];
  let bestHD = Infinity;
  for (const road of WORLD.horizontalRoads) {
    const delta = Math.abs(road - y);
    if (delta < bestHD) {
      bestHD = delta;
      bestH = road;
    }
  }
  return bestVD < bestHD ? { axis: 'v', x: bestV, y } : { axis: 'h', x, y: bestH };
}

/** Build the static city. No state changes after this; the renderer and world only read it. */
export function createCity(random) {
  const buildings = [];
  const palms = [];
  const parks = [];
  const vRoads = WORLD.verticalRoads;
  const hRoads = WORLD.horizontalRoads;

  for (let column = 0; column < vRoads.length - 1; column += 1) {
    for (let row = 0; row < hRoads.length - 1; row += 1) {
      const left = vRoads[column] + WORLD.roadWidth / 2 + 18;
      const right = vRoads[column + 1] - WORLD.roadWidth / 2 - 18;
      const top = hRoads[row] + WORLD.roadWidth / 2 + 18;
      const bottom = hRoads[row + 1] - WORLD.roadWidth / 2 - 18;
      const blockWidth = right - left;
      const blockHeight = bottom - top;
      if (blockWidth < 100 || blockHeight < 100) continue;

      if (random.chance(0.16)) {
        parks.push({ x: left, y: top, w: blockWidth, h: blockHeight });
        for (let tree = 0; tree < 4; tree += 1) {
          palms.push({
            x: left + random.range(25, blockWidth - 25),
            y: top + random.range(25, blockHeight - 25),
            size: random.range(20, 30),
            phase: random.range(0, 6.28),
          });
        }
        continue;
      }

      for (let lotY = 0; lotY < 2; lotY += 1) {
        for (let lotX = 0; lotX < 2; lotX += 1) {
          if (random.chance(0.13)) continue;
          const lotW = blockWidth / 2;
          const lotH = blockHeight / 2;
          const gap = random.range(7, 14);
          const x = left + lotX * lotW + gap;
          const y = top + lotY * lotH + gap;
          const w = lotW - gap * 2;
          const h = lotH - gap * 2;
          const style = random.int(0, PALETTE_STYLE_COUNT - 1);
          buildings.push({
            x, y, w, h,
            wall: PALETTE_STYLE_WALL[style],
            roof: PALETTE_STYLE_ROOF[style],
            floors: random.int(2, 6),
            sign: random.chance(0.35),
            signColor: random.pick(['#ff5f6d', '#ffd23f', '#48c9b0', '#ffffff']),
          });
        }
      }
    }
  }

  const villaLot = { x: 2280, y: 290, w: 170, h: 165 };
  buildings.push({ ...villaLot, wall: '#ffe0b2', roof: '#e8875e', floors: 3, sign: false, signColor: '#fff' });

  for (const roadX of vRoads) {
    for (let y = 130; y < WORLD.height - 60; y += 135) {
      if (random.chance(0.72)) palms.push({ x: roadX + 86, y, size: random.range(18, 28), phase: random.range(0, 6.28) });
    }
  }
  for (let x = 150; x < WORLD.shoreX - 40; x += 140) {
    palms.push({ x, y: WORLD.shoreX - 30, size: random.range(24, 34), phase: random.range(0, 6.28) });
  }
  for (let y = 80; y < WORLD.height; y += 110) {
    palms.push({ x: WORLD.shoreX - 18, y, size: random.range(25, 36), phase: random.range(0, 6.28) });
  }

  const parkingSpots = [];
  for (let column = 0; column < vRoads.length; column += 1) {
    for (let row = 0; row < hRoads.length; row += 1) {
      parkingSpots.push({ x: vRoads[column] + 100, y: hRoads[row], angle: 0 });
      if (column < vRoads.length - 1) {
        parkingSpots.push({ x: vRoads[column], y: hRoads[row] + 100, angle: Math.PI / 2 });
      }
    }
  }

  return { buildings, palms, parks, parkingSpots, roadsV: vRoads, roadsH: hRoads };
}

const PALETTE_STYLE_WALL = ['#f7b58b', '#f4cf94', '#ef9e86', '#f9ddb0', '#e9ad9b', '#f6c587'];
const PALETTE_STYLE_ROOF = ['#d98467', '#d9b16c', '#cf7d6d', '#e2bb7f', '#c88875', '#e0a96d'];
const PALETTE_STYLE_COUNT = PALETTE_STYLE_WALL.length;
