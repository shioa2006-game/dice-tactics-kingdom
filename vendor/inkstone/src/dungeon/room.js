/**
 * Inkstone — 部屋データ
 *
 * 矩形の部屋 (奥の2面の壁 + 床 + 手前の縁石) をデータで指定する。
 * 外から渡す形式 (RoomData) は読みやすい名前、内部の描画関数は実験A〜Eと同じ短い名前 (W, D, H …) を使う。
 * normalizeRoom() が前者を後者へ変換し、省略した値を既定値で埋める。
 *
 * 座標: 床のマス (i, j) は x ∈ [i, i+1), y ∈ [j, j+1)。x は画面右下へ、y は画面左下へ伸びる。
 * 壁は x = 0 (左奥の壁 'left') と y = 0 (右奥の壁 'right') の2面。
 */
import { drawStoneBox } from './stone.js';
import { buildWalls, buildRim, buildStairs, buildDais, stairsFootprint, drawFloor, drawBreach, drawArchDoor, drawTorchGlow, drawTorchBracket, drawOuterFrame } from './architecture.js';
import { PROP_TYPES, objectProp, propFootprint } from './props.js';

/**
 * 既定値 (実験C〜Eの部屋「石柱の間」と同じ寸法)。
 * id は石の割り付け・床のひびなどの乱数の種になる。同じ id なら同じ石組みになる。
 */
export const ROOM_DEFAULTS = Object.freeze({
  id: '', width: 6, depth: 6, wallHeight: 3.24, courseHeight: 0.54, wallThickness: 0.6, rim: 0.55, slab: 0.7,
  floor: { crack: 0.35, chip: 0.25 },
});

/**
 * RoomData → 内部形式。
 * @param {object} r RoomData (API_REFERENCE.md の「部屋データ」)
 */
export function normalizeRoom(r = {}) {
  const v = (k, short) => r[k] ?? r[short] ?? ROOM_DEFAULTS[k];
  const room = {
    id: r.id ?? ROOM_DEFAULTS.id, name: r.name || '',
    W: v('width', 'W'), D: v('depth', 'D'), H: v('wallHeight', 'H'), courseH: v('courseHeight', 'courseH'),
    wallT: v('wallThickness', 'wallT'), rim: v('rim', 'rim'), slab: v('slab', 'slab'),
    floor: { ...ROOM_DEFAULTS.floor, ...(r.floor || {}) },
    doors: (r.doors || []).map(d => ({ wall: d.wall || 'left', c: d.at ?? d.c, hw: d.halfWidth ?? d.hw ?? 0.64, spring: d.spring ?? 1.3, ring: d.ring ?? 0.3, depth: d.depth ?? 0.3 })),
    torches: (r.torches || []).map(t => ({ wall: t.wall || 'right', a: t.at ?? t.a, z: t.height ?? t.z ?? 1.95, ...(t.glow !== undefined ? { glow: t.glow } : {}) })),
    stairs: (r.stairs || []).map(s => ({ ...s })),
    dais: (r.dais || []).map(d => ({ ...d })),
    breach: r.breach ? { ...r.breach } : null,
    objects: (r.objects || []).map(o => ({ ...o })),
    decor: (r.decor || []).map(o => ({ ...o })),
  };
  if (!(room.W >= 1 && room.D >= 1)) throw new Error('Inkstone: 部屋の width / depth は 1 以上にしてください');
  for (const o of room.objects) {
    if (!PROP_TYPES[o.type]) throw new Error(`Inkstone: 未登録の小物 "${o.type}" (登録済み: ${Object.keys(PROP_TYPES).join(', ')})`);
    if (!Array.isArray(o.cell)) throw new Error(`Inkstone: 小物 "${o.type}" に cell: [i, j] がありません`);
  }
  for (const o of room.decor) {
    if (!PROP_TYPES[o.type]) throw new Error(`Inkstone: 未登録の小物 "${o.type}" (decor)`);
    if (!(Number.isFinite(o.x) && Number.isFinite(o.y))) throw new Error(`Inkstone: decor の小物 "${o.type}" には x, y (床上の位置) が必要です`);
  }
  return room;
}

/**
 * 静的な背景 (キャラが後ろへ回り込むことのない部分) を描く: 壁 → 松明の光 → 扉 → 松明の金具 → 床 → 縁石 → 崩れ → 床の瓦礫 → 外枠。
 * g はカメラの変換を設定済みのコンテキスト。描く順序と乱数の種は実験C〜Eと同じ。
 */
export function drawRoomBackground(g, room) {
  buildWalls(room).forEach(b => drawStoneBox(g, b, { w: b.z0 > room.H - room.courseH - 0.01 ? 2.8 : 2.3 }));
  room.torches.forEach(t => drawTorchGlow(g, room, t));
  room.doors.forEach(d => drawArchDoor(g, room, d));
  room.torches.forEach(t => drawTorchBracket(g, room, t));
  drawFloor(g, room);
  buildRim(room).forEach(b => drawStoneBox(g, b, { density: 1.1 }));
  if (room.breach) drawBreach(g, room, room.breach);
  room.decor.forEach(p => PROP_TYPES[p.type].draw(g, { ...PROP_TYPES[p.type].defaults, ...p }));
  drawOuterFrame(g, room);
}

/**
 * 前後関係ソートに参加する静的な物体 (小物・高台・階段) の一覧。
 * 戻り値: [{ name, p (描画データ), fp (床上の占有範囲), box (3D外接箱), draw(g) }]
 */
export function roomSolids(room) {
  const out = room.objects.map(o => {
    const p = objectProp(o), t = PROP_TYPES[p.type], f = propFootprint(p);
    return { name: o.label || t.label, id: o.id, p, fp: { ...f, z0: p.z }, height: t.height(p), draw: g => t.draw(g, p) };
  });
  for (const d of room.dais) {
    const p = { type: 'dais', ...d };
    out.push({ name: d.label || '高台', p, fp: propFootprint(p), height: d.h, draw: g => buildDais(d).forEach(b => drawStoneBox(g, b)) });
  }
  for (const st of room.stairs) {
    out.push({ name: st.label || '階段', p: st, fp: stairsFootprint(st), height: st.steps * st.rise, draw: g => buildStairs(st).forEach(b => drawStoneBox(g, b)) });
  }
  return out;
}
