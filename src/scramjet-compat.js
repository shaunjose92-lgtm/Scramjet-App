import { readFileSync, writeFileSync, copyFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createCookieStore } from './compat-cookies.js';

export function patchScramjet(source) {
  const expected = '7d8de4965167a27b573bf7022190cfb68c9485d622c5a082e207a1092158d520';
  if (createHash('sha256').update(source).digest('hex') !== expected) throw new Error('Scramjet bundle changed: review compatibility patches before upgrading.');
  function replace(old, replacement) {
    if (source.split(old).length !== 2) throw new Error('Scramjet compatibility patch did not match exactly once.');
    source = source.replace(old, replacement);
  }
  const begin = source.indexOf('3831:function');
  const end = source.indexOf('1427:function', begin);
  replace(source.slice(begin, end), `3831:function(e,t,r){r.d(t,{k:()=>a});var n=r(4322),i=r.n(n);const a=(${createCookieStore.toString()})(i());},`);
  // Restore persisted cookies before requests can read the jar.
  replace('this.client=new a.Ay,(async()=>{', 'this.client=new a.Ay,this.cipherCookieReady=(async()=>{');
  replace('async loadConfig(){if(this.config)return;let e=await (0,l.P2)("$scramjet",1);this.config=await e.get("config","config"),this.config&&((0,c.Nk)(this.config),await (0,s.n$)())}', 'async loadConfig(){await this.cipherCookieReady;if(this.cipherConfigReady)return this.cipherConfigReady;this.cipherConfigReady=(async()=>{const db=await (0,l.P2)("$scramjet",1);const config=this.config||await db.get("config","config");if(!config)return;this.config=config;(0,c.Nk)(config);await (0,s.n$)()})();try{await this.cipherConfigReady}catch(error){this.cipherConfigReady=null;throw error}finally{if(!this.config)this.cipherConfigReady=null}}');
  // Keep server-set cookies, including HttpOnly cookies, across worker restarts.
  replace('let x=v["set-cookie"]||[];for(let t in x)', 'let x=v["set-cookie"]||[];x=Array.isArray(x)?x:[x];await d.setCookies(x,e);if(x.length)await f.cipherPersistCookies();for(let t of x)');
  replace('for(let t in await d.setCookies(x instanceof Array?x:[x],e),v)', 'for(let t in v)');
  // A closed document cannot acknowledge cookies; never stall the response forever.
  replace('async dispatch(e,t){let r,n=this.synctoken++,i=new Promise(e=>r=e);return this.syncPool[n]=r,t.scramjet$token=n,e.postMessage(t),await i}', `async cipherPersistCookies(){const db=await (0,l.P2)("$scramjet",1);await db.put("cookies",JSON.parse(this.cookieStore.dump()),"cookies")}async dispatch(e,t){const id=this.synctoken++;t.scramjet$token=id;return new Promise(resolve=>{const timer=setTimeout(()=>{delete this.syncPool[id];resolve(null)},1500);this.syncPool[id]=value=>{clearTimeout(timer);delete this.syncPool[id];resolve(value)};try{e.postMessage(t)}catch{clearTimeout(timer);delete this.syncPool[id];resolve(null)}})}`);
  replace('delete this.syncPool[e.scramjet$token],t(e);return', 'delete this.syncPool[e.scramjet$token],t?.(e);return');
  return source.replace('//# sourceMappingURL=scramjet.all.js.map', '');
}
export function prepareScramjet(originalPath) {
  const patched = patchScramjet(readFileSync(join(originalPath, 'scramjet.all.js'), 'utf8'));
  const directory = mkdtempSync(join(tmpdir(), 'cipher-scramjet-'));
  writeFileSync(join(directory, 'scramjet.all.js'), patched);
  for (const file of ['scramjet.sync.js', 'scramjet.wasm.wasm']) copyFileSync(join(originalPath, file), join(directory, file));
  return directory;
}
