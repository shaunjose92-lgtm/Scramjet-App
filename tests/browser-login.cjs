// Optional full-browser regression: requires Playwright and Chromium.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const child = spawn(process.execPath, ['tests/fixtures/login-server.mjs'], {
    cwd: root, env: { ...process.env, BIND_HOST: '127.0.0.1', PORT: '18190' }
  });
  let browser, page;
  let serverOutput = '';
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Fixture startup timed out')), 15000);
      child.stdout.on('data', data => {
        if (data.toString().includes('FIXTURE_READY')) { clearTimeout(timer); resolve(); }
      });
      child.stderr.on('data', data => { serverOutput = (serverOutput + data).slice(-4000); });
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('exit', code => { clearTimeout(timer); reject(Error('Fixture exited: ' + code)); });
    });
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CIPHER_TEST_CHROMIUM || undefined,
      args: JSON.parse(process.env.CIPHER_TEST_CHROMIUM_ARGS || '[]')
    });
    page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    if (process.env.CIPHER_TEST_DEBUG) {
      page.on('console', message => console.log('BROWSER:', message.type(), message.text()));
      page.on('requestfailed', request => console.log('FAILED:', request.url(), request.failure()));
    }
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function open(url) {
      await page.goto('http://127.0.0.1:18190/');
      await page.locator('#sj-address').fill(url);
      await page.locator('#sj-form').evaluate(form => form.requestSubmit());
    }
    await open('http://login.fixture.test:18191/');
    const frame = page.frameLocator('#sj-frame');
    await frame.getByLabel('Username').fill('cipher-test');
    await frame.getByLabel('Password').fill('fixture+only&=/%✓');
    await frame.getByRole('button', { name: 'Sign in', exact: true }).click({ timeout: 10000 });
    await frame.getByRole('heading', { name: 'Signed in', exact: true }).waitFor({ timeout: 10000 });
    console.log('PASS: server-validated credentials, CSRF cookie and token, redirect, and encoded session token');

    const inner = page.frames().find(frame => frame.url().includes('/scramjet/'));
    const cookies = await inner.evaluate(async () => { await fetch('/api'); return document.cookie; });
    assert.ok(cookies.includes('api=value%2Fraw'));
    assert.ok(cookies.includes('notice=hello%20world'));
    assert.ok(!cookies.includes('session='));
    console.log('PASS: response cookie synchronization and document.cookie HttpOnly filtering');
    const echo = await inner.evaluate(async () => {
      const body = JSON.stringify({ password: 'fixture+only&=/%✓' });
      return (await fetch('/echo', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf%2Ftoken' }, body })).json();
    });
    assert.equal(echo.body, JSON.stringify({ password: 'fixture+only&=/%✓' }));
    assert.equal(echo.csrf, 'csrf%2Ftoken');
    assert.equal(echo.contentType, 'application/json');
    assert.equal(echo.origin, 'http://login.fixture.test:18191');
    console.log('PASS: fetch POST preserves credential body, CSRF header and target Origin');

    const popupPromise = page.waitForEvent('popup');
    await frame.getByRole('link', { name: 'Open account tab' }).click();
    const popup = await popupPromise;
    await popup.frameLocator('#sj-frame').getByRole('heading', { name: 'Signed in', exact: true }).waitFor({ timeout: 15000 });
    assert.ok(popup.url().includes('/?go='));
    await popup.close();
    console.log('PASS: new-tab navigation gets a controller and retains the signed-in session');

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('ServiceWorker.enable');
    await cdp.send('ServiceWorker.stopAllWorkers');
    await open('http://login.fixture.test:18191/dashboard');
    await frame.getByRole('heading', { name: 'Signed in', exact: true }).waitFor({ timeout: 10000 });
    console.log('PASS: session survives a real worker stop and restart');

    await frame.getByRole('link', { name: 'Log out' }).click();
    await frame.getByRole('heading', { name: 'Signed out', exact: true }).waitFor({ timeout: 10000 });
    assert.deepEqual(errors, []);
    console.log('PASS: logout clears the session; no page JavaScript exceptions');

    // Exercise the real message bridge inside a cross-origin Cipher parent.
    // Fulfilled locally: this does not visit or modify the production Cipher app.
    await page.route('https://cipher-message.edgeone.dev/cipher-test', route => route.fulfill({
      contentType: 'text/html',
      body: '<script>window.states=[];addEventListener("message",e=>{if(e.origin==="http://127.0.0.1:18190"&&e.data.cipherBridge)states.push(e.data)});</script><iframe id="browser" src="http://127.0.0.1:18190/?go=http%3A%2F%2Flogin.fixture.test%3A18191%2F"></iframe>'
    }));
    await page.goto('https://cipher-message.edgeone.dev/cipher-test');
    const embedded = page.frameLocator('#browser').frameLocator('#sj-frame');
    await embedded.getByRole('heading', { name: 'Test login', exact: true }).waitFor();
    await page.waitForFunction(() => states.at(-1)?.url === 'http://login.fixture.test:18191/' && !states.at(-1).loading);
    const site = page.frames().find(f => f.url().includes('/scramjet/'));
    await site.evaluate(() => history.pushState(7, '', '/step-two'));
    await page.waitForFunction(() => states.at(-1)?.url.endsWith('/step-two'));
    assert.equal(await site.evaluate(() => history.state), 7);
    await page.evaluate(() => document.querySelector('#browser').contentWindow.postMessage({ cipherNav: 'back' }, 'http://127.0.0.1:18190'));
    await page.waitForFunction(() => states.at(-1)?.url === 'http://login.fixture.test:18191/' && states.at(-1).canGoForward);
    await page.evaluate(() => document.querySelector('#browser').contentWindow.postMessage({ cipherNav: 'forward' }, 'http://127.0.0.1:18190'));
    await page.waitForFunction(() => states.at(-1)?.url.endsWith('/step-two') && !states.at(-1).canGoForward);
    console.log('PASS: embedded Cipher navigation bridge, SPA history state, back and forward');
  } catch (error) {
    if (page) console.error('Browser state:', await page.locator('body').innerText(), page.frames().map(f => f.url()));
    if (serverOutput) console.error(serverOutput);
    throw error;
  } finally {
    await browser?.close();
    child.kill('SIGTERM');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
