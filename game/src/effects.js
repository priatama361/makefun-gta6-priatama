// Short-lived visual feedback: sparks, muzzle flashes, smoke and camera shake.
// Effects write into the shared world state so simulation and rendering stay
// separate and a staged screenshot can call the very same helpers.

import { LIMITS, PALETTE } from './config.js';

export function createEffects(state, random) {
  function push(particle) {
    if (state.particles.length < LIMITS.particles) state.particles.push(particle);
  }

  function burst(x, y, count, color, power, life = 0.6, kind = 'spark') {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const speed = power * (0.3 + random() * 0.9);
      const span = life * (0.6 + random() * 0.7);
      push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: span,
        max: span,
        color,
        size: 2 + random() * 4,
        kind,
      });
    }
  }

  function sparks(x, y, count = 7) {
    burst(x, y, count, PALETTE.windowWarm, 160, 0.36, 'spark');
  }

  function muzzle(x, y, angle) {
    push({
      x: x + Math.cos(angle) * 16,
      y: y + Math.sin(angle) * 16,
      vx: Math.cos(angle) * 60,
      vy: Math.sin(angle) * 60,
      life: 0.12,
      max: 0.12,
      color: PALETTE.windowWarm,
      size: 13,
      kind: 'flash',
      angle,
    });
    burst(x, y, 5, PALETTE.orange, 130, 0.3, 'spark');
  }

  function smoke(x, y, count = 6) {
    burst(x, y, count, 'rgba(90,96,100,0.65)', 60, 1.1, 'smoke');
  }

  function shake(amount) {
    state.camera.shake = Math.min(24, state.camera.shake + amount);
  }

  function update(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const part = state.particles[i];
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      if (part.kind === 'spark') part.vy += 90 * dt;
      const drag = part.kind === 'smoke' ? 1.5 : 3.0;
      part.vx *= Math.max(0, 1 - dt * drag);
      part.vy *= Math.max(0, 1 - dt * drag);
      if (part.kind === 'smoke') part.size += dt * 12;
      part.life -= dt;
      if (part.life <= 0) state.particles.splice(i, 1);
    }
    state.camera.shake = Math.max(0, state.camera.shake - dt * 26);
  }

  return { burst, sparks, muzzle, smoke, shake, update };
}
