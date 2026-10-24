/**
 * Inkstone — 描画用の軽量エフェクト: 足元の影・飛んでいる矢・当たりの火花
 *   どこに何を出すか (矢がどこまで飛んだか、火花を何割再生したか) はゲーム側が決めて渡す。
 *   絵は実験C〜Eと同じ。
 */
import { seed } from '../core/random.js';
import { TAU, TW, TH, ellipsePts } from '../core/geometry.js';
import { PAL } from '../core/palette.js';
import { roughen, hatchPoly, strokePath, fillPoly } from '../core/ink.js';

/** 足元の影の範囲 (ローカル px) と描画 (ハッチングの楕円) */
export const SHADOW_BOX = Object.freeze({ x0: -26, x1: 26, y0: -10, y1: 12 });
export function drawUnitShadow(g) {
  seed('hero-shadow');
  hatchPoly(g, roughen(ellipsePts(0, 1, 19, 6.5, 20), true, 0.5, 6), { angle: -0.45, gap: 3, w: 0.75, alpha: 0.55 });
}

/**
 * 飛んでいる矢 (ワールドの軸 f に沿って進む。速度線・刺さった矢のめり込み・刺さった瞬間の衝撃線)。
 * ctx はカメラの変換を設定済みであること。
 * a = { sx, sy (放った位置・ワールド px), f: [fx, fy], s (進んだマス数), stuck, stuckFor (刺さってからの秒), embedded (刺さるか), shape, len }
 * scale = キャラの表示倍率
 */
export function drawArrowProjectile(ctx, a, scale) {
  const v = { x: (a.f[0] - a.f[1]) * TW / 2, y: (a.f[0] + a.f[1]) * TH / 2 }, vl = Math.hypot(v.x, v.y), d = { x: v.x / vl, y: v.y / vl };
  const p = { x: a.sx + v.x * a.s, y: a.sy + v.y * a.s };
  ctx.save();
  if (!a.stuck) for (let i = 1; i <= 3; i++) {                                      // 速度線
    const q = { x: p.x - d.x * (6 + i * 7), y: p.y - d.y * (6 + i * 7) + (i - 2) * 2.2 };
    strokePath(ctx, [q, { x: q.x - d.x * 9, y: q.y - d.y * 9 }], 1.1, false, PAL.ink, 0.35);
  }
  const len = a.len * scale, ins = a.stuck && a.embedded ? 6 * scale : 0;           // 刺さった矢は少しめり込む
  a.shape(ctx, { x: p.x + d.x * ins, y: p.y + d.y * ins }, d, len, scale);
  ctx.restore();
  if (a.stuck && a.embedded && a.stuckFor < 0.18) {                                 // 刺さった瞬間の衝撃線
    const tip = { x: p.x + d.x * (len + ins + 6), y: p.y + d.y * (len + ins + 6) }, k = a.stuckFor / 0.18;
    ctx.save(); ctx.globalAlpha = 1 - k; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const an = Math.atan2(-d.y, -d.x) + (i - 2) * 0.45; strokePath(ctx, [{ x: tip.x + Math.cos(an) * 4, y: tip.y + Math.sin(an) * 4 }, { x: tip.x + Math.cos(an) * (9 + k * 5), y: tip.y + Math.sin(an) * (9 + k * 5) }], 1.4, false, PAL.ink, 1); }
    ctx.restore();
  }
}

/**
 * 当たりの火花 (放射状の線 + 白い星)。(cx, cy) = 中心 (ワールド px)、k = 再生の割合 0〜1。
 * ctx はカメラの変換を設定済みであること。
 */
export function drawHitSpark(ctx, cx, cy, k) {
  ctx.save(); ctx.globalAlpha = 1 - k * 0.8; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * TAU + 0.3, r0 = 6 + k * 10, r1 = 16 + k * 22 + (i % 2) * 8;
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
  }
  ctx.fillStyle = '#fffdf2'; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.6;
  const star = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 5 : 12 - k * 4; star.push({ x: cx + Math.cos(i / 10 * TAU) * r, y: cy + Math.sin(i / 10 * TAU) * r }); }
  fillPoly(ctx, star, '#fffdf2'); ctx.beginPath(); star.forEach((q, n) => n ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath(); ctx.stroke();
  ctx.restore();
}
