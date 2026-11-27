import * as PIXI from 'pixi.js';
import { gsap } from 'gsap';
import { CHARACTERS } from './scenario.js';

const BASE = import.meta.env.BASE_URL;
const asset = (path) => `${BASE}assets/${path}`;

const make = (tag, className) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class Stage {
  constructor(root) {
    this.root = root;
    this.bgA = root.querySelector('#bg-a');
    this.bgB = root.querySelector('#bg-b');
    this.frontBg = this.bgA;
    this.currentBg = null;
    this.charLayer = root.querySelector('#char-layer');
    this.fxLayer = root.querySelector('#fx-layer');
    this.particleCanvas = root.querySelector('#particles');
    this.ctx = this.particleCanvas.getContext('2d');
    this.live2dHost = root.querySelector('#live2d-host');
    this.live2dFallback = root.querySelector('#live2d-fallback');
    this.ambientOverlay = root.querySelector('#ambient-overlay');
    this.cinemaBars = root.querySelector('#cinema-bars');

    this.manifest = null;
    this.characters = new Map();
    this.currentChars = {};
    this.pointer = { x: 0, y: 0 };
    this.bgPointer = { x: 0, y: 0 };
    this.bgZoom = 1.055;
    this.zoomBoost = 0;
    this.width = 1;
    this.height = 1;
    this.dpr = 1;
    this.ambientMode = 'dusk';
    this.particles = [];
    this.bursts = [];
    this.live2dWanted = false;
    this.live2dReady = false;
    this.live2dApp = null;
    this.live2dModel = null;
    this.effectTimers = new Set();
    this.onBackground = null;

    this.resize = this.resize.bind(this);
    this.update = this.update.bind(this);
    this.handlePointer = this.handlePointer.bind(this);
  }

  async init() {
    const response = await fetch(asset('chars/manifest.json'));
    this.manifest = await response.json();

    this.root.addEventListener('pointermove', this.handlePointer);
    this.root.addEventListener('pointerleave', () => {
      this.pointer.x = 0;
      this.pointer.y = 0;
    });

    const observer = new ResizeObserver(() => this.resize());
    observer.observe(this.root);
    this.resize();

    gsap.ticker.add(this.update);
    this.initLive2D().catch((error) => {
      console.warn('[stage] Live2D unavailable, using holographic fallback', error);
      this.live2dHost.classList.add('fallback');
    });
  }

  handlePointer(event) {
    const rect = this.root.getBoundingClientRect();
    this.pointer.x = clamp((event.clientX - rect.left) / rect.width - 0.5, -0.5, 0.5);
    this.pointer.y = clamp((event.clientY - rect.top) / rect.height - 0.5, -0.5, 0.5);
  }

  resize() {
    const rect = this.root.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.particleCanvas.width = Math.round(this.width * this.dpr);
    this.particleCanvas.height = Math.round(this.height * this.dpr);
    this.particleCanvas.style.width = `${this.width}px`;
    this.particleCanvas.style.height = `${this.height}px`;
    this.seedParticles();
    this.resizeLive2D();
  }

  setBackground(name, duration = 900) {
    if (!name || name === this.currentBg) return;
    const url = asset(`bg/${name}.jpg`);
    const incoming = this.frontBg === this.bgA ? this.bgB : this.bgA;
    const outgoing = this.frontBg;
    const image = new Image();
    image.src = url;
    incoming.style.backgroundImage = `url("${url}")`;
    gsap.killTweensOf([incoming, outgoing]);
    gsap.set(incoming, { opacity: 0 });
    gsap.to(incoming, { opacity: 1, duration: duration / 1000, ease: 'power2.inOut' });
    gsap.to(outgoing, { opacity: 0, duration: duration / 1000, ease: 'power2.inOut' });
    this.frontBg = incoming;
    this.currentBg = name;
    this.root.dataset.bg = name;
    this.onBackground?.(name);
  }

  setAmbient(mode) {
    this.ambientMode = mode || 'none';
    this.root.dataset.ambient = this.ambientMode;
    this.seedParticles();
  }

  seedParticles() {
    const countMap = {
      dusk: 46, dust: 64, library: 58, stars: 120, rain: 140,
      petals: 76, starlight: 96, none: 0,
    };
    const count = countMap[this.ambientMode] ?? 36;
    this.particles = Array.from({ length: count }, () => this.makeParticle(false));
  }

  makeParticle(burst) {
    const mode = this.ambientMode;
    return {
      x: Math.random() * this.width,
      y: burst ? this.height * (0.35 + Math.random() * 0.45) : Math.random() * this.height,
      vx: (Math.random() - 0.5) * (mode === 'rain' ? 0.4 : 0.18),
      vy: mode === 'rain' ? 7 + Math.random() * 5 : mode === 'petals' ? 0.8 + Math.random() * 0.7 : -0.06 - Math.random() * 0.2,
      size: mode === 'rain' ? 10 + Math.random() * 16 : mode === 'petals' ? 4 + Math.random() * 6 : 1 + Math.random() * 2.4,
      alpha: 0.18 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      life: burst ? 1 : Infinity,
      decay: burst ? 0.012 + Math.random() * 0.012 : 0,
      burst,
    };
  }

  burst(kind = 'starlight') {
    const count = kind === 'riser' ? 46 : 28;
    for (let i = 0; i < count; i += 1) {
      const p = this.makeParticle(true);
      p.vx = (Math.random() - 0.5) * 3.4;
      p.vy = kind === 'riser' ? -2.4 - Math.random() * 3.2 : -0.4 - Math.random() * 1.8;
      p.size = 1.5 + Math.random() * 3.5;
      p.alpha = 0.55 + Math.random() * 0.4;
      this.bursts.push(p);
    }
  }

  setCharacters(chars = {}) {
    const parsed = {};
    for (const [id, value] of Object.entries(chars)) {
      if (id === 'shizuku') continue;
      parsed[id] = typeof value === 'string'
        ? { expr: value, pos: CHARACTERS[id]?.position || 'center', scale: 1 }
        : { expr: value.expr || 'normal', pos: value.pos || CHARACTERS[id]?.position || 'center', scale: value.scale || 1 };
    }

    this.currentChars = parsed;
    const ids = Object.keys(parsed).filter((id) => this.manifest?.[id]);
    ids.sort((a, b) => this.baseX(a) - this.baseX(b));

    for (const [id, wrapper] of this.characters) {
      if (!ids.includes(id)) this.removeCharacter(id, wrapper);
    }

    ids.forEach((id, index) => {
      const spec = parsed[id];
      let wrapper = this.characters.get(id);
      if (!wrapper) wrapper = this.createCharacter(id, spec, index, ids.length);
      this.layoutCharacter(wrapper, id, spec, index, ids.length);
      this.setExpression(wrapper, id, spec.expr);
    });
  }

  baseX(id) {
    const explicit = { rei: 28, akari: 72, naitou: 18, ryoma: 78, katsuya: 50, futami: 36, inaba: 50, terachi: 82, satou: 16 };
    return explicit[id] ?? 50;
  }

  createCharacter(id, spec, index, total) {
    const data = this.manifest[id];
    const first = Object.values(data.expressions)[0];
    const wrapper = make('div', 'character');
    wrapper.dataset.char = id;
    wrapper.style.setProperty('--aspect', `${first.width} / ${first.height}`);
    wrapper.style.opacity = '0';

    const motion = make('div', 'character-motion');
    const entrance = make('div', 'character-entrance');
    const parallax = make('div', 'character-parallax');
    const visual = make('div', 'character-visual');
    const rim = make('img', 'character-rim');
    rim.src = asset(`chars/${data.rim}`);
    rim.alt = '';
    const stack = make('div', 'sprite-stack');
    visual.append(rim, stack);
    parallax.append(visual);
    entrance.append(parallax);
    motion.append(entrance);
    wrapper.append(motion);
    this.charLayer.append(wrapper);

    const state = {
      wrapper, entrance, parallax, visual, stack,
      currentSrc: null,
      currentExpr: null,
      px: 0, py: 0, vx: 0, vy: 0,
      depth: 0.5 + (this.baseX(id) / 100) * 0.5,
    };
    this.characters.set(id, state);
    gsap.fromTo(entrance,
      { autoAlpha: 0, y: 28, filter: 'blur(10px)' },
      { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'power3.out' });
    gsap.to(wrapper, { opacity: 1, duration: 0.45 });
    return state;
  }

  layoutCharacter(state, id, spec, index, total) {
    const x = total === 1 ? this.baseX(id) : 18 + (index / Math.max(1, total - 1)) * 64;
    const densityScale = total >= 5 ? 0.7 : total === 4 ? 0.76 : total === 3 ? 0.84 : 1;
    const scale = densityScale * (spec.scale || 1);
    state.wrapper.style.left = `${x}%`;
    state.wrapper.style.zIndex = String(10 + index);
    state.wrapper.style.setProperty('--layout-scale', String(scale));
    state.depth = 0.5 + (x / 100) * 0.5;
  }

  removeCharacter(id, state) {
    this.characters.delete(id);
    gsap.killTweensOf([state.wrapper, state.entrance]);
    gsap.to(state.entrance, {
      autoAlpha: 0, y: 18, filter: 'blur(8px)', duration: 0.38, ease: 'power2.in',
      onComplete: () => state.wrapper.remove(),
    });
    gsap.to(state.wrapper, { opacity: 0, duration: 0.38 });
  }

  setExpression(state, id, expression) {
    const data = this.manifest[id];
    const resolved = data.aliases[expression] || data.expressions[expression] || data.aliases.normal || Object.values(data.expressions)[0];
    if (!resolved || state.currentSrc === resolved.src) return;
    state.currentSrc = resolved.src;
    state.currentExpr = expression;
    const img = make('img', 'sprite-image incoming');
    img.src = asset(`chars/${resolved.src}`);
    img.alt = '';
    img.decoding = 'async';
    const old = state.stack.querySelector('.sprite-image:not(.incoming)');
    state.stack.append(img);
    const finish = () => {
      img.classList.remove('incoming');
      gsap.fromTo(img, { opacity: 0, filter: 'blur(3px)' }, {
        opacity: 1, filter: 'blur(0px)', duration: 0.52, ease: 'power2.inOut',
        onComplete: () => {
          const others = [...state.stack.querySelectorAll('.sprite-image')].filter((node) => node !== img);
          for (const node of others) node.remove();
        },
      });
      if (old) gsap.to(old, { opacity: 0, duration: 0.48, ease: 'power2.inOut' });
    };
    if (img.complete) finish();
    else img.addEventListener('load', finish, { once: true });
  }

  setFocus(speakerId) {
    for (const [id, state] of this.characters) {
      const active = speakerId && id === speakerId;
      const dim = speakerId ? (active ? 1 : 0.74) : 0.92;
      state.wrapper.classList.toggle('is-speaking', !!active);
      state.wrapper.style.setProperty('--focus-scale', active ? '1.025' : '0.985');
      state.wrapper.style.setProperty('--dim', String(dim));
      state.wrapper.style.zIndex = String(active ? 40 : 10 + [...this.characters.keys()].indexOf(id));
    }
    this.live2dHost.classList.toggle('is-speaking', speakerId === 'shizuku');
  }

  setLive2D(visible) {
    this.live2dWanted = !!visible;
    this.live2dHost.classList.toggle('active', this.live2dWanted);
    if (this.live2dWanted && this.live2dModel) {
      try { this.live2dModel.motion('idle'); } catch { /* model may still be loading */ }
    }
  }

  async initLive2D() {
    if (!window.Live2D) throw new Error('Cubism 2.1 runtime missing');
    window.PIXI = PIXI;
    PIXI.utils.skipHello();
    const { Live2DModel } = await import('pixi-live2d-display/cubism2');
    Live2DModel.registerTicker(PIXI.Ticker);
    PIXI.Ticker.shared.start();

    const app = new PIXI.Application({
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      width: Math.max(1, this.live2dHost.clientWidth),
      height: Math.max(1, this.live2dHost.clientHeight),
    });
    app.view.className = 'live2d-canvas';
    this.live2dHost.prepend(app.view);
    this.live2dApp = app;

    const model = await Live2DModel.from(asset('live2d/shizuku/shizuku.model.json'));
    model.anchor.set(0.5, 1);
    model.autoUpdate = true;
    app.stage.addChild(model);
    this.live2dModel = model;
    this.live2dReady = true;
    this.live2dHost.classList.add('ready');
    this.resizeLive2D();
    window.setTimeout(() => {
      try { model.motion('idle'); } catch { /* ignore */ }
    }, 300);
    this.setLive2D(this.live2dWanted);
  }

  resizeLive2D() {
    if (!this.live2dApp || !this.live2dModel) return;
    const w = Math.max(1, this.live2dHost.clientWidth);
    const h = Math.max(1, this.live2dHost.clientHeight);
    this.live2dApp.renderer.resize(w, h);
    const model = this.live2dModel;
    const modelH = model.height || 1200;
    const desired = h * 0.94;
    const scale = desired / modelH;
    model.scale.set(scale);
    model.x = w * 0.5;
    model.y = h * 0.985;
  }

  overlay(color, duration = 700, peak = 0.72) {
    const el = make('div', 'fx-overlay');
    el.style.background = color;
    this.fxLayer.append(el);
    gsap.fromTo(el, { opacity: 0 }, {
      opacity: peak,
      duration: duration / 2000,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
      onComplete: () => el.remove(),
    });
  }

  timedClass(className, ms = 600) {
    this.root.classList.add(className);
    const timer = window.setTimeout(() => {
      this.root.classList.remove(className);
      this.effectTimers.delete(timer);
    }, ms);
    this.effectTimers.add(timer);
  }

  applyEffects(effects = []) {
    const list = Array.isArray(effects) ? effects : [effects];
    for (const fx of list) {
      switch (fx) {
        case 'flash':
        case 'whiteout':
          this.overlay('radial-gradient(circle at 50% 45%, #fffdf4 0%, rgba(255,250,235,.82) 45%, rgba(255,255,255,0) 100%)', 760, 0.9);
          break;
        case 'fadeBlack':
          this.overlay('#03050b', 900, 0.86);
          break;
        case 'sunrise':
          this.overlay('linear-gradient(180deg, rgba(255,203,128,.55), rgba(255,138,92,.14) 55%, transparent)', 1500, 0.72);
          this.burst('starlight');
          break;
        case 'shimmer':
          this.burst('starlight');
          this.overlay('radial-gradient(circle at 62% 40%, rgba(255,232,184,.42), transparent 55%)', 900, 0.6);
          break;
        case 'starlight':
          this.burst('starlight');
          break;
        case 'riser':
          this.burst('riser');
          break;
        case 'heartbeat':
          this.timedClass('fx-heartbeat', 1200);
          break;
        case 'shake':
          gsap.fromTo(this.root, { x: -5, y: 2 }, {
            x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.28)',
          });
          break;
        case 'glitch':
          this.timedClass('fx-glitch', 420);
          break;
        case 'focus':
          this.timedClass('fx-focus', 1800);
          break;
        case 'sepia':
          this.timedClass('fx-sepia', 1800);
          break;
        case 'zoom':
          gsap.fromTo(this, { zoomBoost: 0 }, { zoomBoost: 0.045, duration: 1.4, yoyo: true, repeat: 1 });
          break;
        case 'dissolve':
          this.burst('starlight');
          break;
        default:
          break;
      }
    }
  }

  drawParticles(dt, time) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    const mode = this.ambientMode;
    const drawOne = (p) => {
      if (p.burst) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.018 * dt;
        p.life -= p.decay * dt;
      } else if (mode === 'rain') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y > this.height + 20) { p.y = -20; p.x = Math.random() * this.width; }
      } else if (mode === 'petals') {
        p.x += Math.sin(time * 0.0014 + p.phase) * 0.55 * dt + p.vx * dt;
        p.y += p.vy * dt;
        if (p.y > this.height + 20) { p.y = -20; p.x = Math.random() * this.width; }
      } else if (mode === 'stars') {
        // nearly static twinkle
      } else {
        p.x += p.vx * dt + Math.sin(time * 0.0008 + p.phase) * 0.12 * dt;
        p.y += p.vy * dt;
        if (p.y < -10) { p.y = this.height + 10; p.x = Math.random() * this.width; }
      }

      const twinkle = mode === 'stars' ? 0.45 + 0.55 * Math.sin(time * 0.0022 + p.phase) : 1;
      const alpha = clamp(p.alpha * twinkle * (p.burst ? p.life : 1), 0, 1);
      if (alpha <= 0.002) return;

      ctx.save();
      ctx.globalAlpha = alpha;
      if (mode === 'rain') {
        ctx.strokeStyle = 'rgba(190,220,255,.65)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.size * 0.22, p.y + p.size);
        ctx.stroke();
      } else if (mode === 'petals') {
        ctx.fillStyle = 'rgba(255,205,218,.9)';
        ctx.translate(p.x, p.y);
        ctx.rotate(p.phase + time * 0.0006);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const warm = mode === 'dusk' || mode === 'dust' || mode === 'library' || mode === 'petals';
        ctx.fillStyle = warm ? 'rgba(255,224,174,1)' : 'rgba(205,232,255,1)';
        ctx.shadowBlur = p.burst || mode === 'starlight' ? 12 : mode === 'stars' ? 8 : 3;
        ctx.shadowColor = warm ? 'rgba(255,205,130,.8)' : 'rgba(150,210,255,.8)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.burst ? 1.4 : 1), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    for (const p of this.particles) drawOne(p);
    this.bursts = this.bursts.filter((p) => p.life > 0);
    for (const p of this.bursts) drawOne(p);
  }

  update(time, deltaTime) {
    const dt = clamp(deltaTime / 16.67, 0.2, 2.5);
    const targetBgX = -this.pointer.x * 14;
    const targetBgY = -this.pointer.y * 9;
    this.bgPointer.x += (targetBgX - this.bgPointer.x) * 0.055 * dt;
    this.bgPointer.y += (targetBgY - this.bgPointer.y) * 0.055 * dt;
    const bgTransform = `scale(${this.bgZoom + this.zoomBoost}) translate3d(${this.bgPointer.x}px, ${this.bgPointer.y}px, 0)`;
    this.bgA.style.transform = bgTransform;
    this.bgB.style.transform = bgTransform;

    for (const state of this.characters.values()) {
      const targetX = this.pointer.x * 22 * state.depth;
      const targetY = this.pointer.y * 10 * state.depth;
      state.vx += (targetX - state.px) * 0.055 * dt;
      state.vy += (targetY - state.py) * 0.055 * dt;
      state.vx *= Math.pow(0.84, dt);
      state.vy *= Math.pow(0.84, dt);
      state.px += state.vx * dt;
      state.py += state.vy * dt;
      state.parallax.style.transform = `translate3d(${state.px}px, ${state.py}px, 0)`;
    }
    this.drawParticles(dt, time * 1000);
  }
}
