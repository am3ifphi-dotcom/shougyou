// HONSHITSU ARCHIVE — full-screen console/PC-style score-attack game.
// Fixed 960x540 dark-fantasy pixel stage; no DOM widgets, no web page layout.

import {
  W, H, SAFE, C, FONT, clamp, lerp, easeOutCubic, easeInOutCubic, easeOutBack,
  rnd, fmt, roundRect, drawText, drawNineSlice, Paint,
} from './draw.js';

const S = {
  BOOT: 'BOOT', LOADING: 'LOADING', TITLE: 'TITLE', MENU: 'MENU',
  GAME: 'GAME', PAUSE: 'PAUSE', OPTIONS: 'OPTIONS', CREDITS: 'CREDITS',
  RESULT: 'RESULT', GAME_OVER: 'GAME_OVER',
};
const MENU_ITEMS = ['NEW GAME', 'CONTINUE', 'OPTIONS', 'CREDITS', 'QUIT'];
const PAUSE_ITEMS = ['RESUME', 'OPTIONS', 'TITLE'];
const RESULT_ITEMS = ['RETRY', 'TITLE'];
const OPTIONS_ITEMS = ['BGM', 'SE', 'VOICE', 'FULLSCREEN', 'CONTROLS', 'BACK'];
const HINTS = [
  '南棟にはコーンスープがある。', '北棟には、ない。',
  '等高線は同じ地図を違えて見せる。', '✝本質✝は、は？の向こう側。',
  '配信は、やがて年鑑になる。', '偏差値60 / 70。見えない国境。',
];
const ATTRS = [
  { key: 'wing', label: '棟', values: ['南棟', '北棟'], icon: 'icon-star' },
  { key: 'tie', label: 'ネクタイ', values: ['紺', 'えんじ'], icon: 'icon-scroll' },
  { key: 'soup', label: 'スープ', values: ['有', '無'], icon: 'icon-check' },
  { key: 'dev', label: '偏差値', values: ['60', '70'], icon: 'icon-question' },
  { key: 'contour', label: '等高線', values: ['一致', '不一致'], icon: 'icon-cross' },
  { key: 'stream', label: '配信', values: ['有', '無'], icon: 'icon-star' },
];
const SKILLS = [
  { name: '観測', cost: 20, icon: 'icon-question', effect: 'HINT' },
  { name: '反証', cost: 35, icon: 'icon-check', effect: '×2' },
  { name: '年鑑', cost: 50, icon: 'icon-scroll', effect: '+18' },
];
const DIALOGUE = [
  { name: '三重県臣', portrait: 'portrait-mie', text: 'は？' },
  { name: '両馬二郎', portrait: 'portrait-ryoma', text: '✝本質✝、投稿。' },
  { name: '寺地星', portrait: 'portrait-terachi', text: '配信、始める。' },
  { name: '倉石暁', portrait: 'portrait-kuraishi', text: '年鑑に載せよう。' },
  { name: '塀勝也', portrait: 'portrait-katsuya', text: '同じ地図だ。' },
  { name: '櫻優', portrait: 'portrait-sakura', text: '観測、続行。' },
  { name: '砂糖東洋', portrait: 'portrait-satou', text: 'ゲーム、開始。' },
  { name: '伊崎', portrait: 'portrait-inaba', text: 'コーンスープ、帰還。' },
  { name: '零', portrait: 'portrait-rei', text: '偏差値85。' },
];
const IDLE_LINE = { name: '年鑑', portrait: 'portrait-kuraishi', text: '観測を続けよ。', idle: true };
const SAVE_KEY = 'honshitsu.continue.v1';
const HIGH_KEY = 'honshitsu.high.v1';
const OPT_KEY = 'honshitsu.options.v1';

function short(s, n = 58) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

class Transition {
  constructor() { this.active = false; }
  start(to, opts = {}) {
    if (this.active) return;
    this.active = true; this.to = to; this.t = 0;
    this.dur = opts.dur || 0.72; this.kind = opts.kind || 'fade';
    this.switched = false; this.opts = opts;
  }
  update(dt, game) {
    if (!this.active) return;
    this.t += dt / this.dur;
    if (!this.switched && this.t >= 0.5) { this.switched = true; game.setState(this.to, this.opts); }
    if (this.t >= 1) this.active = false;
  }
  draw(ctx) {
    if (!this.active) return;
    const t = clamp(this.t, 0, 1);
    const p = t < 0.5 ? easeInOutCubic(t * 2) : easeInOutCubic((1 - t) * 2);
    ctx.save();
    if (this.kind === 'wipe') {
      const e = p * (W + H);
      ctx.fillStyle = C.void;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(e, 0); ctx.lineTo(Math.max(0, e - H), H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C.gold; ctx.globalAlpha = 0.5; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(e, 0); ctx.lineTo(e - H, H); ctx.stroke();
    } else {
      ctx.globalAlpha = p;
      ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = p * 0.35; ctx.strokeStyle = C.crimson; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, 70 + p * 140, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
}

export class Game {
  constructor({ screenCtx, gameplayLayer, glCanvas, stage, loader, audio, input, three, commercial = false, onResize = null }) {
    this.ctx = screenCtx;
    this.layer = gameplayLayer;
    this.layerCtx = gameplayLayer.getContext('2d');
    this.glCanvas = glCanvas;
    this.stage = stage;
    this.loader = loader;
    this.audio = audio;
    this.input = input;
    this.three = three;
    this.commercial = commercial;
    this.onResize = onResize;
    this.paint = new Paint(loader);
    this.state = S.BOOT;
    this.prevState = S.BOOT;
    this.transition = new Transition();
    this.time = 0; this.stateTime = 0; this.bootTimer = 0; this.loadingMin = 0;
    this.menuIndex = 0; this.pauseIndex = 0; this.resultIndex = 0; this.optionsIndex = 0;
    this.optionsPage = 'main'; this.optionsReturn = S.MENU; this.creditsReturn = S.MENU;
    this.cursorPulse = 0; this.confirmPulse = 0; this.cancelSlide = 0;
    this.shake = 0; this.flash = 0; this.hitstop = 0; this.hudAlpha = 1;
    this.camera = { x: 0, target: 0 };
    this.bgmId = null; this.bossLayerOn = false;
    this.debug = false;
    this.ambient = [];
    this.particles = [];
    this.floaters = [];
    this.toasts = [];
    this.dialogue = { current: { ...IDLE_LINE }, queue: [], timer: 0 };
    this.creditsScroll = 0; this.creditsTotal = 0; this.creditsLines = [];
    this.run = this.freshRun();
    this.options = this.loadOptions();
    this.high = Number(localStorage.getItem(HIGH_KEY) || 0);
    for (const k of ['bgm', 'se', 'voice']) this.audio.setVolume(k, this.options[k]);
    this.initAmbient();
    this.stateEnter(S.BOOT);
  }

  loadOptions() {
    try { return { bgm: 0.8, se: 0.85, voice: 0.7, ...JSON.parse(localStorage.getItem(OPT_KEY) || '{}') }; }
    catch { return { bgm: 0.8, se: 0.85, voice: 0.7 }; }
  }
  saveOptions() { try { localStorage.setItem(OPT_KEY, JSON.stringify(this.options)); } catch {} }
  hasContinue() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
  initAmbient() {
    const ids = ['particle-star', 'particle-spark', 'particle-magic', 'particle-flare', 'particle-smoke'];
    for (let i = 0; i < 58; i++) {
      this.ambient.push({
        id: ids[i % ids.length], x: Math.random() * W, y: Math.random() * H,
        vy: -6 - Math.random() * 16, vx: -3 + Math.random() * 6,
        size: 6 + Math.random() * 14, alpha: 0.12 + Math.random() * 0.32,
        color: [C.parchment, C.gold, C.ember, C.cool][i % 4], spin: Math.random() * Math.PI,
      });
    }
  }

  // ---------- state machine ----------
  go(to, opts = {}) { if (!this.transition.active) this.transition.start(to, opts); }
  setState(to, opts = {}) {
    const from = this.state;
    this.prevState = from;
    this.stateExit(from, to, opts);
    this.state = to; this.stateTime = 0;
    this.stateEnter(to, opts);
  }
  stateExit(from, to) {
    if (from === S.PAUSE) this.audio.duck(false);
    if (from === S.GAME && to === S.TITLE) this.saveRun();
    if (from === S.GAME && (to === S.RESULT || to === S.GAME_OVER)) { this.audio.stopLayer('bgm_boss'); this.bossLayerOn = false; }
  }
  setBGM(id, fade = 1.1) {
    if (this.bgmId === id) return;
    this.bgmId = id;
    this.audio.playBGM(id, fade);
  }
  stateEnter(s) {
    switch (s) {
      case S.BOOT: this.bootTimer = 0; break;
      case S.LOADING: this.loadingMin = 0; break;
      case S.TITLE:
        this.setBGM('bgm_title', 1.2); this.audio.stopLayer('bgm_boss'); this.bossLayerOn = false;
        this.menuIndex = 0; break;
      case S.MENU:
        this.setBGM('bgm_title', 1.0); this.high = Number(localStorage.getItem(HIGH_KEY) || 0); break;
      case S.GAME:
        this.setBGM('bgm_game', 1.1); this.audio.duck(false);
        if (this.run.level >= 4 && !this.bossLayerOn) { this.audio.playLayer('bgm_boss', 0.24, 1.4); this.bossLayerOn = true; }
        this.pushDialogue(DIALOGUE[0]); break;
      case S.PAUSE: this.audio.duck(true); this.audio.se('se_cancel'); this.pauseIndex = 0; break;
      case S.OPTIONS: this.optionsPage = 'main'; break;
      case S.CREDITS:
        this.setBGM('bgm_result', 1.4); this.creditsScroll = 0; this.buildCredits(); break;
      case S.RESULT:
      case S.GAME_OVER:
        this.setBGM('bgm_result', 1.4); this.audio.stopLayer('bgm_boss'); this.bossLayerOn = false;
        this.audio.se('se_bell', { volume: 0.6 });
        this.audio.se(s === S.RESULT ? 'se_victory' : 'se_gameover', { volume: 0.8, bus: 'se' });
        this.resultIndex = 0; break;
    }
  }

  // ---------- run / puzzle ----------
  freshRun() {
    const rule = this.makeRule(1);
    const run = {
      active: true, score: 0, combo: 0, maxCombo: 0, hp: 100, mp: 30, ghostHP: 100,
      level: 1, cardIndex: 0, totalCards: 24, correct: 0, wrong: 0,
      rule, card: null, phase: 'card', phaseT: 0, cardAnim: 0,
      cardTime: 5.2, timeLeft: 5.2, hint: false, hintT: 0, double: false, freeze: 0,
      lastChoice: '', lastCorrect: false, outcome: null,
    };
    run.card = this.makeCard(run, 1);
    return run;
  }
  makeRule(level) {
    const keys = ATTRS.slice(0, Math.min(ATTRS.length, 2 + Math.floor(level / 2)));
    const count = Math.min(keys.length, level >= 4 ? 3 : 2);
    const shuffled = keys.slice().sort(() => Math.random() - 0.5);
    const conds = shuffled.slice(0, count).map((a) => ({
      key: a.key, value: a.values[Math.floor(Math.random() * 2)], label: a.label,
    }));
    return { conds, invert: level >= 4, level };
  }
  ruleText(rule) {
    const s = rule.conds.map((c) => `${c.label}:${c.value}`).join(' / ');
    return `${rule.invert ? '!= ' : ''}${s} => ${rule.invert ? 'は？' : '✝本質✝'}`;
  }
  makeCard(run, n) {
    const card = { n };
    for (const a of ATTRS) card[a.key] = a.values[Math.floor(Math.random() * 2)];
    const match = run.rule.conds.every((c) => card[c.key] === c.value);
    card.answer = run.rule.invert ? !match : match; // true = ✝本質✝
    return card;
  }
  startRun(cont = false) {
    let loaded = null;
    if (cont) {
      try { loaded = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch {}
    }
    if (loaded && loaded.card && loaded.rule) {
      this.run = { ...this.freshRun(), ...loaded, active: true, phase: 'card', phaseT: 0, cardAnim: 1 };
      if (!this.run.timeLeft) this.run.timeLeft = this.run.cardTime;
    } else {
      this.run = this.freshRun();
      try { localStorage.removeItem(SAVE_KEY); } catch {}
    }
    this.dialogue = { current: { ...IDLE_LINE }, queue: [], timer: 0 };
    this.toasts = []; this.floaters = []; this.particles = [];
    this.hudAlpha = 1; this.shake = 0; this.flash = 0; this.hitstop = 0;
    this.go(S.GAME, { kind: 'wipe' });
  }
  saveRun() {
    if (!this.run.active) return;
    const r = this.run;
    const data = {
      score: r.score, combo: r.combo, maxCombo: r.maxCombo, hp: r.hp, mp: r.mp, ghostHP: r.ghostHP,
      level: r.level, cardIndex: r.cardIndex, totalCards: r.totalCards, correct: r.correct, wrong: r.wrong,
      rule: r.rule, card: r.card, cardTime: r.cardTime, timeLeft: r.timeLeft, outcome: null,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
  }
  finish(outcome) {
    if (!this.run.active) return;
    this.run.active = false; this.run.outcome = outcome;
    this.high = Math.max(this.high, this.run.score);
    try { localStorage.setItem(HIGH_KEY, String(this.high)); localStorage.removeItem(SAVE_KEY); } catch {}
    this.go(outcome === 'clear' ? S.RESULT : S.GAME_OVER, { kind: 'fade' });
  }
  nextCard() {
    const r = this.run;
    r.cardIndex++;
    if (r.cardIndex >= r.totalCards) { this.finish('clear'); return; }
    if (r.correct > 0 && r.correct % 6 === 0) this.levelUp();
    r.cardTime = Math.max(3.15, 5.35 - r.level * 0.28);
    r.timeLeft = r.cardTime;
    r.card = this.makeCard(r, r.cardIndex + 1);
    r.phase = 'card'; r.phaseT = 0; r.cardAnim = 0;
    r.hint = false; r.hintT = 0; r.freeze = 0;
    this.audio.se('se_whoosh', { volume: 0.55 });
    if (r.cardIndex % 3 === 1) this.pushDialogue(DIALOGUE[(r.cardIndex / 3) % DIALOGUE.length | 0]);
  }
  levelUp() {
    const r = this.run;
    r.level++;
    r.rule = this.makeRule(r.level);
    this.toast(`LEVEL ${fmt(r.level, 2)}  RULE SHIFT`, C.gold);
    this.float('LEVEL UP', W / 2, 190, C.parchment, 1.3);
    this.spawnBurst(W / 2, 250, 'level', 30);
    this.audio.se('se_levelup');
    this.flash = 0.24; this.shake = 7;
    if (r.level === 4) {
      this.audio.playLayer('bgm_boss', 0.24, 1.5); this.bossLayerOn = true;
      this.audio.se('amb_creepy', { volume: 0.5 });
      this.toast('INVERSION', C.ember);
    }
  }
  judge(choice) {
    const r = this.run;
    if (!r.active || r.phase !== 'card' || this.hitstop > 0 || this.transition.active) return;
    const pick = choice === 'ESSENCE';
    const correct = choice !== 'TIMEOUT' && pick === r.card.answer;
    r.lastChoice = choice; r.lastCorrect = correct; r.phase = 'resolve'; r.phaseT = 0; r.timeLeft = 0;
    if (correct) {
      r.combo++; r.maxCombo = Math.max(r.maxCombo, r.combo); r.correct++;
      const gain = Math.round((100 + r.combo * 18 + r.level * 24) * (r.double ? 2 : 1));
      r.score += gain; r.mp = Math.min(100, r.mp + 9);
      this.float(`+${gain}`, 820, 74, C.parchment, 1.0);
      this.toast(`JUDGED  ×${r.combo}`, C.gold);
      this.spawnBurst(W / 2, 260, 'correct', 20);
      this.audio.se('se_hit'); this.audio.se('se_coin', { volume: 0.35 });
      this.flash = 0.13; this.shake = 4.5; this.hitstop = 0.045;
      r.double = false;
    } else {
      r.hp = Math.max(0, r.hp - 12); r.mp = Math.max(0, r.mp - 4); r.combo = 0; r.wrong++;
      this.float('-12', 252, 58, C.ember, 1.0);
      this.toast(choice === 'TIMEOUT' ? 'TIMEOUT' : 'MISREAD', C.ember);
      this.spawnBurst(W / 2, 260, 'wrong', 26);
      this.audio.se('se_damage');
      this.audio.se(choice === 'TIMEOUT' ? 'se_error' : 'amb_creepy', { volume: 0.55 });
      this.flash = 0.34; this.shake = 11; this.hitstop = 0.09;
      r.double = false;
    }
  }
  afterJudge() {
    if (this.run.hp <= 0) { this.finish('gameover'); return; }
    this.nextCard();
  }
  useSkill(n) {
    const r = this.run;
    if (!r.active || r.phase !== 'card' || this.hitstop > 0) return;
    const s = SKILLS[n - 1];
    if (!s) return;
    if (r.mp < s.cost) {
      this.audio.se('se_error'); this.toast('MP LOW', C.ember); this.float('MP', 252, 92, C.ember, 0.8); return;
    }
    r.mp -= s.cost;
    this.float(`-${s.cost} MP`, 252, 92, C.cool, 0.9);
    this.audio.se(n === 3 ? 'se_heal' : 'se_magic', { volume: 0.8 });
    this.spawnBurst(760, 446, 'skill', 14);
    if (n === 1) { r.hint = true; r.hintT = 1.8; this.toast('観測 / HINT', C.parchment); }
    if (n === 2) { r.double = true; this.toast('反証 / ×2', C.parchment); }
    if (n === 3) {
      r.hp = Math.min(100, r.hp + 18); r.freeze = 3.0;
      this.float('+18', 252, 58, C.moss, 1.0); this.toast('年鑑 / +18', C.parchment);
    }
  }

  // ---------- effects / dialogue ----------
  toast(text, color = C.parchment) {
    this.toasts.push({ text, color, life: 1.7, max: 1.7 });
    if (this.toasts.length > 4) this.toasts.shift();
    this.audio.se('se_notify', { volume: 0.28 });
  }
  float(text, x, y, color = C.parchment, life = 1.0) {
    this.floaters.push({ text, x, y, color, life, max: life, vy: -34 });
  }
  spawnBurst(x, y, kind, count) {
    const ids = kind === 'wrong' ? ['particle-cloud', 'particle-smoke', 'particle-spark']
      : kind === 'level' ? ['particle-burst', 'particle-magic', 'particle-star']
        : kind === 'skill' ? ['particle-magic', 'particle-flare']
          : ['particle-star', 'particle-spark', 'particle-flare'];
    const colors = kind === 'wrong' ? [C.crimson, C.ember, C.violet] : [C.parchment, C.gold, C.ember];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 190;
      this.particles.push({
        id: ids[i % ids.length], x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        size: 10 + Math.random() * 22, life: 0.5 + Math.random() * 0.6, max: 1.1,
        color: colors[i % colors.length], spin: Math.random() * Math.PI,
      });
    }
  }
  pushDialogue(line) {
    if (!line) return;
    if (!this.dialogue.current || this.dialogue.current.idle || this.dialogue.timer > 2.4) {
      this.dialogue.current = { ...line, idle: false }; this.dialogue.timer = 0; this.audio.voiceBlip();
    } else this.dialogue.queue.push(line);
  }
  advanceDialogue() {
    if (this.dialogue.queue.length) {
      this.dialogue.current = { ...this.dialogue.queue.shift(), idle: false }; this.dialogue.timer = 0; this.audio.voiceBlip();
    } else { this.dialogue.current = { ...IDLE_LINE }; this.dialogue.timer = 0; }
  }

  // ---------- update ----------
  update(dt) {
    const step = Math.min(dt, 1 / 20);
    this.time += dt; this.stateTime += dt;
    this.input.update(step);
    const acts = this.input.consume();
    if (acts.includes('debug')) this.debug = !this.debug;
    if (acts.includes('fullscreen')) this.toggleFullscreen();
    this.updateAmbient(step);
    this.updateEffects(step);
    this.camera.x += (this.camera.target - this.camera.x) * Math.min(1, step * 1.7);
    this.shake = Math.max(0, this.shake - dt * 22);
    this.flash = Math.max(0, this.flash - dt * 2.7);
    this.hitstop = Math.max(0, this.hitstop - dt);
    this.cursorPulse = Math.max(0, this.cursorPulse - dt * 4);
    this.confirmPulse = Math.max(0, this.confirmPulse - dt * 3);
    this.cancelSlide = Math.max(0, this.cancelSlide - dt * 4);
    this.dialogue.timer += dt;
    if (this.dialogue.timer > 3.0 && this.dialogue.current && !this.dialogue.current.idle) this.advanceDialogue();
    if (this.transition.active) this.transition.update(dt, this);
    else this.handleActions(acts);
    this.updateState(dt);
    const mood = this.state === S.GAME || this.state === S.PAUSE ? 'game'
      : this.state === S.RESULT || this.state === S.GAME_OVER || this.state === S.CREDITS ? 'result'
        : this.state === S.LOADING || this.state === S.BOOT ? 'loading' : 'menu';
    this.three.render(step, mood, this.bossLayerOn);
  }
  updateAmbient(dt) {
    for (const p of this.ambient) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.spin += dt * 0.4;
      if (p.y < -20) { p.y = H + 20; p.x = Math.random() * W; }
      if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
    }
  }
  updateEffects(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 150 * dt; p.life -= dt; p.spin += dt * 2;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) { f.y += f.vy * dt; f.life -= dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
  }
  updateState(dt) {
    switch (this.state) {
      case S.BOOT:
        this.bootTimer += dt;
        if (this.bootTimer > 2.25 && !this.transition.active) this.go(S.LOADING, { kind: 'wipe' });
        break;
      case S.LOADING:
        this.loadingMin += dt;
        if (this.loader.done && this.loadingMin > 1.35 && !this.transition.active) this.go(S.TITLE, { kind: 'fade', dur: 0.9 });
        break;
      case S.GAME: this.updateRun(dt); break;
      case S.CREDITS: {
        const speed = (this.input.isHeld('confirm') || this.input.isHeld('down')) ? 250 : 66;
        this.creditsScroll += speed * dt;
        if (this.creditsScroll > this.creditsTotal + 390) this.go(this.creditsReturn, { kind: 'fade' });
        break;
      }
    }
  }
  updateRun(dt) {
    dt = Math.min(dt, 1 / 20);
    const r = this.run;
    if (!r.active) return;
    this.camera.target = Math.sin(this.time * 0.11) * 8 + r.cardIndex * 3.2;
    this.three.setFocus(r.cardIndex * 0.32, r.phase === 'card' ? (1 - r.timeLeft / r.cardTime) * 0.7 : 0);
    const targetHud = r.phase === 'resolve' ? 1 : this.dialogue.current && !this.dialogue.current.idle ? 0.62 : 0.84;
    this.hudAlpha += (targetHud - this.hudAlpha) * Math.min(1, dt * 3.2);
    r.ghostHP = Math.max(r.hp, r.ghostHP - dt * 25);
    if (r.hintT > 0) { r.hintT -= dt; if (r.hintT <= 0) r.hint = false; }
    if (this.hitstop > 0) return;
    if (r.phase === 'card') {
      r.cardAnim = Math.min(1, r.cardAnim + dt * 3.4);
      if (r.freeze > 0) { r.freeze -= dt; r.timeLeft += dt; }
      r.timeLeft -= dt;
      if (r.timeLeft <= 0) this.judge('TIMEOUT');
    } else if (r.phase === 'resolve') {
      r.phaseT += dt;
      if (r.phaseT > 0.72) this.afterJudge();
    }
  }

  // ---------- input ----------
  moveIndex(prop, delta, len) {
    const before = this[prop];
    this[prop] = (this[prop] + delta + len) % len;
    if (before !== this[prop]) { this.audio.se('se_cursor'); this.cursorPulse = 1; }
  }
  menuDecide() { this.audio.se('se_confirm'); this.confirmPulse = 1; }
  menuCancel() { this.audio.se('se_cancel'); this.cancelSlide = 1; }
  toggleFullscreen() {
    const el = this.stage;
    try {
      if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => this.toast('FULLSCREEN DENIED', C.ember));
      else document.exitFullscreen?.();
    } catch { this.toast('FULLSCREEN DENIED', C.ember); }
    this.onResize?.();
  }
  handleActions(acts) {
    if (!acts.length) return;
    const has = (a) => acts.includes(a);
    switch (this.state) {
      case S.TITLE:
        if (has('any') || has('confirm')) { this.menuDecide(); this.go(S.MENU, { kind: 'fade' }); } return;
      case S.MENU: {
        if (has('up') || has('left')) this.moveIndex('menuIndex', -1, MENU_ITEMS.length);
        if (has('down') || has('right')) this.moveIndex('menuIndex', 1, MENU_ITEMS.length);
        if (has('confirm')) {
          if (this.menuIndex === 1 && !this.hasContinue()) { this.audio.se('se_error'); this.toast('NO SAVE', C.ember); return; }
          this.menuDecide();
          const item = MENU_ITEMS[this.menuIndex];
          if (item === 'NEW GAME') this.startRun(false);
          else if (item === 'CONTINUE') this.startRun(true);
          else if (item === 'OPTIONS') { this.optionsReturn = S.MENU; this.go(S.OPTIONS, { kind: 'fade' }); }
          else if (item === 'CREDITS') { this.creditsReturn = S.MENU; this.go(S.CREDITS, { kind: 'wipe' }); }
          else if (item === 'QUIT') this.go(S.TITLE, { kind: 'wipe' });
        } else if (has('cancel')) { this.menuCancel(); this.go(S.TITLE, { kind: 'fade' }); }
        return;
      }
      case S.GAME: {
        let advanced = false;
        for (const a of acts) {
          if (a === 'left' || a === 'essence') this.judge('ESSENCE');
          else if (a === 'right' || a === 'noise') this.judge('NOISE');
          else if (a === 'up' || a === 'skill1') this.useSkill(1);
          else if (a === 'down' || a === 'skill2') this.useSkill(2);
          else if (a === 'skill3') this.useSkill(3);
          else if ((a === 'advance' || a === 'confirm') && !advanced) { this.advanceDialogue(); advanced = true; }
        }
        if (has('cancel') || has('pause')) { this.menuCancel(); this.go(S.PAUSE, { kind: 'fade', dur: 0.5 }); }
        return;
      }
      case S.PAUSE: {
        if (has('up') || has('left')) this.moveIndex('pauseIndex', -1, PAUSE_ITEMS.length);
        if (has('down') || has('right')) this.moveIndex('pauseIndex', 1, PAUSE_ITEMS.length);
        if (has('confirm')) {
          this.menuDecide();
          if (this.pauseIndex === 0) this.go(S.GAME, { kind: 'wipe', dur: 0.5 });
          else if (this.pauseIndex === 1) { this.optionsReturn = S.PAUSE; this.go(S.OPTIONS, { kind: 'fade' }); }
          else if (this.pauseIndex === 2) { this.saveRun(); this.go(S.TITLE, { kind: 'wipe' }); }
        } else if (has('cancel') || has('pause')) { this.menuCancel(); this.go(S.GAME, { kind: 'wipe', dur: 0.5 }); }
        return;
      }
      case S.OPTIONS: {
        if (this.optionsPage === 'controls') {
          if (has('confirm') || has('cancel')) { this.menuCancel(); this.optionsPage = 'main'; }
          return;
        }
        if (has('up')) this.moveIndex('optionsIndex', -1, OPTIONS_ITEMS.length);
        if (has('down')) this.moveIndex('optionsIndex', 1, OPTIONS_ITEMS.length);
        const row = this.optionsIndex;
        if (row <= 2 && (has('left') || has('right'))) {
          const key = ['bgm', 'se', 'voice'][row];
          const d = has('right') ? 0.05 : -0.05;
          this.options[key] = clamp(+(this.options[key] + d).toFixed(2), 0, 1);
          this.audio.setVolume(key, this.options[key]); this.saveOptions();
          this.audio.se('se_cursor'); this.cursorPulse = 1;
        } else if (row > 2 && (has('left') || has('right'))) {
          this.moveIndex('optionsIndex', has('right') ? 1 : -1, OPTIONS_ITEMS.length);
        }
        if (has('confirm')) {
          this.menuDecide();
          if (row === 3) this.toggleFullscreen();
          else if (row === 4) this.optionsPage = 'controls';
          else if (row === 5) { this.menuCancel(); this.go(this.optionsReturn, { kind: 'fade' }); }
        } else if (has('cancel')) { this.menuCancel(); this.go(this.optionsReturn, { kind: 'fade' }); }
        return;
      }
      case S.CREDITS:
        if (has('cancel')) { this.menuCancel(); this.go(this.creditsReturn, { kind: 'fade' }); }
        return;
      case S.RESULT:
      case S.GAME_OVER: {
        if (has('up') || has('left')) this.moveIndex('resultIndex', -1, RESULT_ITEMS.length);
        if (has('down') || has('right')) this.moveIndex('resultIndex', 1, RESULT_ITEMS.length);
        if (has('restart')) { this.menuDecide(); this.startRun(false); return; }
        if (has('confirm')) {
          this.menuDecide();
          if (this.resultIndex === 0) this.startRun(false);
          else this.go(S.TITLE, { kind: 'wipe' });
        } else if (has('cancel')) { this.menuCancel(); this.go(S.TITLE, { kind: 'wipe' }); }
        return;
      }
    }
  }

  // ---------- credits ----------
  buildCredits() {
    const lines = [];
    const add = (text, size = 10, color = C.parchment, font = FONT.jp, h = 18) => lines.push({ text, size, color, font, h });
    add('HONSHITSU ARCHIVE', 18, C.bone, FONT.display, 30);
    add('✝本質✝ // THE INVISIBLE BORDER', 11, C.gold, FONT.jp, 24);
    add('', 8, C.cool, FONT.mono, 12);
    for (const r of (this.loader.manifest?.credits_roles || [])) add(r, 9, C.cool, FONT.display, 18);
    add('', 8, C.cool, FONT.mono, 16);
    add('ASSET REGISTER / LICENSES', 13, C.gold, FONT.display, 26);
    for (const a of this.loader.credits()) {
      add(a.id, 9, C.parchment, FONT.display, 14);
      add(`${a.author}  /  ${a.license}`, 9, C.gold, FONT.jp, 14);
      add(`${a.pack || ''}  ${short(a.source_page || '', 54)}  ${a.fallback ? '[FALLBACK]' : ''}`, 8, C.cool, FONT.mono, 13);
      add(`${a.attribution_required ? 'CREDIT REQUIRED' : 'CREDIT OPTIONAL'}  ${a.noncommercial_only ? 'NC ONLY' : 'COMMERCIAL OK'}`, 8, a.noncommercial_only ? C.ember : C.moss, FONT.display, 14);
      add('', 8, C.cool, FONT.mono, 7);
    }
    add('', 8, C.cool, FONT.mono, 20);
    add('THANK YOU FOR PLAYING', 12, C.bone, FONT.display, 28);
    this.creditsLines = lines;
    this.creditsTotal = lines.reduce((n, l) => n + l.h, 0);
  }

  // ---------- render ----------
  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
    if (this.state === S.GAME || this.state === S.PAUSE) {
      this.renderGameplayLayer();
      if (this.state === S.GAME) ctx.drawImage(this.layer, 0, 0);
      else {
        ctx.save(); ctx.filter = 'blur(4px) brightness(0.58)'; ctx.drawImage(this.layer, 0, 0); ctx.restore();
        ctx.fillStyle = 'rgba(9,7,14,0.48)'; ctx.fillRect(0, 0, W, H);
        this.drawPause(ctx);
      }
    } else {
      const force2D = this.state === S.BOOT || this.state === S.LOADING;
      const mood = this.state === S.RESULT || this.state === S.GAME_OVER || this.state === S.CREDITS ? 'result'
        : this.state === S.LOADING || this.state === S.BOOT ? 'loading' : 'menu';
      this.composeBackground(ctx, mood, force2D);
      this.drawState(ctx);
    }
    this.transition.draw(ctx);
    if (this.debug) this.drawDebug(ctx);
  }
  composeBackground(ctx, mood, force2D = false) {
    if (this.three.active && !force2D) {
      ctx.drawImage(this.glCanvas, 0, 0, W, H);
      ctx.fillStyle = 'rgba(9,7,14,0.16)'; ctx.fillRect(0, 0, W, H);
    } else this.drawParallax(ctx, mood);
    this.drawAmbient(ctx);
    this.drawVignette(ctx);
  }
  drawParallax(ctx, mood) {
    const t = this.time, cx = this.camera.x;
    const grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, C.void); grd.addColorStop(0.55, C.night); grd.addColorStop(1, C.bruise);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = (i * 137 + Math.sin(t * 0.1 + i) * 8) % W;
      const y = (i * 53) % (H * 0.62);
      ctx.fillStyle = i % 7 === 0 ? C.ember : C.parchment;
      ctx.globalAlpha = 0.25 + (i % 5) * 0.08;
      ctx.fillRect(Math.round(x), Math.round(y), i % 9 === 0 ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
    const layer = (id, y, h, alpha, ox, filter) => {
      ctx.save(); ctx.globalAlpha = alpha; ctx.filter = filter;
      ctx.drawImage(this.paint.shade(id, C.violet, 0.55), -40 - cx * ox + Math.sin(t * 0.05) * 8, y, W + 80, h);
      ctx.restore();
    };
    layer('bg-mountains', 120, 190, 0.42, 0.12, 'brightness(0.35) saturate(0.4) hue-rotate(215deg)');
    layer('bg-clouds', 60, 170, 0.16, 0.20, 'brightness(0.28) saturate(0.3) hue-rotate(230deg)');
    layer('bg-forest', 170, 230, 0.22, 0.34, 'brightness(0.32) saturate(0.35) hue-rotate(225deg)');
    layer('bg-hills', 250, 190, 0.34, 0.52, 'brightness(0.34) saturate(0.4) hue-rotate(220deg)');
    layer('bg-castles', 205, 240, 0.28, 0.42, 'brightness(0.30) saturate(0.35) hue-rotate(225deg)');
    ctx.save(); ctx.globalAlpha = 0.22; ctx.filter = 'brightness(0.42) saturate(0.5) hue-rotate(220deg)';
    const floor = this.paint.shade('tex-stone-floor', C.night, 0.6);
    for (let x = -((cx * 0.7) % 128) - 128; x < W + 128; x += 128) for (let y = 390; y < H; y += 128) ctx.drawImage(floor, x, y, 128, 128);
    ctx.restore();
    ctx.fillStyle = 'rgba(9,7,14,0.32)'; ctx.fillRect(0, 380, W, H - 380);
  }
  drawAmbient(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of this.ambient) {
      const img = this.paint.tinted(p.id, p.color, 1);
      ctx.save(); ctx.globalAlpha = p.alpha; ctx.translate(p.x, p.y); ctx.rotate(p.spin);
      ctx.drawImage(img, -p.size / 2, -p.size / 2, p.size, p.size); ctx.restore();
    }
    ctx.restore();
  }
  drawVignette(ctx) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 620);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.72, 'rgba(9,7,14,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0.82)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  drawSigil(ctx, x, y, s, color = C.gold, alpha = 1, t = 0) {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.6) * 0.05);
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, s * 0.045);
    ctx.beginPath(); ctx.arc(0, 0, s * 0.48, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.38, 0, Math.PI * 2); ctx.globalAlpha *= 0.45; ctx.stroke(); ctx.globalAlpha /= 0.45;
    ctx.fillStyle = color;
    ctx.fillRect(-s * 0.055, -s * 0.34, s * 0.11, s * 0.68);
    ctx.fillRect(-s * 0.26, -s * 0.055, s * 0.52, s * 0.11);
    ctx.restore();
  }
  drawLogo(ctx, x, y, scale = 1, alpha = 1) {
    const p = this.paint;
    ctx.save(); ctx.globalAlpha *= alpha;
    const orn = p.tinted('ui-frame-ornate', C.gold, 1);
    ctx.globalAlpha *= 0.10; ctx.drawImage(orn, x - 250 * scale, y - 54 * scale, 500 * scale, 190 * scale);
    ctx.globalAlpha = alpha;
    p.frame(ctx, 'ui-frame-square', x - 230 * scale, y - 48 * scale, 460 * scale, 150 * scale, C.gold, 0.72);
    drawText(ctx, '✝本質✝', x, y + 18 * scale, { size: 56 * scale, font: FONT.jp, color: C.bone, align: 'center', outline: C.void, outlineWidth: 7, shadow: { color: C.crimson, blur: 18 } });
    drawText(ctx, 'THE INVISIBLE BORDER', x, y + 62 * scale, { size: 11 * scale, font: FONT.display, color: C.gold, align: 'center', outline: C.void, outlineWidth: 3 });
    p.divider(ctx, x - 170 * scale, y + 84 * scale, 340 * scale, C.gold, 0.7);
    ctx.restore();
  }
  drawCornerInfo(ctx) {
    const mode = this.commercial ? 'COMMERCIAL BUILD' : 'PERSONAL / NONCOMMERCIAL';
    drawText(ctx, `v1.0.0  ${mode}`, SAFE, H - 22, { size: 8, font: FONT.display, color: C.cool, outline: C.void, outlineWidth: 2 });
    drawText(ctx, '© 2026  HONSHITSU ARCHIVE', W - SAFE, H - 22, { size: 8, font: FONT.display, color: C.cool, align: 'right', outline: C.void, outlineWidth: 2 });
  }
  drawPromptRow(ctx, items, x, y, align = 'center') {
    const p = this.paint;
    ctx.save(); ctx.font = `9px ${FONT.display}`;
    const widths = items.map((it) => ctx.measureText(it.label).width);
    ctx.restore();
    const total = widths.reduce((n, w) => n + 26 + w + 12, 0);
    let cx = align === 'center' ? x - total / 2 : x;
    items.forEach((it, i) => {
      p.icon(ctx, it.id, cx + 11, y, 22, C.bone, 0.9);
      drawText(ctx, it.label, cx + 27, y + 4, { size: 9, font: FONT.display, color: C.parchment, outline: C.void, outlineWidth: 2 });
      cx += 26 + widths[i] + 12;
    });
  }
  drawState(ctx) {
    switch (this.state) {
      case S.BOOT: this.drawBoot(ctx); break;
      case S.LOADING: this.drawLoading(ctx); break;
      case S.TITLE: this.drawTitle(ctx); break;
      case S.MENU: this.drawMenu(ctx); break;
      case S.OPTIONS: this.drawOptions(ctx); break;
      case S.CREDITS: this.drawCredits(ctx); break;
      case S.RESULT: this.drawResult(ctx, false); break;
      case S.GAME_OVER: this.drawResult(ctx, true); break;
    }
  }
  drawBoot(ctx) {
    const t = this.time;
    this.drawSigil(ctx, W / 2, H / 2 - 20, 150, C.gold, 0.85, t);
    this.drawSigil(ctx, W / 2, H / 2 - 20, 96, C.crimson, 0.6, -t * 1.4);
    drawText(ctx, 'HONSHITSU ARCHIVE', W / 2, H / 2 + 110, { size: 15, font: FONT.display, color: C.bone, align: 'center', outline: C.void, outlineWidth: 4, shadow: { color: C.crimson, blur: 10 } });
    drawText(ctx, 'BOOT SEQUENCE', W / 2, H / 2 + 136, { size: 8, font: FONT.display, color: C.cool, align: 'center', outline: C.void, outlineWidth: 2 });
    const w = 190 * clamp(this.bootTimer / 2.1, 0, 1);
    ctx.fillStyle = C.ink; ctx.fillRect(W / 2 - 95, H / 2 + 154, 190, 4);
    ctx.fillStyle = C.gold; ctx.fillRect(W / 2 - 95, H / 2 + 154, w, 4);
  }
  drawLoading(ctx) {
    const pr = this.loader.progress();
    const p = this.paint;
    this.drawSigil(ctx, W / 2, 132, 88, C.gold, 0.35, this.time);
    p.panel(ctx, 120, 176, 720, 270, { alpha: 0.94 });
    drawText(ctx, 'LOADING', W / 2, 218, { size: 20, font: FONT.display, color: C.bone, align: 'center', outline: C.void, outlineWidth: 5, shadow: { color: C.crimson, blur: 12 } });
    p.divider(ctx, 220, 240, 520, C.gold, 0.8);
    p.bar(ctx, 220, 272, 520, 20, pr.ratio, { blue: true });
    drawText(ctx, `${fmt(pr.ratio * 100, 3)}%`, W / 2, 268, { size: 11, font: FONT.display, color: C.bone, align: 'center', outline: C.void, outlineWidth: 3 });
    const hint = HINTS[Math.floor(this.time / 3.2) % HINTS.length];
    p.icon(ctx, 'icon-question', 250, 322, 20, C.gold, 0.9);
    drawText(ctx, hint, 272, 327, { size: 13, font: FONT.jp, color: C.parchment, outline: C.void, outlineWidth: 3 });
    drawText(ctx, 'ACQUISITION LOG', 158, 362, { size: 8, font: FONT.display, color: C.gold, outline: C.void, outlineWidth: 2 });
    const logs = pr.log.slice(-5);
    logs.forEach((e, i) => {
      const col = e.status.startsWith('fallback') || e.status === 'failed' ? C.ember : e.status === 'excluded' ? C.cool : e.status === 'override' ? C.parchment : C.moss;
      drawText(ctx, `[${e.status.toUpperCase()}] ${e.id}`, 158, 380 + i * 13, { size: 8, font: FONT.mono, color: col, outline: C.void, outlineWidth: 2, alpha: 0.95 });
    });
    if (!logs.length) drawText(ctx, '[WAIT] manifest', 158, 380, { size: 8, font: FONT.mono, color: C.moss, outline: C.void, outlineWidth: 2 });
    const prompts = this.input.prompts();
    p.icon(ctx, prompts.confirm, 758, 322, 24, C.bone, 0.8);
    p.icon(ctx, 'prompt-arrows', 790, 322, 24, C.bone, 0.8);
    drawText(ctx, 'BOOT / CACHE / FALLBACK', W / 2, 426, { size: 8, font: FONT.display, color: C.cool, align: 'center', outline: C.void, outlineWidth: 2 });
  }
  drawTitle(ctx) {
    const p = this.paint;
    ctx.save(); ctx.globalAlpha = 0.22; ctx.filter = 'brightness(0.5) saturate(0.5) hue-rotate(220deg)';
    ctx.drawImage(p.shade('tex-door-lit', C.crimson, 0.45), W / 2 - 105, 100, 210, 310);
    ctx.restore();
    this.drawLogo(ctx, W / 2, 205, 1.15, 1);
    const blink = Math.sin(this.time * 4.2) > -0.15;
    if (blink) {
      p.button(ctx, W / 2 - 170, 398, 340, 42, false, 0.85);
      drawText(ctx, 'PRESS ANY KEY', W / 2, 425, { size: 14, font: FONT.display, color: C.bone, align: 'center', outline: C.void, outlineWidth: 4, shadow: { color: C.crimson, blur: 10 } });
    }
    const pr = this.input.prompts();
    this.drawPromptRow(ctx, [{ id: pr.confirm, label: 'START' }, { id: pr.up, label: 'AUDIO' }], W / 2, 470);
    this.drawCornerInfo(ctx);
  }
  drawMenu(ctx) {
    const p = this.paint;
    this.drawLogo(ctx, W / 2, 112, 0.62, 0.95);
    p.frame(ctx, 'ui-frame-simple', 72, 176, 350, 286, C.gold, 0.55);
    drawNineSlice(ctx, p.shade('ui-banner-red', C.blood, 0.35), 82, 184, 330, 40, 12);
    drawText(ctx, 'MAIN MENU', 247, 210, { size: 12, font: FONT.display, color: C.bone, align: 'center', outline: C.void, outlineWidth: 3 });
    p.divider(ctx, 100, 232, 294, C.gold, 0.65);
    MENU_ITEMS.forEach((item, i) => {
      const y = 246 + i * 42;
      const sel = i === this.menuIndex;
      const dim = item === 'CONTINUE' && !this.hasContinue();
      p.button(ctx, 104, y, 286, 34, sel, dim ? 0.42 : 0.92);
      if (sel) {
        const bounce = Math.sin(this.time * 7) * 2 + this.cursorPulse * 6;
        p.icon(ctx, 'ui-cursor', 92, y + 17 + bounce, 26, dim ? C.cool : C.gold, 1);
        ctx.save(); ctx.globalAlpha = 0.25 + this.confirmPulse * 0.4; ctx.strokeStyle = C.gold; ctx.lineWidth = 2;
        roundRect(ctx, 104, y, 286, 34, 5); ctx.stroke(); ctx.restore();
      }
      drawText(ctx, item, 132, y + 22, { size: 11, font: FONT.display, color: dim ? C.cool : sel ? C.bone : C.parchment, outline: C.void, outlineWidth: 3, shadow: sel ? { color: C.crimson, blur: 8 } : null });
    });
    p.panel(ctx, 480, 206, 392, 198, { alpha: 0.88, parchment: false });
    drawText(ctx, 'ARCHIVE STATUS', 676, 236, { size: 11, font: FONT.display, color: C.gold, align: 'center', outline: C.void, outlineWidth: 3 });
    p.divider(ctx, 510, 250, 332, C.gold, 0.6);
    drawText(ctx, 'HIGH SCORE', 510, 282, { size: 9, font: FONT.display, color: C.cool, outline: C.void, outlineWidth: 2 });
    drawText(ctx, fmt(this.high, 7), 842, 282, { size: 13, font: FONT.display, color: C.bone, align: 'right', outline: C.void, outlineWidth: 3 });
    drawText(ctx, 'SAVE', 510, 316, { size: 9, font: FONT.display, color: C.cool, outline: C.void, outlineWidth: 2 });
    drawText(ctx, this.hasContinue() ? 'FOUND' : 'NONE', 842, 316, { size: 11, font: FONT.display, color: this.hasContinue() ? C.moss : C.cool, align: 'right', outline: C.void, outlineWidth: 3 });
    drawText(ctx, 'MODE', 510, 350, { size: 9, font: FONT.display, color: C.cool, outline: C.void, outlineWidth: 2 });
    drawText(ctx, this.commercial ? 'COMMERCIAL' : 'NONCOMMERCIAL', 842, 350, { size: 9, font: FONT.display, color: C.ember, align: 'right', outline: C.void, outlineWidth: 2 });
    p.icon(ctx, 'icon-scroll', 510, 378, 20, C.gold, 0.9);
    drawText(ctx, 'CREDITS = LICENSES', 530, 383, { size: 8, font: FONT.display, color: C.parchment, outline: C.void, outlineWidth: 2 });
    const pr = this.input.prompts();
    this.drawPromptRow(ctx, [{ id: pr.up, label: 'MOVE' }, { id: pr.confirm, label: 'DECIDE' }, { id: pr.cancel, label: 'BACK' }], W / 2, 492);
    this.drawCornerInfo(ctx);
  }
  drawOptions(ctx) {
    const p = this.paint;
    p.panel(ctx, 210, 74, 540, 392, { alpha: 0.96 });
    drawText(ctx, this.optionsPage === 'controls' ? 'CONTROLS' : 'OPTIONS', W / 2, 112, { size: 16, font: FONT.display, color: C.bone, align: 'center', outline: C.void, outlineWidth: 4, shadow: { color: C.crimson, blur: 8 } });
    p.divider(ctx, 260, 128, 440, C.gold, 0.7);
    if (this.optionsPage === 'controls') { this.drawControls(ctx); return; }
    OPTIONS_ITEMS.forEach((item, i) => {
      const y = 152 + i * 48, sel = i === this.optionsIndex;
      p.button(ctx, 248, y, 464, 38, sel, 0.9);
      if (sel) p.icon(ctx, 'ui-cursor', 236, y + 19 + Math.sin(this.time * 7) * 2, 24, C.gold, 1);
      drawText(ctx, item, 272, y + 24, { size: 10, font: FONT.display, color: sel ? C.bone : C.parchment, outline: C.void, outlineWidth: 3 });
      if (i <= 2) {
        const key = ['bgm', 'se', 'voice'][i], v = this.options[key];
        p.bar(ctx, 430, y + 12, 240, 14, v, { blue: i > 0 });
        drawText(ctx, `${fmt(v * 100, 3)}`, 690, y + 24, { size: 9, font: FONT.display, color: C.gold, align: 'right', outline: C.void, outlineWidth: 2 });
      } else if (i === 3) {
        drawText(ctx, document.fullscreenElement ? 'ON' : 'OFF', 690, y + 24, { size: 10, font: FONT.display, color: C.gold, align: 'right', outline: C.void, outlineWidth: 2 });
      } else if (i === 4) {
        p.icon(ctx, 'icon-question', 668, y + 19, 20, C.gold, 0.9);
      } else p.icon(ctx, 'icon-cross', 668, y + 19, 20, C.gold, 0.9);
    });
    const pr = this.input.prompts();
    this.drawPromptRow(ctx, [{ id: pr.up, label: 'SELECT' }, { id: pr.left, label: '±' }, { id: pr.confirm, label: 'OK' }, { id: pr.cancel, label: 'BACK' }], W / 2, 448);
  }
  drawControls(ctx) {
    const p = this.paint;
    const pr = this.input.prompts();
    const cur = this.input.lastDevice;
    const rows = [
      { dev: 'keyboard', label: 'KEYBOARD', prompts: [pr.up, pr.confirm, pr.cancel, 'prompt-arrows', 'prompt-space'], text: 'MOVE / DECIDE / BACK / JUDGE / SEND' },
      { dev: 'pad', label: 'GAMEPAD', prompts: ['prompt-pad-dpad', 'prompt-pad-a', 'prompt-pad-b', 'prompt-pad-dpad', 'prompt-pad-start'], text: 'MOVE / DECIDE / BACK / JUDGE / PAUSE' },
    ];
    rows.forEach((r, i) => {
      const y = 160 + i * 124;
      const active = cur === r.dev;
      p.panel(ctx, 250, y, 460, 100, { alpha: active ? 0.95 : 0.65, frame: active });
      drawText(ctx, r.label, 274, y + 26, { size: 10, font: FONT.display, color: active ? C.gold : C.cool, outline: C.void, outlineWidth: 3 });
      r.prompts.forEach((id, j) => p.icon(ctx, id, 290 + j * 58, y + 62, 26, active ? C.bone : C.cool, active ? 1 : 0.65));
      drawText(ctx, r.text, 690, y + 66, { size: 8, font: FONT.display, color: active ? C.parchment : C.cool, align: 'right', outline: C.void, outlineWidth: 2 });
    });
    p.divider(ctx, 280, 414, 400, C.gold, 0.6);
    this.drawPromptRow(ctx, [{ id: pr.confirm, label: 'BACK' }, { id: pr.cancel, label: 'BACK' }], W / 2, 446);
  }
  drawCredits(ctx) {
    const p = this.paint;
    p.frame(ctx, 'ui-frame-simple', 110, 48, 740, 444, C.gold, 0.45);
    drawText(ctx, 'CREDITS', W / 2, 78, { size: 16, font: FONT.display, color: C.bone, align: 'center', outline: C.void, outlineWidth: 4, shadow: { color: C.crimson, blur: 8 } });
    p.divider(ctx, 180, 92, 600, C.gold, 0.6);
    ctx.save(); ctx.beginPath(); ctx.rect(130, 104, 700, 330); ctx.clip();
    // Staff-roll copy starts on screen at once, then scrolls upward.
    let y = 300 - this.creditsScroll;
    for (const l of this.creditsLines) {
      if (y > 90 && y < 450) drawText(ctx, l.text, W / 2, y, { size: l.size, font: l.font, color: l.color, align: 'center', outline: C.void, outlineWidth: l.size > 12 ? 4 : 2, alpha: 0.95 });
      y += l.h;
    }
    ctx.restore();
    p.icon(ctx, 'icon-scroll', W / 2 - 130, 462, 20, C.gold, 0.9);
    this.drawPromptRow(ctx, [{ id: 'prompt-esc', label: 'BACK' }, { id: 'prompt-enter', label: 'HOLD FAST' }], W / 2 + 40, 464);
  }
  drawPause(ctx) {
    const p = this.paint;
    p.panel(ctx, 300, 118, 360, 304, { damaged: true, alpha: 0.98 });
    drawText(ctx, 'PAUSE', W / 2, 160, { size: 18, font: FONT.display, color: C.bone, align: 'center', outline: C.void, outlineWidth: 4, shadow: { color: C.crimson, blur: 10 } });
    p.divider(ctx, 350, 178, 260, C.gold, 0.7);
    PAUSE_ITEMS.forEach((item, i) => {
      const y = 204 + i * 58, sel = i === this.pauseIndex;
      p.button(ctx, 350, y, 260, 40, sel, 0.92);
      if (sel) p.icon(ctx, 'ui-cursor', 338, y + 20 + Math.sin(this.time * 7) * 2, 24, C.gold, 1);
      drawText(ctx, item, W / 2, y + 26, { size: 11, font: FONT.display, color: sel ? C.bone : C.parchment, align: 'center', outline: C.void, outlineWidth: 3 });
    });
    const pr = this.input.prompts();
    this.drawPromptRow(ctx, [{ id: pr.up, label: 'MOVE' }, { id: pr.confirm, label: 'OK' }, { id: pr.cancel, label: 'RESUME' }], W / 2, 400);
  }
  drawResult(ctx, gameover) {
    const p = this.paint, r = this.run;
    p.panel(ctx, 220, 66, 520, 408, { alpha: 0.97 });
    drawNineSlice(ctx, p.shade(gameover ? 'ui-banner-red' : 'ui-banner-parchment', gameover ? C.blood : C.gold, 0.25), 260, 86, 440, 54, 12);
    drawText(ctx, gameover ? 'GAME OVER' : 'ARCHIVE COMPLETE', W / 2, 121, { size: 16, font: FONT.display, color: C.bone, align: 'center', outline: C.void, outlineWidth: 4, shadow: { color: gameover ? C.crimson : C.gold, blur: 10 } });
    p.icon(ctx, gameover ? 'icon-cross' : 'icon-star', W / 2, 176, 34, gameover ? C.ember : C.gold, 1);
    const acc = r.correct + r.wrong ? Math.round((r.correct / (r.correct + r.wrong)) * 100) : 0;
    const rank = r.score > 5200 ? 'S' : r.score > 3600 ? 'A' : r.score > 2200 ? 'B' : 'C';
    drawText(ctx, 'RANK', 300, 220, { size: 9, font: FONT.display, color: C.cool, outline: C.void, outlineWidth: 2 });
    drawText(ctx, rank, 300, 264, { size: 34, font: FONT.display, color: C.gold, outline: C.void, outlineWidth: 6, shadow: { color: C.crimson, blur: 12 } });
    const stats = [
      ['SCORE', fmt(r.score, 7)], ['MAX COMBO', `×${r.maxCombo}`],
      ['ACCURACY', `${acc}%`], ['HIGH', fmt(this.high, 7)],
    ];
    stats.forEach((s, i) => {
      const y = 214 + i * 34;
      drawText(ctx, s[0], 410, y, { size: 9, font: FONT.display, color: C.cool, outline: C.void, outlineWidth: 2 });
      drawText(ctx, s[1], 680, y, { size: 11, font: FONT.display, color: C.bone, align: 'right', outline: C.void, outlineWidth: 3 });
    });
    p.divider(ctx, 280, 354, 400, C.gold, 0.65);
    RESULT_ITEMS.forEach((item, i) => {
      const y = 370 + i * 44, sel = i === this.resultIndex;
      p.button(ctx, 350, y, 260, 36, sel, 0.92);
      if (sel) p.icon(ctx, 'ui-cursor', 338, y + 18 + Math.sin(this.time * 7) * 2, 22, C.gold, 1);
      drawText(ctx, item, W / 2, y + 24, { size: 10, font: FONT.display, color: sel ? C.bone : C.parchment, align: 'center', outline: C.void, outlineWidth: 3 });
    });
    const pr = this.input.prompts();
    this.drawPromptRow(ctx, [{ id: pr.confirm, label: 'OK' }, { id: pr.cancel, label: 'TITLE' }], W / 2, 456);
  }

  // ---------- gameplay layer ----------
  renderGameplayLayer() {
    const ctx = this.layerCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
    this.composeBackground(ctx, 'game');
    ctx.save();
    if (this.shake > 0.1) ctx.translate(rnd(this.shake, -this.shake), rnd(this.shake, -this.shake));
    this.drawGameplay(ctx);
    ctx.restore();
    if (this.flash > 0.001) {
      ctx.fillStyle = `rgba(244,232,208,${this.flash * 0.35})`; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(134,32,56,${this.flash * 0.22})`; ctx.fillRect(0, 0, W, H);
    }
  }
  drawGameplay(ctx) {
    const p = this.paint, r = this.run;
    this.drawHUD(ctx);
    this.drawCard(ctx);
    this.drawJudgement(ctx);
    this.drawDialogue(ctx);
    this.drawSkillSlots(ctx);
    this.drawParticles(ctx);
    this.drawFloaters(ctx);
    this.drawToasts(ctx);
    // contextual short prompt only
    const pr = this.input.prompts();
    p.icon(ctx, pr.pause, 900, 386, 20, C.cool, 0.7);
    drawText(ctx, 'PAUSE', 918, 390, { size: 8, font: FONT.display, color: C.cool, outline: C.void, outlineWidth: 2 });
  }
  drawHUD(ctx) {
    const p = this.paint, r = this.run, a = this.hudAlpha;
    ctx.save(); ctx.globalAlpha *= a;
    p.panel(ctx, 38, 34, 286, 96, { alpha: 0.82, frame: false });
    drawText(ctx, 'HP', 52, 56, { size: 9, font: FONT.display, color: C.bone, outline: C.void, outlineWidth: 2 });
    p.bar(ctx, 84, 46, 214, 14, r.hp / 100, { ghost: r.ghostHP / 100, color: C.crimson });
    drawText(ctx, fmt(r.hp, 3), 306, 57, { size: 9, font: FONT.display, color: C.bone, align: 'right', outline: C.void, outlineWidth: 2 });
    drawText(ctx, 'MP', 52, 88, { size: 9, font: FONT.display, color: C.bone, outline: C.void, outlineWidth: 2 });
    p.bar(ctx, 84, 78, 214, 14, r.mp / 100, { blue: true });
    drawText(ctx, fmt(r.mp, 3), 306, 89, { size: 9, font: FONT.display, color: C.bone, align: 'right', outline: C.void, outlineWidth: 2 });
    p.panel(ctx, 700, 34, 222, 122, { alpha: 0.82, frame: false });
    drawText(ctx, 'SCORE', 716, 54, { size: 9, font: FONT.display, color: C.cool, outline: C.void, outlineWidth: 2 });
    drawText(ctx, fmt(r.score, 7), 906, 56, { size: 13, font: FONT.display, color: C.bone, align: 'right', outline: C.void, outlineWidth: 3 });
    drawNineSlice(ctx, p.shade('tex-window-frame', C.gold, 0.35), 714, 68, 194, 74, 10);
    ctx.fillStyle = 'rgba(9,7,14,0.78)'; ctx.fillRect(722, 76, 178, 58);
    drawText(ctx, '南棟', 736, 92, { size: 9, font: FONT.jp, color: C.parchment, outline: C.void, outlineWidth: 2 });
    drawText(ctx, '北棟', 736, 122, { size: 9, font: FONT.jp, color: C.parchment, outline: C.void, outlineWidth: 2 });
    const tiles = ['tile-mono-a', 'tile-mono-b', 'tile-mono-c'];
    for (let i = 0; i < 6; i++) {
      const x = 782 + (i % 3) * 32, y = i < 3 ? 80 : 110;
      p.icon(ctx, tiles[i % 3], x, y + 8, 16, i < r.cardIndex % 7 ? C.gold : C.cool, 0.9);
    }
    p.icon(ctx, 'ui-minimap-ring', 872, 106, 34, C.gold, 0.65);
    if (r.level >= 4) p.icon(ctx, 'ui-minimap-exclamation', 872, 106, 16, C.ember, 1);
    else if (r.combo >= 5) p.icon(ctx, 'ui-minimap-star', 872, 106, 16, C.parchment, 1);
    // compact rule banner
    drawNineSlice(ctx, p.shade('ui-banner-red', C.blood, 0.42), 304, 28, 352, 38, 10);
    drawText(ctx, `RULE ${fmt(r.level, 2)}`, 320, 51, { size: 8, font: FONT.display, color: C.gold, outline: C.void, outlineWidth: 2 });
    drawText(ctx, short(this.ruleText(r.rule), 38), 640, 51, { size: 10, font: FONT.jp, color: C.bone, align: 'right', outline: C.void, outlineWidth: 3 });
    p.divider(ctx, 320, 72, 320, C.gold, 0.45);
    // objective at screen edge
    ctx.save(); ctx.translate(22, 310); ctx.rotate(-Math.PI / 2);
    drawText(ctx, `TARGET ${fmt(r.cardIndex + 1, 2)} / ${r.totalCards}   ARCHIVE 60`, 0, 0, { size: 9, font: FONT.display, color: C.gold, align: 'center', outline: C.void, outlineWidth: 3, alpha: 0.75 });
    ctx.restore();
    ctx.restore();
  }
  drawCard(ctx) {
    const p = this.paint, r = this.run;
    const slide = easeOutBack(clamp(r.cardAnim, 0, 1));
    const y = 128 + (1 - slide) * 44;
    ctx.save(); ctx.globalAlpha = slide;
    p.panel(ctx, 268, y, 424, 228, { parchment: true, alpha: 0.97 });
    drawText(ctx, `OBSERVATION ${fmt(r.cardIndex + 1, 2)}`, 480, y + 28, { size: 10, font: FONT.display, color: C.gold, align: 'center', outline: C.void, outlineWidth: 3 });
    p.divider(ctx, 300, y + 38, 360, C.gold, 0.55);
    const cells = [
      ['棟', r.card.wing], ['ネクタイ', r.card.tie], ['スープ', r.card.soup],
      ['偏差値', r.card.dev], ['等高線', r.card.contour], ['配信', r.card.stream],
    ];
    cells.forEach((c, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 300 + col * 190, cy = y + 58 + row * 42;
      ctx.fillStyle = 'rgba(20,15,30,0.55)'; roundRect(ctx, x, cy, 170, 34, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(178,138,78,0.45)'; ctx.lineWidth = 1; ctx.stroke();
      p.icon(ctx, ATTRS[i].icon, x + 18, cy + 17, 17, C.gold, 0.9);
      drawText(ctx, c[0], x + 34, cy + 21, { size: 9, font: FONT.jp, color: C.cool, outline: C.void, outlineWidth: 2 });
      drawText(ctx, c[1], x + 160, cy + 22, { size: 12, font: FONT.jp, color: C.bone, align: 'right', outline: C.void, outlineWidth: 3 });
    });
    const ratio = clamp(r.timeLeft / r.cardTime, 0, 1);
    p.bar(ctx, 300, y + 194, 360, 14, ratio, { blue: true });
    drawText(ctx, r.freeze > 0 ? 'FREEZE' : `${r.timeLeft.toFixed(1)}s`, 480, y + 206, { size: 8, font: FONT.display, color: C.bone, align: 'center', outline: C.void, outlineWidth: 2 });
    if (r.hint) drawText(ctx, r.card.answer ? 'HINT  ✝本質✝' : 'HINT  は？', 480, y + 180, { size: 10, font: FONT.jp, color: C.gold, align: 'center', outline: C.void, outlineWidth: 3 });
    if (r.double) drawText(ctx, '×2', 654, y + 22, { size: 12, font: FONT.display, color: C.ember, align: 'right', outline: C.void, outlineWidth: 3 });
    if (r.phase === 'resolve') {
      ctx.fillStyle = 'rgba(9,7,14,0.82)'; roundRect(ctx, 292, y + 64, 376, 112, 6); ctx.fill();
      drawText(ctx, r.lastCorrect ? 'CORRECT' : r.lastChoice === 'TIMEOUT' ? 'TIMEOUT' : 'MISREAD', 480, y + 108, { size: 20, font: FONT.display, color: r.lastCorrect ? C.gold : C.ember, align: 'center', outline: C.void, outlineWidth: 5, shadow: { color: r.lastCorrect ? C.gold : C.crimson, blur: 14 } });
      drawText(ctx, r.lastChoice === 'ESSENCE' ? '✝本質✝' : r.lastChoice === 'NOISE' ? 'は？' : '—', 480, y + 142, { size: 13, font: FONT.jp, color: C.bone, align: 'center', outline: C.void, outlineWidth: 3 });
    }
    ctx.restore();
  }
  drawJudgement(ctx) {
    const p = this.paint, r = this.run;
    const active = r.phase === 'card';
    const pulse = 1 + Math.sin(this.time * 5) * 0.02;
    p.slot(ctx, 98, 238, 146, 104, false, active ? 0.92 : 0.5);
    p.icon(ctx, 'icon-star', 171, 274, 30 * pulse, C.gold, active ? 1 : 0.55);
    drawText(ctx, '✝本質✝', 171, 316, { size: 12, font: FONT.jp, color: C.bone, align: 'center', outline: C.void, outlineWidth: 3 });
    this.drawPromptRow(ctx, [{ id: 'prompt-arrows', label: '← / Q' }], 171, 334);
    p.slot(ctx, 716, 238, 146, 104, false, active ? 0.92 : 0.5);
    p.icon(ctx, 'icon-cross', 789, 274, 30 * pulse, C.ember, active ? 1 : 0.55);
    drawText(ctx, 'は？', 789, 316, { size: 13, font: FONT.jp, color: C.bone, align: 'center', outline: C.void, outlineWidth: 3 });
    this.drawPromptRow(ctx, [{ id: 'prompt-arrows', label: '→ / E' }], 789, 334);
    drawText(ctx, '[SPACE] 送る   [1-3] SKILL', W / 2, 382, { size: 8, font: FONT.jp, color: C.parchment, align: 'center', outline: C.void, outlineWidth: 2, alpha: 0.7 });
  }
  drawDialogue(ctx) {
    const p = this.paint, d = this.dialogue.current || IDLE_LINE;
    p.panel(ctx, 48, 406, 600, 86, { alpha: 0.94 });
    p.portrait(ctx, d.portrait, 58, 412, 54, 74, 0.96);
    drawNineSlice(ctx, p.shade('ui-banner-parchment', C.gold, 0.25), 122, 412, 132, 24, 8);
    drawText(ctx, d.name, 188, 429, { size: 10, font: FONT.jp, color: C.bone, align: 'center', outline: C.void, outlineWidth: 2 });
    drawText(ctx, d.text, 132, 464, { size: 14, font: FONT.jp, color: C.bone, outline: C.void, outlineWidth: 3 });
    const pr = this.input.prompts();
    p.icon(ctx, this.input.lastDevice === 'pad' ? 'prompt-pad-a' : 'prompt-space', 606, 474, 20, C.gold, 0.85);
    drawText(ctx, '送る', 628, 478, { size: 8, font: FONT.jp, color: C.parchment, outline: C.void, outlineWidth: 2 });
  }
  drawSkillSlots(ctx) {
    const p = this.paint, r = this.run;
    const active = [r.hint, r.double, r.freeze > 0];
    SKILLS.forEach((s, i) => {
      const x = 670 + i * 82, y = 406;
      p.slot(ctx, x, y, 76, 86, active[i], 0.94);
      p.icon(ctx, s.icon, x + 38, y + 28, 22, active[i] ? C.gold : C.parchment, 0.95);
      drawText(ctx, `[${i + 1}]`, x + 38, y + 50, { size: 8, font: FONT.display, color: C.cool, align: 'center', outline: C.void, outlineWidth: 2 });
      drawText(ctx, s.name, x + 38, y + 66, { size: 10, font: FONT.jp, color: C.bone, align: 'center', outline: C.void, outlineWidth: 2 });
      drawText(ctx, `${s.cost} MP`, x + 38, y + 80, { size: 7, font: FONT.display, color: active[i] ? C.gold : C.cool, align: 'center', outline: C.void, outlineWidth: 2 });
    });
  }
  drawParticles(ctx) {
    const p = this.paint;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const q of this.particles) {
      const img = p.tinted(q.id, q.color, 1);
      ctx.save(); ctx.globalAlpha = clamp(q.life / q.max, 0, 1); ctx.translate(q.x, q.y); ctx.rotate(q.spin);
      ctx.drawImage(img, -q.size / 2, -q.size / 2, q.size, q.size); ctx.restore();
    }
    ctx.restore();
  }
  drawFloaters(ctx) {
    for (const f of this.floaters) {
      drawText(ctx, f.text, f.x, f.y, { size: 16, font: FONT.display, color: f.color, align: 'center', outline: C.void, outlineWidth: 4, shadow: { color: f.color, blur: 8 }, alpha: clamp(f.life / f.max, 0, 1) });
    }
  }
  drawToasts(ctx) {
    const p = this.paint;
    this.toasts.forEach((t, i) => {
      const a = clamp(t.life / t.max, 0, 1);
      const y = 92 + i * 30 - (1 - a) * 8;
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(9,7,14,0.86)'; roundRect(ctx, W / 2 - 120, y, 240, 24, 4); ctx.fill();
      ctx.strokeStyle = C.gold; ctx.lineWidth = 1; ctx.stroke();
      drawText(ctx, t.text, W / 2, y + 16, { size: 9, font: FONT.jp, color: t.color, align: 'center', outline: C.void, outlineWidth: 2 });
      ctx.restore();
    });
  }
  drawDebug(ctx) {
    const p = this.paint;
    p.panel(ctx, 16, 16, 470, 188, { alpha: 0.9, frame: false });
    drawText(ctx, 'DEBUG / ASSET LOG', 32, 38, { size: 9, font: FONT.display, color: C.gold, outline: C.void, outlineWidth: 2 });
    drawText(ctx, `COMMERCIAL=${this.commercial}  BUS≈${this.audio.meterDb.toFixed(1)}dB  FALLBACKS=${this.loader.fallbacks.size}`, 32, 54, { size: 7, font: FONT.mono, color: C.cool, outline: C.void, outlineWidth: 2 });
    this.loader.log.slice(-10).forEach((e, i) => {
      drawText(ctx, `[${e.status}] ${e.id} ${short(e.detail, 34)}`, 32, 72 + i * 13, { size: 7, font: FONT.mono, color: e.status.startsWith('fallback') ? C.ember : C.moss, outline: C.void, outlineWidth: 2 });
    });
  }
}
