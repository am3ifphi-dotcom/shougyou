/**
 * The cabinet.
 *
 * One canvas, locked to 16:9, scaled to fit the window and letterboxed in
 * black.  The render surface is a fixed 480x270 backbuffer so the pixel art is
 * always sampled on its native grid no matter how large the window gets.
 */
import { Application, Container, Graphics } from 'pixi.js';

export const VIEW_W = 480;
export const VIEW_H = 270;
export const ASPECT = VIEW_W / VIEW_H;

export const app = new Application();

export const stage = new Container(); // letterbox-aware root, in view space
export const worldLayer = new Container();
export const sceneLayer = new Container();
export const uiLayer = new Container();
export const overlayLayer = new Container(); // fades, flashes, letterbox bars
export const pauseBlurLayer = new Container();

let mask = null;
let resizeObserver = null;
let containerEl = null;

export async function createCabinet(host) {
  await app.init({
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: 0x000000,
    antialias: false,
    preference: 'webgl',
    powerPreference: 'high-performance',
    resolution: 1,
    autoDensity: false,
    roundPixels: true,
  });
  if (!app.renderer) throw new Error('WebGL unavailable');

  const canvas = app.canvas;
  canvas.style.imageRendering = 'pixelated';
  canvas.setAttribute('aria-label', 'SHATTERED CROWN game screen');
  canvas.tabIndex = 0;
  host.appendChild(canvas);
  containerEl = host;

  // A mask guarantees nothing ever bleeds into the letterbox area.
  mask = new Graphics().rect(0, 0, VIEW_W, VIEW_H).fill(0xffffff);
  stage.addChild(mask);
  app.stage.addChild(stage);
  stage.mask = mask;

  worldLayer.sortableChildren = true;
  sceneLayer.sortableChildren = true;
  uiLayer.sortableChildren = true;
  overlayLayer.sortableChildren = true;
  pauseBlurLayer.sortableChildren = true;
  stage.addChild(worldLayer, sceneLayer, pauseBlurLayer, uiLayer, overlayLayer);

  fit(canvas);
  resizeObserver = new ResizeObserver(() => fit(canvas));
  resizeObserver.observe(host);
  window.addEventListener('resize', () => fit(canvas));
  document.addEventListener('fullscreenchange', () => fit(canvas));

  return app;
}

function fit(canvas) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let w = vw;
  let h = Math.round(vw / ASPECT);
  if (h > vh) {
    h = vh;
    w = Math.round(vh * ASPECT);
  }
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.style.position = 'absolute';
  canvas.style.left = `${Math.round((vw - w) / 2)}px`;
  canvas.style.top = `${Math.round((vh - h) / 2)}px`;
}

export function screenToView(clientX, clientY) {
  const rect = app.canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW_W,
    y: ((clientY - rect.top) / rect.height) * VIEW_H,
  };
}

export function toggleFullscreen() {
  if (!document.fullscreenElement) {
    containerEl?.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

export function isFullscreen() {
  return !!document.fullscreenElement;
}

/** Screen shake driven by the camera system; keeps values in view space. */
export const shake = { amount: 0, decay: 6, x: 0, y: 0 };
