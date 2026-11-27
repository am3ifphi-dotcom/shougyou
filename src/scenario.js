// 「八分二十秒の、おかえり」 — scenario data.
// A linear, choice-driven cinematic novel with one hidden true ending.

export const GAME_TITLE = '八分二十秒の、おかえり';
export const GAME_SUBTITLE = 'THE LIGHT THAT ARRIVED LATE';

export const CHARACTERS = {
  rei: { name: '桐生 零', short: '零', color: '#cfe4ff', position: 'left', voice: 'rei' },
  akari: { name: '三峰 灯', short: '灯', color: '#ffe0b6', position: 'right', voice: 'akari' },
  naitou: { name: '内藤 汐', short: '汐', color: '#d9d3ff', position: 'left', voice: null },
  ryoma: { name: '龍馬 亮', short: '亮', color: '#ffc8b8', position: 'right', voice: null },
  katsuya: { name: '桐生 勝也', short: '父', color: '#d8c9a8', position: 'center', voice: 'katsuya' },
  futami: { name: '二見 千波', short: '二見', color: '#f2d3c2', position: 'left', voice: null },
  inaba: { name: '稲葉 準', short: '先生', color: '#e8d7ad', position: 'center', voice: 'inaba' },
  terachi: { name: '寺地 悠', short: '寺地', color: '#c8e0d5', position: 'right', voice: null },
  satou: { name: '佐藤 陽斗', short: '陽斗', color: '#c9d7f0', position: 'left', voice: null },
  shizuku: { name: '観測システム〈シズク〉', short: 'シズク', color: '#9ee8ff', position: 'right', voice: null },
};

export const MUSIC = {
  title: { title: '星屑のホイッスル', source: 'DURU-AI CC0 BGM / Shooting-Star Whistle' },
  daily: { title: 'とろける午後', source: 'DURU-AI CC0 BGM / Melty Afternoon' },
  archive: { title: '静かな部屋', source: 'DURU-AI CC0 BGM / Roomscene Lo-fi' },
  nocturne: { title: '温かいミルクの夜想曲', source: 'DURU-AI CC0 BGM / Warm Milk Nocturne' },
  truth: { title: '左側の地図', source: 'DURU-AI CC0 BGM / Brainmap Leftpanel' },
  climax: { title: '枕のワルツ', source: 'DURU-AI CC0 BGM / Pillow Waltz' },
  epilogue: { title: '反応する光', source: 'DURU-AI CC0 BGM / Duru Reacts' },
};

export const GALLERY = [
  { id: 'observatory_dusk', title: '夕暮れの旧観測所', caption: '使われなくなったドームと、八分二十秒前の太陽。' },
  { id: 'classroom_sunset', title: '誰もいなくなった教室', caption: '机の数だけ、かつて誰かが座っていた。' },
  { id: 'rooftop_night', title: '天の川の屋上', caption: '小さな望遠鏡と、届くはずのない信号。' },
  { id: 'library_night', title: '観測ノート', caption: '書かれていたのは、星ではなく、零のことだった。' },
  { id: 'hospital_dawn', title: '手術前の夜明け', caption: '雨の窓の向こうで、朝が準備をしていた。' },
  { id: 'starlight', title: '遅れて届く光', caption: '消えたものと、残るもののあいだ。' },
  { id: 'school_spring', title: '八年後の春', caption: '桜は、記録を読まなくても、また来る。' },
];

export const ENDINGS = [
  { id: 'silence', title: '沈黙', type: 'END', description: '観測をやめた零に残った、正確だが静かな教室。' },
  { id: 'observation', title: '観測', type: 'END', description: 'ノートは残った。返事は、まだ少し遅れている。' },
  { id: 'true', title: 'おかえり', type: 'TRUE END', description: '八分二十秒遅れて、朝はちゃんと来た。' },
];

const nodes = [];
let uid = 0;
let visible = {};
let stage = {
  bg: 'observatory_dusk',
  music: 'title',
  chars: visible,
  live2d: false,
  ambient: null,
};

const nextId = (prefix = 's') => `${prefix}${++uid}`;

const VOICE_EXPR = {
  akari_01: 'smile',
  akari_02: 'smile',
  akari_03: 'smile',
  akari_04: 'playful',
  akari_05: 'flushed',
  rei_02: 'serious',
  rei_03: 'smile',
  inaba_01: 'normal',
  katsuya_01: 'holdTears',
};
const CHARACTER_VOICE_EXPR = {
  akari: 'smile',
  rei: 'serious',
  futami: 'playful',
  katsuya: 'holdTears',
};

function setStage(patch) {
  if (Object.prototype.hasOwnProperty.call(patch, 'chars')) {
    visible = { ...patch.chars };
  }
  stage = { ...stage, ...patch, chars: visible };
}

function withExpr(character, expression, patch = {}) {
  return {
    chars: { ...visible, [character]: expression },
    ...patch,
  };
}

function applyVisibleChars(rest) {
  if (rest.withExprVoice && rest.expr) {
    const expression = VOICE_EXPR[rest.voice] || CHARACTER_VOICE_EXPR[rest.expr] || 'normal';
    rest.chars = { ...visible, [rest.expr]: expression, ...(rest.chars || {}) };
  }
  if (Object.prototype.hasOwnProperty.call(rest, 'chars')) {
    visible = { ...visible, ...rest.chars };
    stage.chars = visible;
  }
}

function line(speakerId, text, patch = {}) {
  const id = patch.id || nextId();
  const { id: _ignored, ...rest } = patch;
  applyVisibleChars(rest);
  nodes.push({ id, type: 'say', speakerId, text, ...stage, ...rest, chars: { ...visible } });
}

function narration(text, patch = {}) {
  line(null, text, patch);
}

function card(title, subtitle, patch = {}) {
  const id = patch.id || nextId('ch');
  const { id: _ignored, ...rest } = patch;
  visible = {};
  stage.chars = visible;
  nodes.push({ id, type: 'chapter', title, subtitle, ...stage, ...rest, chars: {} });
}

function cg(image, caption, patch = {}) {
  const id = patch.id || nextId('cg');
  const { id: _ignored, ...rest } = patch;
  visible = {};
  stage.chars = visible;
  nodes.push({ id, type: 'cg', image, caption, ...stage, ...rest, chars: {} });
}

function choice(prompt, options) {
  const id = nextId('choice');
  nodes.push({ id, type: 'choice', prompt, options, ...stage, chars: { ...visible } });
}

function branch(when, yes, no, patch = {}) {
  const id = patch.id || nextId('branch');
  const { id: _ignored, ...rest } = patch;
  nodes.push({ id, type: 'branch', when, yes, no, ...stage, ...rest, chars: { ...visible } });
}

function ending(endingId, patch = {}) {
  const id = `ending_${endingId}`;
  visible = patch.chars ? { ...patch.chars } : {};
  stage.chars = visible;
  nodes.push({ id, type: 'ending', endingId, goto: 'title', ...stage, ...patch, chars: { ...visible } });
}

// ────────────────────────────────────────────────────────────────
// 序章　光の遅刻
// ────────────────────────────────────────────────────────────────

setStage({ bg: 'observatory_dusk', music: 'title', chars: {}, live2d: false, ambient: 'dusk' });
card('序章', '光の遅刻', { hold: 2600, fx: ['fadeBlack'], se: 'sting' });

narration('太陽の光が、地球に届くまでには八分二十秒かかる。');
narration('つまり、いま見ている朝日は、少し前の太陽だ。', { fx: ['sunrise'] });
narration('言葉だって、同じかもしれない。', { voice: null });
narration('誰かが置いていった想いが、ずっと遅れて、ある日突然、胸に当たる。');

setStage({ bg: 'classroom_sunset', music: 'daily', ambient: 'dust' });
narration('桐葉高校・北棟。八年ぶりに立つ教室には、放課後の光が溜まっていた。', { se: 'latch' });
narration('机の角、黒板の消し残し、窓の高さ。測れるものは、すべて昔のままだ。');
line('rei', '……変わらないものも、あるんだな。', withExpr('rei', 'normal', { se: 'paper' }));
setStage({ chars: { rei: 'normal', futami: 'normal' } });
line('futami', '零先生。八年、長かったわね。', { se: 'click' });
line('rei', '二見先生。書類はもう提出しました。', withExpr('rei', 'serious'));
line('futami', '書類じゃなくて、あなたの顔を見に来たの。', withExpr('futami', 'gentle'));
line('futami', '旧観測所は、春に解体される予定よ。理事長が決めたの。', withExpr('futami', 'worried', { se: 'page' }));
line('rei', '古いアンテナなら、記録だけ残せばいい。', withExpr('rei', 'normal'));
line('futami', '三峰さんは、違うって言ってたわ。「記録より、待ってた人がいたっていう証拠が残る」って。', withExpr('futami', 'playful'));
line('rei', '……三峰？', withExpr('rei', 'surprise'));
line('futami', '屋上よ。今日も、あの子は太陽より先に来てる。', withExpr('futami', 'normal', { se: 'hover' }));

choice('零は、窓の外のドームを見上げた。', [
  {
    label: '屋上へ向かう',
    feedback: '観測 +1　／　足が、昔の階段を覚えていた。',
    set: { light: 1 },
    goto: 'rooftop_intro',
    se: 'confirm',
  },
  {
    label: '職員室に戻る',
    feedback: '観測 +0　／　だが、耳の奥で時計が鳴っていた。',
    set: { light: 0 },
    goto: 'rooftop_intro',
    se: 'cancel',
  },
]);

setStage({ bg: 'rooftop_night', music: 'archive', ambient: 'stars', chars: {} });
line(null, '——気づけば、夜だった。', { id: 'rooftop_intro', fx: ['dissolve'], se: 'whoosh' });
narration('屋上の手すりは冷たく、天の川は、教師だった頃より少しだけ近かった。', { se: 'starlight' });
setStage({ chars: { akari: 'normal' } });
line('akari', '……来た。やっぱり、来てくれたんだ。', { voice: null, se: 'shimmer' });
line('rei', '君が、三峰さん？　こんな時間に、何をしてる。', withExpr('rei', 'normal'));
line('akari', '待ってたの。八分二十秒前の太陽を。', withExpr('akari', 'smile'));
line('rei', '太陽の光は、今も届いてる。遅れているだけで。', withExpr('rei', 'serious'));
line('akari', 'でしょ。だから、わたしも訊きたかったんだ。', withExpr('akari', 'normal'));
line('akari', '先生、わたしの声は、光より先に届きますか。', {
  withExprVoice: true,
  expr: 'akari',
  voice: 'akari_01',
  fx: ['focus'],
});
line('akari', '八分二十秒、遅れたっていいんです。ちゃんと届くなら。', { voice: null, se: 'tick' });
narration('彼女の横には、修理途中の古い無線機と、使い込まれたノートがあった。');
line('akari', 'あさって、手術なの。ちょっとだけ、遠くの病院へ行く。', withExpr('akari', 'flushed', { se: 'page' }));
line('rei', '……それを、今、初めて会った先生に？', withExpr('rei', 'surprise'));
line('akari', '初めてじゃないよ。零先生は、八年前から、この屋上にいたもん。', withExpr('akari', 'smile', { fx: ['glitch'], se: 'blip' }));
narration('知らないはずの名前を、彼女は当然のように知っていた。');
line('akari', '稲葉先生の〈最終講義〉、いっしょに流しませんか。', withExpr('akari', 'normal', { se: 'power' }));
line('akari', '壊れたアンテナを直して、八年前に届かなかった返事を、今から届けるの。', { voice: null });
line('rei', '……稲葉先生の、名前をどこで。', withExpr('rei', 'waver', { fx: ['heartbeat'], se: 'rumble' }));
line('akari', 'ノートに、ぜんぶ書いてあるよ。零先生のことも。', withExpr('akari', 'smile'));

// ────────────────────────────────────────────────────────────────
// 第一章　観測されない日々
// ────────────────────────────────────────────────────────────────

setStage({ bg: 'classroom_sunset', music: 'daily', ambient: 'dust', live2d: false });
card('第一章', '観測されない日々', { hold: 2400, fx: ['fadeBlack'], se: 'impact' });

narration('翌日。天文部の部員は、二名だった。', { se: 'book' });
setStage({ chars: { akari: 'normal', naitou: 'normal' } });
line('naitou', '三峰の代わりに説明します。アンテナの仰角が、三度ずれています。', { se: 'paper' });
line('rei', '三度？　よく測ったな。', withExpr('rei', 'normal'));
line('naitou', '測ったのは三峰です。わたしは、横で日付を書いていただけ。', withExpr('naitou', 'softSmile'));
line('akari', '汐は、わたしがここにいたっていう証人だから。', withExpr('akari', 'tsukkomi'));
line('rei', '証人……。', withExpr('rei', 'surprise'));
line('akari', 'ねえ、直して。屋根の上の部品、先生なら三分で直せるでしょ。', withExpr('akari', 'smile', { se: 'latch' }));
narration('零の指は、工具の感触を覚えていた。八年前、稲葉先生に教わったままの動きで。');

choice('壊れた装置に、手を伸ばすか。', [
  {
    label: 'アンテナを直す',
    feedback: '観測 +1　真実 +1　／　錆びたネジが、静かに回った。',
    set: { light: 1, truth: 1 },
    goto: 'repair_done',
    se: 'confirm',
  },
  {
    label: '規定どおり断る',
    feedback: '観測 +0　／　それでも、汐は日付を書き続けた。',
    set: { light: 0 },
    goto: 'repair_done',
    se: 'cancel',
  },
]);

line(null, '——結局、放課後の光が傾くころ、針はわずかに動いた。', { id: 'repair_done', fx: ['shimmer'], se: 'ding' });
setStage({ chars: { akari: 'smile', naitou: 'softSmile', ryoma: 'grin' } });
line('ryoma', 'おお、動いた動いた。零、相変わらず器用だな。', { se: 'whoosh' });
line('rei', '龍馬か。数学の先生が、なんで屋上に。', withExpr('rei', 'normal'));
line('ryoma', '天文部の顧問がいないから、代わりに来たんだよ。名目上な。', withExpr('ryoma', 'normal'));
line('ryoma', '稲葉先生がよく言ってたろ。「観測は、相手を諦めないことだ」って。', withExpr('ryoma', 'serious', { fx: ['focus'], se: 'tick' }));
line('rei', '……覚えてる。', withExpr('rei', 'waver'));
line('ryoma', '覚えてるなら、ノートも開け。あれ、先生がお前に残したんだから。', withExpr('ryoma', 'resolve'));
narration('棚の奥から出てきたのは、表紙に✝本質✝と書かれた一冊と、古いカセットテープ。');
line('naitou', '「最終講義／桐生零へ」。……宛名、はっきり書いてあります。', withExpr('naitou', 'surprise', { se: 'page' }));
line('rei', '……今日は、ここまでだ。', withExpr('rei', 'stiff', { fx: ['shake'], se: 'book' }));
setStage({ chars: { rei: 'waver' } });
narration('零はテープをポケットに入れ、再生しないまま、教室を出た。');
line('akari', '……急がなくていいよ。光だって、遅れるんだから。', withExpr('akari', 'normal', { se: 'shimmer' }));

// ────────────────────────────────────────────────────────────────
// 第二章　観測ノート
// ────────────────────────────────────────────────────────────────

setStage({ bg: 'library_night', music: 'archive', ambient: 'library', live2d: true });
card('第二章', '観測ノート', { hold: 2400, fx: ['fadeBlack'], se: 'impact' });

narration('夜の資料室。旧観測システム〈シズク〉が、薄い光の中で瞬きを繰り返していた。', { se: 'blip' });
line('shizuku', '観測ログ、八年前から未読です。開きますか。', { chars: { shizuku: 'normal' }, se: 'power' });
line('rei', '……今は、まだ。', withExpr('rei', 'waver'));
line('futami', '零先生。これ、預かってたの。稲葉先生から。', { chars: { futami: 'normal' }, se: 'page' });
line('rei', '二見先生まで……。', withExpr('rei', 'surprise'));
line('futami', '「零が自分で開ける日まで、黙って置いといて」って頼まれたの。八年、黙ってたわ。', withExpr('futami', 'gentle'));
narration('表紙を開くと、そこに星の観測値は一行もなかった。');
narration('「四月十二日。零くんは、窓を一度も見なかった。」');
narration('「五月三日。正解を書いたのに、誰にも見せなかった。丸を付けておいた。」');
narration('「六月二十一日。屋上へ来なかった。来ない日も、観測は続けることにした。」', { fx: ['focus'], se: 'tick' });
line('rei', '……なんだ、これ。', withExpr('rei', 'waver', { fx: ['heartbeat'] }));
line('futami', '零くんの観測記録よ。星じゃなくて、あなたの。', withExpr('futami', 'gentle'));
line('rei', '俺は、誰にも見られてないと思ってた。', withExpr('rei', 'serious', { voice: 'rei_01' }));
line('rei', '観測されないものは、ないのと同じだと、ずっと信じていた。でも違った。', { voice: null, fx: ['glitch'] });
narration('最後の数十ページは、筆跡が変わっていた。内藤汐の、丁寧な字だった。');
setStage({ chars: { naitou: 'gentle', akari: 'flushed' } });
line('naitou', '「九月七日。三峰は屋上で、零先生を待っていた。」', { se: 'paper' });
line('naitou', '「十月二日。三峰は、手術の説明書を折り目で四つにした。笑ってた。」', { se: 'paper' });
line('akari', '汐……！　見ちゃった……？', withExpr('akari', 'flushed', { fx: ['shake'] }));
line('naitou', '見てた。ずっと。だから、三峰は一人じゃないって書いたの。', withExpr('naitou', 'gentle', { se: 'chime' }));
line('akari', '見てもらえると、ここにいたって思えた。だから、わたしも、誰かを観測したかったんです。', {
  withExprVoice: true,
  expr: 'akari',
  voice: 'akari_02',
  fx: ['focus'],
});
cg('library_night', '観測ノートには、星ではなく、人の日付が書かれていた。', { unlock: ['library_night', 'notebook'], se: 'page' });

choice('零は、ノートの最後のページまで、目を通すか。', [
  {
    label: '最後まで読む',
    feedback: '真実 +1　／　空白のページに、小さく「つづく」とあった。',
    set: { truth: 1 },
    goto: 'notebook_done',
    se: 'confirm',
  },
  {
    label: '閉じて返す',
    feedback: '真実 +0　／　閉じても、書かれた日付は消えなかった。',
    set: { truth: 0 },
    goto: 'notebook_done',
    se: 'cancel',
  },
]);

line(null, '——ページを閉じた指先が、わずかに震えていた。', { id: 'notebook_done', fx: ['dissolve'], se: 'book' });
line('shizuku', '未読ログ、まだ一項目あります。再生しますか。', { chars: { shizuku: 'normal' }, se: 'blip' });
line('rei', '……今は、まだ。', withExpr('rei', 'waver'));
narration('ポケットの中で、カセットテープの角が、鼓動より少しだけ遅れて鳴った。', { se: 'tick' });

// ────────────────────────────────────────────────────────────────
// 第三章　父の時計
// ────────────────────────────────────────────────────────────────

setStage({ bg: 'hospital_dawn', music: 'nocturne', ambient: 'rain', live2d: false });
card('第三章', '父の時計', { hold: 2400, fx: ['fadeBlack'], se: 'impact' });

narration('手術前日。雨の病院の廊下で、零は理事長と鉢合わせた。', { se: 'rumble' });
setStage({ chars: { katsuya: 'normal', rei: 'normal' } });
line('katsuya', '解体の書類、明日で最終だ。異議があるなら、今日中に。', { se: 'paper' });
line('rei', '父さんは、いつも期限で話す。', withExpr('rei', 'stiff'));
line('katsuya', '期限なら、守れるからな。', withExpr('katsuya', 'distant'));
line('rei', '稲葉先生の荷物まで、処分するつもりだったのか。', withExpr('rei', 'waver', { fx: ['heartbeat'] }));
line('katsuya', '処分してなどいない。', withExpr('katsuya', 'memory', { se: 'latch' }));
line('katsuya', 'テープも、ノートも、八年、この手元に置いていた。', { se: 'page' });
line('rei', '……なんで、渡さなかった。', withExpr('rei', 'surprise'));
line('katsuya', 'お前が、まだ受け取れない顔をしていたからだ。', withExpr('katsuya', 'stiff'));

choice('八年前の話を、口にするか。', [
  {
    label: '父に本音をぶつける',
    feedback: '観測 +1　真実 +1　／　雨の音より、低い声が出た。',
    set: { light: 1, truth: 1 },
    goto: 'father_confess',
    se: 'confirm',
  },
  {
    label: '黙って頷く',
    feedback: '観測 +0　／　時計だけが、八年前と同じ速さで進んだ。',
    set: { light: 0 },
    goto: 'father_confess',
    se: 'cancel',
  },
]);

line('rei', 'あの日、屋上へ行かなかったのは、俺だ。先生を待たせたのは、俺だ。', {
  id: 'father_confess',
  withExprVoice: true,
  expr: 'rei',
  voice: null,
  fx: ['shake'],
});
line('katsuya', 'お前が屋上へ行かなかったのは、お前のせいじゃない。', {
  withExprVoice: true,
  expr: 'katsuya',
  voice: 'katsuya_01',
  fx: ['focus'],
});
line('katsuya', 'あの日、先生は、未来の君に向けて録音していたんだ。', { voice: null, se: 'tick' });
narration('八年前の夕方。稲葉先生は、誰も来ないドームで、マイクの前についたまま笑っていた。', { fx: ['sepia'] });
setStage({ chars: { inaba: 'normal' } });
line('inaba', '零くん、観測はね、相手を諦めないことだよ。', { voice: 'inaba_01', fx: ['dissolve'], se: 'power' });
line('inaba', '光が届くのに八分二十秒かかっても、太陽は毎朝ちゃんと来る。', { voice: null });
line('inaba', '君も、遅れていい。いつか誰かが、見つけてくれるから。', { voice: null, se: 'shimmer' });
setStage({ chars: { rei: 'waver', katsuya: 'holdTears' } });
line('rei', '……先生、遅くなりました。', { fx: ['whiteout'], se: 'ding' });
line('katsuya', 'いい。八分二十秒くらい、何でもない。', withExpr('katsuya', 'bright', { se: 'chime' }));
narration('父の時計が、零の時計と、ほんの少しだけ針を揃えた。', { fx: ['sunrise'] });
cg('hospital_dawn', '雨の窓の向こうで、朝が準備をしていた。', { unlock: ['hospital_dawn'], se: 'page' });

// ────────────────────────────────────────────────────────────────
// 第四章　最終講義
// ────────────────────────────────────────────────────────────────

setStage({ bg: 'rooftop_night', music: 'truth', ambient: 'stars', live2d: true });
card('第四章', '最終講義', { hold: 2600, fx: ['fadeBlack'], se: 'impact' });

narration('文化祭前夜。直したアンテナが、星の方向を正確に指していた。', { se: 'power' });
setStage({ chars: { akari: 'normal', naitou: 'normal', terachi: 'normal', satou: 'normal' } });
line('terachi', '放送部、回線確保しました。……緊張で、手が震えてます。', { se: 'blip' });
line('satou', '全校のスピーカー、全部つながってる。逃げられないっすよ、先生。', { se: 'glitch' });
line('ryoma', '零、マイクはお前が持て。稲葉先生の代わりは、お前しかいない。', { chars: { ryoma: 'resolve' }, se: 'whoosh' });
line('shizuku', '最終講義、送信準備完了。八年前の未読ログを、現在時刻へ連結します。', { chars: { shizuku: 'normal' }, fx: ['glitch'], se: 'power' });
line('akari', '先生。データじゃなくて、声でいいですか。', withExpr('akari', 'flushed', { se: 'message' }));
line('rei', '……ああ。声でいい。', withExpr('rei', 'serious', { fx: ['focus'] }));

choice('マイクの前で、零は何を残すか。', [
  {
    label: '想いを、そのまま放送する',
    feedback: '観測 +2　真実 +1　／　赤いランプが、静かに点いた。',
    set: { light: 2, truth: 1 },
    goto: 'broadcast_start',
    se: 'confirm',
  },
  {
    label: '観測データだけを残す',
    feedback: '観測 +0　／　正確な数字が、夜に吸い込まれていった。',
    set: { light: 0 },
    goto: 'broadcast_start',
    se: 'cancel',
  },
]);

line(null, '——赤いランプが点く。八年前のテープと、今の声が、同じ回線に乗った。', {
  id: 'broadcast_start',
  fx: ['riser'],
  se: ['riser', 'blip'],
});
setStage({ music: 'climax', bg: 'starlight', ambient: 'starlight' });
narration('「今日の講義は、光の遅れについてです。」');
narration('零の声が、職員室、図書室、病院の待合室、そして屋上へ、同時に届いた。', { fx: ['dissolve'], se: 'message' });
setStage({ chars: { futami: 'gentle', katsuya: 'bright', ryoma: 'tearSmile' } });
line('futami', '……零先生、やっと、あの人の声になったわね。', { se: 'chime' });
line('katsuya', '遅かったが、ちゃんと届いてる。', { se: 'tick' });
line('ryoma', 'ばか……八年、待たせやがって。', withExpr('ryoma', 'cry', { fx: ['shake'] }));
setStage({ chars: { rei: 'serious', akari: 'smile' } });
line('rei', '観測は、相手を諦めないことだと、教わった。', { voice: null, fx: ['focus'] });
line('rei', '見ていたよ。君がここにいたことを、ちゃんと観測した。だから、消えない。', {
  withExprVoice: true,
  expr: 'rei',
  voice: 'rei_02',
  fx: ['whiteout'],
  se: 'sting',
});
line('akari', '……うん。', withExpr('akari', 'flushed', { voice: 'akari_05', se: 'shimmer' }));
line('akari', 'わたし、ここにいたよ。ありがとう。', { withExprVoice: true, expr: 'akari', voice: null, fx: ['sunrise'] });
cg('starlight', '消えたものと、残るもののあいだに、声が一本、通っていた。', { unlock: ['starlight', 'final_lecture'], se: 'starlight' });

setStage({ bg: 'observatory_dusk', music: 'nocturne', ambient: 'dusk', live2d: false });
narration('夜が明ける。灯は、手術のために、駅へ向かう。', { se: 'whoosh' });
setStage({ chars: { rei: 'normal', akari: 'normal' } });
line('akari', '先生、戻ってきたら、最後のページに書いてね。おかえり、って。', {
  withExprVoice: true,
  expr: 'akari',
  voice: 'akari_03',
  fx: ['focus'],
});
line('rei', '……書く。何年、遅れても書く。', withExpr('rei', 'smile', { voice: null }));
line('akari', '約束、観測しておきますね。', withExpr('akari', 'smile', { se: 'chime' }));
narration('彼女の歩幅は、八年前の零より、少しだけ速かった。', { fx: ['dissolve'] });

choice('旧観測システムに残る、八年前のログ。', [
  {
    label: 'アーカイヴを残す',
    feedback: '観測 +1　／　削除キーの上で、指が止まった。',
    set: { light: 1 },
    goto: 'final_branch',
    se: 'confirm',
  },
  {
    label: 'すべて消去する',
    feedback: '観測 -2　／　光は、記録を失っても、まだ届いていた。',
    set: { light: -2 },
    goto: 'ending_silence',
    se: 'cancel',
  },
]);

branch({ light: 4, truth: 3 }, 'true_path', 'observation_path', { id: 'final_branch', bg: 'school_spring', music: 'epilogue', ambient: 'petals' });

// ────────────────────────────────────────────────────────────────
// エンディング
// ────────────────────────────────────────────────────────────────

ending('silence', {
  bg: 'classroom_sunset',
  music: 'archive',
  ambient: 'dust',
  chars: { rei: 'normal' },
  fx: ['fadeBlack'],
  se: 'book',
});

narration('観測所は解体され、ノートもテープも、箱に入った。', { id: 'observation_path', bg: 'classroom_sunset', music: 'nocturne', ambient: 'dust', chars: { rei: 'normal' }, fx: ['fadeBlack'] });
narration('八年後。零は、最後の白紙のページに、約束の二字を書いた。', { se: 'page' });
narration('『おかえり』。');
narration('返事は来なかった。けれど、窓の朝日は、確かに八分二十秒前の太陽だった。', { fx: ['sunrise'], se: 'shimmer' });
narration('遠い街から届いた葉書には、こうだけあった。「わたしの声、届きましたか。」');
ending('observation', { bg: 'observatory_dusk', music: 'epilogue', ambient: 'dusk', chars: {}, fx: ['whiteout'], se: 'sting' });

narration('——八年後の春。', { id: 'true_path', bg: 'school_spring', music: 'epilogue', ambient: 'petals', chars: {}, fx: ['fadeBlack'], se: 'sting' });
narration('新しい観測所の扉が開いた。桜の花びらが、計算できない速さで落ちてくる。', { se: 'whoosh' });
setStage({ chars: { rei: 'normal', akari: 'normal' } });
line('akari', '零先生、おかえりなさい。八分二十秒、遅れちゃったけど、ちゃんと、来たよ。', {
  withExprVoice: true,
  expr: 'akari',
  voice: 'akari_04',
  fx: ['focus'],
});
line('rei', '……灯？', withExpr('rei', 'surprise', { voice: null, fx: ['glitch'] }));
setStage({ chars: { rei: 'smile', akari: 'smile' } });
line('akari', '三峰灯、二十六歳。物理教諭になりました。見てくれた人がいたから、ここに戻れたの。', { se: 'chime' });
line('rei', 'ただいま、灯。八分二十秒遅れて、朝はちゃんと来た。', {
  withExprVoice: true,
  expr: 'rei',
  voice: 'rei_03',
  fx: ['sunrise'],
  se: 'sting',
});
line('akari', 'じゃあ、次の観測を始めよう。今度は、わたしたちが誰かを見つける番。', withExpr('akari', 'smile'));
cg('school_spring', '桜は、記録を読まなくても、また来る。', { unlock: ['school_spring', 'true_end'], se: 'starlight' });
ending('true', { bg: 'school_spring', music: 'epilogue', ambient: 'petals', chars: {}, fx: ['whiteout'], se: 'sting' });

// Resolve default linear progression.  `goto` always wins.
for (let i = 0; i < nodes.length - 1; i += 1) {
  if (!nodes[i].next && nodes[i].type !== 'choice' && nodes[i].type !== 'branch') {
    nodes[i].next = nodes[i + 1].id;
  }
}

export const SCENES = nodes;
export const SCENE_MAP = new Map(nodes.map((node) => [node.id, node]));
export const START_SCENE = nodes[0].id;
