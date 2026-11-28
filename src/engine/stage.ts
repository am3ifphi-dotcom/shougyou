/* ステージ制御 — 背景クロスフェード / CG / 立ち絵 */
import { fx, type ParticleMode } from './fx';

export type BgKey =
  | 'cafe_day' | 'cafe_evening' | 'cafe_closed' | 'street'
  | 'hospital' | 'harbor' | 'starsky';

export type CharId = 'tooru' | 'setsuko' | 'wada' | 'genzo';
export type SpriteSlot = 'left' | 'center' | 'right';

export const BG_CONFIG: Record<BgKey, { src: string; particle: ParticleMode; kenBurns: boolean }> = {
  cafe_day:     { src: 'assets/bg/bg_cafe_day.jpg',     particle: 'dust',  kenBurns: true  },
  cafe_evening: { src: 'assets/bg/bg_cafe_evening.jpg', particle: 'dust',  kenBurns: true  },
  cafe_closed:  { src: 'assets/bg/bg_cafe_closed.jpg',  particle: 'none',  kenBurns: false },
  street:       { src: 'assets/bg/bg_street.jpg',       particle: 'none',  kenBurns: true  },
  hospital:     { src: 'assets/bg/bg_hospital.jpg',     particle: 'none',  kenBurns: false },
  harbor:       { src: 'assets/bg/bg_harbor.jpg',       particle: 'dust',  kenBurns: true  },
  starsky:      { src: 'assets/bg/bg_starsky.jpg',      particle: 'stars', kenBurns: false },
};

export const SPRITE_PATHS: Record<CharId, Record<string, string>> = {
  tooru: {
    normal:    'assets/sprites/sp_tooru_normal.png',
    smile:     'assets/sprites/sp_tooru_smile.png',
    sad:       'assets/sprites/sp_tooru_sad.png',
    angry:     'assets/sprites/sp_tooru_angry.png',
    surprised: 'assets/sprites/sp_tooru_surprised.png',
  },
  setsuko: {
    normal:  'assets/sprites/sp_setsuko_normal.png',
    smile:   'assets/sprites/sp_setsuko_smile.png',
    gentle:  'assets/sprites/sp_setsuko_gentle.png',
    blank:   'assets/sprites/sp_setsuko_blank.png',
    crying:  'assets/sprites/sp_setsuko_crying.png',
  },
  wada: {
    normal:  'assets/sprites/sp_wada_normal.png',
    smile:   'assets/sprites/sp_wada_smile.png',
    serious: 'assets/sprites/sp_wada_serious.png',
  },
  genzo: {
    normal: 'assets/sprites/sp_genzo_normal.png',
    smile:  'assets/sprites/sp_genzo_smile.png',
  },
};

export const CHARACTERS: Record<CharId, { displayName: string; slot: SpriteSlot }> = {
  tooru:   { displayName: '透',     slot: 'left'   },
  setsuko: { displayName: '節子',   slot: 'center' },
  wada:    { displayName: '和田さん', slot: 'right'  },
  genzo:   { displayName: '源三さん', slot: 'right'  },
};

export const ALL_IMAGE_PATHS: string[] = [
  ...Object.values(BG_CONFIG).map(c => c.src),
  'assets/cg/key_visual.jpg',
  'assets/cg/cg_flashback_1981.jpg',
  'assets/cg/cg_last_night.jpg',
  'assets/cg/cg_rebuilt.jpg',
  ...Object.values(SPRITE_PATHS).flatMap(m => Object.values(m)),
];

export function preloadAll(onProgress?: (done: number, total: number) => void): Promise<void> {
  const total = ALL_IMAGE_PATHS.length;
  let done = 0;
  return new Promise(resolve => {
    if (total === 0) { resolve(); return; }
    for (const src of ALL_IMAGE_PATHS) {
      const img = new Image();
      img.onload = img.onerror = () => {
        done++;
        onProgress?.(done, total);
        if (done >= total) resolve();
      };
      img.src = src;
    }
  });
}

interface SpriteEntry {
  char: CharId;
  expr: string;
  slot: SpriteSlot;
  el: HTMLElement;
  img: HTMLImageElement;
}

class Stage {
  private bgA = document.getElementById('bg-layer-a')!;
  private bgB = document.getElementById('bg-layer-b')!;
  private activeLayer: 'A' | 'B' = 'A';
  private currentBg: BgKey | null = null;
  private cgLayer = document.getElementById('cg-layer')!;
  private slotEls: Record<SpriteSlot, HTMLElement> = {
    left: document.getElementById('slot-left')!,
    center: document.getElementById('slot-center')!,
    right: document.getElementById('slot-right')!,
  };
  private sprites = new Map<CharId, SpriteEntry>();
  private cgVisible = false;

  /* ---------- 背景 ---------- */
  setBackground(key: BgKey, instant = false) {
    const cfg = BG_CONFIG[key];
    const next = this.activeLayer === 'A' ? this.bgB : this.bgA;
    const current = this.activeLayer === 'A' ? this.bgA : this.bgB;
    next.style.backgroundImage = `url('${cfg.src}')`;
    next.classList.toggle('kenburns', cfg.kenBurns);
    if (instant) {
      next.style.transition = 'none';
      current.style.transition = 'none';
      next.classList.add('visible');
      current.classList.remove('visible');
      // 強制リフロー
      void next.offsetHeight;
      next.style.transition = '';
      current.style.transition = '';
    } else {
      next.classList.add('visible');
      current.classList.remove('visible');
    }
    this.activeLayer = this.activeLayer === 'A' ? 'B' : 'A';
    this.currentBg = key;
    fx.particles.setMode(cfg.particle);
  }

  getCurrentBg(): BgKey | null { return this.currentBg; }

  /* ---------- CG ---------- */
  showCG(src: string, instant = false) {
    this.cgLayer.innerHTML = `<img src="${src}" alt="" />`;
    if (instant) {
      this.cgLayer.style.transition = 'none';
      this.cgLayer.classList.add('visible');
      void this.cgLayer.offsetHeight;
      this.cgLayer.style.transition = '';
    } else {
      this.cgLayer.classList.add('visible');
    }
    this.cgVisible = true;
  }

  hideCG(instant = false) {
    if (instant) { this.cgLayer.style.transition = 'none'; this.cgLayer.classList.remove('visible'); void this.cgLayer.offsetHeight; this.cgLayer.style.transition = ''; }
    else this.cgLayer.classList.remove('visible');
    this.cgVisible = false;
  }

  isCgVisible(): boolean { return this.cgVisible; }

  /* ---------- 立ち絵 ---------- */
  private freeSlot(preferred: SpriteSlot, occupying: CharId | null = null): SpriteSlot {
    const used = new Set([...this.sprites.values()].filter(s => s.char !== occupying).map(s => s.slot));
    if (!used.has(preferred)) return preferred;
    for (const s of ['center', 'left', 'right'] as SpriteSlot[]) if (!used.has(s)) return s;
    return preferred;
  }

  show(char: CharId, expr = 'normal', slotOverride?: SpriteSlot) {
    const existing = this.sprites.get(char);
    if (existing) { this.setExpression(char, expr, true); return; }
    const slot = this.freeSlot(slotOverride ?? CHARACTERS[char].slot);
    const el = this.slotEls[slot];
    const img = document.createElement('img');
    img.src = SPRITE_PATHS[char][expr] ?? SPRITE_PATHS[char]['normal'];
    img.alt = CHARACTERS[char].displayName;
    img.draggable = false;
    el.innerHTML = '';
    el.appendChild(img);
    el.classList.remove('dimmed', 'spotlight', 'from-left', 'from-right', 'from-center');
    if (slot === 'left') el.classList.add('from-left');
    else if (slot === 'right') el.classList.add('from-right');
    else el.classList.add('from-center');
    // 次フレームでスライドイン
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.classList.add('visible');
      el.classList.remove('from-left', 'from-right', 'from-center');
    }));
    this.sprites.set(char, { char, expr, slot, el, img });
  }

  hide(char: CharId) {
    const entry = this.sprites.get(char);
    if (!entry) return;
    entry.el.classList.remove('visible', 'spotlight', 'dimmed');
    const slot = entry.slot;
    window.setTimeout(() => {
      if (this.sprites.get(char)?.slot === slot) {
        this.slotEls[slot].innerHTML = '';
      }
    }, 470);
    this.sprites.delete(char);
  }

  hideAll() {
    for (const char of [...this.sprites.keys()]) this.hide(char);
  }

  setExpression(char: CharId, expr: string, soft = false) {
    const entry = this.sprites.get(char);
    if (!entry) { this.show(char, expr); return; }
    const path = SPRITE_PATHS[char][expr];
    if (!path) return;
    if (entry.expr === expr) return;
    if (soft) {
      entry.img.src = path;
      entry.expr = expr;
      return;
    }
    entry.el.style.transition = 'opacity 0.16s ease';
    entry.el.style.opacity = '0.35';
    window.setTimeout(() => {
      entry.img.src = path;
      entry.expr = expr;
      entry.el.style.opacity = '';
    }, 120);
  }

  /* 話者以外を暗くする演出 */
  spotlight(active: CharId | null) {
    for (const [char, entry] of this.sprites) {
      entry.el.classList.toggle('dimmed', active !== null && char !== active);
      entry.el.classList.toggle('spotlight', active !== null && char === active);
    }
  }

  /* セーブ用スナップショット */
  getState(): Array<{ char: CharId; expr: string; slot: SpriteSlot }> {
    return [...this.sprites.values()].map(e => ({ char: e.char, expr: e.expr, slot: e.slot }));
  }

  applyState(state: Array<{ char: CharId; expr: string; slot: SpriteSlot }>) {
    this.hideAll();
    // hideAllは非同期に消えるので即時クリア
    for (const s of ['left', 'center', 'right'] as SpriteSlot[]) this.slotEls[s].innerHTML = '';
    this.sprites.clear();
    for (const s of state) this.show(s.char, s.expr, s.slot);
  }
}

export const stage = new Stage();
