/**
 * Inkstone — 幾何・アイソメトリック投影の基本
 *   ワールド座標 (x: 右下へ, y: 左下へ, z: 上) → 画面座標。1マス = 画面上 TW×TH px、高さ1 = ZH px。
 *   実験Eまでは iso() が CFG.OX/OY (画面上の原点) を足していたが、ライブラリでは原点を常に 0 とし、
 *   画面上の位置合わせはカメラ (rendering/camera.js) が行う (実験Eのダンジョンも OX = OY = 0 だった)。
 */
/** アイソメ1マスの画面上の幅・高さ (px)、ワールド高さ1単位あたりの px */
export const TW = 150, TH = 84, ZH = 66;

export const TAU = Math.PI * 2;

export const lerp = (a, b, t) => a + (b - a) * t;

export const add = (p, q) => ({ x: p.x + q.x, y: p.y + q.y });

export const sub = (p, q) => ({ x: p.x - q.x, y: p.y - q.y });

export const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

/** ワールド座標(x:右奥→右下, y:左奥→左下, z:上) → 画面座標 (原点 = 床の奥の角) */
export function iso(x, y, z = 0) {
  return { x: (x - y) * TW / 2, y: (x + y) * TH / 2 - z * ZH };
}

/** ワールドのベクトル → 画面のベクトル */
export function isoVec(dx, dy, dz = 0) {
  return { x: (dx - dy) * TW / 2, y: (dx + dy) * TH / 2 - dz * ZH };
}

/** 床に置いた半径rの円 → 画面上の楕円の半径 */
export const isoRX = r => r * TW / Math.SQRT2;

export const isoRY = r => r * TH / Math.SQRT2;

export function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; }
  return { x0, y0, x1, y1 };
}

export function centroid(pts) {
  let x = 0, y = 0; for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

export function ellipsePts(cx, cy, rx, ry, n = 28, a0 = 0, a1 = TAU) {
  const out = [];
  const closed = Math.abs(a1 - a0 - TAU) < 1e-6;
  const cnt = closed ? n : n + 1;
  for (let i = 0; i < cnt; i++) {
    const a = a0 + (a1 - a0) * i / n;
    out.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return out;
}

/** 凸包 (曲面の外形線を求めるのに使う) */
export function convexHull(points) {
  const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

export const facePt = (A, B, D, u, v) => ({ x: A.x + (B.x - A.x) * u + (D.x - A.x) * v, y: A.y + (B.y - A.y) * u + (D.y - A.y) * v });

/** 4点の四辺形内を (u,v) で補間 */
export function quadPt(a, b, c, d, u, v) {
  const p = { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
  const q = { x: lerp(d.x, c.x, u), y: lerp(d.y, c.y, u) };
  return { x: lerp(p.x, q.x, v), y: lerp(p.y, q.y, v) };
}

export const V = arr => arr.map(([x, y]) => ({ x, y }));
