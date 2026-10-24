# Inkstone ゲーム用キット

選択: king, warrior, archer, mage, demon-king, goblin, skeleton-archer, dark-mage

このフォルダだけで動作します。元のStudioは不要です。Node.js 18以上で次を実行してください。

```sh
node tools/serve.mjs 8091
```

http://127.0.0.1:8091/ を開きます。file:// では起動できません。ゲームへは src/ と characters/ を相対位置を保ってコピーしてください。main.js は部屋・登録・Live/Cachedの最小例です。

共通 src/ は未改変で全体を含み、内蔵3体のソースも静的依存として残ります。登録するのは選択したキャラクターだけです。未選択の追加キャラクターやStudio UIは含みません。

```js
import { createRenderer } from './src/index.js';
import { registerCharacters } from './characters/register.js';
const renderer = createRenderer({ canvas, characters: [], mode: 'live' });
registerCharacters(renderer);
renderer.setMode('cached');
// 自分のゲームループで renderer.render({ units, timeSeconds }) を呼びます。
```

キャッシュは表示倍率ごとに同期生成されます。終了時は renderer.dispose() を呼んでください。ライブラリ更新時はsrc/全体を同じ版で置き換え、登録・描画・範囲・遮蔽を再確認してください。個別ファイルの混在は避けてください。
