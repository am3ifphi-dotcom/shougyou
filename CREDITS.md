# Credits / 素材クレジット

## 開発

- 企画・脚本・演出・実装: Arena.ai Agent Mode / 本リポジトリ
- ゲームエンジン: Vite + Vanilla JavaScript
- レンダリング: PixiJS 6.5.10 (MIT)
- アニメーション: GSAP 3.12.5 (Standard "no charge" license)
- 音声: Howler.js 2.2.4 (MIT)
- Live2D 連携: `pixi-live2d-display` 0.4.0 (MIT)
- 組版: Noto Serif JP Variable (`@fontsource-variable/noto-serif-jp`, SIL Open Font License 1.1)

## ビジュアル

- 立ち絵: 接続済み Google Drive のユーザー所有素材。詳細は [`public/assets/licenses/GOOGLE-DRIVE-ASSET-NOTICE.txt`](public/assets/licenses/GOOGLE-DRIVE-ASSET-NOTICE.txt)。
- 背景イラスト: Arena Image Generation により本作のために生成。`/public/assets/bg/observatory_dusk.jpg`, `classroom_sunset.jpg`, `library_night.jpg`, `rooftop_night.jpg`, `hospital_dawn.jpg`, `starlight.jpg`, `school_spring.jpg`。
- Live2D サンプルモデル「Shizuku」: © Live2D Inc. / Free Material License。`guansss/pixi-live2d-display@v0.4.0` のテストアセットより。商用配布時は正式ライセンス素材への差し替えが必要です。
- Cubism 2.1 WebGL runtime mirror: `dylanNew/live2d` (`public/vendor/live2d.min.js`)。

## 音楽

`uncle-sheepsky/duru-ai-cc0-bgm` より 7 曲。CC0 1.0、320 kbps MP3、クレジット不要。ライセンス全文: [`public/assets/licenses/DURU-AI-CC0-BGM-LICENSE.txt`](public/assets/licenses/DURU-AI-CC0-BGM-LICENSE.txt)。

| ゲーム内 | 元ファイル |
| --- | --- |
| `title.mp3` 八分二十秒 | `duru-zoneout-16-shootingstar-whistle.mp3` |
| `daily.mp3` とろける午後 | `duru-zoneout-01-melty-afternoon.mp3` |
| `archive.mp3` 観測ノート | `duru-roomscene-lofi.mp3` |
| `nocturne.mp3` 温かいミルクの夜想曲 | `duru-zoneout-11-warm-milk-nocturne.mp3` |
| `truth.mp3` 左側の記憶 | `duru-bed-brainmap-leftpanel.mp3` |
| `climax.mp3` 枕のワルツ | `duru-zoneout-04-pillow-waltz.mp3` |
| `epilogue.mp3` その後の光 | `duru-reacts.mp3` |

## 効果音

`wyzowl/sfx-kit` より 22 WAV。CC0 1.0、48 kHz / 24-bit、クレジット不要。ライセンス全文: [`public/assets/licenses/SFX-KIT-CC0-LICENSE.txt`](public/assets/licenses/SFX-KIT-CC0-LICENSE.txt)。タイトル操作音、決定/取消、紙・本・ページ、星光・シマー、衝撃・ライザー・ラッチ・グリッチ・メッセージ・チャイム、環境スティンガーなどに使用。雨・星屑などの連続環境音は Web Audio API で生成しています。

## ボイス

Arena.ai Speech Generation で生成した日本語キーボイス（明里 5 ライン、零 3 ライン、稲葉 1 ライン、勝也 1 ライン）。`/public/assets/voice/*.mp3`。

## 権利に関する注記

- キャラクター原画と Live2D サンプルモデルの権利は各権利者に帰属します。本リポジトリは素材の権利を主張しません。
- 実販売・Steam / コンソール移植・広告利用の前に、キャラクター原画・Live2D モデル・Cubism SDK・BGM/SE/フォントの各ライセンスを法務確認してください。CC0 / MIT / OFL 素材についても、配布形態に応じた表記を推奨します。
