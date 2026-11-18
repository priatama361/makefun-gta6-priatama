import { CAR, PALETTE, WORLD } from './config.js';
import { pickOne, randomBetween, randomInt } from './random.js';

export function createCity(random) {
  const columns = Math.floor(WORLD.width / WORLD.pitch);
  const rows = Math.floor(WORLD.height / WORLD.pitch);
  const buildings = [];
  const palms = [];
  const parked = [];
  const buildingGrid = new Map();

  function roadPoint(column, row) {
    return { x: column * WORLD.pitch + WORLD.road / 2, y: row * WORLD.pitch + WORLD.road / 2 };
  }

  function lotPoint(column, row) {
    return {
      x: column * WORLD.pitch + WORLD.road + 10,
      y: row * WORLD.pitch + WORLD.road + 10,
      w: WORLD.pitch - WORLD.road - 20,
      h: WORLD.pitch - WORLD.road - 20,
    };
  }

  const landmarks = {
    tito: { ...roadPoint(2, 3), label: 'TITO ALVAREZ' },
    dana: { ...roadPoint(1, 7), label: 'DANA KESTREL' },
    harbor: { ...roadPoint(1, 8), label: 'HARBOR DOCKS' },
    villa: { ...roadPoint(10, 1), label: 'THE VILLA' },
    precinct: { ...roadPoint(7, 6), label: 'SOLANA PRECINCT' },
    garage: { ...roadPoint(4, 4), label: 'SUNNY GARAGE' },
    shop1: { ...roadPoint(5, 2), label: 'PALM BOUTIQUE' },
    shop2: { ...roadPoint(8, 3), label: 'COAST OUTFITTERS' },
    shop3: { ...roadPoint(6, 8), label: 'BAY JEWELERS' },
    cp1: { ...roadPoint(3, 3), label: 'CHECKPOINT 1' },
    cp2: { ...roadPoint(6, 3), label: 'CHECKPOINT 2' },
    cp3: { ...roadPoint(6, 5), label: 'CHECKPOINT 3' },
    cp4: { ...roadPoint(3, 5), label: 'CHECKPOINT 4' },
    cp5: { ...roadPoint(3, 7), label: 'CHECKPOINT 5' },
    race1: { ...roadPoint(9, 2), label: 'RACE GATE 1' },
    race2: { ...roadPoint(11, 2), label: 'RACE GATE 2' },
    race3: { ...roadPoint(11, 5), label: 'RACE GATE 3' },
    race4: { ...roadPoint(8, 5), label: 'RACE GATE 4' },
    escape: { ...roadPoint(1, 1), label: 'ESCAPE BOAT' },
  };

  const shops = ['shop1', 'shop2', 'shop3'];
  const shopLot = { shop1: [5, 2], shop2: [8, 3], shop3: [6, 8] };

  function addBuilding(entry, column, row) {
    buildings.push(entry);
    const key = `${column},${row}`;
    let bucket = buildingGrid.get(key);
    if (bucket === undefined) {
      bucket = [];
      buildingGrid.set(key, bucket);
    }
    bucket.push(entry);
  }

  for (let column = 0; column <= columns; column += 1) {
    for (let row = 0; row <= rows; row += 1) {
      const lot = lotPoint(column, row);
      if (lot.x >= WORLD.width - 30 || lot.y >= WORLD.height - 30) continue;
      const paletteIndex = randomInt(random, 0, PALETTE.building.length - 1);
      const split = random() < 0.45;
      if (split) {
        const half = Math.floor(lot.w / 2) - 8;
        for (let side = 0; side < 2; side += 1) {
          const depth = randomBetween(random, lot.h * 0.55, lot.h * 0.94);
          const entry = {
            x: lot.x + side * (half + 16),
            y: lot.y + (lot.h - depth) * random(),
            w: half,
            h: depth,
            color: PALETTE.building[(paletteIndex + side) % PALETTE.building.length],
            roof: PALETTE.roof[(paletteIndex + side) % PALETTE.roof.length],
            floors: randomInt(random, 1, 4),
            shop: null,
          };
          addBuilding(entry, column, row);
        }
      } else {
        const entry = {
          x: lot.x,
          y: lot.y,
          w: lot.w,
          h: randomBetween(random, lot.h * 0.6, lot.h * 0.95),
          color: PALETTE.building[paletteIndex],
          roof: PALETTE.roof[paletteIndex],
          floors: randomInt(random, 1, 5),
          shop: null,
        };
        addBuilding(entry, column, row);
      }
      for (let palm = 0; palm < randomInt(random, 1, 3); palm += 1) {
        palms.push({
          x: lot.x + random() * lot.w,
          y: lot.y + randomBetween(random, 0.16, 0.95) * lot.h,
          scale: randomBetween(random, 0.7, 1.25),
        });
      }
      if (random() < 0.7) {
        parked.push({
          x: column * WORLD.pitch + WORLD.road + randomBetween(random, 10, WORLD.pitch - WORLD.road - 44),
          y: row * WORLD.pitch + randomBetween(random, 8, WORLD.road - 8),
          angle: 0,
          color: pickOne(random, PALETTE.carColors),
          model: randomInt(random, 0, 2),
          stolen: false,
        });
      }
      if (random() < 0.55) {
        parked.push({
          x: column * WORLD.pitch + randomBetween(random, 8, WORLD.road - 8),
          y: row * WORLD.pitch + WORLD.road + randomBetween(random, 10, WORLD.pitch - WORLD.road - 44),
          angle: Math.PI / 2,
          color: pickOne(random, PALETTE.carColors),
          model: randomInt(random, 0, 2),
          stolen: false,
        });
      }
    }
  }

  for (const name of shops) {
    const [column, row] = shopLot[name];
    for (const entry of buildingGrid.get(`${column},${row}`) ?? []) {
      entry.shop = name;
      entry.color = '#ffe0a3';
      entry.roof = '#d6a45c';
    }
  }

  for (let index = 0; index < 46; index += 1) {
    palms.push({
      x: randomBetween(random, WORLD.coast + 18, WORLD.beach - 12),
      y: randomBetween(random, 40, WORLD.height - 40),
      scale: randomBetween(random, 0.85, 1.4),
    });
  }

  function isWater(x, y) {
    return x < WORLD.coast || y < 0 || x > WORLD.width || y > WORLD.height;
  }

  function isRoad(x, y) {
    if (isWater(x, y)) return false;
    const column = x % WORLD.pitch;
    const row = y % WORLD.pitch;
    return column < WORLD.road || row < WORLD.road;
  }

  function nearbyBuildings(x, y) {
    const column = Math.floor(x / WORLD.pitch);
    const row = Math.floor(y / WORLD.pitch);
    const found = [];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const bucket = buildingGrid.get(`${column + dx},${row + dy}`);
        if (bucket !== undefined) found.push(...bucket);
      }
    }
    return found;
  }

  function blockedAt(x, y, radius) {
    if (isWater(x, y) || x > WORLD.width - radius || y > WORLD.height - radius) return true;
    const list = nearbyBuildings(x, y);
    for (let index = 0; index < list.length; index += 1) {
      const box = list[index];
      const nearX = Math.max(box.x, Math.min(x, box.x + box.w));
      const nearY = Math.max(box.y, Math.min(y, box.y + box.h));
      const dx = x - nearX;
      const dy = y - nearY;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
    return false;
  }

  function slideMove(x, y, dx, dy, radius) {
    let hit = false;
    let nextX = x + dx;
    if (blockedAt(nextX, y, radius)) {
      nextX = x;
      hit = true;
    }
    let nextY = y + dy;
    if (blockedAt(nextX, nextY, radius)) {
      nextY = y;
      hit = true;
    }
    return { x: nextX, y: nextY, hit };
  }

  function nearestRoad(x, y) {
    const column = Math.round(x / WORLD.pitch);
    const row = Math.round(y / WORLD.pitch);
    const horizontal = roadPoint(column, Math.floor(y / WORLD.pitch));
    const vertical = roadPoint(Math.floor(x / WORLD.pitch), row);
    const distanceHorizontal = Math.abs(y - horizontal.y);
    const distanceVertical = Math.abs(x - vertical.x);
    return distanceHorizontal < distanceVertical
      ? { x: Math.max(WORLD.coast + WORLD.road, x), y: horizontal.y, vertical: false }
      : { x: vertical.x, y: Math.max(WORLD.coast + WORLD.road, y), vertical: true };
  }

  function findLandmark(name) {
    return landmarks[name] ?? roadPoint(2, 3);
  }

  return {
    columns,
    rows,
    buildings,
    palms,
    parked,
    landmarks,
    roadPoint,
    lotPoint,
    isWater,
    isRoad,
    blockedAt,
    slideMove,
    nearestRoad,
    findLandmark,
    nearbyBuildings,
    carRadius: CAR.width * 0.62,
  };
}
