// Keyboard and pointer input. Held keys are queried directly; one-shot presses are queued as flags
// so a quick tap between two fixed steps is never lost or counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_RESTART = 8;

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

/** Attach listeners and return a compact input snapshot API. */
export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let pointerDown = false;
  let pointerClientX = window.innerWidth * 0.7;
  let pointerClientY = window.innerHeight * 0.4;

  window.addEventListener('keydown', (event) => {
    if (PREVENT.has(event.code)) event.preventDefault();
    if (!held.has(event.code)) {
      if (event.code === 'Enter' || event.code === 'NumpadEnter') actions |= ACTION_CONFIRM;
      else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
      else if (event.code === 'KeyE' || event.code === 'KeyF') actions |= ACTION_INTERACT;
      else if (event.code === 'KeyR') actions |= ACTION_RESTART;
    }
    held.add(event.code);
  });

  window.addEventListener('keyup', (event) => held.delete(event.code));

  window.addEventListener('blur', () => {
    held.clear();
    pointerDown = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    pointerClientX = event.clientX;
    pointerClientY = event.clientY;
    actions |= ACTION_CONFIRM;
    canvas.setPointerCapture?.(event.pointerId);
  });

  window.addEventListener('pointerup', () => {
    pointerDown = false;
  });

  window.addEventListener('pointermove', (event) => {
    pointerClientX = event.clientX;
    pointerClientY = event.clientY;
  });

  return {
    down(code) { return held.has(code); },
    axisX() {
      return (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
    },
    axisY() {
      return (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) - (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0);
    },
    firing() { return pointerDown || held.has('Space'); },
    handbrake() { return held.has('Space') && !pointerDown; },
    sprinting() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    pointer() { return { x: pointerClientX, y: pointerClientY }; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    clear() {
      held.clear();
      actions = 0;
      pointerDown = false;
    },
  };
}
