// KINGDOM の表示アダプタ。状態を読むだけで、AP・HP・合法手を更新しない。
// 座標変換はこのファイルに集約。パンは静的背景ごとCSS移動し、setCameraを呼ばない。
import {createRenderer, createCharacterView} from '../../vendor/inkstone/src/index.js';
import {characters} from '../../vendor/inkstone/characters/register.js';
import {STANDARD_LAYOUT, DIRS, MOVED, ATTACKED, HUMAN, MAGE} from '../core/config.js';
import * as R from '../core/rules.js';
import {CHARACTER_IDS, NAMES} from './kingdom-assets.js';
import {createFacing, directionToward} from './kingdom-facing.js';

const $=id=>document.getElementById(id), W=1300, H=1100, TILE=75, SCALE=1.25;
const defs=Object.fromEntries(characters.map(c=>[c.id,c]));
const xy=c=>({x:c%10+.5,y:Math.floor(c/10)+.5});
const clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
const ease=t=>t*t*(3-2*t);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const room={id:'kingdom-stone-court-v2',width:10,depth:10,wallHeight:1.8,courseHeight:.45,wallThickness:.45,rim:.25,slab:.32,
  floor:{crack:.07,chip:.05,density:.14},doors:[],decor:[],
  torches:[{wall:'left',at:2.1,height:1.4,glow:.65},{wall:'left',at:7.4,height:1.4,glow:.65},{wall:'right',at:3.6,height:1.4,glow:.65},{wall:'right',at:8.1,height:1.4,glow:.65}],
  objects:STANDARD_LAYOUT.rocks.map((cell,i)=>({id:'rock-'+i,type:'stones',cell,label:'岩',
    boxes:[[-.46,.02,-.45,.42,0,.28],[.05,.45,-.42,.44,0,.34],[-.27,.27,-.28,.25,.28,.56]],
    stoneStyle:{top:'#b5b3a8',toneX:'#95988e',toneY:'#a4a69b',density:.5,cracks:false}}))};
let cfg, game, renderer, viewport, onCell, ready=false;
let pan={x:0,y:0}, cameraMotion=null, pointer=null, prevSize={w:0,h:0}, oldState=null, oldId=-1;
let currentUnits=[], labels=[], moves=[], attacks=[], nominal=[], animation=null, generation=0, lastFrame=0;
const pointers=new Set(), overrides=new Map(), portraits=new Map(), timings=[];
// 待機方向は各駒の行動完了時だけ更新。他の駒や王の移動・再描画では変えない。
let facing;
let lastInfo=null, builds=0, cancelWaits=new Set();
let attackReady=new Set();
let previewUnit=null;

export async function init(config, cellHandler){
  cfg=config;facing=createFacing(cfg);onCell=cellHandler;viewport=$('viewport');
  renderer=createRenderer({canvas:$('kingdom-canvas'),width:W,height:H,dpr:Math.min(devicePixelRatio||1,1.5),characterScale:SCALE,footOffset:3,mode:'cached',characters,lineBoil:true,footFix:true,xray:true});
  renderer.setCamera({scale:.5,centerX:5,centerY:5});renderer.setRoom(room);builds++;
  installInput();makePortraits();drawTitle();
  for(let i=0;i<characters.length;i++){
    $('loading-detail').textContent=`キャラクターを準備中 ${i+1} / ${characters.length}`;
    await sleep(12);renderer.prepareCaches([characters[i].id]);
  }
  ready=true;$('loading').hidden=true;centerOn(5.1,7.5);
  new ResizeObserver(()=>{
    const c=prevSize.w?fromViewport(prevSize.w/2,prevSize.h/2):{x:5.1,y:7.5};
    prevSize={w:viewport.clientWidth,h:viewport.clientHeight};centerOn(c.x,c.y);
  }).observe(viewport);
  requestAnimationFrame(frame);
}

export function render(g){
  game=g;
  if(oldState!==g.state){overrides.clear();animation=null;oldState=g.state;}
  if(oldId!==g.id){oldId=g.id;cancelAnimation();facing.reset(g.state);closePanels();if(renderer)centerOn(5.1,7.5);}
  moves=[];attacks=[];nominal=[];
  attackReady=new Set(g.mode==='act'&&!g.busy?cfg.sideUnits[HUMAN].filter(u=>R.attackOptions(g.state,u).length):[]);
  if(g.mode==='act'&&!g.busy&&g.sel>=0&&cfg.unitSide[g.sel]===HUMAN){if(g.moveMode)moves=R.moveOptions(g.state,g.sel);else attacks=R.attackOptions(g.state,g.sel);}
  if(g.sel>=0&&!g.moveMode&&g.state.pos[g.sel]>=0){
    const p=xy(g.state.pos[g.sel]),t=cfg.types[cfg.unitType[g.sel]];
    for(const [dx,dy] of DIRS)for(let d=t.minRange;d<=t.maxRange;d++){
      const x=Math.floor(p.x)+dx*d,y=Math.floor(p.y)+dy*d;
      if(x>=0&&y>=0&&x<10&&y<10)nominal.push(y*10+x);
    }
  }
  drawMinimap();
  viewport?.setAttribute('aria-label',`戦術盤面、ドラッグで移動。${g.sel>=0?NAMES[g.sel]+' 選択中。':''}${g.moveMode?'移動モード。床をタップして移動先をプレビューし、ここへ移動で確定。':'駒をタップして選択。重なった駒は候補から選べます。'}`);
}

export function toViewport(x,y){const p=renderer.worldToScreen(x,y);return{x:p.x+pan.x,y:p.y+pan.y};}
export function fromViewport(x,y){return renderer.screenToWorld(x-pan.x,y-pan.y);}
function centerWorld(){return fromViewport(viewport.clientWidth/2,viewport.clientHeight/2);}
function panFor(x,y){const p=renderer.worldToScreen(x,y);return{x:viewport.clientWidth/2-p.x,y:viewport.clientHeight/2-p.y};}
function transform(){
  const c=centerWorld();pan=panFor(clamp(c.x,-.45,10.45),clamp(c.y,-.45,10.45));
  $('world').style.transform=`translate3d(${pan.x}px,${pan.y}px,0)`;drawMinimap();
}
export function centerOn(x,y,animated=false){
  if(!renderer)return;const to=panFor(x,y);
  if(animated&&!document.hidden&&!document.body.classList.contains('calm')&&!matchMedia('(prefers-reduced-motion: reduce)').matches)cameraMotion={from:{...pan},to,start:performance.now(),duration:380};
  else{cameraMotion=null;pan=to;transform();}
}
export function closePanels(){if($('chooser'))$('chooser').hidden=true;}
export function panelOpen(){return !!$('chooser')&&!$('chooser').hidden;}
function inputAllowed(){return ready&&game&&!game.busy&&!['cpu','title'].includes(game.mode)&&$('sheet-back').hidden&&$('result').hidden;}
function chooseUnit(u){closePanels();if(!inputAllowed()||game.state.pos[u]<0)return;onCell(game.state.pos[u]);}
function tap(x,y){
  if(!inputAllowed())return;if(panelOpen()){closePanels();return;}
  if(game.moveMode){
    const p=fromViewport(x,y),cx=Math.floor(p.x),cy=Math.floor(p.y);
    if(cx>=0&&cy>=0&&cx<10&&cy<10)onCell(cy*10+cx);
    return;
  }
  const sx=x-pan.x,sy=y-pan.y;
  const bodies=currentUnits.filter(u=>{const q=renderer.worldToScreen(u.x,u.y);return Math.abs(sx-q.x)<18&&sy>q.y-57&&sy<q.y+4;});
  const hp=labels.findLast(l=>sx>=l.x&&sx<=l.x+l.w&&sy>=l.y&&sy<=l.y+l.h);
  if(hp){
    // 奥のHPは手前のキャラクターに隠れる。入力も同じ前後関係に揃える。
    const owner=currentUnits.find(u=>+u.id===hp.u),front=bodies.filter(u=>u.x+u.y>owner.x+owner.y+.1).map(u=>+u.id);
    if(front.length>1)showCandidates(front);else chooseUnit(front.length?front[0]:hp.u);return;
  }
  const p=fromViewport(x,y),cx=Math.floor(p.x),cy=Math.floor(p.y),c=cy*10+cx,inside=cx>=0&&cy>=0&&cx<10&&cy<10;
  const ids=bodies.map(u=>+u.id);
  const occupant=inside?R.unitAt(game.state,c):-1;
  if(occupant>=0&&!ids.includes(occupant))ids.push(occupant);
  if(ids.length>1){showCandidates(ids);return;}
  if(ids.length){chooseUnit(ids[0]);return;}
  if(inside)onCell(c);
}
function showCandidates(ids){
  const box=$('chooser-options');box.replaceChildren();
  for(const u of ids){const b=document.createElement('button');b.dataset.unit=u;b.textContent=`${NAMES[u]} · ${R.cellName(game.state.pos[u],cfg)} · HP ${game.state.hp[u]}`;b.onclick=()=>chooseUnit(u);box.append(b);}
  $('chooser').hidden=false;
}
export const portrait=u=>portraits.get(CHARACTER_IDS[u]);
function installInput(){
  viewport.addEventListener('contextmenu',e=>e.preventDefault());
  viewport.addEventListener('pointerdown',e=>{
    if(e.target.closest('button,#chooser')||!ready||e.button!==0)return;
    pointers.add(e.pointerId);if(pointers.size>1){if(pointer)pointer.canceled=true;return;}
    cameraMotion=null;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,pan:{...pan},drag:false,canceled:!e.isPrimary};
    viewport.focus({preventScroll:true});try{viewport.setPointerCapture(e.pointerId);}catch{}
  });
  viewport.addEventListener('pointermove',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
    if(Math.hypot(dx,dy)>8)pointer.drag=true;
    const b=viewport.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)pointer.canceled=true;
    if(pointer.drag){pan={x:pointer.pan.x+dx,y:pointer.pan.y+dy};transform();viewport.classList.add('dragging');}
  });
  const finish=(e,cancel=false)=>{
    pointers.delete(e.pointerId);if(!pointer||pointer.id!==e.pointerId)return;
    const p=pointer;pointer=null;viewport.classList.remove('dragging');
    try{if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);}catch{}
    const b=viewport.getBoundingClientRect();
    if(!cancel&&!p.canceled&&!p.drag&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<=8&&e.clientX>=b.left&&e.clientX<=b.right&&e.clientY>=b.top&&e.clientY<=b.bottom)tap(e.clientX-b.left,e.clientY-b.top);
  };
  viewport.addEventListener('pointerup',e=>finish(e));viewport.addEventListener('pointercancel',e=>finish(e,true));viewport.addEventListener('lostpointercapture',e=>finish(e,true));
  const abort=()=>{pointer=null;pointers.clear();viewport.classList.remove('dragging');};
  window.addEventListener('blur',abort);document.addEventListener('visibilitychange',abort);
  viewport.addEventListener('wheel',e=>{if(!ready||e.target.closest('button,#chooser'))return;e.preventDefault();cameraMotion=null;pan.x-=e.deltaX;pan.y-=e.deltaY;transform();},{passive:false});
  $('btn-chooser-close').onclick=closePanels;
  window.addEventListener('keydown',e=>{if(e.key==='Escape')closePanels();});
}

// イベントの表示専用上書き。ゲーム側が確定したstateを渡すと全て破棄する。
export function beginEvents(){overrides.clear();animation=null;}
// 演出を省略・中断した場合も、コントローラーが確定する行動と同じタイミングで更新する。
export function completeAction(before,after,action,events){facing.complete(before,after,action,events);}
export function restoreFacing(state){facing.restore(state);}
export function cancelAnimation(){generation++;animation=null;cameraMotion=null;overrides.clear();for(const done of cancelWaits)done();cancelWaits.clear();}
function boundedWait(ms){return new Promise(resolve=>{let timer;const done=()=>{clearTimeout(timer);cancelWaits.delete(done);resolve();};timer=setTimeout(done,ms);cancelWaits.add(done);});}
export async function followEvents(events,{still=false}={}){
  if(!game||game.mode!=='cpu')return;
  const e=events.find(v=>v.type==='move'||v.type==='attack');if(!e)return;
  const from=xy(e.from),to=xy(e.to),points=[from,to].map(p=>toViewport(p.x,p.y));
  if(points.some(p=>p.x<50||p.x>viewport.clientWidth-50||p.y<85||p.y>viewport.clientHeight-60)){
    const my=generation;centerOn((from.x+to.x)/2,(from.y+to.y)/2,!still);if(cameraMotion)await boundedWait(400);if(my!==generation)return;
    if(cameraMotion){pan=cameraMotion.to;cameraMotion=null;transform();}
  }
}
export async function animateEvent(e,{duration=250,still=false}={}){
  if(!game)return;const my=generation;
  animation={event:e,start:performance.now(),duration:Math.max(1,duration)};
  if(e.type==='damage')overrides.set(e.unit,{...overrides.get(e.unit),hp:e.hp});
  if(!still)await boundedWait(duration);
  if(my!==generation)return;
  if(e.type==='move'||e.type==='knockback')overrides.set(e.unit,{...overrides.get(e.unit),...xy(e.to)});
  if(e.type==='attack')overrides.set(e.unit,{...overrides.get(e.unit),direction:['NE','SE','SW','NW'][e.dir]});
  if(e.type==='kill')overrides.set(e.unit,{...overrides.get(e.unit),hidden:true});
  animation=null;
}
const direction=(a,b)=>{const p=xy(a),q=xy(b);return q.x>p.x?'SE':q.x<p.x?'NW':q.y>p.y?'SW':'NE';};
function visualFrame(now){
  const units=[],effects=[],projectiles=[];
  for(let u=0;u<12;u++)if(game.state.pos[u]>=0&&!overrides.get(u)?.hidden){
    units.push({id:String(u),character:CHARACTER_IDS[u],...xy(game.state.pos[u]),direction:facing.get(u),opacity:(game.moveMode&&u!==game.sel) ? .28 : 1,action:'idle',actionTime:document.body.classList.contains('calm')?0:now/1000+u*.17,...overrides.get(u)});
  }
  if(animation){
    const {event:e,start,duration}=animation,t=clamp((now-start)/duration,0,1),actor=units.find(u=>+u.id===e.unit);
    if(actor&&(e.type==='move'||e.type==='knockback')){
      const path=e.path||[e.to],f=t*path.length,i=Math.min(Math.floor(f),path.length-1),prev=i?path[i-1]:e.from,next=path[i],p=xy(prev),q=xy(next),a=f-i;
      Object.assign(actor,{x:p.x+(q.x-p.x)*a,y:p.y+(q.y-p.y)*a,direction:direction(prev,next),action:e.type==='move'?'walk':'idle',actionTime:f*renderer.walkSecondsPerTile});
    }else if(actor&&e.type==='attack'){
      actor.direction=['NE','SE','SW','NW'][e.dir];
      const def=defs[actor.character],release=def.actions.attack.releaseAt??.55,phase=Math.min(t/0.88,1);
      actor.action='attack';actor.actionTime=Math.min(phase*def.actions.attack.period,def.actions.attack.period-.001);
      if(def.projectile&&phase>=release&&t<1)projectiles.push({character:actor.character,x:actor.x,y:actor.y,direction:actor.direction,distance:e.dist*clamp((t-release*.88)/(1-release*.88),0,1)});
    }else if(actor&&e.type==='damage'){
      actor.shakeX=Math.sin(t*32)*6*(1-t);effects.push({type:'hitSpark',x:actor.x,y:actor.y,progress:t});
    }else if(actor&&e.type==='kill'){actor.shakeX=Math.sin(t*45)*5;if(t>.8)units.splice(units.indexOf(actor),1);}
    else if(actor&&e.type==='knockbackBlocked')actor.shakeX=Math.sin(t*23)*5*(1-t);
  }
  if(game.moveMode&&game.preview?.kind==='move'){
    const u=game.sel,c=game.preview.cell;
    units.push({id:'move-preview',preview:true,character:CHARACTER_IDS[u],...xy(c),direction:directionToward(c,game.state.pos[cfg.leaderOf[cfg.unitSide[u]^1]],cfg.W,facing.get(u)),action:'idle',actionTime:0,opacity:.55,xray:false});
  }
  return{units,effects,projectiles};
}

function polygon(ctx,pts,fill,stroke,width=2,dash=[]){ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}}
function tile(ctx,api,c,fill,stroke,width=2,dash=[],inset=.05){if(c<0)return;polygon(ctx,api.cellPoly(c%10,Math.floor(c/10),inset),fill,stroke,width,dash);}
function line(ctx,api,cells,color,width=3,dash=[]){if(!cells.length)return;ctx.beginPath();cells.forEach((c,i)=>{const p=xy(c),q=api.iso(p.x,p.y);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}
function floorOverlay(ctx,api){
  const s=game.state,pv=game.preview;
  if(game.inspectThreat)for(const c of game.inspectThreat.zone)tile(ctx,api,c,'#aa604b12','#aa604b40',1);
  for(const m of moves){tile(ctx,api,m.cell,'#437f7217','#437f724c',1);const p=xy(m.cell),q=api.iso(p.x,p.y);ctx.font='20px Georgia';ctx.textAlign='center';ctx.fillStyle='#3b6b60';ctx.fillText(m.cost,q.x,q.y+7);}
  if(game.sel>=0&&cfg.unitType[game.sel]>=2)for(const c of nominal)tile(ctx,api,c,null,'#9c7c4280',2,[5,7],.12);
  for(const a of attacks)tile(ctx,api,a.cell,'#ae4e3922','#a44832',4);
  for(const u of game.threatSet)tile(ctx,api,s.pos[u],null,'#a44832',4,[7,5]);
  for(const trail of game.trails)line(ctx,api,trail,'#ad7755',3,[6,6]);
  if(pv?.kind==='move'){
    line(ctx,api,[pv.from,...pv.path],'#316c60',5,[7,5]);tile(ctx,api,pv.cell,'#d5b86765','#92702f',7);
    for(const u of pv.after)tile(ctx,api,s.pos[u],'#b65c3630','#ae563b',4);
    for(const u of pv.short)tile(ctx,api,s.pos[u],null,'#8e8476',3,[6,5]);
  }
  if(pv?.kind==='attack'){
    line(ctx,api,[s.pos[game.sel],pv.opt.cell],'#a44832',4,[9,5]);
    if(pv.opt.hit.dest>=0)tile(ctx,api,pv.opt.hit.dest,'#b65c3618','#a44832',4,[7,5]);
  }
  for(const u of currentUnits){
    const id=+u.id,p=api.iso(u.x,u.y),sel=id===game.sel,color=id<6?'#42796d':'#a35c48';
    ctx.beginPath();if(id<6)ctx.ellipse(p.x,p.y+3,23,11,0,0,Math.PI*2);else{ctx.moveTo(p.x,p.y-11);ctx.lineTo(p.x+25,p.y+3);ctx.lineTo(p.x,p.y+17);ctx.lineTo(p.x-25,p.y+3);ctx.closePath();}ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke();
    if(sel||id===game.acting)tile(ctx,api,s.pos[id],'#d1a64b20',sel?'#b78c30':'#b76a43',5,[],.04);
  }
  ctx.font='18px Georgia';ctx.fillStyle='#74796b';ctx.textAlign='center';for(let i=0;i<10;i++){let p=api.iso(i+.5,10.18);ctx.fillText(String.fromCharCode(65+i),p.x,p.y+6);p=api.iso(10.18,i+.5);ctx.fillText(String(10-i),p.x,p.y+6);}
  drawFootVitals(ctx,api);
}
// 公開floorOverlayでHPを床へ描く。全キャラクターをこの後に描き、頭や胴を隠さない。
function drawFootVitals(ctx,api){
  labels=[];const s=game.state;
  for(const u of currentUnits){
    const id=+u.id,p=api.iso(u.x,u.y),max=cfg.types[cfg.unitType[id]].hp,hp=overrides.get(id)?.hp??s.hp[id],color=id<6?'#326d61':'#9d4d39';
    const width=max*18,left=p.x-width/2,top=p.y+19;
    for(let j=0;j<max;j++){
      ctx.beginPath();ctx.arc(left+9+j*18,top,7,0,Math.PI*2);ctx.fillStyle=j<hp?color:'#f6efdf';ctx.fill();
      ctx.strokeStyle='#faf5e9';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.stroke();
    }
    const q=renderer.worldToScreen(u.x,u.y);labels.push({u:id,x:q.x-width/4-2,y:q.y+4,w:width/2+4,h:12});
    if(s.flags[id]||attackReady.has(id)){ctx.font='bold 19px sans-serif';ctx.fillStyle=color;ctx.textAlign='left';ctx.fillText(attackReady.has(id)?'!':s.flags[id]&ATTACKED?'✓':'•',left+width+3,top+7);}
  }
}
function topOverlay(ctx,api){
  for(const u of currentUnits){
    const id=+u.id,p=api.iso(u.x,u.y);
    if(game.inspectThreat?.costs.has(id)){ctx.fillStyle='#994932';ctx.font='bold 20px sans-serif';ctx.textAlign='center';ctx.fillText(game.inspectThreat.costs.get(id)+'AP',p.x,p.y-105);}
  }
  const pv=game.preview;
  if(pv?.kind==='attack'&&pv.opt.hit.knockback&&pv.opt.hit.dest<0){const p=xy(pv.opt.cell),q=api.iso(p.x,p.y);ctx.font='bold 24px sans-serif';ctx.fillStyle='#a44832';ctx.fillText('×',q.x+33,q.y);}
  // 魔法の発射は元処理の弧を投影。杖・詠唱はStudioのattack動作。
  if(animation?.event.type==='attack'&&cfg.unitType[animation.event.unit]===MAGE){
    const e=animation.event,t=clamp((performance.now()-animation.start)/animation.duration,0,1),f=clamp((t-.45)/.55,0,1),p=xy(e.from),q=xy(e.to);
    if(t>.45){const a=api.iso(p.x+(q.x-p.x)*f,p.y+(q.y-p.y)*f,.6+Math.sin(f*Math.PI)*(e.overObstacle?1.1:.3));ctx.beginPath();ctx.arc(a.x,a.y,8+Math.sin(f*Math.PI)*5,0,Math.PI*2);ctx.fillStyle='#bd9468';ctx.fill();ctx.strokeStyle='#785142';ctx.lineWidth=2;ctx.stroke();}
  }
}
function drawMinimap(){
  if(!game||!renderer)return;const c=$('minimap');if(c.width!==180){c.width=180;c.height=126;}const g=c.getContext('2d');g.clearRect(0,0,180,126);
  const p=(x,y)=>({x:90+(x-y)*7.3,y:20+(x+y)*4.1});polygon(g,[p(0,0),p(10,0),p(10,10),p(0,10)],'#e5e2d6','#aaa590',1);
  for(const [x,y]of STANDARD_LAYOUT.rocks){const q=p(x+.5,y+.5);g.fillStyle='#77776b';g.fillRect(q.x-2,q.y-2,4,4);}
  game.state.pos.forEach((c,u)=>{if(c<0)return;const a=xy(c),q=p(a.x,a.y);g.fillStyle=u<6?'#3e7b6c':'#ab5b44';g.beginPath();g.arc(q.x,q.y,u===game.sel?3.5:2.3,0,Math.PI*2);g.fill();});
  const corners=[[0,0],[viewport.clientWidth,0],[viewport.clientWidth,viewport.clientHeight],[0,viewport.clientHeight]].map(([x,y])=>{const a=fromViewport(x,y);return p(a.x,a.y);});
  g.save();g.beginPath();g.rect(2,2,176,122);g.clip();polygon(g,corners,null,'#ad8437',1.8);g.restore();
}
function makePortraits(){
  const canvas=document.createElement('canvas'),v=createCharacterView({canvas,width:64,height:70,dpr:2,scale:.60,characters,lineScale:1});
  for(const def of characters){v.render({character:def.id,direction:'SW',action:'idle',actionTime:.4,originX:32,originY:64,tile:false});portraits.set(def.id,canvas.toDataURL());}v.dispose();
}
function drawTitle(){
  const canvas=$('title-art');if(!canvas)return;
  const v=createCharacterView({canvas,width:360,height:180,dpr:2,scale:.9,characters,lineScale:1});
  for(const [i,id]of ['archer','warrior','king','demon-king','goblin','dark-mage'].entries())v.render({character:id,direction:i<3?'SE':'SW',action:'idle',actionTime:.4,originX:30+i*60,originY:156-(i===2||i===3?10:0),tile:false,clear:i===0,background:'#f1eadb'});
  canvas.style.width='100%';canvas.style.height='auto';v.dispose();
}
function frame(now){
  requestAnimationFrame(frame);if(!ready||!game||document.hidden)return;
  if(cameraMotion){const m=cameraMotion,t=clamp((now-m.start)/m.duration,0,1),f=ease(t);pan={x:m.from.x+(m.to.x-m.from.x)*f,y:m.from.y+(m.to.y-m.from.y)*f};transform();if(t===1)cameraMotion=null;}
  if(now-lastFrame<30)return;lastFrame=now;
  const f=visualFrame(now);currentUnits=f.units.filter(u=>!u.preview);previewUnit=f.units.find(u=>u.preview)||null;
  lastInfo=renderer.render({timeSeconds:now/1000,...f,floorOverlay,topOverlay});timings.push(lastInfo.totalMs);if(timings.length>300)timings.shift();
}
// 読み取り用診断。通常URLには人工局面や固定乱数の操作を置かない。
export const diagnostics={
  get ready(){return ready;},get renderer(){return renderer;},get game(){return game;},get animation(){return animation;},
  get previewUnit(){return previewUnit&&{...previewUnit};},
  get info(){const t=timings.slice().sort((a,b)=>a-b);return{tileWidth:TILE,tileHeight:42,characterScale:SCALE,hpLayer:'floor-before-characters',sceneBuilds:builds,center:centerWorld(),pan:{...pan},p95:t[Math.floor(t.length*.95)]||0,max:Math.max(0,...t),units:currentUnits.map(u=>({...u})),labels:labels.map(l=>({...l})),last:lastInfo,cache:renderer.getDiagnostics()};}
};
