/* モーダルUI — バックログ / セーブ・ロード / 設定 / 回想 / 中断メニュー */
import { audio, BGM_META, type BgmKey } from '../engine/audio';
import { listSaves, writeSave, deleteSave, captureThumbnail, QUICK_SLOT, AUTO_SLOT, type SaveData } from '../engine/save';
import type { Game } from '../engine/game';
import { GALLERY_CGS } from '../scenario';
import { fx } from '../engine/fx';

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let openCount = 0;
export function modalsOpen(): boolean { return openCount > 0; }

export function closeAllModals() {
  const root = document.getElementById('modal-root')!;
  root.innerHTML = '';
  openCount = 0;
}

export function openModal(opts: { title: string; onClose?: () => void; panelWidth?: number }): { body: HTMLElement; close: () => void } {
  const root = document.getElementById('modal-root')!;
  const veil = document.createElement('div');
  veil.className = 'modal-veil';
  veil.innerHTML = `
    <div class="modal-panel" role="dialog" aria-label="${escapeHtml(opts.title)}" ${opts.panelWidth ? `style="width:${opts.panelWidth}px"` : ''}>
      <div class="modal-header">
        <div class="modal-title">${escapeHtml(opts.title)}</div>
        <button class="modal-close" data-close>閉じる ✕</button>
      </div>
      <div class="modal-body"></div>
    </div>`;
  root.appendChild(veil);
  openCount++;

  const panel = veil.querySelector('.modal-panel') as HTMLElement;
  const body = veil.querySelector('.modal-body') as HTMLElement;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    openCount--;
    veil.remove();
    opts.onClose?.();
  };
  veil.addEventListener('mousedown', e => { if (e.target === veil) close(); });
  veil.querySelector('[data-close]')!.addEventListener('click', () => { audio.playSE('cancel'); close(); });
  // パネル内クリックは伝播させない
  panel.addEventListener('mousedown', e => e.stopPropagation());

  return { body, close };
}

/* ================= バックログ ================= */
export function openBacklog(game: Game) {
  const { body, close } = openModal({ title: 'バックログ', onClose: () => audio.playSE('cancel') });
  audio.playSE('page');
  const list = document.createElement('div');
  list.className = 'backlog-list';
  const entries = game.backlog;
  if (entries.length === 0) {
    list.innerHTML = '<div class="backlog-line" style="color:#6f6a85">まだ何も語られていません。</div>';
  } else {
    for (const e of entries) {
      const div = document.createElement('div');
      div.className = 'backlog-entry' + (e.name ? '' : ' narrator');
      div.innerHTML = `${e.name ? `<div class="backlog-name">${escapeHtml(e.name)}</div>` : ''}<div class="backlog-line">${escapeHtml(e.text)}</div>`;
      list.appendChild(div);
    }
  }
  body.appendChild(list);
  requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
  void close;
}

/* ================= セーブ / ロード ================= */
export function openSaveLoad(mode: 'save' | 'load', game: Game, onDone?: () => void) {
  const title = mode === 'save' ? 'セーブ' : 'ロード';
  const { body } = openModal({ title, onClose: () => audio.playSE('cancel') });
  audio.playSE('confirm');

  const render = () => {
    body.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'save-grid';
    const saves = listSaves();
    saves.forEach((data, slot) => {
      const btn = document.createElement('button');
      const isSpecial = slot === QUICK_SLOT ? 'QUICK' : slot === AUTO_SLOT ? 'AUTO' : null;
      btn.className = 'save-slot' + (data ? '' : ' empty');
      btn.innerHTML = `
        <span class="slot-no">${isSpecial ?? `SLOT ${String(slot + 1).padStart(2, '0')}`}</span>
        <div class="thumb">${data?.thumb ? `<img src="${data.thumb}" alt="" />` : '☕'}</div>
        <div class="slot-meta">
          <div class="slot-chapter">${data ? escapeHtml(data.chapter) : '―― 空のページ ――'}</div>
          <div class="slot-date">${data ? formatDate(data.timestamp) : '　'}</div>
        </div>`;
      let armed = false;
      btn.addEventListener('mouseenter', () => audio.playSE('hover', 0.6));
      btn.addEventListener('click', async () => {
        if (mode === 'save') {
          if (data && !armed) {
            armed = true;
            const chap = btn.querySelector('.slot-chapter')!;
            chap.textContent = 'もう一度押すと上書きします';
            chap.setAttribute('style', 'color:#ffd28a');
            window.setTimeout(() => { armed = false; }, 1800);
            return;
          }
          audio.playSE('confirm');
          const thumb = await captureThumbnail();
          const payload = { ...game.collectPublicSave(slot), thumb };
          writeSave(payload);
          fx.toast(isSpecial ? `${isSpecial}セーブしました` : `セーブしました（SLOT ${slot + 1}）`);
          render();
        } else {
          if (!data) { fx.toast('このスロットにはデータがありません'); return; }
          audio.playSE('confirm');
          closeAllModals();
          onDone?.();
          game.applySaveData(data);
        }
      });
      grid.appendChild(btn);
    });
    body.appendChild(grid);
    const hint = document.createElement('div');
    hint.style.cssText = 'margin-top:16px;font-size:14px;color:#8f8a9f;letter-spacing:0.1em;text-align:center';
    hint.textContent = mode === 'save' ? 'サムネイルとともに記録されます　|　上書きは二度押し' : 'ロードすると、その場面から再開します';
    body.appendChild(hint);
  };
  render();
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ================= 設定 ================= */
export interface GameConfig {
  textSpeed: number;
  bgmVolume: number;
  seVolume: number;
  voiceVolume: number;
  windowOpacity: number;
  ruby: boolean;
  particles: boolean;
}

const CONFIG_KEY = 'hoshikuzu_config_v1';
export const DEFAULT_CONFIG: GameConfig = {
  textSpeed: 6, bgmVolume: 0.62, seVolume: 0.85, voiceVolume: 0.9,
  windowOpacity: 0.92, ruby: true, particles: true,
};

export function loadConfig(): GameConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<GameConfig>) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(cfg: GameConfig) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
  audio.persistConfig(cfg as unknown as Record<string, unknown>);
}

export function charsPerSecond(speed: number): number { return 6 + speed * 8.4; }

export function applyConfig(cfg: GameConfig, game: Game) {
  game.textRenderer.setConfig({ charsPerSecond: charsPerSecond(cfg.textSpeed), rubyEnabled: cfg.ruby });
  audio.applyVolumes(cfg.bgmVolume, cfg.seVolume, cfg.voiceVolume);
  const tb = document.getElementById('textbox')!;
  tb.style.setProperty('--tb-alpha', String(cfg.windowOpacity));
  tb.style.background = `linear-gradient(180deg, rgba(16,15,26,${0.55 + 0.4 * cfg.windowOpacity}) 0%, rgba(10,9,17,${0.6 + 0.38 * cfg.windowOpacity}) 100%)`;
  fx.particles.enabled = cfg.particles;
}

export function openConfig(game: Game) {
  const cfg = loadConfig();
  const { body } = openModal({ title: '設定', panelWidth: 1240, onClose: () => { saveConfig(cfg); audio.playSE('cancel'); } });
  audio.playSE('confirm');

  const list = document.createElement('div');
  list.className = 'config-list';
  body.appendChild(list);

  const sliderRow = (name: string, sub: string, min: number, max: number, step: number, value: number, fmt: (v: number) => string, onInput: (v: number) => void) => {
    const row = document.createElement('div');
    row.className = 'config-row';
    const pct = ((value - min) / (max - min)) * 100;
    row.innerHTML = `
      <div class="config-name">${escapeHtml(name)}<small>${escapeHtml(sub)}</small></div>
      <input class="slider" type="range" min="${min}" max="${max}" step="${step}" value="${value}" style="--fill:${pct}%" aria-label="${escapeHtml(name)}" />`;
    const input = row.querySelector('input')!;
    const show = () => {
      input.style.setProperty('--fill', `${((Number(input.value) - min) / (max - min)) * 100}%`);
      onInput(Number(input.value));
      saveConfig(cfg);
    };
    input.addEventListener('input', show);
    list.appendChild(row);
    return row;
  };

  sliderRow('メッセージ速度', '文字が表示される速さ', 1, 10, 1, cfg.textSpeed, v => String(v), v => {
    cfg.textSpeed = v;
    game.textRenderer.setConfig({ charsPerSecond: charsPerSecond(v), rubyEnabled: cfg.ruby });
  });
  sliderRow('BGM音量', '背景楽曲の音量', 0, 100, 1, Math.round(cfg.bgmVolume * 100), v => `${v}`, v => { cfg.bgmVolume = v / 100; audio.applyVolumes(cfg.bgmVolume, cfg.seVolume, cfg.voiceVolume); });
  sliderRow('効果音音量', 'クリック・ベル・水音など', 0, 100, 1, Math.round(cfg.seVolume * 100), v => `${v}`, v => { cfg.seVolume = v / 100; audio.applyVolumes(cfg.bgmVolume, cfg.seVolume, cfg.voiceVolume); audio.playSE('confirm'); });
  sliderRow('ボイス音量', '台詞の読み上げ音量', 0, 100, 1, Math.round(cfg.voiceVolume * 100), v => `${v}`, v => { cfg.voiceVolume = v / 100; audio.applyVolumes(cfg.bgmVolume, cfg.seVolume, cfg.voiceVolume); });
  sliderRow('テキスト窓の濃さ', '文字ウィンドウの不透明度', 40, 100, 1, Math.round(cfg.windowOpacity * 100), v => `${v}`, v => { cfg.windowOpacity = v / 100; applyConfig(cfg, game); });

  const toggleRow = (name: string, sub: string, value: boolean, onChange: (v: boolean) => void) => {
    const row = document.createElement('div');
    row.className = 'config-row';
    row.innerHTML = `
      <div class="config-name">${escapeHtml(name)}<small>${escapeHtml(sub)}</small></div>
      <div class="toggle-pill">
        <button data-v="off" class="${value ? '' : 'on'}">OFF</button>
        <button data-v="on" class="${value ? 'on' : ''}">ON</button>
      </div>`;
    const [offBtn, onBtn] = Array.from(row.querySelectorAll('button'));
    const set = (v: boolean) => {
      onBtn.classList.toggle('on', v);
      offBtn.classList.toggle('on', !v);
      onChange(v);
      saveConfig(cfg);
      audio.playSE('select', 0.8);
    };
    onBtn.addEventListener('click', () => set(true));
    offBtn.addEventListener('click', () => set(false));
    list.appendChild(row);
  };

  toggleRow('ルビ（振り仮名）', '漢字の読みを小さく表示します', cfg.ruby, v => { cfg.ruby = v; game.textRenderer.setConfig({ charsPerSecond: charsPerSecond(cfg.textSpeed), rubyEnabled: v }); });
  toggleRow('パーティクル演出', '光の粒・星屑などの環境演出', cfg.particles, v => { cfg.particles = v; fx.particles.enabled = v; });

  const fullRow = document.createElement('div');
  fullRow.className = 'config-row';
  fullRow.innerHTML = `
    <div class="config-name">全画面表示<small>Fキーでも切り替えられます</small></div>
    <div><button class="modal-close" id="cfg-fullscreen" style="border-color:var(--line)">全画面に切り替える</button></div>`;
  fullRow.querySelector('#cfg-fullscreen')!.addEventListener('click', () => {
    audio.playSE('confirm');
    void toggleFullscreen();
  });
  list.appendChild(fullRow);

  const hint = document.createElement('div');
  hint.style.cssText = 'margin-top:6px;padding:14px 26px;border:1px dashed var(--line-dim);border-radius:6px;font-size:14.5px;color:#a49fb6;line-height:1.9;letter-spacing:0.05em';
  hint.innerHTML = '操作方法　…　<span style="color:var(--gold)">クリック / Enter / Space</span> 進む　<span style="color:var(--gold)">Esc</span> メニュー　<span style="color:var(--gold)">A</span> オート　<span style="color:var(--gold)">S</span> スキップ　<span style="color:var(--gold)">F6</span> クイックセーブ　<span style="color:var(--gold)">F7</span> クイックロード　<span style="color:var(--gold)">F</span> 全画面';
  list.appendChild(hint);
}

export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch { /* フルスクリーン不可 */ }
}

/* ================= 回想（ギャラリー） ================= */
export function openGallery(game: Game) {
  const { body, close } = openModal({ title: '回想', panelWidth: 1520, onClose: () => { audio.playSE('cancel'); audio.playBGM(game.currentBgmKey(), 0.8); } });
  audio.playSE('confirm');

  const unlocks = audio.getUnlocks();

  // CG
  const cgSection = document.createElement('div');
  cgSection.className = 'gallery-section';
  cgSection.innerHTML = '<div class="gallery-heading">― 回想シーン</div>';
  const grid = document.createElement('div');
  grid.className = 'cg-grid';
  for (const cg of GALLERY_CGS) {
    const unlocked = unlocks.cgs.includes(cg.id);
    const cell = document.createElement('button');
    cell.className = 'cg-cell' + (unlocked ? ' unlocked' : '');
    cell.innerHTML = unlocked
      ? `<img src="${cg.src}" alt="${escapeHtml(cg.name)}" /><div class="cg-name">${escapeHtml(cg.name)}</div>`
      : `<div class="cg-lock">🔒<small>NOT CLEAR</small></div>`;
    if (unlocked) {
      cell.addEventListener('click', () => { audio.playSE('confirm'); viewCg(cg.src, cg.name); });
    }
    grid.appendChild(cell);
  }
  cgSection.appendChild(grid);
  body.appendChild(cgSection);

  // 音楽
  const musicSection = document.createElement('div');
  musicSection.className = 'gallery-section';
  const unlockedBgm = unlocks.bgms.length;
  musicSection.innerHTML = `<div class="gallery-heading">― 音楽鑑賞（${unlockedBgm} / ${Object.keys(BGM_META).length}）</div>`;
  const bgmList = document.createElement('div');
  bgmList.className = 'bgm-list';
  let playingKey: BgmKey | null = null;
  const rows: HTMLElement[] = [];
  (Object.keys(BGM_META) as BgmKey[]).forEach(key => {
    const unlocked = unlocks.bgms.includes(key);
    const meta = BGM_META[key];
    const row = document.createElement('button');
    row.className = 'bgm-row' + (unlocked ? '' : ' locked');
    row.innerHTML = `
      <span class="bgm-play">▶</span>
      <span><span class="bgm-title">${unlocked ? escapeHtml(meta.title) : '？？？？？'}</span>
      <span class="bgm-sub">${unlocked ? escapeHtml(meta.sub) : 'まだ聴いていません'}</span></span>
      <span class="bgm-state"></span>`;
    row.addEventListener('click', () => {
      if (!unlocked) return;
      const same = playingKey === key;
      if (same) {
        audio.stopBGM(0.6);
        playingKey = null;
        row.classList.remove('playing');
        row.querySelector('.bgm-state')!.textContent = '';
        return;
      }
      for (const r of rows) { r.classList.remove('playing'); r.querySelector('.bgm-state')!.textContent = ''; }
      playingKey = key;
      row.classList.add('playing');
      row.querySelector('.bgm-state')!.textContent = '♪ PLAYING';
      audio.playBGM(key, 0.9);
      audio.playSE('confirm');
    });
    rows.push(row);
    bgmList.appendChild(row);
  });
  musicSection.appendChild(bgmList);
  body.appendChild(musicSection);

  // エンディング一覧
  const endSection = document.createElement('div');
  endSection.className = 'gallery-section';
  const trueEnd = unlocks.endings.includes('hoshikuzu_true');
  endSection.innerHTML = `
    <div class="gallery-heading">― エンディング</div>
    <div class="bgm-list">
      <div class="bgm-row ${trueEnd ? '' : 'locked'}" style="pointer-events:none">
        <span class="bgm-play">${trueEnd ? '✦' : '🔒'}</span>
        <span><span class="bgm-title">${trueEnd ? '星屑は、消えない' : '？？？？？'}</span>
        <span class="bgm-sub">${trueEnd ? 'TRUE END ― 物語を最後まで見届けました' : '未解放'}</span></span>
        <span class="bgm-state">${trueEnd ? 'CLEAR' : ''}</span>
      </div>
    </div>`;
  body.appendChild(endSection);
  void close;
}

function viewCg(src: string, name: string) {
  const root = document.getElementById('modal-root')!;
  const veil = document.createElement('div');
  veil.className = 'modal-veil';
  veil.style.background = 'rgba(2,2,5,0.96)';
  veil.innerHTML = `
    <figure style="max-width:1560px;width:100%;text-align:center;cursor:zoom-out">
      <img src="${src}" alt="${escapeHtml(name)}" style="width:100%;max-height:840px;object-fit:contain;border:1px solid var(--line);border-radius:6px;box-shadow:0 0 80px rgba(232,201,122,0.18)" />
      <figcaption style="margin-top:18px;color:var(--gold-bright);letter-spacing:0.2em;font-size:19px">${escapeHtml(name)}</figcaption>
      <div style="margin-top:8px;color:#8f8a9f;font-size:13px;letter-spacing:0.3em">CLICK TO CLOSE</div>
    </figure>`;
  root.appendChild(veil);
  openCount++;
  const close = () => { openCount--; veil.remove(); };
  veil.addEventListener('click', close);
}

/* ================= 中断メニュー ================= */
export function openPauseMenu(opts: {
  onSave: () => void;
  onLoad: () => void;
  onBacklog: () => void;
  onGallery: () => void;
  onConfig: () => void;
  onTitle: () => void;
}) {
  const { body } = openModal({ title: 'メニュー', panelWidth: 760, onClose: () => audio.playSE('cancel') });
  audio.playSE('confirm');
  const items: Array<{ label: string; small?: string; danger?: boolean; action: () => void }> = [
    { label: 'ゲームに戻る', small: 'ESC', action: () => closeAllModals() },
    { label: 'セーブ', small: 'クイックセーブは F6', action: opts.onSave },
    { label: 'ロード', small: '', action: opts.onLoad },
    { label: 'バックログ', small: 'これまでのセリフを読み返す', action: opts.onBacklog },
    { label: '回想', small: '絵と音楽とエンディング', action: opts.onGallery },
    { label: '設定', small: '音量・速度・ルビ など', action: opts.onConfig },
    { label: 'タイトルへ戻る', small: 'セーブしていない進行は失われます', danger: true, action: opts.onTitle },
  ];
  const menu = document.createElement('div');
  menu.className = 'pause-menu';
  for (const item of items) {
    const btn = document.createElement('button');
    btn.className = 'pause-item' + (item.danger ? ' danger' : '');
    btn.innerHTML = `<span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.small ?? '')}</small>`;
    btn.addEventListener('mouseenter', () => audio.playSE('hover', 0.7));
    btn.addEventListener('click', () => { audio.playSE(item.danger ? 'cancel' : 'select'); item.action(); });
    menu.appendChild(btn);
  }
  body.appendChild(menu);
}

/* ================= 確認 ================= */
export function openConfirm(opts: { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }) {
  const { body, close } = openModal({ title: opts.title, panelWidth: 640 });
  const msg = document.createElement('p');
  msg.style.cssText = 'font-size:19px;line-height:1.9;color:var(--cream);letter-spacing:0.04em;padding:6px 4px 22px';
  msg.textContent = opts.message;
  body.appendChild(msg);
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:16px;justify-content:flex-end';
  const cancel = document.createElement('button');
  cancel.className = 'modal-close';
  cancel.textContent = 'やめる';
  cancel.addEventListener('click', () => { audio.playSE('cancel'); close(); });
  const ok = document.createElement('button');
  ok.className = 'modal-close';
  ok.style.cssText = opts.danger
    ? 'border-color:#ff9d8a;color:#ffb3a5'
    : 'border-color:var(--gold);color:var(--gold-bright)';
  ok.textContent = opts.confirmLabel;
  ok.addEventListener('click', () => { audio.playSE(opts.danger ? 'cancel' : 'confirm'); close(); opts.onConfirm(); });
  row.appendChild(cancel);
  row.appendChild(ok);
  body.appendChild(row);
}
