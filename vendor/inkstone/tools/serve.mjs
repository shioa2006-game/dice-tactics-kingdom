// Inkstone — ローカル確認用の静的ファイルサーバー (依存なし・Node.js 18 以上)
//   ES Modules は file:// では読み込めないため、サンプルとテストは HTTP で開く。
//   使い方: node tools/serve.mjs [ポート (既定 8080)]   → http://localhost:8080/
//   外部への通信はしない。127.0.0.1 だけで待ち受ける。
import { createServer } from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const realRoot = await realpath(ROOT);
const rootId = createHash('sha256').update(process.platform === 'win32' ? realRoot.toLowerCase() : realRoot).digest('hex');
const PORT = Number(process.argv[2] || process.env.PORT || 8080);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };

const server = createServer(async (req, res) => {
  // Copied studios can have identical HTML. Identify the actual serving folder.
  res.setHeader('x-inkstone-root', rootId);
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.resolve(ROOT, '.' + p);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    let s = await stat(file).catch(() => null);
    if (s && s.isDirectory()) {
      const idx = path.join(file, 'index.html');
      if (await stat(idx).catch(() => null)) { file = idx; s = await stat(file); }
      else {   // 簡単な一覧
        const { readdir } = await import('node:fs/promises');
        const names = (await readdir(file, { withFileTypes: true })).map(d => d.name + (d.isDirectory() ? '/' : ''));
        res.writeHead(200, { 'content-type': TYPES['.html'] });
        res.end(`<!doctype html><meta charset="utf-8"><title>${p}</title><h1>${p}</h1><ul>${names.map(n => `<li><a href="${encodeURI(n)}">${n}</a></li>`).join('')}</ul>`);
        return;
      }
    }
    if (!s) { res.writeHead(404, { 'content-type': TYPES['.txt'] }).end('not found: ' + p); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch (e) { res.writeHead(500).end(String(e)); }
});
server.on('error', error => {
  if (process.send && error.code === 'EADDRINUSE') process.send({ type: 'busy' });
  else console.error(error.message);
  process.exitCode = 1;
  if (process.connected) process.disconnect();
});
server.listen(PORT, '127.0.0.1', () => {
  const port = server.address().port;
  console.log(`Inkstone: http://localhost:${port}/`);
  if (process.send) process.send({ type: 'ready', port });
});
