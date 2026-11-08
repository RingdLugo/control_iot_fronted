import { commandForDirection } from "./movements.js";

const KEYS = {
  ArrowUp: "forward", w: "forward", W: "forward",
  ArrowDown: "backward", s: "backward", S: "backward",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
};

export function mountJoystick({ pad, handle, commands, onCommand, onDirection }) {
  let activePointer = null;
  let direction = null;
  let keyDirection = null;

  const paint = (x, y, active) => {
    handle.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    pad.classList.toggle("is-active", active);
  };

  const setDirection = (next) => {
    if (direction === next) return;
    direction = next;
    if (next) {
      const command = commandForDirection(commands, next);
      onDirection(next);
      if (command) onCommand(command);
      else onDirection(`missing:${next}`);
    } else {
      onDirection("neutral");
    }
  };

  const move = (event) => {
    const bounds = pad.getBoundingClientRect();
    const cx = bounds.left + bounds.width / 2;
    const cy = bounds.top + bounds.height / 2;
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;
    const max = bounds.width * .27;
    const distance = Math.hypot(dx, dy);
    if (distance > max) {
      dx = dx / distance * max;
      dy = dy / distance * max;
    }
    paint(dx, dy, true);
    const normalized = Math.hypot(event.clientX - cx, event.clientY - cy) / (bounds.width / 2);
    if (normalized < .2) return setDirection(null);
    setDirection(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "forward" : "backward"));
  };

  const finishPointer = (event) => {
    if (activePointer !== event.pointerId) return;
    activePointer = null;
    paint(0, 0, false);
    if (direction !== null) setDirection(null);
    if (pad.hasPointerCapture?.(event.pointerId)) pad.releasePointerCapture(event.pointerId);
  };

  const down = (event) => {
    if (pad.getAttribute("aria-disabled") === "true" || activePointer !== null || keyDirection !== null) return;
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    activePointer = event.pointerId;
    pad.setPointerCapture?.(event.pointerId);
    move(event);
  };
  const motion = (event) => { if (activePointer === event.pointerId) move(event); };
  const keyDown = (event) => {
    if (pad.getAttribute("aria-disabled") === "true") return;
    const next = KEYS[event.key];
    if (next && activePointer === null) {
      event.preventDefault();
      if (keyDirection === next) return;
      keyDirection = next;
      paint(0, 0, true);
      const offsets = { forward: [0, -22], backward: [0, 22], left: [-22, 0], right: [22, 0] };
      paint(...offsets[next], true);
      setDirection(next);
    } else if (event.key === " " || event.key === "Escape") {
      event.preventDefault();
      keyDirection = null;
      paint(0, 0, false);
      direction = null;
      onDirection("neutral");
    }
  };
  const keyUp = (event) => {
    if (KEYS[event.key] && keyDirection) {
      event.preventDefault();
      keyDirection = null;
      paint(0, 0, false);
      setDirection(null);
    }
  };

  pad.addEventListener("pointerdown", down);
  pad.addEventListener("pointermove", motion);
  pad.addEventListener("pointerup", finishPointer);
  pad.addEventListener("pointercancel", finishPointer);
  pad.addEventListener("lostpointercapture", finishPointer);
  pad.addEventListener("keydown", keyDown);
  pad.addEventListener("keyup", keyUp);
  pad.addEventListener("blur", () => {
    if (keyDirection) { keyDirection = null; paint(0, 0, false); setDirection(null); }
  });

  return {
    release(notify = true) {
      const id = activePointer;
      const hadInput = activePointer !== null || keyDirection !== null || direction !== null;
      activePointer = null;
      keyDirection = null;
      direction = null;
      paint(0, 0, false);
      if (notify && hadInput) onDirection("neutral");
      if (id !== null && pad.hasPointerCapture?.(id)) pad.releasePointerCapture(id);
    },
  };
}
