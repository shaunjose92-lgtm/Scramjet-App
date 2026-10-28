import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { patchScramjet } from '../src/scramjet-compat.js';
const bundle = patchScramjet(readFileSync(join(scramjetPath, 'scramjet.all.js'), 'utf8'));

test('all concurrent requests wait for engine initialization', async () => {
  const start = bundle.indexOf('async loadConfig()');
  const method = bundle.slice(start, bundle.indexOf('route({', start));
  let ready, attempts = 0;
  const worker = vm.runInNewContext('({' + method + '})', {
    l: { P2: async () => ({ get: async () => ({ prefix: '/scramjet/' }) }) },
    c: { Nk() {} },
    s: { n$: () => { attempts++; return new Promise(resolve => { ready = resolve; }); } }
  });
  let complete = 0;
  const first = worker.loadConfig().then(() => complete++);
  await new Promise(resolve => setImmediate(resolve));
  const second = worker.loadConfig().then(() => complete++);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(complete, 0);
  assert.equal(attempts, 1);
  ready();
  await Promise.all([first, second]);
  assert.equal(complete, 2);
});

test('a disappeared client cannot stall response cookie synchronization', async () => {
  const start = bundle.indexOf('async dispatch(e,t)');
  const method = bundle.slice(start, bundle.indexOf('async loadConfig()', start));
  const worker = vm.runInNewContext('({' + method + '})', { setTimeout, clearTimeout });
  worker.syncPool = {};
  worker.synctoken = 0;
  assert.equal(await worker.dispatch({ postMessage() {} }, {}), null);
  assert.equal(Object.keys(worker.syncPool).length, 0);
  assert.equal(await worker.dispatch({ postMessage() { throw new Error('closed'); } }, {}), null);
  assert.equal(Object.keys(worker.syncPool).length, 0);
});

function createWorker(config) {
  const events = {};
  class MockWorker {
    config = config;
    async loadConfig() {}
    route() { if (!this.config) throw Error('not initialized'); return true; }
    async fetch() { return new Response('<h1>Login</h1>', { headers: { 'Content-Type': 'text/html' } }); }
  }
  const context = vm.createContext({
    importScripts() {}, $scramjetLoadWorker: () => ({ ScramjetServiceWorker: MockWorker }),
    Headers, Response, fetch: async () => new Response('static page'),
    self: { addEventListener: (name, callback) => { events[name] = callback; } }
  });
  vm.runInContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), context);
  return destination => new Promise(resolve => events.fetch({ request: { destination }, respondWith: resolve }));
}

test('proxied pages retain isolation headers even in a non-isolated worker', async () => {
  const response = await createWorker({ prefix: '/scramjet/' })('iframe');
  assert.equal(response.headers.get('Cross-Origin-Embedder-Policy'), 'require-corp');
  assert.equal(response.headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
  assert.equal(await response.text(), '<h1>Login</h1>');
});

test('normal pages still load before proxy configuration is created', async () => {
  const response = await createWorker(undefined)('document');
  assert.equal(await response.text(), 'static page');
});
