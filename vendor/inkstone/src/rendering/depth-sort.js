/**
 * Inkstone — 前後関係ソート (床上の占有範囲 fp による位相ソート)。実験A〜Eと同じ
 *   fp どうしが x か y で分離していれば奥 (小さい側) を先に描く。重なる場合は底面の高さ z0 が低い方を先に。
 */
export function behind(A, B, eps = 1e-3) {
  const ax = A.x1 <= B.x0 + eps, ay = A.y1 <= B.y0 + eps;
  const bx = B.x1 <= A.x0 + eps, by = B.y1 <= A.y0 + eps;
  if ((ax && !by) || (ay && !bx)) return 1;
  if ((bx && !ay) || (by && !ax)) return -1;
  if (!ax && !ay && !bx && !by) { const za = A.z0 || 0, zb = B.z0 || 0; if (za !== zb) return za < zb ? 1 : -1; }
  return 0;
}

export function depthSort(items) {
  const n = items.length, adj = items.map(() => []), indeg = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const r = behind(items[i].fp, items[j].fp);
    if (r > 0) { adj[i].push(j); indeg[j]++; } else if (r < 0) { adj[j].push(i); indeg[i]++; }
  }
  const key = it => (it.fp.x0 + it.fp.x1 + it.fp.y0 + it.fp.y1) / 2 + (it.fp.z0 || 0) * 0.01;
  const done = new Array(n).fill(false), out = [];
  while (out.length < n) {
    let best = -1;
    for (let i = 0; i < n; i++) if (!done[i] && indeg[i] <= 0 && (best < 0 || key(items[i]) < key(items[best]))) best = i;
    if (best < 0) for (let i = 0; i < n; i++) if (!done[i] && (best < 0 || key(items[i]) < key(items[best]))) best = i;
    done[best] = true; out.push(items[best]);
    for (const j of adj[best]) indeg[j]--;
  }
  return out;
}

/** ユニットの足場 (連続位置の周り ±0.28)。移動中は2マスにまたがる (実験Cの unitFp) */
export const unitFootprint = u => ({ x0: u.x - 0.28, x1: u.x + 0.28, y0: u.y - 0.28, y1: u.y + 0.28 });
