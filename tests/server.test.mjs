import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { once } from 'node:events';
test('real server serves assets, readiness and Wisp query paths', {timeout:20000}, async()=>{
 const child=spawn(process.execPath,['src/index.js'],{env:{...process.env,BIND_HOST:'127.0.0.1',PORT:'18182'},stdio:['ignore','pipe','pipe']});
 try {
  await new Promise((resolve,reject)=>{child.stdout.on('data',b=>{if(b.toString().includes('Listening on'))resolve()});child.once('exit',code=>reject(Error('Server exited '+code)));child.once('error',reject)});
  const base='http://127.0.0.1:18182';
  const r=await fetch(base+'/health/ready');assert.equal(r.status,200);assert.equal((await r.json()).status,'ready');
  for(const path of ['/diagnostics.html','/sw.js','/libcurl/index.mjs'])assert.equal((await fetch(base+path)).status,200);
  const ws=new WebSocket('ws://127.0.0.1:18182/wisp/?check=1');await once(ws,'open');ws.close();await once(ws,'close');
 } finally {child.kill('SIGTERM');await once(child,'exit');}
});
