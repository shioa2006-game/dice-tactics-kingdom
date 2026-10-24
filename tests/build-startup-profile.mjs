// 通常画面と同じHTMLを使う計測入口を生成。本番index.htmlは変更しない。
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const html=fs.readFileSync(new URL('index.html',root),'utf8')
  .replace('<head>','<head>\n  <base href="/">')
  .replace('src="src/ui/app.js"','src="tests/startup-profile.js"');
fs.writeFileSync(new URL('tests/startup-profile.html',root),html);
console.log('計測入口: /tests/startup-profile.html （通常app.jsを計測。ゲーム処理の変更なし）');
