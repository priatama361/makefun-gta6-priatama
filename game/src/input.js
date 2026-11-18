const TRACKED = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyE', 'KeyJ', 'KeyR', 'KeyQ', 'KeyM',
  'KeyP', 'Escape', 'Space', 'Enter', 'ShiftLeft', 'ShiftRight', 'Mouse0',
]);

export function createInput(target) {
  const held = new Set();
  const presses = new Set();
  const pointer = { x: 640, y: 360, down: false };

  window.addEventListener('keydown', (event) => {
    if (!TRACKED.has(event.code)) return;
    event.preventDefault();
    if (!event.repeat && !held.has(event.code)) presses.add(event.code);
    held.add(event.code);
  });

  window.addEventListener('keyup', (event) => {
    if (!TRACKED.has(event.code)) return;
    event.preventDefault();
    held.delete(event.code);
  });

  window.addEventListener('blur', () => {
    held.clear();
    pointer.down = false;
  });

  target.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });

  target.addEventListener('pointerdown', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (event.button === 0) {
      pointer.down = true;
      held.add('Mouse0');
      presses.add('Mouse0');
    }
    event.preventDefault();
  });

  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) {
      pointer.down = false;
      held.delete('Mouse0');
    }
  });

  target.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    pointer,
    isDown(code) {
      return held.has(code);
    },
    axis() {
      const x = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0);
      const y = (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0) - (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    takePresses() {
      const taken = new Set(presses);
      presses.clear();
      return taken;
    },
  };
}
