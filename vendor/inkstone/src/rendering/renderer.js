/**
 * Inkstone — Renderer (部屋とキャラクターの描画)
 *
 * ゲームから「部屋のデータ」と「毎フレームの状態 (誰がどこで何をしているか)」を受け取って描く。
 * 経路探索・移動・攻撃の判定・当たり判定・ターンなどのゲームの規則は持たない。
 *
 * 1フレームの描画順 (実験C〜Eの dungeonFrame と同じ):
 *   背景 → floorOverlay フック (床の表示) → 足元の影 → 松明の炎 → 前後関係ソート (小物・キャラ・矢)
 *   → 透視表示 (柱の陰のキャラ) → エフェクト (火花) → topOverlay フック (選択の印など) → [デバッグ]
 *
 * Renderer ごとにカメラ・シーン・キャッシュ・描画設定・キャラクター登録簿を持つ。描画の入口で
 * 描画設定と乱数状態を自分のものに切り替え、終わったら元に戻すので、複数の Renderer を同じページで使っても混ざらない。
 */
import { isolateDrawing } from '../core/settings.js';
import { seed } from '../core/random.js';
import { iso, TW } from '../core/geometry.js';
import { PAL } from '../core/palette.js';
import { torchCup, drawFlame } from '../dungeon/architecture.js';
import { normalizeRoom } from '../dungeon/room.js';
import { DIRS, walkSecondsPerTile } from '../characters/rig.js';
import { createCharacterRegistry, resolveAction, BUILTIN_CHARACTERS } from '../characters/registry.js';
import { createCamera, defaultDpr, fitCameraToRoom, camTransform, devX, devY, worldToScreen, screenToWorld } from './camera.js';
import { depthSort, unitFootprint } from './depth-sort.js';
import { createFrameCacheStore } from './cache.js';
import { buildStaticScene, disposeScene } from './scene.js';
import { SHADOW_BOX, drawUnitShadow, drawArrowProjectile, drawHitSpark } from './effects.js';
import { drawHighlightTile, dashedCell, floorDot, drawUnitMarker, drawDepthDebug, cellPoly } from './overlays.js';

const MODES = ['live', 'cached'];

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas 描画先 (実画素の大きさは Renderer が width × dpr に設定する。CSS の大きさはアプリ側で決める)
 * @param {'live'|'cached'} [o.mode='live']
 * @param {number} [o.width=1200] 論理キャンバスの幅 (CSS px)
 * @param {number} [o.height=760] 論理キャンバスの高さ
 * @param {number} [o.dpr] 既定は min(2, devicePixelRatio)
 * @param {number} [o.characterScale=1.25] キャラの表示倍率 (部屋のマスに対する大きさ)
 * @param {number} [o.footOffset=6] 足元を下げる描画だけの補正 (ワールド px。論理位置は変えない)
 * @param {boolean} [o.lineBoil=true] 線のゆらぎ
 * @param {boolean} [o.footFix=true] 足の接地補正 (滑り防止)
 * @param {boolean} [o.xray=true] 柱の陰のキャラを半透明で重ねる
 * @param {object[]} [o.characters] 最初に登録するキャラクター定義 (既定: 剣士・弓使い・骸骨)
 * @param {object} [o.room] 最初の部屋 (setRoom と同じ)
 */
export function createRenderer(o = {}) {
  if (!o.canvas || typeof o.canvas.getContext !== 'function') throw new Error('Inkstone: createRenderer({ canvas }) に描画先のキャンバスを渡してください');
  const canvas = o.canvas, ctx = canvas.getContext('2d');
  const cam = createCamera({ width: o.width ?? 1200, height: o.height ?? 760, dpr: o.dpr ?? defaultDpr() });
  const st = {
    mode: MODES.includes(o.mode) ? o.mode : 'live',
    characterScale: o.characterScale ?? 1.25 * TW / 150, footOffset: o.footOffset ?? 6,
    draw: { lw: 1, boil: o.lineBoil ?? true, footGround: o.footFix ?? true, linearStance: o.footFix ?? true },
    xray: o.xray ?? true,
    room: null, scene: null, cameraFit: { margin: 26, maxScale: 1.1 },
    registry: createCharacterRegistry(o.characters || BUILTIN_CHARACTERS),
    caches: createFrameCacheStore(), ghostBuf: null, disposed: false,
    last: { totalMs: 0, characterMs: 0, order: [], occluded: [], warnings: [] },
  };
  const k = () => st.characterScale * cam.s * cam.dpr;   // キャラのコマ・影の倍率 (実験C〜Eの HERO_SCALE * cam.s * DPR と同じ計算順)
  const alive = () => { if (st.disposed) throw new Error('Inkstone: dispose() 済みの Renderer です'); };
  function applyCanvasSize() { canvas.width = cam.width * cam.dpr; canvas.height = cam.height * cam.dpr; }
  function rebuildScene() {
    disposeScene(st.scene); st.scene = null;
    if (st.room) st.scene = isolateDrawing(st.draw, () => buildStaticScene(st.room, cam));
  }
  applyCanvasSize();

  /* ---- キャラ1体 (実験C〜Eの drawCharacter) ---- */
  function drawUnitBody(u, def, action, t) {
    const p = iso(u.x, u.y, 0), fx = p.x + (u.shakeX || 0), fy = p.y + st.footOffset, flip = !!u.mirror;
    if (st.mode === 'cached') {
      const kk = k(), box = def.frameBox, c = st.caches.frame(st.caches.get(def, kk, st.draw), u.direction, action, t);
      const F = Math.round(devX(cam, fx)), top = Math.round(devY(cam, fy) + box.y0 * kk);
      ctx.setTransform(flip ? -1 : 1, 0, 0, 1, flip ? 2 * F : 0, 0);
      ctx.drawImage(c, Math.round(F + box.x0 * kk), top);
      return;
    }
    camTransform(ctx, cam);
    if (flip) { ctx.translate(fx, fy); ctx.scale(-1, 1); def.draw(ctx, 0, 0, u.direction, action, t, st.characterScale, { shadow: false }); }
    else def.draw(ctx, fx, fy, u.direction, action, t, st.characterScale, { shadow: false });
  }
  function drawShadowAt(x, y) {
    const p = iso(x, y, 0);
    if (st.mode === 'cached') {
      const kk = k();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(st.caches.shadowSprite(kk), Math.round(devX(cam, p.x) + SHADOW_BOX.x0 * kk), Math.round(devY(cam, p.y + st.footOffset) + SHADOW_BOX.y0 * kk));
    } else { camTransform(ctx, cam); ctx.translate(p.x, p.y + st.footOffset); ctx.scale(st.characterScale, st.characterScale); drawUnitShadow(ctx); }
  }
  /* ---- 透視表示 (実験C〜Eの charRect / isOccluded / drawGhost) ---- */
  function charRect(def, x, y) {
    const box = def.frameBox, kk = k(), p = iso(x, y, 0), F = devX(cam, p.x), B = devY(cam, p.y + st.footOffset);
    return { x0: F + box.x0 * kk, y0: B + box.y0 * kk, x1: F + box.x1 * kk, y1: B + box.y1 * kk };
  }
  function isOccluded(it, order) {
    const r = charRect(it.def, it.unit.x, it.unit.y);
    for (let n = order.indexOf(it) + 1; n < order.length; n++) {
      const q = order[n]; if (q.kind !== 'prop') continue;
      const v = q.vis; if (v.x0 < r.x1 && v.x1 > r.x0 && v.y0 < r.y1 && v.y1 > r.y0) return true;
    }
    return false;
  }
  function drawGhost(u, def, action, t, alpha = 0.38) {
    const box = def.frameBox, kk = k(), p = iso(u.x, u.y, 0), flip = !!u.mirror;
    let src;
    if (st.mode === 'cached') src = st.caches.frame(st.caches.get(def, kk, st.draw), u.direction, action, t);
    else {
      const w = Math.ceil((box.x1 - box.x0) * kk), h = Math.ceil((box.y1 - box.y0) * kk);
      if (!st.ghostBuf || st.ghostBuf.width !== w || st.ghostBuf.height !== h) { st.ghostBuf = document.createElement('canvas'); st.ghostBuf.width = w; st.ghostBuf.height = h; }
      const g = st.ghostBuf.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.setTransform(kk, 0, 0, kk, -box.x0 * kk, -box.y0 * kk);
      def.draw(g, 0, 0, u.direction, action, t, 1, { shadow: false });
      src = st.ghostBuf;
    }
    const F = Math.round(devX(cam, p.x)), top = Math.round(devY(cam, p.y + st.footOffset) + box.y0 * kk);
    ctx.save(); ctx.setTransform(flip ? -1 : 1, 0, 0, 1, flip ? 2 * F : 0, 0);
    ctx.globalAlpha = alpha; ctx.drawImage(src, Math.round(F + box.x0 * kk), top); ctx.restore();
  }
  /* ---- 描画フックに渡す道具 (カメラ変換は設定済み) ---- */
  function overlayApi(timeSeconds, order) {
    return {
      timeSeconds, order, camera: { ...cam }, characterScale: st.characterScale, footOffset: st.footOffset, iso,
      highlightTile: (i, j, fill = PAL.tileAlly, edge = PAL.tileAllyEdge) => drawHighlightTile(ctx, i, j, fill, edge),
      dashedCell: (i, j, color, w) => dashedCell(ctx, i, j, color, w),
      dot: (x, y, rx, ry, color) => floorDot(ctx, x, y, rx, ry, color),
      marker: (x, y, bob = 0, color) => drawUnitMarker(ctx, x, y, bob, { scale: st.characterScale, footOffset: st.footOffset, color }),
      depthDebug: () => drawDepthDebug(ctx, order, cam.s),
      cellPoly, palette: PAL,
    };
  }
  function checkUnit(u, def) {
    if (def.directional !== false && !DIRS[u.direction]) throw new Error(`Inkstone: unit "${u.id}" の direction は NW / NE / SW / SE のどれかにしてください (受け取った値: ${u.direction})`);
    if (!(Number.isFinite(u.x) && Number.isFinite(u.y))) throw new Error(`Inkstone: unit "${u.id}" の x, y (床上のワールド座標) が数値ではありません`);
  }

  const api = {
    get canvas() { return canvas; },
    get mode() { return st.mode; },
    get room() { return st.room; },
    get characterScale() { return st.characterScale; },
    get footOffset() { return st.footOffset; },
    /** 歩行の actionTime = 歩いた距離 (マス) × この値 にすると足が滑らない */
    get walkSecondsPerTile() { return walkSecondsPerTile(st.characterScale); },

    /** 部屋を設定する (カメラを部屋に合わせ、背景と小物を描き直す) */
    setRoom(roomData) {
      alive(); st.room = normalizeRoom(roomData);
      if (st.cameraFit) fitCameraToRoom(cam, st.room, st.cameraFit.margin, st.cameraFit.maxScale);
      rebuildScene(); return api;
    },
    /** 描画方式: 'live' (毎フレームベクター描画) / 'cached' (コマ画像を貼る) */
    setMode(mode) { alive(); if (!MODES.includes(mode)) throw new Error(`Inkstone: mode は ${MODES.join(' / ')}`); st.mode = mode; return api; },
    /** 描画設定 { lineBoil, footFix, xray } の変更 (コマのキャッシュは次の描画で作り直される) */
    setOptions({ lineBoil, footFix, xray } = {}) {
      alive();
      if (lineBoil !== undefined) st.draw.boil = !!lineBoil;
      if (footFix !== undefined) st.draw.footGround = st.draw.linearStance = !!footFix;
      if (xray !== undefined) st.xray = !!xray;
      return api;
    },
    getOptions: () => ({ mode: st.mode, lineBoil: st.draw.boil, footFix: st.draw.footGround, xray: st.xray, characterScale: st.characterScale, footOffset: st.footOffset }),

    /* ---- カメラ ---- */
    /** 部屋全体が収まるようにする (以後、部屋や大きさが変わるたびに自動で合わせる) */
    fitToRoom({ margin = 26, maxScale = 1.1 } = {}) {
      alive(); st.cameraFit = { margin, maxScale };
      if (st.room) { fitCameraToRoom(cam, st.room, margin, maxScale); rebuildScene(); }
      return api;
    },
    /** カメラを手動で決める: scale = 倍率、(centerX, centerY) = 画面中央に来る床上のワールド座標 */
    setCamera({ scale = cam.s, centerX, centerY } = {}) {
      alive(); st.cameraFit = null;
      const c = iso(centerX ?? (st.room ? st.room.W / 2 : 0), centerY ?? (st.room ? st.room.D / 2 : 0), 0);
      cam.s = scale; cam.tx = cam.width / 2 - scale * c.x; cam.ty = cam.height / 2 - scale * c.y;
      rebuildScene(); return api;
    },
    getCamera: () => ({ scale: cam.s, tx: cam.tx, ty: cam.ty, dpr: cam.dpr, width: cam.width, height: cam.height }),
    /** キャンバスの論理サイズと DPR を変える */
    resize(width, height, dpr = cam.dpr) {
      alive(); cam.width = width; cam.height = height; cam.dpr = dpr; applyCanvasSize();
      if (st.room && st.cameraFit) fitCameraToRoom(cam, st.room, st.cameraFit.margin, st.cameraFit.maxScale);
      rebuildScene(); return api;
    },
    /** ワールド座標 (床上 x, y, 高さ z) → 論理キャンバス座標 (CSS px) */
    worldToScreen: (x, y, z = 0) => worldToScreen(cam, x, y, z),
    /** 論理キャンバス座標 → 床上のワールド座標 */
    screenToWorld: (px, py) => screenToWorld(cam, px, py),
    /** マウスなどのイベント → 床上のワールド座標 (キャンバスの CSS 上の大きさを考慮) */
    eventToWorld(e) {
      const r = canvas.getBoundingClientRect();
      return screenToWorld(cam, (e.clientX - r.left) * cam.width / r.width, (e.clientY - r.top) * cam.height / r.height);
    },
    /** イベント → 論理キャンバス座標 */
    eventToScreen(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * cam.width / r.width, y: (e.clientY - r.top) * cam.height / r.height }; },

    /* ---- キャラクター登録 ---- */
    registerCharacter: def => { alive(); return st.registry.register(def); },
    getCharacter: id => st.registry.get(id),
    hasCharacter: id => st.registry.has(id),
    listCharacters: () => st.registry.list(),

    /* ---- キャッシュ ---- */
    /** コマを今すぐ作る (ゲームの読み込み中に呼ぶと、描画中の同期生成による停止を避けられる)。ids 省略 = 登録済み全部 */
    prepareCaches(ids) {
      alive();
      return isolateDrawing(st.draw, () => {
        const out = {}, kk = k();
        for (const id of ids || st.registry.list().map(d => d.id)) { const e = st.caches.get(st.registry.get(id), kk, st.draw); out[id] = { frames: e.count, bytesRGBA: e.bytes, buildMs: e.ms }; }
        st.caches.shadowSprite(kk);
        return out;
      });
    },
    disposeCaches(ids) { st.caches.dispose(ids); return api; },

    /**
     * 1フレーム描く。
     * @param {object} f
     * @param {number} [f.timeSeconds=0] 画面全体の演出の時刻 (松明の炎など)
     * @param {object[]} [f.units] [{ id, character, x, y, direction, action, actionTime, mirror?, shakeX?, xray? }]
     * @param {object[]} [f.projectiles] [{ id?, character, x, y, direction, distance, stuck?, stuckFor?, embedded? }]
     * @param {object[]} [f.effects] [{ type: 'hitSpark', x, y, progress }]
     * @param {(ctx, api) => void} [f.floorOverlay] 背景の直後 (床の上・キャラの下) に描くフック
     * @param {(ctx, api) => void} [f.topOverlay] 最後に描くフック (選択の印など)
     * @param {boolean} [f.debug] 前後関係のデバッグ表示
     */
    render(f = {}) {
      alive();
      if (!st.scene) throw new Error('Inkstone: 先に setRoom(roomData) で部屋を設定してください');
      return isolateDrawing(st.draw, () => {
        seed('inkstone-frame');   // 直前の描画が残した乱数状態に依存しないように (自分で seed しない描画が最初に来ても同じ絵になる)
        const t0 = performance.now(), T = f.timeSeconds ?? 0, units = f.units || [], warnings = [];
        let charMs = 0;
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(st.scene.bg, 0, 0);
        if (f.floorOverlay) { camTransform(ctx, cam); f.floorOverlay(ctx, overlayApi(T, [])); }
        const items = [];
        for (const u of units) {
          const def = st.registry.get(u.character); checkUnit(u, def);
          const action = resolveAction(def, u.action || 'idle');
          if (action !== (u.action || 'idle')) warnings.push(`${u.id}: ${def.id} には動作 "${u.action}" がないため idle で描画`);
          items.push({ kind: 'unit', name: u.id ?? def.label, unit: u, def, action, t: u.actionTime ?? 0, fp: u.footprint || unitFootprint(u), ghost: u.xray !== false });
        }
        let a = performance.now();
        for (const it of items) drawShadowAt(it.unit.x, it.unit.y);
        charMs += performance.now() - a;
        camTransform(ctx, cam);
        for (const t of st.room.torches) { const c = torchCup(t); drawFlame(ctx, c.x, c.y - 24, T + t.a); }
        const shots = (f.projectiles || []).map(pr => {
          const def = st.registry.get(pr.character), pj = def.projectile;
          if (!pj) throw new Error(`Inkstone: "${def.id}" には projectile の定義がありません`);
          const info = pj.origin(pr.direction), [fx, fy] = info.f, p = iso(pr.x, pr.y, 0), s = pr.distance ?? 0;
          const arrow = { sx: p.x + info.nock.x * st.characterScale, sy: p.y + st.footOffset + info.nock.y * st.characterScale, f: [fx, fy], s,
            stuck: !!pr.stuck, stuckFor: pr.stuckFor ?? 0, embedded: pr.embedded !== false, shape: pj.draw, len: pj.length };
          const se = Math.max(s, 0.35), x = pr.x + fx * se, y = pr.y + fy * se;
          return { kind: 'projectile', name: pr.id ?? '矢', fp: { x0: x - 0.06, x1: x + 0.06, y0: y - 0.06, y1: y + 0.06, z0: 0.9 }, arrow };
        });
        const order = depthSort(st.scene.props.concat(items, shots));
        for (const it of order) {
          if (it.kind === 'prop') { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(it.sprite.c, it.sprite.x, it.sprite.y); }
          else if (it.kind === 'projectile') { camTransform(ctx, cam); drawArrowProjectile(ctx, it.arrow, st.characterScale); }
          else { a = performance.now(); drawUnitBody(it.unit, it.def, it.action, it.t); charMs += performance.now() - a; }
        }
        const occluded = [];
        if (st.xray) for (const it of order) if (it.kind === 'unit' && it.ghost && isOccluded(it, order)) {
          a = performance.now(); drawGhost(it.unit, it.def, it.action, it.t); charMs += performance.now() - a; occluded.push(it.name);
        }
        for (const e of f.effects || []) {
          if (e.type === 'hitSpark') { const p = iso(e.x, e.y, 0); camTransform(ctx, cam); drawHitSpark(ctx, p.x, p.y + st.footOffset - 48 * st.characterScale, e.progress ?? 0); }
          else warnings.push(`未対応のエフェクト "${e.type}"`);
        }
        if (f.topOverlay) { camTransform(ctx, cam); f.topOverlay(ctx, overlayApi(T, order)); }
        if (f.debug) { camTransform(ctx, cam); drawDepthDebug(ctx, order, cam.s); }
        st.last = { totalMs: performance.now() - t0, characterMs: charMs, order: order.map(it => it.name), occluded, warnings };
        return st.last;
      });
    },

    /** 診断情報: 直前のフレーム・シーン・キャッシュ (RGBA 理論値)・同期生成の記録 */
    getDiagnostics() {
      const cs = st.caches.stats();
      return {
        mode: st.mode, options: api.getOptions(), camera: api.getCamera(), characterFrameScale: k(),
        lastFrame: { ...st.last },
        scene: st.scene ? { buildMs: st.scene.buildMs, bgBytesRGBA: st.scene.bgBytes, propBytesRGBA: st.scene.propBytes, props: st.scene.props.length } : null,
        caches: cs, syncPauses: st.caches.pauses.slice(),
        memoryNote: 'bytesRGBA は幅×高さ×4 の理論値。ブラウザの実メモリ (GPU 側の複製などを含む) とは異なる',
      };
    },
    /** 後始末 (キャッシュとシーンの画像を解放し、以後の呼び出しをエラーにする) */
    dispose() {
      if (st.disposed) return;
      st.caches.dispose(); disposeScene(st.scene); st.scene = null; st.ghostBuf = null; st.disposed = true;
    },
  };
  if (o.room) api.setRoom(o.room);
  return api;
}
