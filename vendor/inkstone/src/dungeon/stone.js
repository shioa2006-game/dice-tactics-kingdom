/**
 * Inkstone — 石材の共通部品: 石ブロック (直方体)・石の積み方・壁から浮き出た石・石の円柱・接地影
 */
import { R } from '../core/random.js';
import { TAU, add, centroid, ellipsePts, iso, isoRX, isoRY, lerp } from '../core/geometry.js';
import { PAL } from '../core/palette.js';
import { clipPath, faceCracks, fillPath, fillPoly, hatchPoly, inkLine, rimWeight, roughen, roundedPoly, stippleFace, stipplePoly, strokePath, tracePath } from '../core/ink.js';

/**
 * drawStoneBox — 軸平行の直方体を「手描きの石ブロック」として描く基本部品。
 *  見える面は 上面 / +x面(右下向き) / +y面(左下向き) の3面。
 *  壁・階段・高台・手前の縁石・柱の台座などは、すべてこれの組み合わせ。
 * @param b {x0,x1,y0,y1,z0,z1} ワールド座標
 * @param o {round, density, w, edgeW, cracks, top, toneX, toneY, amp}
 */
export function drawStoneBox(ctx, b, o = {}) {
  const T0 = iso(b.x0, b.y0, b.z1), T1 = iso(b.x1, b.y0, b.z1), T2 = iso(b.x1, b.y1, b.z1), T3 = iso(b.x0, b.y1, b.z1);
  const B1 = iso(b.x1, b.y0, b.z0), B2 = iso(b.x1, b.y1, b.z0), B3 = iso(b.x0, b.y1, b.z0);
  // 外形(六角形)を角丸+揺らぎにして、石らしいゴロッとしたシルエットに
  // 角ごとに丸みの大きさを変える → 欠けた角・摩耗した角がランダムに混ざる
  const rr = o.round ?? 5;
  const sil = roughen(roundedPoly([T0, T1, B1, B2, B3, T3], () => rr * R(0.4, 1.9)), true, o.amp ?? 1.0, 9);
  const d = o.density ?? 1;
  ctx.save();
  fillPath(ctx, sil, o.top || PAL.stoneTop);
  clipPath(ctx, sil);
  fillPoly(ctx, [T1, B1, B2, T2], o.toneX || PAL.stoneX);
  fillPoly(ctx, [T3, T2, B2, B3], o.toneY || PAL.stoneY);
  // 点描: 上面は薄く、側面ほど・下ほど・縁ほど濃く
  stippleFace(ctx, T0, T1, T3, 1.2 * d, { base: 0.06, edge: 1.0, fall: 7 });
  stippleFace(ctx, T2, T1, B2, 3.6 * d, { base: 0.1, edge: 1.0, fall: 5, vgrad: 0.5 });
  stippleFace(ctx, T3, T2, B3, 4.6 * d, { base: 0.16, edge: 1.0, fall: 5, vgrad: 0.55 });
  if (o.cracks !== false) { faceCracks(ctx, T2, T1, B2); faceCracks(ctx, T3, T2, B3); }
  ctx.restore();
  // 内側の稜線は細め、外形線は太め
  const ew = o.edgeW ?? 1.3;
  inkLine(ctx, [T3, T2, T1], { w: ew, amp: 0.6, double: 0.3 });
  inkLine(ctx, [T2, B2], { w: ew, amp: 0.6, double: 0.3 });
  strokePath(ctx, sil, o.w ?? 2.0);
  return sil;
}

/** 箱の描画順: 下の段から、同じ段は奥(x+yが小さい)から */
export function sortBoxes(boxes) {
  return boxes.sort((p, q) => (p.z0 - q.z0) || ((p.x0 + p.y0) - (q.x0 + q.y0)));
}

/** 一列に並ぶ石の長さをランダムに割り振る (先頭を半端にして段ごとに目地をずらす) */
export function runBlocks(a0, a1, cb, minL = 0.6, maxL = 1.15) {
  let a = a0, first = true;
  while (a < a1 - 1e-3) {
    let len = first ? R(0.3, 0.95) : R(minL, maxL);
    first = false;
    if (a1 - (a + len) < 0.3) len = a1 - a;   // 細すぎる端材は吸収
    cb(a, a + len); a += len;
  }
}

/** 壁面から少し浮き出た石 (迫石・側柱・金具の台座など)。poly は壁面上の画面座標、ext は浮き出し方向 */
export function drawFaceStone(ctx, poly, ext, o = {}) {
  const back = roughen(roundedPoly(poly, o.round ?? 3), true, 0.5, 8);
  const front = back.map(p => add(p, ext));
  ctx.fillStyle = o.side || PAL.stoneY;
  tracePath(ctx, back, true); ctx.fill();
  for (let i = 0; i < back.length; i++) { // 厚み(側面)
    const a = back[i], b = back[(i + 1) % back.length];
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.lineTo(b.x + ext.x, b.y + ext.y); ctx.lineTo(a.x + ext.x, a.y + ext.y); ctx.closePath(); ctx.fill();
  }
  strokePath(ctx, back, 1.4);
  fillPath(ctx, front, o.face || PAL.stoneX);
  stipplePoly(ctx, front, o.density ?? 3.4, { wfn: rimWeight(front, 0.15, 0.95) });
  strokePath(ctx, front, o.w ?? 2.0);
  return front;
}

/**
 * 石の円柱 (折れた上端に対応)。jag>0 で上端をギザギザに斜めに折る。
 */
export function drawStoneCylinder(ctx, cx, cy, z0, z1, r, o = {}) {
  const c0 = iso(cx, cy, z0), rx = isoRX(r), ry = isoRY(r), N = 36;
  const tilt = o.tilt || 0, jag = o.jag || 0;
  const ztop = []; // 角度ごとの上端の高さ
  for (let i = 0; i < N; i++) {
    const a = TAU * i / N;
    ztop.push(z1 + tilt * Math.cos(a - (o.tiltDir ?? 0.8)) + (jag ? R(-jag, jag) * (i % 2 ? 1 : 0.4) : 0));
  }
  const topPt = i => { const a = TAU * i / N, p = iso(cx, cy, ztop[i]); return { x: p.x + rx * Math.cos(a), y: p.y + ry * Math.sin(a) }; };
  const sil = [];
  sil.push({ x: c0.x - rx, y: c0.y });
  for (let i = N / 2; i <= N; i++) sil.push(topPt(i % N));                     // 奥側の上端
  sil.push({ x: c0.x + rx, y: c0.y });
  for (let i = 1; i < N / 2; i++) { const a = TAU * i / N; sil.push({ x: c0.x + rx * Math.cos(a), y: c0.y + ry * Math.sin(a) }); }
  const s = roughen(sil, true, 0.6, 8);
  fillPath(ctx, s, PAL.stoneX);
  ctx.save(); clipPath(ctx, s);
  stipplePoly(ctx, s, 5, { wfn: (x) => 0.15 + 0.85 * Math.pow(Math.max(0, (x - (c0.x - rx)) / (2 * rx)), 1.8) });
  for (let k = 0; k < 3; k++) { // 縦のひび・欠け
    const a = R(0.3, 2.8), zz = R(z0 + 0.2, z1 - 0.3), p = iso(cx, cy, zz);
    const q = { x: p.x + rx * Math.cos(a), y: p.y + ry * Math.sin(a) };
    inkLine(ctx, [q, { x: q.x + R(-3, 3), y: q.y + R(6, 12) }, { x: q.x + R(-4, 4), y: q.y + R(14, 22) }], { w: 0.9, amp: 0.4, step: 4, double: 0 });
  }
  hatchPoly(ctx, [{ x: c0.x + rx * 0.55, y: c0.y - 400 }, { x: c0.x + rx + 4, y: c0.y - 400 }, { x: c0.x + rx + 4, y: c0.y + 30 }, { x: c0.x + rx * 0.55, y: c0.y + 30 }],
    { angle: Math.PI / 2, gap: 2.6, w: 0.7, alpha: 0.45 });
  if (o.flutes) { // 溝
    for (const a of [0.45, 0.95, 1.45, 1.95, 2.45]) {
      const i = Math.round(a / TAU * N), tp = topPt(i);
      inkLine(ctx, [{ x: c0.x + rx * Math.cos(a), y: c0.y + ry * Math.sin(a) }, { x: tp.x, y: tp.y + 4 }], { w: 1.0, amp: 0.5, double: 0.2 });
    }
  }
  ctx.restore();
  strokePath(ctx, s, 2.0);
  // 上面 (折れ口)
  const topPoly = []; for (let i = 0; i < N; i++) topPt(i) && topPoly.push(topPt(i));
  const tp = roughen(topPoly, true, 0.5, 6);
  fillPath(ctx, tp, PAL.stoneTop);
  stipplePoly(ctx, tp, jag ? 2.2 : 0.8, { wfn: rimWeight(tp, 0.2, 0.9) });
  strokePath(ctx, tp, jag ? 1.7 : 1.5);
  if (jag) { // 折れ口のひび
    const ct = centroid(tp);
    for (let k = 0; k < 3; k++) {
      const p = topPoly[Math.floor(R(0, N))];
      inkLine(ctx, [p, { x: lerp(p.x, ct.x, 0.6) + R(-3, 3), y: lerp(p.y, ct.y, 0.6) + R(-2, 2) }], { w: 0.8, amp: 0.4, double: 0 });
    }
  }
}

/** 接地影: 床に落ちる楕円をハッチング+点描で */
export function drawGroundShadow(ctx, x, y, rx, ry, o = {}) {
  const c = iso(x, y, o.z || 0);
  const pts = roughen(ellipsePts(c.x, c.y, isoRX(rx) * 0.75, isoRY(ry) * 0.75, 24), true, 0.8, 8);
  ctx.save();
  hatchPoly(ctx, pts, { angle: -0.45, gap: 3.2, w: 0.75, alpha: o.alpha ?? 0.5 });
  ctx.restore();
}
