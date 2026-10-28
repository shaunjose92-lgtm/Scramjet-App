// Local dummy login server used only by browser-login.cjs.
import http from 'node:http';
import { server as wisp } from '@mercuryworkshop/wisp-js/server';

const fixture = http.createServer(async (req, res) => {
  const cookie = req.headers.cookie || '';
  if (req.url === '/login' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const fields = new URLSearchParams(body);
    if (fields.get('username') !== 'cipher-test' || fields.get('password') !== 'fixture+only&=/%✓' ||
        fields.get('csrf') !== 'csrf%2Ftoken' || !cookie.includes('csrf=csrf%2Ftoken')) {
      res.writeHead(403, { 'Content-Type': 'text/html' });
      return res.end('<h1>Login payload rejected</h1>');
    }
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
  if (req.url === '/echo' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ body, contentType: req.headers['content-type'], csrf: req.headers['x-csrf-token'], origin: req.headers.origin }));
  }
  res.setHeader('Content-Type', 'text/html');
  if (req.url === '/dashboard') {
    return res.end(cookie.includes('session=a%2Fb%3D')
      ? '<h1>Signed in</h1><a href="/logout">Log out</a><a href="/dashboard" target="_blank">Open account tab</a>' : '<h1>Signed out</h1>');
  }
  res.setHeader('Set-Cookie', 'csrf=csrf%2Ftoken; Path=/');
  res.end('<h1>Test login</h1><form action="/login" method="post"><input name="username" aria-label="Username"><input name="password" aria-label="Password" type="password"><input name="csrf" value="csrf%2Ftoken" type="hidden"><button>Sign in</button></form>');
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
