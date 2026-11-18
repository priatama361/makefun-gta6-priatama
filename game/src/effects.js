// Short-lived visual feedback: dust, sparks, muzzle flashes, damage puffs, floating money text and
// camera shake. The effect pool is fixed so a long session never grows memory.
import { PALETTE } from './config.js';
import { clamp } from './random.js';

const MAX_PARTICLES = 260;
const MAX_MESSAGES = 14;

/** Create an effect system with preallocated particle and message arrays. */
export function createEffects(random) {
  const particles = [];
  const messages = [];
  for (let index = 0; index < MAX_PARTICLES; index += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 3, color: '#fff', drag: 0.9 });
  }
  for (let index = 0; index < MAX_MESSAGES; index += 1) {
    messages.push({ active: false, x: 0, y: 0, text: '', life: 0, max: 1, color: '#fff', size: 20 });
  }
  let shake = 0;
  let flash = 0;

  function burst(x, y, count, color, speed = 160, size = 4) {
    for (let index = 0; index < count; index += 1) {
      const particle = particles.find((item) => !item.active);
      if (!particle) return;
      const angle = random.range(0, Math.PI * 2);
      const power = random.range(speed * 0.25, speed);
      particle.active = true;
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * power;
      particle.vy = Math.sin(angle) * power;
      particle.max = random.range(0.28, 0.7);
      particle.life = particle.max;
      particle.size = random.range(size * 0.6, size * 1.5);
      particle.color = color;
      particle.drag = 0.9;
    }
  }

  function muzzle(x, y, angle) {
    burst(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, 5, PALETTE.bullet, 110, 3);
    flash = Math.max(flash, 0.06);
  }

  function floatText(x, y, text, color = PALETTE.gold, size = 21) {
    const message = messages.find((item) => !item.active);
    if (!message) return;
    message.active = true;
    message.x = x;
    message.y = y;
    message.text = text;
    message.color = color;
    message.size = size;
    message.max = 1.25;
    message.life = message.max;
  }

  function addShake(amount) {
    shake = Math.min(18, shake + amount);
  }

  function update(dt) {
    shake = Math.max(0, shake - dt * 34);
    flash = Math.max(0, flash - dt);
    for (const particle of particles) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= particle.drag;
      particle.vy *= particle.drag;
    }
    for (const message of messages) {
      if (!message.active) continue;
      message.life -= dt;
      message.y -= 34 * dt;
      if (message.life <= 0) message.active = false;
    }
  }

  function offset() {
    return { x: random.range(-shake, shake), y: random.range(-shake, shake), flash };
  }

  function draw(ctx) {
    for (const particle of particles) {
      if (!particle.active) continue;
      const alpha = clamp(particle.life / particle.max, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const message of messages) {
      if (!message.active) continue;
      ctx.globalAlpha = clamp(message.life / message.max, 0, 1);
      ctx.font = `800 ${message.size}px system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,28,44,0.85)';
      ctx.strokeText(message.text, message.x, message.y);
      ctx.fillStyle = message.color;
      ctx.fillText(message.text, message.x, message.y);
    }
    ctx.globalAlpha = 1;
  }

  function clear() {
    for (const particle of particles) particle.active = false;
    for (const message of messages) message.active = false;
    shake = 0;
    flash = 0;
  }

  return { burst, muzzle, floatText, addShake, update, offset, draw, clear };
}
