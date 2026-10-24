/** Hooded monster caster. Anatomical +b is left (staff); -b holds the spellbook. */
import {
  TAU, WALK_HZ, LW, LAYER, DRAW, PAL, rigFrame, renderRig, walkFeet,
  ik2, keyframes, nrm3, bodyLayerKey, legParts2, mittenHand,
  paint, paintA, ellipsePts, taperPts, cLine, strokePath,
} from '../../src/authoring.js';

const C={cloth:'#62506f',dark:'#40344e',light:'#89748f',edge:'#a18a91',
  void:'#141118',eye:'#edbc66',hand:'#a89aa9',leather:'#66503e',gold:'#b99a62',
  wood:'#795b40',woodLight:'#a08058',crystal:'#b784dd',facet:'#735098',shine:'#e3c2f0',
  book:'#493643',pages:'#c9bda6',bone:'#dfd2b6'};
const IDLE_T=3.8,CAST_T=1.8,STAFF_REST=[1,33,39],HAND_REST=[13,-17,27];
const mid=(a,b)=>a.map((v,i)=>(v+b[i])/2);
const shape=(ctx,pts,fill,o={})=>paintA(ctx,pts,{fill,w:LW.part,depth:1.8,
  light:.2,speck:.65,speckScale:.3,amp:.22,...o});
const oval=(ctx,x,y,rx,ry,fill,o={})=>paint(ctx,ellipsePts(x,y,rx,ry,24),
  {fill,w:1,depth:1,speck:.3,speckScale:.3,amp:.15,...o});

function darkMagePose(action,t) {
  const P={body:[0,0,0],footL:[0,6,0],footR:[0,-6,0],staff:STAFF_REST.slice(),
    hand:HAND_REST.slice(),pitch:.04,sway:0,glow:0};
  if(action==='walk') {
    const w=walkFeet(t);
    P.footL=w.footL;P.footR=w.footR;P.body[2]=w.bob*.4;
    P.sway=w.s*.9;P.staff[2]+=w.s*.5;P.hand[2]-=w.s*.4;
  } else if(action==='attack') {
    const u=Math.max(0,Math.min(1,t/CAST_T));
    P.staff=keyframes([[0,STAFF_REST],[.26,[0,32,43]],[.46,[0,32,44]],
      [.59,[11,29,42]],[.72,[11,29,42]],[1,STAFF_REST]],u);
    // Raise the supported book for the chant; the left staff still releases along +a.
    P.hand=keyframes([[0,HAND_REST],[.26,[14,-13,33]],[.46,[14,-13,33]],
      [.59,[17,-15,31]],[.72,[17,-15,31]],[1,HAND_REST]],u);
    const k=keyframes([[0,[0,.04,0]],[.26,[-.8,.02,-.4]],
      [.46,[-.8,.02,-.4]],[.59,[1.5,.65,.7]],
      [.72,[1.5,.65,.7]],[1,[0,.04,0]]],u);
    P.body[0]=k[0];P.pitch=k[1];P.sway=k[2];
    P.glow=keyframes([[0,[0]],[.32,[.15]],[.48,[.5]],[.59,[1]],
      [.68,[.6]],[.82,[0]],[1,[0]]],u)[0];
  } else {
    P.body[2]=Math.sin(t/IDLE_T*TAU)*.4;
    P.sway=Math.sin(t/IDLE_T*TAU-.5)*.25;
  }
  return P;
}

function robe(ctx,rf,P) {
  const c=rf.U(0,0,0),s=P.sway;
  ctx.save();ctx.translate(c.x,c.y);
  shape(ctx,[[-12,-50],[-16,-43],[-14,-33],[-19+s,-18],[-23+s,-10],
    [-14+s,-8],[-6+s,-10],[1+s,-8],[11+s,-10],[21+s,-9],
    [18+s,-23],[14,-35],[16,-44],[11,-50]],C.cloth,{w:LW.outline,depth:2.5});
  shape(ctx,[[-13,-33],[-18+s,-15],[-20+s,-10],[-13+s,-9],[-8,-32]],
    C.dark,{w:0,depth:0,speck:.4});
  for(const x of [-7,8])cLine(ctx,[[x,-31],[x*1.2+s*.5,-22],[x*1.5+s,-12]],.7);
  shape(ctx,[[-14,-35],[14,-35],[14,-31],[-14,-31]],C.leather,{w:1,depth:.6});
  if(rf.front) {
    const b=rf.U(10,0,33);
    shape(ctx,[[b.x-c.x-3,-36],[b.x-c.x+3,-36],[b.x-c.x+3,-30],[b.x-c.x-3,-30]],
      C.gold,{w:.8,depth:.4});
    shape(ctx,[[b.x-c.x-1.6,-34.5],[b.x-c.x+1.6,-34.5],
      [b.x-c.x+1.6,-31.5],[b.x-c.x-1.6,-31.5]],C.leather,{w:.5,depth:0});
  }
  ctx.restore();
}

function mantle(ctx,rf) {
  const p=rf.U(0,0,48);
  ctx.save();ctx.translate(p.x,p.y);
  shape(ctx,[[-11,-6],[-19,-2],[-23,6],[-16,10],[-7,8],[0,5],
    [8,9],[17,10],[23,5],[17,-2],[10,-6]],C.dark,{w:1.8,depth:2});
  shape(ctx,[[-12,-5],[-20,0],[-17,4],[-8,5],[0,1],[9,5],
    [18,4],[21,0],[11,-5],[0,-2]],C.cloth,{w:1.2,depth:1.3});
  cLine(ctx,[[-17,5],[-9,6],[-2,3]],.65);
  cLine(ctx,[[3,3],[11,6],[18,5]],.65);
  if(rf.front) {
    const q=rf.U(10,0,48);
    oval(ctx,q.x-p.x,q.y-p.y,2.7,3,C.gold,{w:.8});
    oval(ctx,q.x-p.x,q.y-p.y,1.4,1.7,C.dark,{w:.5,depth:0});
  }
  ctx.restore();
}

function hood(ctx,rf,P) {
  const h=rf.U(1.5,0,71);
  ctx.save();ctx.translate(h.x,h.y);ctx.scale(rf.sx,1);
  // Head envelope is z=93..49 (44px); only the loose folded tip sits above it.
  shape(ctx,[[-21,-5],[-23,-17],[-29+P.sway,-13],[-25,-24],[-15,-31],
    [-4,-27],[10,-21],[19,-12],[22,3],[24,15],[14,21],[1,22],
    [-12,19],[-23,14],[-25,8]],C.cloth,{w:LW.outline,depth:2.7});
  if(rf.front) {
    shape(ctx,[[11,-17],[18,-10],[21,13],[11,18],[-2,18],[-17,12],
      [-10,0],[1,-9]],C.dark,{w:1.1,depth:.8});
    shape(ctx,[[12,-14],[16,-8],[18,11],[10,15],[-1,15],[-13,10],
      [-7,1],[2,-6]],C.void,{w:1,depth:0,light:0,speck:0,amp:.12});
    // No facial features beyond the small amber eyes inside the hood's shadow.
    for(const [x,y] of [[0,4],[11,2.5]]) {
      ctx.save();ctx.globalAlpha=.13;
      oval(ctx,x,y,2.8,4.7,C.eye,{w:0,depth:0,speck:0});ctx.restore();
      oval(ctx,x,y,1.5,3.4,C.eye,{w:0,depth:0,speck:0,amp:.05});
    }
    cLine(ctx,[[-20,9],[-12,-3],[0,-13],[11,-19]],.75);
    cLine(ctx,[[-19,14],[-8,19],[4,20]],.65);
  } else {
    shape(ctx,[[-20,-17],[-13,-26],[-6,-24],[-12,-9],[-15,8],[-9,17],
      [-19,13],[-22,3]],C.dark,{w:0,depth:0,speck:.4});
    cLine(ctx,[[-3,-23],[2,-10],[4,3],[1,16]],.8);
    cLine(ctx,[[14,-12],[17,1],[15,14]],.65);
  }
  cLine(ctx,[[-24,-17],[-18,-17],[-12,-21]],.65);
  ctx.restore();
}

function sleeve(ctx,rf,S,E,H) {
  const s=rf.U(...S),e=rf.U(...E),h=rf.U(...H);
  paint(ctx,taperPts(s,e,6,5),{fill:C.cloth,w:LW.part,depth:2,speck:.6,speckScale:.3});
  const dx=h.x-e.x,dy=h.y-e.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
  const q=(along,across)=>({x:h.x+dx/len*along+nx*across,y:h.y+dy/len*along+ny*across});
  paint(ctx,[{x:e.x+nx*4.8,y:e.y+ny*4.8},q(-3,7),q(-3,-6),
    {x:e.x-nx*4.8,y:e.y-ny*4.8}],{fill:C.cloth,w:LW.part,depth:2,speck:.6,speckScale:.3});
  paint(ctx,taperPts(q(-3,-6),q(-3,7),1,1),{fill:C.edge,w:.7,depth:.4,speck:.2});
  const a=q(-7,1);cLine(ctx,[[e.x,e.y],[a.x,a.y]],.65);
}

function staff(ctx,rf,P) {
  const axis=nrm3([P.pitch,.32,1]),at=z=>rf.U(...P.staff.map((v,i)=>v+axis[i]*z));
  // Shaft passes through the left grip; bends never offset the grip anchor.
  const shaft=[-36,-26,-17,-8,0,10,20,29].map((z,i)=>{
    const q=at(z);return{x:q.x+(z===0?0:(i%2?1.2:-1.2)),y:q.y};});
  strokePath(ctx,shaft,5*DRAW.lw,false,PAL.ink);
  strokePath(ctx,shaft,3,false,C.wood);
  const base=at(29),tip=at(49),dx=tip.x-base.x,dy=tip.y-base.y,len=Math.hypot(dx,dy)||1;
  const q=(s,w)=>({x:base.x+dx*s-dy/len*w,y:base.y+dy*s+dx/len*w});
  paint(ctx,[q(0,0),q(.3,-5),q(.7,-3),q(1,0),q(.55,5),q(.17,4)],
    {fill:C.crystal,w:1.3,depth:1,speck:.2,amp:.12,step:2});
  paint(ctx,[q(0,0),q(.48,0),q(1,0),q(.55,5),q(.17,4)],
    {fill:C.facet,w:.6,depth:0,speck:0,amp:.08,step:2});
  strokePath(ctx,[q(.2,-1.5),q(.5,-1),q(.78,0)],.8,false,C.shine);
  for(const side of [-1,1]) {
    const branch=[q(-.2,0),q(.02,side*5),q(.32,side*7),q(.6,side*6)];
    strokePath(ctx,branch,4*DRAW.lw,false,PAL.ink);
    strokePath(ctx,branch,2.3,false,C.wood);
  }
  for(const z of [-23,-12,15]) {
    const a=at(z-3),b=at(z),c=at(z+3);
    strokePath(ctx,[{x:a.x-1,y:a.y},{x:b.x+1,y:b.y},{x:c.x-1,y:c.y}],.8,false,C.woodLight);
  }
  for(const z of [23,25.5,28]) {
    const p=at(z);cLine(ctx,[[p.x-2,p.y+1],[p.x+2,p.y-1]],1);
  }
  if(P.glow>0) {
    const p=q(.5,0);ctx.save();ctx.globalAlpha=P.glow*.16;
    oval(ctx,p.x,p.y,7,9,C.shine,{w:0,depth:0,speck:0});ctx.restore();
  }
}

function spellbook(ctx,rf,P) {
  const h=rf.U(...P.hand),angle=rf.sx*.14;
  // As on the mage, local (0,12) is the supporting palm, including the tilt.
  ctx.save();ctx.translate(h.x+Math.sin(angle)*12,h.y-Math.cos(angle)*12);
  ctx.rotate(angle);ctx.scale(rf.sx,1);
  shape(ctx,[[-9,-12],[7,-12],[10,-9],[10,12],[-9,12]],C.book,{w:1.6,depth:1});
  shape(ctx,[[6,-10],[9,-9],[9,10],[6,11]],C.pages,{w:.7,depth:.4});
  cLine(ctx,[[7.5,-7],[7.5,8]],.45);
  shape(ctx,[[-9,-12],[6,-11],[6,12],[-9,12]],C.book,{w:1.2,depth:1});
  cLine(ctx,[[-7,-9],[-7,9]],.65);
  if(rf.front) {
    // One ivory skull silhouette, two eye sockets and a short jaw: legible at game size.
    shape(ctx,[[-5,-4],[-3,-6],[1,-6],[3,-4],[3,0],[1,2],[1,5],
      [-3,5],[-3,2],[-5,0]],C.bone,{w:.65,depth:0,light:0,speck:0,amp:.06,step:2});
    for(const x of [-3,1])oval(ctx,x,-1,1.3,1.5,C.book,{w:0,depth:0,speck:0,amp:.03});
    shape(ctx,[[-1,.8],[-2,2.2],[0,2.2]],C.book,{w:0,depth:0,light:0,speck:0,amp:0,step:1});
    cLine(ctx,[[-1,3.2],[-1,5]],.5);
  }
  ctx.restore();
}

export function drawDarkMage(ctx,x,y,direction,action,t,scale=1,opts={}) {
  const P=darkMagePose(action,t),rf=rigFrame(direction,P.body);
  const key=p=>bodyLayerKey(rf,...p);
  const parts=legParts2(ctx,rf,P,{pants:C.dark,boot:C.leather,sole:C.dark,footR:3.8,soleR:3.4});
  parts.push({id:'robe',d:LAYER.torso,draw:()=>robe(ctx,rf,P)});
  parts.push({id:'mantle',d:LAYER.cape,draw:()=>mantle(ctx,rf)});
  parts.push({id:'hood',d:LAYER.head,draw:()=>hood(ctx,rf,P)});
  for(const [side,H] of [[1,P.staff],[-1,P.hand]]) {
    const S=[0,side*13,47],E=ik2(S,H,14,15,[-4,side*3,-12]);
    // The shoulder mantle lies over both sleeves in every view. Keep hands and
    // equipment on their own depth keys so a raised book/staff can pass in front.
    const d=Math.min(key(mid(S,H)),LAYER.cape-1);
    parts.push({id:'sleeve'+side,d,draw:()=>sleeve(ctx,rf,S,E,H)});
    if(side===1)parts.push({id:'staff',d:key(H)+.01,draw:()=>staff(ctx,rf,P)});
    else parts.push({id:'spellbook',d:key(H)+.03,draw:()=>spellbook(ctx,rf,P)});
    parts.push({id:'hand'+side,d:key(H)+.02,draw:()=>{
      const h=rf.U(...H),e=rf.U(...E);
      mittenHand(ctx,h,h.x-e.x,h.y-e.y,3.2,C.hand,{thumbSide:side*rf.sx});
    }});
  }
  renderRig(ctx,x,y,scale,parts,{prefix:'dark-mage',boil:0,shadow:opts.shadow});
}

export const character=Object.freeze({
  id:'dark-mage',label:'暗黒魔法使い',kind:'humanoid',directional:true,draw:drawDarkMage,
  actions:{idle:{period:IDLE_T,frames:20},walk:{period:1/WALK_HZ,frames:16},
    attack:{period:CAST_T,keys:[0,.1,.2,.26,.36,.46,.5,.55,.59,.65,.72,.78,.86,.94,.99],once:true}},
  frameBox:{x0:-90,x1:90,y0:-126,y1:25},
  equipment:{leftHand:'staff',rightHand:'spellbook'},
});
export const studio=Object.freeze({name:'暗黒魔法使い',category:'モンスター族',
  description:'深紫のフードの影に琥珀色の目が光る魔法使い。左手の紫水晶の木杖と、右手の髑髏印の魔法書で詠唱します。',
  preview:{direction:'SE',phase:0}});
