import {CAMERA_SCALE, CHARACTER_SCALE} from '../src/ui/kingdom-display.js';
import {characters} from '../vendor/inkstone/characters/register.js';
import {createFrameCacheStore,drawCachedFrame} from '../vendor/inkstone/src/rendering/cache.js';
import {isolateDrawing} from '../vendor/inkstone/src/core/settings.js';
import {createRenderer} from '../vendor/inkstone/src/rendering/renderer.js';
import {loadCharacterAtlases} from '../src/ui/kingdom-atlas.js';
const params=new URLSearchParams(location.search);
const draw={lw:1,boil:true,footGround:true,linearStance:true},report=document.getElementById('report');
const wait=()=>new Promise(resolve=>setTimeout(resolve,20));
document.getElementById('run').onclick=async()=>{
 const button=document.getElementById('run');button.disabled=true;
 const result={started:new Date().toISOString(),results:[],note:'PCブラウザで2解像度の全コマを照合。スマートフォン実機ではない。'};
 try{
  const manifest=await(await fetch('../assets/characters/manifest.json')).json();
  for(const dpr of [1,1.5].filter(d=>!params.has('dpr')||d===Number(params.get('dpr'))))for(const def of characters.filter(d=>!params.has('character')||d.id===params.get('character'))){
   report.textContent=`照合中: ${def.id}, DPR ${dpr}`;await wait();
   const m=manifest.variants[dpr].characters[def.id],image=new Image();image.src=new URL('../assets/characters/'+m.file,import.meta.url);await image.decode();
   const original=createFrameCacheStore(),baked=createFrameCacheStore();
   const e=isolateDrawing(draw,()=>original.get(def,m.k,draw));baked.installAtlas(def,m.k,draw,m,image);const a=baked.get(def,m.k,draw);
   const c=document.createElement('canvas');c.width=m.frameWidth;c.height=m.frameHeight;const g=c.getContext('2d',{willReadFrequently:true});
   let frames=0,maxPremultipliedDiff=0,differingPixels=0,over2=0,worst=null;
   for(const key of Object.keys(e.frames))for(let i=0;i<e.frames[key].length;i++){
    g.clearRect(0,0,c.width,c.height);drawCachedFrame(g,e.frames[key][i],0,0);const old=g.getImageData(0,0,c.width,c.height).data;
    g.clearRect(0,0,c.width,c.height);drawCachedFrame(g,a.frames[key][i],0,0);const now=g.getImageData(0,0,c.width,c.height).data;
    for(let p=0;p<old.length;p+=4){
     let diff=Math.abs(old[p+3]-now[p+3]);for(let rgb=0;rgb<3;rgb++)diff=Math.max(diff,Math.abs(old[p+rgb]*old[p+3]-now[p+rgb]*now[p+3])/255);
     if(diff>0)differingPixels++;if(diff>2)over2++;if(diff>maxPremultipliedDiff)worst={key,frame:i,x:(p/4)%c.width,y:Math.floor(p/4/c.width),old:[...old.slice(p,p+4)],now:[...now.slice(p,p+4)]};maxPremultipliedDiff=Math.max(maxPremultipliedDiff,diff);
    }frames++;
   }
   if(worst)worst.raw=[...e.frames[worst.key][worst.frame].getContext('2d').getImageData(worst.x,worst.y,1,1).data];
   // Canvasのpremultiplied RGBAと画像のRGBA往復による8bit丸めを許容。2を超える画素は不合格。
   const pass=maxPremultipliedDiff<=2&&over2===0&&baked.pauses.length===0;
   result.results.push({id:def.id,dpr,frames,maxPremultipliedDiff,differingPixels,over2,worst,pass});
   original.dispose();baked.dispose();c.width=c.height=0;
  }
  const renderer=createRenderer({canvas:document.getElementById('canvas'),width:100,height:100,dpr:1,characters,mode:'cached',characterScale:CHARACTER_SCALE});renderer.setCamera({scale:CAMERA_SCALE});
  const loaded=await loadCharacterAtlases(renderer,characters);
  result.results.push({name:'本番ローダー: 8種類を同期生成なしで登録',pass:loaded.mode==='atlas'&&renderer.getDiagnostics().syncPauses.length===0&&renderer.getDiagnostics().caches.totalFrames===1648,loaded});renderer.dispose();
  const fallback=createRenderer({canvas:document.getElementById('canvas'),width:100,height:100,dpr:1,characters,mode:'cached',characterScale:CHARACTER_SCALE});fallback.setCamera({scale:CAMERA_SCALE});
  const recovered=await loadCharacterAtlases(fallback,[characters[0]],()=>{},{manifestURL:new URL('fixtures/invalid-atlas.json',import.meta.url)});
  result.results.push({name:'画像情報不正時は旧描画へ復帰',pass:recovered.mode==='fallback'&&fallback.getDiagnostics().caches.characters.king.source==='generated',recovered});fallback.dispose();
 }catch(e){result.results.push({pass:false,error:e.stack});}
 result.finished=new Date().toISOString();result.passed=result.results.filter(r=>r.pass).length;result.failed=result.results.filter(r=>!r.pass).length;
 report.textContent=JSON.stringify(result,null,2);button.disabled=false;
};
