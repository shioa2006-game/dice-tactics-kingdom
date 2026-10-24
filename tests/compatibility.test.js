// 保存した原本コアと KINGDOM を独立に読み込み、同じ入力後の全状態と events を照合する。
// 人工局面と固定乱数はこのテスト専用で、通常ゲームには読み込まれない。
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as OC from './reference/core/config.js';
import * as OR from './reference/core/rules.js';
import * as OD from './reference/core/dice.js';
import * as OL from './reference/core/levels.js';
import * as OG from './reference/core/rng.js';
import * as NC from '../src/core/config.js';
import * as NR from '../src/core/rules.js';
import * as ND from '../src/core/dice.js';
import * as NL from '../src/core/levels.js';
import * as NG from '../src/core/rng.js';

const oldCfg = OC.makeConfig();
const newCfg = NC.makeConfig();
const report = { date: '2026-10-24', sourceHashes: {}, matches: [], artificialCases: [] };
const hash = (data) => createHash('sha256').update(data).digest('hex');

function stateView(s) {
  const o = {};
  for (const [key, value] of Object.entries(s)) {
    if (key === 'cfg') continue;
    o[key] = ArrayBuffer.isView(value) ? Array.from(value) : value;
  }
  return o;
}
function same(a, b, label) { assert.deepEqual(stateView(b), stateView(a), label); }
function actPair(states, action, label) {
  assert.equal(OR.validateAction(states[0], action), null, `${label}: 原本で合法`);
  assert.equal(NR.validateAction(states[1], action), null, `${label}: KINGDOM で合法`);
  const a = OR.applyAction(states[0], action);
  const b = NR.applyAction(states[1], action);
  assert.deepEqual(b.events, a.events, `${label}: events`);
  same(a.state, b.state, label);
  return { states: [a.state, b.state], events: a.events };
}

// 障害物4マスとユニット定義は標準のまま、12体の位置だけを検証用に変更する。
function fixture(overrides = {}, { hp = {}, lost = [0, 0], side = 0, turn = 1 } = {}) {
  const pos = [90, 91, 92, 93, 94, 95, 0, 1, 2, 3, 4, 5];
  for (const [u, cell] of Object.entries(overrides)) pos[u] = cell;
  const live = pos.filter((p) => p >= 0);
  assert.equal(new Set(live).size, live.length, '人工局面の位置重複なし');
  assert.ok(live.every((p) => p < 100 && !oldCfg.obstacle[p]), '人工局面と岩の重複なし');
  return [[OR, oldCfg], [NR, newCfg]].map(([R, cfg]) => {
    const s = R.beginTurn(R.createGame(cfg, { firstSide: side }), [2, 2, 2]);
    s.pos = Int8Array.from(pos);
    for (let u = 0; u < pos.length; u++) if (pos[u] < 0) s.hp[u] = 0;
    for (const [u, value] of Object.entries(hp)) s.hp[u] = value;
    s.lost = lost.slice();
    s.turn = turn;
    return s;
  });
}

test('保存した原本とテストのハッシュ、コア全6ファイル、初期配置・設定が一致する', () => {
  const reference = JSON.parse(readFileSync(new URL('./reference/manifest.json', import.meta.url), 'utf8'));
  for (const file of reference.files) {
    assert.equal(hash(readFileSync(new URL('../' + file.target, import.meta.url))), file.SHA256, file.target);
  }
  const files = readdirSync(new URL('./reference/core/', import.meta.url)).filter((n) => n.endsWith('.js'));
  assert.equal(files.length, 6);
  for (const name of files) {
    const source = readFileSync(new URL(`./reference/core/${name}`, import.meta.url));
    const copy = readFileSync(new URL(`../src/core/${name}`, import.meta.url));
    assert.deepEqual(copy, source, name);
    report.sourceHashes[name] = hash(source);
  }
  assert.deepEqual(newCfg, oldCfg);
  assert.equal(newCfg.W, 10);
  assert.equal(newCfg.H, 10);
  assert.equal(newCfg.unitCount, 12);
  assert.deepEqual(Array.from(newCfg.obstacle).flatMap((v, i) => v ? [i] : []), [42, 45, 54, 57]);
  for (const firstSide of [0, 1]) same(OR.createGame(oldCfg, { firstSide }), NR.createGame(newCfg, { firstSide }), '初期状態');
});

test('全ダイス段階の確率分布・同一乱数列・最大APが一致する', () => {
  for (let lost = 0; lost <= 5; lost++) {
    assert.deepEqual(ND.apDistribution(lost), OD.apDistribution(lost));
    const a = OR.createGame(oldCfg); a.lost[0] = lost;
    const b = NR.createGame(newCfg); b.lost[0] = lost;
    const ar = OG.makeRng(20261024 + lost), br = NG.makeRng(20261024 + lost);
    assert.deepEqual(NR.diceMaxOf(b), OR.diceMaxOf(a));
    for (let i = 0; i < 100; i++) {
      const ad = OR.rollDiceFor(a, ar), bd = NR.rollDiceFor(b, br);
      assert.deepEqual(bd, ad);
      same(OR.beginTurn(a, ad), NR.beginTurn(b, bd), `喪失${lost}の出目${i}`);
    }
  }
});

test('ダイス強化は撃破時に進み、確定済みAPは変えず次のダイスに反映する', () => {
  for (let priorLoss = 0; priorLoss <= 3; priorLoss++) {
    const positions = { 1: 66, 7: 67 };
    for (let k = 0; k < priorLoss; k++) positions[8 + k] = -1;
    const pair = fixture(positions, { hp: { 7: 1 }, lost: [0, priorLoss] });
    const result = actPair(pair, { type: 'attack', unit: 1, target: 7 }, `強化${priorLoss}`);
    const [a, b] = result.states;
    assert.equal(a.lost[1], priorLoss + 1);
    assert.equal(a.ap, 6);
    assert.equal(a.apGained, 7);
    assert.equal(a.hp[7], 0);
    assert.equal(a.pos[7], -1);
    assert.equal(OR.diceStageOf(a, 1), Math.min(3, priorLoss + 1));
    const an = OR.endTurn(a), bn = NR.endTurn(b);
    same(an, bn, '強化後の手番交代');
    const dice = OR.diceMaxOf(an);
    same(OR.beginTurn(an, dice), NR.beginTurn(bn, dice), '次ターンの最大AP');
  }
  report.artificialCases.push('ダイス強化0→1→2→3と上限、次回ダイスへの反映');
});

test('弓の直線射程2〜4、岩・ユニット遮断、魔法の岩越しが一致する', () => {
  const cases = [
    ['弓の射程4', { 3: 60, 7: 64 }, 3, true, false],
    ['弓の隣接不可', { 3: 60, 7: 61 }, 3, false, false],
    ['弓の射程5不可', { 3: 60, 7: 65 }, 3, false, false],
    ['弓の斜め不可', { 3: 60, 7: 73 }, 3, false, false],
    ['弓の岩遮断', { 3: 40, 7: 44 }, 3, false, false],
    ['弓の味方遮断', { 3: 60, 1: 62, 7: 64 }, 3, false, false],
    ['魔法の岩越し', { 5: 41, 7: 43 }, 5, true, true],
    ['魔法の味方遮断', { 5: 60, 1: 61, 7: 62 }, 5, false, false],
    ['魔法の敵遮断', { 5: 60, 8: 61, 7: 62 }, 5, false, false],
  ];
  for (const [name, positions, actor, expected, over] of cases) {
    const [a, b] = fixture(positions);
    const ao = OR.attackOptions(a, actor), bo = NR.attackOptions(b, actor);
    assert.deepEqual(bo, ao, name);
    const target = ao.find((o) => o.target === 7);
    assert.equal(!!target, expected, name);
    if (target) {
      assert.equal(target.overObstacle, over, name);
      const r = actPair([a, b], { type: 'attack', unit: actor, target: 7 }, name);
      assert.equal(r.states[0].hp[7], 2, 'ダメージ1');
      assert.equal(r.states[0].ap, 5, '攻撃AP2');
    }
    report.artificialCases.push(name);
  }
});

test('弓の押し出し先と、端・岩・ユニットによる不可理由が一致する', () => {
  const cases = [
    ['押出成功', { 3: 60, 7: 63 }, null, 64],
    ['端で不可', { 3: 66, 7: 69 }, 'edge', 69],
    ['岩で不可', { 3: 50, 7: 53 }, 'obstacle', 53],
    ['駒で不可', { 3: 60, 7: 63, 8: 64 }, 'unit', 63],
  ];
  for (const [name, positions, reason, destination] of cases) {
    const pair = fixture(positions);
    const options = OR.attackOptions(pair[0], 3);
    assert.deepEqual(NR.attackOptions(pair[1], 3), options);
    assert.equal(options.find((o) => o.target === 7).hit.blocked, reason);
    const result = actPair(pair, { type: 'attack', unit: 3, target: 7 }, name);
    assert.equal(result.states[0].pos[7], destination);
    assert.ok(result.events.some((e) => reason ? e.type === 'knockbackBlocked' && e.reason === reason : e.type === 'knockback' && e.to === destination));
    report.artificialCases.push(name);
  }
});

test('移動経路・AP・フラグ、移動前stateへ戻した全状態が一致する', () => {
  const pair = fixture();
  const initial = pair.map(stateView);
  const histories = [[], []];
  let current = pair;
  for (const action of [{ type: 'move', unit: 0, to: 80 }, { type: 'move', unit: 1, to: 81 }]) {
    assert.deepEqual(NR.moveOptions(current[1], action.unit), OR.moveOptions(current[0], action.unit));
    histories.forEach((h, i) => h.push(current[i]));
    current = actPair(current, action, '移動').states;
    assert.equal(current[0].flags[action.unit], OC.MOVED);
  }
  assert.equal(current[0].ap, 5);
  while (histories[0].length) {
    current = histories.map((h) => h.pop());
    same(...current, '移動前stateの復元');
  }
  assert.deepEqual(current.map(stateView), initial);
  const attackPair = fixture({ 1: 66, 7: 67 });
  const result = actPair(attackPair, { type: 'attack', unit: 1, target: 7 }, '攻撃後');
  assert.equal(result.states[0].flags[1], OC.ATTACKED);
  assert.equal(OR.moveOptions(result.states[0], 1).length, 0);
  assert.equal(NR.moveOptions(result.states[1], 1).length, 0);
  report.artificialCases.push('移動前stateの復元（UIの戻す操作自体はブラウザで別確認）');
});

test('王撃破による両陣営の勝敗と40ラウンド引分が一致する', () => {
  for (const side of [0, 1]) {
    const actor = side ? 7 : 1;
    const target = side ? 0 : 6;
    const pair = fixture({ [actor]: 66, [target]: 67 }, { side, hp: { [target]: 1 } });
    const result = actPair(pair, { type: 'attack', unit: actor, target }, `陣営${side}勝利`);
    assert.equal(result.states[0].winner, side);
    assert.equal(result.states[0].phase, 'over');
    assert.deepEqual(result.states[0].lost, [0, 0], '王はダイス強化の喪失数に含まない');
  }
  const [a, b] = fixture({}, { side: 1, turn: 80 });
  const an = OR.endTurn(a), bn = NR.endTurn(b);
  same(an, bn, '引分');
  assert.equal(an.winner, 'draw');
  assert.equal(an.phase, 'over');
  report.artificialCases.push('自軍勝利、CPU勝利、40ラウンド引分');
});

test('EASY の両性格と性格なしで、同じ局面・乱数の行動列が一致する', () => {
  const golden = JSON.parse(readFileSync(new URL('./fixtures/standard-golden.json', import.meta.url), 'utf8'));
  for (const persona of ['rangedNovice', 'rushKnock', null]) {
    for (const sample of [golden.cases[0], golden.cases[9], golden.cases[19], golden.cases[29]]) {
      const states = [[OR, oldCfg], [NR, newCfg]].map(([R, cfg]) => {
        const s = R.createGame(cfg, { firstSide: sample.state.firstSide });
        Object.assign(s, sample.state, { cfg, phase: 'act', ap: sample.ap, apGained: sample.ap });
        s.pos = Int8Array.from(sample.state.pos);
        s.hp = Int8Array.from(sample.state.hp);
        s.flags = Uint8Array.from(sample.state.flags);
        return s;
      });
      const a = OL.planLevel(states[0], { level: 'easy', persona, rng: OG.makeRng(sample.rngSeed) });
      const b = NL.planLevel(states[1], { level: 'easy', persona, rng: NG.makeRng(sample.rngSeed) });
      assert.ok(!a.info?.timeCut && !b.info?.timeCut);
      assert.deepEqual(b.actions, a.actions, `EASY ${persona} AP${sample.ap}`);
      let pair = states;
      for (const action of a.actions) pair = actPair(pair, action, `EASY ${persona}`).states;
    }
  }
});

for (const level of ['rookie', 'easy', 'normal', 'hard']) {
  for (const firstSide of [0, 1]) {
    test(`${level.toUpperCase()}・先手${firstSide}: 同じ設定/乱数/操作の対局を終局まで照合`, () => {
      const seed = 20261024 + firstSide;
      const ar = OG.makeRng(seed), br = NG.makeRng(seed);
      const personaA = OL.pickPersona(level, ar), personaB = NL.pickPersona(level, br);
      assert.equal(personaB, personaA);
      let a = OR.createGame(oldCfg, { firstSide }), b = NR.createGame(newCfg, { firstSide });
      const previous = [null, null];
      let turns = 0, actions = 0;
      while (a.phase !== 'over') {
        assert.ok(turns < 80, '40ラウンド以内に終局');
        const ad = OR.rollDiceFor(a, ar), bd = NR.rollDiceFor(b, br);
        assert.deepEqual(bd, ad, '同じ出目');
        a = OR.beginTurn(a, ad); b = NR.beginTurn(b, bd);
        same(a, b, 'AP決定');
        const brainSeed = seed + turns * 101;
        const opts = { level, persona: personaA, prevStart: previous[a.side] };
        const ap = OL.planLevel(a, { ...opts, rng: OG.makeRng(brainSeed) });
        const bp = NL.planLevel(b, { ...opts, rng: NG.makeRng(brainSeed) });
        assert.ok(!ap.info?.timeCut && !bp.info?.timeCut, '時間制限で打ち切られず比較可能');
        assert.deepEqual(bp.actions, ap.actions, `${level} ターン${turns + 1}`);
        previous[a.side] = Array.from(a.pos);
        for (const action of ap.actions) {
          [a, b] = actPair([a, b], action, `${level} ターン${turns + 1} 行動${actions + 1}`).states;
          actions++;
        }
        if (a.phase !== 'over') { a = OR.endTurn(a); b = NR.endTurn(b); }
        same(a, b, 'ターン終了');
        turns++;
      }
      assert.equal(b.phase, 'over');
      same(a, b, '最終状態');
      report.matches.push({ level, firstSide, seed, persona: personaA, turns, actions, winner: a.winner });
    });
  }
}

after(() => {
  const out = new URL('./results/', import.meta.url);
  mkdirSync(out, { recursive: true });
  writeFileSync(new URL('compatibility.json', out), JSON.stringify(report, null, 2) + '\n');
});
