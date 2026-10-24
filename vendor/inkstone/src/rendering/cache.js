/**
 * Inkstone — Cached Frames (キャラのコマ画像のキャッシュ)
 *
 * キャッシュは「描画結果」を保持するだけで、姿勢は決めない。どのコマを貼るかは
 * 定義の動作 (period・コマ割り) と、ゲームから渡された actionTime だけで決まる。
 *
 * - 1つのストアは1つの Renderer (または CharacterView) が持つ。同じ職業の複数体は同じコマを共有する。
 * - コマは「倍率 k (= キャラの倍率 × カメラ倍率 × DPR)」と「描画設定 (線幅・ゆらぎ・足の補正)」と
 *   「定義そのもの」に依存する。どれかが変われば、次に使うときにその職業のコマを作り直す (古いコマは破棄)。
 * - 容量は幅 × 高さ × 4 (RGBA の理論値)。ブラウザが実際に使うメモリ (GPU 側の複製など) とは別物。
 * - 生成は同期処理 (その間は画面が止まる)。生成にかかった時間を pauses に記録する。
 */
import { DIR_ORDER } from '../characters/rig.js';
import { frameKeysOf } from '../characters/registry.js';
import { frameCanvas } from './sprites.js';
import { SHADOW_BOX, drawUnitShadow } from './effects.js';

export const modT = (t, p) => ((t % p) + p) % p;
/** 時刻 → コマ番号 (そのコマの開始位相 ≦ 現在の位相 となる最後のコマ) */
export function frameIndexOf(keys, u) { let i = 0; while (i + 1 < keys.length && keys[i + 1] <= u) i++; return i; }

/** 生成済みCanvasまたはアトラス内の1コマを、同じ実画素サイズで貼る。 */
export function drawCachedFrame(ctx, frame, x, y) {
  if (frame.image) ctx.drawImage(frame.image, frame.x, frame.y, frame.width, frame.height, x, y, frame.width, frame.height);
  else ctx.drawImage(frame, x, y);
}

/** 定義とアトラスの互換性を確認。コマ順・位相・足元原点を推測しない。 */
export function validateAtlas(def, k, draw, meta, image) {
  const fail=()=>{throw Error(`Inkstone: incompatible atlas for ${def.id}`);};
  if(meta.id!==def.id||meta.k!==k||['lw','boil','footGround','linearStance'].some(key=>meta.draw?.[key]!==draw[key]))fail();
  if(['x0','x1','y0','y1'].some(key=>meta.frameBox?.[key]!==def.frameBox[key]))fail();
  const width=Math.ceil((def.frameBox.x1-def.frameBox.x0)*k),height=Math.ceil((def.frameBox.y1-def.frameBox.y0)*k);
  const dirs=def.directional===false?['']:DIR_ORDER;
  if(JSON.stringify(meta.directions)!==JSON.stringify(dirs)||JSON.stringify(Object.keys(meta.actions||{}))!==JSON.stringify(Object.keys(def.actions)))fail();
  let count=0;
  for(const [name,spec] of Object.entries(def.actions)){
    const action=meta.actions[name],keys=frameKeysOf(spec);
    if(action.period!==spec.period||action.index!==(spec.index||'keys')||JSON.stringify(action.keys)!==JSON.stringify(keys))fail();
    count+=dirs.length*keys.length;
  }
  if(meta.frameWidth!==width||meta.frameHeight!==height||meta.frameCount!==count||!Number.isInteger(meta.columns)||meta.columns<1||meta.rows!==Math.ceil(count/meta.columns))fail();
  if(image.width!==width*meta.columns||image.height!==height*meta.rows)fail();
}

export function createFrameCacheStore() {
  const entries = new Map();   // id → { def, key, k, frames, keys, count, bytes, ms, frameW, frameH }
  const pauses = [];           // 同期生成の記録 [{ id, ms, frames, at }]
  let shadow = null;           // { k, c } 足元の影のスプライト
  const keyOf = (k, draw) => `${k}|${draw.lw}|${draw.boil}|${draw.footGround}|${draw.linearStance}`;

  function build(def, k, draw) {
    const t0 = performance.now(), frames = {}, keys = {}, dirs = def.directional === false ? [''] : DIR_ORDER;
    let count = 0, bytes = 0;
    for (const a of Object.keys(def.actions)) {
      keys[a] = frameKeysOf(def.actions[a]);
      for (const d of dirs) {
        frames[d + a] = keys[a].map(u => {
          const c = frameCanvas(k, def.frameBox, g => def.draw(g, 0, 0, d || null, a, u * def.actions[a].period, 1, { shadow: false }));
          count++; bytes += c.width * c.height * 4; return c;
        });
      }
    }
    const first = frames[(dirs[0]) + 'idle'][0];
    const e = { def, key: keyOf(k, draw), k, frames, keys, count, bytes, ms: performance.now() - t0, frameW: first.width, frameH: first.height };
    pauses.push({ id: def.id, ms: e.ms, frames: count, at: performance.now() });
    if (pauses.length > 50) pauses.shift();
    return e;
  }
  const release = e => { if(e.atlas){e.atlas.close?.();return;} for (const list of Object.values(e.frames)) for (const c of list) { c.width = 0; c.height = 0; } };

  return {
    /** 事前生成画像を登録。描画定義に一致しないデータは受け入れない。画像の所有権をストアへ渡す。 */
    installAtlas(def, k, draw, meta, image) {
      validateAtlas(def,k,draw,meta,image);
      const frames={},keys={};let index=0;
      for(const name of Object.keys(def.actions)){
        keys[name]=meta.actions[name].keys.slice();
        for(const dir of meta.directions)frames[dir+name]=keys[name].map(()=>{
          const i=index++;return {image,x:i%meta.columns*meta.frameWidth,y:Math.floor(i/meta.columns)*meta.frameHeight,width:meta.frameWidth,height:meta.frameHeight};
        });
      }
      const old=entries.get(def.id);if(old)release(old);
      entries.set(def.id,{def,key:keyOf(k,draw),k,frames,keys,count:index,bytes:image.width*image.height*4,ms:0,frameW:meta.frameWidth,frameH:meta.frameHeight,atlas:image});
    },
    /** その職業のコマ一式 (なければ・古ければ作る) */
    get(def, k, draw) {
      let e = entries.get(def.id);
      if (!e || e.def !== def || e.key !== keyOf(k, draw)) { if (e) release(e); e = build(def, k, draw); entries.set(def.id, e); }
      return e;
    },
    /** 作り直さずに参照だけする (なければ undefined) */
    peek: id => entries.get(id),
    /** 時刻 t のコマ。direction は向きを持たない定義では無視 */
    frame(e, direction, action, t) {
      const spec = e.def.actions[action], list = e.frames[(e.def.directional === false ? '' : direction) + action];
      const u = modT(t, spec.period) / spec.period;
      return list[spec.index === 'floor' ? Math.floor(u * list.length) % list.length : frameIndexOf(e.keys[action], u)];
    },
    /** 足元の影のスプライト (倍率 k ごと) */
    shadowSprite(k) {
      if (!shadow || shadow.k !== k) shadow = { k, c: frameCanvas(k, SHADOW_BOX, drawUnitShadow) };
      return shadow.c;
    },
    /** 破棄: ids を省略すると全部 (影も) */
    dispose(ids) {
      for (const id of ids || [...entries.keys()]) { const e = entries.get(id); if (e) { release(e); entries.delete(id); } }
      if (!ids) shadow = null;
    },
    /** 状態: 職業ごとのコマ数・RGBA 理論値・生成時間 */
    stats() {
      const out = {}; let frames = 0, bytes = 0;
      for (const [id, e] of entries) { out[id] = { frames: e.count, bytesRGBA: e.bytes, buildMs: e.ms, frameW: e.frameW, frameH: e.frameH, k: e.k, source:e.atlas?'atlas':'generated' }; frames += e.count; bytes += e.bytes; }
      if (shadow) bytes += shadow.c.width * shadow.c.height * 4;
      return { characters: out, totalFrames: frames, totalBytesRGBA: bytes };
    },
    pauses,
  };
}
