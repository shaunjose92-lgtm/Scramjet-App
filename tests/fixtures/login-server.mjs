// Local dummy login server used only by browser-login.cjs.
import http from 'node:http';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';

const fixture = http.createServer((req, res) => {
  const cookie = req.headers.cookie || '';
  if (req.url === '/login' && req.method === 'POST') {
    res.writeHead(302, {
      'Set-Cookie': ['session=a%2Fb%3D; Path=/; HttpOnly; Max-Age=3600', 'notice=hello%20world; Path=/'],
      Location: '/dashboard'
    });
    return res.end();
  }
  if (req.url === '/logout') {
    res.writeHead(302, { 'Set-Cookie': 'session=; Path=/; Max-Age=0', Location: '/dashboard' });
    return res.end();
  }
  if (req.url === '/api') {
    res.writeHead(200, { 'Set-Cookie': 'api=value%2Fraw; Path=/', 'Content-Type': 'application/json' });
    return res.end('{"ok":true}');
  }
  res.setHeader('Content-Type', 'text/html');
  if (req.url === '/dashboard') {
    return res.end(cookie.includes('session=a%2Fb%3D')
      ? '<h1>Signed in</h1><a href="/logout">Log out</a>' : '<h1>Signed out</h1>');
  }
  res.end('<h1>Test login</h1><form action="/login" method="post"><button>Sign in</button></form>');
});
await new Promise(resolve => fixture.listen(18191, '127.0.0.1', resolve));
await import('../../src/index.js');
// These exceptions exist only in this test process. Production defaults stay intact.
wisp.options.allow_loopback_ips = true;
wisp.options.allow_private_ips = true;
wisp.options.dns_method = async hostname => {
  if (hostname !== 'login.fixture.test') throw Error('Unexpected fixture destination');
  return '127.0.0.1';
};
console.log('FIXTURE_READY');
