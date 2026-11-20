/**
 * Options.
 *
 * One vertical navigation list drives everything - three audio buses, display
 * mode, mute - the way a console settings screen works: up/down moves the
 * focus, left/right changes the value, confirm toggles.  A control legend
 * below swaps its glyphs to whichever device was used last.
 */
import { Container, Graphics } from 'pixi.js';
import { VIEW_W, VIEW_H } from '../core/app.js';
import { COLORS, text } from '../ui/type.js';
import { panel, Slider, divider } from '../ui/widgets.js';
import { playSfx, settings, setBusVolume, setMuted, playMusic } from '../core/audio.js';
import { input, GLYPH } from '../core/input.js';
import { toggleFullscreen, isFullscreen } from '../core/app.js';

const ROW_H = 22;

export class OptionsMenu {
  constructor({ onBack }) {
    this.node = new Container();
    this.node.visible = false;
    this.onBack = onBack;
    this.t = 0;
    this.index = 0;

    this.dim = new Graphics();
    this.dim.rect(0, 0, VIEW_W, VIEW_H).fill({ color: 0x04030a, alpha: 0.86 });
    this.node.addChild(this.dim);

    this.box = new Container();
    this.box.x = VIEW_W / 2;
    this.box.y = VIEW_H / 2;
    this.node.addChild(this.box);

    const W = 276;
    const H = 244;
    const TOP = -H / 2;
    const shade = new Graphics();
    shade.roundRect(-W / 2, TOP, W, H, 5).fill({ color: 0x0b0812, alpha: 0.97 });
    const inner = new Graphics();
    inner.roundRect(-W / 2 + 7, TOP + 7, W - 14, H - 14, 4).fill({ color: 0x0d0a14, alpha: 1 });
    this.box.addChild(inner);
    this.box.addChild(shade);
    this.plate = panel(W, H, { id: 'ui_panel', alpha: 0.34 });
    this.plate.x = -W / 2;
    this.plate.y = TOP;
    this.box.addChild(this.plate);

    // Grid: every row is placed by accumulating from the panel's top edge, so
    // rules and text can never land on top of each other.
    const left = -W / 2 + 28;
    const right = W / 2 - 30;
    const rule = (yy) => {
      const d = divider(W - 56);
      d.x = left - 4;
      d.y = yy;
      this.box.addChild(d);
      return d;
    };

    this.title = text('OPTIONS', { size: 20, font: 'title', fill: COLORS.gold, anchor: 0.5, letterSpacing: 6, stroke: 0x1a0f08, strokeWidth: 3 });
    this.title.y = TOP + 20;
    this.box.addChild(this.title);

    this.audioLabel = text('AUDIO', { size: 7, font: 'pixel', fill: COLORS.goldDim, letterSpacing: 3 });
    this.audioLabel.x = left;
    this.audioLabel.y = TOP + 38;
    this.box.addChild(this.audioLabel);
    rule(TOP + 50);

    this.sliders = [
      new Slider({ width: 96, label: 'MUSIC', value: settings.music, onChange: (v) => setBusVolume('music', v) }),
      new Slider({ width: 96, label: 'SOUND', value: settings.sfx, onChange: (v) => setBusVolume('sfx', v) }),
      new Slider({ width: 96, label: 'VOICE', value: settings.voice, onChange: (v) => setBusVolume('voice', v) }),
    ];
    this.sliders.forEach((sl, i) => {
      sl.x = left;
      sl.y = TOP + 58 + i * 18;
      sl.readoutRight = right - left - sl.trackX;
      sl.draw();
      this.box.addChild(sl);
    });
    rule(TOP + 116);

    this.toggleRows = [];
    ['DISPLAY', 'MUTE'].forEach((name, i) => {
      const row = new Container();
      row.x = left;
      row.y = TOP + 126 + i * 19;
      const label = text(name, { size: 9, font: 'pixel', fill: COLORS.boneDim, letterSpacing: 2 });
      label.y = 1;
      row.addChild(label);
      const value = text('', { size: 9, font: 'pixel', fill: COLORS.bone });
      row.addChild(value);
      const arrows = text('', { size: 8, font: 'pixel', fill: COLORS.goldDim });
      arrows.y = 12;
      row.addChild(arrows);
      row.label = label;
      row.value = value;
      row.arrows = arrows;
      row.right = right - left;
      this.box.addChild(row);
      this.toggleRows.push(row);
    });
    rule(TOP + 172);

    this.back = new Container();
    this.back.x = 0;
    this.back.y = TOP + 186;
    this.box.addChild(this.back);
    this.backLabel = text('BACK', { size: 13, font: 'body', fill: COLORS.bone, anchor: 0.5, letterSpacing: 3 });
    this.back.addChild(this.backLabel);
    this.backPlate = panel(92, 19, { id: 'ui_button', alpha: 0 });
    this.backPlate.pivot.set(46, 9.5);
    this.backPlate.y = -8;
    this.back.addChildAt(this.backPlate, 0);

    rule(TOP + 200);

    this.controls = text('', { size: 6, font: 'pixel', fill: COLORS.boneDim, align: 'center', anchor: 0.5, lineHeight: 9 });
    this.controls.y = TOP + 223;
    this.box.addChild(this.controls);

    this.rowCount = this.sliders.length + this.toggleRows.length + 1; // + BACK
  }

  open() {
    this.node.visible = true;
    this.t = 0;
    this.index = 0;
    this.refresh();
    this.focus();
  }

  close() {
    this.node.visible = false;
  }

  get isOpen() {
    return this.node.visible;
  }

  focus() {
    this.sliders.forEach((s, i) => s.setFocused(this.index === i));
    this.toggleRows.forEach((r, i) => {
      const on = this.index === this.sliders.length + i;
      r.label.style.fill = on ? COLORS.gold : COLORS.boneDim;
      r.arrows.text = on ? '\u25C0   \u25B6' : '';
      r.value.style.fill = on ? COLORS.bone : 0x9a8f84;
    });
    const onBack = this.index === this.rowCount - 1;
    this.backLabel.style.fill = onBack ? COLORS.gold : COLORS.bone;
    this.backLabel.scale.set(onBack ? 1.06 : 1);
  }

  refresh() {
    const pad = input.device === 'gamepad';
    const g = pad ? GLYPH.pad : GLYPH.key;
    this.toggleRows[0].value.text = isFullscreen() ? 'FULLSCREEN' : 'WINDOWED';
    this.toggleRows.forEach((r) => {
      r.value.x = r.right - r.value.width;
      r.arrows.x = r.right - 14;
    });
    this.toggleRows[1].value.text = settings.muted ? 'ON' : 'OFF';
    this.controls.text = [
      `CONTROLS`,
      `${g.up}${g.down}${g.left}${g.right}  MOVE     ${g.attack}  SLASH     ${g.cast}  EMBER`,
      `${g.dash}  ROLL     ${g.interact}  INTERACT   ${g.pause}  PAUSE   ${g.map}  MAP`,
      `${g.up}${g.down} SELECT   ${g.left}${g.right} CHANGE   ${g.confirm} CONFIRM   ${g.cancel} BACK`,
    ].join('\n');
  }

  onInput(inp) {
    if (!this.node.visible) return;
    if (inp.wasPressed('up') || inp.wasPressed('down')) {
      const dir = inp.wasPressed('up') ? -1 : 1;
      this.index = (this.index + dir + this.rowCount) % this.rowCount;
      playSfx('se_ui_move', { volume: 0.45 });
      this.focus();
    }
    if (inp.wasPressed('left') || inp.wasPressed('right')) {
      this.adjust(inp.wasPressed('left') ? -1 : 1);
    }
    if (inp.wasPressed('confirm')) this.activate();
    if (inp.wasPressed('cancel') || inp.wasPressed('pause')) {
      playSfx('se_ui_cancel');
      this.onBack?.();
    }
  }

  adjust(dir) {
    if (this.index < this.sliders.length) {
      const s = this.sliders[this.index];
      s.nudge(dir * 0.05);
      playSfx('se_ui_move', { volume: 0.35 });
      // let the player hear what they are changing
      if (this.index === 1) playSfx('se_slash', { volume: 0.5 });
      return;
    }
    this.activate();
  }

  activate() {
    if (this.index < this.sliders.length) return;
    const toggle = this.index - this.sliders.length;
    if (toggle === 0) {
      toggleFullscreen();
      playSfx('se_ui_confirm', { volume: 0.5 });
    } else if (toggle === 1) {
      settings.muted = !settings.muted;
      setMuted(settings.muted);
      playSfx('se_ui_confirm', { volume: 0.5 });
    } else {
      playSfx('se_ui_cancel');
      this.onBack?.();
      return;
    }
    this.refresh();
    this.focus();
  }

  update(dtMs) {
    if (!this.node.visible) return;
    this.t += dtMs;
    const k = Math.min(1, this.t / 200);
    this.box.alpha = k;
    this.box.scale.set(0.97 + 0.03 * k);
    this.sliders.forEach((s) => s.update(dtMs));
    this.backPlate.alpha = this.index === this.rowCount - 1 ? 0.3 + Math.sin(this.t * 0.005) * 0.06 : 0;
    this.refresh();
  }
}
