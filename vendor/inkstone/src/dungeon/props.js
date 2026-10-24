/**
 * Inkstone — 小物: 宝箱・木箱・樽・石柱・石の山・金貨・瓦礫 と、その床上の占有範囲 (前後関係のソート用)
 */
import { R, rnd, seed } from '../core/random.js';
import { TAU, convexHull, ellipsePts, facePt, iso, isoRX, isoRY } from '../core/geometry.js';
import { PAL } from '../core/palette.js';
import { clipPath, fillPath, fillPoly, hatchPoly, inkLine, inkShape, roughen, roundedPoly, stippleFace, stipplePoly, strokePath } from '../core/ink.js';
import { drawGroundShadow, drawStoneBox, drawStoneCylinder, sortBoxes } from './stone.js';

/**
 * 木の箱 (木箱・宝箱の本体で共用)。style: 'crate' は枠+X字の筋交い、'chest' は横板+金属帯。
 */
export function drawWoodBox(ctx, b, style = 'crate') {
  const T0 = iso(b.x0, b.y0, b.z1), T1 = iso(b.x1, b.y0, b.z1), T2 = iso(b.x1, b.y1, b.z1), T3 = iso(b.x0, b.y1, b.z1);
  const B1 = iso(b.x1, b.y0, b.z0), B2 = iso(b.x1, b.y1, b.z0), B3 = iso(b.x0, b.y1, b.z0);
  const sil = roughen(roundedPoly([T0, T1, B1, B2, B3, T3], 2), true, 0.6, 9);
  const faces = [
    { A: T3, B: T2, D: B3, col: PAL.wood, shade: 0.25 },     // +y 正面
    { A: T2, B: T1, D: B2, col: PAL.woodDark, shade: 0.5 },  // +x 側面 (暗め)
  ];
  if (style === 'crate') faces.push({ A: T0, B: T1, D: T3, col: PAL.woodLight, shade: 0, top: true });
  ctx.save();
  fillPath(ctx, sil, PAL.woodLight);
  clipPath(ctx, sil);
  for (const f of faces) {
    const { A, B, D } = f, P = (u, v) => facePt(A, B, D, u, v);
    fillPoly(ctx, [A, B, P(1, 1), D], f.col);
    if (f.shade) hatchPoly(ctx, [A, B, P(1, 1), D], { angle: 1.1, gap: 3.4, w: 0.7, alpha: f.shade });
    stippleFace(ctx, A, B, D, 0.8, { base: 0.15, edge: 0.6, fall: 8 });
    const L = (u0, v0, u1, v1, w = 1.1) => inkLine(ctx, [P(u0, v0), P(u1, v1)], { w, amp: 0.4, double: 0 });
    if (style === 'crate') {
      const k = 0.14;
      L(k, k, 1 - k, k); L(k, 1 - k, 1 - k, 1 - k); L(k, k, k, 1 - k); L(1 - k, k, 1 - k, 1 - k); // 枠
      if (!f.top) { L(k, k + 0.06, 1 - k - 0.06, 1 - k); L(k + 0.06, k, 1 - k, 1 - k - 0.06); }   // 筋交い
      else { L(k, 0.5, 1 - k, 0.5, 0.8); }
      for (let v = 0.3; v < 0.8; v += 0.2) L(k + 0.02, v + R(-0.02, 0.02), 1 - k - 0.02, v, 0.5);    // 木目
      ctx.fillStyle = PAL.ink;
      for (const [u, v] of [[k / 2, k / 2], [1 - k / 2, k / 2], [k / 2, 1 - k / 2], [1 - k / 2, 1 - k / 2]]) {
        const q = P(u, v); ctx.beginPath(); ctx.arc(q.x, q.y, 1.2, 0, TAU); ctx.fill();               // 釘
      }
    } else {
      for (const v of [0.34, 0.67]) L(0, v, 1, v, 0.9);                                             // 横板
      for (const u of [0.13, 0.87]) {                                                               // 金属帯
        const band = [P(u - 0.05, 0), P(u + 0.05, 0), P(u + 0.05, 1), P(u - 0.05, 1)];
        fillPoly(ctx, band, PAL.iron);
        inkLine(ctx, [band[0], band[3]], { w: 1, amp: 0.3, double: 0 }); inkLine(ctx, [band[1], band[2]], { w: 1, amp: 0.3, double: 0 });
      }
    }
  }
  ctx.restore();
  inkLine(ctx, [T3, T2, T1], { w: 1.3, amp: 0.5 }); inkLine(ctx, [T2, B2], { w: 1.3, amp: 0.5 });
  strokePath(ctx, sil, 2.0);
}

/**
 * 宝箱: 木の本体 + かまぼこ型の蓋(断面を x 方向へ押し出し) + 金属帯 + 錠前。
 * 長辺が x 方向、正面が +y (画面左下) 向き。p = {x, y, z, w, d, h, lid}
 */
export function drawTreasureChest(ctx, p) {
  seed('chest' + p.x + '_' + p.y);
  const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2, y0 = p.y - p.d / 2, y1 = p.y + p.d / 2, z1 = p.z + p.h;
  drawGroundShadow(ctx, p.x + 0.05, p.y + 0.05, p.w * 0.62, p.d * 0.9, { z: p.z, alpha: 0.45 });
  drawWoodBox(ctx, { x0, x1, y0, y1, z0: p.z, z1 }, 'chest');
  const yc = (y0 + y1) / 2, N = 12;
  const prof = (x, k) => { const th = Math.PI * k / N; return iso(x, yc + (p.d / 2) * Math.cos(th), z1 + p.lid * Math.sin(th)); };
  const all = [];
  for (let k = 0; k <= N; k++) all.push(prof(x0, k), prof(x1, k));
  const hull = roughen(convexHull(all), true, 0.5, 8);
  // 蓋の曲面: 奥→手前の帯を重ねて塗る (手前ほど明るい)
  for (let k = N - 1; k >= 0; k--) {
    fillPoly(ctx, [prof(x0, k), prof(x0, k + 1), prof(x1, k + 1), prof(x1, k)], k < 4 ? PAL.wood : PAL.woodLight);
  }
  ctx.save(); clipPath(ctx, hull);
  stipplePoly(ctx, hull, 0.9);
  for (const k of [3, 7]) inkLine(ctx, [prof(x0, k), prof(x1, k)], { w: 0.9, amp: 0.4, double: 0 }); // 板の継ぎ目
  ctx.restore();
  // 金属帯
  for (const x of [x0 + p.w * 0.13, x1 - p.w * 0.13]) {
    const arc = []; for (let k = 0; k <= N; k++) arc.push(prof(x, k));
    strokePath(ctx, arc, 5.5, false, PAL.ink); strokePath(ctx, arc, 3.2, false, PAL.iron);
  }
  // 端面 (+x)
  const cap = []; for (let k = 0; k <= N; k++) cap.push(prof(x1, k));
  const capR = inkShape(ctx, cap, { fill: PAL.woodDark, w: 1.6, amp: 0.4 });
  hatchPoly(ctx, capR, { angle: 1.1, gap: 3, w: 0.7, alpha: 0.5 });
  strokePath(ctx, hull, 2.0);
  // 錠前 (正面中央・蓋と本体の境目)
  const lk = iso(p.x, y1, z1 + 0.02);
  const plate = inkShape(ctx, [{ x: lk.x - 6, y: lk.y - 6 }, { x: lk.x + 6, y: lk.y - 6 }, { x: lk.x + 6, y: lk.y + 8 }, { x: lk.x - 6, y: lk.y + 8 }],
    { fill: PAL.gold, w: 1.5, amp: 0.3, round: 2 });
  ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(lk.x, lk.y + 0.5, 1.7, 0, TAU); ctx.fill();
  ctx.fillRect(lk.x - 0.7, lk.y + 1, 1.4, 4);
  void plate;
}

/** 木箱 */
export function drawCrate(ctx, p) {
  seed('crate' + p.x);
  drawGroundShadow(ctx, p.x + 0.08, p.y + 0.08, p.s * 0.8, p.s * 0.8, { alpha: 0.5 });
  const h = p.s / 2;
  drawWoodBox(ctx, { x0: p.x - h, x1: p.x + h, y0: p.y - h, y1: p.y + h, z0: 0, z1: p.s * 0.95 }, 'crate');
}

/** 樽: 膨らみのある円筒。側面の板(樽板)・鉄のたが・上面の板を描く。p = {x, y, r, h} */
export function drawBarrel(ctx, p) {
  seed('barrel' + p.x);
  drawGroundShadow(ctx, p.x + 0.08, p.y + 0.08, p.r * 1.25, p.r * 1.25, { alpha: 0.5 });
  const NR = 9;
  const ring = t => {
    const rr = p.r * (1 + 0.14 * Math.sin(Math.PI * t)), c = iso(p.x, p.y, p.h * t);
    return { cx: c.x, cy: c.y, rx: isoRX(rr), ry: isoRY(rr) };
  };
  const rings = []; for (let k = 0; k < NR; k++) rings.push(ring(k / (NR - 1)));
  const top = rings[NR - 1], bot = rings[0];
  const sil = [];
  for (const g of rings) sil.push({ x: g.cx - g.rx, y: g.cy });
  for (let a = Math.PI; a <= TAU + 1e-6; a += Math.PI / 12) sil.push({ x: top.cx + top.rx * Math.cos(a), y: top.cy + top.ry * Math.sin(a) });
  for (let k = NR - 1; k >= 0; k--) sil.push({ x: rings[k].cx + rings[k].rx, y: rings[k].cy });
  for (let a = 0; a <= Math.PI + 1e-6; a += Math.PI / 12) sil.push({ x: bot.cx + bot.rx * Math.cos(a), y: bot.cy + bot.ry * Math.sin(a) });
  const s = roughen(sil, true, 0.6, 8);
  fillPath(ctx, s, PAL.wood);
  ctx.save(); clipPath(ctx, s);
  // 右側を陰に (ハッチ + 点描)
  const shadeX = top.cx + top.rx * 0.25;
  hatchPoly(ctx, [{ x: shadeX, y: top.cy - 40 }, { x: shadeX + 80, y: top.cy - 40 }, { x: shadeX + 80, y: bot.cy + 40 }, { x: shadeX, y: bot.cy + 40 }],
    { angle: 1.2, gap: 2.8, w: 0.8, alpha: 0.6 });
  stipplePoly(ctx, s, 1.0);
  // 樽板
  for (const a of [0.35, 0.8, 1.25, 1.65, 2.05, 2.5, 2.85]) {
    inkLine(ctx, rings.map(g => ({ x: g.cx + g.rx * Math.cos(a), y: g.cy + g.ry * Math.sin(a) })), { w: 0.9, amp: 0.3, step: 8, double: 0 });
  }
  // たが
  for (const t of [0.12, 0.3, 0.7, 0.88]) {
    const g0 = ring(t), g1 = ring(t + 0.07);
    const band = [];
    for (let a = 0; a <= Math.PI + 1e-6; a += Math.PI / 12) band.push({ x: g0.cx + g0.rx * Math.cos(a), y: g0.cy + g0.ry * Math.sin(a) });
    for (let a = Math.PI; a >= -1e-6; a -= Math.PI / 12) band.push({ x: g1.cx + g1.rx * Math.cos(a), y: g1.cy + g1.ry * Math.sin(a) });
    fillPoly(ctx, band, '#4f4b47');
    strokePath(ctx, band, 1.1);
  }
  ctx.restore();
  strokePath(ctx, s, 2.0);
  // 上面
  const lid = roughen(ellipsePts(top.cx, top.cy, top.rx, top.ry, 30), true, 0.5, 8);
  fillPath(ctx, lid, PAL.woodLight);
  strokePath(ctx, lid, 1.8);
  const inner = ellipsePts(top.cx, top.cy, top.rx * 0.84, top.ry * 0.84, 30);
  ctx.save(); clipPath(ctx, inner);
  for (let k = -3; k <= 3; k++) {
    const o = k * top.rx * 0.27;
    inkLine(ctx, [{ x: top.cx + o - 12, y: top.cy - 20 }, { x: top.cx + o + 12, y: top.cy + 20 }], { w: 0.8, amp: 0.3, double: 0 });
  }
  stipplePoly(ctx, inner, 1.2);
  ctx.restore();
  strokePath(ctx, roughen(inner, true, 0.4, 8), 1.1);
}

/**
 * 柱: 四角い台座 + 円い礎盤 + 溝付きの柱身。[実験Aで一般化]
 *  broken (既定 true) → 上端が斜めに割れた折れ柱 / false → 柱頭(エキヌス+アバクス)付きの完全な柱
 *  p = {x, y, h, broken, tiltDir}
 */
export function drawColumn(ctx, p) {
  seed('column' + p.x + '_' + p.y);
  drawGroundShadow(ctx, p.x + 0.15, p.y + 0.15, 0.62, 0.62, { alpha: 0.45 });
  drawStoneBox(ctx, { x0: p.x - 0.42, x1: p.x + 0.42, y0: p.y - 0.42, y1: p.y + 0.42, z0: 0, z1: 0.2 }, { round: 4 });
  drawStoneCylinder(ctx, p.x, p.y, 0.2, 0.36, 0.36, {});
  if (p.broken !== false) {
    drawStoneCylinder(ctx, p.x, p.y, 0.36, p.h, 0.27, { flutes: true, tilt: 0.3, tiltDir: p.tiltDir ?? 2.4, jag: 0.15 });
  } else {
    drawStoneCylinder(ctx, p.x, p.y, 0.36, p.h - 0.3, 0.27, { flutes: true });
    drawStoneCylinder(ctx, p.x, p.y, p.h - 0.3, p.h - 0.17, 0.35, {});
    drawStoneBox(ctx, { x0: p.x - 0.42, x1: p.x + 0.42, y0: p.y - 0.42, y1: p.y + 0.42, z0: p.h - 0.17, z1: p.h }, { round: 4 });
  }
}

/** 石の障害物: 相対座標の箱リストを石ブロックとして積む。p = {x, y, boxes:[[x0,x1,y0,y1,z0,z1],...]} [実験A] */
export function drawStonePile(ctx, p) {
  seed('pile' + p.x + '_' + p.y);
  const fp = propFootprint(p);
  drawGroundShadow(ctx, (fp.x0 + fp.x1) / 2 + 0.1, (fp.y0 + fp.y1) / 2 + 0.1, (fp.x1 - fp.x0) * 0.62, (fp.y1 - fp.y0) * 0.62, { alpha: 0.45 });
  sortBoxes(p.boxes.map(([x0, x1, y0, y1, z0, z1]) => ({ x0: p.x + x0, x1: p.x + x1, y0: p.y + y0, y1: p.y + y1, z0, z1 })))
    .forEach(b => drawStoneBox(ctx, b, { round: 4, ...(p.stoneStyle || {}) }));
}

/** 金貨の小山 (宝物庫用・控えめな金色)。p = {x, y, n} [実験A] */
export function drawCoins(ctx, p) {
  seed('coins' + p.x + '_' + p.y);
  const c0 = iso(p.x, p.y, 0), coins = [];
  for (let k = 0; k < (p.n || 14); k++) {
    const a = R(0, TAU), r = Math.sqrt(rnd()) * 13;
    coins.push({ x: c0.x + Math.cos(a) * r, y: c0.y + Math.sin(a) * r * 0.55, z: Math.max(0, (13 - r) * 0.45) * R(0.6, 1) });
  }
  coins.sort((a, b) => (a.y - a.z * 0.1) - (b.y - b.z * 0.1));
  for (const q of coins) {
    const e = roughen(ellipsePts(q.x, q.y - q.z, 4.6, 2.4, 12), true, 0.3, 4);
    fillPath(ctx, e, PAL.gold); strokePath(ctx, e, 1.1);
  }
}

/**
 * 小物の床上の占有範囲と底面の高さ [実験A]。前後関係のソートに使う。
 */
export function propFootprint(p) {
  const sq = r => ({ x0: p.x - r, x1: p.x + r, y0: p.y - r, y1: p.y + r });
  switch (p.type) {
    case 'chest':  return { x0: p.x - p.w / 2, x1: p.x + p.w / 2, y0: p.y - p.d / 2, y1: p.y + p.d / 2, z0: p.z };
    case 'barrel': return sq(p.r * 1.14);
    case 'crate':  return sq(p.s / 2);
    case 'column': return sq(0.42);
    case 'rubble': return sq(p.s / 2);
    case 'coins':  return sq(0.22);
    case 'dais':   return { x0: p.x0, x1: p.x1, y0: p.y0, y1: p.y1 };
    case 'stones': {
      const xs = p.boxes.flatMap(b => [b[0], b[1]]), ys = p.boxes.flatMap(b => [b[2], b[3]]);
      return { x0: p.x + Math.min(...xs), x1: p.x + Math.max(...xs), y0: p.y + Math.min(...ys), y1: p.y + Math.max(...ys) };
    }
  }
  return sq(0.3);
}

/** 瓦礫: 小さな石ブロック */
export function drawRubble(ctx, p) {
  seed('rub' + p.x + p.y);
  const s = p.s, h = p.h ?? s * 0.7;
  drawStoneBox(ctx, { x0: p.x - s / 2, x1: p.x + s / 2, y0: p.y - s / 2, y1: p.y + s / 2, z0: 0, z1: h }, { round: 2.5, density: 1.3, w: 1.6, edgeW: 1.0, cracks: false });
}

/**
 * 小物の種類の表 (新しい小物はここに1行足す)。
 *   draw    : 描画関数 (ctx, p)。p は既定値・配置データ・位置 (x, y, z) を合わせたもの
 *   defaults: 既定の寸法 (実験C〜Eの部屋「石柱の間」と同じ値)
 *   height  : スプライトの高さ (ワールド単位)。前後関係の遮蔽判定にも使う
 *   label   : 表示名 (前後関係のデバッグ・状態表示用)
 */
export const PROP_TYPES = {
  column: { label: '石柱', draw: drawColumn, defaults: { h: 2.4, broken: false }, height: p => p.h },
  chest: { label: '宝箱', draw: drawTreasureChest, defaults: { at: [0, -0.06], w: 0.82, d: 0.52, h: 0.3, lid: 0.2, z: 0 }, height: p => p.h + p.lid + 0.08 },
  barrel: { label: '樽', draw: drawBarrel, defaults: { at: [0, -0.05], r: 0.36, h: 1.0 }, height: p => p.h * 1.08 },
  crate: { label: '木箱', draw: drawCrate, defaults: { s: 0.62 }, height: p => p.s },
  stones: { label: '石の山', draw: drawStonePile, defaults: { boxes: [[-0.4, 0.4, -0.4, 0.4, 0, 0.45], [-0.3, 0.25, -0.35, 0.2, 0.45, 0.85]] }, height: p => Math.max(...p.boxes.map(b => b[5])) },
  coins: { label: '金貨', draw: drawCoins, defaults: { n: 14 }, height: () => 0.3 },
  rubble: { label: '瓦礫', draw: drawRubble, defaults: { s: 0.14 }, height: p => p.h ?? p.s * 0.7 },
};
/** 配置データ (cell = 占有マス, at = マス中心からの見た目のずれ) → 描画用の小物データ。実験C〜Eの objectProp と同じ */
export function objectProp(o) {
  const t = PROP_TYPES[o.type];
  if (!t) throw new Error(`Inkstone: 未登録の小物 "${o.type}"。PROP_TYPES に登録してください`);
  const q = { ...t.defaults, ...o }, at = q.at || [0, 0];
  return { ...q, x: q.cell[0] + 0.5 + at[0], y: q.cell[1] + 0.5 + at[1], z: q.z || 0 };
}
/** 小物の3D外接箱 (スプライトの大きさ。影の分だけ床方向に余白)。実験C〜Eの propBox と同じ */
export function propBox(p) {
  const f = propFootprint(p), h = PROP_TYPES[p.type] ? PROP_TYPES[p.type].height(p) : 1;
  return { x0: f.x0 - 0.45, x1: f.x1 + 0.6, y0: f.y0 - 0.45, y1: f.y1 + 0.6, z0: 0, z1: (p.z || 0) + h + 0.15 };
}
