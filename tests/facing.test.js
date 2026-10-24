import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeConfig} from '../src/core/config.js';
import * as R from '../src/core/rules.js';
import {createFacing, directionToward} from '../src/ui/kingdom-facing.js';

const cfg=makeConfig();
function fixture(){
  const s=R.beginTurn(R.createGame(cfg),[2,2,1]);
  s.pos.set([64,53,55,63,65,66,34,61,44,33,35,46]);
  const f=createFacing(cfg);f.reset(s);
  return {s,f};
}
const directions=f=>Array.from({length:12},(_,u)=>f.get(u));
function act(f,s,action){const r=R.applyAction(s,action);f.complete(s,r.state,action,r.events);return r.state;}
const next=s=>R.beginTurn(R.endTurn(s),[2,2,1]);

test('王の位置を既存の4方向へ丸め、中間は現在方向、王不在は最後の向きを保つ',()=>{
  for(const [to,d] of [[25,'NE'],[58,'SE'],[85,'SW'],[52,'NW'],[28,'NE'],[82,'SW']]) assert.equal(directionToward(55,to,10,d),d);
  assert.equal(directionToward(55,28,10,'SW'),'NE');
  assert.equal(directionToward(55,-1,10,'SE'),'SE');
});

test('自軍・CPUとも行動した駒だけ更新し、敵王の移動・手番交代では他の待機方向を変えない',()=>{
  let {s,f}=fixture();const before=directions(f);
  s=act(f,s,{type:'move',unit:1,to:51});assert.equal(f.get(1),'SE');
  for(let u=0;u<12;u++)if(u!==1)assert.equal(f.get(u),before[u]);
  const waiting=directions(f);s=next(s);
  s=act(f,s,{type:'move',unit:6,to:30});assert.equal(f.get(6),'SE');
  assert.equal(f.get(1),'SE'); // 現在の敵王へ向くならNEだが、まだ自分の行動前。
  for(let u=0;u<12;u++)if(u!==6)assert.equal(f.get(u),waiting[u]);
  s=next(s);s=act(f,s,{type:'attack',unit:1,target:7});
  assert.equal(f.get(1),'NE');assert.equal(s.hp[7],2);
});

test('移動を戻すと全駒の以前の向きを復元し、新局面は向きを再初期化する',()=>{
  const {s,f}=fixture(),before=directions(f);
  act(f,s,{type:'move',unit:1,to:51});f.restore(s);assert.deepEqual(directions(f),before);
  const replacement=R.cloneState(s);replacement.pos[6]=30;f.reset(replacement);
  assert.equal(f.get(2),'NW');
});

test('押し出された駒の向きは保持し、攻撃者は押し出し後の王の位置を参照する',()=>{
  const {s,f}=fixture();s.pos[3]=4;s.pos[6]=24;f.reset(s);
  const before=f.get(6),stateBefore=JSON.stringify(s);
  const n=act(f,s,{type:'attack',unit:3,target:6});
  assert.equal(n.pos[6],34);assert.equal(f.get(6),before);assert.equal(f.get(3),'SW');
  assert.equal(JSON.stringify(s),stateBefore);
});

test('王撃破後は最後の攻撃方向を保ち、表示更新はコア状態を変更しない',()=>{
  const {s,f}=fixture();s.pos[1]=24;s.hp[6]=1;f.reset(s);
  const action={type:'attack',unit:1,target:6},r=R.applyAction(s,action),before=JSON.stringify(r.state);
  f.complete(s,r.state,action,r.events);
  assert.equal(f.get(1),'SW');assert.equal(r.state.winner,0);assert.equal(JSON.stringify(r.state),before);
});
