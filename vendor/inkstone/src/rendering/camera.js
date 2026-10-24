/**
 * Inkstone — カメラ (表示倍率・平行移動・DPR)
 *
 * 実験Eでは cam / DPR がページ全体の大域変数だった。ここでは Renderer ごとに1つのカメラを持つ。
 *   論理座標 (CSS px) : キャンバスの見た目の大きさ width × height
 *   デバイス座標      : 論理 × dpr (キャンバスの実画素)
 *   ワールド px       : iso() の出力 (原点 = 床の奥の角)
 *   論理 = (tx, ty) + s × ワールド px
 */
import { iso, bbox, TW, TH, ZH } from '../core/geometry.js';

/** @returns {{width:number,height:number,dpr:number,s:number,tx:number,ty:number}} */
export function createCamera({ width = 1200, height = 760, dpr = 1 } = {}) {
  return { width, height, dpr, s: 1, tx: 0, ty: 0 };
}
/** ブラウザの devicePixelRatio (実験C〜Eと同じく最大 2) */
export const defaultDpr = () => Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);

/** 部屋の外形 (実験A・C〜Eの roomOutline。手前が崩れている部屋は崩れの分だけ下へ広げる) */
export function roomOutlineBounds(room) {
  const { W, D, H, wallT: T, rim: Rm, slab: S } = room, Ht = H + 0.12;
  const b = bbox([iso(-T, -T, Ht), iso(W + Rm, -T, Ht), iso(W + Rm, -T, -S), iso(W + Rm, D + Rm, -S), iso(-T, D + Rm, -S), iso(-T, D + Rm, Ht)]);
  b.y1 += room.breach ? 0.45 * ZH : 0;
  return b;
}
/** 部屋全体が収まるように倍率と位置を決める (実験C〜Eの fitCamera と同じ計算。余白 26px・最大 1.1倍) */
export function fitCameraToRoom(cam, room, margin = 26, maxScale = 1.1) {
  const b = roomOutlineBounds(room), m = margin;
  cam.s = Math.min((cam.width - 2 * m) / (b.x1 - b.x0), (cam.height - 2 * m) / (b.y1 - b.y0), maxScale);
  cam.tx = cam.width / 2 - cam.s * (b.x0 + b.x1) / 2;
  cam.ty = cam.height / 2 - cam.s * (b.y0 + b.y1) / 2;
  return cam;
}
/** コンテキストにカメラの変換を設定する (ワールド px で描けるようにする) */
export const camTransform = (g, cam) => g.setTransform(cam.dpr * cam.s, 0, 0, cam.dpr * cam.s, cam.dpr * cam.tx, cam.dpr * cam.ty);
/** ワールド px → デバイス px */
export const devX = (cam, wx) => cam.dpr * (cam.tx + cam.s * wx);
export const devY = (cam, wy) => cam.dpr * (cam.ty + cam.s * wy);
/** ワールド座標 (床の上の x, y, 高さ z) → 論理キャンバス座標 */
export function worldToScreen(cam, x, y, z = 0) {
  const p = iso(x, y, z);
  return { x: cam.tx + cam.s * p.x, y: cam.ty + cam.s * p.y };
}
/** 論理キャンバス座標 → ワールド座標 (z = 0 の床面)。実験C〜Eの screenToWorld と同じ */
export function screenToWorld(cam, px, py) {
  const wx = (px - cam.tx) / cam.s, wy = (py - cam.ty) / cam.s;
  const a = wx / (TW / 2), b = wy / (TH / 2);   // a = x−y, b = x+y
  return { x: (a + b) / 2, y: (b - a) / 2 };
}
