import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../public/register-sw.js',import.meta.url),'utf8');
function fixture(active=false) {
 const serviceWorker=new EventTarget(), worker=new EventTarget();worker.state=active?'activated':'installing';
 const reg={installing:active?null:worker,active:active?worker:null};serviceWorker.controller=active?worker:null;serviceWorker.register=async()=>reg;
 const ctx=vm.createContext({navigator:{serviceWorker},setTimeout,clearTimeout});vm.runInContext(source,ctx);
 return {run:()=>vm.runInContext('registerSW()',ctx),serviceWorker,worker,reg};
}
test('does not navigate until worker activates and controls the page',async()=>{
 const f=fixture();let resolved=false;const p=f.run().then(()=>resolved=true);await new Promise(r=>setImmediate(r));assert.equal(resolved,false);
 f.worker.state='activated';f.reg.active=f.worker;f.worker.dispatchEvent(new Event('statechange'));assert.equal(resolved,false);
 f.serviceWorker.controller=f.worker;f.serviceWorker.dispatchEvent(new Event('controllerchange'));await p;assert.equal(resolved,true);
});
test('existing controlled browser starts immediately',async()=>{await fixture(true).run()});
test('failed installation gives a visible setup error',async()=>{const f=fixture();const p=f.run();await new Promise(r=>setImmediate(r));f.worker.state='redundant';f.worker.dispatchEvent(new Event('statechange'));await assert.rejects(p,/setup failed/)});

test('waits for the new worker even while the previous version still controls the page', async () => {
 const f = fixture(); f.serviceWorker.controller = { state: 'activated' }; f.reg.active = f.serviceWorker.controller;
 let resolved = false; const pending = f.run().then(() => { resolved = true; });
 await new Promise(r => setImmediate(r)); assert.equal(resolved, false);
 f.worker.state = 'activated'; f.reg.active = f.worker; f.worker.dispatchEvent(new Event('statechange'));
 await new Promise(r => setImmediate(r)); assert.equal(resolved, false);
 f.serviceWorker.controller = f.worker; f.serviceWorker.dispatchEvent(new Event('controllerchange'));
 await pending;
});
