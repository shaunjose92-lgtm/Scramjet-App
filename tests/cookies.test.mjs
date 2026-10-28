import test from 'node:test';
import assert from 'node:assert/strict';
// Exercise the upstream v2 cookie implementation, not the removed v1 patch.
globalThis.self = globalThis;
const { CookieJar } = await import('@mercuryworkshop/scramjet/bundled');
const url = new URL('https://login.example.com/account');
test('saved sessions restore without exposing HttpOnly tokens', () => {
 const first = new CookieJar(); first.setCookies('session=a%2Fb%3D; Path=/; HttpOnly', url);
 const restored = new CookieJar(); restored.load(first.dump());
 assert.equal(restored.getCookies(url, false), 'session=a%2Fb%3D');
 assert.equal(restored.getCookies(url, true), '');
});
test('logout deletion and short-lived cookies work',async()=>{
 const c=new CookieJar();c.setCookies('session=ok; Path=/',url);c.setCookies('session=; Max-Age=0; Path=/',url);assert.equal(c.getCookies(url,false),'');
 c.setCookies('session=ok; Max-Age=1; Path=/',url);await new Promise(r=>setTimeout(r,1050));assert.equal(c.getCookies(url,false),'');
});
test('domain and path boundaries do not leak session cookies',()=>{
 const c=new CookieJar();c.setCookies('session=ok; Domain=example.com; Path=/account',url);
 assert.equal(c.getCookies(new URL('https://notexample.com/account'),false),'');assert.equal(c.getCookies(new URL('https://login.example.com/accounting'),false),'');assert.equal(c.getCookies(new URL('https://sub.example.com/account/x'),false),'session=ok');
 const host=new CookieJar();host.setCookies('secret=ok; Path=/',url);assert.equal(host.getCookies(new URL('https://sub.login.example.com/'),false),'');
});
