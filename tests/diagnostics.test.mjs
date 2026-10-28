import test from 'node:test';
import assert from 'node:assert/strict';
import { networkDiagnostics, classifyStatus } from '../src/diagnostics.js';
test('distinguishes destination errors from blocks and success', () => {
  assert.equal(classifyStatus(500),'upstream-5xx');assert.equal(classifyStatus(403),'restricted');assert.equal(classifyStatus(429),'restricted');assert.equal(classifyStatus(302),'reachable');assert.equal(classifyStatus(404),'http-error');
});
test('coalesces concurrent probes and expires cached results', async () => {
  let clock=0,calls=0,cancelled=0;
  const run=networkDiagnostics(async()=>{calls++;return {status:200,body:{cancel:async()=>cancelled++}}},()=>clock);
  const [a,b]=await Promise.all([run(),run()]);assert.equal(calls,3);assert.equal(cancelled,3);assert.deepEqual(a,b);
  await run();assert.equal(calls,3);clock=60001;await run();assert.equal(calls,6);
});
test('does not leak exception details or credentials', async () => {
  const result=await networkDiagnostics(async()=>{throw Error('secret-cookie')})();
  assert.equal(result.results.every(r=>r.result==='network-error'),true);assert.equal(JSON.stringify(result).includes('secret-cookie'),false);
});
