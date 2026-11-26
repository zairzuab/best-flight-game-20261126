// Keyboard and mouse: arrows/WASD pitch and roll, A/D rudder, W/S throttle,
// Space airbrake, C camera, P pause, R restart, M mute. Mouse drag looks
// around without moving the plane. Actions are edge-triggered and consumed.
export const ACTION_NONE = 0;
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_CAMERA = 8;
export const ACTION_MUTE = 16;

export function createInput(canvas) {
  const keys = new Set();
  let actions = ACTION_NONE;
  let lookX = 0;
  let lookY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyR') actions |= ACTION_RESTART;
    if (event.code === 'KeyC') actions |= ACTION_CAMERA;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseDown(event) {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onMouseMove(event) {
    if (!dragging) return;
    lookX += (event.clientX - lastX) * 0.003;
    lookY += (event.clientY - lastY) * 0.003;
    lookX = Math.max(-0.6, Math.min(0.6, lookX));
    lookY = Math.max(-0.4, Math.min(0.4, lookY));
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onMouseUp() {
    dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  return {
    /** Pitch/roll/rudder/throttle inputs for this frame, -1..1. */
    controls() {
      const pitch = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
      const roll = (keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0);
      const rudder = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
      const throttleDelta = (keys.has('KeyW') ? 0.55 : 0) - (keys.has('KeyS') ? 0.55 : 0);
      return {
        pitch,
        roll,
        rudder,
        throttleDelta,
        airbrake: keys.has('Space'),
        gearToggle: false,
      };
    },
    /** Gear toggle is a one-shot: read it here and it clears. */
    takeGearToggle() {
      if (keys.has('KeyG')) {
        keys.delete('KeyG');
        return true;
      }
      return false;
    },
    takeActions() {
      const taken = actions;
      actions = ACTION_NONE;
      return taken;
    },
    look() {
      return { x: lookX, y: lookY };
    },
    resetLook() {
      lookX = 0;
      lookY = 0;
    },
  };
}
