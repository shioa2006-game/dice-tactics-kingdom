import { createRenderer } from './src/index.js';
import { characters, registerCharacters } from './characters/register.js';
const $=id=>document.getElementById(id), canvas=$('scene');
const renderer=createRenderer({canvas,width:1000,height:620,dpr:1,characters:[],room:{id:'portable-kit',width:6,depth:6,doors:[{wall:'left',at:2.5}],objects:[{type:'column',cell:[1,1]},{type:'chest',cell:[4,1]}]},xray:false});
registerCharacters(renderer);renderer.fitToRoom({margin:22,maxScale:1});
for(const def of characters){const option=document.createElement('option');option.value=def.id;option.textContent=def.label||def.id;$('character').append(option);}
let def=characters[0],time=0,last=null;
function select(){def=characters.find(c=>c.id===$('character').value);time=0;$('action').replaceChildren();for(const action of Object.keys(def.actions)){const o=document.createElement('option');o.value=action;o.textContent=action;$('action').append(o);}$('direction-label').hidden=def.directional===false;renderer.disposeCaches();}
$('character').onchange=select;$('action').onchange=()=>time=0;$('mode').onchange=()=>{renderer.setMode($('mode').value);if($('mode').value==='live')renderer.disposeCaches();};select();
function tick(now){time+=last===null||document.hidden?0:Math.min(.05,(now-last)/1000);last=now;const info=renderer.render({timeSeconds:time,units:[{id:'selected',character:def.id,x:3.5,y:3.5,direction:$('direction').value,action:$('action').value,actionTime:time}]});$('status').textContent='描画中: '+def.id+' / '+$('action').value+' / '+$('mode').value+' / 警告 '+info.warnings.length;if(document.querySelector('details').open)$('diagnostics').textContent=JSON.stringify(renderer.getDiagnostics(),null,2);requestAnimationFrame(tick);}requestAnimationFrame(tick);
window.addEventListener('pagehide',event=>{if(!event.persisted)renderer.dispose();});
