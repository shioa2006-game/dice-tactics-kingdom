// ?qa=1 専用の操作回帰ハーネス。通常ゲームには読み込まない。
// 合成入力と人工局面の検査は、実機タッチ・目視・聴感の確認とは区別して記録する。
import { planTurn } from '../src/core/ai.js';
import { makeRng } from '../src/core/rng.js';
import * as AE from '../src/ui/audio/engine.js';
import * as Music from '../src/ui/audio/music.js';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const $ = id => document.getElementById(id);
const STORE_KEYS = ['dice-tactics.settings', 'dice-tactics.records', 'dice-tactics.audio'];
const snapshotStorage = () => new Map(STORE_KEYS.map(key => [key, localStorage.getItem(key)]));
const restoreStorage = values => { for (const [key, value] of values) value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); };
const snapshot = s => ({ pos:[...s.pos], hp:[...s.hp], flags:[...s.flags], ap:s.ap, apGained:s.apGained, side:s.side, phase:s.phase, turn:s.turn, winner:s.winner, lost:[...s.lost], dice:s.dice&&[...s.dice] });
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const DENSE = [64,53,55,63,65,66,34,43,44,33,35,46];
const RANGE = [90,99,22,44,62,55,4,48,32,9,0,35];
function audioDiagnostics() {
  const context=AE.context(),song=Music.songInfo();
  return {at:new Date().toISOString(),contextState:context?.state??null,currentTime:context?.currentTime??null,sampleRate:context?.sampleRate??null,ready:AE.ready(),running:AE.running(),unavailable:AE.unavailable(),sfxEnabled:AE.sfxEnabled(),settings:{...AE.settings},music:{supported:Music.supported(),playing:Music.playing(),song:song?{seconds:song.seconds,peak:song.peak,sampleRate:song.buffer?.sampleRate,channels:song.buffer?.numberOfChannels,length:song.buffer?.length}:null},note:'API状態の確認。スピーカーから実際に聴こえることの確認とは異なります。'};
}

export function installQA(app) {
  const {game,cfg,settings,R,Board,render} = app;
  const panel = document.createElement('details'); panel.id = 'qa-panel';
  panel.style.cssText = 'position:fixed;right:8px;top:82px;z-index:900;width:min(332px,calc(100vw - 16px));max-height:70dvh;overflow:auto;background:#f8f1e3;color:#463d31;border:1px solid #9c875d;border-radius:8px;padding:8px;font:12px/1.45 system-ui;box-shadow:0 3px 16px #0003';
  panel.innerHTML = '<summary style="cursor:pointer;font-weight:bold">QA検証（人工局面・合成入力）</summary><p>通常プレイとは別の検証です。固定6APの人工配置を含みます。テスト終了時に戦績・設定を復元します。</p><div id="qa-controls" style="display:flex;flex-wrap:wrap;gap:5px"></div><pre id="qa-report" style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:10px;max-height:270px;overflow:auto" aria-live="polite">未実行</pre>';
  document.body.append(panel);
  for (const type of ['pointerdown','pointerup','click','keydown']) panel.addEventListener(type, e => e.stopPropagation());
  const button = (name, fn, id) => {
    const b = document.createElement('button'); b.textContent = name; if(id)b.id=id;
    b.style.cssText = 'font:12px system-ui;min-height:34px;padding:5px 8px;border:1px solid #ad9a77;border-radius:5px;background:#fffaf0;color:#3c514a;cursor:pointer';
    b.onclick = fn; $('qa-controls').append(b); return b;
  };
  let manualRecords = null;
  function restoreManual() {
    if(manualRecords){restoreStorage(manualRecords);manualRecords=null;}
  }
  // 手動の勝利直前局面でも、通常対局の戦績へ加算を残さない。
  setInterval(() => { if(manualRecords && game.mode==='over') restoreManual(); }, 250);
  window.addEventListener('beforeunload', restoreManual);
  function fixture(kind='initial', extra={}) {
    const first = settings.first; settings.first='human'; app.newGame(); settings.first=first;
    game.id++; Board.cancelAnimation();
    const s = R.beginTurn(R.createGame(cfg,{firstSide:extra.side??0}),[2,2,1]);
    if(kind==='dense'||kind==='victory'||kind==='defeat') s.pos.set(DENSE);
    if(kind==='range'||kind.startsWith('push')) s.pos.set(RANGE);
    if(kind==='victory'){s.pos[1]=24;s.hp[6]=1;}
    if(kind==='defeat'){s.pos[7]=63;s.pos[3]=73;s.hp[0]=1;}
    if(kind==='pushSuccess')s.pos[6]=14;
    if(kind==='pushUnit'){s.pos[6]=14;s.pos[10]=4;}
    if(kind==='pushRock'){s.pos[3]=27;s.pos[6]=47;}
    if(new Set(s.pos).size!==12 || s.pos.some(c=>c<0||c>99||cfg.obstacle[c]))throw Error('人工配置が重複または障害物と衝突: '+kind);
    Object.assign(game,{state:s,mode:'act',sel:extra.selected??-1,preview:null,msg:null,busy:false,acting:-1,undo:[],trails:[],notice:null,actNote:'',cpuNote:'',cpuSub:'',cpuThinking:false,endArmed:false,diceAnimating:false,apFresh:false});
    game.log.push({cls:'sys',text:'QA人工配置 '+kind+'（固定6AP・通常プレイではありません）'});
    render();
    if(kind==='initial')Board.centerOn(4.5,8.5);
    else if(kind==='victory')Board.centerOn(4.5,3.5);
    else Board.centerOn(4.5,4.5);
    return s;
  }
  function manual(kind, selected) {
    restoreManual(); manualRecords = new Map([['dice-tactics.records',localStorage.getItem('dice-tactics.records')]]);
    fixture(kind,{selected}); panel.open=false;
    $('qa-report').textContent = JSON.stringify({type:'manual-fixture',fixture:kind,artificial:true,state:snapshot(game.state)},null,2);
  }
  button('検証局面：密集',()=>manual('dense',1));
  button('検証局面：射程',()=>manual('range',3));
  button('検証局面：勝利直前',()=>manual('victory',1));
  button('通常の初期配置',()=>{restoreManual();const first=settings.first;settings.first='human';app.newGame();settings.first=first;panel.open=false;});
  button('タイトルへ',()=>{restoreManual();app.goTitle();panel.open=false;});
  const run = button('入力・進行テスト', runTests, 'run-qa');
  const fullRun = button('通常対局を通し再生', runFullMatch, 'run-full-game');
  button('音声状態を記録',()=>{$('qa-report').textContent=JSON.stringify({type:'audio-diagnostics',audio:audioDiagnostics()},null,2);},'qa-audio');

  async function until(test, label, timeout=5000) {
    const end=performance.now()+timeout;
    while(performance.now()<end){if(test())return;await sleep(35);}
    throw Error(label+'（'+timeout+'ms以内に条件を満たさず）');
  }
  async function frame(){await sleep(90);}
  let pointerId=1000;
  function pointer(type,x,y,id=pointerId,primary=true) {
    const v=$('viewport'),r=v.getBoundingClientRect();
    v.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:primary,button:0,buttons:type==='pointerup'||type==='pointercancel'?0:1,clientX:r.left+x,clientY:r.top+y}));
  }
  function tap(x,y){pointerId++;pointer('pointerdown',x,y);pointer('pointerup',x,y);}
  function tapCell(c){const p=Board.toViewport(c%10+.5,Math.floor(c/10)+.5);tap(p.x,p.y);}
  // 実UIのパン入力を使い、撤去済みの部隊一覧・カメラボタンに依存しない。
  function panTo(x,y) {
    const v=$('viewport');
    for(let i=0;i<32;i++){
      const p=Board.toViewport(x,y),dx=v.clientWidth/2-p.x,dy=v.clientHeight/2-p.y;
      if(Math.hypot(dx,dy)<.5)return;
      const sx=Math.max(-v.clientWidth*.4,Math.min(v.clientWidth*.4,dx)),sy=Math.max(-v.clientHeight*.4,Math.min(v.clientHeight*.4,dy));
      // 8 px のタップ閾値を越える往路を足しても、最終的なパン量は sx / sy。
      const ax=v.clientWidth/2-sx/2,ay=v.clientHeight/2-sy/2;
      pointerId++;pointer('pointerdown',ax,ay);pointer('pointermove',ax+sx+12,ay+sy);pointer('pointermove',ax+sx,ay+sy);pointer('pointerup',ax+sx,ay+sy);
    }
    throw Error('パンで対象を中央へ移動できない: '+x+','+y);
  }
  function ensureVisible(u) {
    const c=game.state.pos[u],p=Board.toViewport(c%10+.5,Math.floor(c/10)+.5),v=$('viewport');
    if(p.x<35||p.x>v.clientWidth-35||p.y<75||p.y>v.clientHeight-35)panTo(c%10+.5,Math.floor(c/10)+.5);
  }
  function chooseCandidate(u){if(!$('chooser').hidden){const b=$('chooser-options').querySelector(`[data-unit="${u}"]`);if(!b)throw Error('候補に対象IDがない: '+u);b.click();}}
  function tapHP(u){ensureVisible(u);const d=Board.diagnostics.info,l=d.labels.find(v=>v.u===u);if(!l)throw Error('HP選択領域がない: '+u);tap(l.x+l.w/2+d.pan.x,l.y+l.h/2+d.pan.y);chooseCandidate(u);}
  function select(u){
    if(game.preview)app.cancel();if(game.sel>=0)app.cancel();
    ensureVisible(u);const c=game.state.pos[u],p=Board.toViewport(c%10+.5,Math.floor(c/10)+.5);
    tap(p.x,p.y-24);chooseCandidate(u);
    if(game.sel!==u)throw Error('盤上で駒を選択できない: '+u+' / selected '+game.sel);
  }
  function key(key,code=key){$('viewport').dispatchEvent(new KeyboardEvent('keydown',{key,code,bubbles:true,cancelable:true}));}
  function setCheck(id,value){if($(id).checked!==value)$(id).click();}
  async function confirm(){ $('btn-confirm').click();await until(()=>!game.busy,'行動完了',4500);await frame(); }

  async function runTests() {
    restoreManual();run.disabled=true;fullRun.disabled=true;panel.open=false;
    const storage=snapshotStorage(),previousSettings={...settings};
    const audioUI={sfx:$('set-sfx').checked,bgm:$('set-bgm').checked,sfxVol:$('set-sfx-vol').value,bgmVol:$('set-bgm-vol').value,mute:$('btn-mute').getAttribute('aria-pressed')==='true'};
    const report={type:'browser-synthetic-regression',started:new Date().toISOString(),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},audioBefore:audioDiagnostics(),notes:['人工配置・固定出目を含む合成DOM/PointerEvent検証。','実機の指操作、聴感、ブラウザの実際の背景タブ遷移は別途確認が必要。'],results:[]};
    const check=(name,ok,detail)=>{report.results.push({name,pass:!!ok,...(detail!==undefined?{detail}:{})});$('qa-report').textContent=JSON.stringify(report,null,2);if(!ok)throw Error(name);};
    const group=async(name,fn)=>{try{await fn();}catch(e){report.results.push({name:name+'：例外',pass:false,detail:e.stack||String(e)});}};
    try {
      settings.speed='fast';settings.first='human';settings.level='rookie';settings.quick=false;
      setCheck('set-quick',false);setCheck('set-calm',false);
      if($('btn-mute').getAttribute('aria-pressed')!=='true')$('btn-mute').click();
      await group('描画と入力安全性',async()=>{
        fixture();await frame();let d=Board.diagnostics.info;
        check('12体・8種を描画キューへ渡す',d.units.length===12&&new Set(d.units.map(u=>u.character)).size===8,{ids:d.units.map(u=>[u.id,u.character]),order:d.last?.order});
        check('初期の自軍は右上NE・敵軍は左下SWを向く',d.units.every(u=>u.direction===(+u.id<6?'NE':'SW')),d.units.map(u=>({id:u.id,direction:u.direction})));
        check('部隊・自軍へ・旧盤面ツールを撤去',!$('btn-roster')&&!$('btn-focus')&&!$('roster-panel')&&!document.querySelector('.board-tools'));
        check('HP領域が各駒の足元座標に対応',d.labels.length===12&&d.labels.every(l=>{const u=d.units.find(u=>+u.id===l.u),p=Board.toViewport(u.x,u.y);return Math.abs(l.x+l.w/2+d.pan.x-p.x)<1&&Math.abs(l.y+l.h/2+d.pan.y-(p.y+9))<3;}));
        select(0);tapCell(94);check('移動プレビューがコア候補と一致',game.preview?.action.to===94&&game.preview.path.at(-1)===94);
        const initial=snapshot(game.state),preview=JSON.stringify(game.preview.action),pan={...d.pan},builds=d.sceneBuilds;
        pointerId++;pointer('pointerdown',140,180);for(let i=1;i<=28;i++){pointer('pointermove',140+i*3,180+i*2);await sleep(8);}pointer('pointerup',224,236);
        d=Board.diagnostics.info;
        check('長いパンは行動・選択・プレビューを確定しない',equal(initial,snapshot(game.state))&&JSON.stringify(game.preview?.action)===preview&&game.sel===0&&Math.abs(d.pan.x-pan.x)>50);
        check('パンで背景を再生成しない',d.sceneBuilds===builds,{builds});
        Board.centerOn(4.5,8.5);await frame();
        const p=Board.toViewport(4.5,9.5);
        const unchanged=()=>equal(initial,snapshot(game.state))&&JSON.stringify(game.preview?.action)===preview&&!game.busy;
        pointerId++;pointer('pointerdown',p.x,p.y);pointer('pointermove',p.x+10,p.y);pointer('pointerup',p.x,p.y);check('閾値を超えて戻したドラッグをタップにしない',unchanged());
        pointerId++;pointer('pointerdown',p.x,p.y);pointer('pointercancel',p.x,p.y);pointer('pointerup',p.x,p.y);check('pointercancel後の指離しで確定しない',unchanged());
        pointerId++;pointer('pointerdown',p.x,p.y);pointer('pointermove',-5,p.y);pointer('pointerup',p.x,p.y);check('盤外へ出て戻った指で確定しない',unchanged());
        pointerId+=2;pointer('pointerdown',p.x,p.y);pointer('pointerdown',p.x+20,p.y,pointerId+1,false);pointer('pointerup',p.x,p.y);pointer('pointerup',p.x+20,p.y,pointerId+1,false);check('複数指を確定にしない',unchanged());
        pointerId++;pointer('pointerdown',p.x,p.y);window.dispatchEvent(new Event('blur'));pointer('pointerup',p.x,p.y);check('blurで進行中ポインターを破棄',unchanged());
        pointerId++;pointer('pointerdown',100,150);pointer('pointermove',50000,50000);pointer('pointerup',50000,50000);
        const c=Board.diagnostics.info.center;check('極端なパンでも盤面周辺で制限',c.x>=-.451&&c.x<=10.451&&c.y>=-.451&&c.y<=10.451,c);
        fixture('range');await frame();
        for(const u of [0,1,9,10]){if(game.sel>=0)app.cancel();const c=game.state.pos[u];panTo(c%10+.5,Math.floor(c/10)+.5);await frame();const p=Board.toViewport(c%10+.5,Math.floor(c/10)+.5);tapHP(u);check('四隅の駒 '+u+' を指のパンで中央へ運び選択',game.sel===u&&Math.abs(p.x-$('viewport').clientWidth/2)<2&&Math.abs(p.y-$('viewport').clientHeight/2)<2);}
        check('長いパン後も盤面のネイティブスクロールは0',$('viewport').scrollTop===0&&$('viewport').scrollLeft===0,{top:$('viewport').scrollTop,left:$('viewport').scrollLeft});
        check('HPはキャンバス描画でDOMの名前ラベルを重ねない',!document.querySelector('#world .unit-label,#world .hp-label,#world [data-unit]'));
        fixture('dense');await frame();select(2);check('密集した同職種2体を身体タップで選択',game.sel===2);select(1);check('密集したもう1体を身体タップで取り違えない',game.sel===1);
        app.cancel();tapHP(5);check('手前に露出したHP目盛りから魔法使いを選択',game.sel===5);
        app.cancel();const overlap=Board.diagnostics.info,backHP=overlap.labels.find(l=>l.u===8);tap(backHP.x+backHP.w/2+overlap.pan.x,backHP.y+backHP.h/2+overlap.pan.y);
        check('後ろのHPと前の身体が重なる位置は前景の剣士を選択',game.sel===2&&$('chooser').hidden,{selected:game.sel,behindHP:8,foreground:2});
        fixture('range');await frame();tapHP(11);check('岩の背後の暗黒魔法使いを足元で選択',game.sel===11);
      });
      await group('移動・確定・取消・主要キー',async()=>{
        fixture();await frame();key('1');check('数字キーで王を選択',game.sel===0);tapCell(94);
        const initial=snapshot(game.state);$('btn-cancel').click();check('プレビュー取消は状態を変えない',!game.preview&&equal(initial,snapshot(game.state)));
        tapCell(94);const expected=R.applyAction(game.state,game.preview.action).state;$('btn-confirm').click();$('btn-confirm').click();key('Enter');
        await sleep(60);check('移動中は経路方向SWで歩行アニメーション',Board.diagnostics.animation?.event.type==='move'&&Board.diagnostics.info.units.some(u=>u.action==='walk'&&u.direction==='SW'));
        await until(()=>!game.busy,'連打後の移動完了');await frame();check('確定連打で1回だけコア結果を反映し移動後は自軍NE',equal(snapshot(expected),snapshot(game.state))&&Board.diagnostics.info.units.find(u=>u.id==='0').direction==='NE');
        key('z');await until(()=>!game.busy,'Undo完了');check('Zキーで移動前のAP・位置・フラグを復元',equal(initial,snapshot(game.state)));
        key('Escape');await frame();check('Escで選択解除',game.sel===-1);
        check('移動を戻した後も両軍の待機方向NE/SWへ戻る',!Board.diagnostics.animation&&Board.diagnostics.info.units.every(u=>u.action==='idle'&&u.direction===(cfg.unitSide[+u.id]===0?'NE':'SW')));
      });
      await group('射程・攻撃・押し出し',async()=>{
        fixture('dense');game.state.hp[7]=1;render();await frame();select(1);tapHP(7);await confirm();
        check('一般兵撃破で次ターンのダイス強化と通知',game.state.pos[7]===-1&&game.state.lost[1]===1&&R.diceStageOf(game.state,1)===1&&equal(R.diceMaxOf(game.state,1),[3,2,2])&&game.notice?.side===1&&$('toast').textContent.includes('強化'));
        fixture('range');await frame();select(4);const before=snapshot(game.state);tapHP(8);
        check('岩で遮られた弓攻撃を拒否',!game.preview&&game.msg?.cls==='error'&&equal(before,snapshot(game.state))&&!R.attackOptions(game.state,4).some(a=>a.target===8));
        fixture('range');await frame();select(5);tapHP(11);check('魔法の岩越しプレビュー',game.preview?.opt.overObstacle===true&&game.preview.action.target===11);
        let expected=R.applyAction(game.state,game.preview.action).state;await confirm();check('魔法はコアどおりHP・AP更新',equal(snapshot(expected),snapshot(game.state)));
        for(const [kind,reason,dest]of [['range','edge',-1],['pushSuccess',null,4],['pushUnit','unit',-1],['pushRock','obstacle',-1]]){
          fixture(kind);await frame();select(3);
          const target=game.state.pos[6];Board.centerOn((game.state.pos[3]%10+target%10)/2+.5,(Math.floor(game.state.pos[3]/10)+Math.floor(target/10))/2+.5);await frame();tapHP(6);
          const pv=game.preview;check('弓プレビュー '+kind,pv?.kind==='attack'&&pv.opt.hit.blocked===reason&&pv.opt.hit.dest===dest,pv?.opt.hit);
          expected=R.applyAction(game.state,pv.action).state;await confirm();check('弓の結果 '+kind,equal(snapshot(expected),snapshot(game.state)));
        }
        check('攻撃後も両軍の待機方向NE/SW・攻撃済み',!Board.diagnostics.animation&&Board.diagnostics.info.units.every(u=>u.action==='idle'&&u.direction===(cfg.unitSide[+u.id]===0?'NE':'SW'))&&(game.state.flags[3]&2)!==0);
      });
      await group('設定・メニュー',async()=>{
        fixture();await frame();const state=snapshot(game.state);document.querySelector('[data-sheet="settings"]').click();
        tapCell(94);check('メニュー表示中の盤面入力を遮断',equal(state,snapshot(game.state))&&!game.preview);
        document.querySelector('#set-speed [data-v="slow"]').click();setCheck('set-quick',true);setCheck('set-calm',true);
        const saved=JSON.parse(localStorage.getItem('dice-tactics.settings'));check('速度・確定方法・控えめ演出を保存',saved.speed==='slow'&&saved.quick===true&&saved.calm===true&&document.body.classList.contains('calm'));
        setCheck('set-sfx',false);const audio=JSON.parse(localStorage.getItem('dice-tactics.audio'));check('効果音オフと消音状態を保存',audio.sfx===false&&audio.mute===true);
        document.querySelector('#set-speed [data-v="fast"]').click();setCheck('set-quick',false);setCheck('set-calm',false);key('Escape');check('Escで設定を閉じる',$('sheet-back').hidden);
        document.querySelector('[data-sheet="rules"]').click();check('ルール表示に兵種性能がある',!$('sheet-rules').hidden&&$('rules-body').textContent.includes('2〜4'));key('Escape');
        document.querySelector('[data-sheet="log"]').click();check('行動履歴を開ける',!$('sheet-log').hidden&&$('log').children.length>0);key('Escape');
      });
      await group('4難易度・先手・実CPU',async()=>{
        for(const level of ['rookie','easy','normal','hard']){
          app.goTitle();document.querySelector(`#title-levels [data-level="${level}"]`).click();document.querySelector('#title-first [data-v="human"]').click();$('btn-start').click();
          check('タイトルから '+level+'・自軍先手',game.level===level&&game.state.firstSide===0&&game.mode==='roll'&&$('title').hidden);
        }
        app.goTitle();document.querySelector('#title-levels [data-level="rookie"]').click();document.querySelector('#title-first [data-v="cpu"]').click();$('btn-start').click();
        check('CPU先手で開始',game.state.firstSide===1&&game.mode==='cpu');
        const pan={...Board.diagnostics.info.pan};await until(()=>game.mode==='roll'&&game.state.side===0,'実CPU手番から復帰',25000);
        await frame();
        check('実CPUが合法手を順に実行し待機方向SWで自軍へ復帰',game.state.turn===2&&game.log.some(l=>l.text.includes('CPU のターン終了'))&&game.trails.length>0&&Board.diagnostics.info.units.filter(u=>cfg.unitSide[+u.id]===1).every(u=>u.action==='idle'&&u.direction==='SW'),{trails:game.trails,state:snapshot(game.state),directions:Board.diagnostics.info.units.map(u=>[u.id,u.direction])});
        check('画面外のCPU行動へ追従',Math.abs(Board.diagnostics.info.pan.x-pan.x)+Math.abs(Board.diagnostics.info.pan.y-pan.y)>20);
        key(' ','Space');await until(()=>game.mode==='act'&&!game.busy,'Spaceキーのダイス');check('Spaceで本来のダイスとAPを確定',game.state.ap===1+game.state.dice.reduce((a,b)=>a+b,0)&&game.state.ap>=1&&game.state.ap<=7);
        $('btn-main').click();check('行動可能APがあるターン終了は確認待ち',game.endArmed&&game.mode==='act');$('btn-main').click();check('2回目のターン終了でCPUへ',game.mode==='cpu');
        app.goTitle();document.querySelector('#title-first [data-v="random"]').click();$('btn-start').click();check('ランダム先手が両軍のいずれか',game.state.firstSide===0||game.state.firstSide===1);
        const id=game.id;app.goTitle();await sleep(900);check('CPU演出中のタイトル復帰で旧進行を停止',game.id>id&&game.mode==='title'&&!game.busy);
      });
      await group('勝敗・統計・再戦',async()=>{
        settings.first='human';
        fixture('victory');await frame();select(1);tapHP(6);check('王撃破の勝利プレビュー',game.preview?.opt.hit.kills===true);
        await confirm();await until(()=>!$('result').hidden,'勝利結果');check('王撃破→勝利・対戦統計',game.state.winner===0&&game.mode==='over'&&$('result-title').textContent.includes('勝')&&$('result-stats').rows.length>=6);
        $('btn-again').click();check('結果から再戦は12体初期状態',game.mode==='roll'&&game.state.pos.every((c,u)=>c===cfg.start[cfg.unitSide[u]][u%6])&&game.state.hp.every((h,u)=>h===cfg.types[cfg.unitType[u]].hp));
        fixture('defeat',{side:1});const r=R.applyAction(game.state,{type:'attack',unit:7,target:0});game.state=r.state;app.finish();await until(()=>!$('result').hidden,'敗北結果');check('合法CPU王撃破の状態→敗北画面',game.state.winner===1&&game.mode==='over'&&$('result-title').textContent.includes('敗'));
        $('btn-title').click();check('結果からタイトルへ',$('title').hidden===false&&game.mode==='title');
        fixture('initial',{side:1});game.state.turn=80;game.state=R.endTurn(game.state);app.finish();await until(()=>!$('result').hidden,'引き分け結果');check('規定ターン終了→引き分け画面',game.state.winner==='draw'&&$('result-title').textContent.includes('引き分け'));
        $('btn-close').click();check('結果を閉じて終局盤面を見られる',$('result').hidden&&game.mode==='over');
      });
    } catch(e) { report.results.push({name:'ハーネス例外',pass:false,detail:e.stack||String(e)}); }
    finally {
      app.goTitle();
      // UIから音声状態を元へ。保存キーは最後に文字列のまま復元する。
      setCheck('set-sfx',audioUI.sfx);setCheck('set-bgm',audioUI.bgm);
      for(const [id,value]of [['set-sfx-vol',audioUI.sfxVol],['set-bgm-vol',audioUI.bgmVol]]){$(id).value=value;$(id).dispatchEvent(new Event('input',{bubbles:true}));$(id).dispatchEvent(new Event('change',{bubbles:true}));}
      if(($('btn-mute').getAttribute('aria-pressed')==='true')!==audioUI.mute)$('btn-mute').click();
      for(const key of Object.keys(settings))delete settings[key];Object.assign(settings,previousSettings);
      setCheck('set-quick',previousSettings.quick);setCheck('set-calm',previousSettings.calm);document.querySelector(`#set-speed [data-v="${previousSettings.speed}"]`)?.click();
      const first=settings.first;settings.first='human';app.newGame();settings.first=first;
      restoreStorage(storage);await frame();
      report.finished=new Date().toISOString();report.passed=report.results.filter(r=>r.pass).length;report.failed=report.results.filter(r=>!r.pass).length;
      report.finalState=snapshot(game.state);report.diagnostics=Board.diagnostics.info;report.audioAfter=audioDiagnostics();
      report.storageRestored=STORE_KEYS.every(key=>localStorage.getItem(key)===storage.get(key));
      $('qa-report').textContent=JSON.stringify(report,null,2);run.disabled=false;fullRun.disabled=false;panel.open=true;
    }
  }

  /** 人間側の入力作成だけを既存HARDに任せる。配置・出目・相手CPU・進行は通常版そのもの。 */
  async function runFullMatch() {
    restoreManual();run.disabled=true;fullRun.disabled=true;panel.open=false;
    const storage=snapshotStorage(),previousSettings={...settings};
    const oldMute=$('btn-mute').getAttribute('aria-pressed')==='true';
    const report={type:'standard-match-through-ui',started:new Date().toISOString(),viewport:{width:innerWidth,height:innerHeight},audioBefore:audioDiagnostics(),artificialPosition:false,fixedDice:false,playerInputPlanner:'既存HARD planTurn / seed 20261024',cpu:'既存ROOKIE / 実Worker',turns:[],results:[]};
    const publish=()=>{$('qa-report').textContent=JSON.stringify(report,null,2);};
    const check=(name,ok,detail)=>{report.results.push({name,pass:!!ok,...(detail!==undefined?{detail}:{})});publish();if(!ok)throw Error(name);};
    try {
      app.goTitle();document.querySelector('#title-levels [data-level="rookie"]').click();document.querySelector('#title-first [data-v="human"]').click();
      document.querySelector('#set-speed [data-v="fast"]').click();setCheck('set-quick',false);setCheck('set-calm',true);
      if(!oldMute)$('btn-mute').click();$('btn-start').click();
      check('タイトル操作から標準12体で開始',game.mode==='roll'&&game.level==='rookie'&&game.state.pos.every((c,u)=>c===cfg.start[cfg.unitSide[u]][u%6]));
      const rng=makeRng(20261024),start=performance.now();let prevStart=null,humanActions=0;
      while(game.mode!=='over') {
        if(performance.now()-start>240000)throw Error('通し再生の上限240秒に達しました');
        if(game.mode==='cpu'){
          const turn=game.state.turn;await until(()=>game.mode!=='cpu','CPUターン '+turn,30000);
          report.turns.push({side:'CPU',turn,state:snapshot(game.state)});publish();continue;
        }
        if(game.mode==='roll'){$('btn-main').click();await until(()=>game.mode==='act'&&!game.busy,'人間のダイス',5000);}
        if(game.mode==='over')break;
        if(game.mode!=='act')throw Error('予期しない進行モード: '+game.mode);
        const turn=game.state.turn,plan=planTurn(game.state,{rng,prevStart});prevStart=[...game.state.pos];
        for(const action of plan.actions){
          if(game.mode==='over')break;
          const error=R.validateAction(game.state,action);if(error)throw Error('入力作成側の非法手: '+error);
          const expected=R.applyAction(game.state,action).state;
          app.cancel();if(game.sel>=0)app.cancel();app.onCell(game.state.pos[action.unit]);
          app.onCell(action.type==='move'?action.to:game.state.pos[action.target]);
          if(!game.preview||!equal(game.preview.action,action))throw Error('通常対局の入力からプレビューが一致しません: '+JSON.stringify({action,preview:game.preview?.action}));
          $('btn-confirm').click();await until(()=>!game.busy,'通常対局の確定',5000);
          if(!equal(snapshot(expected),snapshot(game.state)))throw Error('通常対局の確定結果がコアと一致しません');
          humanActions++;
        }
        report.turns.push({side:'あなた',turn,planned:plan.actions,confirmed:humanActions,state:snapshot(game.state)});publish();
        if(game.mode==='act'){$('btn-main').click();if(game.endArmed)$('btn-main').click();}
      }
      await until(()=>!$('result').hidden,'通常対局の結果画面',5000);
      check('通常初期配置から終局まで進行',game.state.phase==='over'&&humanActions>0,{winner:game.state.winner,turn:game.state.turn,humanActions,seconds:Math.round((performance.now()-start)/1000)});
      check('通常対局の統計を表示',$('result-stats').rows.length>=6&&game.stats.some(s=>s.attacks>0),{stats:game.stats,result:$('result-title').textContent});
      report.terminal=snapshot(game.state);$('btn-again').click();check('通常終局から再戦',game.mode==='roll'&&game.state.pos.every((c,u)=>c===cfg.start[cfg.unitSide[u]][u%6]));
      document.querySelector('[data-sheet="settings"]').click();$('btn-new').click();check('再戦からタイトルへ戻れる',game.mode==='title'&&!$('title').hidden);
    } catch(e){report.results.push({name:'通し再生の例外',pass:false,detail:e.stack||String(e)});}
    finally {
      app.goTitle();
      for(const key of Object.keys(settings))delete settings[key];Object.assign(settings,previousSettings);
      setCheck('set-quick',previousSettings.quick);setCheck('set-calm',previousSettings.calm);document.querySelector(`#set-speed [data-v="${previousSettings.speed}"]`)?.click();
      if(($('btn-mute').getAttribute('aria-pressed')==='true')!==oldMute)$('btn-mute').click();
      restoreStorage(storage);app.goTitle();
      report.finished=new Date().toISOString();report.passed=report.results.filter(r=>r.pass).length;report.failed=report.results.filter(r=>!r.pass).length;
      report.storageRestored=STORE_KEYS.every(key=>localStorage.getItem(key)===storage.get(key));report.diagnostics=Board.diagnostics.info;report.audioAfter=audioDiagnostics();
      publish();run.disabled=false;fullRun.disabled=false;panel.open=true;
    }
  }
}
