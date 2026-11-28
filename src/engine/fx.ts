/* 画面演出 — パーティクル / フラッシュ / シェイク / チャプターカード */

export type ParticleMode = 'none' | 'dust' | 'stars' | 'stardust';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  phase: number;
  speed: number;
  drift: number;
  hue: number;
}

class FxEngine {
  enabled = true;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private mode: ParticleMode = 'none';
  private raf = 0;
  private shootingStar: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
  private shootTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.loop();
  }

  setMode(mode: ParticleMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.particles = [];
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    if (mode === 'dust') {
      for (let i = 0; i < 64; i++) {
        this.particles.push({ x: rand(60, 1860), y: rand(80, 900), vx: rand(-0.08, 0.08), vy: rand(-0.05, 0.12), size: rand(0.6, 2.6), phase: rand(0, Math.PI * 2), speed: rand(0.008, 0.02), drift: rand(0.1, 0.5), hue: 45 });
      }
    } else if (mode === 'stardust') {
      for (let i = 0; i < 120; i++) {
        this.particles.push({ x: rand(40, 1880), y: rand(0, 1080), vx: rand(-0.12, 0.12), vy: rand(0.12, 0.42), size: rand(0.8, 3.4), phase: rand(0, Math.PI * 2), speed: rand(0.012, 0.028), drift: rand(0.2, 0.7), hue: 48 });
      }
    } else if (mode === 'stars') {
      for (let i = 0; i < 150; i++) {
        this.particles.push({ x: rand(20, 1900), y: rand(20, 620), vx: 0, vy: 0, size: rand(0.6, 2.2), phase: rand(0, Math.PI * 2), speed: rand(0.02, 0.055), drift: 0, hue: 220 });
      }
    }
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, 1920, 1080);
    if (!this.enabled) return;
    const t = performance.now() * 0.001;

    if (this.mode === 'dust' || this.mode === 'stardust') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.particles) {
        p.x += p.vx + Math.sin(t * 0.8 + p.phase) * p.drift * 0.12;
        p.y += p.vy;
        if (this.mode === 'stardust') {
          if (p.y > 1090) { p.y = -10; p.x = Math.random() * 1920; }
        } else {
          if (p.y > 1000 || p.x < -20 || p.x > 1940) { p.y = Math.random() * 200 + 40; p.x = Math.random() * 1920; }
        }
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (this.mode === 'stardust' ? 2.3 : 1.5) + p.phase * 3));
        const alpha = (this.mode === 'stardust' ? 0.5 : 0.32) * tw;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 5.5);
        g.addColorStop(0, `hsla(${p.hue}, 95%, 78%, ${alpha})`);
        g.addColorStop(1, 'hsla(45, 95%, 70%, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (this.mode === 'stars') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.particles) {
        const tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 1.9 + p.phase * 5));
        ctx.fillStyle = `hsla(${p.hue}, 80%, 88%, ${tw * 0.9})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      // 流れ星
      this.shootTimer -= 1 / 60;
      if (!this.shootingStar && this.shootTimer <= 0) {
        this.shootingStar = { x: 400 + Math.random() * 1200, y: 60 + Math.random() * 180, vx: -14 - Math.random() * 8, vy: 7 + Math.random() * 4, life: 1 };
        this.shootTimer = 5 + Math.random() * 7;
      }
      if (this.shootingStar) {
        const s = this.shootingStar;
        const tx = s.x + s.vx * 9, ty = s.y + s.vy * 9;
        const grad = ctx.createLinearGradient(s.x, s.y, tx, ty);
        grad.addColorStop(0, `rgba(255,255,255,${0.95 * s.life})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        s.x += s.vx; s.y += s.vy; s.life -= 0.018;
        if (s.life <= 0) this.shootingStar = null;
      }
      ctx.restore();
    }
  };

  destroy() { cancelAnimationFrame(this.raf); }
}

const sleep = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));

class StageFx {
  particles: FxEngine;
  private fadeEl: HTMLElement;
  private flashEl: HTMLElement;
  private stageEl: HTMLElement;
  private chapterEl: HTMLElement;
  private chapterInner: HTMLElement;
  private toastEl: HTMLElement;
  private toastTimer: number | null = null;

  constructor() {
    this.particles = new FxEngine(document.getElementById('fx-canvas') as HTMLCanvasElement);
    this.fadeEl = document.getElementById('fade-layer')!;
    this.flashEl = document.getElementById('flash-layer')!;
    this.stageEl = document.getElementById('stage')!;
    this.chapterEl = document.getElementById('chapter-card')!;
    this.chapterInner = document.getElementById('chapter-card-inner')!;
    this.toastEl = document.getElementById('toast')!;
  }

  /* フェード（黒=black / 白=white） */
  async fade(color: 'black' | 'white', show: boolean, durationMs = 900) {
    this.fadeEl.style.background = color === 'black' ? '#000' : '#fff';
    this.fadeEl.style.transition = `opacity ${durationMs}ms ease`;
    this.fadeEl.style.opacity = show ? '1' : '0';
    await sleep(durationMs + 30);
  }

  /* 白フラッシュ */
  async flash(durationMs = 420) {
    this.flashEl.style.transition = 'none';
    this.flashEl.style.opacity = '1';
    await sleep(40);
    this.flashEl.style.transition = `opacity ${durationMs}ms ease`;
    this.flashEl.style.opacity = '0';
    await sleep(durationMs);
  }

  /* 画面シェイク */
  async shake(intensity = 14, durationMs = 620) {
    const start = performance.now();
    return new Promise<void>(resolve => {
      const step = (now: number) => {
        const t = (now - start) / durationMs;
        if (t >= 1) { this.stageEl.style.transform = ''; resolve(); return; }
        const decay = Math.pow(1 - t, 1.6);
        const dx = (Math.random() - 0.5) * 2 * intensity * decay;
        const dy = (Math.random() - 0.5) * 2 * intensity * decay;
        this.stageEl.style.transform = `translate(${dx}px, ${dy}px)`;
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /* チャプターカード */
  async chapterCard(kicker: string, title: string, holdMs = 2100) {
    this.chapterInner.innerHTML = `
      <div class="chapter-kicker">${escape(kicker)}</div>
      <div class="chapter-title">${escape(title)}</div>
      <div class="chapter-rule"></div>`;
    this.chapterEl.classList.add('visible');
    await sleep(holdMs);
    this.chapterEl.classList.remove('visible');
    await sleep(1000);
  }

  toast(msg: string, holdMs = 2400) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('visible');
    if (this.toastTimer) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('visible'), holdMs);
  }
}

function escape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const fx = new StageFx();
