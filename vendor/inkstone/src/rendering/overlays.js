/**
 * Inkstone — 床と画面の表示用プリミティブ (マスのハイライト・点線・床の点・選択の印・プレビューのタイル・前後関係のデバッグ)
 *   どのマスに何を出すかはゲーム側が決める。Renderer の描画フック (floorOverlay / topOverlay) から呼ぶ。
 */
import { seed } from '../core/random.js';
import { TAU, TH, TW, centroid, iso } from '../core/geometry.js';
import { PAL } from '../core/palette.js';
import { fillPath, fillPoly, hatchPoly, roughen, stippleFace, strokePath } from '../core/ink.js';
import { DIRS } from '../characters/rig.js';

/** マスのハイライト: 乗算の半透明塗り + 色鉛筆風のストローク + 縁取り */
export function drawHighlightTile(ctx, i, j, fill, edge) {
  seed('hl' + i + '_' + j);
  const k = 0.05;
  const pts = [iso(i + k, j + k), iso(i + 1 - k, j + k), iso(i + 1 - k, j + 1 - k), iso(i + k, j + 1 - k)];
  const r = roughen(pts, true, 0.8, 12);
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  fillPath(ctx, r, fill);
  hatchPoly(ctx, r, { angle: Math.atan2(TH, TW), gap: 3.4, w: 1.0, alpha: 0.28, color: edge, amp: 0.4 });
  ctx.restore();
  strokePath(ctx, roughen(pts, true, 0.6, 12), 1.5, true, edge, 0.8);
}

/** プレビュー用の下敷きのアイソメ1マス (実験B/D/Eの確認画面より)。dirKey があれば向きの矢印 */
export function drawTile(g, cx, cy, k, dirKey, fill) {
  seed('tile' + Math.round(cx) + '_' + Math.round(cy));
  const hw = TW / 2 * k, hh = TH / 2 * k;
  const pts = [{ x: cx, y: cy - hh }, { x: cx + hw, y: cy }, { x: cx, y: cy + hh }, { x: cx - hw, y: cy }];
  fillPoly(g, pts, fill || PAL.floorA);
  stippleFace(g, pts[0], pts[1], pts[3], 1.6, { base: 0.15, edge: 0.8, fall: 8 });
  strokePath(g, roughen(pts, true, 0.6, 12), 1.4);
  if (dirKey) {
    const [fx, fy] = DIRS[dirKey].f, tip = { x: cx + (fx - fy) * hw * 0.36, y: cy + (fx + fy) * hh * 0.36 }, base = { x: cx - (fx - fy) * hw * 0.12, y: cy - (fx + fy) * hh * 0.12 };
    const ang = Math.atan2(tip.y - base.y, tip.x - base.x), ah = 8 * Math.min(1.4, k);
    g.save(); g.globalAlpha = 0.55; strokePath(g, [base, tip], 2.2, false, '#4f7442');
    fillPoly(g, [tip, { x: tip.x - Math.cos(ang - 0.45) * ah, y: tip.y - Math.sin(ang - 0.45) * ah }, { x: tip.x - Math.cos(ang + 0.45) * ah, y: tip.y - Math.sin(ang + 0.45) * ah }], '#4f7442'); g.restore();
  }
}

/** マス (i, j) の四隅 (k = 内側への余白) */
export function cellPoly(i, j, k = 0.06) { return [iso(i + k, j + k), iso(i + 1 - k, j + k), iso(i + 1 - k, j + 1 - k), iso(i + k, j + 1 - k)]; }
/** マスの点線の枠 (移動先・カーソルなど) */
export function dashedCell(ctx, i, j, color, w = 2) {
  ctx.save(); ctx.setLineDash([6, 5]); ctx.lineWidth = w; ctx.strokeStyle = color;
  const q = cellPoly(i, j, 0.1); ctx.beginPath(); q.forEach((p, n) => n ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.stroke(); ctx.restore();
}
/** 床の上の小さな楕円の点 (経路・射線の表示) */
export function floorDot(ctx, x, y, rx, ry, color) {
  const c = iso(x, y); ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU); ctx.fill();
}
/**
 * キャラの頭上の三角の印 (選択中のユニットなど)。(x, y) = ユニットの床上の位置。
 * bob = 上下の揺れ (px)。scale / footOffset は Renderer のキャラの倍率と足元の補正。
 */
export function drawUnitMarker(ctx, x, y, bob = 0, o = {}) {
  const scale = o.scale ?? 1.25, footOffset = o.footOffset ?? 6;
  const p = iso(x, y, 0), yy = p.y + footOffset - 112 * scale + bob;
  const tri = [{ x: p.x - 7, y: yy - 9 }, { x: p.x + 7, y: yy - 9 }, { x: p.x, y: yy }];
  fillPoly(ctx, tri, o.color || '#9bc27e'); ctx.lineWidth = 1.6; ctx.strokeStyle = PAL.ink; ctx.beginPath(); tri.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.stroke();
}
/** 前後関係のデバッグ表示: 描画順の番号と床上の占有範囲 (小物 = 青・キャラ = 赤・矢 = 黄土)、ユニットの論理位置 (赤点) */
export function drawDepthDebug(ctx, order, camScale) {
  ctx.save();
  ctx.font = `bold ${Math.round(12 / camScale)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  order.forEach((it, n) => {
    const f = it.fp, z = f.z0 || 0, col = it.kind === 'prop' ? '#2e6fb7' : it.kind === 'projectile' ? '#8a6d1f' : '#c0392b';
    const pts = [iso(f.x0, f.y0, z), iso(f.x1, f.y0, z), iso(f.x1, f.y1, z), iso(f.x0, f.y1, z)];
    ctx.setLineDash([5, 4]); ctx.lineWidth = 1.6 / camScale; ctx.strokeStyle = col;
    ctx.beginPath(); pts.forEach((p, m) => m ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    const c = centroid(pts);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(c.x - 10 / camScale, c.y - 8 / camScale, 20 / camScale, 16 / camScale);
    ctx.fillStyle = col; ctx.fillText(String(n + 1), c.x, c.y);
    if (it.kind === 'unit') { const p = iso(it.unit.x, it.unit.y, 0); ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(p.x, p.y, 3.2 / camScale, 0, TAU); ctx.fill(); }
  });
  ctx.restore();
}
