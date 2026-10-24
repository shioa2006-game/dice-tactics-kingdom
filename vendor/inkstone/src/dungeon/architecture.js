/**
 * Inkstone — 建築: 奥の2面の壁・床・手前の縁石・アーチ扉・階段・高台・崩れ・松明 (金具・光・炎)・外枠
 *   壁や扉は「壁面の座標系」(wallFace) で、左奥 (x=0) と右奥 (y=0) のどちらにも置ける。
 */
import { R, chance, seed } from '../core/random.js';
import { TAU, iso, isoVec, lerp, quadPt } from '../core/geometry.js';
import { PAL } from '../core/palette.js';
import { clipPath, fillPath, fillPoly, hatchPoly, inkLine, inkShape, roughen, stippleFace, stipplePoly, strokePath } from '../core/ink.js';
import { drawFaceStone, runBlocks, sortBoxes } from './stone.js';

/**
 * 奥の2面の壁を石ブロックの積み上げとして生成する。
 *  左奥の壁: x∈[-T,0], y∈[0, D+rim]   右奥の壁: y∈[-T,0], x∈[-T, W+rim] (角柱を含む)
 *  最上段だけ高さを揺らして、ギザギザした壁の上端を作る。
 */
export function buildWalls(room) {
  seed('walls' + (room.id || ''));
  const { W, D, H, wallT: T, rim: Rm, slab: S, courseH: ch } = room;
  const boxes = [];
  const courses = [[-S, 0]];
  for (let z = 0; z < H - 0.01; z += ch) courses.push([z, Math.min(H, z + ch)]);
  courses.forEach(([z0, z1], ci) => {
    const top = ci === courses.length - 1;
    const zt = () => top ? z1 + R(-0.06, 0.08) : z1;
    runBlocks(0, D + Rm, (a0, a1) => boxes.push({ x0: -T, x1: 0, y0: a0, y1: a1, z0, z1: zt() }));
    runBlocks(-T, W + Rm, (a0, a1) => boxes.push({ x0: a0, x1: a1, y0: -T, y1: 0, z0, z1: zt() }));
  });
  return sortBoxes(boxes);
}

/** 手前の縁石 (床の断面を兼ねる2段積み) */
export function buildRim(room) {
  seed('rim' + (room.id || ''));
  const { W, D, rim: Rm, slab: S } = room;
  const boxes = [], zm = -0.32;
  [[-S, zm], [zm, 0.08]].forEach(([z0, z1], ci) => {
    const zt = () => ci === 1 ? z1 + R(-0.03, 0.05) : z1;
    runBlocks(0, W + Rm, (a0, a1) => boxes.push({ x0: a0, x1: a1, y0: D, y1: D + Rm, z0, z1: zt() }));
    runBlocks(0, D, (a0, a1) => boxes.push({ x0: W, x1: W + Rm, y0: a0, y1: a1, z0, z1: zt() }));
  });
  return sortBoxes(boxes);
}

/**
 * 壁面の座標系 [実験Aで一般化]
 *  a = 壁に沿った位置, z = 高さ, n = 壁面から部屋側への距離
 *  'left' : 左奥の壁 (x=0 面, a=y)   'right': 右奥の壁 (y=0 面, a=x)
 *  F(a,z,n) → 画面座標, N(e) → 壁から手前へ e だけ浮かせる画面ベクトル
 */
export function wallFace(wall) {
  return wall === 'right'
    ? { F: (a, z, n = 0) => iso(a, n, z), N: e => isoVec(0, e, 0) }
    : { F: (a, z, n = 0) => iso(n, a, z), N: e => isoVec(e, 0, 0) };
}

/**
 * 階段: 段ごとの水平レイヤーを石で積み、指定した壁へ向かって上る。[実験Aで一般化]
 * st = {wall:'left'|'right', a0, a1 (壁沿いの範囲), len (壁からの奥行), steps, depth, rise}
 *  内部では u=壁からの距離, v=壁沿いの位置 で組み、最後にワールド座標の箱へ写す。
 */
export function buildStairs(st) {
  seed('stairs' + st.wall + st.a0);
  const boxes = [];
  const box = (u0, u1, z0, z1) => st.wall === 'right'
    ? { x0: st.a0, x1: st.a1, y0: u0, y1: u1, z0, z1 }
    : { x0: u0, x1: u1, y0: st.a0, y1: st.a1, z0, z1 };
  for (let i = 0; i < st.steps; i++) {
    const front = st.len - i * st.depth;
    const z0 = i * st.rise, z1 = (i + 1) * st.rise;
    const treadBack = Math.max(0, front - st.depth);
    // 上の段に隠れる奥側の石 (側面の石積み模様になる)
    if (treadBack > 0.05) runBlocks(0, treadBack, (u0, u1) => boxes.push(box(u0, u1, z0, z1)), 0.5, 0.9);
    boxes.push(box(treadBack, front, z0, z1)); // 踏み板
  }
  return boxes; // 生成順 = 正しい描画順 (下の段から、壁側から)
}

/** 階段の床上の占有範囲 (前後関係ソート用) */
export function stairsFootprint(st) {
  return st.wall === 'right'
    ? { x0: st.a0, x1: st.a1, y0: 0, y1: st.len }
    : { x0: 0, x1: st.len, y0: st.a0, y1: st.a1 };
}

/**
 * 床: 1マス=1タイル (=戦闘マップのマス)。頂点を共有したまま少し揺らし、
 * 目地・ひび・角の欠け・壁際の陰(点描)を描く。
 */
export function drawFloor(ctx, room) {
  seed('floor' + (room.id || ''));
  const fo = room.floor || {};   // [実験A] 部屋ごとの床の荒れ具合
  const { W, D } = room;
  const J = [];
  for (let i = 0; i <= W; i++) {
    J[i] = [];
    for (let j = 0; j <= D; j++) {
      const inner = i > 0 && i < W && j > 0 && j < D;
      J[i][j] = iso(i + (inner ? R(-0.025, 0.025) : 0), j + (inner ? R(-0.025, 0.025) : 0), 0);
    }
  }
  for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) {
    const a = J[i][j], b = J[i + 1][j], c = J[i + 1][j + 1], d = J[i][j + 1];
    fillPoly(ctx, [a, b, c, d], chance(0.5) ? PAL.floorA : PAL.floorB);
    stippleFace(ctx, a, b, d, 2.0 * (fo.density ?? 1), { base: 0.2, edge: 0.8, fall: 8 });
    if (chance(fo.crack ?? 0.45)) { // ひび
      let u = chance(0.5) ? 0 : R(0.2, 0.8), v = u === 0 ? R(0.2, 0.8) : 0;
      const pts = [quadPt(a, b, c, d, u, v)];
      const n = 2 + Math.floor(R(0, 3));
      for (let k = 0; k < n; k++) {
        u = Math.min(0.9, u + R(0.05, 0.16)); v = Math.min(0.9, v + R(0.05, 0.16));
        pts.push(quadPt(a, b, c, d, u, v));
      }
      inkLine(ctx, pts, { w: 0.9, amp: 0.6, step: 6, double: 0 });
    }
    if (chance(fo.chip ?? 0.3)) { // 角の欠け
      const k = Math.floor(R(0, 4)), cs = [a, b, c, d];
      const p = cs[k], q1 = cs[(k + 1) % 4], q2 = cs[(k + 3) % 4];
      const chip = [p, { x: lerp(p.x, q1.x, R(0.08, 0.16)), y: lerp(p.y, q1.y, R(0.08, 0.16)) },
        quadPt(a, b, c, d, [0.08, 0.92, 0.92, 0.08][k], [0.08, 0.08, 0.92, 0.92][k]),
        { x: lerp(p.x, q2.x, R(0.08, 0.16)), y: lerp(p.y, q2.y, R(0.08, 0.16)) }];
      const r = inkShape(ctx, chip, { fill: '#d8d4cb', w: 1.0, amp: 0.4 });
      stipplePoly(ctx, r, 6);
    }
  }
  // 壁際の陰 (点描のグラデーション)
  const ao = (A, B, Dp) => stippleFace(ctx, A, B, Dp, 6.5, { wfn: (u, v) => 0.95 * Math.pow(1 - v, 2.4) });
  ao(iso(0, 0), iso(0, D), iso(0.7, 0));
  ao(iso(0, 0), iso(W, 0), iso(0, 0.7));
  // 目地 = マスの線
  for (let i = 0; i <= W; i++) inkLine(ctx, J[i], { w: i === 0 ? 2.0 : 1.4, amp: 0.6, step: 14 });
  for (let j = 0; j <= D; j++) inkLine(ctx, J.map(col => col[j]), { w: j === 0 ? 2.0 : 1.4, amp: 0.6, step: 14 });
}

/** 手前縁石の下部が崩れて暗がりが覗いている表現 (参考画像の手前下の欠け) */
export function drawBreach(ctx, room, br) {
  seed('breach');
  const y = room.D + room.rim, S = room.slab;
  const pts = [iso(br.x0, y, -S)];
  const n = 8;
  for (let k = 1; k < n; k++) {
    const x = lerp(br.x0, br.x1, k / n);
    pts.push(iso(x, y, -S + Math.sin(Math.PI * k / n) * br.h + R(-0.07, 0.07)));
  }
  pts.push(iso(br.x1, y, -S));
  for (let k = n - 1; k > 0; k--) { // 下側にこぼれた暗部
    const x = lerp(br.x0, br.x1, k / n);
    pts.push(iso(x, y, -S - Math.sin(Math.PI * k / n) * br.h * 0.45 + R(-0.03, 0.03)));
  }
  const r = inkShape(ctx, pts, { fill: '#4a453f', w: 1.8, amp: 0.6 });
  hatchPoly(ctx, r, { angle: Math.PI / 2 - 0.12, gap: 2.2, w: 0.9, alpha: 0.9 });
  hatchPoly(ctx, r, { angle: -0.5, gap: 3.6, w: 0.7, alpha: 0.55 });
}

/**
 * アーチ扉: 左奥の壁(x=0面)に開口部を描き、側柱と迫石を浮き彫りで重ねる。
 * 開口部は「手前の輪郭」と「壁の厚み分ずらした奥の輪郭」の差で内側の石面を表現。
 * door = {wall:'left'|'right', c: 壁沿いの中心, hw: 半幅, spring: アーチの起点高さ, ring: 迫石の厚み, depth}
 * [実験A] wallFace() 経由にして、どちらの壁にも置けるよう一般化。
 */
export function drawArchDoor(ctx, room, door) {
  seed('door' + door.wall + door.c);
  const T = room.wallT, { c, hw, spring: zs, ring } = door;
  const { F, N } = wallFace(door.wall);
  const opening = (x) => {
    const pts = [F(c + hw, 0, x)];
    for (let k = 0; k <= 16; k++) {
      const th = Math.PI * k / 16;
      pts.push(F(c + hw * Math.cos(th), zs + hw * Math.sin(th), x));
    }
    pts.push(F(c - hw, 0, x));
    return pts;
  };
  // 奥の輪郭は壁の厚みより浅めにずらす (暗がりを大きく見せる)
  const front = opening(0), back = opening(-Math.min(T, door.depth ?? 0.3));
  ctx.save();
  clipPath(ctx, front);
  fillPoly(ctx, front, '#cfcac1');                 // 開口部の内側(側壁・床)
  stipplePoly(ctx, front, 4.5);
  fillPath(ctx, back, '#2f2b28');                  // 奥の暗がり
  hatchPoly(ctx, back, { angle: Math.PI / 2, gap: 2.1, w: 1.0, alpha: 0.9, color: '#0c0a09' });
  hatchPoly(ctx, back, { angle: -0.45, gap: 4, w: 0.7, alpha: 0.55, color: '#0c0a09' });
  strokePath(ctx, roughen(back, true, 0.6, 10), 1.4);
  ctx.restore();
  strokePath(ctx, roughen(front, true, 0.7, 10), 2.6);

  const ex = N(0.1);
  // 側柱: 長短交互に積む (高さの合計 = アーチの起点)
  let z = 0;
  [0.36, 0.33, 0.31].map(h => h * zs).forEach((h, k) => {
    const wL = k % 2 ? 0.26 : 0.36, wR = k % 2 ? 0.36 : 0.26;
    drawFaceStone(ctx, [F(c + hw + wL, z), F(c + hw, z), F(c + hw, z + h), F(c + hw + wL, z + h)], ex);
    drawFaceStone(ctx, [F(c - hw, z), F(c - hw - wR, z), F(c - hw - wR, z + h), F(c - hw, z + h)], ex);
    z += h;
  });
  // 迫石 (中央は要石として少し大きく)
  const n = 7;
  for (let k = 0; k < n; k++) {
    const t0 = Math.PI * k / n + 0.015, t1 = Math.PI * (k + 1) / n - 0.015;
    const ro = hw + ring + (k === 3 ? 0.08 : 0);
    const pts = [];
    for (let s = 0; s <= 4; s++) { const t = lerp(t0, t1, s / 4); pts.push(F(c + hw * Math.cos(t), zs + hw * Math.sin(t))); }
    for (let s = 4; s >= 0; s--) { const t = lerp(t0, t1, s / 4); pts.push(F(c + ro * Math.cos(t), zs + ro * Math.sin(t))); }
    drawFaceStone(ctx, pts, ex);
  }
}

/** 松明の光: 壁に暖色の円グラデーションを乗算で重ねる (静的) */
export function drawTorchGlow(ctx, room, t) {
  const p = wallFace(t.wall).F(t.a, t.z + 0.6, 0.25);
  const k = t.glow ?? 1, rad = 150 * Math.sqrt(k);   // [実験A] 部屋ごとの光の強さ
  const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, rad);
  g.addColorStop(0, `rgba(242,150,60,${0.55 * Math.min(1, k)})`);
  g.addColorStop(0.35, `rgba(244,172,95,${0.24 * k})`);
  g.addColorStop(1, 'rgba(244,190,120,0)');
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = g; ctx.fillRect(p.x - rad - 10, p.y - rad - 10, rad * 2 + 20, rad * 2 + 20);
  ctx.restore();
}

/** 松明の金具と柄 (静的部分)。t = {wall, a, z} 壁上の位置 [実験Aで一般化] */
export function drawTorchBracket(ctx, room, t) {
  seed('torch' + t.wall + t.a);
  const { F, N } = wallFace(t.wall);
  drawFaceStone(ctx, [F(t.a + 0.09, t.z - 0.34), F(t.a - 0.09, t.z - 0.34), F(t.a - 0.09, t.z + 0.06), F(t.a + 0.09, t.z + 0.06)],
    N(0.04), { face: '#7a7671', side: '#4e4a46', density: 2.5, round: 2, w: 1.6 });
  const p0 = F(t.a, t.z - 0.14, 0.04), c = torchCup(t);
  strokePath(ctx, [p0, c], 5, false); strokePath(ctx, [p0, c], 2.4, false, '#6b6762');
  inkShape(ctx, [{ x: c.x - 3, y: c.y - 26 }, { x: c.x + 3, y: c.y - 26 }, { x: c.x + 2.5, y: c.y }, { x: c.x - 2.5, y: c.y }],
    { fill: PAL.woodDark, w: 1.3, amp: 0.3 });
  const cup = inkShape(ctx, [{ x: c.x - 9, y: c.y - 11 }, { x: c.x + 9, y: c.y - 11 }, { x: c.x + 5, y: c.y + 6 }, { x: c.x - 5, y: c.y + 6 }],
    { fill: '#5c5854', w: 1.8, amp: 0.4, round: 2 });
  hatchPoly(ctx, cup, { angle: 1.3, gap: 2.5, w: 0.7, alpha: 0.6 });
  inkLine(ctx, [{ x: c.x - 8.5, y: c.y - 6 }, { x: c.x + 8.5, y: c.y - 6 }], { w: 1.1, amp: 0.2, double: 0 });
}

export const torchCup = t => wallFace(t.wall).F(t.a, t.z, 0.32);

/** 松明の床上の占有範囲 (炎を前後関係ソートに参加させるため) */
export const torchFootprint = t => t.wall === 'right'
  ? { x0: t.a - 0.12, x1: t.a + 0.12, y0: 0, y1: 0.36 }
  : { x0: 0, x1: 0.36, y0: t.a - 0.12, y1: t.a + 0.12 };

/** 炎: 外側オレンジ→内側黄色の涙形を重ね、インク線で縁取る。time で揺らぐ (動的) */
export function drawFlame(ctx, x, y, time) {
  const f = 1 + 0.08 * Math.sin(time * 11) + 0.05 * Math.sin(time * 17.3 + 1);
  const sw = Math.sin(time * 6.5) * 2.2;
  const tear = (w, h, s, oy = 0) => {
    const tip = { x: x + s, y: y + oy - h };
    return [
      { x: x - w, y: y + oy - h * 0.18 }, { x: x - w * 0.95, y: y + oy - h * 0.5 },
      { x: x - w * 0.4 + s * 0.5, y: y + oy - h * 0.8 }, tip, tip,          // 先端は点を重ねて尖らせる
      { x: x + w * 0.45 + s * 0.4, y: y + oy - h * 0.66 },
      { x: x + w * 0.95 + s * 0.6, y: y + oy - h * 0.86 }, { x: x + w * 0.95 + s * 0.6, y: y + oy - h * 0.86 }, // 横の舌
      { x: x + w * 0.8, y: y + oy - h * 0.52 }, { x: x + w, y: y + oy - h * 0.3 },
      { x: x + w * 0.75, y: y + oy - h * 0.02 }, { x: x, y: y + oy + h * 0.07 }, { x: x - w * 0.7, y: y + oy + h * 0.02 },
    ];
  };
  // ふんわりした光
  const g = ctx.createRadialGradient(x, y - 14, 2, x, y - 14, 40);
  g.addColorStop(0, 'rgba(255,200,110,0.45)'); g.addColorStop(1, 'rgba(255,200,110,0)');
  ctx.fillStyle = g; ctx.fillRect(x - 40, y - 54, 80, 80);
  const outer = tear(11, 36 * f, sw);
  fillPath(ctx, outer, PAL.flameOut);
  fillPath(ctx, tear(7.5, 27 * f, sw * 0.8, 1), PAL.flameMid);
  fillPath(ctx, tear(4, 16 * f, sw * 0.5, 1), PAL.flameIn);
  strokePath(ctx, outer, 1.6);
  ctx.fillStyle = PAL.flameOut; // 火の粉
  for (let k = 0; k < 3; k++) {
    const ph = (time * 0.9 + k * 0.33) % 1;
    ctx.globalAlpha = 1 - ph;
    ctx.beginPath(); ctx.arc(x + Math.sin(k * 2.1 + time * 3) * 6, y - 38 - ph * 26, 1.3, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 高台: 壁際に積んだ2段の石の台 */
export function buildDais(d) {
  seed('dais' + d.x0 + '_' + d.y0);
  const boxes = [], h2 = d.h / 2;
  [[0, h2], [h2, d.h]].forEach(([z0, z1]) => {
    runBlocks(d.x0, d.x1, (a0, a1) => boxes.push({ x0: a0, x1: a1, y0: d.y0, y1: d.y1, z0, z1 }), 0.6, 1.0);
  });
  return sortBoxes(boxes);
}

/** 部屋全体の太い外枠 (手前が崩れている部屋では崩れの部分を空ける)。実験A・C・Eと同じ */
export function drawOuterFrame(g, room) {
  const { W, D, H, wallT: T, rim: Rm, slab: S, breach: br } = room;
  seed('frame' + room.id);
  const o = { w: 3.4, amp: 0.8 };
  if (br) {
    inkLine(g, [iso(-T, D + Rm, H), iso(-T, D + Rm, -S), iso(br.x0, D + Rm, -S)], o);
    inkLine(g, [iso(br.x1, D + Rm, -S), iso(W + Rm, D + Rm, -S), iso(W + Rm, -T, -S), iso(W + Rm, -T, H)], o);
  } else {
    inkLine(g, [iso(-T, D + Rm, H), iso(-T, D + Rm, -S), iso(W + Rm, D + Rm, -S), iso(W + Rm, -T, -S), iso(W + Rm, -T, H)], o);
  }
}
