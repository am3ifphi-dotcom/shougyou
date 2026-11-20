/**
 * Loading screen.
 *
 * Progress bar driven by the real asset pipeline, rotating gameplay tips, an
 * animated parallax background that keeps moving while files stream in, and a
 * live fetch log (visible with TAB) so download failures are transparent.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { VIEW_W, VIEW_H } from '../core/app.js';
import { COLORS, text } from '../ui/type.js';
import { panel } from '../ui/widgets.js';
import { glowTexture, fogTexture, starField, moonTexture, mountainLayer, buildingLayer } from '../core/procedural.js';

const TIPS = [
  'A SOUL SHARD IS LOST WHEN YOU FALL. SPEND THEM BY GETTING STRONGER.',
  'HOLD SHIFT TO ROLL THROUGH A BLOW - THE FRAMES ARE INVINCIBLE.',
  'THE WARDEN TELEGRAPHS ITS VOLLEY WITH A VIOLET HALO.',
  'FLASKS ARE SCARCE. THE UNDEAD DO NOT DROP THEM OFTEN.',
  'EMBER COSTS AETHER. AETHER RETURNS WITH TIME.',
  'CANDLES MARK THE SAFE PATH THROUGH THE CRYPT.',
  'EVERY FIFTH SHARD, THE WARDEN GROWS MORE DESPERATE.',
];

export class LoadingScene {
  constructor({ onReady, onSkip }) {
    this.node = new Container();
    this.onReady = onReady;
    this.onSkip = onSkip;
    this.skipped = false;
    this.t = 0;
    this.progress = 0;
    this.shown = 0;
    this.stage = 0;
    this.tipIndex = 0;
    this.tipT = 0;
    this.showLog = false;

    this.bg = new Sprite(starField(VIEW_W, VIEW_H, 7));
    this.bg.alpha = 0.7;
    this.node.addChild(this.bg);

    this.moon = new Sprite(moonTexture());
    this.moon.anchor.set(0.5);
    this.moon.scale.set(1.6);
    this.moon.x = 372;
    this.moon.y = 58;
    this.moon.alpha = 0.9;
    this.node.addChild(this.moon);

    this.farMts = new Sprite(mountainLayer(VIEW_W * 2, 120, 21, '#14121f', 6));
    this.farMts.y = 118;
    this.node.addChild(this.farMts);
    this.nearMts = new Sprite(mountainLayer(VIEW_W * 2, 110, 44, '#0d0b14', 9));
    this.nearMts.y = 150;
    this.node.addChild(this.nearMts);
    this.town = new Sprite(buildingLayer(VIEW_W * 2, 80, 91, '#08060d'));
    this.town.y = 190;
    this.node.addChild(this.town);

    this.fog = new Sprite(fogTexture());
    this.fog.anchor.set(0.5);
    this.fog.width = VIEW_W * 1.5;
    this.fog.height = 90;
    this.fog.x = VIEW_W / 2;
    this.fog.y = VIEW_H - 64;
    this.fog.alpha = 0.55;
    this.node.addChild(this.fog);

    this.glow = new Sprite(glowTexture(200, '255,150,70'));
    this.glow.anchor.set(0.5);
    this.glow.x = VIEW_W / 2;
    this.glow.y = VIEW_H - 46;
    this.glow.alpha = 0.18;
    this.node.addChild(this.glow);

    /* progress panel ------------------------------------------------- */
    this.panelBox = new Container();
    this.panelBox.x = VIEW_W / 2 - 120;
    this.panelBox.y = VIEW_H - 92;
    this.node.addChild(this.panelBox);
    this.panelBox.addChild(panel(240, 34, { id: 'ui_panel_inset', inset: true, alpha: 0.92 }));

    this.label = text('DESCENDING INTO THE CRYPT', { size: 9, font: 'pixel', fill: COLORS.boneDim, letterSpacing: 1 });
    this.label.x = 10;
    this.label.y = 5;
    this.panelBox.addChild(this.label);

    this.pct = text('0%', { size: 9, font: 'pixel', fill: COLORS.gold, anchorX: 1 });
    this.pct.x = 230;
    this.pct.y = 5;
    this.panelBox.addChild(this.pct);

    this.barBack = new Graphics();
    this.barBack.roundRect(10, 18, 220, 8, 2).fill(0x0d0b12).stroke({ width: 1, color: 0x6b4a2a });
    this.panelBox.addChild(this.barBack);
    this.barFill = new Graphics();
    this.panelBox.addChild(this.barFill);
    this.barShine = new Graphics();
    this.panelBox.addChild(this.barShine);

    this.stageLabel = text('', { size: 8, font: 'pixel', fill: 0x6b6357 });
    this.stageLabel.x = 10;
    this.stageLabel.y = 40;
    this.panelBox.addChild(this.stageLabel);

    this.tip = text(TIPS[0], { size: 9, font: 'body', fill: COLORS.boneDim, align: 'center', anchor: 0.5 });
    this.tip.x = VIEW_W / 2;
    this.tip.y = VIEW_H - 18;
    this.node.addChild(this.tip);

    this.logBox = new Container();
    this.logBox.x = 16;
    this.logBox.y = 10;
    this.logBox.visible = false;
    this.node.addChild(this.logBox);
    this.logText = text('', { size: 6, font: 'pixel', fill: 0x8f8168, lineHeight: 8 });
    this.logBox.addChild(this.logText);

    this.hint = text('[TAB] FETCH LOG   [ESC] SKIP PRELOAD', { size: 7, font: 'pixel', fill: 0x4a4152, anchorX: 1 });
    this.hint.x = VIEW_W - 12;
    this.hint.y = VIEW_H - 34;
    this.node.addChild(this.hint);
  }

  setStage(index, label) {
    this.stage = index;
    this.stageLabel.text = label;
    this.label.text = label;
  }

  setProgress(p) {
    this.progress = Math.max(this.progress, Math.min(1, p));
  }

  setLog(lines) {
    this.logText.text = lines.slice(-42).join('\n');
  }

  update(dtMs) {
    this.t += dtMs;
    // eased bar so short tasks still read as movement
    this.shown += (this.progress - this.shown) * Math.min(1, dtMs * 0.006);

    this.farMts.x = -((this.t * 0.004) % VIEW_W);
    this.nearMts.x = -((this.t * 0.011) % VIEW_W);
    this.town.x = -((this.t * 0.022) % VIEW_W);
    this.fog.x = VIEW_W / 2 + Math.sin(this.t * 0.0006) * 30;
    this.glow.alpha = 0.14 + Math.sin(this.t * 0.004) * 0.05;

    this.barFill.clear();
    const w = Math.max(0, 218 * this.shown);
    if (w > 0) {
      this.barFill.roundRect(11, 19, w, 6, 1.5).fill(0x8a5c33);
      this.barFill.roundRect(11, 19, w, 3, 1.5).fill(0xd8a05a);
    }
    this.barShine.clear();
    const shineX = 11 + ((this.t * 0.08) % 240) - 20;
    if (shineX < 11 + w) {
      this.barShine.rect(Math.max(11, shineX), 19, 8, 6).fill({ color: 0xffe8b0, alpha: 0.35 });
    }
    this.pct.text = `${Math.round(this.shown * 100)}%`;

    this.tipT += dtMs;
    if (this.tipT > 3600) {
      this.tipT = 0;
      this.tipIndex = (this.tipIndex + 1) % TIPS.length;
      this.tip.text = TIPS[this.tipIndex];
    }
    this.tip.alpha = 0.55 + Math.sin(this.t * 0.002) * 0.2;
  }

  onInput(input) {
    if (input.wasPressed('map')) {
      this.showLog = !this.showLog;
      this.logBox.visible = this.showLog;
    }
    if (input.wasPressed('cancel') || input.wasPressed('confirm')) {
      this.skipped = true;
      this.onSkip?.();
    }
  }
}
