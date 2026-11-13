import { MovementCatalog } from "./MovementCatalog.js?v=20261109-3";

const KEYS = { ArrowUp: "forward", w: "forward", W: "forward", ArrowDown: "backward", s: "backward", S: "backward", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };

export class JoystickController {
  constructor({ pad, handle, commands, onCommand, onDirection, group = "drive" }) {
    Object.assign(this, { pad, handle, commands, onCommand, onDirection, group });
    this.pointerId = null; this.direction = null; this.keyDirection = null; this.frame = 0; this.pending = null;
  }
  mount() {
    this.pad.addEventListener("pointerdown", (event) => this.#pointerDown(event));
    this.pad.addEventListener("pointermove", (event) => this.#pointerMove(event));
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) this.pad.addEventListener(type, (event) => this.#pointerEnd(event));
    this.pad.addEventListener("keydown", (event) => this.#keyDown(event));
    this.pad.addEventListener("keyup", (event) => this.#keyUp(event));
    this.pad.addEventListener("blur", () => this.#releaseKey());
    return this;
  }
  #paint(x, y, active) { this.handle.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0)`; this.pad.classList.toggle("is-active", active); }
  #setDirection(next) {
    if (next === this.direction) return;
    this.direction = next;
    if (!next) { this.onDirection("neutral", this.group); return; }
    const command = MovementCatalog.commandForDirection(this.commands, next, this.group);
    this.onDirection(next, this.group);
    if (command) this.onCommand(command); else this.onDirection(`missing:${next}`, this.group);
  }
  #move(point) {
    const rect = this.pad.getBoundingClientRect(); const cx = rect.left + rect.width / 2; const cy = rect.top + rect.height / 2;
    let dx = point.clientX - cx; let dy = point.clientY - cy; const limit = rect.width * .27; const distance = Math.hypot(dx, dy);
    if (distance > limit) { dx = dx / distance * limit; dy = dy / distance * limit; }
    this.#paint(dx, dy, true);
    if (Math.hypot(point.clientX - cx, point.clientY - cy) / (rect.width / 2) < .2) return this.#setDirection(null);
    this.#setDirection(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "forward" : "backward"));
  }
  #pointerDown(event) {
    if (this.pad.getAttribute("aria-disabled") === "true" || this.pointerId !== null || this.keyDirection || (event.button !== undefined && event.button !== 0)) return;
    event.preventDefault(); this.pointerId = event.pointerId; this.pad.setPointerCapture?.(event.pointerId); this.#move(event);
  }
  #pointerMove(event) {
    if (event.pointerId !== this.pointerId) return;
    this.pending = { clientX: event.clientX, clientY: event.clientY };
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; if (this.pending && this.pointerId !== null) this.#move(this.pending); this.pending = null; });
  }
  #pointerEnd(event) {
    if (event.pointerId !== this.pointerId) return;
    if (this.pending) this.#move(this.pending); this.pending = null;
    if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0; this.pointerId = null; this.#paint(0, 0, false);
    if (this.direction !== null) this.#setDirection(null);
    if (this.pad.hasPointerCapture?.(event.pointerId)) this.pad.releasePointerCapture(event.pointerId);
  }
  #keyDown(event) {
    if (this.pad.getAttribute("aria-disabled") === "true") return;
    const next = KEYS[event.key];
    if (next && this.pointerId === null) {
      event.preventDefault(); if (this.keyDirection === next) return; this.keyDirection = next;
      const offsets = { forward: [0, -22], backward: [0, 22], left: [-22, 0], right: [22, 0] };
      this.#paint(...offsets[next], true); this.#setDirection(next);
    } else if (event.key === " " || event.key === "Escape") { event.preventDefault(); this.#releaseKey(); }
  }
  #keyUp(event) { if (KEYS[event.key] && this.keyDirection) { event.preventDefault(); this.#releaseKey(); } }
  #releaseKey() { if (!this.keyDirection) return; this.keyDirection = null; this.#paint(0, 0, false); this.#setDirection(null); }
  release(notify = true) {
    const oldPointer = this.pointerId; const active = oldPointer !== null || Boolean(this.keyDirection) || this.direction !== null;
    if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0; this.pending = null; this.pointerId = null; this.keyDirection = null; this.direction = null; this.#paint(0, 0, false);
    if (notify && active) this.onDirection("neutral", this.group);
    if (oldPointer !== null && this.pad.hasPointerCapture?.(oldPointer)) this.pad.releasePointerCapture(oldPointer);
  }
}
