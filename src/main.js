/**
 * SHATTERED CROWN - entry point.
 *
 * Owns the finite state machine:
 *
 *   BOOT -> LOADING -> TITLE -> (GAME | OPTIONS | CREDITS)
 *   GAME <-> PAUSE, GAME -> RESULT -> TITLE
 *
 * Every swap goes through the transition layer so nothing ever hard-cuts.
 */
import { createCabinet, sceneLayer, uiLayer, worldLayer, overlayLayer, VIEW_W, VIEW_H, app } from './core/app.js';
import { input } from './core/input.js';
import { loadManifests, loadUserIndex, bootLog, statusCounts } from './core/assets.js';
import { preloadImages, loadFonts } from './core/textures.js';
import { initAudio, unlockAudio, playMusic, preloadMusic, preloadSfx, stopMusic } from './core/audio.js';
import { updateTransitions, transition, fadeIn, fadeOut, setVeil } from './core/transitions.js';
import { BootScene } from './scenes/bootScene.js';
import { LoadingScene } from './scenes/loadingScene.js';
import { TitleScene } from './scenes/titleScene.js';
import { GameScene } from './scenes/gameScene.js';
import { ResultScene } from './scenes/resultScene.js';
import { CreditsScene } from './scenes/creditsScene.js';
import { OptionsMenu } from './scenes/optionsMenu.js';
import { hasSave, getSave, clearSave } from './core/save.js';
import { playSfx } from './core/audio.js';

const State = {
  BOOT: 'boot',
  LOADING: 'loading',
  TITLE: 'title',
  GAME: 'game',
  RESULT: 'result',
  CREDITS: 'credits',
};

const SFX_IDS = [
  'se_ui_move', 'se_ui_confirm', 'se_ui_cancel', 'se_ui_denied',
  'se_slash', 'se_slash2', 'se_hit', 'se_hurt', 'se_enemy_die', 'se_pickup',
  'se_heal', 'se_levelup', 'se_gameover', 'se_step', 'se_dash',
  'se_fireball', 'se_explode', 'se_boss_roar', 'se_door',
];
const MUSIC_IDS = ['bgm_title', 'bgm_dungeon', 'bgm_boss', 'bgm_gameover'];

const runtime = {
  state: null,
  scene: null,
  options: null,
  busy: false,
  confirmNewGame: false,
};

let cabinet;

function setScene(scene) {
  const prev = runtime.scene;
  if (prev && prev !== scene) {
    if (typeof prev.dispose === 'function') prev.dispose();
    if (prev.node?.parent) prev.node.parent.removeChild(prev.node);
    if (prev.node && !prev.node.destroyed) prev.node.destroy({ children: true });
  }
  sceneLayer.removeChildren();
  uiLayer.removeChildren();
  runtime.scene = scene;
  if (scene?.node) sceneLayer.addChild(scene.node);
  if (scene?.uiNode) uiLayer.addChild(scene.uiNode);
  return scene;
}

async function goTitle({ first = false } = {}) {
  runtime.state = State.TITLE;
  runtime.confirmNewGame = false;
  await transition(async () => {
    setScene(null);
    const title = new TitleScene({
      hasSave: hasSave(),
      onSelect: (label) => {
        if (label === 'NEW GAME') startNewGame();
        else if (label === 'CONTINUE') continueGame();
        else if (label === 'OPTIONS') openOptions();
        else if (label === 'CREDITS') openCredits();
        else if (label === 'QUIT') quitGame();
      },
    });
    setScene(title);
    playMusic('bgm_title', { fade: 1400 });
  }, { out: first ? 1 : 520, into: first ? 700 : 600 });
}

function startNewGame() {
  if (runtime.busy) return;
  if (hasSave() && !runtime.confirmNewGame) {
    runtime.confirmNewGame = true;
    runtime.scene.press.text = 'PRESS AGAIN TO OVERWRITE SAVE';
    runtime.scene.press.alpha = 1;
    playSfx('se_ui_denied');
    setTimeout(() => {
      runtime.confirmNewGame = false;
      if (runtime.scene?.press) runtime.scene.press.text = 'PRESS ANY KEY';
    }, 3200);
    return;
  }
  clearSave();
  launchRun({ seed: (Math.random() * 1e9) | 0, resume: null });
}

function continueGame() {
  const save = getSave();
  if (!save) {
    playSfx('se_ui_denied');
    return;
  }
  launchRun({ seed: save.seed, resume: save });
}

async function launchRun({ seed, resume }) {
  if (runtime.busy) return;
  runtime.busy = true;
  stopMusic(500);
  await transition(async () => {
    setScene(null);
    const game = new GameScene({
      seed,
      resume,
      onEnd: (stats) => showResult(stats),
      onQuit: () => goTitle(),
      onOpenOptions: () => {
        runtime.scene.pauseMenu?.close();
        openOptions();
      },
    });
    runtime.state = State.GAME;
    setScene(game);
  }, { out: 460, into: 620, kind: 'wipe' });
  runtime.busy = false;
}

async function showResult(stats) {
  runtime.state = State.RESULT;
  await transition(async () => {
    setScene(null);
    playMusic('bgm_gameover', { fade: 1400 });
    const result = new ResultScene({
      stats,
      victory: stats.victory,
      onSelect: (label) => {
        if (label === 'TITLE SCREEN') goTitle();
        else launchRun({ seed: (Math.random() * 1e9) | 0, resume: null });
      },
    });
    setScene(result);
  }, { out: 700, into: 800 });
}

async function openCredits() {
  runtime.state = State.CREDITS;
  await transition(async () => {
    setScene(null);
    const credits = new CreditsScene({ onBack: () => goTitle() });
    setScene(credits);
    playMusic('bgm_title', { fade: 900 });
  }, { out: 420, into: 620 });
}

let optionsOwner = null;
function openOptions() {
  if (runtime.options?.isOpen) return;
  const fromGame = runtime.scene instanceof GameScene;
  const opts = new OptionsMenu({
    onBack: () => {
      opts.close();
      if (optionsOwner === 'title') {
        runtime.options = null;
        runtime.scene?.menu && (runtime.scene.menuOpen = true);
        return;
      }
      runtime.options = null;
      if (fromGame) runtime.scene?.setPaused(true);
    },
  });
  optionsOwner = fromGame ? 'game' : 'title';
  opts.open();
  if (fromGame && runtime.scene?.uiNode) runtime.scene.uiNode.addChild(opts.node);
  else uiLayer.addChild(opts.node);
  runtime.options = opts;
}

function quitGame() {
  stopMusic(600);
  goTitle();
  runtime.scene.press.text = 'QUIT - CLOSE THE TAB WHEN READY';
}

/* ------------------------------------------------------------------ */
/* frame loop                                                          */
/* ------------------------------------------------------------------ */
let lastFrame = performance.now();

function frame(now) {
  const dtMs = Math.min(50, now - lastFrame);
  lastFrame = now;

  input.poll();
  updateTransitions();

  const scene = runtime.scene;
  const overlay = runtime.options;
  if (scene) {
    if (overlay && overlay.node.visible) {
      // the options overlay takes every input; the scene underneath keeps
      // ticking at a crawl so animations stay alive but nothing advances
      scene.update?.(dtMs * 0.25, input);
      overlay.onInput(input);
      if (!overlay.node.destroyed) overlay.update(dtMs);
    } else {
      scene.update?.(dtMs, input);
      scene.onInput?.(input);
    }
  }

  app.render();
  input.endFrame();
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ */
/* boot                                                               */
/* ------------------------------------------------------------------ */
async function main() {
  initAudio();
  input.onAnyInput = () => unlockAudio();

  const host = document.getElementById('stage');
  try {
    cabinet = await createCabinet(host);
  } catch (err) {
    document.getElementById('nogl').style.display = 'grid';
    console.error('WebGL init failed', err);
    return;
  }

  // studio card
  setVeil(1);
  const boot = new BootScene({ onDone: () => startLoading() });
  setScene(boot);
  runtime.state = State.BOOT;

  // the frame loop runs first: transitions are advanced from inside it, so
  // awaiting a fade before starting the loop would deadlock.
  lastFrame = performance.now();
  requestAnimationFrame(frame);
  await fadeIn(700);
}

let loadingScene = null;
let skipLoading = null;
function skipPreload() {
  // let the current stage finish, then jump straight to the title
  if (skipLoading) skipLoading();
}
async function startLoading() {
  if (runtime.state === State.LOADING) return;
  runtime.state = State.LOADING;
  await fadeOut(420);
  const skipped = new Promise((resolve) => {
    skipLoading = resolve;
  });
  loadingScene = new LoadingScene({ onSkip: skipPreload });
  setScene(loadingScene); // clears the studio card
  runtime.scene = loadingScene;
  await fadeIn(380);

  const total = 6;
  let step = 0;
  const advance = async (label, fn) => {
    if (loadingScene?.skipped) return;
    step++;
    loadingScene?.setStage(step, label);
    try {
      await fn();
    } catch (err) {
      // A failed stage must never stall the boot; the affected assets simply
      // resolve to their procedural fallbacks.
      console.error(`[boot] stage "${label}" failed`, err);
      bootLog.push(`[boot] stage "${label}" failed: ${err?.message || err}`);
    }
    loadingScene?.setProgress(step / total);
    loadingScene?.setLog(bootLog);
  };

  await advance('READING MANIFEST', async () => {
    await loadManifests();
    await loadUserIndex();
  });
  await advance('CARVING TYPE', async () => {
    await loadFonts((d, t) => loadingScene?.setProgress((step - 1 + d / t) / total));
  });
  await advance('BINDING TEXTURES', async () => {
    await preloadImages((d, t) => loadingScene?.setProgress((step - 1 + d / t) / total));
  });
  await advance('TUNING INSTRUMENTS', async () => {
    await preloadSfx(SFX_IDS, (d, t) => loadingScene?.setProgress((step - 1 + d / t) / total));
  });
  await advance('SCORING THE CRYPT', async () => {
    await preloadMusic(MUSIC_IDS, (d, t) => loadingScene?.setProgress((step - 1 + d / t) / total));
  });
  await advance('WAKING THE WARDEN', async () => {
    loadingScene?.setLog(bootLog);
    const counts = statusCounts();
    bootLog.push(`[boot] textures ready=${counts.ready} fallback=${counts.fallback}`);
    await new Promise((r) => setTimeout(r, 500));
  });
  await Promise.race([skipLoading, new Promise((r) => setTimeout(r, 0))]);
  skipLoading = null;
  loadingScene?.setProgress(1);
  loadingScene?.setLog(bootLog);

  // first real input unlocks WebAudio; the title waits for it so the theme is
  // not silently dropped by autoplay policy
  await waitForInput(900);
  await goTitle({ first: true });
}

function waitForInput(ms) {
  return new Promise((resolve) => {
    if (input.anyPressed || input.pointer.clicked) {
      resolve();
      return;
    }
    const t = setTimeout(() => {
      window.removeEventListener('keydown', h);
      window.removeEventListener('pointerdown', h);
      resolve();
    }, ms);
    const h = () => {
      clearTimeout(t);
      window.removeEventListener('keydown', h);
      window.removeEventListener('pointerdown', h);
      unlockAudio();
      resolve();
    };
    window.addEventListener('keydown', h);
    window.addEventListener('pointerdown', h);
  });
}

// global escape hatches
window.addEventListener('error', (e) => {
  console.error('[shattered-crown]', e.error || e.message);
});
window.__SC_DEBUG__ = {
  runtime, input, bootLog, getSave, clearSave, openOptions, goTitle,
  startRun: (seed = 12345) => launchRun({ seed, resume: null }),
};

main();
