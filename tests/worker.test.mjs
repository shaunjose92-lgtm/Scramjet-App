import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
test('v2 worker routes only controller-owned requests', async () => {
 const events = {};
 const context = vm.createContext({
   Headers, Response,
   importScripts() {},
   $scramjetController: { shouldRoute: e => e.request.url.includes('/scramjet/'), route: async () => new Response('proxied') },
   self: { addEventListener: (name, handler) => { events[name] = handler; } }
 });
 vm.runInContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), context);
 let response;
 events.fetch({ request: { url: 'https://cipher.test/' }, respondWith: r => { response = r; } });
 assert.equal(response, undefined);
 events.fetch({ request: { url: 'https://cipher.test/scramjet/frame/site', destination: 'iframe' }, respondWith: r => { response = r; } });
 const page = await response;
 assert.equal(page.headers.get('Cross-Origin-Embedder-Policy'), 'require-corp');
 assert.equal(page.headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
 assert.equal(await page.text(), 'proxied');
});
