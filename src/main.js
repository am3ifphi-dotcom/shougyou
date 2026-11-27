import './style.css';
import { Stage } from './stage.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import {
  SCENE_MAP, START_SCENE, CHARACTERS, ENDINGS, MUSIC,
} from './scenario.js';

const META_KEY = 'hachifun-meta-v1';
const SAVES_KEY = 'hachifun-saves-v1';

const DEFAULT_SETTINGS = {
  bgm: 0.62,
  se: 0.72,
  voice: 0.86,
  ambient: 0.4,
  textSpeed: 0.72,
  voiceEnabled: true,
  skipRead: true,
  autoDelay: 1700,
};

const DEFAULT_STATE = () => ({
  settings: { ...DEFAULT_SETTINGS },
  unlocks: { cg: [], music: [], endings: [] },
  flags: { light: 0, truth: 0 },
  seen: [],
  backlog: [],
  saves: [],
  chapter: '序章',
  currentScene: START_SCENE,
  ending: null,
});

const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
};

class Game {
  constructor() {
    this.gameRoot = document.querySelector('#game');
    this.stageRoot = document.querySelector('#stage');
    this.stage = new Stage(this.stageRoot);
    this.state = this.loadState();
    this.seen = new Set(this.state.seen || []);
    this.audio = new AudioEngine(this.state.settings);
    this.ui = new UI(this.gameRoot, this.makeCallbacks());

    this.screen = 'title';
    this.currentSceneId = null;
    this.currentNode = null;
    this.currentLine = null;
    this.mode = { auto: false, skip: false };
    this.paused = false;
    this.transitioning = false;
    this.typeTimer = null;
    this.autoTimer = null;
    this.skipTimer = null;
    this.choiceTimer = null;
    this.branchTimer = null;
    this.lastHover = 0;
    this.gamepadPrev = {};
  }

  loadState() {
    const raw = readJson(META_KEY, {});
    const base = DEFAULT_STATE();
    const saves = readJson(SAVES_KEY, []);
    const currentScene = SCENE_MAP.has(raw.currentScene) ? raw.currentScene : START_SCENE;
    return {
      ...base,
      settings: { ...base.settings, ...(raw.settings || {}) },
      unlocks: {
        cg: [...new Set([...(raw.unlocks?.cg || [])])],
        music: [...new Set([...(raw.unlocks?.music || [])])],
        endings: [...new Set([...(raw.unlocks?.endings || [])])],
      },
      flags: { ...base.flags, ...(raw.flags || {}) },
      seen: Array.isArray(raw.seen) ? raw.seen : [],
      backlog: Array.isArray(raw.backlog) ? raw.backlog.slice(-160) : [],
      saves: Array.isArray(saves) ? saves.slice(0, 8) : [],
      chapter: raw.chapter || '序章',
      currentScene,
      ending: raw.ending || null,
    };
  }

  persistMeta() {
    const data = {
      settings: this.state.settings,
      unlocks: this.state.unlocks,
      flags: this.state.flags,
      seen: [...this.seen],
      backlog: this.state.backlog.slice(-160),
      chapter: this.state.chapter,
      currentScene: this.state.currentScene,
      ending: this.state.ending,
    };
    try { localStorage.setItem(META_KEY, JSON.stringify(data)); } catch { /* storage disabled */ }
  }

  persistSaves() {
    try { localStorage.setItem(SAVES_KEY, JSON.stringify(this.state.saves.slice(0, 8))); } catch { /* ignore */ }
  }

  unlock(kind, value) {
    if (!value || !this.state.unlocks[kind]) return;
    if (!this.state.unlocks[kind].includes(value)) {
      this.state.unlocks[kind].push(value);
      this.persistMeta();
    }
  }

  unlockMany(values) {
    if (!Array.isArray(values)) return;
    for (const value of values) this.unlock('cg', value);
  }

  makeCallbacks() {
    return {
      getState: () => this.state,
      onTitle: () => this.setupTitlePresentation(),
      onTitleAction: () => { this.audio.unlock(); this.audio.playSe('click'); },
      onNewGame: () => this.startNewGame(),
      onContinue: () => this.continueGame(),
      onQuick: (action) => this.handleQuick(action),
      onHover: () => this.playHover(),
      onChoiceShown: () => this.audio.playSe('message'),
      onSave: (slot) => this.saveGame(slot),
      onLoad: (slot) => this.loadGame(slot),
      onSetting: (key, value) => this.updateSetting(key, value),
      onMusicPlay: (track) => this.playArchiveMusic(track),
      onMusicStop: () => this.stopArchiveMusic(),
      onReturnTitle: () => this.returnToTitle(true),
      onOverlayOpen: () => this.pauseForOverlay(),
      onOverlayClose: () => this.resumeFromOverlay(),
    };
  }

  async start() {
    this.audio.onMusicPlay = (name) => this.unlock('music', name);
    this.audio.onVoiceStart = () => this.ui.setVoicePlaying(true);
    this.audio.onVoiceEnd = () => this.ui.setVoicePlaying(false);
    this.stage.onBackground = (name) => this.unlock('cg', name);

    try { await this.stage.init(); }
    catch (error) { console.error('[game] stage init failed', error); }

    this.bindGlobalEvents();
    this.ui.setModes(this.mode);
    this.ui.showTitle(this.state);
  }

  bindGlobalEvents() {
    this.gameRoot.addEventListener('pointerdown', (event) => {
      this.audio.unlock();
      if (event.target.closest('button, .modal-panel, .modal-backdrop, .title-menu, .choice-panel, .quick-menu, .chapter-overlay, .cg-overlay, .ending-overlay, .hidden-hint')) return;
      if (this.screen !== 'game' || this.ui.overlayOpen) return;
      this.advance();
    });

    window.addEventListener('keydown', (event) => {
      this.audio.unlock();
      if (this.ui.handleOverlayKey(event)) return;
      if (this.ui.overlayOpen) return;
      if (this.ui.handleTitleKey(event)) return;
      if (this.screen !== 'game') return;

      if (this.ui.chapterResolver || this.ui.cgResolver || this.ui.endingResolver) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (this.ui.chapterResolver) this.ui.resolveChapter();
          else if (this.ui.cgResolver) this.ui.resolveCg();
          else if (this.ui.endingResolver) this.ui.resolveEnding();
        }
        return;
      }

      if (event.key === 'Escape') { this.ui.openOverlay('system', this.state); return; }
      if (this.ui.handleChoiceKey(event)) return;
      const key = event.key.toLowerCase();
      if (key === 'a') { this.toggleAuto(); return; }
      if (key === 's') { this.toggleSkip(); return; }
      if (key === 'b') { this.ui.openOverlay('backlog', this.state); return; }
      if (key === 'h' || event.key === 'Control') { this.toggleHidden(); return; }
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        this.advance();
      }
    });

    const pollGamepad = () => {
      const pad = navigator.getGamepads?.().find(Boolean);
      if (pad) this.handleGamepad(pad);
      requestAnimationFrame(pollGamepad);
    };
    requestAnimationFrame(pollGamepad);
  }

  handleGamepad(pad) {
    const pressed = (i) => !!pad.buttons[i]?.pressed;
    const just = (i) => pressed(i) && !this.gamepadPrev[i];
    for (let i = 0; i < pad.buttons.length; i += 1) this.gamepadPrev[i] = pressed(i);

    if (just(9)) {
      if (this.ui.overlayOpen) this.ui.closeOverlay();
      else if (this.screen === 'game') this.ui.openOverlay('system', this.state);
      return;
    }
    if (this.ui.overlayOpen) {
      if (just(1)) this.ui.closeOverlay();
      return;
    }
    if (this.screen === 'title') {
      if (just(12) || just(14)) this.ui.moveTitle(-1);
      if (just(13) || just(15)) this.ui.moveTitle(1);
      if (just(0)) this.ui.activateTitle();
      return;
    }
    if (this.screen === 'game') {
      if (just(0)) this.advance();
      else if (just(1)) this.ui.openOverlay('backlog', this.state);
      else if (just(2)) this.toggleAuto();
      else if (just(3)) this.toggleSkip();
    }
  }

  playHover() {
    const now = performance.now();
    if (now - this.lastHover < 90) return;
    this.lastHover = now;
    this.audio.playSe('hover');
  }

  setupTitlePresentation() {
    this.screen = 'title';
    this.stage.setCharacters({});
    this.stage.setFocus(null);
    this.stage.setLive2D(false);
    this.stage.setBackground('observatory_dusk', 1000);
    this.stage.setAmbient('dusk');
    this.audio.setAmbient('dusk');
    this.audio.playBgm('title');
    this.ui.setModes({ auto: false, skip: false });
    this.ui.setHiddenText(false);
  }

  startNewGame() {
    this.audio.unlock();
    this.state.flags = { light: 0, truth: 0 };
    this.state.backlog = [];
    this.state.chapter = '序章';
    this.state.ending = null;
    this.state.currentScene = START_SCENE;
    this.seen.clear();
    this.persistMeta();
    this.beginGame(START_SCENE);
  }

  continueGame() {
    const id = SCENE_MAP.has(this.state.currentScene) ? this.state.currentScene : START_SCENE;
    const node = SCENE_MAP.get(id);
    if (!node || node.type === 'ending') {
      this.ui.showToast('つづきのデータがありません。はじめから開始します。');
      this.startNewGame();
      return;
    }
    this.beginGame(id);
  }

  beginGame(sceneId) {
    this.audio.unlock();
    this.ui.closeOverlay();
    this.ui.showGame();
    this.screen = 'game';
    this.mode = { auto: false, skip: false };
    this.paused = false;
    this.ui.setModes(this.mode);
    this.ui.setHiddenText(false);
    this.state.currentScene = sceneId;
    this.enterScene(sceneId);
  }

  returnToTitle(force = false) {
    if (force) {
      this.ui.resolveChapter();
      this.ui.resolveCg();
      this.ui.resolveEnding();
    }
    this.clearTimers();
    this.audio.stopVoice();
    this.currentLine = null;
    this.currentNode = null;
    this.currentSceneId = null;
    this.mode = { auto: false, skip: false };
    this.paused = false;
    this.transitioning = false;
    this.ui.closeOverlay();
    this.ui.showTitle(this.state);
  }

  clearTimers() {
    for (const key of ['typeTimer', 'autoTimer', 'skipTimer', 'choiceTimer', 'branchTimer']) {
      window.clearTimeout(this[key]);
      this[key] = null;
    }
  }

  async enterScene(id) {
    if (id === 'title') { this.returnToTitle(); return; }
    const node = SCENE_MAP.get(id);
    if (!node) { console.warn('[game] missing scene', id); this.returnToTitle(); return; }
    this.clearTimers();
    this.transitioning = true;
    this.paused = false;
    this.currentSceneId = id;
    this.currentNode = node;
    this.currentLine = null;
    this.state.currentScene = id;
    this.audio.stopVoice();
    this.ui.setVoicePlaying(false);
    this.applyScene(node);
    this.transitioning = false;

    switch (node.type) {
      case 'say':
        this.showSay(node);
        break;
      case 'chapter':
        this.state.chapter = node.title;
        this.persistMeta();
        await this.ui.showChapter(node);
        if (this.screen === 'game' && this.currentSceneId === id) this.enterScene(node.next);
        break;
      case 'cg':
        this.unlockMany(node.unlock);
        await this.ui.showCg(node);
        if (this.screen === 'game' && this.currentSceneId === id) this.enterScene(node.next);
        break;
      case 'choice':
        this.showChoice(node);
        break;
      case 'branch':
        this.handleBranch(node);
        break;
      case 'ending':
        await this.showEnding(node);
        break;
      default:
        break;
    }
    if (this.ui.overlayOpen) this.paused = true;
    this.persistMeta();
  }

  applyScene(node) {
    const chapterTag = document.querySelector('#chapter-tag-text');
    const chapterLabel = node.type === 'chapter' ? node.title : this.state.chapter;
    if (chapterTag) chapterTag.textContent = chapterLabel || '序章';
    const bg = node.image || node.bg;
    if (bg) this.stage.setBackground(bg, node.fx?.includes('dissolve') ? 1250 : 900);
    if (node.music) this.audio.playBgm(node.music);
    if (Object.prototype.hasOwnProperty.call(node, 'ambient')) {
      this.stage.setAmbient(node.ambient);
      this.audio.setAmbient(node.ambient);
    }
    if (Object.prototype.hasOwnProperty.call(node, 'live2d')) this.stage.setLive2D(node.live2d);
    if (node.chars) this.stage.setCharacters(node.chars);
    this.stage.setFocus(node.speakerId || null);
    if (node.fx) this.stage.applyEffects(node.fx);
    if (node.se) this.audio.playSe(node.se);
    if (node.voice) this.audio.playVoice(node.voice);
    if (node.unlock) this.unlockMany(node.unlock);
    this.persistMeta();
  }

  showSay(node) {
    if (this.ui.overlayOpen || this.screen !== 'game') return;
    this.addBacklog(node);
    this.ui.prepareLine(node);
    this.ui.setText('', false);
    this.currentLine = { node, full: node.text, chars: Array.from(node.text), visible: 0, complete: false };

    if (this.mode.skip && this.state.settings.skipRead && !this.seen.has(node.id)) {
      this.mode.skip = false;
      this.ui.setModes(this.mode);
      this.ui.showToast('未読テキストでスキップを停止しました。');
    }
    if (this.mode.skip) {
      this.finishTyping();
      return;
    }
    this.typeNext();
  }

  typeNext() {
    const line = this.currentLine;
    if (!line || line.complete) return;
    const ch = line.chars[line.visible] ?? '';
    line.visible += 1;
    this.ui.setText(line.chars.slice(0, line.visible).join(''), false);
    if (line.visible >= line.chars.length) { this.finishTyping(); return; }
    this.typeTimer = window.setTimeout(() => this.typeNext(), this.charDelay(ch));
  }

  charDelay(ch) {
    const speed = this.state.settings.textSpeed ?? 0.72;
    const base = 54 - 44 * speed;
    if ('。、！？…'.includes(ch)) return base * 2.6;
    if (ch === '\n') return base * 4;
    return base;
  }

  finishTyping() {
    window.clearTimeout(this.typeTimer);
    this.typeTimer = null;
    const line = this.currentLine;
    if (!line) return;
    line.visible = line.chars.length;
    line.complete = true;
    this.ui.setText(line.full, true);
    this.seen.add(line.node.id);
    this.persistMeta();
    this.scheduleAdvance();
  }

  addBacklog(node) {
    const meta = node.speakerId ? CHARACTERS[node.speakerId] : null;
    this.state.backlog.push({
      speakerId: node.speakerId,
      speakerName: meta?.name || '',
      text: node.text,
    });
    if (this.state.backlog.length > 160) this.state.backlog.shift();
  }

  showChoice(node) {
    this.mode.auto = false;
    this.mode.skip = false;
    this.ui.setModes(this.mode);
    this.ui.showChoices(node.prompt, node.options, (option) => {
      for (const [flag, delta] of Object.entries(option.set || {})) {
        this.state.flags[flag] = (this.state.flags[flag] || 0) + delta;
      }
      this.audio.playSe(option.se || 'confirm');
      this.ui.showToast(option.feedback || '', 1450);
      this.paused = true;
      this.persistMeta();
      this.choiceTimer = window.setTimeout(() => {
        this.paused = false;
        this.enterScene(option.goto);
      }, 900);
    });
  }

  handleBranch(node) {
    const ok = Object.entries(node.when || {}).every(([flag, threshold]) => (this.state.flags[flag] || 0) >= threshold);
    this.audio.playSe('ding');
    this.paused = true;
    this.branchTimer = window.setTimeout(() => {
      this.paused = false;
      this.enterScene(ok ? node.yes : node.no);
    }, 420);
  }

  async showEnding(node) {
    this.mode.auto = false;
    this.mode.skip = false;
    this.ui.setModes(this.mode);
    this.state.ending = node.endingId;
    this.unlock('endings', node.endingId);
    if (node.bg) this.unlock('cg', node.bg);
    this.persistMeta();
    const meta = ENDINGS.find((ending) => ending.id === node.endingId) || ENDINGS[0];
    await this.ui.showEnding(node, meta, this.state);
    if (this.screen === 'game') this.returnToTitle();
  }

  advance() {
    if (this.screen !== 'game' || this.paused || this.transitioning || this.ui.overlayOpen) return;
    if (this.ui.chapterResolver || this.ui.cgResolver || this.ui.endingResolver) return;
    if (!this.currentLine) return;
    if (!this.currentLine.complete) { this.finishTyping(); return; }
    const node = this.currentLine.node;
    this.currentLine = null;
    const next = node.goto || node.next;
    if (!next || next === 'title') { this.returnToTitle(); return; }
    this.enterScene(next);
  }

  scheduleAdvance() {
    window.clearTimeout(this.autoTimer);
    window.clearTimeout(this.skipTimer);
    if (!this.currentLine?.complete || this.paused || this.ui.overlayOpen || this.transitioning) return;
    if (this.mode.skip) {
      this.skipTimer = window.setTimeout(() => this.advance(), 70);
    } else if (this.mode.auto) {
      const length = this.currentLine.full.length;
      const delay = Math.max(1200, Math.min(3000, this.state.settings.autoDelay + length * 24));
      this.autoTimer = window.setTimeout(() => this.advance(), delay);
    }
  }

  toggleAuto() {
    if (this.screen !== 'game' || this.ui.overlayOpen) return;
    this.mode.auto = !this.mode.auto;
    if (this.mode.auto) this.mode.skip = false;
    this.ui.setModes(this.mode);
    this.audio.playSe('confirm');
    if (this.currentLine?.complete) this.scheduleAdvance();
  }

  toggleSkip() {
    if (this.screen !== 'game' || this.ui.overlayOpen) return;
    this.mode.skip = !this.mode.skip;
    if (this.mode.skip) this.mode.auto = false;
    if (this.mode.skip && this.currentLine && this.state.settings.skipRead && !this.seen.has(this.currentLine.node.id)) {
      this.mode.skip = false;
      this.ui.showToast('未読テキストのためスキップできません。');
    }
    this.ui.setModes(this.mode);
    this.audio.playSe('confirm');
    if (this.mode.skip && this.currentLine && !this.currentLine.complete) this.finishTyping();
    else if (this.currentLine?.complete) this.scheduleAdvance();
  }

  toggleHidden() {
    if (this.screen !== 'game') return;
    this.ui.setHiddenText(!this.ui.hiddenText);
    this.audio.playSe('click');
  }

  handleQuick(action) {
    if (action !== 'hide' && this.screen !== 'game' && !['save', 'load', 'settings', 'gallery', 'music', 'endings', 'credits'].includes(action)) return;
    switch (action) {
      case 'auto': this.toggleAuto(); break;
      case 'skip': this.toggleSkip(); break;
      case 'save': this.ui.openOverlay('save', this.state); break;
      case 'load': this.ui.openOverlay('load', this.state); break;
      case 'backlog': this.ui.openOverlay('backlog', this.state); break;
      case 'menu': this.ui.openOverlay('system', this.state); break;
      case 'settings': this.ui.openOverlay('settings', this.state); break;
      case 'gallery': this.ui.openOverlay('gallery', this.state); break;
      case 'music': this.ui.openOverlay('music', this.state); break;
      case 'endings': this.ui.openOverlay('endings', this.state); break;
      case 'credits': this.ui.openOverlay('credits', this.state); break;
      case 'hide': this.toggleHidden(); break;
      default: break;
    }
  }

  pauseForOverlay() {
    this.paused = true;
    window.clearTimeout(this.autoTimer);
    window.clearTimeout(this.skipTimer);
  }

  resumeFromOverlay() {
    this.paused = false;
    if (this.screen === 'game' && this.currentLine?.complete) this.scheduleAdvance();
  }

  updateSetting(key, value) {
    this.state.settings[key] = value;
    if (['bgm', 'se', 'voice', 'ambient'].includes(key)) this.audio.setVolume(key, value);
    if (key === 'voiceEnabled' && !value) this.audio.stopVoice();
    this.persistMeta();
  }

  saveGame(slot) {
    const snapshot = {
      timestamp: Date.now(),
      chapter: this.state.chapter,
      sceneId: this.currentSceneId || this.state.currentScene,
      flags: { ...this.state.flags },
      settings: { ...this.state.settings },
      backlog: this.state.backlog.slice(-80),
      seen: [...this.seen],
      unlocks: JSON.parse(JSON.stringify(this.state.unlocks)),
      ending: null,
    };
    this.state.saves[slot] = snapshot;
    this.persistSaves();
    this.persistMeta();
    this.audio.playSe('confirm');
    this.ui.showToast(`SLOT ${String(slot + 1).padStart(2, '0')} にセーブしました。`);
    this.ui.openOverlay('save', this.state);
  }

  loadGame(slot) {
    const snapshot = this.state.saves[slot];
    if (!snapshot || !SCENE_MAP.has(snapshot.sceneId)) {
      this.ui.showToast('データがありません。');
      this.audio.playSe('cancel');
      return;
    }
    this.state.flags = { ...snapshot.flags };
    this.state.settings = { ...DEFAULT_SETTINGS, ...(snapshot.settings || {}) };
    this.state.backlog = Array.isArray(snapshot.backlog) ? snapshot.backlog : [];
    this.state.chapter = snapshot.chapter || 'つづきから';
    this.state.ending = null;
    this.state.currentScene = snapshot.sceneId;
    this.seen = new Set(Array.isArray(snapshot.seen) ? snapshot.seen : []);
    for (const kind of ['cg', 'music', 'endings']) {
      this.state.unlocks[kind] = [...new Set([...this.state.unlocks[kind], ...(snapshot.unlocks?.[kind] || [])])];
    }
    for (const key of ['bgm', 'se', 'voice', 'ambient']) this.audio.setVolume(key, this.state.settings[key]);
    this.audio.settings = this.state.settings;
    this.persistMeta();
    this.audio.playSe('confirm');
    this.beginGame(snapshot.sceneId);
  }

  playArchiveMusic(track) {
    if (!MUSIC[track]) return;
    this.audio.unlock();
    this.audio.playBgm(track, 800);
    this.audio.playSe('confirm');
    this.ui.showToast(`♪ ${MUSIC[track].title}`);
  }

  stopArchiveMusic() {
    this.audio.stopBgm(500);
    if (this.screen === 'title') this.audio.playBgm('title', 800);
  }
}

const game = new Game();
game.start();
