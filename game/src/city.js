// Procedural city layout for Solana Bay: pastel blocks, palm-lined beach,
// turquoise harbor and a handful of named landmarks used by the story.
// Generation is seeded so a screenshot seed always rebuilds the same streets.

import { CITY, CITY_HEIGHT, CITY_WIDTH, PALETTE } from './config.js';
import { pick } from './random.js';

const BLOCK_INSET = CITY.road / 2 + 8;
const BLOCK_SIZE = CITY.cell - CITY.road - 16;

function districtAt(x, y) {
  if (x > CITY.beachCol * CITY.cell - CITY.road) return 'BOARDWALK';
  const row = y / CITY.cell;
  if (row < 4) return 'UPTOWN';
  if (row < 8) return 'PALM QUARTER';
  return 'HARBORSIDE';
}

function makeBuilding(random, x, y, w, h, block) {
  return {
    x, y, w, h,
    color: pick(random, PALETTE.building),
    floors: 2 + Math.floor(random() * 8),
    seed: Math.floor(random() * 100000),
    top: random() < 0.22 ? 'sign' : random() < 0.42 ? 'tank' : 'plain',
    sign: pick(random, ['SOLAR', 'CAFE', 'SUN 24', 'MOTEL', 'ARCADE', 'BAY FM', 'SURF', 'PIZZA']),
    block,
    shop: false,
    landmark: null,
  };
}

function splitShapes(random, x, y, size) {
  const roll = random();
  if (roll < 0.26) return [[0, 0, size, size]];
  if (roll < 0.68) {
    return [
      [0, 0, size * 0.56, size],
      [size * 0.6, 0, size * 0.4, size * 0.58],
      [size * 0.6, size * 0.62, size * 0.4, size * 0.38],
    ];
  }
  return [
    [0, 0, size * 0.48, size * 0.48],
    [size * 0.52, 0, size * 0.48, size * 0.48],
    [0, size * 0.52, size * 0.48, size * 0.48],
    [size * 0.52, size * 0.52, size * 0.48, size * 0.48],
  ];
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const shops = [];
  const blockStyles = [];
  const landmarks = [];

  for (let i = 0; i < CITY.cols; i += 1) {
    for (let j = 0; j < CITY.rows; j += 1) {
      const x = i * CITY.cell + BLOCK_INSET;
      const y = j * CITY.cell + BLOCK_INSET;
      let style = 'buildings';
      if (i >= CITY.beachCol + 1) style = 'water';
      else if (i === CITY.beachCol) style = 'sand';
      else if ((i === 6 && j === 5) || random() < 0.12) style = 'park';
      if (i === 2 && j === 9) style = 'arena';
      blockStyles.push(style);

      if (style === 'buildings') {
        for (const rect of splitShapes(random, x, y, BLOCK_SIZE)) {
          const building = makeBuilding(random, x + rect[0], y + rect[1], rect[2], rect[3], districtAt(x, y));
          buildings.push(building);
          if (random() < 0.09 || buildings.length % 7 === 0) {
            building.shop = true;
            const door = { x: building.x + building.w / 2, y: building.y + building.h + 15, cooldown: 0 };
            shops.push(door);
          }
        }
      } else if (style === 'park') {
        for (let t = 0; t < 10; t += 1) {
          trees.push({
            x: x + 14 + random() * (BLOCK_SIZE - 28),
            y: y + 14 + random() * (BLOCK_SIZE - 28),
            r: 12 + random() * 9,
            palm: i >= CITY.beachCol - 3 || random() < 0.28,
          });
        }
      } else if (style === 'sand') {
        for (let t = 0; t < 6; t += 1) {
          trees.push({
            x: x + 12 + random() * (BLOCK_SIZE - 24),
            y: y + 12 + random() * (BLOCK_SIZE - 24),
            r: 14 + random() * 8,
            palm: true,
          });
        }
      } else if (style === 'arena') {
        const arena = makeBuilding(random, x, y, BLOCK_SIZE, BLOCK_SIZE, 'HARBORSIDE');
        arena.top = 'plain';
        arena.landmark = 'arena';
        arena.color = '#f4d9a5';
        buildings.push(arena);
        landmarks.push({ type: 'arena', x: x + BLOCK_SIZE / 2, y: y + BLOCK_SIZE / 2, label: 'SOLAR ARENA' });
      }
    }
  }

  const lighthouse = makeBuilding(random, CITY.beachCol * CITY.cell + BLOCK_INSET + 60, 2 * CITY.cell + BLOCK_INSET + 50, 58, 58, 'BOARDWALK');
  lighthouse.landmark = 'lighthouse';
  lighthouse.top = 'plain';
  lighthouse.color = '#fff4df';
  buildings.push(lighthouse);
  landmarks.push({ type: 'lighthouse', x: lighthouse.x + 29, y: lighthouse.y + 29, label: 'SOLANA LIGHT' });

  if (shops.length < 8) {
    for (const building of buildings) {
      if (building.landmark) continue;
      building.shop = true;
      shops.push({ x: building.x + building.w / 2, y: building.y + building.h + 15, cooldown: 0 });
      if (shops.length >= 8) break;
    }
  }

  const spots = {
    start: { x: 7 * CITY.cell, y: 6 * CITY.cell },
    safehouse: { x: 8 * CITY.cell, y: 6 * CITY.cell },
    garage: { x: 6 * CITY.cell, y: 6 * CITY.cell },
    plaza: { x: 8 * CITY.cell, y: 4 * CITY.cell },
    harbor: { x: 11 * CITY.cell, y: 9 * CITY.cell },
    pier: { x: CITY.beachCol * CITY.cell + 170, y: 9 * CITY.cell },
    boardwalk: { x: CITY.beachCol * CITY.cell, y: 6 * CITY.cell },
  };

  const pier = {
    x: (CITY.beachCol + 1) * CITY.cell - CITY.road / 2,
    y: 9 * CITY.cell - 26,
    w: CITY.cell * 1.7,
    h: 52,
  };

  return {
    buildings, trees, shops, blockStyles, landmarks, spots, pier,
    districtAt,
    width: CITY_WIDTH,
    height: CITY_HEIGHT,
  };
}
