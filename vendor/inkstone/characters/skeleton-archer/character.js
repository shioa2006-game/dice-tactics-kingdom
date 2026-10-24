/** Bare-skulled archer. Left holds the bow; right handles the string and arrow. */
import {
  WALK_HZ, LW, LAYER, DRAW, PAL, KX, rigFrame, renderRig, bodyToWorld,
  groundDirScreen, footProj, ik2, nrm3, vlerp, yawToBody, bodyLayerKey,
  paint, paintA, ellipsePts, taperPts, cLine, mittenHand,
} from '../../src/authoring.js';
import { bone, boneStroke } from '../../src/characters/skeleton.js';
import {
  AIM_YAW, QUIVER_TOP, ARCHER_ATTACK_T, ARCHER_IDLE_PERIOD, ARCHER_RELEASE_U,
  ARROW_LEN, archerPose, bowCantSign, bowGeometry, drawArrowShape,
} from '../../src/characters/archer-pose.js';
import { drawBow, drawQuiver, bandAcross, polyStroke } from '../../src/characters/archer-parts.js';
import { ARCHER_ATTACK_KEYS, archerReleaseInfo } from '../../src/characters/archer.js';

const C={bone:'#f5e7cd',hollow:'#29241d',
  leather:'#88603f',dark:'#60442f',gold:'#bc9861'};
// The shared cache's modulo can round the release phase down by a few ulps.
// Place its no-arrow frame a billionth early, and use the same boundary in the pose.
const RELEASE_FRAME=ARCHER_RELEASE_U-1e-9;
const ATTACK_KEYS=Object.freeze(ARCHER_ATTACK_KEYS.map(u=>u===ARCHER_RELEASE_U?RELEASE_FRAME:u));
const xy=p=>[p.x,p.y];
const shape=(ctx,pts,fill,o={})=>paintA(ctx,pts,{fill,w:LW.part,depth:1.3,
  light:.2,speck:.65,speckScale:.3,amp:.22,step:3,...o});
const oval=(ctx,x,y,rx,ry,fill,o={})=>paint(ctx,ellipsePts(x,y,rx,ry,24),
  {fill,w:1.2,depth:.7,speck:.2,speckScale:.3,amp:.16,...o});

function pose(action,t) {
  // Reuse the established nock/release timing without restarting a finished shot.
  const finished=action==='attack'&&t>=ARCHER_ATTACK_T;
  const P=archerPose(finished?'idle':action,finished?0:action==='attack'?Math.max(0,t):t);
  P.footL[1]=9;P.footR[1]=-9;
  if(action==='attack'&&t>=RELEASE_FRAME*ARCHER_ATTACK_T) {
    // The held arrow must be absent when the shared projectile starts at .75.
    P.arrow=null;P.draw=0;
    P.released=Math.max(0,t-ARCHER_RELEASE_U*ARCHER_ATTACK_T);
    P.vib=finished?0:Math.sin(P.released*70)*Math.exp(-P.released*18)*4;
  }
  if(action==='idle'||action==='walk') {
    P.body[2]*=.45;P.quiverSway*=.5;
  }
  return P;
}

function skull(ctx,rf) {
  const h=rf.U(1.5,0,69.5);
  ctx.save();ctx.translate(h.x,h.y);ctx.scale(rf.sx*.94,.94);
  // 47 * .94 = 44px head, top z=94; no hood or oversized accessory.
  shape(ctx,[[-23,4],[-25,-5],[-22,-16],[-14,-23],[-3,-26],[10,-24],
    [20,-17],[24,-6],[23,5],[19,11],[12,13],[7,17],[-5,17],[-14,13],[-21,10]],
    C.bone,{w:LW.outline,depth:2.2,speck:1.2});
  if(rf.front) {
    shape(ctx,[[-9,10],[-3,13],[6,14],[17,9],[16,17],[12,18],[11,21],
      [7,21],[6,19],[3,21],[0,21],[-1,18],[-4,20],[-7,18]],C.bone,{w:1.4,depth:.8,speck:.15});
    for(const [x,y] of [[-3,16],[2,17],[7,16],[12,14]])cLine(ctx,[[x,y-1],[x,y+3]],.75);
    shape(ctx,[[-12,-1],[-10,-7],[-3,-6],[1,-3],[1,4],[-3,8],[-10,7],[-13,3]],
      C.hollow,{w:1.2,depth:0,speck:0});
    shape(ctx,[[12,-5],[16,-10],[20,-11],[21,-5],[20,2],[17,5],[13,4]],
      C.hollow,{w:1.1,depth:0,speck:0});
    shape(ctx,[[6,4],[8,8],[7,11],[4,11],[3,9]],C.hollow,{w:.7,depth:0,speck:0});
    cLine(ctx,[[-20,7],[-15,8],[-14,11],[-9,12]],.75);
    cLine(ctx,[[-10,-22],[-12,-17],[-8,-13],[-10,-9]],.65);
    cLine(ctx,[[-12,-17],[-16,-16]],.5);
  } else {
    cLine(ctx,[[0,-24],[-2,-18],[1,-14],[-2,-9],[1,-5],[-1,0]],.75);
    cLine(ctx,[[-20,6],[-14,3],[-10,5],[-5,2],[-1,4],[4,2],[10,5],[18,4]],.7);
    shape(ctx,[[-7,12],[-3,10],[3,10],[8,13],[4,17],[-2,17]],'#cfb992',{w:1,depth:.5,speck:.2});
  }
  ctx.restore();
}

function torso(ctx,rf) {
  const U=rf.UY,Q=pts=>pts.map(p=>U(...p));
  for(let i=0;i<5;i++) {
    const p=U(-3,0,28+i*4.5);oval(ctx,p.x,p.y,2.8,1.6,C.bone,{w:.9,speck:0});
  }
  for(let i=0;i<3;i++) {
    const z=46-i*5,b=11-i;
    boneStroke(ctx,Q([[-2,-b,z],[4,-b,z-2],[7,-b*.5,z-4],[7,0,z-3],
      [7,b*.5,z-4],[4,b,z-2],[-2,b,z]]).map(xy),2.1);
  }
  if(rf.front)boneStroke(ctx,Q([[8,0,46],[8,0,32]]).map(xy),2.5);
  else boneStroke(ctx,Q([[-7,0,46],[-7,0,29]]).map(xy),2.5);
  boneStroke(ctx,Q([[0,-14,47],[3,-6,49],[2,0,48],[3,6,49],[0,14,47]]).map(xy),2.3);
  for(const z of [49,52]) {const p=U(0,0,z);oval(ctx,p.x,p.y,3,1.7,C.bone,{w:1,speck:0});}
  const a=rf.front?9:-8;
  paint(ctx,Q([[a,-13,46],[a,-9,48],[a,12,30],[a,9,27]]),
    {fill:C.leather,w:1.3,depth:.7,speck:.4,amp:.2});
  paint(ctx,Q([[0,-13,27],[0,13,27],[2,16,17],[2,10,19],[2,8,13],
    [2,4,17],[2,0,11],[2,-4,16],[2,-9,13],[2,-11,19],[2,-16,17]]),
    {fill:C.leather,w:1.6,depth:1.4,speck:.7,amp:.25});
  paint(ctx,Q([[a,-14,30],[a,14,30],[a,14,26],[a,-14,26]]),
    {fill:C.dark,w:1.2,depth:.6,speck:.3,amp:.2});
  if(rf.front) {
    const p=U(10,0,28);
    shape(ctx,[[p.x-3,p.y-2.8],[p.x+3,p.y-2.8],[p.x+3,p.y+2.8],[p.x-3,p.y+2.8]],C.gold,{w:.8,depth:.3});
    shape(ctx,[[p.x-1.6,p.y-1.4],[p.x+1.6,p.y-1.4],[p.x+1.6,p.y+1.4],[p.x-1.6,p.y+1.4]],C.dark,{w:.5,depth:0});
  }
}

function legs(ctx,rf,P) {
  return [1,-1].map((side,i)=>{
    const ft=i===0?P.footL:P.footR,hip=rf.W(P.body[0]*.3,side*8,24+P.body[2]*.4);
    const ankle=footProj(rf.dir,ft[0],ft[1],ft[2]+5);
    const outward=rf.W(0,side,0);
    const knee3=ik2([hip.x,hip.y,0],[ankle.x,ankle.y,0],12,13,[outward.x,-.1,0]);
    const knee={x:knee3[0],y:knee3[1]};
    return {id:'leg'+side,d:hip.d,draw:()=>{
      bone(ctx,...xy(hip),...xy(knee),2.6);bone(ctx,...xy(knee),...xy(ankle),2.2);
      const f=(a,b,z)=>footProj(rf.dir,ft[0]+a,ft[1]+b,ft[2]+z);
      const heel=f(-2,0,2),ball=f(4,0,2);
      paint(ctx,taperPts(heel,ball,3,3.4),{fill:C.bone,w:1.2,depth:.6,speck:.15});
      for(const b of [-2.5,0,2.5]) {
        const p=f(4,b,2),q=f(9-Math.abs(b)*.35,b,1.5);
        paint(ctx,taperPts(p,q,1.3,1.5),{fill:C.bone,w:.9,depth:.3,speck:0});
      }
      const cuff={x:ankle.x*.8+knee.x*.2,y:ankle.y*.8+knee.y*.2};
      bandAcross(ctx,cuff,ankle.x-knee.x,ankle.y-knee.y,3.4,2.2,C.leather);
      bandAcross(ctx,ankle,ankle.x-knee.x,ankle.y-knee.y,3.2,1.1,C.dark);
    }};
  });
}

export function drawSkeletonArcher(ctx,x,y,direction,action,t,scale=1,opts={}) {
  const P=pose(action,t),rf=rigFrame(direction,P.body,P.yaw),U=rf.U;
  // Match the existing archer's ground-plane projection for both hands, bow and arrow.
  const groundY=groundDirScreen(1,0).y;
  const UG=(a,b,z)=>{const w=bodyToWorld(rf.dir,a+P.body[0],b+P.body[1]);
    return {x:(w.X-w.Y)*KX,y:(w.X+w.Y)*groundY-z-P.body[2],d:w.X+w.Y};};
  const key=p=>bodyLayerKey(rf,...p);
  P.bowUp=nrm3([P.bowUp[0],P.bowUp[1]+bowCantSign(direction)*(.12+.62*P.yaw/AIM_YAW),P.bowUp[2]]);
  const geo=bowGeometry(P),parts=legs(ctx,rf,P);
  const joints=Object.fromEntries(['L','R'].map(side=>{
    const a=yawToBody(rf,0,side==='L'?14:-14),S=[...a,47],H=side==='L'?P.grip:P.rHand;
    return [side,{S,H,E:ik2(S,H,13.5,13.5,side==='L'?P.elbowL:P.elbowR)}];
  }));
  const nearBow=direction==='SW'&&geo.nocked;
  const nockedDepth=Math.min(key(joints.L.E),key(geo.G)-.02)-.04;
  const armDepth=(side,d)=>nearBow&&side==='R'?Math.min(d,nockedDepth-.02):d;
  parts.push({id:'torso',d:LAYER.torso,draw:()=>torso(ctx,rf)});
  parts.push({id:'skull',d:LAYER.head,draw:()=>skull(ctx,rf)});
  const qa=yawToBody(rf,QUIVER_TOP[0],QUIVER_TOP[1]);
  parts.push({id:'quiver',d:Math.min(key([...qa,QUIVER_TOP[2]]),LAYER.head-1),draw:()=>drawQuiver(ctx,rf,P)});
  for(const side of ['L','R']) {
    const {S,E,H}=joints[side],s=U(...S),e=U(...E),h=UG(...H);
    const handKey=side==='R'&&H[0]>-2?[H[0]+10,H[1],H[2]]:H;
    const wrist={x:e.x+(h.x-e.x)*.8,y:e.y+(h.y-e.y)*.8};
    const m={x:(e.x+wrist.x)/2,y:(e.y+wrist.y)/2};
    parts.push({id:'upper'+side,d:Math.min(armDepth(side,key(E)),LAYER.head-.6),
      draw:()=>bone(ctx,...xy(s),...xy(e),2.4)});
    // Split forearms: the drawing elbow can be behind the body while its hand meets the string.
    for(const [id,a,b,d] of [['E',e,m,key(E)],['H',m,wrist,key(handKey)]]) {
      parts.push({id:'fore'+id+side,d:Math.min(armDepth(side,d),LAYER.head-.6),draw:()=>{
        bone(ctx,...xy(a),...xy(b),2.1);
        if(id==='H')bandAcross(ctx,wrist,h.x-e.x,h.y-e.y,3.3,2,C.leather);
      }});
    }
    const d=side==='R'&&nearBow?nockedDepth+.01:key(handKey);
    parts.push({id:'hand'+side,d,draw:()=>{
      mittenHand(ctx,h,h.x-e.x,h.y-e.y,3.5,C.bone,{thumbSide:side==='L'?-rf.sx:rf.sx});
      cLine(ctx,[[h.x-1.5,h.y],[h.x+1.5,h.y+.3]],.55);
    }});
  }
  parts.push({id:'bow',d:key(geo.G)-.02,draw:()=>drawBow(ctx,UG,geo)});
  parts.push({id:'stringUpper',d:Math.min(key(vlerp(geo.tipT,geo.stringMid,.5)),LAYER.head-.5),
    draw:()=>polyStroke(ctx,[UG(...geo.tipT),UG(...geo.stringMid)],DRAW.lw,PAL.ink)});
  parts.push({id:'stringLower',d:key(vlerp(geo.G,geo.stringMid,.5)),
    draw:()=>polyStroke(ctx,[UG(...geo.stringMid),UG(...geo.tipB)],DRAW.lw,PAL.ink)});
  // Exactly one held arrow before release; after release only the shared projectile draws it.
  if(P.arrow) {
    const nock=UG(...P.rHand),forward=groundDirScreen(...rf.dir.f);
    let d=nrm3([forward.x,forward.y,0]),len=ARROW_LEN;
    if(P.arrow.mode==='hand') {
      const q=UG(...P.rHand.map((v,i)=>v+P.arrow.dir[i])),vx=q.x-nock.x,vy=q.y-nock.y;
      const l=Math.hypot(vx,vy)||1;d=[vx/l,vy/l,0];len*=Math.min(1,l);
    }
    const ha=P.rHand[0]>-2?[P.rHand[0]+10,P.rHand[1],P.rHand[2]]:P.rHand;
    parts.push({id:'arrow',d:nearBow?nockedDepth:(P.arrow.mode==='nock'?key(geo.G):key(ha))+.02,
      draw:()=>drawArrowShape(ctx,nock,{x:d[0],y:d[1]},len,DRAW.lw)});
  }
  renderRig(ctx,x,y,scale,parts,{prefix:'skeleton-archer',boil:0,shadow:opts.shadow});
}

export const character=Object.freeze({
  id:'skeleton-archer',label:'骸骨弓兵',kind:'humanoid',directional:true,draw:drawSkeletonArcher,
  actions:{idle:{period:ARCHER_IDLE_PERIOD,frames:16},walk:{period:1/WALK_HZ,frames:16},
    attack:{period:ARCHER_ATTACK_T,keys:ATTACK_KEYS,once:true,releaseAt:ARCHER_RELEASE_U}},
  frameBox:{x0:-86,x1:86,y0:-126,y1:28},
  equipment:{leftHand:'bow',rightHand:'string',back:'quiver'},
  projectile:{type:'arrow',releaseAt:ARCHER_RELEASE_U,origin:archerReleaseInfo,draw:drawArrowShape,length:ARROW_LEN},
});
export const studio=Object.freeze({name:'骸骨弓兵',category:'モンスター族',
  description:'象牙色の骨に茶色の革装備をまとった骸骨の射手。左手の木弓に右手で矢をつがえ、前方へ一射します。',
  preview:{direction:'SE',phase:0}});
