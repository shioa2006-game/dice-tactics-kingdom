/**
 * Inkstone — 手描きインク画風アイソメトリック描画ライブラリ (公開 API)
 *
 * 新しいゲームからはこのファイルだけを import すればよい:
 *   import { createRenderer } from './src/index.js';
 *
 * 公開するもの:
 *   - createRenderer          部屋とキャラクターを描く (ゲーム画面用)
 *   - createCharacterView     キャラクター1体を確認用に描く
 *   - キャラクター定義と登録   swordsman / archer / skeleton / BUILTIN_CHARACTERS / createCharacterRegistry / validateCharacter
 *   - 向き・動作の定数         DIRECTIONS / ACTIONS_LIST
 *   - 部屋                     ROOM_DEFAULTS / PROP_TYPES / normalizeRoom
 *   - 描画プリミティブ (新しい職業・小物を作るとき用) は ./authoring.js から
 */
export { createRenderer } from './rendering/renderer.js';
export { createCharacterView } from './rendering/character-view.js';
export { createCharacterRegistry, validateCharacter, BUILTIN_CHARACTERS, frameKeysOf } from './characters/registry.js';
export { swordsman } from './characters/swordsman.js';
export { archer, ARCHER_ATTACK_KEYS } from './characters/archer.js';
export { skeleton } from './characters/skeleton.js';
export { ROOM_DEFAULTS, normalizeRoom } from './dungeon/room.js';
export { PROP_TYPES } from './dungeon/props.js';
export { walkSecondsPerTile } from './characters/rig.js';
export { PAL as PALETTE } from './core/palette.js';
export { TW as TILE_WIDTH, TH as TILE_HEIGHT, ZH as HEIGHT_UNIT } from './core/geometry.js';

/** 向き: 画面上の4方向 (ワールドの軸 ±x, ±y) */
export const DIRECTIONS = Object.freeze({
  NW: Object.freeze({ key: 'NW', axis: '-x', vector: Object.freeze([-1, 0]) }),
  NE: Object.freeze({ key: 'NE', axis: '-y', vector: Object.freeze([0, -1]) }),
  SW: Object.freeze({ key: 'SW', axis: '+y', vector: Object.freeze([0, 1]) }),
  SE: Object.freeze({ key: 'SE', axis: '+x', vector: Object.freeze([1, 0]) }),
});
/** 動作: 人型キャラクターの共通の3動作 */
export const ACTIONS_LIST = Object.freeze(['idle', 'walk', 'attack']);
/** ライブラリの版 */
export const VERSION = '0.1.0';
