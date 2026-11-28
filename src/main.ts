/* 星屑珈琲 — エントリーポイント */
import './styles.css';
import { preloadAll } from './engine/stage';
import { Game } from './engine/game';
import { audio } from './engine/audio';
import { fx } from './engine/fx';
import { initTitle, showTitle } from './ui/title';
import {
  openBacklog, openConfig, openGallery, openPauseMenu, openSaveLoad, openConfirm,
  closeAllModals, modalsOpen, loadConfig, applyConfig, toggleFullscreen,
} from './ui/modals';
import { showStaffroll } from './ui/staffroll';
import { listSaves, getSave, writeSave, captureThumbnail, QUICK_SLOT } from './engine/save';

const game = new Game();

/* ============ レターボックス・スケーリング ============ */
const scaleEl = document.getElementById('stage-scale')!;
function fit() {
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  scaleEl.style.transform = `scale(${scale})`;
}
window.addEventListener('resize', fit);
fit();

/* ============ HUD ============ */
const hudAuto = document.getElementById('hud-auto')!;
const hudSkip = document.getElementById('hud-skip')!;

function syncAutoSkipUI() {
  hudAuto.classList.toggle('active', game.auto);
  hudSkip.classList.toggle('active', game.skip);
}

const openPause = () => {
  openPauseMenu({
    onSave: () => { closeAllModals(); openSaveLoad('save', game); },
    onLoad: () => { closeAllModals(); openSaveLoad('load', game, syncAutoSkipUI); },
    onBacklog: () => { closeAllModals(); openBacklog(game); },
    onGallery: () => { closeAllModals(); openGallery(game); },
    onConfig: () => { closeAllModals(); openConfig(game); },
    onTitle: () => {
      openConfirm({
        title: 'タイトルへ戻る',
        message: 'セーブしていない進行は失われます。タイトルへ戻りますか？',
        confirmLabel: 'タイトルへ戻る',
        danger: true,
        onConfirm: () => { closeAllModals(); game.returnToTitle(); showTitle(); },
      });
    },
  });
};

document.getElementById('hud-menu')!.addEventListener('click', () => { if (!modalsOpen()) openPause(); });
document.getElementById('hud-backlog')!.addEventListener('click', () => { if (!modalsOpen()) openBacklog(game); });
document.getElementById('hud-save')!.addEventListener('click', () => { if (!modalsOpen()) openSaveLoad('save', game); });
document.getElementById('hud-load')!.addEventListener('click', () => { if (!modalsOpen()) openSaveLoad('load', game, syncAutoSkipUI); });
document.getElementById('hud-auto')!.addEventListener('click', () => { const on = game.toggleAuto(); syncAutoSkipUI(); fx.toast(on ? 'オートモード ON' : 'オートモード OFF'); });
document.getElementById('hud-skip')!.addEventListener('click', () => { const on = game.toggleSkip(); syncAutoSkipUI(); fx.toast(on ? 'スキップ ON' : 'スキップ OFF'); });
document.getElementById('hud-config')!.addEventListener('click', () => { if (!modalsOpen()) openConfig(game); });
document.getElementById('hud-fullscreen')!.addEventListener('click', () => { audio.playSE('select'); void toggleFullscreen(); });

/* ============ クイックセーブ / ロード ============ */
async function quickSave() {
  if (game.phase === 'title') return;
  try {
    const thumb = await captureThumbnail();
    writeSave({ ...game.collectPublicSave(QUICK_SLOT), thumb });
    fx.toast('クイックセーブしました');
    audio.playSE('confirm');
  } catch {
    fx.toast('クイックセーブに失敗しました');
  }
}
function quickLoad() {
  const data = getSave(QUICK_SLOT);
  if (!data) { fx.toast('クイックセーブデータがありません'); return; }
  closeAllModals();
  audio.playSE('confirm');
  game.applySaveData(data);
  syncAutoSkipUI();
}

/* ============ 画面クリックでテキスト送り ============ */
document.getElementById('viewport')!.addEventListener('click', e => {
  if (modalsOpen()) return;
  if (game.phase === 'title') return;
  const target = e.target as HTMLElement;
  if (target.closest('button') || target.closest('#choice-layer') || target.closest('#modal-root')) return;
  game.advance();
});

/* ============ キーボード操作 ============ */
window.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'Enter') e.preventDefault();

  if (e.code === 'F6') { e.preventDefault(); void quickSave(); return; }
  if (e.code === 'F7') { e.preventDefault(); quickLoad(); return; }
  if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey) { void toggleFullscreen(); return; }

  if (e.code === 'Escape') {
    if (modalsOpen()) { closeAllModals(); audio.playSE('cancel'); }
    else if (game.phase !== 'title') openPause();
    return;
  }

  if (modalsOpen()) return;

  switch (e.code) {
    case 'Enter':
    case 'Space':
    case 'ArrowRight':
      game.advance();
      break;
    case 'KeyA': {
      if (e.repeat) return;
      const on = game.toggleAuto(); syncAutoSkipUI(); fx.toast(on ? 'オートモード ON' : 'オートモード OFF');
      break;
    }
    case 'KeyS': {
      if (e.repeat) return;
      const on = game.toggleSkip(); syncAutoSkipUI(); fx.toast(on ? 'スキップ ON' : 'スキップ OFF');
      break;
    }
  }
});

/* ============ エンディング → スタッフロール ============ */
game.onEnding = (endingId, title) => {
  void endingId;
  window.setTimeout(() => {
    fx.toast('TRUE END 解放 ――「星屑は、消えない」', 4200);
    showStaffroll(title.replace(/ ――.*/, ''), () => {
      game.returnToTitle();
      showTitle();
    });
  }, 2200);
};

/* ============ タイトル初期化 ============ */
initTitle({
  onNewGame: () => {
    document.getElementById('textbox-wrap')!.classList.remove('hidden');
    game.newGame();
    syncAutoSkipUI();
  },
  onContinue: slot => {
    const saves = listSaves();
    const data = saves[slot];
    document.getElementById('textbox-wrap')!.classList.remove('hidden');
    if (data) game.applySaveData(data); else game.newGame();
    syncAutoSkipUI();
  },
  onLoad: () => openSaveLoad('load', game, syncAutoSkipUI),
  onConfig: () => openConfig(game),
  onGallery: () => openGallery(game),
});

/* ============ ブート ============ */
(async () => {
  const fadeEl = document.getElementById('fade-layer')!;
  fadeEl.style.transition = 'none';
  fadeEl.style.opacity = '1';
  document.getElementById('textbox-wrap')!.classList.add('hidden');
  applyConfig(loadConfig(), game);
  // 画像プリロード（失敗しても進行）
  await Promise.race([preloadAll(), new Promise(r => window.setTimeout(r, 12000))]);
  requestAnimationFrame(() => {
    fadeEl.style.transition = 'opacity 1.15s ease';
    fadeEl.style.opacity = '0';
  });
})();
