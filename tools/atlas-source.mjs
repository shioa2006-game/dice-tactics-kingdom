import fs from 'node:fs/promises';
import crypto from 'node:crypto';
export const root=new URL('../',import.meta.url);
export async function atlasSource(){
  const paths=[];
  async function walk(dir){for(const e of await fs.readdir(new URL(dir,root),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())await walk(p);else if(p.endsWith('.js'))paths.push(p);}}
  for(const dir of ['vendor/inkstone/characters','vendor/inkstone/src/characters','vendor/inkstone/src/core'])await walk(dir);
  paths.push('vendor/inkstone/src/rendering/sprites.js','vendor/inkstone/src/rendering/effects.js');
  paths.sort();const files=[];
  for(const file of paths)files.push({file,sha256:crypto.createHash('sha256').update(await fs.readFile(new URL(file,root))).digest('hex')});
  return {hash:crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex'),files};
}
