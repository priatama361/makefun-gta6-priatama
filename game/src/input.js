export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_VEHICLE = 4;
export const ACTION_RESTART = 8;
export const ACTION_MAP = 16;

const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);
const CONFIRM_KEYS = new Set(['Space', 'Enter', 'NumpadEnter']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);
const VEHICLE_KEYS = new Set(['KeyE', 'KeyF']);
const RESTART_KEYS = new Set(['KeyR']);
const MAP_KEYS = new Set(['KeyM', 'Tab']);
const FIRE_KEYS = new Set(['Space']);

export function createInput(target) {
  const held = new Set();
  const actions = { value: 0 };
  const pointer = { x: 640, y: 360 };
  let firing = false;
  let virtual = null;

  function queue(code) {
    if (CONFIRM_KEYS.has(code)) actions.value |= ACTION_CONFIRM;
    if (PAUSE_KEYS.has(code)) actions.value |= ACTION_PAUSE;
    if (VEHICLE_KEYS.has(code)) actions.value |= ACTION_VEHICLE;
    if (RESTART_KEYS.has(code)) actions.value |= ACTION_RESTART;
    if (MAP_KEYS.has(code)) actions.value |= ACTION_MAP;
  }

  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS.has(codeOf(event)) || CONFIRM_KEYS.has(codeOf(event)) || VEHICLE_KEYS.has(codeOf(event)) || PAUSE_KEYS.has(codeOf(event)) || RESTART_KEYS.has(codeOf(event)) || MAP_KEYS.has(codeOf(event))) {
      event.preventDefault();
    }
    const code = codeOf(event);
    held.add(code);
    if (!event.repeat) queue(code);
  });

  window.addEventListener('keyup', (event) => {
    held.delete(codeOf(event));
  });

  window.addEventListener('blur', () => {
    held.clear();
    firing = false;
  });

  target.addEventListener('pointermove', (event) => {
    const bounds = target.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
  });

  target.addEventListener('pointerdown', (event) => {
    const bounds = target.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    firing = true;
    actions.value |= ACTION_CONFIRM;
    event.preventDefault();
  });

  window.addEventListener('pointerup', () => {
    firing = false;
  });

  target.addEventListener('contextmenu', (event) => event.preventDefault());

  function codeOf(event) {
    return event.code ?? '';
  }

  function key(...codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  function axis() {
    if (virtual !== null) return { x: virtual.x, y: virtual.y };
    return {
      x: (key('KeyD', 'ArrowRight') ? 1 : 0) - (key('KeyA', 'ArrowLeft') ? 1 : 0),
      y: (key('KeyS', 'ArrowDown') ? 1 : 0) - (key('KeyW', 'ArrowUp') ? 1 : 0),
    };
  }

  return {
    axis,
    pointer,
    sprinting() {
      return virtual !== null ? virtual.sprint === true : key('ShiftLeft', 'ShiftRight');
    },
    firing() {
      return virtual !== null ? virtual.fire === true : firing || key(...FIRE_KEYS);
    },
    takeActions() {
      const taken = virtual !== null ? virtual.actions : actions.value;
      if (virtual === null) actions.value = 0;
      return taken;
    },
    setVirtual(next) {
      virtual = next;
    },
    releaseVirtual() {
      virtual = null;
    },
    aimAt(x, y) {
      pointer.x = x;
      pointer.y = y;
    },
  };
}
