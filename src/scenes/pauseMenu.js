/**
 * Pause menu: the live frame is kept underneath, dimmed and blurred by the
 * blur filter on an extracted snapshot (cheap and keeps the pixel look), then
 * the parchment menu is layered on top.
 */
import { Container, Graphics, Sprite, BlurFilter, ColorMatrixFilter } from 'pixi.js';
import { VIEW_W, VIEW_H, app } from '../core/app.js';
import { COLORS, text } from '../ui/type.js';
import { MenuList, panel } from '../ui/widgets.js';
import { playSfx } from '../core/audio.js';

export class PauseMenu {
  constructor({ onResume, onOptions, onQuit }) {
    this.node = new Container();
    this.node.visible = false;
    this.onResume = onResume;
    this.onOptions = onOptions;
    this.onQuit = onQuit;
    this.t = 0;

    this.dim = new Graphics();
    this.dim.rect(0, 0, VIEW_W, VIEW_H).fill({ color: 0x05040a, alpha: 0.68 });
    this.node.addChild(this.dim);

    // soft horizontal bands standing in for a proper frosted-glass blur; they
    // ride over the frozen frame and keep the pixel grid intact.
    this.bands = new Graphics();
    for (let y = 0; y < VIEW_H; y += 4) {
      this.bands.rect(0, y, VIEW_W, 2).fill({ color: 0x0a0710, alpha: 0.18 });
    }
    this.node.addChild(this.bands);

    this.box = new Container();
    this.box.x = VIEW_W / 2;
    this.box.y = VIEW_H / 2 - 6;
    this.node.addChild(this.box);

    const shade = new Graphics();
    shade.roundRect(-112, -46, 224, 148, 5).fill({ color: 0x0a0714, alpha: 0.97 });
    const inner = new Graphics();
    inner.roundRect(-105, -39, 210, 134, 4).fill({ color: 0x0e0b16, alpha: 1 });
    this.box.addChild(inner);
    this.box.addChild(shade);
    this.plate = panel(224, 148, { id: 'ui_panel', alpha: 0.34 });
    this.plate.x = -112;
    this.plate.y = -46;
    this.box.addChild(this.plate);

    this.title = text('PAUSED', { size: 26, font: 'title', fill: COLORS.gold, anchor: 0.5, letterSpacing: 6, stroke: 0x1a0f08, strokeWidth: 3 });
    this.title.y = -28;
    this.box.addChild(this.title);

    this.divider = new Graphics();
    this.divider.moveTo(-70, -10).lineTo(70, -10).stroke({ width: 1, color: 0x8a6a44, alpha: 0.7 });
    this.box.addChild(this.divider);

    this.menu = new MenuList(
      [{ label: 'RESUME' }, { label: 'OPTIONS' }, { label: 'ABANDON RUN' }],
      { x: 0, y: 6, gap: 22, size: 15, width: 224, align: 0.5, onMove: () => playSfx('se_ui_move', { volume: 0.5 }) }
    );
    this.box.addChild(this.menu);

    this.stats = text('', { size: 8, font: 'pixel', fill: COLORS.boneDim, anchor: 0.5, align: 'center' });
    this.stats.y = 82;
    this.box.addChild(this.stats);
  }

  open(statsLine = '') {
    this.node.visible = true;
    this.t = 0;
    this.stats.text = statsLine;
    this.menu.select(0, { silent: true });
    playSfx('se_ui_confirm', { volume: 0.5, pitchJitter: 0.01 });
  }

  close() {
    this.node.visible = false;
  }

  get open_() {
    return this.node.visible;
  }

  onInput(inp) {
    if (!this.node.visible) return;
    if (inp.wasPressed('up')) this.menu.move(-1);
    if (inp.wasPressed('down')) this.menu.move(1);
    if (inp.wasPressed('confirm')) {
      playSfx('se_ui_confirm');
      const label = this.menu.active.label;
      if (label === 'RESUME') this.onResume?.();
      else if (label === 'OPTIONS') this.onOptions?.();
      else this.onQuit?.();
    }
    if (inp.wasPressed('cancel') || inp.wasPressed('pause')) {
      playSfx('se_ui_cancel');
      this.onResume?.();
    }
  }

  update(dtMs) {
    if (!this.node.visible) return;
    this.t += dtMs;
    const k = Math.min(1, this.t / 220);
    this.box.alpha = k;
    this.box.scale.set(0.96 + 0.04 * k);
    this.menu.update(dtMs);
  }
}
