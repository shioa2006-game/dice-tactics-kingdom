# 参照元・取り込み・変更記録

ルートの `src/` と `vendor/` が通常の KINGDOM ゲーム用です。参照元の `dice-tactics/`、`Storybook_Character_Studio/`、`mockup/` は役目を終えて削除済みです。以下の原本パスとエクスポートコマンドは取り込み当時の記録で、現在の依存先ではありません。ファイルごとの SHA-256 とコピー元の Git HEAD は [source-manifest.json](source-manifest.json) に記録しています。パスはすべて作業ルート基準です。

削除前にDICE TACTICSのコア6ファイルを `tests/reference/core/` へ、既存テスト・ヘルパー・照合データを `tests/` へ、ルールを `docs/ORIGINAL_RULES.md` へバイトコピーしました。コピー元と保存先のハッシュは [検証用manifest](../tests/reference/manifest.json) に記録しています。ゲームはこの比較用コアを読み込まず、従来どおり `src/core/` を使います。`.git` や元ゲームのUI一式は取り込んでいません。

## コピー元の版と取り込み方法

| 参照元 | 版 | 取り込み |
|---|---|---|
| DICE TACTICS | `8bf10ff0c79edc59fd2252171f964fee7b9c70eb` | `src/core/` 全6ファイル、CPU呼出・Worker、音声全6ファイル、SVG補助図案をバイトコピー。進行・UI・演出の3ファイルはコピー後に表示アダプタへ接続 |
| Storybook Character Studio | `97b7e03102a482d97cd0043990f0a39fe4866794` | 正式な `tools/export-game.mjs` で選択8種類と依存モジュールを `vendor/inkstone/` へ出力 |
| 前回の `mockup/` | 前回成果物。Git管理なし | `app.js` の描画・座標変換・パン・タッチ入力の構造を参照し、ゲーム進行に接続する `kingdom-board.js` を新規作成 |

正式エクスポートのコマンドは以下です。既存の出力先を上書きしないエクスポータなので、再実行時は新しい出力先を指定します。

```powershell
node Storybook_Character_Studio/tools/export-game.mjs --characters king,warrior,archer,mage,demon-king,goblin,skeleton-archer,dark-mage --out vendor/inkstone
```

`vendor/inkstone/export-manifest.json` は正式エクスポート時の出力記録としてそのまま保持しています。この中の `sharedLibrary: unmodified` は出力時点を表します。その後のコピー側の変更は次項に記録しています。`characters/register.js`、キットの `main.js`・`index.html`・`package.json`・`USE_IN_GAME.md`・`export-manifest.json` はエクスポータが生成したファイルで、原本の同名ファイルとのバイト比較の対象ではありません。`.git` は取り込んでいません。

## Studioコピー側の限定変更

原本の公開ルーム設定・描画APIを使い、輪郭・石積み・松明・方向別のキャラクターと動作は原本を維持しています。公開設定だけでは床全体の点描密度と石塊の個別色を指定できなかったため、以下の床・石塊設定をコピー側に追加しました。加えて移動モード用の駒別透明度を描画時に適用しています。省略時の描画は従来どおりです。

`vendor/inkstone/src/dungeon/architecture.js` の床点描：

```diff
- stippleFace(ctx, a, b, d, 2.0, { base: 0.2, edge: 0.8, fall: 8 });
+ stippleFace(ctx, a, b, d, 2.0 * (fo.density ?? 1), { base: 0.2, edge: 0.8, fall: 8 });
```

`vendor/inkstone/src/dungeon/props.js` の `drawStonePile`：

```diff
- .forEach(b => drawStoneBox(ctx, b, { round: 4 }));
+ .forEach(b => drawStoneBox(ctx, b, { round: 4, ...(p.stoneStyle || {}) }));
```

初回取り込み時は上記2ファイル以外のバイト一致を確認しました。明示的な移動モードの追加で、`vendor/inkstone/src/rendering/renderer.js` に任意の `units[].opacity`（既定1）を追加しています。既存のキャッシュ画像を身体・影・遮蔽時の透視表示へ合成する時だけ透明度を適用し、背景やキャラクターのフレームを再生成しません。通常の駒は1、移動中の他の駒は0.28、移動先の仮表示は0.55です。キャラクター定義・装備・方向別描画・アニメーションは変更していません。

向き・HPの前後関係はゲーム側のアダプタで処理しています。足元HPは公開 `floorOverlay` を使用し、移動先の半透明キャラクターにはHPや選択用ヒット領域を付けません。元の12体の状態・判定は変わりません。

2026-10-25: 事前生成画像のため、コピー側の `cache.js` に検証付きアトラス登録と矩形参照、`renderer.js` に登録API、`character-view.js` に共通フレーム貼り付けを追加しました。キャラクター定義は変更せず、Studioの描画から全コマを生成しています。`assets/characters/manifest.json` に入力と画像のハッシュを記録。詳しい再生成方法は [アニメーション画像](ANIMATION_ASSETS.md) を参照してください。

## キャラクターIDとユニット対応

`src/ui/kingdom-assets.js` が、元ゲームの固定ユニット番号と描画ID・表示名を対応させます。同じ兵種の2体も独立したユニットIDのままです。

| ユニット番号 | KINGDOM表示名 | Studio ID | 実際の定義 |
|---|---|---|---|
| 0 | 王 | `king` | `characters/king/character.js` |
| 1・2 | 剣士1・2 | `warrior` | `characters/warrior/character.js` |
| 3・4 | 弓使い1・2 | `archer` | `src/characters/archer.js`（内蔵定義） |
| 5 | 魔法使い | `mage` | `characters/mage/character.js` |
| 6 | 魔王 | `demon-king` | `characters/demon-king/character.js` |
| 7・8 | ゴブリン戦士1・2 | `goblin` | `characters/goblin/character.js` |
| 9・10 | 骸骨弓兵1・2 | `skeleton-archer` | `characters/skeleton-archer/character.js` |
| 11 | 暗黒魔法使い | `dark-mage` | `characters/dark-mage/character.js` |

剣士には、他の人間型と頭身・画風が揃う `warrior` を採用しています。`NW / NE / SW / SE` の既存方向と `idle / walk / attack` を使い、左右反転による武器・盾の持ち手交換は行いません。`kingdom-facing.js` が初期配置と各駒の行動完了時に敵王へ向く方向を記憶します。敵王の移動・パン・再描画・ターン交代では待機中の他の駒を回転させません。既存の4方向から最も近い方向を選び、ちょうど中間なら候補に含まれる現在方向を保持します。移動・攻撃中は行動方向で上書きし、コアの行動確定時に攻撃者／移動者だけ更新します。押し出された側は待機方向を保持し、「戻す」は以前の向きを復元、王撃破後は最後の攻撃方向を保持します。矢は攻撃中の方向を使います。盤上は足元の印と丸いHP目盛りを表示し、名前・同職種番号・小さな肖像・詳しい状態は下部の選択情報に置いています。

## 新ゲーム側の変更範囲

| ファイル | 内容 |
|---|---|
| `src/core/` 全6ファイル | ルール、初期配置、ダイス、乱数、4難易度の判断を原本どおり保持 |
| `src/ui/cpu.js`・`cpu-worker.js` | Workerとフォールバックの呼び出しを保持 |
| `src/ui/audio/` 全6ファイル | BGM、効果音、音量、消音、音声再開処理を保持 |
| `src/ui/art.js` | ダイス面と小さな兵種紋章などの補助図案を保持。盤上キャラクターには使わない |
| `src/ui/app.js` | 既存の進行・設定・戦績・プレビュー・戻す処理を基礎に、KINGDOM表示名・描画初期化・取消・駒選択へ接続 |
| `src/ui/view.js` | DOM盤面描画をCanvasアダプタへ置換。両軍の残存数・強化・最大APを示すバナーと、肖像・名前・HP・行動状態を示す選択カードへ整理。ダイス・AP、履歴、ルール、設定、難易度・結果表示を引き継ぐ |
| `src/ui/fx.js` | 元のイベントと音声をStudioの歩行・攻撃・被弾・押し出しに接続。演出は状態を更新せず、待ち時間に上限を設ける |
| `src/ui/kingdom-facing.js` | 新規。駒ごとの待機方向とUndo用の表示履歴。コア状態を書き換えない |
| `src/ui/kingdom-board.js` | 新規。ルーム、座標変換、初期方向、床層の足元HP、経路・射程、パン、密集時のタップ候補、CPU追従、キャッシュ管理 |
| `src/ui/kingdom-assets.js` | 新規。描画IDと表示名の対応 |
| `index.html`・`styles.css` | 紙色UI、青緑・赤茶のバナー、金色の主ボタン、大きめのダイス・AP・文字、画面領域配分、Canvas盤面、タイトル・設定・結果画面。「部隊」「自軍へ／選択駒へ」とドラッグ説明を盤上から削除 |

入力側では、プレビュー中のEによるターン終了と、密集時の候補パネル・補助メニューから盤面への入力伝播を抑止しています。盤面は `overflow:clip` とし、フォーカス時にブラウザ標準スクロールが描画座標をずらす問題を防ぎます。控えめ演出でも画面外CPUへカメラを移動します。ダイス確定値・演出用出目の乱数呼出は元の進行処理を引き継ぎます。

画面外のユニットも元の状態配列に残り、CPUと合法手判定は全盤面を対象にします。通常ゲームにモックの固定AP、人工配置切替、CPU行動デモは置いていません。検証用コードや局面の使用結果は [TEST_REPORT.md](TEST_REPORT.md) を参照してください。

## 表示サイズ・ダンジョン・キャッシュ

- マスは横75 × 縦42 CSS px、キャラクター倍率1.25。盤全体を画面内に収める自動縮小は行いません。描画面は1300 × 1100論理px、描画DPRは端末値の最大1.5です。
- 床10 × 10、奥2面の壁と松明、手前の低い縁石を採用。`doors: []` として黒い出入口をなくしています。
- 元の `STANDARD_LAYOUT.rocks` の4マスに、既存の `stones` 描画による低い石積みを置きます。床より濃い色で1マスの占有を示し、宝箱や樽は配置していません。
- 足元HPは2〜4個の丸で、失ったHPを中抜きで表示します。公開 `floorOverlay` でHPと陣営の印を描いた後に全キャラクターを描くため、後ろの駒のHPが手前のキャラクターの頭・胴に重なることを防ぎます。下部の選択カードでも現在HPと最大HPを確認できます。
- 公開 `setCamera({ scale: .5, centerX: 5, centerY: 5 })` と `setRoom()` で初期化します。`setCamera()` が背景・小物を再生成する実装であるため、パン時はCanvas全体のCSS平行移動を使います。床・駒・HP・範囲を同じ面で描き、入力は平行移動を逆変換して公開 `screenToWorld()` に渡します。
- 8種類の `prepareCaches()` を初期ローディング中に順番に呼びます。通常のドラッグ・リサイズ・メニュー開閉で全フレーム生成を繰り返しません。リサイズは中心位置を維持します。
- カメラの中心を盤外の小さな余白までに制限し、四隅を選びやすい位置までドラッグできます。自軍選択では強制移動せず、画面外のCPU行動に対して追従します。「部隊」「自軍へ／選択駒へ」はユーザー指定により廃止し、盤上はミニマップと必要時の候補選択を残しています。

## 原本保持の確認

記録時点で `git -C dice-tactics status --short` は作業前と同じ `?? .claude/` のみ、Studioの状態は空でした。既存の `.claude/` は触っていません。`mockup/docs/source-manifest.json` に記録された既存コピー39ファイルも、現在のSHA-256と全件一致しました。モック本体を変更する処理は行っていません。

`source-manifest.json` は記録時点のスナップショットです。新ゲーム側のファイルを修正した際は、対応する `copySHA256` / `ownFiles` と記録日時を更新します。原本の期待値・CPU照合データは更新しません。
