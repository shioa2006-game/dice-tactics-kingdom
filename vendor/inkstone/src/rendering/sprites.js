/**
 * Inkstone — オフスクリーンのスプライト (小物・キャラのコマ)
 *
 * 描画先の原点をデバイス画素の整数位置に揃えるので、貼り付けてもにじまない。
 * 実験C〜Eの makeSprite / frameCanvas と同じ計算 (カメラと倍率を引数で受け取るようにしただけ)。
 */
import { iso, bbox } from '../core/geometry.js';
import { devX, devY } from './camera.js';

/**
 * 3D箱 box (ワールド座標) を囲むスプライトを作り、drawFn(g) をワールド座標で描く。
 * @returns {{c: HTMLCanvasElement, x: number, y: number, bytes: number}} x, y = 貼る位置 (デバイス px)
 */
export function makeSprite(cam, box, drawFn) {
  const pts = [];
  for (const x of [box.x0, box.x1]) for (const y of [box.y0, box.y1]) for (const z of [box.z0, box.z1]) pts.push(iso(x, y, z));
  const b = bbox(pts), pad = 14;
  const sx0 = Math.floor(devX(cam, b.x0 - pad)), sy0 = Math.floor(devY(cam, b.y0 - pad));
  const sx1 = Math.ceil(devX(cam, b.x1 + pad)), sy1 = Math.ceil(devY(cam, b.y1 + pad));
  const c = document.createElement('canvas');
  c.width = sx1 - sx0; c.height = sy1 - sy0;
  const g = c.getContext('2d');
  g.setTransform(cam.dpr * cam.s, 0, 0, cam.dpr * cam.s, cam.dpr * cam.tx - sx0, cam.dpr * cam.ty - sy0);
  drawFn(g);
  return { c, x: sx0, y: sy0, bytes: c.width * c.height * 4 };
}
/**
 * キャラのコマ1枚: ローカル座標の箱 box を k 倍 (= キャラの倍率 × カメラ倍率 × DPR) で描く。
 * 足元 (0, 0) が箱の中の (−box.x0, −box.y0) × k に来る。
 */
export function frameCanvas(k, box, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil((box.x1 - box.x0) * k); c.height = Math.ceil((box.y1 - box.y0) * k);
  const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, -box.x0 * k, -box.y0 * k); draw(g);
  return c;
}
