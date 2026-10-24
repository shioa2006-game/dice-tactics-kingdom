/** Storybook king. Body coordinates: +b is left, -b is the sword-bearing right. */
import {
  TAU, WALK_HZ, PAL, LW, LAYER, rigFrame, renderRig, walkFeet, footProj,
  legParts2, ik2, keyframes, nrm3, bodyLayerKey, yawToBody,
  paint, paintA, taperPts, ellipsePts, cLine, mittenHand,
} from '../../src/authoring.js';

const C = Object.freeze({
  silver: '#d9ded9', silverLight: '#f1eee1', silverShade: '#a6b0ad',
  red: '#984c43', redShade: '#773b36', cream: '#e9d8b3',
  gold: '#d9ac5c', goldLight: '#f2d494', hair: '#795336', hairLight: '#a67a50',
  skin: '#f2d3a3', leather: '#72543d', jewel: '#6babb9',
});
const IDLE_T = 3.4, ATTACK_T = 1.3;
// Hands hang below the shoulders, with a small bend rather than a shield pose.
// The blade slopes forward as well as down so its point stays above the floor.
const REST = [4, -20, 19, .9, -.16, -.41];
const LEFT_REST = [1, 19, 18];
const SWING = [
  [0, REST], [.12, [3, -22, 27, .87, -.35, .2]],
  [.22, [-2, -26, 42, -.25, -.65, .72]],
  [.38, [0, -28, 52, -.1, -.7, .72]], [.46, [3, -27, 53, .32, -.55, .77]],
  [.56, [22, -18, 31, .88, -.12, -.46]], [.68, [18, -19, 25, .8, -.12, -.58]],
  [.82, [10, -20, 21, .88, -.16, -.44]], [1, REST],
];
const mid = (a, b) => a.map((v, i) => (v + b[i]) / 2);
const shape = (ctx, pts, fill, o = {}) => paintA(ctx, pts, {
  fill, w: LW.part, depth: 1.5, light: .2, speck: .65, speckScale: .3, amp: .22, ...o,
});
const plate = (ctx, pts, o = {}) => paint(ctx, pts, {
  fill: C.silver, w: LW.part, depth: 1.6, light: .5, speck: .65, speckScale: .3, amp: .22, ...o,
});
const oval = (ctx, x, y, rx, ry, fill, o = {}) => plate(ctx, ellipsePts(x, y, rx, ry, 24), { fill, ...o });
const line = (ctx, pts, w = LW.fine) => cLine(ctx, pts.map(p => Array.isArray(p) ? p : [p.x, p.y]), w);

function kingPose(action, t) {
  const P = { body: [0, 0, 0], yaw: 0, footL: [0, 6, 0], footR: [0, -6, 0],
    right: REST.slice(0, 3), left: LEFT_REST.slice(), blade: nrm3(REST.slice(3)), sway: 0 };
  if (action === 'walk') {
    const w = walkFeet(t);
    P.footL = w.footL; P.footR = w.footR;
    P.body = [.5, 0, w.bob * .55]; P.yaw = w.s * .025;
    P.right[0] -= w.s * 2.5; P.left[0] += w.s * 3;
    P.sway = Math.sin(w.ph - .8) * 1.3;
  } else if (action === 'attack') {
    // Clamp the one-shot pose: the final frame settles at rest, including t >= period.
    const u = Math.max(0, Math.min(1, t / ATTACK_T)), k = keyframes(SWING, u);
    P.right = k.slice(0, 3); P.blade = nrm3(k.slice(3));
    const motion = keyframes([[0, [0, 0, 0]], [.38, [-1, .1, .7]],
      [.46, [-1, .1, .7]], [.56, [2, -.12, -.6]], [.7, [1.5, -.08, -.4]], [1, [0, 0, 0]]], u);
    P.body = [motion[0], 0, motion[2]]; P.yaw = motion[1]; P.sway = -motion[0] * .7;
    P.left = keyframes([[0, LEFT_REST], [.38, [3, 20, 19]],
      [.56, [-2, 20, 19]], [.7, [-1, 20, 19]], [1, LEFT_REST]], u);
  } else {
    const breathe = Math.sin(t / IDLE_T * TAU);
    P.body[2] = breathe * .55; P.sway = Math.sin(t / IDLE_T * TAU - .8) * .3;
  }
  return P;
}

function cape(ctx, rf, P) {
  const c = rf.U(-7, 0, 0), s = P.sway;
  ctx.save(); ctx.translate(c.x, c.y);
  // A single flared cloth mass with a broad, legible cream hem and only two folds.
  shape(ctx, [[-12,-51],[-19,-45],[-22,-30],[-28+s,-8],[-26+s,-3],
    [-12+s,0],[2+s,1],[16+s,-1],[29+s,-5],[24+s,-23],[19,-44],[12,-51]], C.red,
  { w: LW.outline, depth: 3 });
  shape(ctx, [[-28+s,-8],[-15+s,-5],[0+s,-4],[16+s,-5],[28+s,-9],[29+s,-5],
    [16+s,-1],[2+s,1],[-12+s,0],[-26+s,-3]], C.cream, { w: LW.detail, depth: .7 });
  line(ctx, [[-11,-42],[-15,-24],[-19+s,-8]], .7);
  line(ctx, [[11,-42],[15,-23],[20+s,-8]], .7);
  ctx.restore();
}

function torso(ctx, rf) {
  const U = rf.UY, Q = pts => pts.map(([b,z]) => U(0,b,z));
  plate(ctx, Q([[-13,49],[13,49],[17,41],[14,29],[17,20],[9,16],[-9,16],[-17,20],[-14,29]]),
    { w: LW.outline, depth: 2.5 });
  for (const side of [-1,1]) {
    plate(ctx, Q([[side*5,27],[side*15,29],[side*19,18],[side*9,15]]));
    line(ctx, Q([[side*8,23],[side*16,24]]), .6);
  }
  if (rf.front) {
    // Cream under-panel makes the edging visible even at the normal 1.25x scale.
    plate(ctx, [U(9,-9,48),U(9,9,48),U(10,10,29),U(10,13,14),U(10,0,10),U(10,-13,14),U(10,-10,29)],
      { fill: C.cream, depth: 1, w: LW.part });
    plate(ctx, [U(10,-6,47),U(10,6,47),U(11,7,29),U(11,9,16),U(11,0,13),U(11,-9,16),U(11,-7,29)],
      { fill: C.red, depth: 1.3, w: LW.detail });
    const crest = U(12,0,39);
    shape(ctx, [[crest.x,crest.y-4],[crest.x+2,crest.y-1],[crest.x+3,crest.y-2],
      [crest.x+2,crest.y+2],[crest.x,crest.y+4],[crest.x-2,crest.y+2],
      [crest.x-3,crest.y-2],[crest.x-2,crest.y-1]], C.gold, { w: .6, depth: 0, speck: 0 });
  }
  plate(ctx, [U(11,-15,31),U(11,15,31),U(11,15,27),U(11,-15,27)],
    { fill: C.leather, w: LW.detail, depth: .8 });
  if (rf.front) {
    const b = U(12,0,29);
    shape(ctx, [[b.x-3.4,b.y-2.8],[b.x+3.4,b.y-2.8],[b.x+3.4,b.y+2.8],[b.x-3.4,b.y+2.8]], C.gold, { w: .9, depth: .5 });
    shape(ctx, [[b.x-1.8,b.y-1.4],[b.x+1.8,b.y-1.4],[b.x+1.8,b.y+1.4],[b.x-1.8,b.y+1.4]], C.leather, { w: .5, depth: 0, speck: 0 });
  }
  // The collar bridges the chin at z=49.5 to the shoulders; no floating head.
  const c = rf.U(1.5,0,49);
  shape(ctx, [[c.x-14,c.y-3],[c.x-7,c.y-5],[c.x,c.y-1],[c.x+8,c.y-5],
    [c.x+15,c.y-2],[c.x+10,c.y+5],[c.x,c.y+7],[c.x-10,c.y+4]], C.redShade);
  shape(ctx, [[c.x-11,c.y-3],[c.x,c.y+1],[c.x+10,c.y-3],[c.x+7,c.y+2],
    [c.x,c.y+4],[c.x-8,c.y+1]], C.cream, { w: .8, depth: .6 });
}

function head(ctx, rf) {
  const h = rf.U(1.5,0,69.5);
  ctx.save(); ctx.translate(h.x,h.y); ctx.scale(rf.sx,1);
  // Head envelope is z=92.5..49.5: 43px, excluding the crown's raised points.
  shape(ctx, [[-20,-13],[-15,-21],[-5,-23],[9,-22],[19,-15],[22,-5],[21,6],
    [23,11],[19,10],[18,17],[12,16],[9,20],[-3,19],[-12,20],[-18,15],
    [-22,16],[-20,9],[-23,7],[-21,0],[-24,-2]], C.hair, { w: LW.outline, depth: 2 });
  if (rf.front) {
    oval(ctx, 2,1,18,19,C.skin,{ w: LW.outline, speck: 0, depth: 1.1 });
    oval(ctx,-15,7,4.4,5,C.skin,{ w: LW.detail, speck: 0, depth: .6 });
    line(ctx,[[-17,7],[-14,6],[-13,9]],.6);
    // Unbearded open face, simple dark eyes and a quiet expression.
    for (const [x,y] of [[-1,3],[12,1.5]]) {
      oval(ctx,x,y,1.55,3.6,PAL.ink,{ w: 0, depth: 0, speck: 0, light: 0, amp: .08 });
    }
    line(ctx,[[-4,-4],[-1,-5],[1,-4.5]],.65);
    line(ctx,[[10,-6],[13,-6.5],[15,-5.7]],.65);
    line(ctx,[[5,13],[7.5,13.4],[9,12.8]],.6);
    shape(ctx, [[-21,-9],[-15,-20],[-3,-23],[11,-21],[19,-15],[22,-5],[20,1],
      [16,-5],[14,-11],[11,-14],[8,-5],[5,-1],[6,-12],[0,-5],[-7,-1],
      [-12,0],[-9,-7],[-17,2],[-16,10],[-21,7],[-19,0],[-24,1]], C.hair, { w: LW.part });
    shape(ctx,[[-17,-13],[-7,-19],[3,-19],[-3,-14],[-11,-10]],C.hairLight,{ w: 0, depth: 0, speck: .3 });
    line(ctx,[[-13,-14],[-10,-9],[-16,-3]],.55);
    line(ctx,[[7,-19],[3,-12],[-3,-7]],.6);
    line(ctx,[[15,-16],[18,-10],[19,-5]],.6);
  } else {
    shape(ctx,[[-16,-13],[-9,-20],[2,-21],[8,-18],[1,-14],[-10,-10]],C.hairLight,{ w: 0, depth: 0, speck: .3 });
    for (const x of [-13,-4,7,15]) line(ctx,[[x,-13],[x+2,-3],[x-2,8],[x-3,14]],.6);
    line(ctx,[[-18,3],[-16,12],[-11,15]],.6);
  }
  // Five broad gold points and a single blue stone remain clear at game size.
  // Seat the entire crown into the hair, including the band and its side rims.
  ctx.translate(0,3.5);
  shape(ctx,[[-20,-19],[-22,-34],[-18,-31],[-15,-24],[-10,-26],[-9,-37],
    [-4,-30],[0,-28],[4,-42],[8,-31],[11,-28],[16,-31],[20,-37],[20,-20],
    [10,-18],[-1,-17],[-12,-17]], C.gold, { w: LW.outline, depth: 1.4, amp: .18 });
  shape(ctx,[[-20,-23],[-10,-22],[1,-22],[11,-24],[20,-25],[20,-20],
    [10,-18],[-1,-17],[-12,-17],[-20,-19]], C.goldLight, { w: LW.detail, depth: .6 });
  if (rf.front) {
    shape(ctx,[[5,-31],[8,-27],[5,-23],[2,-27]],C.jewel,{ w: .8, depth: .4, speck: 0 });
  }
  for (const [x,y] of [[-21,-34],[-9,-37],[4,-42],[20,-37]]) oval(ctx,x,y,1.5,1.7,C.goldLight,{ w: .7, depth: .3, speck: 0 });
  ctx.restore();
}

function legs(ctx, rf, P) {
  return legParts2(ctx,rf,P,{ pants: C.silverShade, boot: C.leather, sole: C.leather,
    legR0: 4.4, legR1: 3.7, footR: 4, soleR: 3.5 }).map((leg,i) => {
    const draw = leg.draw, side = i === 0 ? 1 : -1, ft = i === 0 ? P.footL : P.footR;
    return { ...leg, draw: () => {
      draw();
      const hip = rf.W(P.body[0]*.5,side*6.5,21+P.body[2]*.6);
      const ankle = footProj(rf.dir,ft[0],ft[1],ft[2]+6);
      const knee = { x: hip.x*.55+ankle.x*.45, y: hip.y*.55+ankle.y*.45 };
      plate(ctx,taperPts(knee,ankle,3.8,3));
      shape(ctx,[[knee.x-4.2,knee.y-2],[knee.x,knee.y-4],[knee.x+4.2,knee.y-2],
        [knee.x+3,knee.y+2],[knee.x,knee.y+3.2],[knee.x-3,knee.y+2]],C.silver,{ depth: 1 });
    } };
  });
}

function sword(ctx, hand, tip) {
  const dx=tip.x-hand.x,dy=tip.y-hand.y,len=Math.hypot(dx,dy)||1;
  const ux=dx/len,uy=dy/len, Q=(a,b)=>[hand.x+ux*a-uy*b,hand.y+uy*a+ux*b];
  shape(ctx,[Q(4,-2.6),Q(len-5,-2),Q(len,0),Q(len-5,2),Q(4,2.6)],C.silverLight,{ depth: .5, w: LW.part, amp: .12, speck: .2 });
  shape(ctx,[Q(5,0),Q(len,0),Q(len-5,2),Q(5,2.5)],C.silverShade,{ w: 0, depth: 0, speck: 0, amp: .1 });
  line(ctx,[Q(6,0),Q(len-5,0)],.5);
  shape(ctx,[Q(1,-6),Q(4,-6.5),Q(5,-2),Q(5,2),Q(4,6.5),Q(1,6)],C.gold,{ w: 1, depth: .7 });
  shape(ctx,[Q(-7,-1.6),Q(1,-1.6),Q(1,1.6),Q(-7,1.6)],C.leather,{ w: .8, depth: .5, speck: 0 });
  const pm=Q(-8,0);oval(ctx,pm[0],pm[1],2.3,2.3,C.gold,{ w: .8, depth: .5, speck: 0 });
}

export function drawKing(ctx,x,y,direction,action,t,scale=1,opts={}) {
  const P=kingPose(action,t),rf=rigFrame(direction,P.body,P.yaw),U=rf.UY;
  const key=p=>bodyLayerKey(rf,...yawToBody(rf,p[0],p[1]),p[2]);
  const parts=legs(ctx,rf,P);
  parts.push({ id:'cape',d:rf.front?-200:LAYER.cape,draw:()=>cape(ctx,rf,P) });
  parts.push({ id:'torso',d:LAYER.torso,draw:()=>torso(ctx,rf) });
  parts.push({ id:'head',d:LAYER.head,draw:()=>head(ctx,rf) });
  for (const side of [-1,1]) {
    const H=side===-1?P.right:P.left,S=[0,side*14,46];
    const E=ik2(S,H,14,15,[-5,side*2,-8]),s=U(...S),e=U(...E),h=U(...H);
    // bodyLayerKey describes the torso, not the wider cape. In rear views the
    // entire far arm (including shoulder, grip and sword) must sit behind cloth.
    // Drawing it first still exposes any portion extending beyond the cape edge.
    const behindCape=!rf.front && s.d<U(0,0,S[2]).d;
    const armKey=p=>behindCape?Math.min(key(p),LAYER.cape-1):key(p);
    parts.push({ id:'upper'+side,d:armKey(mid(S,E)),draw:()=>{
      plate(ctx,taperPts(s,e,5.4,4.4),{ fill:C.silverShade });
      oval(ctx,s.x,s.y,7.2,6.2,C.silver,{ w:LW.part });
      line(ctx,[[s.x-4,s.y+2],[s.x,s.y+3],[s.x+4,s.y+1]],.7);
    } });
    // Split the forearm so a forward strike can cross the torso depth boundary.
    const m={x:(e.x+h.x)/2,y:(e.y+h.y)/2};
    parts.push({ id:'foreElbow'+side,d:armKey(E)+.01,draw:()=>plate(ctx,taperPts(e,m,4.3,4)) });
    parts.push({ id:'foreHand'+side,d:armKey(H),draw:()=>plate(ctx,taperPts(m,h,4,3.4)) });
    // Small red shoulder drape and clasp connect the rear cape to the collar.
    parts.push({ id:'drape'+side,d:armKey(S)+.02,draw:()=>{
      shape(ctx,[[s.x-6,s.y-3],[s.x-2,s.y-7],[s.x+4,s.y-5],[s.x+7,s.y+1],
        [s.x+2,s.y-1],[s.x-4,s.y+1]],C.red,{ w:1, depth:1 });
      if(rf.front) oval(ctx,s.x,s.y-3,2.3,2.6,C.gold,{ w:.8, depth:.5, speck:0 });
    } });
    if(side===-1) {
      const tip=U(...H.map((v,i)=>v+P.blade[i]*37));
      parts.push({ id:'sword',d:armKey(H)+.02,draw:()=>sword(ctx,h,tip) });
    }
    parts.push({ id:'hand'+side,d:armKey(H)+.04,draw:()=>
      mittenHand(ctx,h,h.x-e.x,h.y-e.y,3.6,C.silver,{ thumbSide:side*rf.sx }) });
  }
  renderRig(ctx,x,y,scale,parts,{ prefix:'king',boil:0,shadow:opts.shadow });
}

export const character=Object.freeze({
  id:'king',label:'王',kind:'humanoid',directional:true,draw:drawKing,
  actions:{ idle:{period:IDLE_T,frames:20},walk:{period:1/WALK_HZ,frames:16},
    attack:{period:ATTACK_T,keys:[0,.12,.22,.3,.38,.42,.46,.49,.52,.56,.6,.68,.76,.82,.9,.96,.99],once:true} },
  frameBox:{x0:-86,x1:86,y0:-124,y1:24},
  equipment:{rightHand:'sword',leftHand:'free',back:'cape'},
});
export const studio=Object.freeze({ name:'王',category:'人間・王族',
  description:'金の王冠と銀の鎧、落ち着いた赤いマントをまとった王。右手の剣で前方を一度斬ります。',
  preview:{direction:'SE',phase:0} });
