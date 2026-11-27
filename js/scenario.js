/* ============================================================
   桜色の約束 ― シナリオ台本
   登場人物 / 背景 / CG / 本編スクリプト
   ============================================================ */

const CHARACTERS = {
  yuma:   { name: '悠真', color: '#9fc7ff', voice: 300 },
  yukino: { name: '雪乃', color: '#ffb7d5', voice: 520, img: 'assets/img/ch_yukino.png' },
  misaki: { name: '美咲', color: '#ffd28a', voice: 640, img: 'assets/img/ch_misaki.png' },
  mio:    { name: '澪',   color: '#c9b8ff', voice: 580, img: 'assets/img/ch_mio.png' }
};

const BGS = {
  station:   'assets/img/bg_station.jpg',
  classroom: 'assets/img/bg_classroom.jpg',
  rooftop:   'assets/img/bg_rooftop.jpg',
  sakura:    'assets/img/bg_sakura.jpg',
  shrine:    'assets/img/bg_shrine.jpg',
  rain:      'assets/img/bg_rain.jpg',
  house:     'assets/img/bg_house.jpg',
  sea:       'assets/img/bg_sea.jpg'
};

const CGS = {
  sakura:  { img: 'assets/img/cg_sakura.jpg',  cap: '――桜舞う季節に、君は笑った' },
  rooftop: { img: 'assets/img/cg_rooftop.jpg', cap: '――夕日に誓った、十年越しの約束' },
  rain:    { img: 'assets/img/cg_rain.jpg',    cap: '――雨に濡れた手紙と、止まらない涙' }
};

/* スクリプト命令
   t:'bg'      背景変更 {id}
   t:'bgm'     BGM変更 {id: title|calm|sad|tense|hopeful|none}
   t:'se'      SE再生 {id}
   t:'fx'      画面演出 {id: none|petals|rain|heartbeat|flash|shake}
   t:'show'    キャラ表示 {who, pos:left|center|right}
   t:'hide'    キャラ非表示 {who} / t:'hideAll'
   t:'say'     セリフ {who, text}
   t:'narr'    地の文 {text}
   t:'mono'    心の声 {text}
   t:'cg'      イベントCG {id}
   t:'chapter' 章タイトル {title, sub}
   t:'choice'  選択肢 {options:[{text, goto}]}
   t:'label'   ラベル {id}
   t:'jump'    ジャンプ {id, cond?} cond=フラグ名（そのフラグが立っている時だけ）
   t:'set'     フラグ {flag}
   t:'end'     エンディング {ending: true|normal}
*/
const SCRIPT = [
  /* ================= 序章 ================= */
  { t: 'chapter', title: '序章', sub: '―十年ぶりの帰り道―' },
  { t: 'bg', id: 'station' },
  { t: 'bgm', id: 'calm' },
  { t: 'fx', id: 'none' },
  { t: 'se', id: 'wind' },
  { t: 'narr', text: '電車の窓から見える景色は、十年経っても変わらなかった。' },
  { t: 'narr', text: '夕日に染まる桐生町。駅のホームに降り立つと、懐かしい潮の香りが鼻をくすぐった。' },
  { t: 'mono', text: '（祖母ちゃんの葬儀……。本当に、もう会えないんだな）' },
  { t: 'narr', text: '僕――悠真は、十年前にこの町を離れた。東京の高校へ進学し、イラストレーターとして働くようになってから、帰る理由がなかった。' },
  { t: 'mono', text: '（いや、理由がなかったんじゃない。帰れなかったんだ）' },
  { t: 'narr', text: '桜並木の向こうに、小さな人影が見えた。白いカーディガンに、長い黒髪。十年経っても、僕はすぐに分かった。' },
  { t: 'show', who: 'yukino', pos: 'center' },
  { t: 'say', who: 'yukino', text: '……悠真？　……悠真、なの？' },
  { t: 'mono', text: '（雪乃……！）' },
  { t: 'say', who: 'yukino', text: '本当に悠真だ。……会いたかったよ。' },
  { t: 'narr', text: '彼女は泣き笑いで、僕の名前を呼んだ。桜の花びらが、風に舞っていた。' },

  /* ================= 第一章 ================= */
  { t: 'chapter', title: '第一章', sub: '―桜並木の再会―' },
  { t: 'bg', id: 'sakura' },
  { t: 'bgm', id: 'hopeful' },
  { t: 'fx', id: 'petals' },
  { t: 'say', who: 'yukino', text: 'ようこそ、桐生町へ。……十年ぶりだね。変わった？' },
  { t: 'say', who: 'yuma', text: '……雪乃。元気そうで、よかった。' },
  { t: 'mono', text: '（本当は、もっと早く帰ってくるはずだった。約束したのに）' },
  { t: 'say', who: 'yukino', text: 'おばあちゃんのこと、聞いたよ。ごめんね、葬儀には私も行くから。' },
  { t: 'say', who: 'yuma', text: 'ありがとう。……雪乃は、今もこの町で暮らしてるんだね。' },
  { t: 'say', who: 'yukino', text: 'うん。私はね、ここが好きだから。……ねえ、覚えてる？　この桜並木で、私たちがした約束。' },
  { t: 'mono', text: '（桜の木の下で、指切りをした。『大きくなったら、またここで会おう』って）' },
  { t: 'choice', options: [
    { text: '「覚えているよ。指切りした約束だ」', goto: 'ch1_remember' },
    { text: '「……ごめん、少し忘れかけた」', goto: 'ch1_forget' }
  ]},
  { t: 'label', id: 'ch1_remember' },
  { t: 'say', who: 'yuma', text: '覚えているよ。桜の木の下で、指切りをした約束だ。' },
  { t: 'say', who: 'yukino', text: '……！　本当？　……ふふ、嬉しい。私はずっと、覚えてたよ。' },
  { t: 'jump', id: 'ch1_after' },
  { t: 'label', id: 'ch1_forget' },
  { t: 'say', who: 'yuma', text: '……ごめん、少し忘れかけた。' },
  { t: 'say', who: 'yukino', text: '……そっか。……でも、大丈夫。私が覚えてるから。' },
  { t: 'narr', text: '雪乃は、少しだけ寂しそうに笑った。' },
  { t: 'label', id: 'ch1_after' },
  { t: 'cg', id: 'sakura' },
  { t: 'say', who: 'yukino', text: 'ねえ悠真。明日、学校に行こうよ。私たちの教室、まだあるよ。' },
  { t: 'say', who: 'yuma', text: 'え……？　学校？' },
  { t: 'say', who: 'yukino', text: 'ふふ。懐かしいでしょ？　……ね、行こう？' },

  /* ================= 第二章 ================= */
  { t: 'chapter', title: '第二章', sub: '―教室の記憶―' },
  { t: 'bg', id: 'classroom' },
  { t: 'bgm', id: 'calm' },
  { t: 'fx', id: 'none' },
  { t: 'narr', text: '翌日。桐生中学校の教室は、夕日の光に染まっていた。' },
  { t: 'mono', text: '（この教室で、雪乃と隣の席だった。黒板の隅に、二人で描いた落書きが残ってる）' },
  { t: 'say', who: 'yukino', text: '覚えてる？　ここ、私たちの席。……あの頃は、毎日がキラキラしてたね。' },
  { t: 'say', who: 'yuma', text: '雪乃、先生になったんだってね。すごいな。' },
  { t: 'say', who: 'yukino', text: '子どもたちに囲まれて、毎日楽しいよ。……でもね、最近はちょっと、体が疲れやすくて。' },
  { t: 'mono', text: '（雪乃の顔が、少しだけ曇った気がした）' },
  { t: 'bg', id: 'rooftop' },
  { t: 'narr', text: '屋上。風が強くて、雪乃の髪が揺れた。町全体が見渡せる、僕たちの秘密の場所。' },
  { t: 'say', who: 'yukino', text: 'ここから見える景色、覚えてる？　『大きくなったら、ここで結婚式を挙げよう』って言ったの。' },
  { t: 'say', who: 'yuma', text: '……雪乃。' },
  { t: 'say', who: 'yukino', text: 'ふふ、冗談だよ。……ねえ悠真。もしも私が、もう長く生きられないとしたら――' },
  { t: 'narr', text: '言葉の途中で、雪乃は笑って首を振った。' },
  { t: 'say', who: 'yukino', text: 'ごめん、変なこと言った。……忘れて。' },
  { t: 'mono', text: '（どうして、胸が苦しいんだろう）' },
  { t: 'cg', id: 'rooftop' },
  { t: 'show', who: 'misaki', pos: 'right' },
  { t: 'say', who: 'misaki', text: 'お姉ちゃん！　……あ、悠真さん？　久しぶりですね。十年も連絡なしで、よく来れましたね。' },
  { t: 'say', who: 'yuma', text: '美咲……？　大きくなったな。' },
  { t: 'say', who: 'misaki', text: 'お姉ちゃんは、ずっと待ってたんですよ。……もう、傷つけないでください。' },
  { t: 'narr', text: '美咲はそう言って、雪乃の手を取った。雪乃は、困ったように笑った。' },
  { t: 'say', who: 'yukino', text: '美咲、失礼でしょ。……ごめんね悠真。美咲は、ちょっと心配性なだけだから。' },
  { t: 'hide', who: 'misaki' },
  { t: 'bg', id: 'shrine' },
  { t: 'bgm', id: 'sad' },
  { t: 'narr', text: '帰り道、桐生神社の参道で、銀髪の巫女に出会った。澪。雪乃と同じく、幼なじみだ。' },
  { t: 'hideAll' },
  { t: 'show', who: 'mio', pos: 'center' },
  { t: 'say', who: 'mio', text: '悠真。……よく帰ってきたね。雪乃が、ずっと待っていたよ。' },
  { t: 'say', who: 'yuma', text: '澪……。雪乃のこと、なにか知ってるのか？' },
  { t: 'say', who: 'mio', text: '……うん。でも、それは雪乃から聞いてほしい。私からは、言えない。' },
  { t: 'say', who: 'mio', text: 'ただ一つだけ。……雪乃はね、笑顔の裏で、ずっと我慢してる。だから、優しくしてあげて。' },
  { t: 'mono', text: '（我慢……？　どういうことだ）' },

  /* ================= 第三章 ================= */
  { t: 'chapter', title: '第三章', sub: '―雨の日の真実―' },
  { t: 'bg', id: 'rain' },
  { t: 'bgm', id: 'sad' },
  { t: 'fx', id: 'rain' },
  { t: 'se', id: 'rain' },
  { t: 'hideAll' },
  { t: 'narr', text: '翌日、空は雨だった。桜並木で、雪乃が倒れているのを見つけた。' },
  { t: 'show', who: 'yukino', pos: 'center' },
  { t: 'say', who: 'yuma', text: '雪乃！　大丈夫か！？' },
  { t: 'say', who: 'yukino', text: '……大丈夫。ただ、ちょっと目まいがしただけ。……ごめん、心配かけたね。' },
  { t: 'narr', text: '彼女の鞄から、薬のシートがこぼれた。見慣れない薬だった。' },
  { t: 'mono', text: '（この薬……。何に効く薬なんだ）' },
  { t: 'say', who: 'yukino', text: '……見つけちゃったか。……うん、もう隠せないね。ごめんね、悠真。' },
  { t: 'say', who: 'yukino', text: '私ね、拡張型心筋症っていう病気なの。心臓が、少しずつ弱っていってる。……余命は、一年もないかもしれないって。' },
  { t: 'narr', text: '雨の音だけが、静かに降り続いていた。' },
  { t: 'say', who: 'yukino', text: '移植手術が、唯一の方法。……でも、ドナーが見つかる保証はないし、手術が成功する保証もない。' },
  { t: 'say', who: 'yuma', text: 'なんで……！　なんで言ってくれなかったんだ！　僕は、ずっと何も知らずに――' },
  { t: 'say', who: 'yukino', text: '言えなかったの。……悠真が、東京で頑張ってるのを知ってたから。私のことで、悠真の人生を壊したくなかった。' },
  { t: 'say', who: 'yuma', text: '壊す、壊さないは、僕が決めることだ！　雪乃……！　俺は、ずっと雪乃が好きだったんだ！' },
  { t: 'narr', text: '言葉が、止まらなかった。十年の想いが、雨に溶けていく。' },
  { t: 'say', who: 'yukino', text: '……私も。……ずっと、悠真だけだったよ。' },
  { t: 'cg', id: 'rain' },
  { t: 'say', who: 'yukino', text: 'ねえ悠真。……私、悠真に手紙を書いたの。もしものことがあったら、って。……でも、まだ渡したくない。まだ、もう少しだけ、悠真と一緒にいたい。' },
  { t: 'say', who: 'yuma', text: '雪乃……。俺は、逃げない。もう二度と、雪乃を置いていかない。' },
  { t: 'hide', who: 'yukino' },
  { t: 'show', who: 'mio', pos: 'center' },
  { t: 'say', who: 'mio', text: '……手術の話、聞いたよ。桐生総合病院で、ドナーの適合検査が進んでる。……雪乃の心臓は、もう限界なの。' },
  { t: 'say', who: 'mio', text: '悠真。雪乃を支えるのは、あなたしかいない。……決めるのは、あなただよ。' },

  /* ================= 第四章 ================= */
  { t: 'chapter', title: '第四章', sub: '―決断―' },
  { t: 'bg', id: 'house' },
  { t: 'bgm', id: 'sad' },
  { t: 'fx', id: 'none' },
  { t: 'se', id: 'wind' },
  { t: 'hideAll' },
  { t: 'narr', text: '祖母の家。仏壇の前で、僕は手を合わせた。' },
  { t: 'mono', text: '（ばあちゃん。俺は、どうすればいい？　雪乃を助けたい。でも、東京の仕事も、全部捨てられるのか）' },
  { t: 'show', who: 'yukino', pos: 'center' },
  { t: 'say', who: 'yukino', text: '悠真。……私ね、手術を受けることにしたの。……怖いけど、生きていたい。悠真と、もう少し一緒にいたいから。' },
  { t: 'say', who: 'yuma', text: '雪乃……！' },
  { t: 'say', who: 'yukino', text: 'だから、お願い。……手術の間、そばにいてくれる？' },
  { t: 'choice', options: [
    { text: '「もちろん。俺はここにいる」', goto: 'true_path' },
    { text: '「……ごめん。東京に戻らなきゃいけない」', goto: 'normal_path' }
  ]},

  /* ---- 真エンドルート ---- */
  { t: 'label', id: 'true_path' },
  { t: 'set', flag: 'stay' },
  { t: 'narr', text: '僕は、東京の仕事をすべて手放した。……いや、手放したんじゃない。選んだんだ。雪乃を選んだ。' },
  { t: 'say', who: 'yukino', text: 'ありがとう、悠真。……私、頑張るよ。' },
  { t: 'bg', id: 'sea' },
  { t: 'bgm', id: 'tense' },
  { t: 'fx', id: 'heartbeat' },
  { t: 'narr', text: '手術当日。手術室の前で、僕と美咲は祈るように待った。モニターの音が、静かに響いていた。' },
  { t: 'show', who: 'misaki', pos: 'left' },
  { t: 'show', who: 'mio', pos: 'right' },
  { t: 'say', who: 'misaki', text: 'お姉ちゃん……。お願い、頑張って……。' },
  { t: 'say', who: 'mio', text: '……大丈夫。雪乃は、強い子だから。' },
  { t: 'narr', text: '長い、長い時間が過ぎた。手術室の扉が開いた。' },
  { t: 'fx', id: 'none' },
  { t: 'bgm', id: 'hopeful' },
  { t: 'say', who: 'mio', text: '……成功したよ。……雪乃、生きてる。' },
  { t: 'say', who: 'yuma', text: '……よかった。……本当によかった。' },
  { t: 'hideAll' },
  { t: 'show', who: 'yukino', pos: 'center' },
  { t: 'say', who: 'yukino', text: '悠真……。……私、生きてるよ。……約束、守れたね。' },
  { t: 'jump', id: 'epilogue_true' },

  /* ---- ノーマルエンドルート ---- */
  { t: 'label', id: 'normal_path' },
  { t: 'say', who: 'yuma', text: '……ごめん、雪乃。俺は……俺は、まだ東京でやらなきゃいけないことがあるんだ。' },
  { t: 'say', who: 'yukino', text: '……そっか。……うん、わかった。……気をつけてね、悠真。' },
  { t: 'narr', text: '僕は、逃げるように東京へ戻った。……本当は、怖かったんだ。失うのが。' },
  { t: 'narr', text: '一週間後、雪乃から手紙が届いた。『もう会えないかもしれないけど、ありがとう』――' },
  { t: 'mono', text: '（遅かった……。俺は、また約束を破ったんだ）' },
  { t: 'jump', id: 'epilogue_normal' },

  /* ================= 終章：真エンド ================= */
  { t: 'label', id: 'epilogue_true' },
  { t: 'chapter', title: '終章', sub: '―桜色の約束―' },
  { t: 'bg', id: 'sakura' },
  { t: 'bgm', id: 'hopeful' },
  { t: 'fx', id: 'petals' },
  { t: 'hideAll' },
  { t: 'narr', text: '一年後。桐生町の桜並木は、今年も満開だった。' },
  { t: 'show', who: 'yukino', pos: 'center' },
  { t: 'say', who: 'yukino', text: 'ねえ悠真。……覚えてる？　『大きくなったら、またここで会おう』って。' },
  { t: 'say', who: 'yuma', text: 'うん。……そして、今年も会えた。' },
  { t: 'say', who: 'yukino', text: 'ふふ。……ねえ、来年も、再来年も、その先も。……ずっと、ここで会おうね。' },
  { t: 'say', who: 'yuma', text: 'ああ。……約束だ。……今度は、絶対に破らない。' },
  { t: 'narr', text: '桜の花びらが、二人の周りを舞った。……約束は、まだ続いている。' },
  { t: 'end', ending: 'true' },

  /* ================= 終章：ノーマルエンド ================= */
  { t: 'label', id: 'epilogue_normal' },
  { t: 'chapter', title: '終章', sub: '―桜色の約束―' },
  { t: 'bg', id: 'sakura' },
  { t: 'bgm', id: 'sad' },
  { t: 'fx', id: 'petals' },
  { t: 'hideAll' },
  { t: 'narr', text: '春。桐生町の桜並木は、今年も満開だった。' },
  { t: 'mono', text: '（雪乃……。桜は、今年も咲いたよ）' },
  { t: 'narr', text: '僕は、桜の木の下で手紙を読んだ。……『桜が咲く頃に、また会おうね』――' },
  { t: 'mono', text: '（ごめん、雪乃。俺は、また約束を破った。……でも、桜は、今年も咲いている）' },
  { t: 'end', ending: 'normal' }
];
