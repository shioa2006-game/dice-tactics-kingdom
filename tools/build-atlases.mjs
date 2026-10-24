import {FRAME_SCALE} from '../src/ui/kingdom-display.js';
// localhost専用の生成サーバー。StudioのCanvas描画を可逆圧縮WebPへ保存（--pngも可）。
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import {atlasSource,root} from './atlas-source.mjs';
const rootPath=fileURLToPath(root),out=new URL('assets/characters/',root);
await fs.mkdir(out,{recursive:true});
const token=crypto.randomBytes(24).toString('hex'),source=await atlasSource(),variants={};
const format=process.argv.includes('--png')?'png':'webp';
if(format==='webp'){
 try{execFileSync('python',['-c','from PIL import Image, features; assert features.check("webp"), "Pillow WebP support required"']);}
 catch{console.error('WebP生成には Python + Pillow が必要です: python -m pip install Pillow\nPythonなしで生成する場合: npm run assets:build -- --png');process.exit(1);}
}
function encode(bytes){return new Promise((resolve,reject)=>{
 const child=spawn('python',[fileURLToPath(new URL('tools/encode-atlas.py',root))],{windowsHide:true}),output=[],errors=[];
 child.stdout.on('data',b=>output.push(b));child.stderr.on('data',b=>errors.push(b));child.on('error',reject);
 child.on('close',code=>code===0?resolve(Buffer.concat(output)):reject(Error(Buffer.concat(errors).toString())));child.stdin.on('error',reject);child.stdin.end(bytes);
});}
const ids=['king','warrior','archer','mage','demon-king','goblin','skeleton-archer','dark-mage'];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png','.webp':'image/webp','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');
  if(req.method==='POST'){
   if(req.headers['x-atlas-token']!==token)throw Error('Invalid build token');
   let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>32*1024*1024)throw Error('Payload too large');chunks.push(chunk);}
   const data=JSON.parse(Buffer.concat(chunks));
   if(u.pathname==='/__atlas/save'){
    const {meta,png,dpr}=data;if(!ids.includes(meta.id)||![1,1.5].includes(dpr)||meta.k!==FRAME_SCALE*dpr)throw Error('Invalid atlas');
    if(!png.startsWith('data:image/png;base64,'))throw Error('PNG required');
    let bytes=Buffer.from(png.split(',')[1],'base64');if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Invalid PNG');
    if(format==='webp')bytes=await encode(bytes);
    const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
    const file=`${meta.id}-${dpr}-${sha256.slice(0,16)}.${format}`;
    await fs.writeFile(new URL(file,out),bytes);
    (variants[dpr]??={dpr,k:FRAME_SCALE*dpr,characters:{}}).characters[meta.id]={...meta,file,sha256,bytes:bytes.length};
    res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({file,bytes:bytes.length}));return;
   }
   if(u.pathname==='/__atlas/finish'){
    for(const dpr of [1,1.5])if(ids.some(id=>!variants[dpr]?.characters[id]))throw Error('Incomplete atlas build');
    const manifest={schemaVersion:1,generatedAt:new Date().toISOString(),source,format,variants};
    await fs.writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');
    console.log(`Generated 16 ${format} atlases and assets/characters/manifest.json`);
    res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({complete:true,sourceHash:source.hash}));return;
   }
   throw Error('Unknown build operation');
  }
  if(req.method!=='GET')throw Error('GET required');
  let route=decodeURIComponent(u.pathname);
  if(route==='/'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(`<!doctype html><meta charset="utf-8"><title>KINGDOM アニメーション画像生成</title><meta name="build-token" content="${token}"><h1>アニメーション画像生成</h1><p>Studioの定義から全方向・全動作を生成します。通常ゲームとは別の開発用画面です。</p><button id="build">16枚のアトラスを生成</button><pre id="report">待機中</pre><script type="module" src="/tools/export-atlases.js"></script>`);return;
  }
  const file=path.resolve(rootPath,'.'+route),relative=path.relative(rootPath,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)||route.split('/').some(p=>p.startsWith('.')))throw Error('Forbidden');
  const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
 }catch(e){res.writeHead(400,{'Content-Type':'text/plain'}).end(e.message);}
});
server.listen(8160,'127.0.0.1',()=>{
 const url='http://127.0.0.1:8160/';console.log(`Atlas builder: ${url}\n生成完了後は Ctrl+C で終了`);
 if(!process.argv.includes('--no-open')){
  const command=process.platform==='win32'?'cmd.exe':process.platform==='darwin'?'open':'xdg-open';
  const args=process.platform==='win32'?['/c','start','',url]:[url];
  spawn(command,args,{windowsHide:true,stdio:'ignore'}).on('error',()=>console.log(url));
 }
});
