// 表示専用の待機方向。ゲームの位置・HP・APには書き込まない。
const attackDirections = ['NE', 'SE', 'SW', 'NW'];

export function directionToward(from, to, width, previous) {
  if (from < 0 || to < 0 || from === to) return previous;
  const dx = to % width - from % width;
  const dy = Math.floor(to / width) - Math.floor(from / width);
  const horizontal = dx > 0 ? 'SE' : 'NW';
  const vertical = dy > 0 ? 'SW' : 'NE';
  // ちょうど中間なら、候補に含まれる現在方向を保って不要な回転を避ける。
  if (Math.abs(dx) === Math.abs(dy) && [horizontal, vertical].includes(previous)) return previous;
  return Math.abs(dx) > Math.abs(dy) ? horizontal : vertical;
}

export function createFacing(cfg) {
  let directions = [], history = new WeakMap();
  const towardLeader = (s, u, previous) => directionToward(
    s.pos[u], s.pos[cfg.leaderOf[cfg.unitSide[u] ^ 1]], cfg.W, previous);
  return {
    reset(s) {
      history = new WeakMap();
      directions = Array.from({length:cfg.unitCount}, (_, u) => towardLeader(s, u, cfg.unitSide[u] === 0 ? 'NE' : 'SW'));
      history.set(s, directions.slice());
    },
    complete(before, after, action, events) {
      if (!['move', 'attack'].includes(action.type)) return;
      history.set(before, directions.slice());
      const u = action.unit;
      const attack = events.find(e => e.type === 'attack' && e.unit === u);
      // 王撃破後は最後の攻撃方向を維持する。押し出された側は自分の行動ではない。
      const previous = attack ? attackDirections[attack.dir] : directions[u];
      directions[u] = towardLeader(after, u, previous);
      history.set(after, directions.slice());
    },
    restore(s) {
      const saved = history.get(s);
      if (saved) directions = saved.slice();
    },
    get(u) { return directions[u]; },
  };
}
