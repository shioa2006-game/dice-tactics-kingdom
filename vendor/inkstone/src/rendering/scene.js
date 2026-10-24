/**
 * Inkstone — 静的なシーン (背景1枚 + 小物ごとのスプライト)
 *   背景   : 紙・壁・扉・松明の金具と光・床・縁石・崩れ・床の瓦礫・外枠 (キャラが後ろへ回り込まない部分)
 *   小物   : 柱・宝箱・樽・木箱・高台・階段などは1つずつスプライト化し、毎フレームの前後関係ソートに参加させる
 * 部屋またはカメラ (倍率・位置・DPR・キャンバスの大きさ) が変わったときに作り直す。実験C〜Eの buildScene と同じ描画。
 */
import { iso, bbox } from '../core/geometry.js';
import { drawPaper } from '../core/ink.js';
import { drawRoomBackground, roomSolids } from '../dungeon/room.js';
import { camTransform, devX, devY } from './camera.js';
import { makeSprite } from './sprites.js';

export function buildStaticScene(room, cam) {
  const t0 = performance.now();
  const bg = document.createElement('canvas'); bg.width = cam.width * cam.dpr; bg.height = cam.height * cam.dpr;
  const g = bg.getContext('2d');
  g.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0); drawPaper(g, cam.width, cam.height);
  camTransform(g, cam);
  drawRoomBackground(g, room);
  const props = roomSolids(room).map(s => {
    const f = s.fp;
    const box = { x0: f.x0 - 0.45, x1: f.x1 + 0.6, y0: f.y0 - 0.45, y1: f.y1 + 0.6, z0: 0, z1: (s.p.z || 0) + s.height + 0.15 };   // 影の分だけ床方向に余白
    const h = box.z1 - 0.15, corners = [];
    for (const x of [f.x0, f.x1]) for (const y of [f.y0, f.y1]) for (const z of [0, h]) corners.push(iso(x, y, z));
    const vb = bbox(corners);   // 影を含まない見た目の外接矩形 (遮蔽判定用・デバイスpx)
    return { kind: 'prop', name: s.name, id: s.id, p: s.p, fp: f, sprite: makeSprite(cam, box, s.draw),
      vis: { x0: devX(cam, vb.x0), y0: devY(cam, vb.y0), x1: devX(cam, vb.x1), y1: devY(cam, vb.y1) } };
  });
  return { bg, props, buildMs: performance.now() - t0, bgBytes: bg.width * bg.height * 4, propBytes: props.reduce((s, it) => s + it.sprite.bytes, 0) };
}
/** シーンの画像を解放する */
export function disposeScene(scene) {
  if (!scene) return;
  scene.bg.width = scene.bg.height = 0;
  for (const p of scene.props) p.sprite.c.width = p.sprite.c.height = 0;
}
