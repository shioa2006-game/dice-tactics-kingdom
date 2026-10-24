// 診断専用。通常入口からは読み込まない。ゲームの状態・設定を変更しない。
const started=performance.now(), stages=[], longTasks=[];
const actualDpr=devicePixelRatio, requestedDpr=Number(new URLSearchParams(location.search).get('dpr'));
if(requestedDpr===1||requestedDpr===1.5)Object.defineProperty(window,'devicePixelRatio',{value:requestedDpr,configurable:true});
let observer;
try { observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({start:e.startTime,ms:e.duration}))));observer.observe({type:'longtask',buffered:true}); } catch {}
const progress=document.getElementById('loading-detail');
const progressObserver=new MutationObserver(()=>stages.push({at:performance.now(),text:progress.textContent,hidden:document.hidden}));
progressObserver.observe(progress,{childList:true,subtree:true,characterData:true});
await import('../src/ui/app.js');
const initialized=performance.now();
const Board=await import('../src/ui/kingdom-board.js');
await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const painted=performance.now();
await new Promise(resolve=>setTimeout(resolve,100));
observer?.disconnect();progressObserver.disconnect();
const cache=Board.diagnostics.renderer.getDiagnostics();
const resources=performance.getEntriesByType('resource').map(e=>({url:e.name.replace(location.origin,''),type:e.initiatorType,start:e.startTime,end:e.responseEnd,duration:e.duration,bytes:e.encodedBodySize,transfer:e.transferSize}));
const report={kind:'actual-app-startup',at:new Date().toISOString(),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,actualDpr},documentHidden:document.hidden,started,initialized,painted,startupMs:initialized-started,titleVisible:!document.getElementById('title').hidden,stages,longTasks,cache,atlas:Board.diagnostics.atlas,resources,navigation:performance.getEntriesByType('navigation')[0]?.toJSON(),note:'通常app.jsを計測ページから起動。JS生成時間・長時間タスクと経過時間を分離。dprクエリは描画解像度の比較だけであり、実機エミュレーションではない。'};
const panel=document.createElement('details');panel.id='startup-profile';panel.style.cssText='position:fixed;z-index:2000;right:4px;bottom:4px;max-width:95vw;max-height:50vh;overflow:auto;background:white;color:#111;font:12px monospace;padding:8px;border:1px solid #555';
const summary=document.createElement('summary');summary.textContent=`起動計測完了 ${report.startupMs.toFixed(0)}ms（検証専用）`;
const pre=document.createElement('pre');pre.id='startup-report';pre.textContent=JSON.stringify(report,null,2);panel.append(summary,pre);document.body.append(panel);
