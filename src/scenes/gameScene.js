/**
 * Gameplay scene: owns the world, HUD, pause menu, dialogue and the run stats.
 * Runs a fixed 60Hz simulation step so physics feel identical on any monitor.
 */
import { Container, Graphics } from 'pixi.js';
import { VIEW_W, VIEW_H, uiLayer } from '../core/app.js';
import { GameWorld } from '../game/world.js';
import { HUD } from '../game/hud.js';
import { PauseMenu } from './pauseMenu.js';
import { DialogueBox, Banner } from '../ui/dialogue.js';
import { playSfx, playMusic, stopMusic } from '../core/audio.js';
import { COLORS, text } from '../ui/type.js';
import { TimeFX, FlashOverlay } from '../game/effects.js';
import { writeSave, clearSave } from '../core/save.js';
import { isSolid, TILE } from '../game/dungeon.js';

const STEP = 1000 / 60;

const INTRO = [
  ['WARDEN', 'The crown lies broken in the deep. Its shards still remember a king.'],
  ['YOU', 'Then I will take them back, one bone at a time.'],
];

export class GameScene {
  constructor({ seed, resume, onEnd, onQuit, onOpenOptions }) {
    this.node = new Container();
    this.seed = seed;
    this.resume = resume || null;
    this.onEnd = onEnd;
    this.onQuit = onQuit;
    this.onOpenOptions = onOpenOptions;
    this.acc = 0;
    this.paused = false;
    this.over = false;
    this.running = true;

    this.stats = {
      souls: resume?.souls || 0,
      level: resume?.level || 1,
      kills: 0,
      time: 0,
      deaths: 0,
      victory: false,
      startedAt: performance.now(),
    };

    this.world = new GameWorld({ seed, onEvent: (ev) => this.handleEvent(ev) });
    if (this.resume) this.applyResume();

    // Everything that must float above the world lives on one container so the
    // state machine can hand it to the UI layer in a single move.
    this.uiNode = new Container();
    this.uiNode.eventMode = 'none';

    this.hud = new HUD(this.world);
    this.dialogue = new DialogueBox();
    this.banner = new Banner();
    this.flash = new FlashOverlay(VIEW_W, VIEW_H);
    this.uiNode.addChild(this.hud.node, this.banner, this.dialogue, this.flash);

    this.timefx = new TimeFX();

    this.pauseMenu = new PauseMenu({
      onResume: () => this.setPaused(false),
      onOptions: () => this.onOpenOptions?.(),
      onQuit: () => {
        writeSave(this.serialize());
        this.quitToTitle();
      },
    });
    this.uiNode.addChild(this.pauseMenu.node);

    // the options overlay is owned by the state machine (main.js) so both the
    // title screen and the pause menu can open the same instance

    this.resize = () => {};
    this.bossMusicOn = false;
    this.tutorialStep = 0;
    this.introIndex = -1;
    this.introDelay = 900;
    this.killCount = 0;

    // darkening pass lives between the world and the HUD so the UI stays lit
    this.shade = new Graphics();
    this.shade.rect(0, 0, VIEW_W, VIEW_H).fill(0x0a0714);
    this.shade.alpha = 0.42;
    this.vignette = new Graphics();
    this.buildVignette();
    this.node.addChild(this.world.root, this.shade, this.vignette);

    playMusic('bgm_dungeon', { fade: 1600 });
    this.banner.show('THE CRYPT OF ASH', 'FIND AND DESTROY THE SHATTERED WARDEN', 3000);
  }

  buildVignette() {
    const v = this.vignette;
    v.clear();
    v.rect(0, 0, VIEW_W, 26).fill({ color: 0x05040a, alpha: 0.5 });
    v.rect(0, VIEW_H - 22, VIEW_W, 22).fill({ color: 0x05040a, alpha: 0.45 });
    v.rect(0, 0, 18, VIEW_H).fill({ color: 0x05040a, alpha: 0.4 });
    v.rect(VIEW_W - 18, 0, 18, VIEW_H).fill({ color: 0x05040a, alpha: 0.4 });
  }

  applyResume() {
    const r = this.resume;
    const p = this.world.player;
    p.level = r.level || 1;
    p.souls = r.souls || 0;
    p.maxHp = 100 + (p.level - 1) * 12;
    p.hp = r.hp && r.hp > 0 ? Math.min(p.maxHp, r.hp) : p.maxHp;
    p.potions = r.potions ?? 2;
    p.xp = r.xp || 0;
    p.xpNext = r.xpNext || 20;
    this.stats.level = p.level;
    this.stats.souls = p.souls;
    this.hud.syncFromWorld(true);
  }

  serialize() {
    const p = this.world.player;
    return {
      seed: this.seed,
      level: p.level,
      souls: p.souls,
      hp: Math.ceil(p.hp),
      potions: p.potions,
      xp: p.xp,
      xpNext: p.xpNext,
      elapsed: this.world.elapsed,
    };
  }

  statsLine() {
    return `${this.world.objective}   ·   LV ${this.world.player.level}   ·   ${this.stats.kills} SLAIN`;
  }

  handleEvent(ev) {
    if (ev.type === 'hitstop') {
      this.timefx.hit(ev.ms);
    } else if (ev.type === 'player-hit') {
      this.flash.flash(0xc8414a, 180, 0.28);
      this.hud.onEvent(ev);
    } else if (ev.type === 'boss-spawn') {
      this.hud.onEvent(ev); // raises the boss health bar
      this.banner.show('THE SHATTERED WARDEN', 'A BROKEN KING RISES', 2600);
      this.timefx.slowmo(700, 0.35);
      this.bossMusicOn = true;
      playMusic('bgm_boss', { fade: 1800 });
    } else if (ev.type === 'boss-died') {
      this.hud.onEvent(ev); // drops the boss bar as it dies
      this.completeRun(true);
    } else if (ev.type === 'player-died') {
      this.completeRun(false);
    } else if (ev.type === 'enemy-died') {
      this.stats.kills++;
      if (ev.enemy?.isBoss) this.flash.flash(0xffffff, 800, 0.6);
    } else if (ev.type === 'level-up') {
      this.flash.flash(0xe8b650, 320, 0.25);
    } else if (ev.type === 'souls' || ev.type === 'potion-used' || ev.type === 'chest') {
      this.hud.onEvent(ev);
    }
    this.stats.souls = this.world.player.souls;
    this.stats.level = this.world.player.level;
  }

  completeRun(victory) {
    if (this.over) return;
    this.over = true;
    this.running = false;
    this.stats.victory = victory;
    this.stats.time = performance.now() - this.stats.startedAt;
    if (victory) {
      this.timefx.slowmo(1400, 0.25);
      this.flash.flash(0xffffff, 900, 0.75);
      playSfx('se_levelup', { volume: 1 });
      clearSave();
    } else {
      playSfx('se_gameover', { volume: 0.9 });
      clearSave();
    }
    setTimeout(() => {
      this.onEnd?.({
        victory,
        souls: this.world.player.souls,
        level: this.world.player.level,
        kills: this.stats.kills,
        time: this.stats.time,
        deaths: victory ? 0 : 1,
      });
    }, victory ? 2600 : 1800);
  }

  setPaused(v) {
    this.paused = v;
    if (v) {
      this.pauseMenu.open(this.statsLine());
      playMusic('bgm_dungeon', { fade: 600 });
    } else {
      this.pauseMenu.close();
    }
  }

  quitToTitle() {
    this.running = false;
    stopMusic(700);
    this.onQuit?.();
  }

  onInput(inp) {
    if (!this.running) return;
    if (this.over) return;

    // pause is always reachable, even mid-conversation
    if (inp.wasPressed('pause')) {
      this.setPaused(!this.paused);
      return;
    }

    if (this.dialogue.visible) {
      if (inp.wasPressed('confirm') || inp.wasPressed('attack') || inp.wasPressed('cancel') || inp.anyPressed) {
        if (this.dialogue.skip()) this.advanceIntro();
      }
      return;
    }
    if (this.paused) {
      this.pauseMenu.onInput(inp);
      return;
    }
    if (inp.wasPressed('map')) {
      playSfx('se_ui_confirm', { volume: 0.4 });
    }
  }

  advanceIntro() {
    this.introIndex++;
    if (this.introIndex >= INTRO.length) {
      this.dialogue.hide();
      return;
    }
    const [name, line] = INTRO[this.introIndex];
    this.dialogue.say(name, line);
    this.dialogue.targetY = VIEW_H - this.dialogue.h - 16;
  }

  update(dtMs, inp) {
    if (this.disposed) return;
    this.flash.update(dtMs);
    this.pauseMenu.update(dtMs);

    if (this.paused) {
      this.hud.update(dtMs * 0.2);
      return;
    }

    if (this.introIndex === -1) {
      this.introDelay -= dtMs;
      if (this.introDelay <= 0) this.advanceIntro();
    }
    this.dialogue.update(dtMs);
    this.banner.update(dtMs);
    // pull the HUD back while a conversation is on screen so the text is the
    // only thing competing for attention
    const hudTarget = this.dialogue.visible ? 0.5 : 1;
    this.hud.node.alpha += (hudTarget - this.hud.node.alpha) * Math.min(1, dtMs * 0.008);

    if (!this.running) {
      this.world.particles.update(dtMs);
      this.hud.update(dtMs);
      return;
    }

    const scaled = this.timefx.scale(dtMs);
    this.acc += scaled;
    let steps = 0;
    while (this.acc >= STEP && steps < 4) {
      this.world.update(STEP, inp, { paused: false });
      this.acc -= STEP;
      steps++;
    }
    if (steps === 4) this.acc = 0;

    this.stats.time = performance.now() - this.stats.startedAt;
    this.hud.update(dtMs);
    this.hud.updatePrompts();

    // checkpoint every few seconds while the run is healthy
    if (!this._lastSave || performance.now() - this._lastSave > 6000) {
      this._lastSave = performance.now();
      if (this.world.player.hp > 0) writeSave(this.serialize());
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    this.world.dispose();
    const stash = [this.uiNode, this.node];
    for (const n of stash) {
      if (n && !n.destroyed) {
        if (n.parent) n.parent.removeChild(n);
        n.destroy({ children: true });
      }
    }
  }
}
