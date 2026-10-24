# 元ゲームの機能棚卸しと移植先

2026-10-24。`dice-tactics/README.md`・`RULES.md`・`src/core/`・`src/ui/`・`index.html` の実装を確認して作成。ゲーム機能は既存コントローラーを引き継ぎ、盤面だけを Studio 描画へ接続する。原本フォルダは編集しない。

確認種別を分けて記録する。**コア照合**は Node.js、**合成UI**はブラウザ内の DOM/PointerEvent を使った回帰試験、**実操作**はブラウザをマウス・キーで操作した確認。合成UIは人工配置・固定出目を含み、実機タッチではない。3サイズ各65項目と通常対局5項目の結果、画像、制限は [TEST_REPORT.md](TEST_REPORT.md) に記載する。

| 元ゲームの機能 | KINGDOM の移植先 | 確認方法・状態 |
|---|---|---|
| タイトル、難易度 ROOKIE / EASY / NORMAL / HARD、★と説明 | `index.html`、`src/ui/view.js`、`app.js` | 4難易度からの開始を合成UIで確認。タイトル→開始は実操作も確認 |
| 先手：あなた / CPU / ランダム | `app.js:newGame`、タイトルの先手選択 | 両先手のコア照合、3選択からの開始を合成UIで確認。ランダムの長期分布は未確認 |
| 初回は ROOKIE、旧保存で難易度未設定なら HARD | `app.js:loadSettings` | 保存データ別の起動確認：未実施 |
| 難易度別の勝敗・引分記録、3勝かつ勝越時の上位難易度案内 | `app.js:recordResult/renderTitle`、`view.js` | 元の保存処理を継承。試験の戦績は終了後に復元。全難易度の記録再読込・3勝案内は未確認 |
| EASY の性格を対局中保持し、結果画面で公開 | `app.js:newGame/recordResult`、既存 `core/levels.js` | CPU の性格別コア照合合格。両性格それぞれの結果案内は未確認 |
| ROOKIE 最初3ラウンドのヒント | `app.js:rookieTip`、`view.js` | 初回情報行を実画面で表示。3ラウンド分の文言切替は未確認 |
| ダイス3個、基本1AP、0を含む各目の等確率 | 原本コピー `src/core/dice.js/rules.js/rng.js` | 原本56テスト合格。新旧固定乱数照合合格 |
| 味方喪失でダイス段階0〜3、最大AP7〜10、強化通知 | `core/dice.js/rules.js`、`app.js:announceDiceUp`、`view.js` | 原本・新旧コア合格。合成UIで一般兵撃破→強化通知、通常対局でも両軍の喪失後進行を確認 |
| 出目、残AP、最大AP、強化段階、残存ユニット | `view.js:renderStatus/renderTray` | 通常ダイス→AP、移動/攻撃後の state を合成UIで照合。上部/下部の表示を実画面で確認 |
| 移動、攻撃、フラグ、AP消費、ターン交代 | 原本コピー `core/rules.js`、`app.js` | 原本・新旧コア合格。合成UIと通常39手番の通し試験でも結果を照合 |
| 移動範囲・経路・必要AP・移動後攻撃・AP不足 | `app.js:movePreview/computeHints`、`kingdom-board.js`、`view.js` | 移動プレビューと確定後のマス/APを合成UI・実操作で確認。移動後攻撃/AP不足の全表示分岐は未確認 |
| 攻撃可能対象・必要AP・ダメージ・撃破予告 | `app.js:attackPreview`、`kingdom-board.js`、`view.js` | 弓4マス・近接王撃破を実操作でプレビュー→確定。合成UIでも対象・HP/APをコアと照合 |
| 弓は直線2〜4、押し出し先と不可理由（端/岩/駒） | `core/rules.js`、`app.js:attackPreview`、`kingdom-board.js` | コア照合合格。合成UIで成功/不可3種の予測と結果、実操作で4マス射撃・盤端不可を確認 |
| 岩・ユニットの射線遮断、魔法の岩越し | `core/rules.js`、`kingdom-board.js` | コア照合合格。合成UIで岩遮蔽の弓拒否、岩越し魔法のプレビュー・HP/AP結果を確認 |
| 駒選択、明示的な移動モード、床優先の移動先プレビュー | `app.js:startMove/onCell/confirmPreview`、`kingdom-board.js` | タッチ・マウス双方で身体に重なる床の選択、半透明、占有不可、確定・取消をブラウザ検証 |
| 確定・取消、移動の再タップ確定設定 | `app.js`、`view.js` | ユーザー指定の安全なプレビュー方式へ変更。設定ONでも初回タップは必ずプレビュー。OFFはボタン/Enterのみで確定 |
| 攻撃前の移動を戻す。攻撃後は戻せない | `app.js:undoMove/act` | コアの保存 state 復元合格。実操作・合成UIでZから位置/AP/フラグを復元。攻撃後の戻すUIは未確認 |
| APと行動が残るときのターン終了2段階確認 | `app.js:requestEndTurn` | Eの1回目保留・2回目CPUへ交代を実操作・合成UIで確認。確認待ちタイムアウトは未確認 |
| CPU 4難易度・EASY性格・前ターン位置の往復抑制 | 原本コピー `core/ai.js/levels.js`、`ui/cpu.js/cpu-worker.js` | 原本56テスト合格。固定乱数の新旧対局照合合格 |
| CPU 思考を Worker 実行、不使用時はメインスレッド | 原本コピー `ui/cpu.js/cpu-worker.js` | 実WorkerのCPU手番・自軍復帰と通常対局完走を確認。Worker非対応時の代替経路は未確認 |
| CPU行動を順番に再生、行動対象・狙いを表示 | `app.js:cpuTurn/cpuIntent`、`kingdom-board.js`、`fx.js` | 実Worker行動を実操作で確認。合成UIで画面外追従・合法行動順の再生を確認 |
| CPU直前経路はプレイヤーが振るまで残す | `app.js:trails/humanRoll`、`kingdom-board.js` | 合成UIでCPU移動経路の保持を確認、実操作でCPU後の履歴・自軍へ戻るを確認。出目確定時の経路消去は独立検査なし |
| 敵選択：最大APで移動前攻撃可能位置、味方への最小必要AP | `app.js:inspectThreat/attackCosts`、`kingdom-board.js` | 敵の選択は合成UIで確認。最小AP・範囲の表示値を個別に照合する操作は未確認 |
| 敵の射程：平均的APで狙える味方・王への最小AP | `app.js:threatened/leaderDanger`、`kingdom-board.js` | 元処理継承・凡例をコード確認。射程切替の内容を検査する実操作は未確認 |
| 王撃破で勝利/敗北、40ラウンド終了で引分 | 原本コピー `core/rules.js`、`app.js:finish` | 原本・新旧コア合格。合成UIで勝利/敗北/引分画面。実操作で人工王撃破、通常配置の通し試験でも勝利 |
| 結果統計：ターン数、平均/最大/使用AP、攻撃/撃破/押出回数 | `app.js:newStats/logEvents`、`view.js:showResult` | 通常39手番の結果画面・統計を記録。全統計欄を履歴から独立に再集計する照合は未実施 |
| 再戦、結果から盤面を見る、タイトルへ戻る | `app.js:newGame/goTitle`、`view.js` | 合成UIで全遷移。通常対局完了後も結果→12体初期状態の再戦→タイトルを確認 |
| 対局途中にタイトルへ戻るときの2段階確認 | `app.js:onNewGame/disarmNew` | 実操作で1回目は確認表示に留まり、確認時間を超えると再度確認が必要。時間内の再クリックでタイトルへ戻ることを確認 |
| 行動履歴、ルール、設定シート、Esc/背景で閉じる | `app.js`、`view.js:openSheet/closeSheets/renderRules` | 実操作で履歴・設定、合成UIで開閉/ルール/設定中の盤面入力遮断/Escを確認。背景タップ閉じは未確認 |
| CPU再生速度 slow/normal/fast、控えめ演出、OS reduced-motion | `app.js`、`fx.js`、設定UI | slow/fast・控えめ設定の保存を合成UIで確認。実操作でfast設定。通常通し試験はfast/控えめ。OS設定切替と全速度の比較は未確認 |
| キー：Space/Enter/E/Z/1〜6/Esc、タイトル1〜4 | `app.js:onKey` | Space/2/Enter/Z/E・タイトル1〜4を実操作、1/Escと演出中のEnter連打抑止を合成UIで確認。自軍選択3〜6・キーrepeatは未確認 |
| 効果音・BGM・音量・全体消音・保存 | 原本コピー `ui/audio/`、`app.js:applyAudio` | 実操作でBGMオン・効果音音量80→75、合成UIで効果音オフ/消音保存。AudioContext稼働・BGM生成/再生API状態確認。実聴は未確認 |
| ダイス/選択/プレビュー/無効/移動/剣/弓/魔法/命中/押出/不可/撃破/強化/勝敗の音 | `audio/sfx.js`、`fx.js`、`app.js` | 既存音源・イベント接続をコード確認し、対応行動をブラウザで実行。音ごとの波形検査・実聴は未確認 |
| 背景タブで演出を止めず復帰、ゲーム変更で古い再生取消 | `app.js:game.id`、`fx.js`、`audio/engine.js` | 合成UIでblur・確定連打・CPU中のタイトル復帰による旧進行取消に合格。実際の背景タブ移行は環境上再現できず未確認 |
| 12体・4障害物・正規初期配置は全画面外も保持 | 原本コピー `core/config.js`、`kingdom-board.js` | コア照合合格。3サイズの合成UIで12体/8定義、足元座標、四隅・密集同職2体・岩背後の選択を確認。初期/密集/射程を実画面で目視 |

## KINGDOM 側の表示追加

`kingdom-board.js` は Studio の8定義、方向別描画、既存待機/歩行/攻撃、固定サイズの盤面、パン、ミニマップを担当する。ユーザーの追加指定により「部隊」「自軍へ／選択駒へ」を撤去した。初期と各駒の行動終了時は敵の王を向く。待機中は敵王が移動しても向きを保持し、移動を戻すと以前の向きを復元する。足元HPは空を含む2〜4個の丸を床層へ描き、手前のキャラクターに重ねない。名前・小肖像・現在/最大HPは下部選択カード、残存数・強化・最大APは上部バナーに整理した。判定は上表の既存コアを使う。

UI調整後は360×800・390×844・430×932で各69項目の回帰試験に合格。上表の初回検証で記載した「自軍へ」の操作は旧UIの履歴であり、現行UIには存在しない。現行の四隅選択はパンと駒タップで確認している。

通常ゲームには、モックの固定AP・人工局面切替・CPUデモを置かない。旧 `mockup/` は整理時に削除済み。人工局面の回帰検証は `/?qa=1`、過去の確認画像は `screenshots/` に残す。
