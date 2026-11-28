/* ============================================================
   scenario.js — 『灯りの向こう側 〜桜色の約束〜』本編シナリオ
   文章・演出をデータとして分離した、分岐対応のビジュアルノベル脚本。
   ============================================================ */
const Scenario = {
  title: '灯りの向こう側',
  subtitle: '〜 桜色の約束 〜',
  start: 'prologue',
  nodes: {
    /* ==================== 序章 ==================== */
    prologue: [
      { type:'chapter', title:'序章', sub:'帰郷 — ひかりの町へ' },
      { type:'bg', name:'station', tint:'warm' },
      { type:'music', mood:'piano' },
      { type:'sfx', name:'page' },
      { type:'narration', text:'潮の匂いを含んだ風が、七年ぶりの駅のホームをゆっくりと横切った。' },
      { type:'narration', text:'星波町。海と灯台と、忘れたふりをしていた約束のある町。' },
      { type:'dialogue', speaker:'悠真', text:'……変わってないな。駅舎も、あの山の形も。' },
      { type:'narration', text:'大学の夏休み。祖母の家を片付けるために戻ってきただけの、短い帰郷のはずだった。' },
      { type:'dialogue', speaker:'悠真', text:'三週間だけ。終わったら、また東京に戻る。' },
      { type:'effect', name:'wind' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'right', pose:'normal', text:'……悠真、くん？' },
      { type:'narration', text:'背中から呼ばれた声は、記憶の中にある声より少しだけ大人びていた。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'right', text:'やっぱり。間違ってたらどうしようって、ずっと思ってた。' },
      { type:'dialogue', speaker:'悠真', text:'雪乃……？　どうしてここに。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'right', text:'灯台の帰り。おばさんから、今日帰ってくるって聞いてたから。' },
      { type:'narration', text:'彼女の視線の先、町を見下ろす丘の上で、白い灯台が夕焼けを受けていた。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'right', text:'ねえ。覚えてる？　あの日のこと。' },
      { type:'choice', choices:[
        { text:'「雪乃」と、ちゃんと名前を呼ぶ', to:'prologue_call', set:{yukino:2, memory:1} },
        { text:'昔のことには触れず、笑ってごまかす', to:'prologue_avoid', set:{yukino:-1} }
      ]}
    ],
    prologue_call: [
      { type:'dialogue', speaker:'悠真', text:'……覚えてるよ。雪乃。忘れられるわけ、ないだろ。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'right', text:'そっか。よかった。……名前を呼んでくれて。' },
      { type:'narration', text:'雪乃は、泣きそうな顔で笑った。その笑顔を、僕は七年前にも見たことがある。' },
      { type:'flag', set:{promise:1} },
      { type:'jump', to:'prologue_merge' }
    ],
    prologue_avoid: [
      { type:'dialogue', speaker:'悠真', text:'急に呼び止めるから、びっくりしたよ。元気そうでよかった。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'right', text:'……うん。元気。悠真くんも、変わらないね。' },
      { type:'narration', text:'笑顔の形だけが、どこか遠かった。海から吹いた風が、彼女の髪を隠すように揺らした。' },
      { type:'jump', to:'prologue_merge' }
    ],
    prologue_merge: [
      { type:'sfx', name:'bell' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'right', text:'明日から、また星陵学園だね。転校の手続き、済んだって聞いたよ。' },
      { type:'dialogue', speaker:'悠真', text:'うん。まさか同じクラスになるとは思わなかった。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'right', text:'じゃあ、明日。……ちゃんと、来てね。' },
      { type:'narration', text:'去っていく彼女の背中を見ながら、胸の奥で古い時計が動き出す音を聞いた気がした。' },
      { type:'jump', to:'day1' }
    ],

    /* ==================== 第一章 ==================== */
    day1: [
      { type:'chapter', title:'第一章', sub:'潮風と、名前のない記憶' },
      { type:'bg', name:'classroom', tint:'warm' },
      { type:'music', mood:'daily' },
      { type:'narration', text:'翌朝。窓から差す光は、東京の教室よりもずっと近く感じられた。' },
      { type:'narration', text:'黒板の隅には、夏休みまであと七日、と白いチョークで書かれている。' },
      { type:'dialogue', speaker:'教師', text:'今日から転入する、雨宮悠真くんだ。みんな仲良くするように。' },
      { type:'dialogue', speaker:'悠真', text:'雨宮悠真です。よろしくお願いします。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'left', pose:'normal', text:'よろしく。席、こっち。窓際のいちばん後ろ。' },
      { type:'dialogue', speaker:'悠真', text:'あ、ありがとう。君は……？' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'left', text:'水瀬澪。雪乃の、まあ……幼なじみみたいなもの。よろしくね、転校生。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'right', text:'澪、紹介が雑。悠真くん、困ってるよ。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'left', text:'だって、雪乃がずっとそわそわしてるから。昨日から三回も窓の外見てたし。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'right', text:'そ、そんな……。' },
      { type:'narration', text:'雪乃の頬に、淡い赤が灯る。けれど澪は、からかうように笑いながらも、その横顔を気にしていた。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'left', text:'放課後、時間ある？　町を案内してあげる。海と、古い神社と……あと、私の秘密基地。' },
      { type:'choice', choices:[
        { text:'雪乃と灯台に行く約束を思い出す', to:'day1_rooftop', set:{yukino:1, promise:1} },
        { text:'澪の「秘密基地」に興味を持つ', to:'day1_music', set:{mio:2} }
      ]}
    ],
    day1_rooftop: [
      { type:'bg', name:'rooftop', tint:'cool' },
      { type:'sfx', name:'waves' },
      { type:'dialogue', speaker:'悠真', text:'ごめん。雪乃と、灯台に行く約束をしてるんだ。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'left', text:'……そっか。約束なら、仕方ないね。' },
      { type:'narration', text:'澪は笑った。けれど、風に揺れる前髪の向こうで、瞳の光が一瞬だけ消えた。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'left', text:'じゃあ、明日。私の秘密基地にも来て。約束、だからね。' },
      { type:'flag', set:{mio:1} },
      { type:'jump', to:'lighthouse_first' }
    ],
    day1_music: [
      { type:'bg', name:'music', tint:'warm' },
      { type:'music', mood:'piano' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'center', text:'ここ。放課後は誰も来ないから、好きに弾けるの。' },
      { type:'narration', text:'音楽室の窓からは、遠くに灯台が見えた。古いグランドピアノの上に、一冊のノートが置かれている。' },
      { type:'dialogue', speaker:'悠真', text:'作曲してるの？' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'center', text:'うん。まだ、曲になってないけど。聴いてみる？' },
      { type:'dialogue', speaker:'悠真', text:'もちろん。' },
      { type:'sfx', name:'page' },
      { type:'narration', text:'澪が鍵盤をそっと叩く。未完成の旋律は、波打ち際の光のように、何度も同じ場所へ戻ってきた。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'center', text:'この曲、最後の一音だけが決まらないんだ。終わらせるのが、怖くて。' },
      { type:'dialogue', speaker:'悠真', text:'終わらせないっていう選択も、あるんじゃないかな。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'center', text:'……悠真くんって、変なこと言うね。でも、嫌いじゃない。' },
      { type:'jump', to:'lighthouse_first' }
    ],

    /* ==================== 第二章 ==================== */
    lighthouse_first: [
      { type:'chapter', title:'第二章', sub:'灯台の下で、ほどける時間' },
      { type:'bg', name:'title', tint:'warm' },
      { type:'music', mood:'sad' },
      { type:'char', id:'yukino', pos:'left', pose:'normal' },
      { type:'char', id:'mio', pos:'right', pose:'normal', dim:true },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'ここから見る海、好きだった。昔は、毎日来てたよね。' },
      { type:'dialogue', speaker:'悠真', text:'七年前の夏も、ここで会った。' },
      { type:'narration', text:'灯台の白い壁に、夕暮れの雲が流れていく。光が一周するたび、町の色が少しずつ変わった。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'あの日、悠真くんは言ったの。「灯りが消えても、向こう側で会おう」って。' },
      { type:'dialogue', speaker:'悠真', text:'……そんなこと、言ったっけ。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'言ったよ。私もいたから。二人とも、泣きながら指切りしてた。' },
      { type:'narration', text:'その言葉で、閉じていた記憶の扉が、軋みながら開いた。雨の音。救急車の赤い光。握った手のぬくもり。' },
      { type:'dialogue', speaker:'悠真', text:'あの夜……雪乃のお母さんが倒れて、それで僕らは……' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'うん。次の日、悠真くんは東京へ引っ越した。何も言わずに。' },
      { type:'dialogue', speaker:'悠真', text:'……ごめん。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'謝らないで。私も、言えなかったから。' },
      { type:'choice', choices:[
        { text:'雪乃が隠していることを聞く', to:'yukino_truth', set:{yukino:2, truth:1} },
        { text:'今は、昔の約束だけを確かめる', to:'promise_again', set:{promise:2, memory:1} }
      ]}
    ],
    yukino_truth: [
      { type:'dialogue', speaker:'悠真', text:'雪乃。何か、僕に隠してることがあるんじゃないか？' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'……どうして、そう思うの？' },
      { type:'dialogue', speaker:'悠真', text:'昨日からずっと、笑ってるのに、どこか遠いから。' },
      { type:'sfx', name:'heartbeat' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'……夏休みが終わったら、私はこの町を出るの。遠い病院で、手術を受ける。' },
      { type:'narration', text:'風の音が消えた。灯台の光だけが、僕らの間を何度も横切っていく。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'成功する確率は、半分くらい。だから、今年の夏を、最後の夏にしたくないの。' },
      { type:'dialogue', speaker:'悠真', text:'……そんな話、聞いてない。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'言えなかった。言ったら、悠真くんがまたいなくなる気がして。' },
      { type:'flag', set:{yukino:2, promise:1} },
      { type:'jump', to:'promise_again' }
    ],
    promise_again: [
      { type:'dialogue', speaker:'悠真', text:'約束、もう一度しよう。灯りが消えても、向こう側で会うって。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'……うん。今度は、忘れないように。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'……二人とも、ずるいな。' },
      { type:'dialogue', speaker:'悠真', text:'澪？' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'なんでもない。ほら、日が沈むよ。帰ろう。' },
      { type:'narration', text:'その夜、澪はいつもより少しだけ早く歩いた。僕らの影が、長く、三つ並んで伸びていた。' },
      { type:'jump', to:'night_town' }
    ],

    /* ==================== 第三章 ==================== */
    night_town: [
      { type:'chapter', title:'第三章', sub:'星のない夜に、君の音を' },
      { type:'bg', name:'night', tint:'night' },
      { type:'music', mood:'sad' },
      { type:'sfx', name:'rain' },
      { type:'narration', text:'その晩、町に雨が降った。夏の雨は、窓ガラスを叩きながら、忘れていたことまで連れてくる。' },
      { type:'dialogue', speaker:'悠真', text:'雪乃の手術。半分……。' },
      { type:'narration', text:'机の引き出しから、古い写真が出てきた。灯台の前で、笑っている三人。写真の端は、雨に濡れたように波打っている。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'……起きてる？' },
      { type:'dialogue', speaker:'悠真', text:'澪？　どうしてここに。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'窓、開いてたから。雪乃から、聞いたんでしょ。' },
      { type:'dialogue', speaker:'悠真', text:'うん。どうして教えてくれなかった？' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'聞かれなかったから。それに、雪乃が自分で言うまで、私が言うことじゃない。' },
      { type:'narration', text:'雨の向こうで、町の灯りが滲んでいた。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'私ね、雪乃がいなくなるかもしれないって思うと、怖い。でも、悠真くんが来てくれて、少し安心した。' },
      { type:'dialogue', speaker:'悠真', text:'僕に、何ができるんだろう。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'できることを探すんじゃなくて。いなくならないこと、じゃない？' },
      { type:'choice', choices:[
        { text:'「絶対にいなくならない」と答える', to:'night_vow', set:{yukino:2, mio:1, promise:1} },
        { text:'「できる限り、そばにいる」と答える', to:'night_honest', set:{mio:2} }
      ]}
    ],
    night_vow: [
      { type:'dialogue', speaker:'悠真', text:'絶対にいなくならない。雪乃の手術の日も、ここにいる。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'……うん。そう言うと思った。' },
      { type:'narration', text:'澪は、濡れた窓に指で小さな灯台を描いた。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'だったら、私も手伝う。三人で、最後の一週間を、ちゃんと夏にしよう。' },
      { type:'jump', to:'summer_plan' }
    ],
    night_honest: [
      { type:'dialogue', speaker:'悠真', text:'……できる限り、そばにいる。約束は、簡単に言えないから。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'そっか。うん。それでいいと思う。' },
      { type:'narration', text:'澪は少し笑った。その笑顔には、諦めではなく、静かな覚悟があった。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'じゃあ、明日から計画を立てよう。最後じゃなくて、始まりになるように。' },
      { type:'flag', set:{mio:1} },
      { type:'jump', to:'summer_plan' }
    ],
    summer_plan: [
      { type:'chapter', title:'第四章', sub:'七日間の、名前をつける' },
      { type:'bg', name:'classroom', tint:'warm' },
      { type:'music', mood:'daily' },
      { type:'narration', text:'それからの七日間を、僕たちは三人で過ごした。' },
      { type:'narration', text:'朝は教室で笑い、昼は海辺でパンを分け、放課後は音楽室で澪の曲を聴いた。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'ねえ、悠真くん。東京の夏って、どんな匂い？' },
      { type:'dialogue', speaker:'悠真', text:'アスファルトと、電車のブレーキ。星は少ない。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'じゃあ、星波町の夏は？' },
      { type:'dialogue', speaker:'悠真', text:'潮風と、蝉の声。それから……灯台の明かり。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'それ、曲のタイトルにしていい？' },
      { type:'dialogue', speaker:'悠真', text:'僕の返事を勝手に使うなよ。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'もう使った。『灯りの向こう側』。ね、雪乃。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'……うん。素敵なタイトル。' },
      { type:'narration', text:'雪乃は笑っていた。でも、薬の入った小さな袋が、制服のポケットから覗いていた。' },
      { type:'jump', to:'beach_memory' }
    ],
    beach_memory: [
      { type:'bg', name:'beach', tint:'warm' },
      { type:'music', mood:'piano' },
      { type:'sfx', name:'waves' },
      { type:'char', id:'yukino', pos:'left', pose:'normal' },
      { type:'char', id:'mio', pos:'right', pose:'normal', dim:true },
      { type:'narration', text:'約束の前日。僕たちは、七年前と同じ浜辺に来ていた。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'あの日も、ここで貝殻を拾ったね。悠真くんが、いちばん大きいのをくれた。' },
      { type:'dialogue', speaker:'悠真', text:'今度は、三人で探そう。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'私、もう見つけた。ほら。' },
      { type:'narration', text:'澪の手のひらには、桜色の小さな貝殻があった。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'これに、明日の願いを書こうよ。海に流すんじゃなくて、灯台に置くの。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'願いは、誰かに見つけてもらわないと意味がないの？' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'ううん。自分が、願ったことを忘れないため。' },
      { type:'choice', choices:[
        { text:'三人の願いを一つにする', to:'beach_one', set:{yukino:2, mio:1, promise:2} },
        { text:'それぞれの願いを、秘密にする', to:'beach_secret', set:{mio:2, memory:1} }
      ]}
    ],
    beach_one: [
      { type:'dialogue', speaker:'悠真', text:'じゃあ、願いは一つ。「また三人で、この海を見る」だ。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'それなら、きっと叶うね。三人で願えば、強いから。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'うん。明日、ちゃんと灯りを見届けよう。' },
      { type:'jump', to:'hospital_day' }
    ],
    beach_secret: [
      { type:'dialogue', speaker:'悠真', text:'秘密の方が、叶ったとき嬉しいかもしれない。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'悠真くんらしいね。じゃあ、私は秘密にする。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'……私も。叶ったら、教えてあげる。' },
      { type:'narration', text:'三人の手のひらに、同じ海の光が揺れていた。' },
      { type:'jump', to:'hospital_day' }
    ],

    /* ==================== 最終章 ==================== */
    hospital_day: [
      { type:'chapter', title:'最終章', sub:'灯りの向こう側' },
      { type:'bg', name:'hospital', tint:'cool' },
      { type:'music', mood:'sad' },
      { type:'sfx', name:'heartbeat' },
      { type:'narration', text:'約束の日。雪乃は朝から病院のベッドにいた。窓の向こうに、灯台の白い影が見える。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'center', text:'ねえ、悠真くん。もし私が、帰ってこられなかったら……' },
      { type:'dialogue', speaker:'悠真', text:'その先は言わなくていい。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'center', text:'でも、聞いてほしい。私、怖いの。ずっと平気なふりをしてたけど……本当は、すごく怖い。' },
      { type:'narration', text:'雪乃の指が、シーツの上で小さく震えていた。僕はその手を、両手で包んだ。' },
      { type:'dialogue', speaker:'悠真', text:'怖くていい。泣いてもいい。僕が、ここにいる。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'……雪乃。手術が終わったら、音楽室に来て。新しい曲、聴かせるから。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'center', text:'約束？' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'約束。今度は、私が忘れない。' },
      { type:'narration', text:'廊下の時計が、午後六時を告げた。窓の外で、灯台の光が一度だけ瞬いた。' },
      { type:'choice', choices:[
        { text:'雪乃の手を、最後まで離さない', to:'final_true_prep', set:{yukino:2, promise:2} },
        { text:'澪に、曲の最後の一音を任せる', to:'final_mio_prep', set:{mio:3} }
      ]}
    ],
    final_true_prep: [
      { type:'dialogue', speaker:'悠真', text:'雪乃。灯りが消えても、僕は向こう側にいる。だから、帰ってきて。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'center', text:'……うん。帰る。約束する。' },
      { type:'sfx', name:'bell' },
      { type:'effect', name:'flash' },
      { type:'narration', text:'ドアが閉まり、手のひらからぬくもりが消えた。長い夜が、始まった。' },
      { type:'jump', to:'lighthouse_final' }
    ],
    final_mio_prep: [
      { type:'dialogue', speaker:'悠真', text:'澪。あの曲の最後の一音、雪乃に聴かせよう。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'うん。私たちの夏が終わらないように。' },
      { type:'narration', text:'澪はノートを開いた。書きかけだった五線譜の最後に、桜色のペンで音符を一つ書き足す。' },
      { type:'sfx', name:'bell' },
      { type:'jump', to:'lighthouse_final' }
    ],
    lighthouse_final: [
      { type:'bg', name:'title', tint:'warm' },
      { type:'music', mood:'climax' },
      { type:'char', id:'yukino', pos:'left', pose:'normal' },
      { type:'char', id:'mio', pos:'right', pose:'normal', dim:true },
      { type:'narration', text:'夜。僕たちは灯台の丘にいた。町の灯りがひとつずつ消え、海の向こうに星が戻ってくる。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'……来た。灯台の光が、消える。' },
      { type:'effect', name:'fade' },
      { type:'delay', ms:1400 },
      { type:'effect', name:'flash' },
      { type:'bg', name:'station', tint:'warm' },
      { type:'music', mood:'ending' },
      { type:'narration', text:'そして、朝が来た。' },
      { type:'branch', cases:[
        { when:{all:[{key:'yukino', gte:6},{key:'promise', gte:4}]}, to:'ending_true' },
        { when:{all:[{key:'mio', gte:5},{key:'memory', gte:1}]}, to:'ending_mio' }
      ], otherwise:'ending_normal' }
    ],

    /* ==================== エンディング ==================== */
    ending_true: [
      { type:'music', mood:'ending' },
      { type:'bg', name:'shrine', tint:'warm' },
      { type:'char', id:'yukino', pos:'center', pose:'normal' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'center', text:'ただいま。……ちゃんと、帰ってこられたよ。' },
      { type:'dialogue', speaker:'悠真', text:'おかえり、雪乃。' },
      { type:'narration', text:'手術は成功した。長いリハビリのあと、雪乃は春の町に戻ってきた。' },
      { type:'narration', text:'灯台はもう役目を終えていたけれど、丘の上には新しい小さな灯りがともっていた。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'center', text:'ねえ、悠真くん。今度は、何年後の約束にする？' },
      { type:'dialogue', speaker:'悠真', text:'何年後じゃなくて、明日。明日も、ここで会おう。' },
      { type:'narration', text:'桜が風に舞う。七年前にほどけた約束は、今度こそ、僕らの時間になった。' },
      { type:'end', title:'TRUE END', sub:'灯りの向こう側', text:'君が帰る場所は、いつだってここにある。' }
    ],
    ending_mio: [
      { type:'music', mood:'ending' },
      { type:'bg', name:'music', tint:'warm' },
      { type:'char', id:'mio', pos:'center', pose:'normal' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'center', text:'聴いて。最後の一音、やっと見つかったんだ。' },
      { type:'narration', text:'澪の指が鍵盤に触れる。音楽室の窓から、春の海が見えた。' },
      { type:'dialogue', speaker:'悠真', text:'……きれいだ。あの夏の続きみたいだ。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'center', text:'うん。雪乃も、きっと聴いてる。だから、終わりじゃないよ。' },
      { type:'narration', text:'完成した曲のタイトルは、「灯りの向こう側」。それは三人で過ごした夏と、これから始まる季節の名前になった。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'center', text:'悠真くん。来年も、この曲を聴きに来てくれる？' },
      { type:'dialogue', speaker:'悠真', text:'もちろん。何度でも。' },
      { type:'end', title:'AFTER END', sub:'君の音が聞こえる', text:'終わらせない選択が、明日の旋律になる。' }
    ],
    ending_normal: [
      { type:'music', mood:'ending' },
      { type:'bg', name:'station', tint:'warm' },
      { type:'char', id:'yukino', pos:'left', pose:'normal' },
      { type:'char', id:'mio', pos:'right', pose:'normal', dim:true },
      { type:'dialogue', speaker:'悠真', text:'……朝だ。' },
      { type:'narration', text:'手術の結果を、僕たちはまだ聞いていない。けれど、空は昨日より少しだけ明るかった。' },
      { type:'dialogue', speaker:'雪乃', chara:'yukino', pos:'left', text:'ねえ、二人とも。春になったら、またここに来よう。' },
      { type:'dialogue', speaker:'澪', chara:'mio', pos:'right', text:'うん。次は、三人で桜を見よう。' },
      { type:'narration', text:'確かなことは、ひとつだけだった。僕たちはもう、昨日の僕たちではない。' },
      { type:'narration', text:'灯りが消えても、歩いていける。誰かの残した光を、次の誰かへ渡すように。' },
      { type:'end', title:'NORMAL END', sub:'桜色の約束', text:'ひかりは、消えても心に残る。' }
    ]
  }
};
