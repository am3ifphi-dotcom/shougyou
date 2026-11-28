/* 音響エンジン — BGMクロスフェード / SE / ボイスダッキング / 解放管理 */
import { Howl, Howler } from 'howler';

export type BgmKey =
  | 'stardust' | 'home' | 'cafe' | 'quiet' | 'sadpiano' | 'tender' | 'canon' | 'ancient';

export type SeKey =
  | 'click' | 'hover' | 'confirm' | 'cancel' | 'select' | 'page'
  | 'chime' | 'pour' | 'clink' | 'star' | 'kettle' | 'train' | 'flip'
  | 'doorOpen' | 'doorClose' | 'footstep1' | 'footstep2';

export type VoiceKey =
  | 'setsuko_question'
  | 'setsuko_promise'
  | 'setsuko_final_ask'
  | 'setsuko_final_answer'
  | 'tooru_answer'
  | 'tooru_quiet'
  | 'tooru_grandson';

const BGM_PATHS: Record<BgmKey, string> = {
  stardust: 'assets/audio/bgm/bgm_stardust.mp3',
  home:     'assets/audio/bgm/bgm_home.mp3',
  cafe:     'assets/audio/bgm/bgm_cafe.mp3',
  quiet:    'assets/audio/bgm/bgm_quiet.mp3',
  sadpiano: 'assets/audio/bgm/bgm_sadpiano.mp3',
  tender:   'assets/audio/bgm/bgm_tender.mp3',
  canon:    'assets/audio/bgm/bgm_canon.mp3',
  ancient:  'assets/audio/bgm/bgm_ancient.mp3',
};

const SE_PATHS: Record<SeKey, string> = {
  click:     'assets/audio/se/se_click.ogg',
  hover:     'assets/audio/se/se_hover.ogg',
  confirm:   'assets/audio/se/se_confirm.ogg',
  cancel:    'assets/audio/se/se_cancel.ogg',
  select:    'assets/audio/se/se_select.ogg',
  page:      'assets/audio/se/se_page.ogg',
  chime:     'assets/audio/se/se_chime.wav',
  pour:      'assets/audio/se/se_pour.wav',
  clink:     'assets/audio/se/se_clink.wav',
  star:      'assets/audio/se/se_star.wav',
  kettle:    'assets/audio/se/se_kettle.wav',
  train:     'assets/audio/se/se_train.wav',
  flip:      'assets/audio/se/se_flip.wav',
  doorOpen:  'assets/audio/se/se_door_open.ogg',
  doorClose: 'assets/audio/se/se_door_close.ogg',
  footstep1: 'assets/audio/se/se_footstep1.ogg',
  footstep2: 'assets/audio/se/se_footstep2.ogg',
};

const VOICE_PATHS: Record<VoiceKey, string> = {
  setsuko_question:     'assets/audio/voice/setsuko_question.mp3',
  setsuko_promise:      'assets/audio/voice/setsuko_promise.mp3',
  setsuko_final_ask:    'assets/audio/voice/setsuko_final_ask.mp3',
  setsuko_final_answer: 'assets/audio/voice/setsuko_final_answer.mp3',
  tooru_answer:         'assets/audio/voice/tooru_answer.mp3',
  tooru_quiet:          'assets/audio/voice/tooru_quiet.mp3',
  tooru_grandson:       'assets/audio/voice/tooru_grandson.mp3',
};

export const BGM_META: Record<BgmKey, { title: string; sub: string }> = {
  stardust: { title: 'stardust',              sub: 'theme of 星屑珈琲 — t.sidu' },
  home:     { title: 'Home',                  sub: 'Komiku' },
  cafe:     { title: 'Mellow Café Vibe',      sub: 'John Bartmann' },
  quiet:    { title: 'Quiet Saturday',        sub: 'Komiku' },
  sadpiano: { title: 'Sad walk with sad piano', sub: 'Komiku' },
  tender:   { title: 'Tender Moment',         sub: 'John Bartmann' },
  canon:    { title: 'Canon in D Major (Piano Only)', sub: 'Ava Drumm' },
  ancient:  { title: 'Ancient Memories',      sub: 'HoliznaCC0' },
};

interface UnlockStore {
  cgs: string[];
  bgms: BgmKey[];
  endings: string[];
}

const UNLOCK_KEY = 'hoshikuzu_unlocks_v1';

function loadUnlocks(): UnlockStore {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (raw) return JSON.parse(raw) as UnlockStore;
  } catch { /* ignore */ }
  return { cgs: [], bgms: [], endings: [] };
}

function saveUnlocks(u: UnlockStore) {
  try { localStorage.setItem(UNLOCK_KEY, JSON.stringify(u)); } catch { /* ignore */ }
}

class AudioEngine {
  private bgmA: Howl | null = null;
  private bgmB: Howl | null = null;
  private currentBgm: BgmKey | null = null;
  private activeSlot: 'A' | 'B' = 'A';
  private voiceHowl: Howl | null = null;
  private seCache = new Map<SeKey, Howl>();
  private unlocks: UnlockStore = loadUnlocks();
  private listeners: Array<(u: UnlockStore) => void> = [];

  bgmVolume = 0.62;
  seVolume = 0.85;
  voiceVolume = 0.9;

  constructor() {
    Howler.volume(1);
    try {
      const cfg = localStorage.getItem('hoshikuzu_config_v1');
      if (cfg) {
        const c = JSON.parse(cfg);
        if (typeof c.bgmVolume === 'number') this.bgmVolume = c.bgmVolume;
        if (typeof c.seVolume === 'number') this.seVolume = c.seVolume;
        if (typeof c.voiceVolume === 'number') this.voiceVolume = c.voiceVolume;
      }
    } catch { /* ignore */ }
  }

  onUnlock(fn: (u: UnlockStore) => void) { this.listeners.push(fn); }
  getUnlocks(): UnlockStore { return JSON.parse(JSON.stringify(this.unlocks)); }

  private emitUnlock() {
    saveUnlocks(this.unlocks);
    for (const fn of this.listeners) fn(this.getUnlocks());
  }

  unlockCg(id: string) {
    if (!this.unlocks.cgs.includes(id)) { this.unlocks.cgs.push(id); this.emitUnlock(); }
  }
  unlockEnding(id: string) {
    if (!this.unlocks.endings.includes(id)) { this.unlocks.endings.push(id); this.emitUnlock(); }
  }
  private unlockBgm(key: BgmKey) {
    if (!this.unlocks.bgms.includes(key)) { this.unlocks.bgms.push(key); this.emitUnlock(); }
  }

  persistConfig(cfg: Record<string, unknown>) {
    try { localStorage.setItem('hoshikuzu_config_v1', JSON.stringify(cfg)); } catch { /* ignore */ }
  }

  /* ---------- BGM ---------- */
  playBGM(key: BgmKey | null, fadeSeconds = 1.6) {
    if (key === this.currentBgm) return;
    if (key) this.unlockBgm(key);
    const fadeMs = Math.max(80, fadeSeconds * 1000);

    const oldA = this.bgmA, oldB = this.bgmB;
    const fadeOut = (h: Howl | null) => {
      if (!h) return;
      h.fade(h.volume(), 0, fadeMs);
      h.once('fade', () => { h.stop(); h.unload(); });
    };

    if (!key) {
      fadeOut(oldA); fadeOut(oldB);
      this.currentBgm = null;
      return;
    }

    const next = new Howl({ src: [BGM_PATHS[key]], loop: true, volume: 0, html5: true });
    if (this.activeSlot === 'A') { this.bgmB = next; this.activeSlot = 'B'; }
    else { this.bgmA = next; this.activeSlot = 'A'; }
    this.currentBgm = key;

    next.once('play', () => next.fade(0, this.bgmVolume, fadeMs));
    next.play();
    if (next.state() === 'loaded') next.fade(0, this.bgmVolume, fadeMs);

    fadeOut(oldA); fadeOut(oldB);
  }

  stopBGM(fadeSeconds = 1.2) { this.playBGM(null, fadeSeconds); }

  currentBgmKey(): BgmKey | null { return this.currentBgm; }

  applyVolumes(bgm: number, se: number, voice: number) {
    this.bgmVolume = bgm; this.seVolume = se; this.voiceVolume = voice;
    const active = this.activeSlot === 'A' ? this.bgmA : this.bgmB;
    if (active) active.volume(bgm);
    if (this.voiceHowl) this.voiceHowl.volume(voice);
  }

  /* ---------- SE ---------- */
  playSE(key: SeKey, volumeScale = 1) {
    let h = this.seCache.get(key);
    if (!h) {
      h = new Howl({ src: [SE_PATHS[key]], volume: this.seVolume });
      this.seCache.set(key, h);
    }
    h.volume(this.seVolume * volumeScale);
    h.play();
  }

  /* ---------- Voice（BGMダッキング付き） ---------- */
  playVoice(key: VoiceKey, onEnd?: () => void) {
    if (this.voiceHowl) { this.voiceHowl.stop(); this.voiceHowl = null; }
    const active = this.activeSlot === 'A' ? this.bgmA : this.bgmB;
    const duck = () => { if (active) active.fade(active.volume(), this.bgmVolume * 0.32, 250); };
    const restore = () => { if (active) active.fade(active.volume(), this.bgmVolume, 450); };

    const v = new Howl({
      src: [VOICE_PATHS[key]],
      volume: this.voiceVolume,
      onplay: duck,
      onend: () => { restore(); this.voiceHowl = null; onEnd?.(); },
      onloaderror: () => { restore(); this.voiceHowl = null; onEnd?.(); },
      onplayerror: () => { restore(); this.voiceHowl = null; onEnd?.(); },
    });
    this.voiceHowl = v;
    v.play();
  }

  stopVoice() {
    if (this.voiceHowl) { this.voiceHowl.stop(); this.voiceHowl = null; }
  }

  /* タイトル画面などの一括停止 */
  stopAll() {
    this.stopBGM(0.6);
    this.stopVoice();
  }
}

export const audio = new AudioEngine();
