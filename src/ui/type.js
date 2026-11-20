/**
 * Shared text styling.
 *
 * All copy goes through here so the whole game keeps one typographic voice:
 * blackletter for titles, antique serif for body, dot-matrix for Japanese
 * hints.  Everything gets a hard drop shadow so it survives on top of a busy
 * pixel background.
 */
import { Text, TextStyle } from 'pixi.js';

export const fonts = {
  title: 'SC-Title, Georgia, serif',
  body: 'SC-Body, Georgia, "Times New Roman", serif',
  pixel: 'SC-Pixel, monospace',
};

export const COLORS = {
  gold: 0xe8b650,
  goldDim: 0xa97c2f,
  bone: 0xe8dcc0,
  boneDim: 0xb8a888,
  blood: 0xc8414a,
  arcane: 0xc3aaff,
  ghost: 0x6fd3d8,
  ink: 0x100c14,
  white: 0xf6efdd,
  disabled: 0x6b6357,
};

export function text(content, opts = {}) {
  const {
    size = 14,
    font = 'body',
    fill = COLORS.bone,
    align = 'left',
    letterSpacing = 0,
    shadow = true,
    shadowColor = 0x000000,
    shadowAlpha = 0.9,
    stroke = null,
    strokeWidth = 2,
    wordWrap = false,
    wrapWidth = 0,
    lineHeight = 0,
    anchor = 0,
    anchorX = null,
    anchorY = null,
    alpha = 1,
    weight = 'normal',
    pixelDensity = 2,
  } = opts;

  const style = new TextStyle({
    fontFamily: fonts[font] || fonts.body,
    fontSize: size,
    fill,
    align,
    letterSpacing,
    lineHeight: lineHeight || Math.round(size * 1.35),
    fontWeight: weight,
    wordWrap,
    wordWrapWidth: wrapWidth,
    breakWords: true,
    dropShadow: shadow
      ? { color: shadowColor, alpha: shadowAlpha, blur: 0, distance: 1, angle: Math.PI / 2 }
      : undefined,
    stroke: stroke ? { color: stroke, width: strokeWidth, join: 'round' } : undefined,
    padding: 4,
  });
  const t = new Text({ text: content, style, resolution: pixelDensity });
  // `anchor` sets both axes (what most centred text wants).  anchorX/anchorY
  // exist for right-aligned text that must keep its top edge on the row line -
  // anchor:1 alone would also push it up by its own height.
  const ax = anchorX ?? anchor;
  const ay = anchorY ?? (anchorX !== null ? 0 : anchor);
  t.anchor.set(ax, ay);
  t.alpha = alpha;
  t.label = 'copy';
  return t;
}

export function withOutline(content, opts = {}) {
  return text(content, { stroke: COLORS.ink, strokeWidth: 3, ...opts });
}

export const TITLE_STYLE = {
  font: 'title',
  size: 54,
  fill: COLORS.gold,
  letterSpacing: 2,
  stroke: 0x2a1a10,
  strokeWidth: 4,
  shadow: true,
};

export const LABEL_STYLE = {
  font: 'body',
  size: 11,
  fill: COLORS.boneDim,
  letterSpacing: 1,
};
