// 表示名と正式カタログID。ユニットの配列順は元ゲームの cfg に従う。
export const CHARACTER_IDS = ['king','warrior','warrior','archer','archer','mage','demon-king','goblin','goblin','skeleton-archer','skeleton-archer','dark-mage'];
export const NAMES = ['王','剣士1','剣士2','弓使い1','弓使い2','魔法使い','魔王','ゴブリン戦士1','ゴブリン戦士2','骸骨弓兵1','骸骨弓兵2','暗黒魔法使い'];
export const unitName = (_cfg, u) => NAMES[u] ?? '';
