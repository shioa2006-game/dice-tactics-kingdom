// 起動時は可逆圧縮画像をデコードして登録。キャラクター定義・ゲーム状態は変更しない。
const manifestURL=new URL('../../assets/characters/manifest.json',import.meta.url);
export const atlasDpr=value=>value>1?1.5:1;
async function readImage(url){
  const image=new Image();let timer;
  try{
    image.src=url;
    await Promise.race([image.decode(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Atlas decode timeout')),15000);})]);
    return image;
  }catch(e){image.src='';throw e;}finally{clearTimeout(timer);}
}
export async function loadCharacterAtlases(renderer,characters,onProgress=()=>{},options={}){
  const started=performance.now(),loaded=[],failed=[];
  let manifest;
  try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{const response=await fetch(options.manifestURL||manifestURL,{signal:controller.signal,cache:'no-cache'});if(!response.ok)throw Error('Atlas manifest '+response.status);manifest=await response.json();}finally{clearTimeout(timer);}
    if(manifest.schemaVersion!==1)throw Error('Unsupported atlas manifest');
    const variant=manifest.variants[renderer.getCamera().dpr];if(!variant)throw Error('Missing atlas resolution');
    await Promise.all(characters.map(async def=>{
      try{
        const meta=variant.characters[def.id];if(!meta||!/^[-a-z0-9.]+\.(?:png|webp)$/.test(meta.file))throw Error('Missing character atlas');
        const image=await readImage(new URL(meta.file,options.manifestURL||manifestURL));
        renderer.installCacheAtlas(meta,image);loaded.push(def.id);onProgress(loaded.length,characters.length);
      }catch(e){failed.push({id:def.id,error:String(e)});}
    }));
  }catch(e){for(const def of characters)failed.push({id:def.id,error:String(e)});}
  // 配信失敗時も対局不能にしない。成功したキャラを作り直さず、失敗分だけ旧処理へ。
  for(const entry of failed){
    onProgress(loaded.length,characters.length,entry.id);await new Promise(resolve=>setTimeout(resolve,12));
    renderer.prepareCaches([entry.id]);
  }
  return {mode:failed.length?'fallback':'atlas',loaded,failed,loadMs:performance.now()-started};
}
