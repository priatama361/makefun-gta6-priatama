// Canvas painting for Solana Bay: sun-washed streets and pastel rooftops,
// then a deliberately large, high-contrast HUD that still reads when the
// screenshot is shown at thumbnail size.

import { CITY, CITY_HEIGHT, CITY_WIDTH, FIELD, FONT, PALETTE, WEAPONS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function rounded(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function star(ctx, x, y, outer, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : outer * 0.46;
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? PALETTE.money : 'rgba(255,255,255,0.42)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(22,35,46,0.85)';
  ctx.lineWidth = 2.4;
  ctx.stroke();
}

function money(value) {
  return `$${Math.floor(value).toLocaleString('en-US')}`;
}

function clock(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas, world) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, dpr: 1 };

  function panel(x, y, w, h, fill = PALETTE.panel, stroke = 'rgba(255,255,255,0.16)') {
    rounded(ctx, x, y, w, h, 12);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function text(value, x, y, size, color, align = 'left', weight = 'normal', halo = true) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    if (halo) {
      ctx.strokeStyle = 'rgba(16,28,36,0.88)';
      ctx.lineWidth = Math.max(2, size * 0.16);
      ctx.lineJoin = 'round';
      ctx.strokeText(value, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    view.dpr = dpr;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * view.dpr - view.x) / view.scale,
      y: ((clientY - rect.top) * view.dpr - view.y) / view.scale,
    };
  }

  function toWorld(clientX, clientY, state) {
    const point = toField(clientX, clientY);
    return {
      x: point.x + state.camera.x - FIELD.width / 2,
      y: point.y + state.camera.y - FIELD.height / 2,
    };
  }

  function clampInt(value, low, high) {
    return value < low ? low : value > high ? high : value;
  }

  function drawGround(state, left, top, right, bottom) {
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(left, top, right - left, bottom - top);

    const sandStart = CITY.beachCol * CITY.cell - CITY.road / 2;
    const waterStart = (CITY.beachCol + 1) * CITY.cell - CITY.road / 2;
    if (right > sandStart) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(Math.max(left, sandStart), top, Math.max(0, Math.min(right, waterStart) - Math.max(left, sandStart)), bottom - top);
      ctx.fillStyle = 'rgba(210,170,110,0.30)';
      for (let y = Math.floor(top / 70) * 70; y < bottom; y += 70) {
        for (let x = Math.max(left, sandStart) + ((y / 70) % 2) * 30; x < Math.min(right, waterStart); x += 90) {
          ctx.beginPath();
          ctx.ellipse(x, y, 18, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(Math.max(left, waterStart), top, Math.max(0, right - Math.max(left, waterStart)), bottom - top);
      ctx.fillStyle = PALETTE.waterDeep;
      for (let y = Math.floor(top / 88) * 88; y < bottom; y += 88) {
        ctx.fillRect(Math.max(left, waterStart), y, Math.max(0, right - Math.max(left, waterStart)), 30);
      }
      ctx.strokeStyle = 'rgba(234,251,255,0.72)';
      ctx.lineWidth = 3;
      for (let y = Math.floor(top / 48) * 48; y < bottom; y += 48) {
        ctx.beginPath();
        for (let x = Math.max(left, waterStart); x < right; x += 12) {
          const wave = y + Math.sin(x * 0.032 + state.elapsed * 1.5 + y) * 4;
          if (x === Math.max(left, waterStart)) ctx.moveTo(x, wave);
          else ctx.lineTo(x, wave);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = PALETTE.foam;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(waterStart, top);
      ctx.lineTo(waterStart, bottom);
      ctx.stroke();
      const pier = world.city.pier;
      if (right > pier.x && left < pier.x + pier.w && bottom > pier.y && top < pier.y + pier.h) {
        ctx.fillStyle = 'rgba(70,52,38,0.35)';
        ctx.fillRect(pier.x + 6, pier.y + 9, pier.w, pier.h);
        ctx.fillStyle = '#c89763';
        ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
        ctx.strokeStyle = 'rgba(255,240,205,0.45)';
        ctx.lineWidth = 2;
        for (let x = pier.x + 10; x < pier.x + pier.w; x += 22) {
          ctx.beginPath();
          ctx.moveTo(x, pier.y);
          ctx.lineTo(x, pier.y + pier.h);
          ctx.stroke();
        }
        ctx.fillStyle = '#fff6d8';
        ctx.fillRect(pier.x + pier.w - 16, pier.y - 8, 10, pier.h + 16);
      }
    }

    const firstI = clampInt(Math.floor(left / CITY.cell) - 1, 0, CITY.cols - 1);
    const lastI = clampInt(Math.floor(right / CITY.cell) + 1, 0, CITY.cols - 1);
    const firstJ = clampInt(Math.floor(top / CITY.cell) - 1, 0, CITY.rows - 1);
    const lastJ = clampInt(Math.floor(bottom / CITY.cell) + 1, 0, CITY.rows - 1);
    const inset = CITY.road / 2 - 8;

    for (let i = firstI; i <= lastI; i += 1) {
      for (let j = firstJ; j <= lastJ; j += 1) {
        const style = world.city.blockStyles[j * CITY.cols + i];
        if (style === 'water' || style === 'arena') continue;
        const bx = i * CITY.cell + inset;
        const by = j * CITY.cell + inset;
        const size = CITY.cell - inset * 2;
        if (style === 'sand') continue;
        ctx.fillStyle = style === 'park' ? '#e9e0bf' : PALETTE.sidewalk;
        ctx.fillRect(bx, by, size, size);
        ctx.strokeStyle = 'rgba(180,150,110,0.35)';
        ctx.lineWidth = 3;
        ctx.strokeRect(bx + 1.5, by + 1.5, size - 3, size - 3);
        if (style === 'park') {
          ctx.fillStyle = PALETTE.park;
          rounded(ctx, bx + 8, by + 8, size - 16, size - 16, 10);
          ctx.fill();
          ctx.strokeStyle = PALETTE.parkPath;
          ctx.lineWidth = 13;
          ctx.beginPath();
          ctx.moveTo(bx + 8, by + size / 2);
          ctx.lineTo(bx + size - 8, by + size / 2);
          ctx.moveTo(bx + size / 2, by + 8);
          ctx.lineTo(bx + size / 2, by + size - 8);
          ctx.stroke();
        }
      }
    }

    ctx.strokeStyle = 'rgba(255,253,240,0.62)';
    ctx.lineWidth = 3;
    ctx.setLineDash([24, 28]);
    for (let j = firstJ; j <= lastJ; j += 1) {
      const y = j * CITY.cell;
      if (y < sandStart) {
        ctx.beginPath();
        ctx.moveTo(Math.max(left, 0), y);
        ctx.lineTo(Math.min(right, sandStart), y);
        ctx.stroke();
      }
    }
    for (let i = firstI; i <= lastI; i += 1) {
      if (i > CITY.beachCol) continue;
      const x = i * CITY.cell;
      ctx.beginPath();
      ctx.moveTo(x, Math.max(top, 0));
      ctx.lineTo(x, Math.min(bottom, CITY_HEIGHT));
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.fillStyle = PALETTE.crosswalk;
    ctx.globalAlpha = 0.78;
    for (let i = firstI; i <= lastI; i += 1) {
      if (i > CITY.beachCol) continue;
      for (let j = firstJ; j <= lastJ; j += 1) {
        const x = i * CITY.cell;
        const y = j * CITY.cell;
        if (x > sandStart) continue;
        for (let k = 0; k < 4; k += 1) {
          ctx.fillRect(x - CITY.road / 2 + 8 + k * 23, y - CITY.road / 2 - 8, 13, 9);
          ctx.fillRect(x - CITY.road / 2 + 8 + k * 23, y + CITY.road / 2 - 1, 13, 9);
          ctx.fillRect(x - CITY.road / 2 - 8, y - CITY.road / 2 + 8 + k * 23, 9, 13);
          ctx.fillRect(x + CITY.road / 2 - 1, y - CITY.road / 2 + 8 + k * 23, 9, 13);
        }
      }
    }
    ctx.globalAlpha = 1;
    if (right > 2200 && left < 3100 && bottom > 1100 && top < 1450) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      text('SUN PLAZA', 2620, 1300, 42, PALETTE.ink, 'center', 'bold', false);
      ctx.restore();
    }
  }

  function drawBuildings(state, left, top, right, bottom) {
    for (const b of world.city.buildings) {
      if (b.x > right + 30 || b.x + b.w < left - 30 || b.y > bottom + 30 || b.y + b.h < top - 30) continue;
      ctx.fillStyle = 'rgba(58,54,42,0.26)';
      rounded(ctx, b.x + 10, b.y + 12, b.w, b.h, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      rounded(ctx, b.x - 3, b.y - 3, b.w + 6, b.h + 6, 9);
      ctx.fill();
      ctx.fillStyle = b.color;
      rounded(ctx, b.x, b.y, b.w, b.h, 7);
      ctx.fill();
      ctx.fillStyle = PALETTE.roof;
      rounded(ctx, b.x + 8, b.y + 8, b.w - 16, b.h - 16, 5);
      ctx.fill();

      if (b.landmark === 'arena') {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 5;
        rounded(ctx, b.x + 18, b.y + 18, b.w - 36, b.h - 36, 8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(b.x + b.w / 2, b.y + 18);
        ctx.lineTo(b.x + b.w / 2, b.y + b.h - 18);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 34, 0, Math.PI * 2);
        ctx.stroke();
        text('SOLAR ARENA', b.x + b.w / 2, b.y + 46, 16, '#35485a', 'center', 'bold', false);
        continue;
      }
      if (b.landmark === 'lighthouse') {
        ctx.fillStyle = '#fff8e8';
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.copRed;
        ctx.fillRect(b.x + b.w / 2 - 24, b.y + b.h / 2 - 15, 48, 9);
        ctx.fillRect(b.x + b.w / 2 - 24, b.y + b.h / 2 + 8, 48, 9);
        ctx.fillStyle = PALETTE.windowWarm;
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 10, 0, Math.PI * 2);
        ctx.fill();
        const sweep = state.elapsed * 1.6;
        ctx.save();
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
        ctx.rotate(sweep);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#fff6c0';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(180, -26);
        ctx.lineTo(180, 26);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        continue;
      }

      ctx.strokeStyle = PALETTE.roofLine;
      ctx.lineWidth = 2;
      const stepX = Math.max(20, Math.floor((b.w - 16) / 5));
      for (let x = b.x + 12; x < b.x + b.w - 8; x += stepX) {
        ctx.beginPath();
        ctx.moveTo(x, b.y + 8);
        ctx.lineTo(x, b.y + b.h - 8);
        ctx.stroke();
      }
      for (let y = b.y + 12; y < b.y + b.h - 8; y += stepX) {
        ctx.beginPath();
        ctx.moveTo(b.x + 8, y);
        ctx.lineTo(b.x + b.w - 8, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(92,188,220,0.7)';
      const windowStep = 22;
      for (let x = b.x + 10; x < b.x + b.w - 12; x += windowStep) {
        ctx.fillRect(x, b.y + 3, 10, 5);
        ctx.fillRect(x, b.y + b.h - 8, 10, 5);
      }
      for (let y = b.y + 12; y < b.y + b.h - 12; y += windowStep) {
        ctx.fillRect(b.x + 3, y, 5, 10);
        ctx.fillRect(b.x + b.w - 8, y, 5, 10);
      }

      if (b.top === 'tank') {
        ctx.fillStyle = '#e8ecf0';
        rounded(ctx, b.x + b.w * 0.34, b.y + b.h * 0.34, b.w * 0.32, b.h * 0.28, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(80,96,110,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (b.top === 'sign' && b.w > 72 && b.h > 72) {
        ctx.fillStyle = b.seed % 2 ? '#e94c72' : '#2d9fd0';
        rounded(ctx, b.x + 9, b.y + b.h * 0.36, b.w - 18, 28, 5);
        ctx.fill();
        text(b.sign, b.x + b.w / 2, b.y + b.h * 0.36 + 20, 14, '#fffdf2', 'center', 'bold');
      }
      if (b.shop) {
        const closed = world.city.shops.some((s) => s.cooldown > 0 && Math.abs(s.x - (b.x + b.w / 2)) < 2);
        ctx.fillStyle = closed ? '#9aa1a6' : '#e6535f';
        ctx.fillRect(b.x + 6, b.y + b.h - 11, b.w - 12, 11);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let x = b.x + 10; x < b.x + b.w - 10; x += 18) ctx.fillRect(x, b.y + b.h - 11, 8, 11);
        if (!closed) text('$', b.x + b.w / 2, b.y + b.h - 22, 15, '#c94028', 'center', 'bold');
      }
    }

    for (const tree of world.city.trees) {
      if (tree.x < left - 30 || tree.x > right + 30 || tree.y < top - 30 || tree.y > bottom + 30) continue;
      ctx.fillStyle = 'rgba(52,68,44,0.25)';
      ctx.beginPath();
      ctx.ellipse(tree.x + 6, tree.y + 8, tree.r * 1.1, tree.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      if (tree.palm) {
        ctx.fillStyle = PALETTE.palmTrunk;
        ctx.fillRect(tree.x - 3, tree.y - 4, 6, 15);
        ctx.fillStyle = PALETTE.palmLeaf;
        for (let k = 0; k < 6; k += 1) {
          const angle = k * Math.PI / 3 + tree.r * 0.05;
          ctx.beginPath();
          ctx.ellipse(tree.x + Math.cos(angle) * tree.r * 0.5, tree.y + Math.sin(angle) * tree.r * 0.5, tree.r * 0.72, tree.r * 0.26, angle, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#d9a94e';
        ctx.beginPath();
        ctx.arc(tree.x, tree.y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = PALETTE.tree;
        ctx.beginPath();
        ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.treeLight;
        ctx.beginPath();
        ctx.arc(tree.x - tree.r * 0.22, tree.y - tree.r * 0.26, tree.r * 0.62, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCar(car, state) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const l = car.length;
    const w = car.width;
    ctx.fillStyle = 'rgba(40,44,38,0.32)';
    rounded(ctx, -l / 2 + 6, -w / 2 + 7, l, w, 9);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    rounded(ctx, -l / 2 - 2, -w / 2 - 2, l + 4, w + 4, 10);
    ctx.fill();
    ctx.fillStyle = car.color;
    rounded(ctx, -l / 2, -w / 2, l, w, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    rounded(ctx, -l / 2 + 5, -w / 2 + 4, l - 10, 6, 3);
    ctx.fill();
    ctx.fillStyle = '#263b4c';
    rounded(ctx, -l * 0.17, -w / 2 + 4, l * 0.4, w - 8, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,205,235,0.62)';
    ctx.fillRect(l * 0.03, -w / 2 + 5, l * 0.17, w - 10);
    ctx.fillStyle = '#fff9cc';
    ctx.fillRect(l / 2 - 5, -w / 2 + 4, 5, 9);
    ctx.fillRect(l / 2 - 5, w / 2 - 13, 5, 9);
    ctx.fillStyle = '#e0574d';
    ctx.fillRect(-l / 2, -w / 2 + 4, 4, 9);
    ctx.fillRect(-l / 2, w / 2 - 13, 4, 9);
    if (car.police) {
      ctx.fillStyle = '#f6f8fb';
      ctx.fillRect(-9, -w / 2 - 2, 18, w + 4);
      ctx.fillStyle = '#1d4d93';
      ctx.fillRect(-l * 0.34, -w / 2, l * 0.16, w);
      const pulse = Math.floor(state.elapsed * 7) % 2 === 0;
      const glow = pulse ? PALETTE.copBlue : PALETTE.copRed;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 26;
      ctx.fillStyle = glow;
      ctx.fillRect(-8, -w / 2 - 4, 8, 8);
      ctx.fillStyle = pulse ? PALETTE.copRed : PALETTE.copBlue;
      ctx.fillRect(0, -w / 2 - 4, 8, 8);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    if (car.hp < 60) {
      ctx.fillStyle = 'rgba(72,76,74,0.45)';
      ctx.beginPath();
      ctx.arc(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 10 + Math.sin(state.elapsed * 8 + car.x) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPed(ped) {
    ctx.fillStyle = 'rgba(40,46,38,0.28)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 4, ped.y + 6, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.cop ? PALETTE.cop : ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c9a0';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 3, 5.5, 0, Math.PI * 2);
    ctx.fill();
    if (ped.cop) {
      ctx.fillStyle = '#17366e';
      ctx.fillRect(ped.x - 6, ped.y - 10, 12, 4);
      ctx.fillStyle = PALETTE.copBlue;
      ctx.fillRect(ped.x + 5, ped.y - 2, 4, 4);
    }
  }

  function drawPlayer(state) {
    if (!state.player.onFoot || state.player.car) return;
    const p = state.player;
    ctx.fillStyle = 'rgba(40,46,38,0.32)';
    ctx.beginPath();
    ctx.ellipse(p.x + 5, p.y + 8, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.strokeStyle = '#fffdf2';
    ctx.lineWidth = 3;
    rounded(ctx, -13, -11, 26, 22, 8);
    ctx.stroke();
    ctx.fillStyle = PALETTE.playerDark;
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    rounded(ctx, -9, -9, 18, 18, 6);
    ctx.fill();
    ctx.fillStyle = '#f2c8a1';
    ctx.beginPath();
    ctx.arc(1, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#28313a';
    ctx.beginPath();
    ctx.arc(-1, -1, 6.4, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#26313d';
    ctx.fillRect(8, -2.5, 22, 5);
    ctx.fillStyle = '#dfe9f2';
    ctx.fillRect(8, -5, 10, 10);
    ctx.restore();
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      const bob = Math.sin(pickup.bob) * 3;
      ctx.fillStyle = 'rgba(40,46,38,0.3)';
      ctx.beginPath();
      ctx.ellipse(pickup.x + 3, pickup.y + 8, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(pickup.x, pickup.y + bob);
      if (pickup.type === 'cash') {
        ctx.shadowColor = PALETTE.money;
        ctx.shadowBlur = 16;
        ctx.fillStyle = PALETTE.money;
        rounded(ctx, -12, -9, 24, 18, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#8a6416';
        ctx.fillRect(-9, -3, 18, 3);
        ctx.fillStyle = '#fff3c2';
        ctx.fillRect(-2, -6, 4, 12);
      } else {
        ctx.shadowColor = pickup.type === 'health' ? PALETTE.health : PALETTE.armor;
        ctx.shadowBlur = 14;
        ctx.fillStyle = pickup.type === 'health' ? PALETTE.health : PALETTE.armor;
        rounded(ctx, -11, -11, 22, 22, 5);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fffdf2';
        ctx.fillRect(-2, -7, 4, 14);
        ctx.fillRect(-7, -2, 14, 4);
      }
      ctx.restore();
    }
  }

  function drawMarkers(state) {
    const job = state.mission;
    if (!job) return;
    const pulse = 0.5 + 0.5 * Math.sin(state.elapsed * 4.5);
    const radius = 32 + pulse * 10;
    ctx.save();
    ctx.translate(job.x, job.y);
    ctx.strokeStyle = PALETTE.money;
    ctx.lineWidth = 5;
    ctx.globalAlpha = 0.65 + pulse * 0.35;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,62,0.24)';
    ctx.beginPath();
    ctx.arc(0, 0, radius - 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.money;
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(19, 0);
    ctx.lineTo(0, 21);
    ctx.lineTo(-19, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    if (job.hold > 0) {
      ctx.fillStyle = 'rgba(16,30,44,0.85)';
      rounded(ctx, job.x - 64, job.y + radius + 12, 128, 14, 5);
      ctx.fill();
      ctx.fillStyle = PALETTE.money;
      ctx.fillRect(job.x - 61, job.y + radius + 15, 122 * Math.min(1, job.hold / 1.6), 8);
    }
  }

  function drawParticles(state) {
    for (const part of state.particles) {
      const alpha = Math.max(0, part.life / part.max);
      ctx.globalAlpha = part.kind === 'smoke' ? alpha * 0.55 : alpha;
      ctx.fillStyle = part.color;
      if (part.kind === 'spark') {
        ctx.strokeStyle = part.color;
        ctx.lineWidth = Math.max(1.5, part.size * 0.6);
        ctx.beginPath();
        ctx.moveTo(part.x, part.y);
        ctx.lineTo(part.x - part.vx * 0.028, part.y - part.vy * 0.028);
        ctx.stroke();
      } else if (part.kind === 'flash') {
        ctx.save();
        ctx.translate(part.x, part.y);
        ctx.rotate(part.angle ?? 0);
        ctx.beginPath();
        ctx.moveTo(part.size, 0);
        ctx.lineTo(0, part.size * 0.42);
        ctx.lineTo(-part.size * 0.4, 0);
        ctx.lineTo(0, -part.size * 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawBullets(state) {
    for (const shot of state.bullets) {
      ctx.strokeStyle = shot.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = shot.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(shot.x, shot.y);
      ctx.lineTo(shot.x - shot.vx * 0.024, shot.y - shot.vy * 0.024);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  function drawLighting(state) {
    const warmth = 0.5 + 0.5 * Math.sin(state.timeOfDay * Math.PI * 2);
    ctx.fillStyle = `rgba(255,199,112,${0.04 + warmth * 0.055})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const sun = ctx.createRadialGradient(FIELD.width * 0.82, FIELD.height * 0.12, 40, FIELD.width * 0.82, FIELD.height * 0.12, FIELD.width * 0.8);
    sun.addColorStop(0, 'rgba(255,246,196,0.30)');
    sun.addColorStop(1, 'rgba(255,246,196,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const vignette = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.34, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.9);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(18,38,50,0.16)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawWorld(state) {
    const cam = state.camera;
    const shakeX = cam.shake > 0 ? Math.sin(state.elapsed * 91) * cam.shake : 0;
    const shakeY = cam.shake > 0 ? Math.cos(state.elapsed * 113) * cam.shake : 0;
    ctx.save();
    ctx.translate(FIELD.width / 2 - cam.x + shakeX, FIELD.height / 2 - cam.y + shakeY);
    const left = cam.x - FIELD.width / 2 - 120;
    const top = cam.y - FIELD.height / 2 - 120;
    const right = cam.x + FIELD.width / 2 + 120;
    const bottom = cam.y + FIELD.height / 2 + 120;
    drawGround(state, left, top, right, bottom);
    drawBuildings(state, left, top, right, bottom);
    drawMarkers(state);
    drawPickups(state);
    drawParticles(state);
    for (const ped of state.peds) drawPed(ped);
    for (const car of state.traffic) drawCar(car, state);
    for (const car of state.cops) drawCar(car, state);
    drawPlayer(state);
    drawBullets(state);
    ctx.restore();
    drawLighting(state);
  }

  function bar(x, y, width, height, ratio, color, label) {
    panel(x, y, width, height, 'rgba(16,30,44,0.82)', 'rgba(255,255,255,0.22)');
    ctx.fillStyle = color;
    if (ratio > 0) {
      rounded(ctx, x + 3, y + 3, Math.max(5, (width - 6) * ratio), height - 6, 5);
      ctx.fill();
    }
    text(`${label} ${Math.max(0, Math.ceil(ratio * 100))}`, x + 2, y - 8, 13, PALETTE.text, 'left', 'bold');
  }

  function drawMinimap(state) {
    const x = FIELD.width - 248;
    const y = 16;
    const w = 230;
    const h = 166;
    const scale = 0.052;
    const focus = state.player.onFoot || !state.player.car ? state.player : state.player.car;
    panel(x, y, w, h + 24, 'rgba(16,30,44,0.90)', 'rgba(255,255,255,0.26)');
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 4, y + 25, w - 8, h - 8);
    ctx.clip();
    ctx.translate(x + w / 2, y + 25 + (h - 8) / 2);
    ctx.scale(scale, scale);
    ctx.translate(-focus.x, -focus.y);
    ctx.fillStyle = '#cfc9b9';
    ctx.fillRect(focus.x - w / scale, focus.y - h / scale, w * 2 / scale, h * 2 / scale);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(CITY.beachCol * CITY.cell - CITY.road / 2, 0, CITY.cell * 2, CITY_HEIGHT);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect((CITY.beachCol + 1) * CITY.cell - CITY.road / 2, 0, CITY_WIDTH, CITY_HEIGHT);
    ctx.strokeStyle = '#fffdf0';
    ctx.lineWidth = 34;
    for (let i = 0; i <= CITY.beachCol; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * CITY.cell, 0);
      ctx.lineTo(i * CITY.cell, CITY_HEIGHT);
      ctx.stroke();
    }
    for (let j = 0; j <= CITY.rows; j += 1) {
      ctx.beginPath();
      ctx.moveTo(0, j * CITY.cell);
      ctx.lineTo(CITY_WIDTH, j * CITY.cell);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(82,106,104,0.35)';
    for (const b of world.city.buildings) {
      if (b.landmark === 'arena') continue;
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    if (state.mission) {
      ctx.fillStyle = PALETTE.money;
      ctx.beginPath();
      ctx.arc(state.mission.x, state.mission.y, 120, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cops) {
      ctx.fillStyle = PALETTE.copRed;
      ctx.fillRect(car.x - 58, car.y - 36, 116, 72);
    }
    ctx.fillStyle = PALETTE.player;
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(focus.x, focus.y, 96, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    text(world.city.districtAt(focus.x, focus.y), x + 12, y + 18, 13, PALETTE.muted, 'left', 'bold', false);
    text('MAP', x + w - 12, y + 18, 13, PALETTE.money, 'right', 'bold', false);
  }

  function drawWanted(state) {
    const stars = state.player.wanted;
    const startX = FIELD.width - 226;
    const y = 232;
    text('WANTED', startX - 6, y - 22, 12, PALETTE.muted, 'left', 'bold');
    for (let i = 0; i < 5; i += 1) star(ctx, startX + i * 34, y, 14, i < stars);
  }

  function drawStoryCard(state) {
    const card = state.storyCard;
    if (!card) return;
    panel(22, 152, 350, 126, 'rgba(18,36,48,0.92)', 'rgba(255,210,62,0.65)');
    ctx.fillStyle = PALETTE.money;
    ctx.fillRect(22, 152, 6, 126);
    text('STORY UPDATE', 42, 178, 13, PALETTE.money, 'left', 'bold');
    text(card.title, 42, 206, 20, PALETTE.text, 'left', 'bold');
    text(card.contact, 42, 230, 14, '#7fe3d4', 'left', 'bold');
    text(`+${money(card.reward)}   +${card.rep} REP   ${card.rank}`, 42, 260, 14, PALETTE.text, 'left', 'bold');
  }

  function drawHud(state) {
    const p = state.player;
    panel(18, 16, 318, 116);
    text(money(p.money), 34, 62, 34, PALETTE.money, 'left', 'bold');
    text(state.rank.name, 34, 88, 15, PALETTE.text, 'left', 'bold');
    text(`REP ${Math.floor(state.progress.rep).toLocaleString('en-US')}  ·  NEXT ${state.rank.next}`, 34, 110, 11, PALETTE.muted, 'left', 'bold', false);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(34, 118, 282, 5);
    ctx.fillStyle = PALETTE.money;
    ctx.fillRect(34, 118, 282 * state.rank.progress, 5);

    const job = state.mission;
    if (job) {
      panel(FIELD.width / 2 - 268, 16, 536, 100);
      text(`${job.contact}  ·  ${job.def.title}`, FIELD.width / 2, 40, 13, '#7fe3d4', 'center', 'bold');
      text(job.label, FIELD.width / 2, 68, 19, PALETTE.text, 'center', 'bold');
      const focus = p.onFoot || !p.car ? p : p.car;
      const dx = job.x - focus.x;
      const dy = job.y - focus.y;
      const dist = Math.round(Math.hypot(dx, dy) / 10);
      text(`${dist} M${job.timer > 0 ? `   ·   ${clock(job.timer)}` : ''}`, FIELD.width / 2, 94, 13, PALETTE.money, 'center', 'bold');
      const ax = FIELD.width / 2 + dx;
      const ay = FIELD.height / 2 + dy;
      if (ax < 80 || ax > FIELD.width - 80 || ay < 140 || ay > FIELD.height - 90) {
        const angle = Math.atan2(dy, dx);
        const magnitude = Math.min(
          (FIELD.width / 2 - 80) / Math.max(0.001, Math.abs(Math.cos(angle))),
          (FIELD.height / 2 - 100) / Math.max(0.001, Math.abs(Math.sin(angle))),
        );
        ctx.save();
        ctx.translate(FIELD.width / 2 + Math.cos(angle) * magnitude, FIELD.height / 2 + Math.sin(angle) * magnitude);
        ctx.rotate(angle);
        ctx.fillStyle = PALETTE.money;
        ctx.shadowColor = PALETTE.money;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(24, 0);
        ctx.lineTo(-13, -14);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-13, 14);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    drawMinimap(state);
    drawWanted(state);
    bar(20, FIELD.height - 78, 224, 24, p.health / 100, PALETTE.health, 'HEALTH');
    bar(20, FIELD.height - 40, 224, 24, p.armor / 100, PALETTE.armor, 'ARMOR');

    if (!p.onFoot && p.car) {
      const speed = Math.round(Math.abs(p.car.speed) * 0.42);
      panel(FIELD.width - 216, FIELD.height - 96, 198, 78);
      text(String(speed).padStart(3, '0'), FIELD.width - 32, FIELD.height - 40, 44, PALETTE.text, 'right', 'bold');
      text(`${p.car.name}  MPH`, FIELD.width - 32, FIELD.height - 22, 13, PALETTE.muted, 'right', 'bold', false);
      ctx.save();
      ctx.translate(FIELD.width - 156, FIELD.height - 59);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 27, Math.PI * 0.75, Math.PI * 2.25);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(0, 0, 27, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * Math.min(1, speed / 180));
      ctx.stroke();
      ctx.restore();
    } else {
      panel(FIELD.width - 216, FIELD.height - 96, 198, 78);
      const weapon = WEAPONS[p.weapon];
      text(p.reload > 0 ? 'RELOADING' : weapon.name, FIELD.width - 32, FIELD.height - 60, 16, p.reload > 0 ? PALETTE.orange : PALETTE.text, 'right', 'bold');
      text(`${String(p.ammo[p.weapon]).padStart(2, '0')} / ${p.reserve[p.weapon]}`, FIELD.width - 32, FIELD.height - 28, 34, PALETTE.text, 'right', 'bold');
    }

    panel(FIELD.width / 2 - 188, FIELD.height - 42, 376, 30, 'rgba(16,30,44,0.72)');
    for (let i = 0; i < 5; i += 1) {
      const height = 8 + Math.abs(Math.sin(state.elapsed * 5 + i * 1.3)) * 12;
      ctx.fillStyle = i % 2 ? PALETTE.player : PALETTE.copBlue;
      ctx.fillRect(FIELD.width / 2 - 172 + i * 11, FIELD.height - 31 - height / 2, 5, height);
    }
    text(`${state.radio.station}  ·  ${state.radio.song}`, FIELD.width / 2 + 18, FIELD.height - 21, 12, PALETTE.muted, 'center', 'bold', false);
    text('WASD MOVE  ·  E ENTER  ·  MOUSE FIRE  ·  Q WEAPON  ·  R RELOAD  ·  P PAUSE', FIELD.width / 2, FIELD.height - 52, 11, 'rgba(255,253,242,0.88)', 'center', 'bold');

    drawStoryCard(state);

    if (state.toast.timer > 0) {
      ctx.globalAlpha = Math.min(1, state.toast.timer / 0.5);
      panel(FIELD.width / 2 - 236, 132, 472, 42, 'rgba(16,30,44,0.92)', 'rgba(255,255,255,0.24)');
      ctx.fillStyle = state.toast.color;
      ctx.fillRect(FIELD.width / 2 - 236, 132, 6, 42);
      text(state.toast.text, FIELD.width / 2, 160, 19, state.toast.color, 'center', 'bold');
      ctx.globalAlpha = 1;
    }
  }

  function overlay(title, subtitle, lines, prompt, accent) {
    ctx.fillStyle = 'rgba(14,28,38,0.42)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const width = 700;
    const height = 250 + lines.length * 34;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2 - 8;
    panel(x, y, width, height, 'rgba(18,36,48,0.95)', accent);
    ctx.fillStyle = accent;
    ctx.fillRect(x + 24, y + 22, 90, 5);
    text(title, FIELD.width / 2, y + 98, 58, accent, 'center', 'bold');
    text(subtitle, FIELD.width / 2, y + 132, 17, PALETTE.muted, 'center', 'bold');
    for (let i = 0; i < lines.length; i += 1) text(lines[i], FIELD.width / 2, y + 180 + i * 34, 17, PALETTE.text, 'center');
    text(prompt, FIELD.width / 2, y + height - 34, 22, PALETTE.money, 'center', 'bold');
  }

  function draw(state, screen, best) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawWorld(state);
    if (screen === SCREEN_TITLE) {
      overlay(
        'SOLANA BAY',
        'SUNNY SIDE UP  ·  AN OPEN-WORLD STORY',
        [
          'You are MARA "SUNNY" VEGA, back on the Sun Coast with one last debt.',
          'Work for Tito Alvarez, Dana Kestrel and Vivian Cross. Take the city.',
          'WASD move / drive    SHIFT sprint    E steal a car    MOUSE aim & fire',
          'Q swap weapon    R reload    P pause    M mute    N new story on title',
          `BEST HAUL  ${money(best)}    PROGRESS  ${state.progress.completed} / 6 JOBS`,
        ],
        'PRESS SPACE OR CLICK TO START',
        PALETTE.money,
      );
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', 'THE SUN CAN WAIT', [
        'WASD / ARROWS move and drive    SHIFT sprint    E enter or exit a car',
        'MOUSE fire    Q weapon    R reload    M mute    N new story on title',
      ], 'PRESS P OR SPACE TO RESUME', PALETTE.money);
    } else if (screen === SCREEN_OVER) {
      const s = state.stats;
      overlay('BUSTED', 'THE STREETS CAUGHT UP', [
        `Mission  ${state.mission.def.title}        Cash  ${money(state.player.money)}`,
        `Jobs done  ${s.jobs}        Total earned  ${money(s.earned)}`,
        `Best haul  ${money(Math.max(best, s.earned))}        Rank  ${state.rank.name}`,
      ], 'PRESS SPACE OR CLICK TO KEEP GOING', PALETTE.copRed);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField, toWorld, resize };
}
