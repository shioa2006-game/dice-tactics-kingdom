/**
 * The Cinder Guard — a new Inkstone character, authored entirely with Canvas 2D.
 * Local coordinates, gait, contact correction, IK, depth layers, paint and cache
 * contract all belong to Inkstone. No engine or built-in character is modified.
 * Equipment is anatomical: +b = LEFT sword hand; -b = RIGHT shield hand.
 */
import {
  TAU, WALK_HZ, DRAW, PAL, LW, KX, KY, LAYER,
  rigFrame, renderRig, walkFeet, footProj, legParts2, ik2, keyframes,
  nrm3, vlerp, yawToBody, bodyLayerKey, bodyToWorld,
  paint, paintA, taperPts, ellipsePts, cLine, mittenHand, bbox,
  clipPath, fillPath, fillPoly, strokePath, roughen, stipplePoly, rimWeight, seed,
} from '../../src/authoring.js';

export const WARRIOR_ATTACK_T = 1.35;
export const WARRIOR_ATTACK_KEYS = Object.freeze([
  0, .06, .12, .2, .27, .33, .38, .42, .45, .47, .49, .51,
  .53, .55, .58, .62, .67, .72, .77, .82, .87, .92, .96, .99,
]);

const C = Object.freeze({
  steel: '#cecfc6', light: '#edeadd', mid: '#aab2ac', dark: '#7e8985',
  black: '#343734', cloth: '#d5ccb3', leather: '#6b4d3e', leatherLight: '#947058',
  red: '#a05d4b', redDark: '#713b33', plume: '#a45d47', plumeLight: '#c18a69',
  skin: '#f0d7b3', gold: '#c5b182', wood: '#927256', woodDark: '#5e4736',
});
const SWORD_IDLE = [5, 24, 29, .43, .49, -.76];
// Long anticipation, a short accelerating strike, then a heavy settling pause.
const SWING = [
  [0, SWORD_IDLE],
  [.2, [-4, 24, 37, -.42, .48, .78]],
  [.38, [-7, 20, 50, -.57, .25, .84]],
  [.45, [-3, 20, 53, -.23, .12, .97]],
  [.49, [6, 21, 50, .58, .08, .81]],
  [.55, [18, 16, 29, .87, -.02, -.5]],
  [.62, [17, 15, 28, .76, -.12, -.64]],
  [.72, [15, 16, 28, .63, .18, -.76]],
  [1, SWORD_IDLE],
];
const sample = (keys, u) => keyframes(keys, u)[0];
const phase = (t, period) => ((t % period) + period) % period / period;
const metal = (ctx, points, o = {}) => {
  const shape = paint(ctx, points, {
    fill: C.steel, w: LW.part, depth: 2, light: .48, speck: 1.15, amp: .3, ...o,
  });
  // Fine pen grain sits inside the common painted plate, strongest near its rim.
  // Inkstone's default specks are intentionally coarser; small dots retain the
  // reference's engraved metal texture without making the face or cloth dirty.
  stipplePoly(ctx, shape, 6.4, { color: '#4e524a', scale: .29, wfn: rimWeight(shape, .35, .5) });
  const bb = bbox(shape), w = bb.x1-bb.x0, h = bb.y1-bb.y0;
  if (w*h > 350) {
    ctx.save(); clipPath(ctx,shape);
    for (const [a,b,sl] of [[.23,.43,.08],[.72,.62,-.07],[.6,.2,.055]]) {
      const x=bb.x0+w*a,y=bb.y0+h*b;
      cLine(ctx,[[x,y],[x+w*sl,y+h*.07]],.4);
      cLine(ctx,[[x+.8,y-.5],[x+w*sl+.8,y+h*.045-.5]],.28);
    }
    ctx.restore();
  }
  return shape;
};
const metalA = (ctx, points, o = {}) => metal(ctx, points.map(([x, y]) => ({ x, y })), o);
const line = (ctx, points, width = LW.fine) => cLine(ctx, points.map(p => Array.isArray(p) ? p : [p.x, p.y]), width);
const dot = (ctx, x, y, r = .75, fill = PAL.ink) => {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
};

export function warriorPose(action, t) {
  const P = {
    body: [0, 0, 0], yaw: 0, footL: [0, 6, 0], footR: [0, -6, 0],
    sword: { hand: SWORD_IDLE.slice(0, 3), dir: nrm3(SWORD_IDLE.slice(3)) },
    shield: { hand: [8, -24, 31] }, plume: 0, scarf: 0, blink: false, exert: false, trail: null,
  };
  if (action === 'walk') {
    const wf = walkFeet(t);
    // Preserve the shared stride and stance exactly: game actionTime is distance-derived.
    P.footL = wf.footL; P.footR = wf.footR;
    P.body = [1.1, 0, wf.bob * .62];
    P.yaw = wf.s * .035;
    P.sword.hand = [5 - wf.s * 3, 24, 29 + Math.abs(wf.s) * .7];
    P.sword.dir = nrm3([.43 - wf.s * .07, .49, -.76]);
    P.shield.hand = [8 + wf.s * 1.4, -24, 31 + wf.c * .3];
    // Phase lag of the plume deliberately differs from the feet/shoulders.
    P.plume = Math.sin(wf.ph - .8) * 2.2;
    P.scarf = Math.sin(wf.ph - 1) * 1.6;
  } else if (action === 'attack') {
    const u = phase(t, WARRIOR_ATTACK_T), k = keyframes(SWING, u);
    P.sword = { hand: k.slice(0, 3), dir: nrm3(k.slice(3)) };
    const lean = sample([[0,[0]],[.38,[-2]],[.45,[-2]],[.55,[4]],[.72,[3.1]],[1,[0]]],u);
    P.body = [lean, 0, sample([[0,[0]],[.38,[1.1]],[.45,[1.1]],[.55,[-1.5]],[.72,[-.9]],[1,[0]]],u)];
    P.yaw = sample([[0,[0]],[.38,[-.25]],[.45,[-.25]],[.55,[.23]],[.72,[.15]],[1,[0]]],u);
    P.footL = [sample([[0,[0]],[.4,[0]],[.55,[5]],[.74,[5]],[1,[0]]],u), 6,
      sample([[0,[0]],[.4,[0]],[.48,[2.5]],[.55,[0]],[1,[0]]],u)];
    P.shield.hand = keyframes([[0,[8,-24,31]],[.38,[9,-23,34]],[.55,[5,-24,33]],[.72,[5,-24,33]],[1,[8,-24,31]]],u);
    P.plume = sample([[0,[0]],[.38,[3.5]],[.49,[2]],[.57,[-4.5]],[.76,[1.5]],[1,[0]]],u);
    P.scarf = -lean * .55; P.exert = u > .48 && u < .7;
    if (u > .49 && u < .69) {
      P.trail = { alpha: Math.min(1, (.69 - u) / .1), samples: [] };
      const start = Math.max(.465, u - .07), end = Math.min(.62, u);
      for (let i = 0; i <= 7; i++) {
        const q = keyframes(SWING, start + (end - start) * i / 7);
        P.trail.samples.push({ hand: q.slice(0, 3), dir: nrm3(q.slice(3)), u: start + (end-start)*i/7 });
      }
    }
  } else {
    const u = phase(t, TAU / 2), breathe = Math.sin(u * TAU);
    P.body[2] = breathe * .65;
    P.sword.hand[2] += breathe * .15;
    P.shield.hand[2] += breathe * .25;
    P.plume = Math.sin(u * TAU - .7) * 1.2;
    P.scarf = Math.sin(u * TAU - 1) * .5;
    P.blink = u > .89 && u < .94; // Includes the 0.90 idle cache key.
  }
  return P;
}

/** Each leg is the existing legParts2 with a decorative steel knee/greave overlay. */
function armoredLegs(ctx, rf, P) {
  const legs = legParts2(ctx, rf, P, {
    pants: C.cloth, boot: C.mid, sole: C.leather, bootH: .46,
    legR0: 4.5, legR1: 3.9, footR: 4, soleR: 3.5,
  });
  return legs.map((leg, i) => {
    const base = leg.draw, ft = i === 0 ? P.footL : P.footR, sign = i === 0 ? 1 : -1;
    return { ...leg, draw: () => {
      base();
      // Same attachment landmarks as legParts2; never alter its foot projection.
      const hip = rf.W(P.body[0] * .5, sign * 6.5, 21 + P.body[2] * .6);
      const ankle = footProj(rf.dir, ft[0], ft[1], ft[2] + 5);
      const knee = { x: hip.x * .52 + ankle.x * .48, y: hip.y * .52 + ankle.y * .48 };
      metal(ctx, taperPts(knee, ankle, 3.9, 3), { fill: C.mid, depth: 1.5, speck: .7 });
      metalA(ctx, [[knee.x-4.8,knee.y-2.7],[knee.x,knee.y-4.7],[knee.x+4.8,knee.y-2],
        [knee.x+4.1,knee.y+2.7],[knee.x,knee.y+4.1],[knee.x-4.5,knee.y+2]], { depth: 1.3 });
      line(ctx, [[knee.x-2.8,knee.y-1.8],[knee.x+1.8,knee.y-2.6]], .65);
      const heel = footProj(rf.dir, ft[0]-1, ft[1], ft[2]+4);
      const toe = footProj(rf.dir, ft[0]+5, ft[1], ft[2]+3.6);
      const dx = toe.x-heel.x, dy = toe.y-heel.y, len = Math.hypot(dx,dy)||1;
      for (const u of [.3,.74]) {
        const x=heel.x+dx*u,y=heel.y+dy*u;
        line(ctx, [[x-dy/len*2.4,y+dx/len*2.4],[x+dy/len*2.4,y-dx/len*2.4]], .65);
      }
    } };
  });
}

function drawTorso(ctx, rf, P) {
  const U = rf.UY, Q = arr => arr.map(([b,z]) => U(0,b,z));
  paint(ctx, Q([[14,46],[-14,46],[-17,29],[-19,19],[-10,16],[0,18],[10,16],[19,19],[16,30]]),
    { fill:C.cloth, w:LW.outline, depth:3, speck:1.5 });
  // Dark articulated mail at the waist: short strokes, no black wash.
  for (const b of [-12,-6,0,6,12]) {
    const a=U(0,b,23); line(ctx,[[a.x-1,a.y],[a.x,a.y+1.3],[a.x+1.1,a.y]],.55);
  }
  metal(ctx,Q([[13,47],[-13,47],[-17,40],[-13,29],[-5,27],[5,27],[13,29],[17,40]]),
    {w:LW.outline,depth:3.4,light:.65});
  const panel = Q(rf.front ? [[11,44],[-1,46],[-1,30],[8,31],[13,39]] : [[9,45],[-1,46],[-2,30],[9,32],[13,41]]);
  paint(ctx,panel,{fill:C.light,w:0,depth:0,speck:.35,amp:.2});
  line(ctx,Q([[0,45],[0,33],[-2,29]]),.75);
  line(ctx,Q([[11,32],[5,30],[-5,30],[-11,32]]),.85);
  if (!rf.front) {
    line(ctx,Q([[-12,40],[0,36],[12,40]]),.8);
    for (const b of [-11,11]) { const p=U(0,b,42);dot(ctx,p.x,p.y,.7); }
  }
  // Two overlapping fauld lames and split tassets make the short body read as armour.
  metal(ctx,Q([[15,29],[-15,29],[-17,24],[0,22],[17,24]]),{fill:C.mid,depth:1.8});
  metal(ctx,Q([[17,24],[-17,24],[-18,20],[-7,18],[7,18],[18,20]]),{depth:1.7});
  for (const sign of [-1,1]) {
    metal(ctx,Q([[sign*3,21],[sign*16,22],[sign*18,15],[sign*7,13],[sign*4,15]]),{depth:1.7,speck:.9});
    line(ctx,Q([[sign*6,17],[sign*15,18]]),.65);
  }
  paint(ctx,Q([[16,29],[-16,29],[-16,25.3],[16,25.3]]),{fill:C.leather,w:LW.part,depth:.9,speck:.5});
  if (rf.front) {
    const b=U(3,1,27.1);
    metalA(ctx,[[b.x-3.4,b.y-2.7],[b.x+3.4,b.y-2.7],[b.x+3.4,b.y+2.7],[b.x-3.4,b.y+2.7]],{fill:C.gold,w:LW.detail,depth:.7,speck:0});
    paintA(ctx,[[b.x-1.8,b.y-1.4],[b.x+1.8,b.y-1.4],[b.x+1.8,b.y+1.4],[b.x-1.8,b.y+1.4]],{fill:C.leather,w:0,depth:0,speck:0});
  }
  // Scarf drapes sit beneath the helmet and keep the red visible in rear views.
  paint(ctx,[U(-2,-12,48),U(-4,-8,46),U(-8,-11,32),U(-7,-18,34+P.scarf),U(-5,-14,39)],
    {fill:C.redDark,w:LW.part,depth:2,speck:1});
}

/** Bridge the head-mounted scarf to the yawing breastplate.
 * The upper rim follows U (head); the lower rim follows UY (chest).
 * Both share P.body, so breathing/footfall bob cannot open a vertical seam. */
function drawGorget(ctx, rf, head) {
  const U = rf.UY;
  const side = Math.sign(U(0,1,48).x-U(0,0,48).x);
  const Q = (b,z,a=0) => U(a,b*side,z);
  const H = (x,y) => ({x:head.x+x, y:head.y+y});
  // A padded collar fills the space beneath the scarf's narrow, pointed hem.
  // Its upper edge is hidden by the original head art, not merely tangent to it.
  paint(ctx,[H(-10,14),H(10,14),Q(12,49),Q(8,44),Q(-8,44),Q(-12,49)],
    {fill:C.redDark,w:LW.part,depth:1.5,speck:1});
  // Flared steel neck guard overlaps the breastplate and the inner pauldrons.
  // Leave the chest below z=43 exposed; the existing head scale/shape is intact.
  metal(ctx,[H(-9,19),H(9,19),Q(15,49),Q(12,45),Q(5,43,2),
    Q(-5,43,2),Q(-12,45),Q(-15,49)],{w:LW.part,depth:2,light:.55,speck:.8});
  line(ctx,[Q(-12,47),Q(-5,45,2),Q(5,45,2),Q(12,47)],.65);
  for(const b of [-11,11]) { const p=Q(b,47);dot(ctx,p.x,p.y,.6); }
}

function drawHelmet(ctx, c, sx, front, P) {
  const M = points => points.map(([x,y]) => [c.x+x*sx,c.y+y]);
  const steel = (points,o={}) => metalA(ctx,M(points),o);
  const cloth = (points,fill,o={}) => paintA(ctx,M(points),{fill,w:LW.part,depth:2,speck:1,...o});
  // Soft scarf above the breastplate. All front/back heads share the same envelope.
  cloth([[-16,13],[-9,12],[10,12],[18,16],[13,24],[3,27],[-8,22],[-17,20]],C.redDark);
  cloth([[-15,14],[-4,18],[10,16],[17,14],[14,21],[3,24],[-9,19]],C.red,{w:LW.detail,depth:1.2});
  line(ctx,M([[-7,17],[3,20],[11,18]]),.75);
  if (front) {
    // Face remains an open, warm shape below the raised vented brow.
    cloth([[-14,-4],[15,-7],[19,0],[17,12],[9,18],[-2,18],[-13,10]],C.skin,{w:LW.outline,depth:1.6,speck:0});
    steel([[-22,-5],[-20,-18],[-10,-27],[3,-29],[15,-23],[22,-12],[22,-4],[7,-8],[-7,-4]],{w:LW.outline,depth:3.2,light:.65});
    cloth([[-17,-16],[-9,-24],[-1,-26],[1,-16],[-6,-10]],C.light,{w:0,depth:0,speck:.5});
    line(ctx,M([[-3,-27],[-4,-18],[-8,-10]]),.8);
    line(ctx,M([[3,-27],[13,-20],[18,-12]]),.75);
    // A heavy raised visor, with six separate elongated ventilation slots.
    steel([[-23,-8],[-12,-15],[5,-18],[23,-10],[24,1],[9,-3],[-8,1],[-21,8]],{w:LW.outline,depth:2.3,light:.55});
    steel([[-21,5],[-8,-1],[9,-5],[23,-1],[23,2],[9,-2],[-7,2],[-21,9]],{fill:C.dark,w:LW.detail,depth:.5,speck:.3});
    const vents=[[-16,-8,5],[-10,-11,7],[-3,-12,8],[5,-13,8],[12,-10,7],[18,-7,6]];
    for (const [x,y,len] of vents) {
      // Common paint uses quadratic smoothing. Use its public polygon primitive
      // here so narrow ventilation cuts retain forged, square corners.
      const slot=M([[x-1.1,y],[x+1.1,y-.2],[x+1.6,y+len],[x-.8,y+len+.2]]).map(([x,y])=>({x,y}));
      fillPoly(ctx,roughen(slot,true,.08,1.4),C.black);
    }
    // Side hinge and cheek plates articulate around the clear face opening.
    steel([[-21,-1],[-15,2],[-12,11],[-16,16],[-24,12],[-20,6]],{depth:1.8});
    steel([[20,-1],[23,2],[22,10],[18,12],[17,7]],{fill:C.mid,w:LW.detail,depth:1});
    for (const [x,y] of [[-18,3],[-19,11],[-14,-18],[11,-21],[20,-4]]) {
      const p=M([[x,y]])[0]; dot(ctx,p[0],p[1],.8); dot(ctx,p[0]-.35,p[1]-.4,.28,C.light);
    }
    for (const [x,y,rx] of [[3,7.2,1.6],[13,5.7,1.5]]) {
      const p=M([[x,y]])[0]; ctx.fillStyle=PAL.ink;
      if(P.blink) line(ctx,[[p[0]-1.7,p[1]],[p[0]+1.7,p[1]]],1);
      else {ctx.beginPath();ctx.ellipse(p[0],p[1],rx,3,0,0,TAU);ctx.fill();}
    }
    // Short mouth and tiny cheek marks, not a realistic facial rendering.
    line(ctx,M(P.exert?[[6,13],[9,12.5],[10,14]]:[[6,13.7],[9,14],[10.5,13.2]]),.75);
    line(ctx,M([[-4,11],[-2,11.4]]),.5);
  } else {
    steel([[-22,-4],[-20,-18],[-10,-27],[3,-29],[15,-23],[22,-12],[22,5],[14,13],[1,17],[-12,13],[-21,6]],{w:LW.outline,depth:3.2,light:.65});
    cloth([[-17,-16],[-8,-24],[-1,-26],[-2,-4],[-9,8],[-16,4]],C.light,{w:0,depth:0,speck:.6});
    line(ctx,M([[0,-27],[-1,-14],[-1,8]]),.95);
    line(ctx,M([[5,-26],[14,-19],[18,-9],[18,2]]),.7);
    // Rear neck lames make the back unmistakably a helmet, not a rounded hair mass.
    steel([[-21,2],[-12,7],[2,9],[17,4],[22,1],[22,7],[10,14],[-4,16],[-18,11],[-23,7]],{fill:C.mid,depth:1.8});
    steel([[-20,8],[-8,13],[6,14],[18,8],[19,13],[7,20],[-6,21],[-19,15]],{depth:1.5});
    line(ctx,M([[-15,13],[-6,17],[6,17],[15,12]]),.65);
    for (const [x,y] of [[-16,-15],[-15,7],[16,4],[-11,15],[10,14]]) {const p=M([[x,y]])[0];dot(ctx,p[0],p[1],.75);}
    // A sliver of the front visor visible beyond the far rim.
    steel([[19,-10],[24,-6],[24,1],[21,4]],{fill:C.dark,w:LW.detail,depth:1});
  }
  // Plume socket: a steel fork with a dark slit.
  steel([[-6,-27],[-6,-32],[-4,-35],[2,-35],[5,-32],[4,-27]],{depth:1.2,w:LW.detail});
  line(ctx,M([[-3,-32],[2,-32]]),.7);
  // One swept feather mass; the barbs only break its outline. Avoid pine-cone layering.
  const feather=[[-3,-32],[3,-36],[4,-41],[3,-47],[0,-51],[-1,-46],[-4,-52],[-6,-54],[-6,-48],[-11,-53],[-14,-53],[-12,-48],[-18,-50],[-21,-47],[-17,-46],[-26,-43],[-23,-42],[-31,-37],[-28,-36],[-36,-29],[-33,-29],[-39,-22],[-37,-22],[-42,-14],[-36,-17],[-36,-20],[-31,-21],[-33,-17],[-27,-22],[-28,-25],[-22,-24],[-23,-21],[-15,-26],[-16,-28],[-10,-28],[-10,-30],[-5,-31]];
  const sway = points => points.map(([x,y],i) => [x+P.plume*Math.max(0,Math.min(1,(-x-2)/28)),y+(i>9?P.plume*.2:0)]);
  cloth(sway(feather),C.plume,{w:LW.outline,depth:3,light:.3,speck:4,speckScale:.35,step:2.2,amp:.35});
  cloth(sway([[-4,-37],[-8,-44],[-15,-42],[-26,-33],[-30,-26],[-21,-33],[-15,-35],[-10,-38]]),C.plumeLight,{w:0,depth:0,speck:1,speckScale:.4});
  // Uneven, curved bundles flow from the socket. No symmetrical central leaf vein.
  for(const p of [
    [[-3,-35],[-5,-42],[-9,-47]], [[0,-38],[-1,-44],[-4,-48]],
    [[-6,-35],[-10,-40],[-16,-42],[-22,-38]], [[-8,-32],[-15,-34],[-21,-30],[-25,-26]],
    [[-11,-45],[-19,-42],[-26,-35],[-31,-27]], [[-16,-46],[-22,-43]],
    [[-20,-36],[-26,-31],[-31,-23]], [[-27,-32],[-32,-28],[-35,-22]],
    [[-15,-31],[-19,-29]], [[-7,-39],[-11,-37]],
  ]) line(ctx,M(sway(p)),.46);
}

/** Straight sword attached at the centre of the left mitten, always. */
function drawSword(ctx, hand, tip) {
  const dx=tip.x-hand.x,dy=tip.y-hand.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,nx=-uy,ny=ux;
  const Q=(a,b)=>[hand.x+ux*a+nx*b,hand.y+uy*a+ny*b];
  const len=Math.max(22,L);
  metalA(ctx,[Q(4,-2.8),Q(len-6,-2.4),Q(len,0),Q(len-6,2.4),Q(4,2.8)],{w:LW.part,depth:.7,speck:.3,light:.65,amp:.14});
  paintA(ctx,[Q(5,0),Q(len-1,0),Q(len-6,2.3),Q(5,2.6)],{fill:C.mid,w:0,depth:0,speck:0,amp:.1});
  line(ctx,[Q(7,0),Q(len-5,0)],.65);
  metalA(ctx,[Q(1,-7),Q(4,-7.5),Q(5,-2.8),Q(5,2.8),Q(4,7.5),Q(1,7)],{fill:C.dark,w:LW.part,depth:1,speck:.4});
  paintA(ctx,[Q(-8,-1.8),Q(1,-1.8),Q(1,1.8),Q(-8,1.8)],{fill:C.leather,w:LW.detail,depth:.8,speck:0,amp:.12});
  for(const v of [-6,-3,0]) line(ctx,[Q(v,-1.6),Q(v+1.2,1.6)],.6);
  const pm=Q(-9.5,0); metal(ctx,ellipsePts(pm[0],pm[1],2.8,2.8,10),{fill:C.mid,w:LW.detail,depth:.8,speck:0});
}

function shieldGeometry(rf,P) {
  // Choose a modest cant for readability in each view, without swapping hands.
  const candidates=[[.87,-.5],[.87,.5]].map(([a,b])=>({a,b,w:bodyToWorld(rf.dir,a,b)}));
  let n=candidates.reduce((a,b)=>Math.abs(b.w.X+b.w.Y)>Math.abs(a.w.X+a.w.Y)?b:a);
  if(P.shieldCant) {
    // NE's near shield otherwise covers the entire far-hand sword at impact.
    // Rotate the strapped shield inward during the strike, never move its hand.
    const b=n.b-P.shieldCant*.8;
    n={a:n.a,b,w:bodyToWorld(rf.dir,n.a,b)};
  }
  const hx=-n.w.Y,hy=n.w.X,hl=Math.hypot(hx,hy);
  const h={x:(hx-hy)/hl*KX,y:(hx+hy)/hl*KY};
  const hand=rf.UY(...P.shield.hand), c={x:hand.x+(n.w.X-n.w.Y)*KX*3,y:hand.y+(n.w.X+n.w.Y)*KY*3};
  return {c,h,front:n.w.X+n.w.Y>0,thick:{x:-(n.w.X-n.w.Y)*KX*2.5,y:-(n.w.X+n.w.Y)*KY*2.5}};
}

function drawShield(ctx,geo) {
  const {c,h,thick}=geo, shape=[[-18,-20],[-9,-23],[10,-23],[18,-19],[17,0],[11,15],[0,24],[-12,15],[-18,-2]];
  const Q=([a,z],factor=1,offset={x:0,y:0})=>({x:c.x+h.x*a*factor+offset.x,y:c.y+h.y*a*factor+z*factor+offset.y});
  metal(ctx,shape.map(p=>Q(p,1,thick)),{fill:C.woodDark,w:LW.outline,depth:2,speck:1});
  metal(ctx,shape.map(p=>Q(p)),{fill:C.mid,w:LW.outline,depth:2.7,light:.5});
  const inner=shape.map(p=>Q(p,.82));
  const panel=paint(ctx,inner,{fill:geo.front?C.red:C.wood,w:LW.detail,depth:2.8,light:.2,speck:1.8,amp:.4});
  ctx.save();clipPath(ctx,panel);
  if(geo.front) {
    // A worn, cream winged-sun device drawn as a single heraldic silhouette.
    const crest=[[0,-13],[3,-6],[7,-8],[6,-3],[13,-5],[10,1],[5,3],[5,7],[2,6],[1,14],[-2,17],[-3,8],[-6,5],[-7,8],[-8,3],[-12,1],[-9,-2],[-12,-7],[-5,-5],[-4,-9],[-1,-7]];
    paint(ctx,crest.map(p=>Q(p)),{fill:C.cloth,w:0,depth:.5,speck:1.2,amp:.32,step:3});
    for(const p of [[[-11,-15],[-10,-11]],[[-12,6],[-10,8]],[[11,8],[8,12]],[[6,-16],[9,-17]]]) line(ctx,p.map(q=>Q(q)),.6);
    for(const [a,z] of [[-10,-10],[7,10],[-4,2],[4,-3],[3,7],[-8,11]]) {const p=Q([a,z]);dot(ctx,p.x,p.y,.8,C.redDark);}
  } else {
    for(const a of [-11,-4,4,11]) line(ctx,[Q([a,-26]),Q([a,26])],.8);
    for(const a of [-9,6]) line(ctx,[Q([a,-10]),Q([a+1,-5]),Q([a,-1])],.55);
    for(const z of [-9,9]) paint(ctx,[Q([-15,z-1.6]),Q([15,z-1.6]),Q([15,z+1.6]),Q([-15,z+1.6])],{fill:C.leather,w:LW.detail,depth:.8,speck:.5});
    // An arched grip under the right gauntlet, and visible strap attachment pins.
    paint(ctx,[Q([-5,-6]),Q([-1,-7]),Q([4,-4]),Q([5,4]),Q([1,7]),Q([-4,5])],{fill:C.leatherLight,w:LW.part,depth:1.5,speck:.5});
    for(const [a,z] of [[-12,-9],[12,-9],[-12,9],[12,9]]) {const p=Q([a,z]);dot(ctx,p.x,p.y,.8,C.gold);}
  }
  ctx.restore();
  for(const p of [[-15,-18],[-7,-20],[8,-20],[15,-16],[14,-2],[10,11],[0,20],[-10,11],[-15,-2]]) {
    const q=Q(p);dot(ctx,q.x,q.y,.85);dot(ctx,q.x-.3,q.y-.4,.3,C.light);
  }
}

function armParts(ctx,rf,P,side) {
  const sb=side==='L'?16:-16, S=[0,sb,44], H=side==='L'?P.sword.hand:P.shield.hand;
  const E=ik2(S,H,11.8,12.3,[-.45,side==='L'?1:-1,-.7]);
  const U=rf.UY, key=p=>{const a=yawToBody(rf,p[0],p[1]);return bodyLayerKey(rf,a[0],a[1],p[2]);};
  const s=U(...S),e=U(...E),h=U(...H), mid={x:e.x*.5+h.x*.5,y:e.y*.5+h.y*.5};
  const upper = ()=>{
    paint(ctx,taperPts(s,e,5,4),{fill:C.leather,w:LW.part,depth:1.8,speck:1});
    // Domed pauldrons with a second articulated lower lame.
    const dx=e.x-s.x,dy=e.y-s.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,nx=-uy,ny=ux;
    const Q=(a,b)=>({x:s.x+ux*a+nx*b,y:s.y+uy*a+ny*b});
    metal(ctx,[Q(-5,-3),Q(-3,-7),Q(3,-8),Q(8,-5.5),Q(9,5),Q(3,7),Q(-3,6)],{w:LW.outline,depth:2.6,light:.6});
    metal(ctx,[Q(5,-6.5),Q(9,-5),Q(11,-1),Q(10,5),Q(6,6.8),Q(6,2)],{fill:C.mid,w:LW.detail,depth:1.2});
    line(ctx,[Q(-1,-4),Q(3,-5),Q(6,-3)],.7);
    const q=Q(3,3.5);dot(ctx,q.x,q.y,.7);
  };
  const fore=(a,b)=>{
    paint(ctx,taperPts(a,b,4.5,3.7),{fill:C.leather,w:LW.part,depth:1,speck:.7});
    metal(ctx,taperPts(a,b,4.2,3.5),{depth:1.7,speck:.8});
    const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,nx=-dy/L,ny=dx/L;
    line(ctx,[[b.x+nx*3,b.y+ny*3],[b.x-nx*3,b.y-ny*3]],.8);
  };
  const parts=[{id:'upper'+side,d:key(E),draw:upper}];
  // Split at the elbow/hand depth boundary, following the existing archer technique.
  const boundary=Math.round(key(E)/1000)!==Math.round(key(H)/1000);
  if(boundary) {
    parts.push({id:'foreElbow'+side,d:key(E)+.05,draw:()=>fore(e,mid)});
    parts.push({id:'foreHand'+side,d:key(H),draw:()=>fore(mid,h)});
  } else parts.push({id:'fore'+side,d:key(H),draw:()=>fore(e,h)});
  const gauntlet=()=>{
    mittenHand(ctx,h,h.x-e.x,h.y-e.y,3.9,C.steel,{thumbSide:side==='L'?rf.sx:-rf.sx});
    line(ctx,[[h.x-1.7,h.y-1],[h.x+1.4,h.y-1]],.6);
  };
  return {parts,S,E,H,hand:h,key:key(H),gauntlet};
}

export function drawWarriorRig(ctx,x,y,direction,action,t,scale=1,opts={}) {
  const P=warriorPose(action,t);
  if(action==='attack') {
    const u=phase(t,WARRIOR_ATTACK_T);
    const correctSword=(sw,q)=>{
      if(direction==='SE'||direction==='NW') {
        // The large helmet hides the far-side wind-up in SE (and the blade
        // points through the helmet in NW). Flare the same left forearm a little
        // and cant the blade outward; the common two-bone arm stays in reach.
        const w=sample([[0,[0]],[.1,[0]],[.2,[.7]],[.3,[1]],[.45,[1]],[.49,[.65]],[.55,[0]],[1,[0]]],q);
        sw.hand=vlerp(sw.hand,[12,29,sw.hand[2]],w);
        sw.dir=nrm3(vlerp(sw.dir,nrm3([-.06,.92,.74]),w));
      }
      if(direction==='NE') {
        const w=sample([[0,[0]],[.48,[0]],[.55,[1]],[.67,[1]],[.8,[0]],[1,[0]]],q);
        sw.dir=nrm3([sw.dir[0],sw.dir[1],sw.dir[2]-.16*w]);
      }
    };
    correctSword(P.sword,u);
    for(const sw of P.trail?.samples??[])correctSword(sw,sw.u);
    if(direction==='NE')P.shieldCant=sample([[0,[0]],[.45,[0]],[.55,[1]],[.67,[1]],[.8,[0]],[1,[0]]],u);
  }
  const rf=rigFrame(direction,P.body,P.yaw),U=rf.UY;
  const parts=armoredLegs(ctx,rf,P);
  parts.push({id:'torso',d:LAYER.torso,draw:()=>drawTorso(ctx,rf,P)});
  // Lower the whole head six local pixels so the scarf gently overlaps the
  // shield rim. Preserve its 0.9 scale and the existing body/arm/leg geometry.
  const head=rf.U(1.5,0,66);
  // Chest < gorget < helmet; arm/gear keep their existing depth keys. This preserves
  // the existing torso's pen texture and keeps the scarf above its steel rim.
  parts.push({id:'gorget',d:LAYER.torso+1,draw:()=>drawGorget(ctx,rf,head)});
  parts.push({id:'helmet',d:LAYER.head,draw:()=>{
    ctx.save();ctx.translate(head.x,head.y);ctx.scale(.9,.9);
    drawHelmet(ctx,{x:0,y:0},rf.sx,rf.front,P);ctx.restore();
  }});
  const left=armParts(ctx,rf,P,'L'),right=armParts(ctx,rf,P,'R');
  parts.push(...left.parts,...right.parts);
  const tipOf=(hand,dir,length)=>U(hand[0]+dir[0]*length,hand[1]+dir[1]*length,hand[2]+dir[2]*length);
  const swordTip=tipOf(P.sword.hand,P.sword.dir,41);
  parts.push({id:'sword',d:left.key+.02,draw:()=>drawSword(ctx,left.hand,swordTip)});
  parts.push({id:'leftGauntlet',d:left.key+.04,draw:left.gauntlet});
  const shield=shieldGeometry(rf,P);
  parts.push({id:'shield',d:right.key+(shield.front?.12:-.12),draw:()=>drawShield(ctx,shield)});
  parts.push({id:'rightGauntlet',d:right.key+.04,draw:right.gauntlet});
  // The trail is a translucent accent; it is not the weapon and never substitutes for it.
  const trail=()=>{
    if(!P.trail)return;
    seed('warrior-trail');
    const outer=P.trail.samples.map(p=>tipOf(p.hand,p.dir,41));
    const inner=P.trail.samples.map(p=>tipOf(p.hand,p.dir,33)).reverse();
    ctx.save();ctx.globalAlpha=.27*P.trail.alpha;
    fillPath(ctx,roughen(outer.concat(inner),true,.2,4),C.light);
    strokePath(ctx,outer,.65*DRAW.lw,false,C.dark,.5);ctx.restore();
  };
  renderRig(ctx,x,y,scale,parts,{prefix:'warrior',boil:DRAW.boil?Math.floor(t*5)%3:0,shadow:opts.shadow,after:trail});
  const screen=p=>({x:x+p.x*scale,y:y+p.y*scale});
  return {leftHand:screen(left.hand),rightHand:screen(right.hand),swordTip:screen(swordTip),head:screen(head),
    shieldFront:shield.front,pose:P,arms:{L:{S:left.S,E:left.E,H:left.H},R:{S:right.S,E:right.E,H:right.H}},order:parts.map(p=>p.id)};
}

export const warrior=Object.freeze({
  id:'warrior',label:'重装戦士 — Cinder Guard',kind:'humanoid',draw:drawWarriorRig,
  actions:{idle:{period:TAU/2,frames:20},walk:{period:1/WALK_HZ,frames:16},
    attack:{period:WARRIOR_ATTACK_T,keys:WARRIOR_ATTACK_KEYS,once:true}},
  frameBox:{x0:-86,x1:86,y0:-130,y1:29},
  equipment:{leftHand:'sword',rightHand:'shield'},
});

export { warrior as character };
export const studio = Object.freeze({ name: '灰燼の衛士', category: '重装戦士', description: '銀の鎧と赤茶の羽飾り。大きな盾で仲間を守る、小さく頼もしい戦士。', preview: { direction: 'SE', phase: 0 } });
