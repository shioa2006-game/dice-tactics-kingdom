/** Armoured monster monarch. Anatomical +b is left; -b holds the greatsword. */
import {
  TAU, LW, LAYER, WALK_HZ, rigFrame, renderRig, walkFeet, footProj,
  legParts2, ik2, keyframes, nrm3, bodyLayerKey, taperPts,
  paint, paintA, ellipsePts, cLine, mittenHand,
} from '../../src/authoring.js';

const C = Object.freeze({
  iron: '#47494d', dark: '#303237', light: '#696c70', edge: '#a59980',
  blade: '#929699', bladeLight: '#c7c7bd', bladeDark: '#62666b',
  red: '#812f38', redDark: '#58252e', leather: '#473b35',
  void: '#111116', ruby: '#b62e2a', ember: '#ff5031', glow: '#ff9a50',
});
const IDLE_T = 4, ATTACK_T = 1.75, BLADE_LENGTH = 50;
const REST = [5, -21, 21.5, .94, 0, -.34];
const LEFT_REST = [1, 20, 19];
// Blade stays in the anatomical a/z plane: no screen-space sweep or mirrored grip.
// Long anticipation, quick downward cut, impact hold, then a gradual recovery.
const SWING = [
  [0, REST], [.16, [3,-23,32,.96,0,.28]],
  [.32, [-2,-25,51,-.5,0,.866]], [.45, [-1,-25,56,-.28,0,.96]],
  [.51, [4,-24,55,.4,0,.916]], [.59, [23,-17,32,.92,0,-.39]],
  [.65, [22,-16,28,.87,0,-.49]], [.75, [22,-16,28,.87,0,-.49]],
  [.88, [11,-20,24,.92,0,-.39]], [1, REST],
];
const mid = (a,b) => a.map((v,i) => (v+b[i])/2);
const shape = (ctx,pts,fill,o={}) => paintA(ctx,pts,{
  fill,w:LW.part,depth:1.6,light:.22,speck:.8,speckScale:.3,amp:.22,...o,
});
const plate = (ctx,pts,o={}) => paint(ctx,pts,{
  fill:C.iron,w:LW.part,depth:1.8,light:.32,speck:1.1,speckScale:.3,amp:.22,...o,
});
const oval = (ctx,x,y,rx,ry,fill,o={}) => plate(ctx,ellipsePts(x,y,rx,ry,22),{fill,...o});
const line = (ctx,pts,w=LW.fine) => cLine(ctx,pts.map(p => Array.isArray(p)?p:[p.x,p.y]),w);

function demonPose(action,t) {
  const P={body:[0,0,0],footL:[0,6,0],footR:[0,-6,0],
    right:REST.slice(0,3),left:LEFT_REST.slice(),blade:nrm3(REST.slice(3)),sway:0};
  if(action==='walk') {
    const w=walkFeet(t);
    // Preserve the shared grounded stride/period; weight comes from restrained upper motion.
    P.footL=w.footL;P.footR=w.footR;P.body=[.7,0,w.bob*.34];
    P.right[0]-=w.s*1.4;P.left[0]+=w.s*2;
    P.sway=Math.sin(w.ph-1)*.9;
  } else if(action==='attack') {
    const u=Math.max(0,Math.min(1,t/ATTACK_T)),k=keyframes(SWING,u);
    P.right=k.slice(0,3);P.blade=nrm3(k.slice(3));
    const b=keyframes([[0,[0,0]], [.32,[-1.2,.5]], [.51,[-1.2,.5]],
      [.59,[2.5,-.9]], [.65,[3,-1.3]], [.75,[3,-1.3]], [1,[0,0]]],u);
    P.body=[b[0],0,b[1]];P.sway=-b[0]*.45;
    P.left=keyframes([[0,LEFT_REST],[.45,[-2,21,20]],
      [.65,[-3,21,20]],[.75,[-3,21,20]],[1,LEFT_REST]],u);
  } else {
    P.body[2]=Math.sin(t/IDLE_T*TAU)*.35;
    P.sway=Math.sin(t/IDLE_T*TAU-.7)*.25;
  }
  return P;
}

function cape(ctx,rf,P) {
  const c=rf.U(-7,0,0),s=P.sway;
  ctx.save();ctx.translate(c.x,c.y);
  // Broad, quiet cloth silhouette; a few worn hem notches, not many narrow folds.
  shape(ctx,[[-12,-51],[-19,-44],[-22,-29],[-29+s,-6],[-26+s,-1],
    [-22+s,-4],[-20+s,1],[-13+s,-1],[-8+s,2],[0+s,0],[8+s,2],
    [12+s,-1],[21+s,0],[23+s,-4],[29+s,-2],[27+s,-13],[19,-44],[12,-51]],
  C.red,{w:LW.outline,depth:3});
  shape(ctx,[[-16,-42],[-20,-29],[-27+s,-6],[-22+s,-9],[-15,-28]],
    C.redDark,{w:0,depth:0,speck:.6});
  line(ctx,[[-10,-41],[-13,-26],[-17+s,-7]],.65);
  line(ctx,[[10,-41],[14,-24],[19+s,-6]],.65);
  ctx.restore();
}

function torso(ctx,rf) {
  const U=rf.U,Q=pts=>pts.map(([b,z])=>U(0,b,z));
  plate(ctx,Q([[-14,49],[14,49],[18,40],[14,29],[17,21],[10,16],[-10,16],[-17,21],[-14,29]]),
    {w:LW.outline,depth:2.6});
  // Overlapping skirt plates and a central pointed breastplate, without a long tabard.
  for(const side of [-1,1]) {
    plate(ctx,Q([[side*3,28],[side*15,29],[side*19,17],[side*10,14],[side*5,17]]));
    plate(ctx,Q([[side*6,25],[side*16,26],[side*17,23],[side*7,22]]),{fill:C.light,w:.7,depth:.5});
  }
  if(rf.front) {
    plate(ctx,[U(8,-12,45),U(9,0,49),U(8,12,45),U(10,11,35),U(11,0,30),U(10,-11,35)],
      {fill:C.light,w:LW.part,depth:1.8});
    plate(ctx,[U(9,0,47),U(10,10,44),U(11,8,36),U(12,0,32)],
      {fill:C.iron,w:0,depth:0,speck:.5});
    line(ctx,[U(10,-10,35),U(12,0,31),U(10,10,35)],.8);
    plate(ctx,[U(10,-5,26),U(10,5,26),U(11,7,14),U(11,0,11),U(11,-7,14)],
      {fill:C.dark,depth:1});
  }
  plate(ctx,[U(11,-15,31),U(11,15,31),U(11,15,27),U(11,-15,27)],
    {fill:C.leather,w:LW.detail,depth:.6});
  if(rf.front) {
    const b=U(12,0,29);
    shape(ctx,[[b.x,b.y-5],[b.x+5,b.y],[b.x,b.y+5],[b.x-5,b.y]],C.edge,{w:1,depth:.7});
    shape(ctx,[[b.x,b.y-2.8],[b.x+2.6,b.y],[b.x,b.y+2.8],[b.x-2.6,b.y]],C.dark,{w:.6,depth:0});
  }
  const c=rf.U(1.5,0,49);
  shape(ctx,[[c.x-15,c.y-3],[c.x-8,c.y-6],[c.x,c.y-2],[c.x+9,c.y-6],
    [c.x+15,c.y-2],[c.x+11,c.y+4],[c.x,c.y+7],[c.x-11,c.y+3]],C.redDark);
  shape(ctx,[[c.x-10,c.y-3],[c.x,c.y+1],[c.x+10,c.y-3],
    [c.x+8,c.y+3],[c.x,c.y+5],[c.x-8,c.y+2]],C.iron,{w:1,depth:.8});
}

function helmet(ctx,rf) {
  const h=rf.U(1.5,0,69.5);
  ctx.save();ctx.translate(h.x,h.y);ctx.scale(rf.sx,1);
  // 43px helmet envelope (z=92.5..49.5), shared front/back. Crown points are extra.
  shape(ctx,[[-21,-12],[-16,-21],[-5,-23],[9,-22],[19,-16],[22,-5],
    [21,10],[11,18],[2,20],[-10,16],[-21,8]],C.iron,{w:LW.outline,depth:2.6});
  if(rf.front) {
    // Angular brow and cheek cuts lead into a narrow vertical chin opening.
    // Dense edge samples keep the shared paint path from rounding these corners.
    shape(ctx,[[-15,-12],[-10,-14],[5,-7],[20,-15],[19,3],[9,11],
      [9,18],[3,20],[3,11],[-14,4]],C.edge,
      {w:1.1,depth:0,speck:.3,amp:.03,step:1});
    shape(ctx,[[-13,-11],[-10,-12],[5,-5],[18,-12],[17,2],[7,10],
      [7,17],[5,18],[5,10],[-12,3]],C.void,
      {w:.8,depth:0,light:0,speck:0,amp:.02,step:1});
    const eyes=[ [[-8,-4],[-1,-.7],[1,1],[-3,2],[-6,.5]],
      [[10,0],[16,-4],[14,.8],[11,2],[9,1.8]] ];
    ctx.save();ctx.globalAlpha=.17;
    oval(ctx,-3,-.4,5.2,3,C.ember,{w:0,depth:0,light:0,speck:0});
    oval(ctx,12.5,-.3,4.1,3,C.ember,{w:0,depth:0,light:0,speck:0});
    ctx.restore();
    for(const eye of eyes)shape(ctx,eye,C.ember,{w:0,depth:0,light:0,speck:0,amp:.06});
    line(ctx,[[-18,-6],[-18,5],[-7,11],[0,14]],.65);
    shape(ctx,[[-18,6],[-8,12],[1,15],[1,18],[-10,14],[-20,7]],C.light,{w:.7,depth:.5});
    line(ctx,[[19,4],[18,10],[8,17]],.65);
  } else {
    // Rear is solid steel; seam and neck lames distinguish it from the face opening.
    shape(ctx,[[-16,-16],[-7,-21],[-3,-20],[-4,9],[-13,5],[-18,-2]],C.light,{w:0,depth:0,speck:.6});
    line(ctx,[[1,-20],[0,-5],[1,13]],.85);
    shape(ctx,[[-20,5],[-10,10],[2,13],[14,9],[21,4],[20,10],[11,16],
      [2,19],[-10,15],[-20,9]],C.dark,{w:1.2,depth:1});
    line(ctx,[[-15,9],[-5,13],[3,15],[15,10]],.7);
  }
  // Iron crown is seated on the brow as part of the helmet, not a hovering accessory.
  shape(ctx,[[-21,-12],[-23,-36],[-15,-23],[-11,-37],[-6,-23],[1,-42],
    [7,-24],[12,-36],[16,-23],[23,-38],[21,-13],[11,-11],[4,-7],[-6,-12]],
  C.edge,{w:LW.outline,depth:1.3,amp:.16});
  shape(ctx,[[-19,-14],[-20,-29],[-15,-19],[-11,-30],[-7,-18],[1,-35],
    [6,-18],[12,-29],[15,-18],[20,-30],[19,-15],[11,-14],[4,-10],[-6,-15]],
  C.dark,{w:.8,depth:1,amp:.13});
  if(rf.front) {
    shape(ctx,[[3,-32],[8,-23],[4,-14],[-1,-23]],C.edge,{w:1,depth:.4});
    shape(ctx,[[3,-29],[6,-23],[4,-17],[1,-23]],C.ruby,{w:.6,depth:.5,speck:0});
    shape(ctx,[[3,-28],[3,-22],[1.2,-23]],C.glow,{w:0,depth:0,light:0,speck:0});
    line(ctx,[[3,-22],[5.5,-23]],.5);
  } else {
    line(ctx,[[-13,-16],[-6,-16],[3,-12],[12,-16],[18,-17]],.6);
  }
  ctx.restore();
}

function legs(ctx,rf,P) {
  return legParts2(ctx,rf,P,{pants:C.dark,boot:C.iron,sole:C.dark,
    legR0:4.6,legR1:3.9,footR:4.3,soleR:3.8}).map((leg,i)=>{
    const base=leg.draw,side=i===0?1:-1,ft=i===0?P.footL:P.footR;
    return {...leg,draw:()=>{
      base();
      const hip=rf.W(P.body[0]*.5,side*6.5,21+P.body[2]*.6);
      const ankle=footProj(rf.dir,ft[0],ft[1],ft[2]+6);
      const knee={x:hip.x*.55+ankle.x*.45,y:hip.y*.55+ankle.y*.45};
      plate(ctx,taperPts(knee,ankle,4,3.3),{fill:C.light});
      shape(ctx,[[knee.x-4.5,knee.y-2],[knee.x,knee.y-4.5],[knee.x+4.5,knee.y-2],
        [knee.x+3.5,knee.y+2],[knee.x,knee.y+4],[knee.x-3.5,knee.y+2]],C.iron,{depth:1.2});
      line(ctx,[[knee.x-2.5,knee.y-1.3],[knee.x,knee.y-2.5],[knee.x+2.5,knee.y-1]],.6);
    }};
  });
}

function sword(ctx,hand,tip) {
  const dx=tip.x-hand.x,dy=tip.y-hand.y,len=Math.hypot(dx,dy)||1;
  const ux=dx/len,uy=dy/len,Q=(a,b)=>[hand.x+ux*a-uy*b,hand.y+uy*a+ux*b];
  shape(ctx,[Q(5,-5),Q(len-9,-4),Q(len,0),Q(len-9,4),Q(5,5)],C.blade,
    {w:LW.outline,depth:1,light:.35,amp:.16,speck:.9});
  shape(ctx,[Q(6,-4),Q(len-9,-3.3),Q(len-1,0),Q(7,0)],C.bladeLight,
    {w:0,depth:0,speck:.5,amp:.12});
  shape(ctx,[Q(7,0),Q(len-1,0),Q(len-9,3.5),Q(6,4.3)],C.bladeDark,
    {w:0,depth:0,speck:.5,amp:.1});
  line(ctx,[Q(9,0),Q(len-7,0)],.65);
  shape(ctx,[Q(0,-8),Q(3,-9),Q(6,-5),Q(6,5),Q(3,9),Q(0,8),Q(2,3),Q(2,-3)],
    C.edge,{w:1.3,depth:1});
  shape(ctx,[Q(-10,-2),Q(1,-2),Q(1,2),Q(-10,2)],C.leather,{w:1,depth:.8,speck:.4});
  for(const a of [-8,-5,-2])line(ctx,[Q(a,-1.8),Q(a+1,1.8)],.6);
  const p=Q(-11,0);oval(ctx,p[0],p[1],3,3,C.iron,{w:1,depth:.8});
  shape(ctx,[Q(4,0),Q(7,-2.3),Q(10,0),Q(7,2.3)],C.ruby,{w:.7,depth:.3,speck:0});
}

export function drawDemonKing(ctx,x,y,direction,action,t,scale=1,opts={}) {
  const P=demonPose(action,t),rf=rigFrame(direction,P.body),U=rf.U;
  const key=p=>bodyLayerKey(rf,...p),parts=legs(ctx,rf,P);
  parts.push({id:'cape',d:rf.front?-200:LAYER.cape,draw:()=>cape(ctx,rf,P)});
  parts.push({id:'torso',d:LAYER.torso,draw:()=>torso(ctx,rf)});
  parts.push({id:'helmet',d:LAYER.head,draw:()=>helmet(ctx,rf)});
  for(const side of [-1,1]) {
    const S=[0,side*15,46],H=side===-1?P.right:P.left;
    const E=ik2(S,H,14,15,[-5,side*2,-8]),s=U(...S),e=U(...E),h=U(...H);
    const behindCape=!rf.front&&s.d<U(0,0,S[2]).d;
    const armKey=p=>behindCape?Math.min(key(p),LAYER.cape-1):key(p);
    parts.push({id:'upper'+side,d:armKey(mid(S,E)),draw:()=>{
      plate(ctx,taperPts(s,e,5.7,4.7),{fill:C.dark});
      shape(ctx,[[s.x-8,s.y-1],[s.x-6,s.y-6],[s.x,s.y-8],[s.x+7,s.y-4],
        [s.x+9,s.y+2],[s.x+4,s.y+5],[s.x-5,s.y+4]],C.iron,{w:LW.outline,depth:2});
      shape(ctx,[[s.x-7,s.y+1],[s.x,s.y+3],[s.x+8,s.y],[s.x+7,s.y+3],
        [s.x+1,s.y+5],[s.x-6,s.y+3]],C.edge,{w:.7,depth:.5});
    }});
    const m={x:(e.x+h.x)/2,y:(e.y+h.y)/2};
    parts.push({id:'foreElbow'+side,d:armKey(E)+.01,draw:()=>plate(ctx,taperPts(e,m,4.7,4.3))});
    parts.push({id:'foreHand'+side,d:armKey(H),draw:()=>{
      plate(ctx,taperPts(m,h,4.3,3.7));
      line(ctx,[[h.x-2,h.y-2],[h.x+2,h.y-2]],.7);
    }});
    parts.push({id:'drape'+side,d:armKey(S)+.02,draw:()=>{
      shape(ctx,[[s.x-7,s.y-5],[s.x-1,s.y-9],[s.x+5,s.y-6],
        [s.x+8,s.y-2],[s.x+2,s.y-4],[s.x-6,s.y-2]],C.red,{w:1,depth:1.4});
      if(rf.front) {
        oval(ctx,s.x,s.y-5,2.9,3,C.edge,{w:.8,depth:.5});
        oval(ctx,s.x,s.y-5,1.5,1.8,C.ruby,{w:.5,depth:.2,speck:0});
      }
    }});
    if(side===-1) {
      const tip=U(...H.map((v,i)=>v+P.blade[i]*BLADE_LENGTH));
      parts.push({id:'greatsword',d:armKey(H)+.02,draw:()=>sword(ctx,h,tip)});
    }
    parts.push({id:'hand'+side,d:armKey(H)+.04,draw:()=>
      mittenHand(ctx,h,h.x-e.x,h.y-e.y,3.9,C.iron,{thumbSide:side*rf.sx})});
  }
  renderRig(ctx,x,y,scale,parts,{prefix:'demon-king',boil:0,shadow:opts.shadow});
}

export const character=Object.freeze({
  id:'demon-king',label:'魔王',kind:'humanoid',directional:true,draw:drawDemonKing,
  actions:{idle:{period:IDLE_T,frames:20},walk:{period:1/WALK_HZ,frames:16},
    attack:{period:ATTACK_T,keys:[0,.08,.16,.24,.32,.4,.45,.48,.51,.54,.57,.59,.62,.65,.7,.75,.82,.88,.94,.99],once:true}},
  frameBox:{x0:-96,x1:96,y0:-134,y1:26},
  equipment:{rightHand:'greatsword',leftHand:'free',back:'cape'},
});
export const studio=Object.freeze({name:'魔王',category:'モンスター族',
  description:'赤い宝石の鉄冠と暗い兜を戴く魔王。影の顔に赤い目が光り、右手の大剣で重い一撃を振り下ろします。',
  preview:{direction:'SE',phase:0}});
