/* タイトル画面 — キービジュアル + 星空 + メニュー */
import { Starfield } from './starfield';
import { hasAnySave, listSaves } from '../engine/save';
import { audio } from '../engine/audio';

export interface TitleCallbacks {
  onNewGame: () => void;
  onContinue: (latestSlot: number) => void;
  onLoad: () => void;
  onConfig: () => void;
  onGallery: () => void;
}

export function initTitle(cb: TitleCallbacks) {
  const root = document.getElementById('title-screen')!;
  const bg = document.getElementById('title-bg')!;
  bg.style.backgroundImage = "url('assets/cg/key_visual.jpg')";

  // 星空キャンバス
  const stars = new Starfield(document.getElementById('title-stars') as HTMLCanvasElement, 190);

  // タイトルBGM（stardust）
  const startBgm = () => audio.playBGM('stardust', 2.4);

  // 最初のユーザー操作で再生開始（ブラウザの自動再生制限対策）
  const kickoff = () => {
    startBgm();
    window.removeEventListener('pointerdown', kickoff);
    window.removeEventListener('keydown', kickoff);
  };
  window.addEventListener('pointerdown', kickoff);
  window.addEventListener('keydown', kickoff);

  const continueBtn = document.getElementById('menu-continue') as HTMLButtonElement;
  const refreshContinue = () => { continueBtn.disabled = !hasAnySave(); };
  refreshContinue();

  // 「はじめから」開始フェード
  const startWithFade = () => {
    audio.playSE('confirm');
    root.style.transition = 'opacity 0.9s ease';
    root.style.opacity = '0';
    window.setTimeout(() => {
      root.classList.add('hidden');
      root.style.opacity = '';
    }, 950);
  };

  document.getElementById('menu-newgame')!.addEventListener('click', () => { startWithFade(); cb.onNewGame(); });
  continueBtn.addEventListener('click', () => {
    const saves = listSaves();
    let latest = -1, latestTs = 0;
    saves.forEach((s, i) => { if (s && s.timestamp > latestTs) { latestTs = s.timestamp; latest = i; } });
    if (latest < 0) return;
    startWithFade();
    cb.onContinue(latest);
  });
  document.getElementById('menu-load')!.addEventListener('click', () => { audio.playSE('confirm'); cb.onLoad(); });
  document.getElementById('menu-config')!.addEventListener('click', () => { audio.playSE('confirm'); cb.onConfig(); });
  document.getElementById('menu-gallery')!.addEventListener('click', () => { audio.playSE('confirm'); cb.onGallery(); });

  // ホバースクロース音
  for (const el of Array.from(document.querySelectorAll('.title-menu-item'))) {
    el.addEventListener('mouseenter', () => audio.playSE('hover', 0.8));
  }
}

export function showTitle() {
  const root = document.getElementById('title-screen')!;
  root.classList.remove('hidden');
  root.style.opacity = '1';
  const continueBtn = document.getElementById('menu-continue') as HTMLButtonElement;
  continueBtn.disabled = !hasAnySave();
}
