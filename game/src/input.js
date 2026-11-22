// Keyboard and mouse input. Held keys give a movement direction and a stance; one-shot
// presses (confirm, pause) and pebble throws are queued and taken once by the loop, so a
// press between two frames is never lost and never counted twice.
//
//   Move    WASD or arrow keys
//   Sneak   hold Shift, or tap C to toggle crouching
//   Sprint  hold Space (loud: guards hear it, and you are easy to spot)
//   Pebble  click: throw a pebble at the pointer to draw a guard's ear
//   Pause   P or Escape

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas, toField) {
  const held = { up: false, down: false, left: false, right: false, shift: false, space: false };
  let crouchToggled = false;
  let actions = 0;
  let queuedThrow = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.shift = true;
    else if (event.code === 'Space') held.space = true;
    else if (event.code === 'KeyC') {
      if (!event.repeat) crouchToggled = !crouchToggled;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.shift = false;
    else if (event.code === 'Space') held.space = false;
  });

  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.shift = held.space = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    queuedThrow = toField(event.clientX, event.clientY);
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The movement and stance for this frame; throwAt is set once per click. */
    read() {
      const throwAt = queuedThrow;
      queuedThrow = null;
      return {
        moveX: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        moveY: (held.down ? 1 : 0) - (held.up ? 1 : 0),
        sneak: held.shift || crouchToggled,
        sprint: held.space && !held.shift,
        throwAt,
      };
    },
    /** Take the queued one-shot actions (ACTION_CONFIRM / ACTION_PAUSE bits). */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
