/**
 * Follow camera: smooth exponential lerp, look-ahead in the direction of
 * travel, trauma-based shake, and clamping to the dungeon bounds.
 */
export class Camera {
  constructor(viewportW, viewportH) {
    this.vw = viewportW;
    this.vh = viewportH;
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.trauma = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.bounds = { w: 0, h: 0 };
    this.zoom = 3;
    this.speed = 0.0055;
  }

  setBounds(w, h) {
    this.bounds.w = w;
    this.bounds.h = h;
  }

  snapTo(x, y) {
    this.x = x - this.vw / 2;
    this.y = y - this.vh / 2;
    this.clamp();
  }

  focus(x, y, facing = { x: 0, y: 0 }, lookAmount = 18) {
    this.targetX = x + facing.x * lookAmount;
    this.targetY = y + facing.y * lookAmount;
  }

  shake(amount = 0.35) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dtMs) {
    const k = Math.min(1, dtMs * this.speed);
    this.x += (this.targetX - this.vw / 2 - this.x) * k;
    this.y += (this.targetY - this.vh / 2 - this.y) * k;

    this.trauma = Math.max(0, this.trauma - dtMs * 0.0022);
    const mag = this.trauma * this.trauma;
    this.shakeX = (Math.random() * 2 - 1) * 5 * mag;
    this.shakeY = (Math.random() * 2 - 1) * 5 * mag;

    this.clamp();
  }

  clamp() {
    const maxX = Math.max(0, this.bounds.w - this.vw);
    const maxY = Math.max(0, this.bounds.h - this.vh);
    this.x = Math.max(-8, Math.min(maxX + 8, this.x));
    this.y = Math.max(-8, Math.min(maxY + 8, this.y));
  }

  /** apply to a world container, including shake, at the current pixel zoom */
  apply(container, zoom = 2) {
    container.x = Math.round(-this.x * zoom + this.shakeX);
    container.y = Math.round(-this.y * zoom + this.shakeY);
  }

  get left() {
    return this.x;
  }
  get top() {
    return this.y;
  }
}
