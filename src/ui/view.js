// KINGDOM: 状態・パネルは元viewを継承し、盤面のみStudioアダプタへ委譲。
import { HUMAN, MONSTER, LEADER, MAGE, ATTACKED, MOVED, DIRS, UNIT_TYPES } from '../core/config.js';
import { unitName } from './kingdom-assets.js';
import { BASE_AP, DICE_STAGES, maxAP } from '../core/dice.js';
import * as R from '../core/rules.js';
import * as A from './art.js';
import * as Board from './kingdom-board.js';
const $ = sel => document.querySelector(sel);
const WHO = ['あなた', 'CPU'];
const RANGE_TEXT = ['隣接', '隣接', '2〜4', '1〜2（岩越し可）'];
let cfg;
export async function init(config,onCell) {
  cfg=config; A.installDefs(); renderRules();
  $('#result-orn').innerHTML=A.rosetteSVG()+A.rosetteSVG()+A.rosetteSVG();
  await Board.init(config,onCell);
}
export function render(game) {
  Board.render(game); renderStatus(game); renderTray(game); renderInfo(game); renderLog(game);
  $('#btn-cancel').hidden=!game.preview&&!game.moveMode;
  $('#btn-move').hidden=game.busy||game.moveMode||!!game.preview||game.mode!=='act'||game.sel<0||cfg.unitSide[game.sel]!==HUMAN||!R.moveOptions(game.state,game.sel).length;
  $('#btn-cancel').disabled=game.busy;
  $('#btn-main').hidden=!!game.preview||game.moveMode;
  $('#btn-undo').hidden=game.moveMode||game.mode!=='act';
  $('#tray').classList.toggle('choosing-move',game.moveMode);
}
function options(game) {
  const moves = new Map(), targets = new Map();
  if (game.mode === 'act' && !game.busy && game.sel >= 0 && cfg.unitSide[game.sel] === HUMAN) {
    for (const m of R.moveOptions(game.state, game.sel)) moves.set(m.cell, m);
    for (const a of R.attackOptions(game.state, game.sel)) targets.set(a.target, a);
  }
  return {moves, targets};
}
function renderStatus(game) {
  const s = game.state;
  for (const side of [MONSTER, HUMAN]) {
    const el = $(side === HUMAN ? '#stat-h' : '#stat-m');
    const st = R.diceStageOf(s, side);
    const count=cfg.sideUnits[side].filter(u=>s.pos[u]>=0).length;
    const emblem=side===HUMAN?A.emblemIcon(LEADER):'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l2 8 3-3h8l3 3 2-8-6 3H9zM7 10v7l5 5 5-5v-7z" fill="currentColor"/><path d="M9 13l2 1m2 0 2-1" fill="none" stroke="var(--rust)" stroke-width="2"/></svg>';
    const html = `<div class="ss-banner"><span class="ss-emblem">${emblem}</span><span class="ss-name">${side===HUMAN?'王国軍':'魔王軍'}</span><b class="ss-count">${count}</b></div><div class="ss-meta"><span class="stage-badge${st>0?' up':''}" data-side="${side}" title="ダイス強化段階（失った味方 ${s.lost[side]} 体）">強化 ${st}</span><span class="ss-max">最大 <b>${maxAP(s.lost[side])}</b> AP</span></div>`;
    if (el.dataset.html !== html) {
      el.innerHTML = html;
      el.dataset.html = html;
    }
    el.classList.toggle('active', s.phase !== 'over' && s.side === side);
    el.title=side===MONSTER?`CPU 魔王軍${game.levelInfo?' / '+game.levelInfo.name:''}`:'あなたの王国軍';
    el.setAttribute('aria-label', `${side === HUMAN ? 'あなた（王国軍）' : 'CPU（魔王軍）'+(game.levelInfo?' 難易度 '+game.levelInfo.name:'')}: ダイス強化 ${st}、最大 ${maxAP(s.lost[side])}AP、残り ${count} 体`);
  }
  $('#round').innerHTML = `ROUND <b>${R.roundOf(s)}</b>/${cfg.rules.maxRounds}`;
  const turn = $('#turn');
  if (s.phase === 'over') {
    turn.textContent = s.winner === 'draw' ? '引き分け' : s.winner === HUMAN ? 'あなたの勝ち' : 'CPU の勝ち';
    turn.className = 'turn';
  } else {
    turn.textContent = s.side === HUMAN ? 'あなたの番' : 'CPU の番';
    turn.className = 'turn ' + (s.side === HUMAN ? 'h' : 'm');
  }
}

/** ステータス帯の強化段階を光らせる */
export function pulseStage(side) {
  const b = document.querySelector(`.stage-badge[data-side="${side}"]`);
  if (!b) return;
  b.classList.remove('pulse');
  void b.offsetWidth;
  b.classList.add('pulse');
}

// ---------------------------------------------------------------------------
// ダイスと AP・ターン操作
// ---------------------------------------------------------------------------

function renderTray(game) {
  const s = game.state;
  const tray = $('#tray');
  const side = s.phase === 'over' ? HUMAN : s.side;
  const rolled = s.phase === 'act' && s.dice;
  tray.classList.toggle('m', side === MONSTER);
  $('#dice-owner').textContent = side === HUMAN ? 'あなたのダイス' : 'CPU のダイス';

  if (!game.diceAnimating) {
    const maxes = rolled ? s.diceMax : R.diceMaxOf(s, side);
    // 強化されたばかりのダイス（通知が出ている陣営の、まだ振っていないダイス）
    const prevMax = game.notice && game.notice.side === side && !rolled ? DICE_STAGES[Math.max(0, R.diceStageOf(s, side) - 1)] : null;
    $('#dice').innerHTML = maxes.map((mx, i) => dieHTML(rolled ? s.dice[i] : null, mx, prevMax && mx > prevMax[i])).join('');
  }

  const top = maxAP(s.lost[side]);
  const apNum = $('#ap-num');
  const chips = $('#ap-chips');
  if (rolled) {
    apNum.textContent = s.ap;
    apNum.className = 'ap-num' + (s.ap === 0 ? ' zero' : s.apGained >= 7 ? ' big' : '');
    $('#ap-of').textContent = `/ ${s.apGained}`;
    $('#ap-formula').innerHTML = `基本${BASE_AP} + ${s.dice.join(' + ')} = <b class="${s.apGained >= 7 ? 'gold' : ''}">${s.apGained}AP</b>`;
  } else {
    apNum.textContent = '–';
    apNum.className = 'ap-num zero';
    $('#ap-of').textContent = `1〜${top}`;
    $('#ap-formula').innerHTML = s.phase === 'over' ? '' : `基本${BASE_AP} + ダイス 3 個（▲${R.diceStageOf(s, side)}：${R.diceMaxOf(s, side).join('・')}）`;
  }
  if (!game.diceAnimating) {
    let ch = '';
    for (let i = 0; i < top; i++) {
      // 振った直後は、獲得した AP の目盛りを順に点灯させる
      const fresh = rolled && game.apFresh && i < s.ap;
      const cls = !rolled ? '' : i < s.ap ? 'on' + (fresh ? ' light' : '') : i < s.apGained ? 'spent' : '';
      ch += `<i class="${cls}"${fresh ? ` style="animation-delay:${i * 45}ms"` : ''}></i>`;
    }
    syncChips(chips, ch);
  }

  // 主ボタンは局面で切り替える（振る前 = ダイスを振る、振った後 = ターン終了）
  const main = $('#btn-main');
  main.classList.remove('armed', 'urge');
  main.disabled = game.busy;
  if (game.mode === 'roll') {
    main.innerHTML = 'ダイスを振る<span class="kbd">Space</span>';
  } else if (game.mode === 'act') {
    if (game.endArmed) {
      main.classList.add('armed');
      main.innerHTML = `残り ${s.ap}AP — もう一度押して終了`;
    } else {
      main.innerHTML = 'ターン終了<span class="kbd">E</span>';
      if (s.ap === 0 || !game.canAct) main.classList.add('urge');
    }
  } else if (game.mode === 'cpu') {
    main.disabled = true;
    main.textContent = game.cpuThinking ? 'CPU が考えています…' : 'CPU の手番';
  } else if (game.mode === 'over') {
    main.innerHTML = 'もう一度遊ぶ';
  } else {
    main.disabled = true;
    main.textContent = '';
  }
  const undo = $('#btn-undo');
  undo.hidden = game.mode !== 'act';
  undo.disabled = game.busy || game.undo.length === 0;
  undo.innerHTML = '戻す<span class="kbd">Z</span>';
}

function syncChips(el, html) {
  if (el.dataset.html === html) return;
  el.innerHTML = html;
  el.dataset.html = html;
}

function dieHTML(v, mx, isNew) {
  const cls = `die${mx >= 3 ? ' up' : ''}${v !== null && v === mx ? ' max' : ''}${isNew ? ' new' : ''}`;
  const label = v === null ? `ダイス 0〜${mx}` : `出目 ${v}（0〜${mx}）`;
  return `<div class="${cls}" role="img" aria-label="${label}"><div class="die-face">${A.dieFace(v)}</div><div class="die-range">0–${mx}</div></div>`;
}

/** ダイスを転がす演出用: 表示だけを差し替える */
export function showDice(values, maxes, cls = '') {
  $('#dice').innerHTML = maxes.map((mx, i) => dieHTML(values ? values[i] : null, mx, false).replace('class="die', `class="die ${cls}`)).join('');
}

// ---------------------------------------------------------------------------
// 情報行（選択中の駒・行動案・ヒント・エラー）
// ---------------------------------------------------------------------------

function renderInfo(game) {
  const info = $('#info');
  const { main, sub, cls, confirm } = infoContent(game);
  info.className = 'info' + (cls ? ' ' + cls : '');
  $('#info-main').innerHTML = main;
  $('#info-sub').innerHTML = sub || '';
  $('#btn-confirm').hidden = !confirm;
  $('#btn-confirm').textContent=game.preview?.kind==='move'?'ここへ移動':'確定';
  $('#btn-cancel').textContent=game.moveMode?'移動を取消':'取消';
  const portrait=$('#selection-portrait');
  if(portrait){
    const show=game.sel>=0&&game.state.pos[game.sel]>=0&&!game.preview&&!game.moveMode&&!game.msg&&!game.busy;
    portrait.hidden=!show;
    if(show){const src=Board.portrait(game.sel);if(portrait.getAttribute('src')!==src)portrait.src=src;}
  }
}

function selectedCard(s,u){
  const T=cfg.types[cfg.unitType[u]],hp=s.hp[u];
  const pips=Array.from({length:T.hp},(_,i)=>`<i${i>=hp?' class="lost"':''}></i>`).join('');
  return `<div class="selected-heading"><strong class="selected-name">${unitName(cfg,u)}</strong><span class="selected-cell">${R.cellName(s.pos[u],cfg)}</span></div><div class="selected-vitals ${cfg.unitSide[u]===HUMAN?'h':'m'}"><span>HP <b>${hp}</b> / ${T.hp}</span><span class="hp-pips" aria-hidden="true">${pips}</span></div>`;
}
function selectedDetails(s,u){
  const own=cfg.unitSide[u]===HUMAN,T=cfg.types[cfg.unitType[u]];
  const state=own&&s.side===HUMAN&&s.phase==='act'?`移動 ${s.flags[u]&MOVED?'済':'未'} · 攻撃 ${s.flags[u]&ATTACKED?'済':'未'}`:own?'王国軍':'魔王軍';
  return `<span class="selection-meta">${state} · 射程 ${RANGE_TEXT[cfg.unitType[u]]} · ${T.attackCost}AP</span>`;
}

function unitLine(s, u) {
  const T = cfg.types[cfg.unitType[u]];
  const side = cfg.unitSide[u];
  let st = '';
  if (side === s.side && s.phase === 'act') st = s.flags[u] & ATTACKED ? '・攻撃済み' : s.flags[u] & MOVED ? '・移動済み' : '・未行動';
  return `<span class="tag ${side === HUMAN ? 'h' : 'm'}">${side === HUMAN ? '味方' : '敵'}</span>${unitName(cfg, u)} · ${R.cellName(s.pos[u],cfg)} · HP${s.hp[u]}/${T.hp}・射程 ${RANGE_TEXT[cfg.unitType[u]]}・攻撃${T.attackCost}AP${st}`;
}

function infoContent(game) {
  const s = game.state;
  if (game.msg) {
    const u = game.msg.inspect >= 0 ? game.msg.inspect : game.sel;
    return { main: game.msg.text, sub: u >= 0 && s.pos[u] >= 0 ? unitLine(s, u) : '', cls: game.msg.cls };
  }
  if (game.preview) return { main: game.preview.text, sub: game.preview.sub, cls: 'preview', confirm: !game.busy };
  if (game.moveMode) return {main:`${unitName(cfg,game.sel)}の移動先を選択`,sub:'青緑の床をタップ → プレビュー → 確定。ドラッグで見渡せます。',cls:'moving'};
  if (game.busy && game.mode === 'act') return { main: game.actNote || '…', sub: '' };
  if (game.busy && game.mode === 'roll') return { main: 'ダイスを振っています…', sub: '' };
  if (game.mode === 'cpu' && !(game.sel >= 0 && s.pos[game.sel] >= 0)) return { main: game.cpuNote || 'CPU の手番です。', sub: game.cpuSub || '' };
  if (game.mode === 'over') return { main: s.winner === 'draw' ? '引き分けです。' : s.winner === HUMAN ? 'あなたの勝ちです！' : 'CPU の勝ちです。', sub: '「もう一度遊ぶ」で新しいゲームを始めます。盤面はそのまま確認できます。' };
  if (game.sel >= 0 && s.pos[game.sel] >= 0) {
    const own = cfg.unitSide[game.sel] === HUMAN;
    let sub = '';
    if (game.mode === 'act' && own) {
      const { moves, targets } = options(game);
      if (moves.size && targets.size) sub = '「移動」で床を選択。赤い枠の敵はタップして攻撃をプレビュー。';
      else if (moves.size) sub = '「移動」を押してから床を選択（数字は消費AP）。';
      else if (targets.size) sub = '赤い枠の敵をタップで攻撃をプレビュー。';
      else sub = moveBlockReason(s, game.sel);
    } else if (!own) sub = threatText(game);
    const detail=selectedDetails(s,game.sel);
    const blocked=own&&game.mode==='act'&&!options(game).moves.size&&!options(game).targets.size;
    return { main: selectedCard(s, game.sel), sub:detail+(!own||blocked?`<br>${sub}`:'') };
  }
  return { main: game.hint || '', sub: game.hintSub || '' };
}

/** 調べている敵の脅威の説明（可能性であって、確定した攻撃ではないことを明記する） */
function threatText(game) {
  const t = game.inspectThreat;
  if (!t) return '敵の駒です。';
  const list = [...t.costs].sort((a, b) => a[1] - b[1]).map(([u, ap]) => `${unitName(cfg, u)} ${ap}AP`);
  const head = `次の CPU のターンに最大 ${t.max}AP 出た場合の可能性`;
  if (!list.length) return `${head}：狙える味方はいません（薄い赤茶のマス = 動けるマス）`;
  return `${head}：<b>${list.join('・')}</b>（数字 = 最小 AP。薄い赤茶のマス = 動けるマス）`;
}

/** この駒が今行動できない理由（コアの判定文をそのまま使う） */
function moveBlockReason(s, u) {
  if (s.flags[u] & ATTACKED) return 'このターンは攻撃済みです。';
  const T = cfg.types[cfg.unitType[u]];
  if (s.flags[u] & MOVED) return s.ap < T.attackCost ? `移動済み。攻撃には ${T.attackCost}AP 必要です。` : '移動済み。射程内に敵がいません。';
  if (s.ap === 0) return 'AP がありません。';
  return '射程内に敵がおらず、移動できるマスもありません。';
}

// ---------------------------------------------------------------------------
// 行動履歴・ルール
// ---------------------------------------------------------------------------

function renderLog(game) {
  const el = $('#log');
  if ($('#sheet-log').hidden && el.dataset.n === String(game.log.length)) return;
  el.innerHTML = game.log
    .slice(-200)
    .map((l) => `<li class="${l.cls}">${escapeHTML(l.text)}</li>`)
    .join('');
  el.dataset.n = String(game.log.length);
  el.scrollTop = el.scrollHeight;
}

function renderRules() {
  const rows = UNIT_TYPES.map((T, t) => {
    const n = cfg.roster.filter((x) => x === t).length;
    const note = ['倒されると敗北', '', '命中した敵を 1 マス押し出す。隣接は撃てない。岩で射線が遮られる', '岩を越えて攻撃できる'][t];
    return `<tr><td>${A.emblemIcon(t)} ${T.name}${n > 1 ? ` ×${n}` : ''}</td><td>${T.hp}</td><td>${RANGE_TEXT[t]}</td><td>${T.attackCost}AP</td><td>${note}</td></tr>`;
  }).join('');
  const stages = DICE_STAGES.map((m, i) => `<tr><td>▲${i}${i === 3 ? ' 以上' : ''}</td><td>${i}${i === 3 ? ' 体〜' : ' 体'}</td><td>${m.join('・')}</td><td>1〜${maxAP(i)}AP</td></tr>`).join('');
  $('#rules-body').innerHTML = `
    <h3>勝ち方</h3>
    <p>相手のリーダー（王・魔王）を倒せば勝ち。40 ラウンドが終わると引き分け。</p>
    <h3>ターンの流れ</h3>
    <ul>
      <li>ダイスを振ると、このターンの AP が決まる（基本 1 ＋ ダイス 3 個の合計）。</li>
      <li>AP の範囲で、好きな駒を好きな順番で動かす。各駒は 1 ターンに移動 1 回・攻撃 1 回。移動 → 攻撃はできるが、攻撃 → 移動はできない。</li>
      <li>使い切れなかった AP は持ち越さない。「ターン終了」で相手の番。</li>
    </ul>
    <h3>被害連動ダイス</h3>
    <p>リーダー以外の味方を失うたびに、<b>次の自軍ターンから</b>ダイスが 1 個ずつ 0〜3 に強化される。振ったダイス・確定した AP は途中で変わらない。</p>
    <table><thead><tr><th>段階</th><th>失った味方</th><th>ダイス</th><th>AP</th></tr></thead><tbody>${stages}</tbody></table>
    <h3>駒</h3>
    <table><thead><tr><th>駒</th><th>HP</th><th>射程</th><th>攻撃</th><th>特徴</th></tr></thead><tbody>${rows}</tbody></table>
    <p>移動は上下左右に 1 マス 1AP。岩・駒のマスは通れない。攻撃は上下左右の直線のみで 1 ダメージ。射線の途中に駒がいると、その先は狙えない。押し出し先が盤の外・岩・駒なら押し出されない（ダメージは入る）。</p>
    <h3>盤面の見かた</h3>
    <ul>
      <li><span class="legend" style="background:#dce9dd;box-shadow:inset 0 0 0 2px #437f72"></span>青緑のマス = 移動できる（数字は消費 AP）</li>
      <li><span class="legend" style="background:#f2c8bb;box-shadow:inset 0 0 0 2px #c8321f"></span>赤い枠 = 攻撃できる敵</li>
      <li><span class="legend" style="background:#e7dcc2;box-shadow:inset 0 0 0 2px #f1c232"></span>金の枠 = 選択中の駒</li>
      <li><span class="legend" style="background:#e7dcc2;box-shadow:inset 0 0 0 2px #46464f"></span>灰色の点線枠（移動のプレビュー中）= 射線は通るが AP が足りない敵</li>
      <li><span class="legend" style="background:#f1c7b0"></span>薄い赤茶のマス（敵を調べているとき）= その敵が攻撃の前に動けるマス。味方の駒の上の数字 = その味方を狙うのに必要な最小 AP（最大 AP が出た場合の可能性）</li>
      <li><span class="legend" style="background:transparent;border-top:2px dashed #ff7a2e;height:0;margin-bottom:4px"></span>橙の点線 = CPU が直前のターンに動かした経路</li>
      <li><span class="legend" style="background:#3a322b"></span>低く崩れた石積み = 岩（通れない。弓の射線を遮る）</li>
      <li>足元の目盛り = HP（空欄は失ったHP）。小さな印: <b>!</b> 今攻撃できる / <b>•</b> 移動済み / <b>✓</b> 攻撃済み。名前・番号は選択情報と部隊一覧で確認。</li>
      <li>青緑の円 = あなた、赤茶の菱形 = CPU。金の点線は上下左右の射程目安（遮蔽判定前）。赤い枠だけが現在攻撃可能。盤面をドラッグして見渡せる。重なった駒はタップ後の候補から選ぶ。移動は駒を選択→「移動」→床を選択→「ここへ移動」。携帯・PCで同じ操作。移動中は他の駒を薄く表示し、実際に駒がいるマスへは進めない。</li>
    </ul>`;
}

// ---------------------------------------------------------------------------
// 結果・シート・通知
// ---------------------------------------------------------------------------

export function showResult(game) {
  const s = game.state;
  const title = $('#result-title');
  if (s.winner === HUMAN) {
    title.textContent = '勝利';
    title.className = 'result-title win';
    $('#result-sub').textContent = `ROUND ${R.roundOf(s)} でモンスター族のリーダーを撃破しました`;
  } else if (s.winner === MONSTER) {
    title.textContent = '敗北';
    title.className = 'result-title lose';
    $('#result-sub').textContent = `ROUND ${R.roundOf(s)} で人間族のリーダーが撃破されました`;
  } else {
    title.textContent = '引き分け';
    title.className = 'result-title';
    $('#result-sub').textContent = `${cfg.rules.maxRounds} ラウンドが終了しました`;
  }
  if (game.levelInfo) {
    const r = game.record;
    const rec = r ? `（この難易度の戦績 ${r.w}勝 ${r.l}敗${r.d ? ` ${r.d}分` : ''}）` : '';
    $('#result-sub').innerHTML += `<br><span class="result-level">CPU の難易度: ${'★'.repeat(game.levelInfo.stars)} ${game.levelInfo.name}</span> ${rec}`;
    if (game.personaHint) $('#result-sub').innerHTML += `<br><span class="result-hint">ヒント: ${escapeHTML(game.personaHint)}</span>`;
    if (game.suggest) $('#result-sub').innerHTML += `<br>${escapeHTML(game.suggest)}`;
  }
  $('#result-stats').innerHTML = statsHTML(game.stats);
  $('#result').hidden = false;
  $('#btn-again').focus();
}

// ---------------------------------------------------------------------------
// タイトル画面
// ---------------------------------------------------------------------------

/**
 * タイトル画面を描く。
 * @param {{levels: string[], info: object, maxStars: number, selected: string, first: string, records: object, tag: {level, text}|null}} o
 */
export function renderTitle(o) {
  if (!$('#title-orn').innerHTML) $('#title-orn').innerHTML = A.rosetteSVG() + A.rosetteSVG() + A.rosetteSVG();
  $('#title-levels').innerHTML = o.levels
    .map((k) => {
      const i = o.info[k];
      const r = o.records[k];
      const rec = r && r.w + r.l + r.d > 0 ? `<span class="level-record">${r.w}勝 ${r.l}敗${r.d ? ` ${r.d}分` : ''}</span>` : '';
      const tag = o.tag && o.tag.level === k ? `<span class="level-tag">${escapeHTML(o.tag.text)}</span>` : '';
      return `<button class="level-btn" role="radio" data-level="${k}" aria-checked="${k === o.selected}"><span class="level-stars" aria-hidden="true">${'★'.repeat(i.stars)}${'☆'.repeat(Math.max(0, o.maxStars - i.stars))}</span><span class="level-name">${i.name}</span><span class="level-desc">${escapeHTML(i.desc)}</span>${tag}${rec}</button>`;
    })
    .join('');
  document.querySelectorAll('#title-first button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === o.first)));
}

export function showTitle() {
  $('#title').hidden = false;
  const btn = $('#btn-start');
  if (btn) btn.focus();
}
export function hideTitle() {
  $('#title').hidden = true;
}
export const titleOpen = () => !$('#title').hidden;

/** 終了時の統計（あなた / CPU） */
function statsHTML(st) {
  if (!st) return '';
  const avg = (x) => (x.turns ? (x.apSum / x.turns).toFixed(1) : '–');
  const rows = [
    ['ターン数', (x) => x.turns],
    ['平均 AP', avg],
    ['最大 AP', (x) => x.apMax],
    ['使った AP', (x) => x.apUsed],
    ['攻撃（命中）', (x) => x.attacks],
    ['撃破', (x) => x.kills],
    ['押し出し', (x) => x.pushes],
  ];
  return `<thead><tr><th></th><th class="h">あなた</th><th class="m">CPU</th></tr></thead><tbody>${rows.map(([k, f]) => `<tr><td>${k}</td><td>${f(st[HUMAN])}</td><td>${f(st[MONSTER])}</td></tr>`).join('')}</tbody>`;
}

export function hideResult() {
  $('#result').hidden = true;
}

let toastTimer = 0;
/** 盤面の下部に短い通知を出す（操作は妨げない） */
export function toast(html, cls = '', ms = 2600) {
  const t = $('#toast');
  clearTimeout(toastTimer);
  t.className = 'toast ' + cls;
  t.innerHTML = html;
  t.hidden = false;
  toastTimer = setTimeout(() => {
    t.classList.add('out');
    toastTimer = setTimeout(() => (t.hidden = true), 320);
  }, ms);
}
export function hideToast() {
  clearTimeout(toastTimer);
  $('#toast').hidden = true;
}

export function openSheet(name) {
  Board.closePanels();
  closeSheets();
  $('#sheet-back').hidden = false;
  const el = $(`#sheet-${name}`);
  el.hidden = false;
  if (name === 'log') {
    const log = $('#log');
    log.scrollTop = log.scrollHeight;
  }
  const btn = el.querySelector('.sheet-close');
  if (btn) btn.focus();
}
export function closeSheets() {
  document.querySelectorAll('.sheet').forEach((s) => (s.hidden = true));
  $('#sheet-back').hidden = true;
}
export const sheetOpen = () => !$('#sheet-back').hidden;

function escapeHTML(t) {
  return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
