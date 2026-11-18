import { CITY, CITY_HEIGHT, CITY_WIDTH, FIELD, FONT, LIMITS, PALETTE, WEAPONS } from './config.js';

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
    const radius = i % 2 === 0 ? outer : outer * 0.44;
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? PALETTE.money : 'rgba(255,255,255,0.13)';
  ctx.fill();
  if (filled) {
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function money(value) {
  return `$${Math.floor(value).toLocaleString('en-US')}`;
}

function clock(seconds) {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas, world) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, dpr: 1 };
  const fonts = new Set();

  function font(size, weight = 'normal') {
    const key = `${weight} ${size}`;
    if (!fonts.has(key)) {
      fonts.add(key);
    }
    ctx.font = `${weight} ${size}px ${FONT}`;
  }

  function text(value, x, y, size, color, align = 'left', weight = 'normal') {
    font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
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

  function drawGround(state, left, top, right, bottom) {
    ctx.fillStyle = PALETTE.asphalt;
    ctx.fillRect(left, top, right - left, bottom - top);

    const waterStart = (CITY.beachCol + 1) * CITY.cell - CITY.road / 2;
    const sandStart = CITY.beachCol * CITY.cell - CITY.road / 2;
    if (right > sandStart) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(Math.max(left, sandStart), top, Math.min(right, waterStart) - Math.max(left, sandStart), bottom - top);
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(Math.max(left, waterStart), top, right - Math.max(left, waterStart), bottom - top);
      ctx.strokeStyle = 'rgba(255,255,255,0.13)';
      ctx.lineWidth = 3;
      for (let y = Math.floor(top / 46) * 46; y < bottom; y += 46) {
        ctx.beginPath();
        for (let x = Math.max(left, waterStart); x < right; x += 12) {
          const wave = y + Math.sin(x * 0.035 + state.elapsed * 1.4 + y) * 4;
          if (x === Math.max(left, waterStart)) ctx.moveTo(x, wave);
          else ctx.lineTo(x, wave);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(waterStart, top);
      ctx.lineTo(waterStart, bottom);
      ctx.stroke();
    }

    const firstI = clampInt(Math.floor(left / CITY.cell) - 1, 0, CITY.cols - 1);
    const lastI = clampInt(Math.floor(right / CITY.cell) + 1, 0, CITY.cols - 1);
    const firstJ = clampInt(Math.floor(top / CITY.cell) - 1, 0, CITY.rows - 1);
    const lastJ = clampInt(Math.floor(bottom / CITY.cell) + 1, 0, CITY.rows - 1);
    const inset = CITY.road / 2 - 8;

    for (let i = firstI; i <= lastI; i += 1) {
      for (let j = firstJ; j <= lastJ; j += 1) {
        const style = world.blockStyles[j * CITY.cols + i];
        if (style === 'water') continue;
        const bx = i * CITY.cell + inset;
        const by = j * CITY.cell + inset;
        const size = CITY.cell - inset * 2;
        if (style === 'sand') continue;
        ctx.fillStyle = PALETTE.sidewalk;
        ctx.fillRect(bx, by, size, size);
        if (style === 'park') {
          ctx.fillStyle = PALETTE.park;
          ctx.fillRect(bx + 6, by + 6, size - 12, size - 12);
          ctx.strokeStyle = 'rgba(230,220,180,0.25)';
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(bx + 6, by + size / 2);
          ctx.lineTo(bx + size - 6, by + size / 2);
          ctx.moveTo(bx + size / 2, by + 6);
          ctx.lineTo(bx + size / 2, by + size - 6);
          ctx.stroke();
        }
      }
    }

    ctx.strokeStyle = 'rgba(220,230,245,0.34)';
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 26]);
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
    ctx.globalAlpha = 0.5;
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
  }

  function drawBuildings(state, left, top, right, bottom) {
    for (const b of world.buildings) {
      if (b.x > right + 30 || b.x + b.w < left - 30 || b.y > bottom + 30 || b.y + b.h < top - 30) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.36)';
      ctx.fillRect(b.x + 9, b.y + 11, b.w, b.h);
      ctx.fillStyle = '#151a25';
      ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      ctx.fillStyle = PALETTE.roof;
      ctx.fillRect(b.x + 12, b.y + 12, b.w - 24, b.h - 24);

      const stepX = Math.max(16, Math.floor((b.w - 20) / 6));
      const stepY = Math.max(16, Math.floor((b.h - 20) / 6));
      for (let x = b.x + 10; x < b.x + b.w - 10; x += stepX) {
        for (let y = b.y + 10; y < b.y + b.h - 10; y += stepY) {
          const hash = (b.seed + x * 7 + y * 13) % 11;
          const lit = hash < 4 && b.floors > 2;
          ctx.fillStyle = lit ? PALETTE.window : PALETTE.windowDark;
          ctx.globalAlpha = lit ? 0.55 + 0.45 * Math.sin(state.elapsed * 0.6 + hash) : 0.35;
          ctx.fillRect(x, y, Math.min(9, stepX - 5), Math.min(6, stepY - 6));
        }
      }
      ctx.globalAlpha = 1;

      if (b.top === 'tank') {
        ctx.fillStyle = '#778294';
        rounded(ctx, b.x + b.w * 0.32, b.y + b.h * 0.36, b.w * 0.34, b.h * 0.26, 5);
        ctx.fill();
      } else if (b.top === 'sign' && b.w > 70 && b.h > 70) {
        ctx.fillStyle = 'rgba(8,12,20,0.75)';
        ctx.fillRect(b.x + 10, b.y + b.h * 0.38, b.w - 20, 26);
        text(b.sign, b.x + b.w / 2, b.y + b.h * 0.38 + 19, 15, b.seed % 2 ? '#ff8ea5' : '#6fe3ff', 'center', 'bold');
      }
      if (b.shop) {
        ctx.fillStyle = '#d94f6a';
        ctx.fillRect(b.x + 6, b.y + b.h - 12, b.w - 12, 12);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        for (let x = b.x + 10; x < b.x + b.w - 10; x += 18) ctx.fillRect(x, b.y + b.h - 12, 8, 12);
      }
    }

    for (const tree of world.trees) {
      if (tree.x < left - 30 || tree.x > right + 30 || tree.y < top - 30 || tree.y > bottom + 30) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(tree.x + 5, tree.y + 6, tree.r, 0, Math.PI * 2);
      ctx.fill();
      if (tree.palm) {
        ctx.fillStyle = '#8b6b43';
        ctx.fillRect(tree.x - 3, tree.y - 4, 6, 13);
        ctx.fillStyle = PALETTE.treeLight;
        for (let k = 0; k < 5; k += 1) {
          const angle = k * Math.PI * 2 / 5 + tree.r;
          ctx.beginPath();
          ctx.ellipse(tree.x + Math.cos(angle) * tree.r * 0.5, tree.y + Math.sin(angle) * tree.r * 0.5, tree.r * 0.7, tree.r * 0.24, angle, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = PALETTE.tree;
        ctx.beginPath();
        ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.treeLight;
        ctx.beginPath();
        ctx.arc(tree.x - tree.r * 0.2, tree.y - tree.r * 0.25, tree.r * 0.6, 0, Math.PI * 2);
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
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    rounded(ctx, -l / 2 + 5, -w / 2 + 6, l, w, 9);
    ctx.fill();
    ctx.fillStyle = car.color;
    rounded(ctx, -l / 2, -w / 2, l, w, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    rounded(ctx, -l / 2 + 5, -w / 2 + 4, l - 10, 5, 3);
    ctx.fill();
    ctx.fillStyle = '#16202e';
    rounded(ctx, -l * 0.16, -w / 2 + 4, l * 0.38, w - 8, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,190,230,0.35)';
    ctx.fillRect(l * 0.03, -w / 2 + 5, l * 0.16, w - 10);
    ctx.fillStyle = '#fff4c2';
    ctx.fillRect(l / 2 - 4, -w / 2 + 4, 4, 8);
    ctx.fillRect(l / 2 - 4, w / 2 - 12, 4, 8);
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(-l / 2, -w / 2 + 4, 3, 8);
    ctx.fillRect(-l / 2, w / 2 - 12, 3, 8);
    if (car.police) {
      ctx.fillStyle = '#e7edf7';
      ctx.fillRect(-8, -w / 2 - 1, 16, w + 2);
      const glow = car.siren ? PALETTE.copBlue : PALETTE.copRed;
      ctx.fillStyle = glow;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 22;
      ctx.fillRect(-7, -w / 2 - 3, 7, 6);
      ctx.fillStyle = car.siren ? PALETTE.copRed : PALETTE.copBlue;
      ctx.fillRect(0, -w / 2 - 3, 7, 6);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
    if (car.hp < 55) {
      ctx.fillStyle = 'rgba(40,44,54,0.55)';
      ctx.beginPath();
      ctx.arc(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 10 + Math.sin(state.elapsed * 8 + car.x) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPed(ped) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 4, ped.y + 6, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.cop ? '#30559b' : ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.cop ? '#f0d3a5' : '#e4bd9a';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 3, 5, 0, Math.PI * 2);
    ctx.fill();
    if (ped.cop) {
      ctx.fillStyle = '#1a2f5e';
      ctx.fillRect(ped.x - 5, ped.y - 9, 10, 3);
    }
  }

  function drawPlayer(state) {
    if (!state.player.onFoot || state.player.car) return;
    const p = state.player;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(p.x + 5, p.y + 7, 15, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = PALETTE.playerDark;
    rounded(ctx, -12, -10, 24, 20, 7);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    rounded(ctx, -8, -8, 16, 16, 5);
    ctx.fill();
    ctx.fillStyle = '#f3d3ad';
    ctx.beginPath();
    ctx.arc(1, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d2533';
    ctx.fillRect(8, -2, 22, 4);
    ctx.fillStyle = '#d8e2ef';
    ctx.fillRect(8, -4, 9, 8);
    ctx.restore();
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      const bob = Math.sin(pickup.bob) * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(pickup.x + 3, pickup.y + 8, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(pickup.x, pickup.y + bob);
      ctx.fillStyle = PALETTE.money;
      ctx.shadowColor = PALETTE.money;
      ctx.shadowBlur = 14;
      rounded(ctx, -11, -8, 22, 16, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#8c6410';
      ctx.fillRect(-8, -3, 16, 3);
      ctx.fillStyle = '#fff2b8';
      ctx.fillRect(-2, -5, 4, 10);
      ctx.restore();
    }
  }

  function drawMarkers(state) {
    const job = state.mission;
    if (!job) return;
    const pulse = 0.5 + 0.5 * Math.sin(state.elapsed * 4);
    const radius = 30 + pulse * 10;
    ctx.save();
    ctx.translate(job.x, job.y);
    ctx.strokeStyle = PALETTE.money;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.55 + pulse * 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,87,0.16)';
    ctx.beginPath();
    ctx.arc(0, 0, radius - 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.money;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(18, 0);
    ctx.lineTo(0, 20);
    ctx.lineTo(-18, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    text(job.label, job.x, job.y - radius - 16, 16, PALETTE.text, 'center', 'bold');
    if (job.type === 'robbery' && job.stage === 0 && job.hold > 0) {
      const width = 120;
      ctx.fillStyle = 'rgba(8,12,20,0.8)';
      ctx.fillRect(job.x - width / 2, job.y + radius + 12, width, 12);
      ctx.fillStyle = PALETTE.money;
      ctx.fillRect(job.x - width / 2 + 2, job.y + radius + 14, (width - 4) * Math.min(1, job.hold / 1.6), 8);
    }
  }

  function drawParticles(state) {
    for (const part of state.particles) {
      ctx.globalAlpha = Math.max(0, part.life / part.max);
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBullets(state) {
    for (const shot of state.bullets) {
      ctx.strokeStyle = shot.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = shot.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(shot.x, shot.y);
      ctx.lineTo(shot.x - shot.vx * 0.022, shot.y - shot.vy * 0.022);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  }

  function drawLighting(state) {
    const warmth = Math.sin(state.timeOfDay * Math.PI * 2);
    ctx.fillStyle = warmth > 0 ? `rgba(255,150,80,${0.025 + warmth * 0.045})` : `rgba(40,80,180,${0.04 - warmth * 0.03})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const gradient = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.28, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.82);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawWorld(state) {
    const cam = state.camera;
    const shakeX = cam.shake > 0 ? (Math.sin(state.elapsed * 91) * cam.shake) : 0;
    const shakeY = cam.shake > 0 ? (Math.cos(state.elapsed * 113) * cam.shake) : 0;
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
    ctx.fillStyle = 'rgba(6,10,18,0.78)';
    rounded(ctx, x, y, width, height, 6);
    ctx.fill();
    ctx.fillStyle = color;
    if (ratio > 0) {
      rounded(ctx, x + 3, y + 3, Math.max(4, (width - 6) * ratio), height - 6, 4);
      ctx.fill();
    }
    text(`${label} ${Math.max(0, Math.ceil(ratio * 100))}`, x, y - 7, 13, PALETTE.muted, 'left', 'bold');
  }

  function drawMinimap(state) {
    const x = FIELD.width - 250;
    const y = 20;
    const w = 230;
    const h = 168;
    const scale = 0.052;
    const focus = state.player.onFoot && state.player.car === null ? state.player : state.player.car;
    ctx.fillStyle = 'rgba(6,10,18,0.86)';
    rounded(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,150,190,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 3, y + 3, w - 6, h - 6);
    ctx.clip();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-focus.x, -focus.y);
    ctx.fillStyle = '#1b2431';
    ctx.fillRect(focus.x - w / scale, focus.y - h / scale, w * 2 / scale, h * 2 / scale);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(CITY.beachCol * CITY.cell - CITY.road / 2, 0, CITY.cell * 2, CITY_HEIGHT);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect((CITY.beachCol + 1) * CITY.cell - CITY.road / 2, 0, CITY_WIDTH, CITY_HEIGHT);
    ctx.strokeStyle = 'rgba(210,225,245,0.55)';
    ctx.lineWidth = 38;
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
    ctx.fillStyle = PALETTE.money;
    ctx.beginPath();
    ctx.arc(state.mission.x, state.mission.y, 110, 0, Math.PI * 2);
    ctx.fill();
    for (const car of state.cops) {
      ctx.fillStyle = PALETTE.copRed;
      ctx.fillRect(car.x - 55, car.y - 35, 110, 70);
    }
    ctx.fillStyle = PALETTE.player;
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(focus.x, focus.y, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    text('PALM BAY', x + 12, y + 20, 12, PALETTE.muted, 'left', 'bold');
    text(`${Math.round(focus.x)}, ${Math.round(focus.y)}`, x + w - 12, y + 20, 11, PALETTE.muted, 'right');
  }

  function drawHud(state) {
    const p = state.player;
    text(money(p.money), 26, 52, 36, PALETTE.money, 'left', 'bold');
    text(`EARNED ${money(state.stats.earned)}   JOBS ${state.stats.jobs}`, 27, 74, 13, PALETTE.muted, 'left', 'bold');

    const job = state.mission;
    if (job) {
      const focus = p.onFoot && p.car === null ? p : p.car;
      const dx = job.x - focus.x;
      const dy = job.y - focus.y;
      const dist = Math.round(Math.hypot(dx, dy) / 10);
      text(job.label, FIELD.width / 2, 38, 19, PALETTE.text, 'center', 'bold');
      text(`${dist} M${job.stage === 1 && job.timer > 0 ? `   ${clock(job.timer)}` : ''}`, FIELD.width / 2, 60, 14, PALETTE.money, 'center');
      const ax = FIELD.width / 2 + dx;
      const ay = FIELD.height / 2 + dy;
      if (ax < 70 || ax > FIELD.width - 70 || ay < 80 || ay > FIELD.height - 80) {
        const angle = Math.atan2(dy, dx);
        const magnitude = Math.min(
          (FIELD.width / 2 - 70) / Math.max(0.001, Math.abs(Math.cos(angle))),
          (FIELD.height / 2 - 80) / Math.max(0.001, Math.abs(Math.sin(angle))),
        );
        ctx.save();
        ctx.translate(FIELD.width / 2 + Math.cos(angle) * magnitude, FIELD.height / 2 + Math.sin(angle) * magnitude);
        ctx.rotate(angle);
        ctx.fillStyle = PALETTE.money;
        ctx.shadowColor = PALETTE.money;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(-12, -12);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-12, 12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    drawMinimap(state);
    for (let i = 0; i < 5; i += 1) star(ctx, FIELD.width - 228 + i * 32, 210, 13, i < p.wanted);

    bar(26, FIELD.height - 62, 210, 22, p.health / 100, PALETTE.health, 'HEALTH');
    bar(26, FIELD.height - 26, 210, 22, p.armor / 100, PALETTE.armor, 'ARMOR');

    if (!p.onFoot && p.car) {
      const speed = Math.round(Math.abs(p.car.speed) * 0.42);
      text(String(speed).padStart(3, '0'), FIELD.width - 28, FIELD.height - 42, 42, PALETTE.text, 'right', 'bold');
      text(`${p.car.maxSpeed > 400 ? 'COUPE' : 'SEDAN'}  MPH`, FIELD.width - 28, FIELD.height - 20, 13, PALETTE.muted, 'right');
      ctx.save();
      ctx.translate(FIELD.width - 150, FIELD.height - 52);
      ctx.strokeStyle = 'rgba(220,230,245,0.25)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 34, Math.PI * 0.75, Math.PI * 2.25);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(0, 0, 34, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * Math.min(1, speed / 170));
      ctx.stroke();
      ctx.restore();
    } else {
      const weapon = WEAPONS[p.weapon];
      text(p.reload > 0 ? 'RELOADING' : weapon.name, FIELD.width - 28, FIELD.height - 58, 15, p.reload > 0 ? PALETTE.orange : PALETTE.text, 'right', 'bold');
      text(`${String(p.ammo[p.weapon]).padStart(2, '0')} / ${p.reserve[p.weapon]}`, FIELD.width - 28, FIELD.height - 24, 34, PALETTE.text, 'right', 'bold');
    }

    ctx.fillStyle = 'rgba(6,10,18,0.66)';
    rounded(ctx, FIELD.width / 2 - 210, FIELD.height - 44, 420, 30, 15);
    ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      const height = 7 + Math.abs(Math.sin(state.elapsed * 5 + i * 1.3)) * 12;
      ctx.fillStyle = i % 2 ? PALETTE.player : PALETTE.copBlue;
      ctx.fillRect(FIELD.width / 2 - 192 + i * 11, FIELD.height - 35 - height / 2, 5, height);
    }
    text(`${state.radio.station}  ·  ${state.radio.song}`, FIELD.width / 2 + 20, FIELD.height - 25, 13, PALETTE.muted, 'center');

    if (state.toast.timer > 0) {
      ctx.globalAlpha = Math.min(1, state.toast.timer / 0.4);
      ctx.fillStyle = 'rgba(8,12,20,0.86)';
      rounded(ctx, FIELD.width / 2 - 220, 92, 440, 44, 8);
      ctx.fill();
      ctx.fillStyle = state.toast.color;
      ctx.fillRect(FIELD.width / 2 - 220, 92, 5, 44);
      text(state.toast.text, FIELD.width / 2, 121, 20, state.toast.color, 'center', 'bold');
      ctx.globalAlpha = 1;
    }
  }

  function panel(title, subtitle, lines, prompt, accent) {
    ctx.fillStyle = 'rgba(5,8,14,0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const width = 760;
    const height = 320 + lines.length * 34;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2 - 10;
    ctx.fillStyle = 'rgba(12,17,28,0.94)';
    rounded(ctx, x, y, width, height, 14);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillRect(x + 24, y + 24, 82, 4);
    text(title, FIELD.width / 2, y + 104, 62, accent, 'center', 'bold');
    text(subtitle, FIELD.width / 2, y + 136, 17, PALETTE.muted, 'center', 'bold');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 188 + i * 34, 18, PALETTE.text, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 42, 22, PALETTE.money, 'center', 'bold');
  }

  function draw(state, screen, best) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawWorld(state);
    if (screen === SCREEN_TITLE) {
      panel(
        'NEON SHORES',
        'AN OPEN-WORLD CRIME STORY',
        [
          'Steal a ride. Take the job. Outrun the blue lights.',
          'WASD / ARROWS drive or run     SHIFT sprint     E enter / exit',
          'MOUSE aim & fire     Q swap weapon     R reload     P pause',
          `BEST HAUL  ${money(best)}`,
        ],
        'PRESS SPACE OR CLICK TO START',
        PALETTE.player,
      );
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      panel('PAUSED', 'THE CITY CAN WAIT', [
        'WASD / ARROWS move    SHIFT sprint    E enter / exit vehicle',
        'MOUSE fire    Q weapon    R reload    M mute',
      ], 'PRESS P OR SPACE TO RESUME', PALETTE.player);
    } else if (screen === SCREEN_OVER) {
      const s = state.stats;
      panel(
        state.player.cause || 'WASTED',
        'THE STREETS GOT YOU',
        [
          `Jobs completed  ${s.jobs}        Total earned  ${money(s.earned)}`,
          `Cops down  ${s.kills}        Time in the city  ${clock(s.time)}`,
          `Best haul  ${money(Math.max(best, s.earned))}`,
        ],
        'PRESS SPACE OR CLICK TO GO AGAIN',
        PALETTE.copRed,
      );
    }
  }

  function clampInt(value, low, high) {
    return value < low ? low : value > high ? high : value;
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField, toWorld, resize };
}
