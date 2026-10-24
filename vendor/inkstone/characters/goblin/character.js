/** Goblin-specific crouched proportions. +b = anatomical left (club). */
import {
  TAU, TH, TW, KX, KY, WALK_HZ, rigFrame, renderRig, walkFeet, footProj,
  bodyToWorld, ik2, keyframes, nrm3, paint, paintA, ellipsePts, taperPts,
  capsulePts, mittenHand, cLine, PAL,
} from '../../src/authoring.js';

const C={skin:'#a4ad70',shade:'#7f8b52',ear:'#879356',leather:'#92704d',
  dark:'#644c37',cloth:'#a48258',wrap:'#80654a',bone:'#e3d7b5',
  wood:'#8d6846',grain:'#b19065',iron:'#a7aaa0',ink:PAL.ink};
const IDLE_T=3.1,ATTACK_T=1.25;
const phase=(t,p)=>((t%p)+p)%p/p;
const shape=(ctx,pts,fill,o={})=>paintA(ctx,pts,{fill,w:1.5,depth:1.6,
  light:.16,speck:.7,speckScale:.3,amp:.25,...o});
const oval=(ctx,p,rx,ry,fill,o={})=>paint(ctx,ellipsePts(p.x,p.y,rx,ry,26),
  {fill,w:1.2,depth:1,speck:.5,speckScale:.3,amp:.2,...o});
const xy=p=>[p.x,p.y];
const between=(a,b,u)=>({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u});
const REST=[7,28,32,...nrm3([.1,.4,.91])];
const SWING=[
  [0,REST],[.28,[-1,24,56,...nrm3([-.5,.2,.85])]],
  [.42,[3,22,63,...nrm3([.25,.2,.95])]],
  [.54,[24,14,30,...nrm3([.88,.15,-.45])]],
  [.68,[22,15,27,...nrm3([.8,.2,-.5])]],
  [.86,[9,26,30,...nrm3([.4,.3,.85])]],[1,REST],
];

export function goblinPose(action,t) {
  const P={body:[0,0,0],footL:[0,10,0],footR:[0,-10,0],
    club:REST.slice(0,3),axis:REST.slice(3),free:[5,-23,22],ear:0,hem:0};
  if(action==='walk') {
    const w=walkFeet(t);
    P.footL=[w.footL[0],10,w.footL[2]];P.footR=[w.footR[0],-10,w.footR[2]];
    P.body=[w.s*.45,0,w.bob*.4];P.free[0]-=w.s*3;P.free[2]+=w.c*.8;
    P.club[0]+=w.s*1.4;P.club[2]+=w.c*.6;P.ear=w.s*.7;P.hem=w.s*1.3;
  } else if(action==='attack') {
    const u=phase(t,ATTACK_T),a=keyframes(SWING,u);
    P.club=a.slice(0,3);P.axis=nrm3(a.slice(3));
    const b=keyframes([[0,[0,0,0]],[.42,[-1,.7,-.6]],[.54,[2,-.7,.8]],
      [.68,[2,-.7,.8]],[1,[0,0,0]]],u);
    P.body=[b[0],0,b[1]];P.ear=b[2];P.hem=b[2];
    P.free=keyframes([[0,P.free],[.42,[5,-26,22]],[.6,[6,-25,22]],[1,P.free]],u);
  } else {
    const s=Math.sin(TAU*phase(t,IDLE_T));P.body[2]=s*.5;P.ear=s*.6;
  }
  return P;
}

function bandage(ctx,a,b,r) {
  paint(ctx,taperPts(a,b,r,r*.92),{fill:C.wrap,w:1.2,depth:1,speck:.6,speckScale:.3});
  const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,nx=-dy/L*r,ny=dx/L*r;
  for(const u of [.18,.47,.77]) {
    const p=between(a,b,u);cLine(ctx,[[p.x-nx,p.y-ny+1],[p.x+nx,p.y+ny-1]],.65);
  }
}

function legs(ctx,rf,P) {
  const out=[];
  for(const side of [1,-1]) {
    const ft=side===1?P.footL:P.footR,world=bodyToWorld(rf.dir,ft[0],ft[1]);
    // Match the common ground projection, then solve fixed-length bent legs.
    const ankleZ=ft[2]+4-(world.X+world.Y)*((TH/TW)*KX-KY);
    const hip=[-4+P.body[0]*.5,side*8,23+P.body[2]*.5],ank=[ft[0],ft[1],ankleZ];
    const knee=ik2(hip,ank,14,15,[8,side*5,0]);
    const h=rf.W(...hip),k=rf.W(...knee),a=rf.W(...ank);
    out.push({id:'leg'+side,d:rf.front?1+a.d*.01:-80+a.d*.1,draw:()=>{
      paint(ctx,taperPts(h,k,5.4,4.4),{fill:C.skin,w:1.5,depth:1.5,speck:.7,speckScale:.3});
      paint(ctx,taperPts(k,a,4,3.2),{fill:C.skin,w:1.5,depth:1.2,speck:.6,speckScale:.3});
      oval(ctx,k,4.3,3.8,C.skin,{w:1});
      bandage(ctx,between(k,a,.5),a,3.8);
      const f=(da,db,z=2.2)=>footProj(rf.dir,ft[0]+da,ft[1]+db,ft[2]+z);
      paint(ctx,capsulePts(f(-3,0),f(6,0),4.4),{fill:C.skin,w:1.7,depth:1.3,speck:.6,speckScale:.3});
      for(const b of [-3,0,3]) {
        const p=f(7,b),q=f(10,b,1.4),dx=q.x-p.x,dy=q.y-p.y,L=Math.hypot(dx,dy)||1;
        shape(ctx,[[p.x-dy/L*1.1,p.y+dx/L*1.1],[q.x,q.y],
          [p.x+dy/L*1.1,p.y-dx/L*1.1]],C.bone,{w:.65,depth:.3,speck:0});
      }
    }});
  }
  return out;
}

// Belt and hips share a pelvis centre behind the planted feet. The upper
// chest stays forward; changing depth below it makes a hunch, not a translation.
const waistSurface=(rf,P)=>-4-P.body[0]*.5+(rf.front?5:-5);
function torso(ctx,rf,P) {
  const U=rf.U,waist=waistSurface(rf,P);
  const Q=pts=>pts.map(([b,z])=>{
    const u=Math.max(0,Math.min(1,(z-27)/16));
    return xy(U(waist+((rf.front?7:-6)-waist)*u,b,z));
  });
  // Forward shoulders and a low pelvis create the hunch without scaling a human.
  shape(ctx,Q([[-12,43],[-15,37],[-10,27],[-14,22],[0,18],[14,22],[10,28],[14,39],[9,44]]),C.skin);
  shape(ctx,Q([[-11,45],[-15,40],[-11,33],[-13,27],[0,24],[13,27],[11,35],[14,42],[9,44],
    [5,37],[0,34],[-5,38]]),C.leather,{w:1.6});
  if(rf.front) {
    shape(ctx,Q([[-12,44],[-8,45],[13,28],[10,25]]),C.dark,{w:1});
    const [bx,by]=Q([[-1,35]])[0],b={x:bx,y:by};
    shape(ctx,[[b.x-3,b.y-3],[b.x+3,b.y-2],[b.x+2,b.y+3],[b.x-3,b.y+2]],C.iron,{w:.8});
    cLine(ctx,[[b.x-1,b.y-1],[b.x+1,b.y+1]],.7);
  } else {
    cLine(ctx,Q([[-7,41],[-5,35],[-4,29]]),.7);
    shape(ctx,Q([[6,43],[17,44],[13,39],[17,36],[7,39]]),C.dark,{w:1});
  }
}

function loincloth(ctx,rf,P,central=false) {
  const waist=waistSurface(rf,P);
  // The centre flap drapes slightly forward between the thighs. Side flaps
  // stay close to the pelvis and are occluded by the bent knees in front views.
  const Q=pts=>pts.map(([b,z])=>xy(rf.U(waist+(central?(28-z)*.18:0),b,z)));
  if(!rf.front) {
    shape(ctx,Q([[-12,28],[-19,18],[-14,20],[-15,13],[-9,17],[-5,10],[-2,14],
      [1,9],[5,16],[8,13],[12,18],[18,16],[15,23],[11,29]]),C.cloth,{w:1.6});
  } else if(central) {
    shape(ctx,Q([[-7,28],[7,28],[6,18],[3,14],[1,9],[-2,14],[-5,11],[-7,18]]),C.cloth,{w:1.5});
    cLine(ctx,Q([[-3,25],[-4,19],[-3,16]]),.65);
    cLine(ctx,Q([[4,25],[2,19],[1,15]]),.65);
  } else {
    for(const side of [-1,1])shape(ctx,Q([[side*6,28],[side*13,28],[side*19,18],
      [side*14,20],[side*15,13],[side*9,17],[side*7,22]]),C.cloth,{w:1.5});
  }
}

function belt(ctx,rf,P) {
  const U=rf.U,a=waistSurface(rf,P)+ (rf.front?.7:-.7);
  const Q=pts=>pts.map(([b,z])=>xy(U(a,b,z)));
  shape(ctx,Q([[-14,29],[14,29],[14,25],[-14,25]]),C.dark,{w:1.2,depth:1});
  if(rf.front) {
    const p=U(a+.5,0,27);shape(ctx,[[p.x-3,p.y-2.5],[p.x+3,p.y-2.5],[p.x+3,p.y+2.5],[p.x-3,p.y+2.5]],C.iron,{w:.9,depth:0});
    shape(ctx,[[p.x-1.6,p.y-1],[p.x+1.5,p.y-1],[p.x+1.5,p.y+1],[p.x-1.6,p.y+1]],C.dark,{w:.4,depth:0});
  }
}

function head(ctx,rf,P) {
  const h=rf.U(9,0,62);
  ctx.save();ctx.translate(h.x,h.y);ctx.scale(rf.sx,1);
  for(const side of [-1,1]) {
    const near=side===-1?1:.83,tip=P.ear;
    const pts=[[side*16,-10],[side*(38*near),-23+tip],[side*32*near,-10],
      [side*25,1],[side*18,5],[side*14,0]];
    shape(ctx,pts,C.skin,{w:1.7});
    shape(ctx,[[side*18,-7],[side*31*near,-17+tip],[side*25,-5],[side*19,0]],C.ear,{w:.8,depth:.6});
    cLine(ctx,[[side*19,-3],[side*22,-7],[side*28*near,-13+tip]],.6);
  }
  shape(ctx,[[-21,-6],[-20,-15],[-14,-22],[-4,-25],[8,-24],[18,-19],[23,-10],
    [23,2],[20,15],[12,20],[-2,20],[-14,17],[-21,8]],C.skin,{w:1.9,depth:2,round:6});
  if(rf.front) {
    // Small eyes under sloping brows, a blunt nose and two modest lower fangs.
    oval(ctx,{x:-3,y:0},2.4,5,C.ink,{w:.6,depth:0,speck:0});
    oval(ctx,{x:14,y:1},2,4.5,C.ink,{w:.6,depth:0,speck:0});
    shape(ctx,[[-9,-7],[-4,-5],[2,-2],[3,-6],[4,-1],[1,0],[-5,-3]],C.skin,{w:0,depth:0,speck:0});
    cLine(ctx,[[-9,-7],[-4,-5],[2,-2],[4,-3]],1.15);
    cLine(ctx,[[10,-2],[13,-2],[19,-6]],1.1);
    const nose=oval(ctx,{x:9,y:8},4.3,2.7,C.skin,{w:.8,depth:.7,speck:0});
    void nose;
    cLine(ctx,[[7,8],[8,7.6]],.65);cLine(ctx,[[11,8],[12,8.5]],.65);
    cLine(ctx,[[-9,13],[-5,11.5],[5,12],[15,15]],1);
    shape(ctx,[[-5,12],[-3,7.6],[-1.5,12]],C.bone,{w:.75,depth:.2,speck:0});
    shape(ctx,[[11,13.6],[13,10.5],[14.5,15]],C.bone,{w:.75,depth:.2,speck:0});
    cLine(ctx,[[-15,5],[-12,6]],.55);
    cLine(ctx,[[5,-11],[6,-8]],.6);
  } else {
    cLine(ctx,[[-13,-14],[-7,-18],[-2,-18]],.55);
    cLine(ctx,[[11,13],[6,15],[2,14]],.55);
  }
  ctx.restore();
}

function arm(ctx,rf,j,part) {
  const s=rf.U(...j.S),e=rf.U(...j.E),h=rf.U(...j.H);
  if(part==='upper') {
    paint(ctx,taperPts(s,e,4.7,3.5),{fill:C.skin,w:1.5,depth:1.3,speck:.65,speckScale:.3});
  } else {
    paint(ctx,taperPts(e,h,3.6,2.9),{fill:C.skin,w:1.4,depth:1.2,speck:.6,speckScale:.3});
    bandage(ctx,between(e,h,.35),between(e,h,.88),3.8);
  }
}

function club(ctx,rf,P) {
  const hand=rf.U(...P.club),end=rf.U(...P.club.map((v,i)=>v+P.axis[i]*37));
  const dx=end.x-hand.x,dy=end.y-hand.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
  const q=(s,w)=>[hand.x+ux*s-uy*w,hand.y+uy*s+ux*w];
  const len=L;
  shape(ctx,[q(-10,-2.5),q(5,-2),q(len-11,-6),q(len-2,-6.5),q(len-3,-3),
    q(len+2,-2),q(len,1),q(len+1,4),q(len-3,6),q(len-13,5),q(4,2),q(-10,3)],C.wood,{w:1.8,depth:1.7});
  cLine(ctx,[q(5,-.4),q(len-14,-2),q(len-5,-3)],.7);
  cLine(ctx,[q(8,1),q(len-13,2),q(len-4,3)],.65);
  for(const s of [-7,-3,1,5])cLine(ctx,[q(s,-2),q(s+1,2)],.6);
  for(const [a,b,r] of [[len-5,0,2.4],[len-15,1,1.9],[len-8,-6,1.8],[len-15,5,1.7]]) {
    shape(ctx,[q(a-r,b-1),q(a-r*.6,b-r),q(a+r*.7,b-r),q(a+r,b+.4),q(a,b+r),q(a-r,b+1)],C.iron,{w:.8,depth:.5,speck:.3});
  }
}

export function drawGoblin(ctx,x,y,direction,action,t,scale=1,opts={}) {
  const P=goblinPose(action,t),rf=rigFrame(direction,P.body),U=rf.U;
  const parts=legs(ctx,rf,P);
  parts.push({id:'torso',d:0,draw:()=>torso(ctx,rf,P)});
  parts.push({id:'sideCloth',d:rf.front?.5:1,draw:()=>loincloth(ctx,rf,P)});
  if(rf.front)parts.push({id:'frontCloth',d:2.5,draw:()=>loincloth(ctx,rf,P,true)});
  parts.push({id:'belt',d:3,draw:()=>belt(ctx,rf,P)});
  parts.push({id:'neck',d:5,draw:()=>paint(ctx,taperPts(U(4,0,40),U(8,0,51),6.5,7),
    {fill:C.skin,w:1.2,depth:1,speck:.4,speckScale:.3})});
  parts.push({id:'head',d:100,draw:()=>head(ctx,rf,P)});
  for(const side of [1,-1]) {
    const S=[3,side*13,43],H=side===1?P.club:P.free;
    const E=ik2(S,H,13,14,side===1?[-3,5,-12]:[0,-12,-8]);
    const j={S,E,H},near=rf.vt*side>0,d=near?30:-30;
    parts.push({id:'upper'+side,d,draw:()=>arm(ctx,rf,j,'upper')});
    parts.push({id:'fore'+side,d:d+1,draw:()=>arm(ctx,rf,j,'fore')});
    const heldDepth=side===1?(near?110:-20):d+2;
    if(side===1)parts.push({id:'club',d:heldDepth,draw:()=>club(ctx,rf,P)});
    parts.push({id:'hand'+side,d:heldDepth+1,draw:()=>{
      const h=U(...H),e=U(...E);mittenHand(ctx,h,h.x-e.x,h.y-e.y,side===1?3.7:4.2,C.skin,{thumbSide:side*rf.sx});
      if(side===-1) {
        // Two small hooked fingers distinguish the empty hand from the club grip.
        for(const offset of [-2,1])cLine(ctx,[[h.x+offset,h.y+1],[h.x+offset-.8,h.y+4],[h.x+offset+1,h.y+4]],.7);
      }
    }});
  }
  renderRig(ctx,x,y,scale,parts,{prefix:'goblin',boil:0,shadow:opts.shadow});
}

export const character=Object.freeze({
  id:'goblin',label:'ゴブリン',kind:'humanoid',directional:true,draw:drawGoblin,
  actions:{idle:{period:IDLE_T,frames:16},walk:{period:1/WALK_HZ,frames:16},
    attack:{period:ATTACK_T,keys:[0,.1,.2,.28,.36,.42,.46,.5,.54,.6,.68,.78,.86,.94,.98],once:true}},
  frameBox:{x0:-85,x1:85,y0:-120,y1:28},equipment:{leftHand:'club',rightHand:'free'},
});
export const studio={name:'ゴブリン',category:'魔物',
  description:'大きな耳と小さな牙の、前かがみのゴブリン。粗末な革装備をまとい、左手の鋲付き棍棒を振り下ろします。',
  preview:{direction:'SE',phase:0}};
