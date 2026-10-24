// 依存なしのローカルサーバー。通常起動はルートの KINGDOM。
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.md': 'text/plain; charset=utf-8', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
};
const args = process.argv.slice(2);
const basePort = Number(args.find((v) => /^\d+$/.test(v)) || process.env.PORT || 8150);
if (!Number.isInteger(basePort) || basePort < 1 || basePort > 65535) {
  console.error('ポート番号は 1〜65535 を指定してください。');
  process.exit(1);
}
const server = http.createServer(async (req, res) => {
  try {
    const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replaceAll('\\', '/');
    const file = path.resolve(root, '.' + (route.endsWith('/') ? route + 'index.html' : route));
    const relative = path.relative(root, file);
    // .git などの隠しファイルや、配信ルート外のファイルは公開しない。
    if (relative.startsWith('..') || path.isAbsolute(relative) || route.split('/').some((s) => s.startsWith('.'))) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    if (!(await stat(file)).isFile()) throw new Error('not file');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found'); }
});
let port = basePort;
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && port < Math.min(65535, basePort + 20)) server.listen(++port, '0.0.0.0');
  else { console.error('サーバーを起動できませんでした:', e.message); process.exit(1); }
});
server.on('listening', () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(`DICE TACTICS: KINGDOM\nLocal: ${url}\n終了: Ctrl+C`);
  if (port !== basePort) console.log(`ポート ${basePort} は使用中のため ${port} で起動しました。`);
  for (const nic of Object.values(networkInterfaces()).flat()) {
    if (nic && nic.family === 'IPv4' && !nic.internal) console.log(`同一 LAN: http://${nic.address}:${port}/`);
  }
  if (args.includes('--open') && process.env.BROWSER !== 'none') {
    const command = process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const browserArgs = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    const child = spawn(command, browserArgs, { windowsHide: true, stdio: 'ignore' });
    child.on('error', () => console.log(`ブラウザで ${url} を開いてください。`));
  }
});
server.listen(port, '0.0.0.0');
