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
  let browser;
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
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function open(url) {
      await page.goto('http://127.0.0.1:18190/');
      await page.locator('#sj-address').fill(url);
      await page.locator('#sj-form').evaluate(form => form.requestSubmit());
    }
    await open('http://login.fixture.test:18191/');
    const frame = page.frameLocator('#sj-frame');
    await frame.getByRole('button', { name: 'Sign in', exact: true }).click({ timeout: 10000 });
    await frame.getByRole('heading', { name: 'Signed in', exact: true }).waitFor({ timeout: 10000 });
    console.log('PASS: actual proxied form login, redirect, and encoded session token');

    const inner = page.frames().find(frame => frame.url().includes('/scramjet/'));
    const cookies = await inner.evaluate(async () => { await fetch('/api'); return document.cookie; });
    assert.ok(cookies.includes('api=value%2Fraw'));
    assert.ok(cookies.includes('notice=hello%20world'));
    assert.ok(!cookies.includes('session='));
    console.log('PASS: response cookie synchronization and document.cookie HttpOnly filtering');

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
  } catch (error) {
    if (serverOutput) console.error(serverOutput);
    throw error;
  } finally {
    await browser?.close();
    child.kill('SIGTERM');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
