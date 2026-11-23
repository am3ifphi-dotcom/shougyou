// data.js — 世界観テキスト / チューニング / ウェーブ構成 / CREDITS 生成
// モチーフ: 小説『「偏差値60の教室から〝本質〟が漏れ出している件について」』
// (桐葉高校・南北棟・数理零・両馬二郎・三重・堀勝也・フェイカツ)

export const GAME_TITLE_JP = "本質漏出";
export const GAME_TITLE_EN = "HONSHITSU";
export const GAME_SUBTITLE = "— ESSENCE LEAK —";
export const VERSION = "v1.0.3";
export const COPYRIGHT = "© 2026 KIRIHA GAKUEN ARCAGE WORKS / non-commercial";

export const TIPS = [
  "HINT: ダッシュ中は無敵。弾の隙間を突っ切れ。",
  "HINT: 本質オーブを集めるとマルチプライヤーが上昇する。",
  "HINT: 被弾するとコンボが途切れる。無傷ウェーブでボーナス。",
  "HINT: 〝本質〟は標高に宿らない。偏差値は気にしなくていい。",
  "HINT: ボスの弾幕はゆっくり。焦らず外周を回れ。",
  "HINT: ボムは緊急回避。温存しすぎると教室が終わる。",
  "HINT: フェイカツの影は本物より脆い。まず片付けるのだ。",
  "HINT: [X] ダッシュ / [C] ボム / [ESC] ポーズ。",
  "HINT: コーススープは三ヶ月補充されていない。飲むな。",
  "HINT: 桐葉高校には国境がある。越えるな。",
];

export const INTRO_LINES = [
  { name: "？？？", text: "桐葉高校・北棟。偏差値六十の教室から、〝本質〟が漏れ出している。" },
  { name: "数理零", text: "観測事象を整理する。教室から漏出する未確認エネルギー。仮称——〝本質〟。" },
  { name: "三重", text: "零ちゃん、もう夜だよ。こんな時間に教室にいちゃ……。" },
  { name: "数理零", text: "放っておけば学年全体に漏れる。ここで封じる。それが私の解答だ。" },
  { name: "？？？", text: "偏差値は地形図の等高線と同じ。上ればいいというものではない。" },
  { name: "？？？", text: "〝本質〟は標高に宿らない。——さあ、解答しろ、首席。" },
];

export const TUTORIAL_PROMPTS = [
  { at: 0.5, icon: "up", label: "MOVE  WASD / ARROWS", life: 5 },
  { at: 4.5, icon: "z", label: "SHOOT  Z / J", life: 5 },
  { at: 9.5, icon: "x", label: "DASH  X / SPACE", life: 5 },
  { at: 14.5, icon: "c", label: "BOMB  C", life: 5 },
];

export const TUNING = {
  player: {
    hp: 100, speed: 128, dashSpeed: 340, dashTime: 0.16, dashCooldown: 0.75,
    invulnAfterHit: 1.1, shootInterval: 0.19, bulletSpeed: 320, bulletDamage: 2.2,
    levelFireBonus: 0.014, levelDamageBonus: 0.22,
    focusPerOrb: 8, bombBase: 2,
  },
  combo: { window: 4.2, perKill: 0.28, perOrb: 0.05, max: 8, decay: 0.55 },
  score: { kill: 100, orb: 25, wave: 500, noHit: 1000, boss: 5000 },
  world: { w: 1360, h: 760 },
  camera: { lookahead: 0.22, smooth: 6.5 },
};

export const ENEMY_TYPES = {
  wraith:   { name: "偏差の亡者", sprite: 121, hp: 5,  speed: 52,  damage: 12, score: 100, r: 10 },
  slime:    { name: "コーススープの妖", sprite: 108, hp: 8,  speed: 34,  damage: 14, score: 130, r: 11 },
  fake:     { name: "フェイカツの影", sprite: 86,  hp: 3,  speed: 92,  damage: 10, score: 160, r: 9 },
  bat:      { name: "電線の呪い", sprite: 120, hp: 2,  speed: 118, damage: 9,  score: 120, r: 8 },
  eye:      { name: "地図の目", sprite: 56,  hp: 6,  speed: 0,   damage: 11, score: 220, r: 10, shooter: true },
  demon:    { name: "赤鬼", sprite: 110, hp: 14, speed: 64,  damage: 18, score: 320, r: 13 },
  boss:     { name: "地図の魔王", sprite: 110, hp: 260, speed: 42, damage: 22, score: 5000, r: 26, boss: true },
};

/** ウェーブ構成: 5の倍数でボス */
export function wavePlan(wave) {
  const w = wave;
  const boss = w % 5 === 0;
  const final = w === 20;
  const budget = boss ? 4 + w : 6 + Math.floor(w * 2.1);
  const types = ["wraith"];
  if (w >= 2) types.push("bat");
  if (w >= 3) types.push("fake");
  if (w >= 4) types.push("slime");
  if (w >= 6) types.push("eye");
  if (w >= 9) types.push("demon");
  return {
    wave: w, budget, types,
    boss: boss ? { type: final ? "boss" : "boss", elite: w >= 15, final } : null,
    hpScale: 1 + w * 0.14,
    speedScale: 1 + Math.min(w * 0.02, 0.55),
    spawnInterval: Math.max(0.35, 1.6 - w * 0.05),
    name: boss ? (final ? "FINAL WAVE — 本質崩壊" : "WARNING — 強敵接近") : `WAVE ${w}`,
  };
}

/** CREDITS (manifest から生成) */
export function buildCredits(manifest) {
  const rows = [];
  rows.push({ kind: "header", text: "— STAFF ROLL —" });
  rows.push({ kind: "gap" });
  rows.push({ kind: "header", text: "ORIGINAL MOTIF" });
  rows.push({ kind: "text", text: "『「偏差値60の教室から" });
  rows.push({ kind: "text", text: "  〝本質〟が漏れ出している件について」』" });
  rows.push({ kind: "text", text: "  小説・キャラクター画 (personal library)" });
  rows.push({ kind: "text", text: "  used as theme & world motif only" });
  rows.push({ kind: "gap" });
  rows.push({ kind: "header", text: "GAME DESIGN / PROGRAM" });
  rows.push({ kind: "text", text: "KIRIHA GAKUEN ARCAGE WORKS" });
  rows.push({ kind: "gap" });
  rows.push({ kind: "header", text: "MATERIAL / ASSET CREDITS" });

  const seen = new Set();
  for (const a of manifest.assets) {
    const key = a.author + "|" + a.license;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ kind: "asset", title: a.id, author: a.author, license: a.license, source: a.source_page });
    if (a.notes) rows.push({ kind: "note", text: a.notes });
  }
  rows.push({ kind: "gap" });
  rows.push({ kind: "header", text: "SPECIAL THANKS" });
  rows.push({ kind: "text", text: "ALL WHO CHASE THE ESSENCE" });
  rows.push({ kind: "gap" });
  rows.push({ kind: "big", text: "本質は標高に宿らない" });
  rows.push({ kind: "gap" });
  rows.push({ kind: "text", text: "THANK YOU FOR PLAYING" });
  rows.push({ kind: "big", text: GAME_TITLE_EN });
  return rows;
}
