/** White-haired storybook mage. Anatomical +b is LEFT (staff), -b RIGHT (book). */
import {
  TAU, WALK_HZ, rigFrame, renderRig, walkFeet, ik2, keyframes, nrm3,
  paint, paintA, ellipsePts, taperPts, cLine, mittenHand, legParts2,
  strokePath, DRAW, PAL,
} from '../../src/authoring.js';

const C = {
  cloth:'#7f8b9c', dark:'#505d71', light:'#a2adba', lining:'#e4d8bd',
  hair:'#eee8d6', hairShade:'#c6c4b6', skin:'#f3dbb3',
  leather:'#896748', book:'#72523d', gold:'#c5a16a', wood:'#92704c',
  crystal:'#b9e3e9', crystalShade:'#70b7cb', ink:PAL.ink,
};
const IDLE_T=3.2, CAST_T=1.6;
const phase=(t,p)=>((t%p)+p)%p/p;
const blend=(keys,u)=>keyframes(keys,u);
const mid=(a,b)=>a.map((v,i)=>(v+b[i])/2);
const shape=(ctx,pts,fill,o={})=>paintA(ctx,pts,{fill,w:1.5,depth:1.7,
  speck:.55,speckScale:.3,amp:.22,...o});
const oval=(ctx,x,y,rx,ry,fill,o={})=>paint(ctx,ellipsePts(x,y,rx,ry,28),
  {fill,w:1.2,depth:1,speck:.35,speckScale:.3,amp:.2,...o});

export function magePose(action,t) {
  const P={body:[0,0,0],footL:[0,6,0],footR:[0,-6,0],
    staff:[0,39,43],book:[10,-17,27],pitch:.07,sway:0,glow:0};
  if(action==='walk') {
    const w=walkFeet(t);
    P.footL=w.footL;P.footR=w.footR;P.body=[0,0,w.bob*.45];
    P.sway=w.s*1.3;P.staff[2]+=w.s*.65;P.book[2]-=w.s*.4;
  } else if(action==='attack') {
    const u=phase(t,CAST_T);
    P.staff=blend([[0,P.staff],[.28,[0,39,47]],[.48,[0,39,49]],
      [.6,[25,20,42]],[.7,[25,20,42]],[1,P.staff]],u);
    P.book=blend([[0,P.book],[.28,[14,-9,34]],[.7,[14,-9,34]],[1,P.book]],u);
    const a=blend([[0,[0,.07,0]],[.28,[-1,.04,-.7]],[.48,[-1,.04,-.7]],
      [.6,[2,2.4,1.2]],[.7,[2,2.4,1.2]],[1,[0,.07,0]]],u);
    P.body=[a[0],0,0];P.pitch=a[1];P.sway=a[2];
    P.glow=blend([[0,[0]],[.47,[0]],[.57,[1]],[.65,[.7]],[.78,[0]],[1,[0]]],u)[0];
  } else {
    const s=Math.sin(TAU*phase(t,IDLE_T));P.body[2]=s*.55;P.sway=s*.45;
  }
  return P;
}

function robe(ctx,rf,P) {
  const p=rf.U(0,0,0),sw=P.sway;
  ctx.save();ctx.translate(p.x,p.y);
  shape(ctx,[[-12,-51],[-17,-44],[-15,-34],[-20+sw,-16],[-23+sw,-11],
    [-13,-9],[0,-11],[11,-9],[23+sw,-12],[18+sw,-25],[15,-43],[11,-51]],C.cloth,{w:1.8});
  if(rf.front) {
    const Q=pts=>pts.map(([b,z])=>{const q=rf.U(9,b,z);return[q.x-p.x,q.y-p.y];});
    shape(ctx,Q([[-5,46],[-7,33],[-13,12],[-1,12],[1,31],[3,12],[14,13],[7,35],[5,46]]),C.lining,{w:1,depth:.7,speck:.35});
    for(const b of [-7,7]) {
      const q=rf.U(9,b,18);shape(ctx,[[q.x-p.x,q.y-p.y-3],[q.x-p.x+1.6,q.y-p.y],
        [q.x-p.x,q.y-p.y+3],[q.x-p.x-1.6,q.y-p.y]],C.light,{w:.3,depth:0,speck:0});
    }
    shape(ctx,[[-12,-50],[-3,-45],[0,-41],[3,-45],[12,-50],[8,-40],[0,-37],[-8,-41]],C.dark,{w:1});
  } else {
    cLine(ctx,[[-6,-46],[-8,-30],[-12+sw,-14]],.75);
    cLine(ctx,[[7,-45],[9,-30],[14+sw,-14]],.7);
  }
  shape(ctx,[[-14,-36],[14,-36],[14,-32],[-14,-32]],C.leather,{w:1,depth:.7});
  if(rf.front) {
    const buckle=rf.U(10,0,34);ctx.save();ctx.translate(buckle.x-p.x,buckle.y-p.y);
    shape(ctx,[[-3,-2.5],[3,-2.5],[3,2.5],[-3,2.5]],C.gold,{w:.8,depth:0});
    shape(ctx,[[-1.6,-1.2],[1.6,-1.2],[1.6,1.2],[-1.6,1.2]],C.book,{w:.5,depth:0});ctx.restore();
    oval(ctx,0,-44,2.7,2.7,C.gold,{w:.8});
    cLine(ctx,[[-16+sw,-17],[-11,-29],[-8,-35]],.65);
    cLine(ctx,[[17+sw,-16],[12,-28],[10,-34]],.65);
  }
  ctx.restore();
}

function head(ctx,h,rf,P) {
  ctx.save();ctx.translate(h.x,h.y);ctx.scale(rf.sx,1);
  // Head itself is 44px high (93px crown / 49px chin); hat height is extra.
  // The brim has one shared contour below. A separate rear ellipse made a
  // second protruding lip whose endpoints did not match the front edge.
  shape(ctx,[[-19,-19],[-11,-23],[7,-23],[18,-17],[22,-4],[21,15],[15,22],
    [12,17],[7,23],[-1,21],[-9,23],[-14,18],[-20,20],[-23,9],[-21,-4]],C.hair,{w:1.7});
  if(rf.front) {
    // Back-to-front: hanging side locks, face/ears, then the fringe.
    shape(ctx,[[-18,-2],[-15,6],[-15,16],[-11,24],[-17,22],[-21,14],[-21,3]],C.hair,{w:1});
    shape(ctx,[[19,-4],[21,9],[18,19],[15,21],[17,11],[15,2]],C.hair,{w:1});
    oval(ctx,2,1,18.4,20,C.skin,{w:1.6,speck:0,depth:1.1});
    oval(ctx,-15,8,4.8,5.4,C.skin,{w:1,speck:0});
    cLine(ctx,[[-17,7],[-14,6],[-13,10]],.6);
    for(const [x,y] of [[-2,5],[12,3]])oval(ctx,x,y,1.5,4.4,C.ink,{w:.5,depth:0,speck:0});
    cLine(ctx,[[4,15],[6,15.4]],.65);
    cLine(ctx,[[-4,-3],[-1,-4]],.65);cLine(ctx,[[10,-5],[13,-5]],.65);
    for(const x of [-8,-6,15,17])cLine(ctx,[[x,12],[x+.5,13.4]],.4);
    shape(ctx,[[-20,-8],[-13,-19],[1,-23],[15,-18],[20,-9],[23,4],[16,-2],
      [19,10],[13,5],[9,-7],[5,0],[4,-12],[-2,-2],[-1,-14],[-9,-4],[-14,1],[-12,-9],[-19,4]],C.hair,{w:1.2});
    cLine(ctx,[[-11,-15],[-15,-5],[-17,2]],.55);
    cLine(ctx,[[3,-19],[1,-13],[-3,-7]],.55);
  } else {
    for(const x of [-13,-4,7,15])cLine(ctx,[[x,-15],[x+2,0],[x,16]],.65);
  }
  // Floppy crown and broad tilted brim. Only this head accessory mirrors.
  // The brim-to-upper-eye gap was about 15–17px; lower the entire hat by 8px.
  ctx.translate(0,8);
  const bend=P.sway;
  shape(ctx,[[-24,-21],[-21,-39],[-26+bend,-40],[-32+bend,-33],[-43+bend,-29],
    [-37+bend,-39],[-30+bend,-48],[-23,-56],[-11,-62],[0,-58],[10,-51],[16,-35],[21,-21]],C.cloth,{w:1.8});
  cLine(ctx,[[-25,-46],[-17,-44],[-12,-39]],.65);
  cLine(ctx,[[-10,-56],[-5,-50],[-2,-47]],.65);
  shape(ctx,[[-23,-31],[-5,-36],[15,-34],[18,-27],[-3,-28],[-25,-24]],C.leather,{w:1.2,depth:1});
  if(rf.front) {
    shape(ctx,[[2,-37],[12,-37],[14,-28],[4,-27]],C.gold,{w:1,depth:0});
    shape(ctx,[[5,-34],[10,-34],[11,-30],[6,-30]],C.book,{w:.6,depth:0});
  }
  shape(ctx,[[-22,-26],[-10,-28],[7,-28],[22,-24],[31,-19],[35,-12],[30,-12],
    [22,-17],[11,-18],[1,-14],[-14,-9],[-29,-4],[-35,-7],[-30,-16]],C.cloth,{w:1.7});
  cLine(ctx,[[-30,-10],[-17,-15],[-5,-20],[12,-23],[24,-20]],.7);
  ctx.restore();
}

function sleeve(ctx,rf,j) {
  const s=rf.U(...j.S),e=rf.U(...j.E),h=rf.U(...j.H);
  paint(ctx,taperPts(s,e,5.8,5.3),{fill:C.cloth,w:1.5,depth:1.8,speck:.55,speckScale:.3});
  const dx=h.x-e.x,dy=h.y-e.y,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
  const cuff={x:h.x-dx/L*3,y:h.y-dy/L*3};
  paint(ctx,[{x:e.x+nx*5,y:e.y+ny*5},{x:cuff.x+nx*7,y:cuff.y+ny*7},
    {x:cuff.x-nx*6,y:cuff.y-ny*6},{x:e.x-nx*4,y:e.y-ny*4}],
    {fill:C.cloth,w:1.5,depth:2,speck:.6,speckScale:.3});
  paint(ctx,taperPts({x:cuff.x-nx*6,y:cuff.y-ny*6},{x:cuff.x+nx*7,y:cuff.y+ny*7},1.2,1.2),
    {fill:C.lining,w:.8,depth:.4,speck:.2});
  cLine(ctx,[[e.x,e.y+2],[cuff.x-dx/L*5,cuff.y-dy/L*5]],.7);
}

function staff(ctx,rf,P) {
  // Slight anatomical outward cant keeps the crystal clear of the broad brim.
  const axis=nrm3([P.pitch,.35,1]),at=z=>rf.U(...P.staff.map((v,i)=>v+axis[i]*z));
  const shaft=[-38,-28,-17,-9,0,12,22,33].map((z,i)=>{
    const q=at(z);return{x:q.x+(i%2?.8:-.8),y:q.y};});
  strokePath(ctx,shaft,4.7*DRAW.lw,false,C.ink);strokePath(ctx,shaft,2.8,false,C.wood);
  const base=at(33),tip=at(53),dx=tip.x-base.x,dy=tip.y-base.y,L=Math.hypot(dx,dy),nx=-dy/L,ny=dx/L;
  const q=(s,w)=>({x:base.x+dx*s+nx*w,y:base.y+dy*s+ny*w});
  const gem=[q(0,0),q(.25,-5),q(.65,-3),q(1,0),q(.45,5),q(.12,4)];
  paint(ctx,gem,{fill:C.crystal,w:1.2,depth:1.7,speck:.2,amp:.18});
  paint(ctx,[q(0,0),q(.5,0),q(1,0),q(.45,5),q(.12,4)],{fill:C.crystalShade,w:.5,depth:0,speck:0});
  strokePath(ctx,[q(.2,-2),q(.58,-1),q(.8,0)],1,false,'#edf7eb');
  for(const s of [-1,1]) {
    const branch=[q(-.1,0),q(.05,s*5),q(.4,s*7),q(.62,s*6)];
    strokePath(ctx,branch,3.7*DRAW.lw,false,C.ink);strokePath(ctx,branch,2,false,C.wood);
  }
  for(const z of [24,27,30]) {
    const p=at(z);cLine(ctx,[[p.x-2,p.y+1],[p.x+2,p.y-1]],1);
  }
  if(P.glow>0) {
    const g=q(.55,0);ctx.save();ctx.globalAlpha=P.glow*.26;
    oval(ctx,g.x,g.y,9,10,'#9bdaef',{w:0,depth:0,speck:0});ctx.globalAlpha=P.glow;
    cLine(ctx,[[g.x-9,g.y-3],[g.x-12,g.y-4]],.8);
    cLine(ctx,[[g.x+9,g.y-3],[g.x+11,g.y-5]],.8);ctx.restore();
  }
}

function book(ctx,rf,P) {
  const h=rf.U(...P.book),angle=rf.sx*.14;
  // The right palm supports the lower edge, including the book's tilt.
  // Local (0,14) is exactly the hand anchor, never the middle of the cover.
  ctx.save();ctx.translate(h.x+Math.sin(angle)*14,h.y-Math.cos(angle)*14);ctx.rotate(angle);
  shape(ctx,[[-10,-13],[8,-13],[11,-10],[11,14],[-10,14]],C.book,{w:1.6});
  shape(ctx,[[6,-11],[10,-10],[10,11],[6,12]],C.lining,{w:.8,depth:.5});
  for(const x of [7.2,8.5])cLine(ctx,[[x,-8],[x,9]],.45);
  shape(ctx,[[-9,-13],[6,-12],[6,13],[-9,12]],C.leather,{w:1.2});
  for(const x of [-7,4])cLine(ctx,[[x,-10],[x,10]],.5);
  const star=[];for(let i=0;i<6;i++){const a=-Math.PI/2+i*TAU*2/5;star.push({x:-1+Math.cos(a)*4.5,y:Math.sin(a)*4.5});}
  strokePath(ctx,ellipsePts(-1,0,5,5,24),.6,false,C.gold);strokePath(ctx,star,.65,false,C.gold);
  ctx.restore();
}

export function drawMage(ctx,x,y,direction,action,t,scale=1,opts={}) {
  const P=magePose(action,t),rf=rigFrame(direction,P.body),U=rf.U;
  const parts=legParts2(ctx,rf,P,{pants:C.dark,boot:C.leather,cuff:C.book,footR:3.7,soleR:3.3});
  const headCenter=U(1.5,0,71);
  // Near-side left arm and staff pass in front of the chest-held right-hand book.
  const layer=p=>U(...p).d>0?40:-20;
  parts.push({id:'robe',d:0,draw:()=>robe(ctx,rf,P)});
  parts.push({id:'head',d:100,draw:()=>head(ctx,headCenter,rf,P)});
  for(const [side,H] of [[1,P.staff],[-1,P.book]]) {
    const S=[0,side*13,49],E=ik2(S,H,14,15,[-3,side*4,-14]),j={S,E,H};
    // Sleeves stay below the head layer. In rear views the chest-held book is behind the robe.
    const d=side===-1?(rf.front?25:-25):layer(mid(S,H));
    // SW's left-hand staff is nearest: crystal and its wooden setting cover
    // the hat brim. Keep the sleeve below the head and the grip over the shaft.
    const staffInFront=side===1&&direction==='SW';
    parts.push({id:'sleeve'+side,d,draw:()=>sleeve(ctx,rf,j)});
    parts.push({id:'equipment'+side,d:staffInFront?101:d+1,draw:()=>side===1?staff(ctx,rf,P):book(ctx,rf,P)});
    // Book occludes the upper palm; its lower half remains visible under the edge.
    // The staff grip still overlays its shaft.
    parts.push({id:'hand'+side,d:staffInFront?102:d+(side===-1?.5:2),draw:()=>{
      const h=U(...H),e=U(...E);mittenHand(ctx,h,h.x-e.x,h.y-e.y,3.2,C.skin,{thumbSide:side*rf.sx});
    }});
  }
  renderRig(ctx,x,y,scale,parts,{prefix:'mage',boil:0,shadow:opts.shadow});
}

export const character=Object.freeze({
  id:'mage',label:'魔法使い',kind:'humanoid',directional:true,draw:drawMage,
  actions:{idle:{period:IDLE_T,frames:16},walk:{period:1/WALK_HZ,frames:16},
    attack:{period:CAST_T,keys:[0,.1,.2,.28,.38,.47,.52,.57,.6,.65,.7,.78,.85,.92,.98],once:true}},
  frameBox:{x0:-94,x1:94,y0:-145,y1:22},
  equipment:{leftHand:'staff',rightHand:'spellbook'},
});
export const studio={name:'魔法使い',category:'冒険者',
  description:'白髪と青灰色のとんがり帽子の魔法使い。左手の水晶杖と右手の魔導書で、小さな青い光を灯します。',
  preview:{direction:'SE',phase:0}};
