import { PALETTE } from './config.js';
import { randomBetween } from './random.js';

export function createEffects(random) {
  const particles = [];
  const messages = [];
  const state = { shake: 0, flash: 0, flashColor: PALETTE.gold };

  function reset() {
    particles.length = 0;
    messages.length = 0;
    state.shake = 0;
    state.flash = 0;
  }

  function burst(x, y, color, count, speed = 160, life = 0.55) {
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const velocity = randomBetween(random, speed * 0.25, speed);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: randomBetween(random, life * 0.5, life),
        maxLife: life,
        size: randomBetween(random, 2, 6),
        color,
      });
    }
    if (particles.length > 420) particles.splice(0, particles.length - 420);
  }

  function puff(x, y, color, count = 5) {
    burst(x, y, color, count, 55, 0.7);
  }

  function message(x, y, label, color = PALETTE.gold) {
    messages.push({ x, y, label, color, life: 1.35 });
    if (messages.length > 18) messages.shift();
  }

  function kick(amount, flashColor = null) {
    state.shake = Math.min(18, state.shake + amount);
    if (flashColor !== null) {
      state.flash = Math.min(0.65, state.flash + 0.25);
      state.flashColor = flashColor;
    }
  }

  function update(dt) {
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.94;
      particle.vy *= 0.94;
      if (particle.life <= 0) particles.splice(index, 1);
    }
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const entry = messages[index];
      entry.life -= dt;
      entry.y -= 26 * dt;
      if (entry.life <= 0) messages.splice(index, 1);
    }
    state.shake = Math.max(0, state.shake - dt * 34);
    state.flash = Math.max(0, state.flash - dt * 1.8);
  }

  function draw(context) {
    for (const particle of particles) {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    context.globalAlpha = 1;
  }

  return { state, particles, messages, reset, burst, puff, message, kick, update, draw };
}
