# 八分二十秒の、おかえり

コンソール / PC の商業ノベルゲームを志向した、フルスクリーン 16:9 の Japanese cinematic visual novel プロトタイプです。Web ページのカード UI ではなく、タイトル画面・章タイトル・立ち絵・テキストボックス・選択肢・バックログ・セーブ/ロード・CG/音楽アーカイブ・エンディング一覧をゲーム画面として構成しています。

## 起動

```bash
npm install
npm run dev
```

開発サーバーは `0.0.0.0:4173` で起動します。Arena のライブプレビューからそのまま游玩できます。

本番ビルド:

```bash
npm run build
npm run preview
```

## 操作

| 入力 | 動作 |
| --- | --- |
| クリック / Enter / Space / ↓ | テキスト送り、全文表示 |
| ↑↓ / テンキー | タイトル・選択肢の選択 |
| `A` | オート切り替え |
| `S` | スキップ切り替え（既定は既読のみ） |
| `B` | バックログ |
| `Esc` | システムメニュー |
| `Ctrl` / `H` | テキスト非表示 |
| ゲームパッド | A: 送る / B: ログ / X: オート / Y: スキップ / Start: メニュー |

タイトル、クイックメニュー、システムメニューからセーブ/ロード、設定、ギャラリー、ミュージック、エンディング一覧、クレジットを開けます。進行・既読・解放状況・設定は `localStorage` に保存されます。

## シナリオ

全 149 ノード、序章 + 4 章 + 3 エンディング。選択肢で「観測」と「真実」の内部値が変化し、条件を満たすと TRUE END「おかえり」に分岐します。

- プロローグ：八分二十秒遅れて届く光
- 第一章：観測されない日々
- 第二章：観測ノート
- 第三章：父の時計
- 第四章：最終講義
- 八年後の春 / エピローグ

重要場面のみ、Arena Speech Generation による日本語キーボイスを収録しています。

## 演出

- 60 fps のスプリング式マウス視差、背景ズーム、立ち絵の呼吸・入退場・表情クロスフェード・発言者フォーカス
- 透過 PNG をキャラクターごとに共通アルファボックスで切り揃え、リムライト用シルエットを生成
- PixiJS + Live2D Cubism 2.1 による「観測システム〈シズク〉」の常時モーション
- Canvas パーティクル（夕暮れの塵・星・雨・桜・星光）、白フラッシュ、画面揺れ、グリッチ、セピア、サブライズ、シネマバー、フィルムグレイン
- Howler による BGM クロスフェード、ボイス時のダッキング、Web Audio による環境音
- 章カード、スチルビューア、エンディングカード、トースト、設定スライダー、8 スロットセーブ

## 外部アセット

- **立ち絵**: 接続済み Google Drive のユーザー所有素材から表情違いを選定し、透過・サイズ・共通ボックスを再正規化。生 PNG は Git に含めず、`public/assets/chars/*.webp` と `manifest.json` のみを同梱。
- **背景**: Arena Image Generation で本作向けに生成した 7 枚の 16:9 マットペイント。
- **BGM**: `uncle-sheepsky/duru-ai-cc0-bgm` — CC0 1.0 / 320 kbps MP3。
- **SE**: `wyzowl/sfx-kit` — CC0 1.0 / 48 kHz 24-bit WAV。
- **Live2D**: Live2D Inc. サンプルモデル「Shizuku」、`guansss/pixi-live2d-display` (MIT)、Cubism 2.1 runtime mirror。
- **フォント**: Noto Serif JP Variable (OFL 1.1)。
- **キーボイス**: Arena.ai Speech Generation。

詳細は `CREDITS.md` と `public/assets/licenses/` を参照してください。

## アセットの再取得

GitHub 由来のアセットは事前認証済み `gh` CLI で再取得できます。

```bash
python3 -m pip install --break-system-packages Pillow
python3 scripts/fetch_assets.py
python3 scripts/process_sprites.py   # google_drive/ の生 PNG が必要
```

> Live2D サンプルモデルはフリー素材ライセンス扱いです。実際に商用配布する場合は、正式にライセンス取得した立ち絵・モデルへ差し替え、Live2D SDK の規約を確認してください。
