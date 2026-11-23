// ---------------------------------------------------------------------------
//  content.js — the cast, the bestiary and the run tuning.
//
//  The novel gives us the vocabulary; the arcade gives it teeth.
//    * 本質 (honshitsu) — "essence": the thing that was always there. Here it
//      leaks out of a classroom and takes the shape of whatever it was
//      attached to. Killing one drops 本質.
//    * 偏差値60 — the corridor that keeps rearranging itself so the ranking
//      never settles.
//    * コーンスープの不在 — the vending machine nobody refills. Picking soup up
//      is the only reliable heal in the game.
// ---------------------------------------------------------------------------

export const BESTIARY = {
  // --- trash: cheap, fast, they teach you to keep moving
  wisp: {
    id: 'wisp', name: 'ウロボロス片', sprite: 'mon_insubstantial_wisp',
    hp: 10, speed: 78, r: 16, damage: 6, score: 40, essence: 1,
    behaviour: 'drift', tint: 0x9fd6ff, bob: 6,
  },
  husk: {
    id: 'husk', name: '偏差値の抜け殻', sprite: 'mon_simulacrum',
    hp: 18, speed: 62, r: 18, damage: 9, score: 60, essence: 1,
    behaviour: 'chase', tint: 0xd8c9a8,
  },
  crawler: {
    id: 'crawler', name: '廊下這い', sprite: 'mon_wight',
    hp: 22, speed: 96, r: 16, damage: 8, score: 70, essence: 1,
    behaviour: 'chase', tint: 0xa8d08a, wobble: 8,
  },
  // --- mid: they force you to use the dash
  wraith: {
    id: 'wraith', name: '本質の亡霊', sprite: 'mon_wraith', strip: true,
    hp: 34, speed: 88, r: 20, damage: 11, score: 120, essence: 2,
    behaviour: 'phantom', tint: 0xbfd6ec, dash: true, alpha: 0.9,
  },
  rotting: {
    id: 'rotting', name: '腐った設問', sprite: 'mon_rotting_hulk',
    hp: 58, speed: 46, r: 22, damage: 14, score: 150, essence: 2,
    behaviour: 'chase', tint: 0xb7a06a, tank: true,
  },
  eye: {
    id: 'eye', name: '監視の眼', sprite: 'mon_giant_eyeball',
    hp: 26, speed: 34, r: 18, damage: 9, score: 170, essence: 2,
    behaviour: 'turret', tint: 0xe0e8ff, shoot: { cd: 1.9, speed: 190, damage: 8, spread: 0 },
  },
  skull: {
    id: 'skull', name: '呪詛の頭蓋', sprite: 'mon_curse_skull',
    hp: 30, speed: 70, r: 17, damage: 10, score: 160, essence: 2,
    behaviour: 'orbit', tint: 0xe8c8ff, shoot: { cd: 2.6, speed: 150, damage: 7, spread: 3 },
  },
  // --- elite: real threats, worth real score
  lich: {
    id: 'lich', name: '冷たい教祖', sprite: 'mon_lich', strip: true,
    hp: 110, speed: 40, r: 22, damage: 16, score: 420, essence: 5,
    behaviour: 'summoner', tint: 0xb9c8ff, shoot: { cd: 2.2, speed: 170, damage: 10, spread: 5 },
  },
  reaper: {
    id: 'reaper', name: '回収者', sprite: 'mon_reaper', strip: true,
    hp: 130, speed: 104, r: 21, damage: 20, score: 480, essence: 5,
    behaviour: 'hunt', tint: 0xd8d0c0, dash: true,
  },
  knight: {
    id: 'knight', name: '偏差値の騎士', sprite: 'mon_hell_knight',
    hp: 150, speed: 66, r: 22, damage: 18, score: 500, essence: 6,
    behaviour: 'charger', tint: 0xffb0a0, charge: { cd: 3.2, speed: 420, windup: 0.55 },
  },
  dragon: {
    id: 'dragon', name: '竜の残響', sprite: 'mon_shadow_dragon',
    hp: 190, speed: 52, r: 26, damage: 22, score: 700, essence: 8,
    behaviour: 'turret', tint: 0xc0a8ff, shoot: { cd: 1.25, speed: 210, damage: 12, spread: 5 },
  },
};

export const BOSSES = [
  {
    id: 'headmaster', name: 'ILSŪW, 本質の主', title: 'THE ESSENCE THAT LEAKED',
    sprite: 'boss_headmaster', hp: 1250, speed: 46, r: 42, damage: 24, score: 3000, essence: 40,
    behaviour: 'boss', tint: 0xffd9a0, phases: 2,
    shoot: { cd: 1.5, speed: 200, damage: 13, spread: 7 },
  },
  {
    id: 'azrael', name: 'AZRAEL, 炎の教諭', title: 'THE ONE WHO KEPT SCORE',
    sprite: 'boss_dean', hp: 1700, speed: 54, r: 44, damage: 26, score: 4500, essence: 55,
    behaviour: 'boss', tint: 0xffb070, phases: 3,
    shoot: { cd: 1.2, speed: 230, damage: 15, spread: 9 },
  },
  {
    id: 'pitfiend', name: 'PIT FIEND, 教室の底', title: 'THE CLASSROOM UNDERNEATH',
    sprite: 'boss_demon', hp: 2300, speed: 60, r: 46, damage: 30, score: 6500, essence: 70,
    behaviour: 'boss', tint: 0xff8866, phases: 3,
    shoot: { cd: 0.95, speed: 250, damage: 17, spread: 11 },
  },
];

export const WAVES = {
  // Every wave is a budget of "threat" that the director spends on unlocked
  // archetypes. Difficulty ramps through both the budget and the pool.
  tiers: [
    { threats: 8, pool: ['wisp', 'husk'], cadence: 2.6 },
    { threats: 12, pool: ['wisp', 'husk', 'crawler'], cadence: 2.3 },
    { threats: 16, pool: ['husk', 'crawler', 'wraith'], cadence: 2.1 },
    { threats: 20, pool: ['crawler', 'wraith', 'eye', 'rotting'], cadence: 1.95 },
    { threats: 24, pool: ['wraith', 'eye', 'skull', 'rotting'], cadence: 1.8 },
    { threats: 28, pool: ['wraith', 'skull', 'lich', 'rotting'], cadence: 1.7 },
    { threats: 34, pool: ['skull', 'lich', 'reaper', 'knight'], cadence: 1.6 },
    { threats: 40, pool: ['lich', 'reaper', 'knight', 'dragon'], cadence: 1.5 },
    { threats: 48, pool: ['lich', 'reaper', 'knight', 'dragon', 'eye'], cadence: 1.4 },
    { threats: 58, pool: ['reaper', 'knight', 'dragon', 'lich'], cadence: 1.3 },
  ],
  threatOf: { wisp: 1, husk: 1.4, crawler: 1.6, wraith: 2.4, eye: 2.2, skull: 2.6, rotting: 2.8, lich: 4.2, reaper: 4.6, knight: 5, dragon: 6 },
};

export const RUN = {
  roomW: 1600,         // world units per room — larger than the viewport so the
  roomH: 900,          // camera can lead the player without hitting an edge
  player: {
    hp: 100, mp: 100, speed: 260, radius: 15,
    dashSpeed: 720, dashTime: 0.16, dashCd: 0.62, dashCost: 0,
    shotCost: 9, shotCd: 0.19, shotSpeed: 620, shotDamage: 9, mpRegen: 17,
    iframes: 1.05, critChance: 0.14, critMult: 2.1,
  },
  comboWindow: 3.2,
  comboStep: 0.06,     // score multiplier growth per kill
  comboMax: 4.0,
  floorTime: 26,       // seconds to clear a floor before the corridor collapses
  essenceToLevel: [0, 6, 16, 30, 48, 72, 102, 140, 190, 250],
  soupHeal: 34,
};

// ------------------------------------------------------------------ dialogue
// Faithful to the novel's key beats: the three layers of 両馬's posting, the
// missing corn soup, and 倉石 the "believer" who out-本質s the 教主.
export const DIALOGUE = {
  intro: [
    { name: '両馬 二郎', portrait: 'art_ryoma_01_tsuujou',
      text: 'この学校には国境がある。見えないが、ある。北棟と南棟のあいだに。' },
    { name: '両馬 二郎', portrait: 'art_ryoma_01_tsuujou',
      text: '理数科の教室に、本質がある。俺が始めたわけじゃない。本質は元からあった。俺はそれに名前をつけただけだ。' },
    { name: '倉石', portrait: 'art_kuraishi_03_chousa_shinken',
      text: 'その否定が、まさに本質です。' },
    { name: '両馬 二郎', portrait: 'art_ryoma_07_shinken_ketsui',
      text: '……教室ごと、片付ける。コーンスープの自販機も、ついでに動かせるようにする。' },
  ],
  floorClear: [
    '廊下が組み替わる。偏差値はまだ決まらない。',
    '本質が一つ、この教室から抜けた。',
    'また、壁の色だけが変わった。',
    '記録係はまだ名前を書いている。',
  ],
  bossEncounter: '本質の主が、教室の隅から滲み出した。',
  gameOver: [
    '名前をつけたのは、俺の方だった。',
    '本質は元からあった。倒したのは、俺の側だった。',
    '偏差値は、まだ決まらない。',
  ],
  tutorial: {
    move: '移動',
    dash: '回避（無敵はごく短い）',
    shot: '本質を撃つ',
    skill: '爆ぜる本質（MP40）',
    pause: 'ポーズ',
  },
};

// ------------------------------------------------------------------ difficulty
// Three dials on the same run: how hard the corridor pushes, how much the
// player can absorb, and how generously it pays out.
export const DIFFICULTY = {
  low: {
    key: 'low', name: '見習い', en: 'APPRENTICE', tint: 0x9fd6a0, tag: '偏差値45',
    desc: '教室はまだ、こちらの話を聞く。被弾に寛容で、本質もゆっくり滲む。',
    enemy: 0.8, player: 1.3, score: 0.8,
  },
  mid: {
    key: 'mid', name: '常連', en: 'REGULAR', tint: 0xe8d3a8, tag: '偏差値60',
    desc: '規定どおり。ここが本来の教室。廊下は毎分、組み替えられる。',
    enemy: 1.0, player: 1.0, score: 1.0,
  },
  high: {
    key: 'high', name: '本質', en: 'ESSENCE', tint: 0xff9a7a, tag: '偏差値75',
    desc: '本質が先にこちらを見る。敵は速く、硬く、そしてよく払う。',
    enemy: 1.35, player: 0.78, score: 1.6,
  },
};
