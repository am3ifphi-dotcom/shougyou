/**
 * Screen transitions.
 *
 * Every state change goes through `fadeOut -> swap -> fadeIn` or a diagonal
 * wipe, so the game never hard-cuts between screens.  Transitions live on the
 * overlay layer above every scene.
 */
import { Graphics } from 'pixi.js';
import { overlayLayer, VIEW_W, VIEW_H } from './app.js';

const veil = new Graphics();
veil.rect(0, 0, VIEW_W, VIEW_H).fill(0x05040a);
veil.alpha = 1;
overlayLayer.addChild(veil);

const wipeBand = new Graphics();
wipeBand.alpha = 0;
overlayLayer.addChild(wipeBand);

let animating = null;

export const Tween = {
  linear: (t) => t,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  outBack: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
};

function animate(duration, onUpdate, easing = Tween.inOut) {
  return new Promise((resolve) => {
    animating = { t0: performance.now(), duration, onUpdate, easing, resolve };
  });
}

/** Awaitable wipe that calls `swap` exactly when the band covers the frame. */
export async function wipeTransition(swap, duration = 760) {
  let swapped = false;
  const half = duration / 2;
  await new Promise((resolve) => {
    const t0 = performance.now();
    const step = () => {
      const raw = Math.min(1, (performance.now() - t0) / duration);
      const phase = raw < 0.5 ? raw / 0.5 : (1 - raw) / 0.5;
      const x = -VIEW_W + phase * VIEW_W * 2.2;
      wipeBand.clear();
      wipeBand.poly([x, 0, x + VIEW_W * 1.1, 0, x + VIEW_W * 0.72, VIEW_H, x - VIEW_W * 0.38, VIEW_H]).fill(0x0a0710);
      wipeBand.poly([x + VIEW_W * 1.1, 0, x + VIEW_W * 1.18, 0, x + VIEW_W * 0.8, VIEW_H, x + VIEW_W * 0.72, VIEW_H]).fill(0xc9a06a);
      wipeBand.alpha = raw < 0.06 ? raw / 0.06 : raw > 0.94 ? (1 - raw) / 0.06 : 1;
      if (raw >= 0.5 && !swapped) {
        swapped = true;
        veil.alpha = 0;
        Promise.resolve(swap()).then(() => {
          setTimeout(() => {
            veil.alpha = 0;
          }, 40);
        });
      }
      if (raw >= 1) {
        wipeBand.clear();
        wipeBand.alpha = 0;
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export function updateTransitions() {
  if (!animating) return;
  const { t0, duration, onUpdate, easing, resolve } = animating;
  const t = Math.min(1, (performance.now() - t0) / duration);
  onUpdate(easing(t), t);
  if (t >= 1) {
    animating = null;
    resolve();
  }
}

export function isTransitioning() {
  return !!animating;
}

export function fadeIn(duration = 460) {
  return animate(duration, (e) => {
    veil.alpha = 1 - e;
  });
}

export function fadeOut(duration = 360) {
  return animate(duration, (e) => {
    veil.alpha = e;
  });
}

export function setVeil(v) {
  veil.alpha = v;
}

export function getVeil() {
  return veil.alpha;
}

/**
 * Diagonal wipe used for title -> gameplay and gameplay -> result.
 * Draws a skewed band that sweeps across the frame with a highlight edge.
 */
export function wipe(duration = 620) {
  const half = duration / 2;
  return animate(duration, (e, raw) => {
    const x = -VIEW_W + e * VIEW_W * 2.2;
    wipeBand.clear();
    wipeBand.poly([
      x, 0,
      x + VIEW_W * 1.1, 0,
      x + VIEW_W * 0.72, VIEW_H,
      x - VIEW_W * 0.38, VIEW_H,
    ]).fill(0x0a0710);
    wipeBand.poly([
      x + VIEW_W * 1.1, 0,
      x + VIEW_W * 1.18, 0,
      x + VIEW_W * 0.80, VIEW_H,
      x + VIEW_W * 0.72, VIEW_H,
    ]).fill(0xc9a06a);
    // fully opaque while the band covers the frame, feathering out at the ends
    wipeBand.alpha = raw < 0.12 ? raw / 0.12 : raw > 0.88 ? (1 - raw) / 0.12 : 1;
  }, Tween.inOut);
}

/** Run `swap` while the screen is dark. */
export async function transition(swap, { out = 360, hold = 90, into = 520, kind = 'fade' } = {}) {
  if (kind === 'wipe') {
    await wipeTransition(swap, out + into);
    return;
  }
  await fadeOut(out);
  await swap();
  await new Promise((r) => setTimeout(r, hold));
  await fadeIn(into);
}

export function updateVeilIndependent(dt) {}
