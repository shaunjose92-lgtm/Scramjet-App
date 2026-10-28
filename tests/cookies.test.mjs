import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scramjetPath } from '@mercuryworkshop/scramjet/path';
import { patchScramjet } from '../src/scramjet-compat.js';
const source=readFileSync(join(scramjetPath,'scramjet.all.js'),'utf8');
function loadJar(bundle) {
  // Load the real parser and CookieStore modules from the actual served bundle.
  // Use Webpack's module table with a minimal loader; no browser hooks execute.
  const table=bundle.slice(bundle.indexOf('var e=')+6,bundle.lastIndexOf(',t={};function r(n)'));
  const modules=vm.runInNewContext('('+table+')',{URL,Date,console});const cache={};
  function req(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,req);return m.exports}
  req.d=(out,props)=>{for(const k in props)Object.defineProperty(out,k,{get:props[k]})};req.n=m=>()=>m;
  return req(3831).k;
}
const Original=loadJar(source),Fixed=loadJar(patchScramjet(source));const url=new URL('https://login.example.com/account');
test('reproduces old saved-session loss and verifies restoration fix',()=>{
 const initial=new Fixed();initial.setCookies(['session=hello; Path=/; HttpOnly'],url);const saved=JSON.parse(initial.dump());
 const old=new Original();old.load(saved);assert.equal(old.getCookies(url,false),'');
 const fixed=new Fixed();fixed.load(saved);assert.equal(fixed.getCookies(url,false),'session=hello');assert.equal(fixed.getCookies(url,true),'');
});
test('preserves opaque percent-encoded session tokens',()=>{
 const old=new Original();old.setCookies(['session=a%2Fb%3D; Path=/'],url);assert.equal(old.getCookies(url,false),'session=a/b=');
 const fixed=new Fixed();fixed.setCookies(['session=a%2Fb%3D; Path=/'],url);assert.equal(fixed.getCookies(url,false),'session=a%2Fb%3D');
});
test('logout deletion and short-lived cookies work',async()=>{
 const c=new Fixed();c.setCookies(['session=ok; Path=/'],url);c.setCookies(['session=; Max-Age=0; Path=/'],url);assert.equal(c.getCookies(url,false),'');
 c.setCookies(['session=ok; Max-Age=1; Path=/'],url);await new Promise(r=>setTimeout(r,1050));assert.equal(c.getCookies(url,false),'');
});
test('domain and path boundaries do not leak session cookies',()=>{
 const c=new Fixed();c.setCookies(['session=ok; Domain=example.com; Path=/account'],url);
 assert.equal(c.getCookies(new URL('https://notexample.com/account'),false),'');assert.equal(c.getCookies(new URL('https://login.example.com/accounting'),false),'');assert.equal(c.getCookies(new URL('https://sub.example.com/account/x'),false),'session=ok');
 const host=new Fixed();host.setCookies(['secret=ok; Path=/'],url);assert.equal(host.getCookies(new URL('https://sub.login.example.com/'),false),'');
});
test('unexpected engine version fails closed instead of applying wrong patches',()=>{assert.throws(()=>patchScramjet(source+' '),/bundle changed/)});
