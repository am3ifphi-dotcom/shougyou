// Bootstrap: fixed-resolution stage, manifest-driven assets, audio, 3D scene,
// input and the game state machine.  No asset URLs are hard-coded here.

import { W, H } from './draw.js';
import { AssetLoader } from './loader.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { ThreeScene } from './three-scene.js';
import { Game } from './game.js';

const stage = document.getElementById('stage');
const screen = document.getElementById('screen');
const glCanvas = document.getElementById('gl');
const screenCtx = screen.getContext('2d', { alpha: false });
const gameplayLayer = document.createElement('canvas');
gameplayLayer.width = W; gameplayLayer.height = H;
const layerCtx = gameplayLayer.getContext('2d', { alpha: false });
screenCtx.imageSmoothingEnabled = false;
layerCtx.imageSmoothingEnabled = false;

function resize() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  stage.style.setProperty('--scale', String(s));
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
document.addEventListener('fullscreenchange', resize);
resize();

const q = new URLSearchParams(location.search);
const commercial = window.COMMERCIAL_BUILD === true || q.get('commercial') === '1' || q.get('COMMERCIAL_BUILD') === 'true';

let loader = null;
let three = null;
let game = null;

const audio = new AudioEngine({
  onLog: (id, status, detail) => loader?.addLog(`audio:${id}`, status, 'synth', detail),
});

loader = new AssetLoader({
  commercial,
  onAsset: async (entry, value) => {
    if (entry.type === 'audio') await audio.decode(entry, value);
  },
  onLibraries: async () => {
    audio.init();
    if (game) for (const k of ['bgm', 'se', 'voice']) audio.setVolume(k, game.options[k]);
  },
  onReady: async () => {
    if (three) await three.init();
  },
});

three = new ThreeScene(glCanvas, loader, {
  onLog: (id, status, detail) => loader.addLog(id, status, 'three', detail),
});
const input = new Input(audio, () => { /* first input unlocked audio */ });

game = new Game({
  screenCtx, gameplayLayer, glCanvas, stage, loader, audio, input, three,
  commercial, onResize: resize,
});

// Test/debug hooks (not visible in the game UI).
window.__HONSHITSU_GAME__ = game;
window.__HONSHITSU_STATE__ = () => game.state;
window.__HONSHITSU_TEST__ = {
  state: () => game.state,
  go: (s, opts = {}) => game.go(s, opts),
  setState: (s) => game.setState(s),
  startRun: (cont = false) => game.startRun(cont),
  run: (patch = null) => { if (patch) Object.assign(game.run, patch); return game.run; },
  action: (a) => game.input.push(a),
  progress: () => loader.progress(),
  log: () => loader.log,
  audio: () => audio,
};

let last = performance.now();
function frame(now) {
  // Background/headless tabs throttle rAF. State timers must use real elapsed
  // time; Game.update clamps only physics-sensitive substeps.
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  try { game.update(dt); game.render(); }
  catch (e) { console.error('[frame]', e); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

loader.loadManifest()
  .then(() => loader.loadAll())
  .catch((e) => {
    console.error('[bootstrap]', e);
    loader.addLog('bootstrap', 'fallback', 'runtime', String(e.message || e));
    loader.done = true;
  });
