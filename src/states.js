// states.js — BOOT / LOADING / TITLE / MENU / OPTIONS / CREDITS / RESULT
import { clamp, lerp, rand, choice, easeOutCubic, easeOutBack } from "./core.js";
import { drawText, drawPanel, drawInputChip, drawBar, PALETTE, tintImage, Toast } from "./ui.js";
import {
  GAME_TITLE_JP, GAME_TITLE_EN, GAME_SUBTITLE, VERSION, COPYRIGHT,
  TIPS, buildCredits,
} from "./data.js";

const W = 640, H = 360;

// ------------------------------------------------------------------ BOOT
export class BootState {
  constructor(game) {
    this.game = game;
    this.t = 0;
  }
  enter() { this.game.audio.playBGM("bgm_boot", 0.5); }
  update(dt) {
    this.t += dt;
    if (this.game.input.anyPressed()) this.anyKeyAt = this.t;
    if (this.t > 3.2 || (this.t > 1.2 && this.anyKeyAt !== undefined)) {
      this.game.setState(new LoadingState(this.game));
    }
  }
  render(ctx) {
    ctx.fillStyle = "#050308";
    ctx.fillRect(0, 0, W, H);
    const a = clamp(Math.min(this.t / 0.8, (3.2 - this.t) / 0.8), 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    drawText(ctx, "KIRIHA GAKUEN", W / 2, H / 2 - 26, {
      size: 16, color: PALETTE.bone, align: "center", glow: "rgba(232,220,184,0.35)",
    });
    drawText(ctx, "ARCAGE WORKS", W / 2, H / 2 + 2, {
      size: 10, color: PALETTE.goldDim, align: "center", letter: 4,
    });
    drawText(ctx, "presents", W / 2, H / 2 + 30, {
      size: 7, color: PALETTE.boneDim, align: "center",
    });
    ctx.restore();
  }
}

// ------------------------------------------------------------------ LOADING
export class LoadingState {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.progress = 0;
    this.label = "";
    this.tip = choice(TIPS);
    this.tipT = 0;
    this.started = false;
    this.done = false;
    this.particles = [];
    for (let i = 0; i < 46; i++) {
      this.particles.push({
        x: rand(0, W), y: rand(0, H), vy: rand(6, 22), size: rand(1, 3),
        a: rand(0.15, 0.5), tw: rand(0, Math.PI * 2),
      });
    }
    this.minTime = 1.6;
  }
  enter() {
    this.started = true;
    const g = this.game;
    g.assets.loadAll(
      (done, total, label) => { this.progress = done / total; this.label = label || ""; },
      (msg) => { this.lastLog = msg; }
    ).then(() => { this.done = true; });
  }
  update(dt) {
    this.t += dt;
    this.tipT += dt;
    if (this.tipT > 5.5) { this.tipT = 0; this.tip = choice(TIPS); }
    for (const p of this.particles) {
      p.y -= p.vy * dt;
      p.tw += dt * 2;
      if (p.y < -4) { p.y = H + 4; p.x = rand(0, W); }
    }
    if (this.done && this.t > this.minTime) {
      this.game.setState(new TitleState(this.game));
    }
  }
  render(ctx) {
    // animated background: vertical gradient + drifting particles + scanline
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#120b1e");
    grad.addColorStop(0.55, "#1a1024");
    grad.addColorStop(1, "#0b0714");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particles) {
      ctx.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(p.tw));
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(p.x, p.y, p.size, p.size * 2);
    }
    ctx.restore();

    // logo
    drawText(ctx, GAME_TITLE_EN, W / 2, 64, {
      size: 22, color: PALETTE.gold, align: "center", glow: "rgba(255,210,124,0.4)",
    });
    drawText(ctx, GAME_TITLE_JP, W / 2, 96, {
      size: 14, font: "jp", color: PALETTE.bone, align: "center",
    });

    // progress bar
    const bx = 120, by = 210, bw = 400, bh = 16;
    drawPanel(ctx, bx - 10, by - 10, bw + 20, bh + 20, {
      img: this.game.borderImg, tint: PALETTE.goldDim, alpha: 0.9, fill: "rgba(13,10,20,0.85)",
    });
    drawBar(ctx, bx, by, bw, bh, this.progress, this.progress, {
      fg: PALETTE.gold, fgLow: PALETTE.goldDim, ghostColor: "rgba(255,210,124,0.25)",
      back: "rgba(10,6,16,0.9)",
    });
    drawText(ctx, `NOW LOADING  ${Math.floor(this.progress * 100)}%`, W / 2, by + 28, {
      size: 8, color: PALETTE.bone, align: "center",
    });
    drawText(ctx, this.label || "…", W / 2, by + 44, {
      size: 6, color: PALETTE.boneDim, align: "center",
    });

    // tip
    drawText(ctx, this.tip, W / 2, 298, {
      size: 8, font: "jp", color: PALETTE.cyan, align: "center",
    });

    // internal log tail (asset fetch status)
    const logs = this.game.assets.logs.slice(-4);
    let ly = 322;
    for (const l of logs) {
      drawText(ctx, l.replace("[assets] ", ""), 12, ly, {
        size: 5, color: "rgba(157,145,122,0.75)",
      });
      ly += 9;
    }

    // scanline
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  }
}

// ------------------------------------------------------------------ TITLE
export class TitleState {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.motes = [];
    for (let i = 0; i < 40; i++) {
      this.motes.push({
        x: rand(0, W), y: rand(0, H), vx: rand(-4, 4), vy: rand(-10, -3),
        size: rand(1, 2.6), a: rand(0.2, 0.7), tw: rand(0, Math.PI * 2),
      });
    }
  }
  enter() {
    this.game.audio.playBGM("bgm_title", 1.2);
  }
  update(dt) {
    this.t += dt;
    if (this.game.input.anyPressed()) this.anyKeyAt = this.t;
    for (const m of this.motes) {
      m.x += m.vx * dt; m.y += m.vy * dt; m.tw += dt * 1.7;
      if (m.y < -6) { m.y = H + 6; m.x = rand(0, W); }
      if (m.x < -6) m.x = W + 6;
      if (m.x > W + 6) m.x = -6;
    }
    if (this.t > 0.8 && this.anyKeyAt !== undefined) {
      this.game.audio.playSE("se_ui_confirm", { vol: 0.8 });
      this.game.setState(new MenuState(this.game));
    }
  }
  render(ctx) {
    const g = this.game;
    const art = g.assets.img("art_title");
    ctx.fillStyle = "#0b0714";
    ctx.fillRect(0, 0, W, H);
    if (art && art.width) {
      // slow camera drift (parallax feel)
      const dw = W * 1.12, dh = dw * (art.height / art.width);
      const ox = -Math.sin(this.t * 0.06) * 18 - (dw - W) / 2;
      const oy = -Math.cos(this.t * 0.05) * 10 - (dh - H) / 2;
      ctx.drawImage(art, ox, oy, dw, dh);
    }
    ctx.fillStyle = "rgba(13,8,24,0.42)";
    ctx.fillRect(0, 0, W, H);

    // drifting motes
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const m of this.motes) {
      ctx.globalAlpha = m.a * (0.55 + 0.45 * Math.sin(m.tw));
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(m.x, m.y, m.size, m.size);
    }
    ctx.restore();

    // logo
    const pop = easeOutBack(clamp(this.t / 1.1, 0, 1));
    ctx.save();
    ctx.translate(W / 2, 118);
    ctx.scale(pop, pop);
    drawText(ctx, GAME_TITLE_JP, 0, -28, {
      size: 44, font: "jp", color: PALETTE.gold, align: "center",
      glow: "rgba(255,210,124,0.75)", outlineWidth: 3,
    });
    drawText(ctx, GAME_TITLE_EN, 0, 22, {
      size: 18, color: PALETTE.bone, align: "center", letter: 6,
    });
    drawText(ctx, GAME_SUBTITLE, 0, 52, {
      size: 8, color: PALETTE.violet, align: "center", letter: 2,
    });
    ctx.restore();

    // PRESS ANY KEY (blink)
    if (this.t > 1.2) {
      const blink = 0.5 + 0.5 * Math.sin(this.t * 3.6);
      ctx.save();
      ctx.globalAlpha = blink;
      drawText(ctx, "PRESS ANY KEY", W / 2, 268, {
        size: 11, color: PALETTE.bone, align: "center", glow: "rgba(232,220,184,0.5)",
      });
      ctx.restore();
    }

    // corner credits
    drawText(ctx, VERSION, 12, H - 18, { size: 6, color: PALETTE.boneDim });
    drawText(ctx, COPYRIGHT, W - 12, H - 18, { size: 6, color: PALETTE.boneDim, align: "right" });
  }
}

// ------------------------------------------------------------------ MENU
export class MenuState {
  constructor(game) {
    this.game = game;
    this.items = [
      { key: "NEW GAME", jp: "はじめから", action: "new" },
      { key: "CONTINUE", jp: "つづきから", action: "continue" },
      { key: "OPTIONS", jp: "せってい", action: "options" },
      { key: "CREDITS", jp: "くれじっと", action: "credits" },
      { key: "QUIT", jp: "おわる", action: "quit" },
    ];
    this.index = 0;
    this.t = 0;
    this.cursorT = 0;
  }
  enter() { }
  update(dt) {
    const g = this.game;
    this.t += dt;
    this.cursorT += dt;
    const inp = g.input;
    if (inp.justPressed("up")) { this.index = (this.index + this.items.length - 1) % this.items.length; g.audio.playSE("se_ui_move"); }
    if (inp.justPressed("down")) { this.index = (this.index + 1) % this.items.length; g.audio.playSE("se_ui_move"); }
    if (inp.justPressed("cancel")) { g.audio.playSE("se_ui_cancel"); g.setState(new TitleState(g)); return; }
    if (inp.justPressed("confirm")) {
      const item = this.items[this.index];
      const cp = g.save.data.checkpoint;
      if (item.action === "continue" && !cp) {
        g.audio.playSE("se_ui_error");
        return;
      }
      g.audio.playSE("se_ui_confirm");
      if (item.action === "new") {
        g.save.clearCheckpoint();
        g.startRun(null);
      } else if (item.action === "continue") {
        g.startRun({ checkpoint: cp });
      } else if (item.action === "options") {
        g.openOptions(() => g.setState(new MenuState(g)));
      } else if (item.action === "credits") {
        g.setState(new CreditsState(g));
      } else if (item.action === "quit") {
        g.setState(new QuitState(g));
      }
    }
  }
  render(ctx) {
    const g = this.game;
    const art = g.assets.img("art_title");
    ctx.fillStyle = "#0b0714";
    ctx.fillRect(0, 0, W, H);
    if (art && art.width) {
      const dw = W * 1.18, dh = dw * (art.height / art.width);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(art, -(dw - W) / 2 + Math.sin(this.t * 0.05) * 12, -(dh - H) / 2, dw, dh);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = "rgba(10,6,20,0.6)";
    ctx.fillRect(0, 0, W, H);

    drawText(ctx, GAME_TITLE_JP, W / 2, 52, {
      size: 26, font: "jp", color: PALETTE.gold, align: "center", glow: "rgba(255,210,124,0.5)",
    });

    const cp = g.save.data.checkpoint;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const y = 132 + i * 38;
      const sel = i === this.index;
      const disabled = it.action === "continue" && !cp;
      if (sel) {
        const w = 268 + Math.sin(this.cursorT * 4) * 3;
        drawPanel(ctx, W / 2 - w / 2, y - 15, w, 32, {
          img: g.borderImg, tint: PALETTE.gold, alpha: 0.92, fill: "rgba(36,23,51,0.92)",
        });
        // cursor sprite (pixel cursor pack)
        const cur = g.cursorImg;
        if (cur && cur.complete && cur.naturalWidth) {
          ctx.drawImage(cur, W / 2 - w / 2 - 26, y - 8, 18, 18);
        }
      }
      drawText(ctx, it.key, W / 2, y - 6, {
        size: 12,
        color: disabled ? "rgba(120,110,95,0.8)" : sel ? PALETTE.gold : PALETTE.bone,
        align: "center",
        glow: sel ? "rgba(255,210,124,0.55)" : null,
      });
      drawText(ctx, it.jp, W / 2, y + 10, {
        size: 7, font: "jp",
        color: disabled ? "rgba(110,100,88,0.7)" : sel ? PALETTE.boneDim : "rgba(157,145,122,0.8)",
        align: "center",
      });
      if (it.action === "continue" && cp) {
        drawText(ctx, `WAVE ${cp.wave}`, W / 2 + 132, y - 4, {
          size: 6, color: PALETTE.cyan, align: "left",
        });
      }
    }

    // bottom hints
    drawInputChip(ctx, (i) => g.promptTile(i), "enter", "OK", W / 2 - 70, H - 22, g.input.device, { size: 13 });
    drawInputChip(ctx, (i) => g.promptTile(i), "esc", "BACK", W / 2 + 30, H - 22, g.input.device, { size: 13 });
  }
}

// ------------------------------------------------------------------ OPTIONS
export class OptionsState {
  constructor(game, returnTo) {
    this.game = game;
    this.returnTo = returnTo;
    this.index = 0;
    this.t = 0;
    this.items = [
      { key: "BGM VOLUME", type: "slider", opt: "bgm" },
      { key: "SE VOLUME", type: "slider", opt: "se" },
      { key: "VOICE VOLUME", type: "slider", opt: "voice" },
      { key: "FULLSCREEN", type: "toggle", opt: "fullscreen" },
      { key: "CONTROLS", type: "page", opt: "controls" },
      { key: "BACK", type: "back", opt: null },
    ];
    this.showControls = false;
    this.selAnim = 0;
  }
  update(dt) {
    const g = this.game;
    this.t += dt;
    this.selAnim += dt;
    const inp = g.input;
    const o = g.save.data.options;
    if (this.showControls) {
      if (inp.justPressed("cancel") || inp.justPressed("confirm")) {
        this.showControls = false;
        g.audio.playSE("se_ui_cancel");
      }
      return;
    }
    if (inp.justPressed("up")) { this.index = (this.index + this.items.length - 1) % this.items.length; g.audio.playSE("se_ui_move"); }
    if (inp.justPressed("down")) { this.index = (this.index + 1) % this.items.length; g.audio.playSE("se_ui_move"); }
    const it = this.items[this.index];
    if (it.type === "slider") {
      if (inp.justPressed("left")) {
        o[it.opt] = clamp(o[it.opt] - 0.1, 0, 1);
        g.audio.applyVolumes(); g.save.write();
        g.audio.playSE("se_ui_move", { rate: 0.9 });
      }
      if (inp.justPressed("right")) {
        o[it.opt] = clamp(o[it.opt] + 0.1, 0, 1);
        g.audio.applyVolumes(); g.save.write();
        g.audio.playSE("se_ui_move", { rate: 1.1 });
      }
    }
    if (inp.justPressed("confirm")) {
      if (it.type === "toggle") {
        o.fullscreen = !o.fullscreen;
        g.setFullscreen(o.fullscreen);
        g.save.write();
        g.audio.playSE("se_ui_confirm");
      } else if (it.type === "page") {
        this.showControls = true;
        g.audio.playSE("se_ui_confirm");
      } else if (it.type === "back") {
        g.audio.playSE("se_ui_cancel");
        this.back();
      } else {
        g.audio.playSE("se_ui_move");
      }
    }
    if (inp.justPressed("cancel")) {
      g.audio.playSE("se_ui_cancel");
      this.back();
    }
  }
  back() {
    if (this.returnTo) this.returnTo();
    else this.game.setState(new MenuState(this.game));
  }
  render(ctx) {
    const g = this.game;
    ctx.fillStyle = "#120b1e";
    ctx.fillRect(0, 0, W, H);
    // subtle bg
    ctx.save();
    ctx.globalAlpha = 0.25;
    const art = g.assets.img("art_bg_game");
    if (art && art.width) ctx.drawImage(art, 0, 0, W, H);
    ctx.restore();
    ctx.fillStyle = "rgba(10,6,20,0.55)";
    ctx.fillRect(0, 0, W, H);

    drawText(ctx, "OPTIONS", W / 2, 38, {
      size: 18, color: PALETTE.gold, align: "center", glow: "rgba(255,210,124,0.5)",
    });
    drawText(ctx, "— せってい —", W / 2, 64, { size: 8, font: "jp", color: PALETTE.boneDim, align: "center" });

    const o = g.save.data.options;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const y = 108 + i * 34;
      const sel = i === this.index;
      if (sel) {
        drawPanel(ctx, W / 2 - 190, y - 12, 380, 28, {
          img: g.borderImg, tint: PALETTE.gold, alpha: 0.85, fill: "rgba(36,23,51,0.9)",
        });
      }
      drawText(ctx, it.key, W / 2 - 172, y - 4, {
        size: 8, color: sel ? PALETTE.gold : PALETTE.bone, baseline: "middle",
      });
      if (it.type === "slider") {
        const v = o[it.opt];
        drawBar(ctx, W / 2 + 8, y - 6, 150, 10, v, v, {
          fg: sel ? PALETTE.gold : PALETTE.goldDim, fgLow: PALETTE.goldDim,
          ghostColor: "rgba(0,0,0,0)", back: "rgba(10,6,16,0.9)",
        });
        drawText(ctx, `${Math.round(v * 100)}%`, W / 2 + 172, y - 4, {
          size: 7, color: PALETTE.boneDim, baseline: "middle",
        });
      } else if (it.type === "toggle") {
        drawText(ctx, o[it.opt] ? "ON" : "OFF", W / 2 + 40, y - 4, {
          size: 9, color: o[it.opt] ? PALETTE.cyan : PALETTE.boneDim, baseline: "middle",
        });
      } else if (it.type === "page") {
        drawText(ctx, "▸ VIEW", W / 2 + 40, y - 4, {
          size: 8, color: PALETTE.boneDim, baseline: "middle",
        });
      }
    }

    drawInputChip(ctx, (i) => g.promptTile(i), "left", "", W / 2 - 240, H - 24, g.input.device, { size: 13 });
    drawInputChip(ctx, (i) => g.promptTile(i), "right", "ADJUST", W / 2 - 214, H - 24, g.input.device, { size: 13 });
    drawInputChip(ctx, (i) => g.promptTile(i), "esc", "BACK", W / 2 + 120, H - 24, g.input.device, { size: 13 });

    if (this.showControls) this.renderControls(ctx);
  }
  renderControls(ctx) {
    const g = this.game;
    ctx.fillStyle = "rgba(8,4,16,0.86)";
    ctx.fillRect(0, 0, W, H);
    drawPanel(ctx, 70, 40, W - 140, H - 92, {
      img: g.borderImg, tint: PALETTE.goldDim, alpha: 0.95, fill: "rgba(23,16,34,0.96)",
    });
    drawText(ctx, "CONTROLS — そうさほうほう", W / 2, 62, {
      size: 11, font: "jp", color: PALETTE.gold, align: "center",
    });
    const rows = [
      ["up", "MOVE", "いどう (WASD/矢印)"],
      ["z", "SHOOT", "こうげき (Z / J)"],
      ["x", "DASH", "ダッシュ (X / SPACE)"],
      ["c", "BOMB", "ボム (C)"],
      ["esc", "PAUSE", "ポーズ (ESC / P)"],
    ];
    for (let i = 0; i < rows.length; i++) {
      const y = 100 + i * 38;
      drawInputChip(ctx, (ix) => g.promptTile(ix), rows[i][0], rows[i][1], 130, y, "keyboard", { size: 16 });
      drawText(ctx, rows[i][2], 300, y, { size: 9, font: "jp", color: PALETTE.bone, baseline: "middle" });
    }
    drawText(ctx, "GAMEPAD: 左スティック移動 / RT・X で射撃 / A ダッシュ / B ボム / START ポーズ", W / 2, H - 74, {
      size: 7, font: "jp", color: PALETTE.boneDim, align: "center",
    });
    drawText(ctx, "PRESS ANY KEY TO CLOSE", W / 2, H - 56, {
      size: 7, color: PALETTE.cyan, align: "center",
    });
  }
}

// ------------------------------------------------------------------ CREDITS
export class CreditsState {
  constructor(game) {
    this.game = game;
    this.rows = buildCredits(game.assets.manifest);
    this.scroll = -40;
    this.t = 0;
  }
  update(dt) {
    const g = this.game;
    this.t += dt;
    const inp = g.input;
    const speed = inp.down("shoot") || inp.down("dash") ? 120 : 34;
    this.scroll += speed * dt;
    const totalH = this.rows.length * 26 + 80;
    if (this.scroll > totalH + 120) this.scroll = -40;
    if (inp.justPressed("cancel") || inp.justPressed("pause")) {
      g.audio.playSE("se_ui_cancel");
      g.setState(new MenuState(g));
    }
  }
  render(ctx) {
    const g = this.game;
    ctx.fillStyle = "#0b0714";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = 0.2;
    const art = g.assets.img("art_bg_game");
    if (art && art.width) ctx.drawImage(art, 0, 0, W, H);
    ctx.restore();

    drawText(ctx, "CREDITS", W / 2, 18, {
      size: 12, color: PALETTE.gold, align: "center", glow: "rgba(255,210,124,0.4)",
    });

    ctx.save();
    // clip scroll area
    ctx.beginPath();
    ctx.rect(0, 42, W, H - 60);
    ctx.clip();
    let y = 60 - this.scroll + 40;
    for (const row of this.rows) {
      if (y > 30 && y < H) {
        if (row.kind === "header") {
          drawText(ctx, row.text, W / 2, y, { size: 10, color: PALETTE.gold, align: "center" });
        } else if (row.kind === "text" || row.kind === "note" || row.kind === "big") {
          drawText(ctx, row.text, W / 2, y, {
            size: row.kind === "big" ? 12 : row.kind === "note" ? 5 : 8,
            font: /[ぁ-んァ-ヶ一-龠〝〟]/.test(row.text) ? "jp" : "pix",
            color: row.kind === "big" ? PALETTE.cyan : row.kind === "note" ? "rgba(157,145,122,0.85)" : PALETTE.bone,
            align: "center",
          });
        } else if (row.kind === "asset") {
          drawText(ctx, `${row.title} — ${row.author}`, W / 2, y, {
            size: 7, color: PALETTE.bone, align: "center",
          });
          drawText(ctx, `${row.license}`, W / 2, y + 10, {
            size: 5, color: PALETTE.boneDim, align: "center",
          });
        }
      }
      y += row.kind === "asset" ? 34 : row.kind === "gap" ? 12 : 22;
    }
    ctx.restore();

    // top/bottom fade
    const grad = ctx.createLinearGradient(0, 42, 0, 110);
    grad.addColorStop(0, "rgba(11,7,20,1)");
    grad.addColorStop(1, "rgba(11,7,20,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 42, W, 68);
    const grad2 = ctx.createLinearGradient(0, H - 60, 0, H);
    grad2.addColorStop(0, "rgba(11,7,20,0)");
    grad2.addColorStop(1, "rgba(11,7,20,1)");
    ctx.fillStyle = grad2;
    ctx.fillRect(0, H - 60, W, 60);

    drawInputChip(ctx, (i) => g.promptTile(i), "esc", "BACK", W / 2 - 30, H - 18, g.input.device, { size: 12 });
  }
}

// ------------------------------------------------------------------ RESULT
export class ResultState {
  constructor(game, result) {
    this.game = game;
    this.r = result;
    this.t = 0;
    this.continueTimer = 10;
    this.phase = result.won ? "summary" : "continue"; // 'continue' -> 'summary'
    this.rank = this.calcRank();
    this.record = false;
  }
  enter() {
    this.game.audio.playBGM(this.r.won ? "bgm_result" : "bgm_gameover", 1.0);
  }
  calcRank() {
    const s = this.r.score;
    if (this.r.won) return "S";
    if (s >= 60000) return "S";
    if (s >= 36000) return "A";
    if (s >= 22000) return "B";
    if (s >= 10000) return "C";
    return "D";
  }
  update(dt) {
    const g = this.game;
    this.t += dt;
    const inp = g.input;
    if (this.phase === "continue") {
      this.continueTimer -= dt;
      if (inp.justPressed("confirm") && g.save.data.checkpoint) {
        g.audio.playSE("se_ui_confirm");
        g.startRun({ checkpoint: g.save.data.checkpoint });
        return;
      }
      if (this.continueTimer <= 0 || inp.justPressed("cancel")) {
        this.phase = "summary";
        this.t = 0;
        g.save.clearCheckpoint();
        g.audio.playBGM(this.r.won ? "bgm_result" : "bgm_gameover", 0.8);
      }
      return;
    }
    if (!this.savedRecord) {
      this.savedRecord = true;
      this.record = g.save.addHighscore({
        score: this.r.score, wave: this.r.wave, kills: this.r.kills,
        date: new Date().toISOString().slice(0, 10),
      });
      if (this.r.won) g.save.clearCheckpoint();
    }
    if (this.t > 1.2 && inp.anyPressed()) {
      g.audio.playSE("se_ui_confirm");
      g.toTitle();
    }
  }
  render(ctx) {
    const g = this.game;
    const r = this.r;
    ctx.fillStyle = "#0b0714";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = 0.16;
    const art = g.assets.img(r.won ? "art_title" : "art_cutin_boss");
    if (art && art.width) ctx.drawImage(art, 0, 0, W, H);
    ctx.restore();
    ctx.fillStyle = "rgba(10,6,20,0.55)";
    ctx.fillRect(0, 0, W, H);

    if (this.phase === "continue") {
      drawText(ctx, "GAME OVER", W / 2, 74, {
        size: 26, color: PALETTE.crimson, align: "center", glow: "rgba(226,86,92,0.6)",
      });
      drawText(ctx, "— 教室が閉じる —", W / 2, 112, { size: 9, font: "jp", color: PALETTE.boneDim, align: "center" });
      if (g.save.data.checkpoint) {
        drawText(ctx, "CONTINUE?", W / 2, 168, {
          size: 16, color: PALETTE.gold, align: "center", glow: "rgba(255,210,124,0.5)",
        });
        const n = Math.ceil(this.continueTimer);
        drawText(ctx, String(n), W / 2, 208, {
          size: 30, color: n <= 3 ? PALETTE.crimson : PALETTE.bone, align: "center",
        });
        drawInputChip(ctx, (i) => g.promptTile(i), "enter", "YES", W / 2 - 60, 268, g.input.device, { size: 15 });
        drawInputChip(ctx, (i) => g.promptTile(i), "esc", "NO", W / 2 + 40, 268, g.input.device, { size: 15 });
      } else {
        drawText(ctx, "PRESS ANY KEY", W / 2, 220, {
          size: 11, color: PALETTE.bone, align: "center",
          glow: "rgba(232,220,184,0.4)",
        });
      }
      return;
    }

    // summary
    drawText(ctx, r.won ? "ESSENCE CONTAINED" : "RESULT", W / 2, 44, {
      size: 18, color: r.won ? PALETTE.gold : PALETTE.bone, align: "center",
      glow: "rgba(255,210,124,0.45)",
    });
    drawText(ctx, r.won ? "— 本質の封じ完了 —" : "— 観測記録 —", W / 2, 72, {
      size: 9, font: "jp", color: PALETTE.boneDim, align: "center",
    });

    drawPanel(ctx, 130, 96, 380, 150, {
      img: g.borderImg, tint: PALETTE.goldDim, alpha: 0.92, fill: "rgba(23,16,34,0.92)",
    });
    const rows = [
      ["SCORE", String(r.score).padStart(8, "0")],
      ["WAVE", String(r.wave)],
      ["KILLS", String(r.kills)],
      ["MAX COMBO", `x${(1 + r.maxCombo).toFixed(1)}`],
      ["TIME", `${Math.floor(r.time || 0)}s`],
    ];
    for (let i = 0; i < rows.length; i++) {
      const y = 116 + i * 25;
      drawText(ctx, rows[i][0], 158, y, { size: 8, color: PALETTE.boneDim });
      drawText(ctx, rows[i][1], 482, y, { size: 10, color: PALETTE.gold, align: "right" });
    }

    // rank
    const pop = easeOutBack(clamp((this.t - 0.4) / 0.6, 0, 1));
    ctx.save();
    ctx.translate(W - 108, 258);
    ctx.scale(pop, pop);
    drawText(ctx, "RANK", 0, -34, { size: 8, color: PALETTE.boneDim, align: "center" });
    drawText(ctx, this.rank, 0, -14, {
      size: 44,
      color: this.rank === "S" ? PALETTE.gold : this.rank === "A" ? PALETTE.cyan : PALETTE.bone,
      align: "center", glow: "rgba(255,210,124,0.5)",
    });
    ctx.restore();

    if (this.record) {
      const blink = Math.floor(this.t * 3) % 2 === 0;
      if (blink) {
        drawText(ctx, "NEW RECORD!", 130, 262, {
          size: 12, color: PALETTE.gold, glow: "rgba(255,210,124,0.7)",
        });
      }
    }

    if (this.t > 1.2) {
      const blink = 0.55 + 0.45 * Math.sin(this.t * 3.4);
      ctx.save();
      ctx.globalAlpha = blink;
      drawText(ctx, "PRESS ANY KEY — TITLEへ", W / 2, H - 34, {
        size: 8, font: "jp", color: PALETTE.bone, align: "center",
      });
      ctx.restore();
    }
  }
}

// ------------------------------------------------------------------ QUIT
export class QuitState {
  constructor(game) { this.game = game; this.t = 0; }
  enter() { this.game.audio.stopBGM(1.2); }
  update(dt) {
    this.t += dt;
    if (this.t > 1.5 && this.game.input.anyPressed()) {
      this.game.setState(new TitleState(this.game));
    }
  }
  render(ctx) {
    const a = clamp(this.t / 1.4, 0, 1);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.t / 0.8);
    drawText(ctx, "POWER OFF", W / 2, H / 2 - 20, {
      size: 14, color: PALETTE.boneDim, align: "center",
    });
    drawText(ctx, "このタブを閉じてもよい。また明日、教室で。", W / 2, H / 2 + 12, {
      size: 8, font: "jp", color: "rgba(157,145,122,0.8)", align: "center",
    });
    if (this.t > 1.5) {
      drawText(ctx, "PRESS ANY KEY TO REBOOT", W / 2, H / 2 + 48, {
        size: 7, color: PALETTE.boneDim, align: "center",
      });
    }
    ctx.restore();
  }
}
