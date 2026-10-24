import {characters} from '../vendor/inkstone/characters/register.js';
import {createFrameCacheStore} from '../vendor/inkstone/src/rendering/cache.js';
import {isolateDrawing} from '../vendor/inkstone/src/core/settings.js';
import {DIR_ORDER} from '../vendor/inkstone/src/characters/rig.js';
const draw={lw:1,boil:true,footGround:true,linearStance:true};
const button=document.getElementById('build'),report=document.getElementById('report');
const sleep=()=>new Promise(resolve=>setTimeout(resolve,20));
async function post(route,data){const r=await fetch(route,{method:'POST',headers:{'Content-Type':'application/json','X-Atlas-Token':document.querySelector('meta[name=build-token]').content},body:JSON.stringify(data)});if(!r.ok)throw Error(await r.text());return r.json();}
button.onclick=async()=>{
 button.disabled=true;const results=[],start=performance.now();
 try{
  for(const dpr of [1,1.5])for(const def of characters){
   report.textContent=`生成中 ${results.length+1}/16: ${def.id} DPR ${dpr}`;await sleep();
   const store=createFrameCacheStore(),k=.625*dpr;
   const e=isolateDrawing(draw,()=>store.get(def,k,draw));
   const columns=16,rows=Math.ceil(e.count/columns),canvas=document.createElement('canvas');
   canvas.width=e.frameW*columns;canvas.height=e.frameH*rows;
   const ctx=canvas.getContext('2d'),directions=def.directional===false?['']:DIR_ORDER;let index=0;
   const actions={};
   for(const [action,spec] of Object.entries(def.actions)){
    actions[action]={period:spec.period,keys:e.keys[action],index:spec.index||'keys'};
    for(const direction of directions)for(const frame of e.frames[direction+action]){
     // 原画の画素を直接転記。GPU間drawImageの再ラスタライズで細い輪郭が変わるのを防ぐ。
     ctx.putImageData(frame.getContext('2d').getImageData(0,0,e.frameW,e.frameH),index%columns*e.frameW,Math.floor(index/columns)*e.frameH);index++;
    }
   }
   const meta={id:def.id,k,draw,frameBox:def.frameBox,frameWidth:e.frameW,frameHeight:e.frameH,columns,rows,directions,actions,frameCount:e.count};
   const saved=await post('/__atlas/save',{dpr,meta,png:canvas.toDataURL('image/png')});
   results.push({id:def.id,dpr,frames:e.count,...saved});store.dispose();canvas.width=canvas.height=0;
  }
  const saved=await post('/__atlas/finish',{});
  report.textContent=JSON.stringify({...saved,elapsedMs:performance.now()-start,results},null,2);
 }catch(e){report.textContent=JSON.stringify({error:e.stack,results},null,2);}
 finally{button.disabled=false;}
};
