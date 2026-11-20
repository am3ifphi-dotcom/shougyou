/**
 * Game feel plumbing: particles, floating text, camera shake/hitstop, decals.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { get } from '../core/textures.js';
import { text, COLORS } from '../ui/type.js';

/* ------------------------------------------------------------------ */
/* particles                                                           */
/* ------------------------------------------------------------------ */
export class Particles extends Container {
  constructor(max = 420) {
    super();
    this.pool = [];
    this.live = [];
    this.max = max;
  }

  spawn({ x, y, count = 8, texId = 'fx_sparks_a', speed = 60, life = 420, gravity = 90, tint = 0xffffff, scale = 1, spread = Math.PI * 2, dir = 0, fade = true, spin = 0 }) {
    for (let i = 0; i < count; i++) {
      if (this.live.length >= this.max) break;
      let s = this.pool.pop();
      if (!s) {
        s = new Sprite(get(texId));
        s.anchor.set(0.5);
        s.texId = texId;
      }
      if (s.texId !== texId) {
        s.texture = get(texId);
        s.texId = texId;
      }
      const a = dir + (Math.random() - 0.5) * spread;
      const v = speed * (0.45 + Math.random() * 0.8);
      s.x = x;
      s.y = y;
      s.vx = Math.cos(a) * v;
      s.vy = Math.sin(a) * v;
      s.life = 0;
      s.maxLife = life * (0.7 + Math.random() * 0.6);
      s.gravity = gravity;
      s.spin = spin ? (Math.random() - 0.5) * spin : 0;
      s.rotation = Math.random() * Math.PI * 2;
      s.tint = tint;
      s.alpha = 1;
      s.scale.set(scale * (0.6 + Math.random() * 0.8));
      s.fade = fade;
      s.visible = true;
      this.addChild(s);
      this.live.push(s);
    }
  }

  update(dtMs) {
    const dt = dtMs / 1000;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const s = this.live[i];
      s.life += dtMs;
      if (s.life >= s.maxLife) {
        s.visible = false;
        this.pool.push(s);
        this.live.splice(i, 1);
        continue;
      }
      s.vy += s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rotation += s.spin * dt;
      const k = s.life / s.maxLife;
      if (s.fade) s.alpha = 1 - k * k;
      s.scale.y = s.scale.x * (1 - k * 0.35);
      if (s.gravity) s.vx *= 1 - 1.6 * dt;
    }
  }

  clear() {
    for (const s of this.live) {
      s.visible = false;
      this.pool.push(s);
    }
    this.live.length = 0;
  }
}

/* ------------------------------------------------------------------ */
/* floating combat text                                                */
/* ------------------------------------------------------------------ */
export class FloatingText extends Container {
  constructor() {
    super();
    this.items = [];
  }

  spawn(x, y, content, { color = COLORS.bone, size = 12, rise = 22, life = 900, font = 'body', anchor = 0.5 } = {}) {
    const t = text(content, { size, font, fill: color, anchor, stroke: COLORS.ink, strokeWidth: 3 });
    t.x = x;
    t.y = y;
    this.addChild(t);
    this.items.push({ node: t, t: 0, life, rise, x0: x, y0: y });
  }

  update(dtMs) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dtMs;
      const k = it.t / it.life;
      if (k >= 1) {
        it.node.destroy();
        this.items.splice(i, 1);
        continue;
      }
      const ease = 1 - Math.pow(1 - k, 3);
      it.node.y = it.y0 - it.rise * ease;
      it.node.x = it.x0 + Math.sin(k * 9) * 1.6;
      it.node.alpha = k > 0.65 ? (1 - k) / 0.35 : 1;
      it.node.scale.set(1 + Math.sin(Math.min(1, k * 5) * Math.PI) * 0.18);
    }
  }

  clear() {
    for (const it of this.items) it.node.destroy();
    this.items.length = 0;
  }
}

/* ------------------------------------------------------------------ */
/* decals                                                              */
/* ------------------------------------------------------------------ */
export class Decals extends Container {
  constructor(max = 80) {
    super();
    this.stamps = [];
    this.max = max;
  }

  stamp(x, y, texId = 'fx_blood', { alpha = 0.55, tint = 0xffffff, scale = 1 } = {}) {
    if (this.stamps.length >= this.max) {
      const old = this.stamps.shift();
      this.removeChild(old);
      old.visible = false;
      this.stampPool = this.stampPool || [];
      this.stampPool.push(old);
    }
    const pool = (this.stampPool ||= []);
    let s = pool.find((p) => p.texId === texId && !p.parent);
    if (!s) {
      s = new Sprite(get(texId));
      s.anchor.set(0.5);
      s.texId = texId;
      s.alpha = alpha;
      s.tint = tint;
      s.zIndex = -10;
      this.addChildAt(s, 0);
    }
    s.x = x;
    s.y = y;
    s.scale.set(scale);
    s.rotation = Math.random() * Math.PI * 2;
    s.visible = true;
    s.alpha = alpha;
    this.stamps.push(s);
  }

  clear() {
    for (const s of this.stamps) {
      s.visible = false;
      this.removeChild(s);
    }
    this.stamps.length = 0;
  }
}

/* ------------------------------------------------------------------ */
/* screenspace flash + letterbox bars feel                             */
/* ------------------------------------------------------------------ */
export class FlashOverlay extends Container {
  constructor(w, h) {
    super();
    this.g = new Graphics();
    this.g.rect(0, 0, w, h).fill(0xffffff);
    this.g.alpha = 0;
    this.addChild(this.g);
    this.t = 0;
    this.dur = 0;
  }

  flash(color = 0xffffff, duration = 180, strength = 0.5) {
    this.g.tint = color;
    this.g.alpha = strength;
    this.dur = duration;
    this.t = 0;
  }

  update(dtMs) {
    if (this.dur <= 0) return;
    this.t += dtMs;
    const k = Math.min(1, this.t / this.dur);
    this.g.alpha = (1 - k) * (1 - k) * this.g.alpha;
    if (k >= 1) {
      this.dur = 0;
      this.g.alpha = 0;
    }
  }
}

/* ------------------------------------------------------------------ */
/* hit-stop / slow-mo driver                                           */
/* ------------------------------------------------------------------ */
export class TimeFX {
  constructor() {
    this.hitstop = 0;
    this.slowUntil = 0;
    this.slowScale = 1;
  }

  hit(ms = 70) {
    this.hitstop = Math.max(this.hitstop, ms);
  }

  slowmo(ms = 400, scale = 0.35) {
    this.slowUntil = performance.now() + ms;
    this.slowScale = scale;
  }

  /** returns the dt to feed the simulation this frame */
  scale(dtMs) {
    if (this.hitstop > 0) {
      this.hitstop -= dtMs;
      return 0;
    }
    if (performance.now() < this.slowUntil) return dtMs * this.slowScale;
    return dtMs;
  }
}
