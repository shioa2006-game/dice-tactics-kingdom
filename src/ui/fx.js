// KINGDOM — 元ゲームのイベント・音声を Studio の盤面へ接続する演出アダプタ。
// 状態・AP・HP・位置・勝敗の更新は app.js と core のみで行う。
import { ARCHER, MAGE, MONSTER } from '../core/config.js';
import * as V from './view.js';
import * as B from './kingdom-board.js';
import * as S from './audio/sfx.js';

const reducedMQ = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
let cfg = null;
let calm = false;
let gen = 0;

export const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
export function init(config) { cfg = config; }
export function setCalm(v) { calm = !!v; }
export const still = () => calm || reducedMQ.matches || document.hidden;

function sound(fn) {
  try { fn(); }
  catch (err) { console.error('効果音を省略しました:', err); }
}

/** 新局面へ移った後に、以前の演出・予約音を再開しない。 */
export function cancelAll() {
  gen++;
  sound(() => S.silenceAll());
  B.cancelAnimation();
}

function safe(fn) {
  return async (...args) => {
    try { await fn(...args); }
    catch (err) {
      console.error('演出を打ち切りました:', err);
      cancelAll();
    }
  };
}

/** rAF が止まったときもゲーム進行を止めない上限。 */
async function bounded(task, ms) {
  let timer;
  try {
    await Promise.race([
      Promise.resolve(task),
      new Promise((resolve) => {
        timer = setTimeout(() => { B.cancelAnimation(); resolve(); }, Math.max(200, ms + 250));
      }),
    ]);
  } finally { clearTimeout(timer); }
}

const sideOf = (u) => cfg.unitSide[u];
const secs = (ms, quiet) => quiet ? 0.06 : ms / 1000;

/** 元の applyAction() が返したイベントだけを順番に再生する。 */
export const playEvents = safe(async (events, { speed = 1 } = {}) => {
  const my = gen;
  B.beginEvents();
  const first = events.find((e) => e.type === 'move' || e.type === 'attack');
  if (first && sideOf(first.unit) === MONSTER) {
    await bounded(B.followEvents(events, { still: still() }), 850);
    if (my !== gen) return;
  }
  let attack = null;
  for (const e of events) {
    if (my !== gen) return;
    const quiet = still();
    let ms = 0;
    if (e.type === 'move') {
      const steps = Math.max(1, e.path.length);
      ms = Math.min(600, 140 + 90 * steps) * speed;
      sound(() => S.move(steps, secs(ms, quiet) / steps, sideOf(e.unit)));
    } else if (e.type === 'attack') {
      attack = e;
      const type = cfg.unitType[e.unit];
      if (type === ARCHER) {
        ms = (130 + 45 * e.dist) * speed;
        sound(() => S.bow(sideOf(e.unit), secs(ms, quiet)));
      } else if (type === MAGE) {
        ms = (240 + 50 * e.dist) * speed;
        sound(() => S.magic(sideOf(e.unit), secs(ms, quiet), e.overObstacle));
      } else {
        ms = 300 * speed;
        sound(() => S.swing(sideOf(e.unit)));
      }
    } else if (e.type === 'damage') {
      if (attack) {
        const kind = { [ARCHER]: 'arrow', [MAGE]: 'magic' }[cfg.unitType[attack.unit]] || 'melee';
        sound(() => S.hit(kind, sideOf(attack.unit)));
      }
      ms = (e.hp > 0 ? 220 : 80) * speed;
    } else if (e.type === 'kill') {
      ms = 460 * speed;
      sound(() => S.kill(sideOf(e.unit)));
    } else if (e.type === 'knockback') {
      ms = 220 * speed;
      sound(() => S.push(secs(ms, quiet)));
    } else if (e.type === 'knockbackBlocked') {
      ms = 240 * speed;
      sound(() => S.blocked());
    } else continue;
    await bounded(B.animateEvent(e, { duration: ms, still: quiet }), quiet ? 0 : ms);
  }
});

/** 元に戻した状態の反映は呼び出し側。ここでは歩行を逆方向へ見せるだけ。 */
export const slide = safe(async (unit, from, to, speed = 1) => {
  B.beginEvents();
  const quiet = still();
  const duration = 200 * speed;
  await bounded(B.animateEvent({ type: 'move', unit, from, to, path: [to] }, { duration, still: quiet }), quiet ? 0 : duration);
});

/** 本当の出目は決定済み。途中で描画が止まっても時間上限で進める。 */
export const rollDice = safe(async (values, maxes, speed = 1) => {
  if (still()) {
    sound(() => S.diceLand(values, maxes));
    V.showDice(values, maxes, 'landed');
    return;
  }
  const dur = 560 * speed;
  const my = gen;
  sound(() => S.diceRoll(dur / 1000));
  const landTimer = setTimeout(() => {
    if (my === gen) sound(() => S.diceLand(values, maxes));
  }, dur);
  try {
    const t0 = performance.now();
    while (performance.now() - t0 < dur) {
      if (my !== gen) return;
      V.showDice(maxes.map((m) => Math.floor(Math.random() * (m + 1))), maxes, 'rolling');
      await sleep(70);
    }
    if (my !== gen) return;
    V.showDice(values, maxes, 'landed');
    await sleep(160 * speed);
  } finally {
    if (my !== gen) clearTimeout(landTimer);
  }
});
