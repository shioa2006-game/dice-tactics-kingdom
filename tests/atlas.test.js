import {FRAME_SCALE} from '../src/ui/kingdom-display.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {atlasSource,root} from '../tools/atlas-source.mjs';
import {characters} from '../vendor/inkstone/characters/register.js';
import {createFrameCacheStore,drawCachedFrame,validateAtlas} from '../vendor/inkstone/src/rendering/cache.js';
import {atlasDpr} from '../src/ui/kingdom-atlas.js';
const manifest=JSON.parse(await fs.readFile(new URL('assets/characters/manifest.json',root)));
const draw={lw:1,boil:true,footGround:true,linearStance:true};
test('事前生成画像の出典が現在のStudio描画コードと一致する',async()=>assert.deepEqual(manifest.source,await atlasSource()));
test('16画像のSHA-256・全方向・全コマ・動作周期・足元原点を保持する',async()=>{
 for(const dpr of [1,1.5]){
  const variant=manifest.variants[dpr];assert.equal(variant.k,FRAME_SCALE*dpr);assert.equal(Object.keys(variant.characters).length,8);let count=0;
  for(const def of characters){
   const m=variant.characters[def.id],bytes=await fs.readFile(new URL('assets/characters/'+m.file,root));
   assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),m.sha256);assert.equal(bytes.length,m.bytes);
   validateAtlas(def,variant.k,draw,m,{width:m.frameWidth*m.columns,height:m.frameHeight*m.rows});count+=m.frameCount;
  }assert.equal(count,1648);
 }
});
test('登録済みアトラスは同期生成せず既存の位相・方向を選ぶ',()=>{
 const def=characters.find(c=>c.id==='warrior'),m=manifest.variants[1].characters[def.id];
 const store=createFrameCacheStore(),image={width:m.frameWidth*m.columns,height:m.frameHeight*m.rows};
 store.installAtlas(def,m.k,draw,m,image);const e=store.get(def,m.k,draw);
 assert.equal(store.pauses.length,0);assert.equal(store.stats().characters.warrior.source,'atlas');
 let offset=0;
 for(const [action,spec] of Object.entries(m.actions)){
  for(const dir of m.directions){
   for(let i=0;i<spec.keys.length;i++){
    const t=(spec.keys[i]+.000001)*spec.period,frame=store.frame(e,dir,action,t),index=offset+i;
    assert.equal(frame.x,index%m.columns*m.frameWidth);assert.equal(frame.y,Math.floor(index/m.columns)*m.frameHeight);
    const calls=[];drawCachedFrame({drawImage:(...args)=>calls.push(args)},frame,17,23);
    assert.deepEqual(calls[0],[image,frame.x,frame.y,frame.width,frame.height,17,23,frame.width,frame.height]);
   }offset+=spec.keys.length;
  }
 }
 store.dispose();assert.equal(store.stats().totalFrames,0);
});
test('不一致の倍率・周期・方向・画像サイズは登録を拒否する',()=>{
 const def=characters[0],m=manifest.variants[1].characters[def.id],image={width:m.frameWidth*m.columns,height:m.frameHeight*m.rows};
 for(const mutate of [m=>m.k=2,m=>m.actions.walk.period+=1,m=>m.directions.reverse(),m=>m.frameBox.y0-=1,m=>m.draw.boil=false]){
  const broken=structuredClone(m);mutate(broken);assert.throws(()=>validateAtlas(def,m.k,draw,broken,image));
 }assert.throws(()=>validateAtlas(def,m.k,draw,m,{...image,width:1}));
});
test('DPRの上限1.5とCSS上の駒サイズを維持する解像度選択',()=>{
 for(const dpr of [0.8,1])assert.equal(atlasDpr(dpr),1);
 for(const dpr of [1.25,1.5,2,3])assert.equal(atlasDpr(dpr),1.5);
});
