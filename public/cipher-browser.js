
/* Cipher navigation bridge for the Scramjet v2 API served by this repository. */
(() => {
  'use strict';
  const form = document.getElementById('sj-form');
  const address = document.getElementById('sj-address');
  const searchEngine = document.getElementById('sj-search-engine');
  const error = document.getElementById('sj-error');
  const errorCode = document.getElementById('sj-error-code');
  const allowedParent = 'https://cipher-message.edgeone.dev';
  const parentOrigin = window.parent !== window ? allowedParent : null;
  let scramjet, ready, frame = null, activeClient = null;
  let entries = [''], index = 0, historyLength = 0;
  let pending = null, loading = false, timeout = null, request = 0;
  let home = true;
  const hookedDocuments = new WeakSet();

  function publish() {
    if (parentOrigin) window.parent.postMessage({
      cipherBridge: 1, url: home ? '' : entries[index],
      canGoBack: index > 0, canGoForward: index < entries.length - 1,
      loading
    }, parentOrigin);
  }
  function clearBusy() {
    document.getElementById('cp-status').textContent = '';
    document.querySelectorAll('.busy').forEach(b => b.classList.remove('busy'));
  }
  function finish() {
    clearTimeout(timeout); timeout = null; loading = false; pending = null;
    clearBusy(); publish();
  }
  function start() {
    clearTimeout(timeout); loading = true; publish();
    timeout = setTimeout(finish, 30000);
  }
  function fail(err) {
    error.textContent = 'Unable to open this page.';
    errorCode.textContent = String(err && err.message || err);
    document.documentElement.classList.remove('cp-go');
    if (frame) frame.element.hidden = true;
    home = true; index = 0;
    finish();
  }
  function currentUrl() {
    try { return activeClient.url.href; } catch (_) { return entries[index] || ''; }
  }
  function length() {
    try { return frame.element.contentWindow.history.length; } catch (_) { return historyLength; }
  }
  function showHome() {
    home = true; index = 0;
    if (frame) frame.element.hidden = true;
    document.documentElement.classList.remove('cp-go');
    finish();
  }
  function showPage() {
    home = false; frame.element.hidden = false;
    document.documentElement.classList.add('cp-go');
  }
  function remember(url, kind) {
    if (!url || url === 'about:blank') return;
    const stayHome = home && index === 0 && entries.length > 1 && !pending;
    if (stayHome) index = 1;
    const count = length();
    if (pending && pending.target !== undefined) {
      index = pending.target;
      entries[index] = url;
      pending = null;
    } else if (kind === 'traverse') {
      // Browser gestures and a site's own history.back()/forward().
      const candidates = entries.map((u, i) => u === url && i > 0 ? i : -1).filter(i => i >= 0);
      candidates.sort((a, b) => Math.abs(a - index) - Math.abs(b - index));
      if (candidates.length) index = candidates[0];
      else entries[index] = url;
    } else if (kind === 'push' || (pending && pending.push) || index === 0 ||
        (kind === 'document' && (count > historyLength || index < entries.length - 1))) {
      entries.splice(index + 1);
      entries.push(url); index = entries.length - 1;
    } else {
      entries[index] = url;
    }
    pending = null;
    historyLength = count;
    if (stayHome) { index = 0; publish(); }
    else { showPage(); publish(); }
  }
  function attachContext(event) {
    if (!event.isTopLevel) return;
    activeClient = event.client;
    const w = event.window;
    let doc;
    try { doc = w.document; } catch (_) { return; }
    if (hookedDocuments.has(doc)) return;
    hookedDocuments.add(doc);
    let kind = 'document';
    try {
      const nav = w.performance.getEntriesByType('navigation')[0];
      if (nav && nav.type === 'back_forward') kind = 'traverse';
      else if (nav && nav.type === 'reload') kind = 'replace';
    } catch (_) {}
    remember(event.client.url.href, kind);
    // Preserve the site's original history.state, including primitive values.
    for (const method of ['pushState', 'replaceState']) {
      const original = w.history[method];
      w.history[method] = function (...args) {
        const result = Reflect.apply(original, this, args);
        remember(currentUrl(), method === 'pushState' ? 'push' : 'replace');
        finish();
        return result;
      };
    }
    w.addEventListener('popstate', () => { remember(currentUrl(), 'traverse'); finish(); });
    w.addEventListener('hashchange', () => {
      const url = currentUrl();
      if (url !== entries[index]) remember(url, length() > historyLength ? 'push' : 'traverse');
      finish();
    });
    w.addEventListener('pageshow', e => {
      if (e.persisted) { remember(currentUrl(), 'traverse'); finish(); }
    });
    w.addEventListener('pagehide', () => { if (!home) start(); });
  }
  function createFrame() {
    if (frame) return frame;
    frame = scramjet.createFrame();
    frame.element.id = 'sj-frame';
    frame.element.title = 'Cipher Browser page';
    $scramjet.Tap.tap(frame.hooks.init.post, attachContext);
    // Match upstream's escaped-link handling: a new tab needs its own controller.
    $scramjet.Tap.tap(frame.hooks.fetch.intercept, (context, props) => {
      if (context.parsed.destination !== 'document' || context.request.method !== 'GET') return;
      const target = new URL('/', location.origin);
      target.searchParams.set('go', context.parsed.url.href);
      props.response = {
        body: '', status: 302, statusText: 'Found',
        headers: $scramjet.ScramjetHeaders.fromRawHeaders([['Location', target.href]])
      };
    });
    frame.element.addEventListener('load', () => {
      if (home) return;
      // Context events normally commit first; load also covers proxy error pages.
      finish();
    });
    document.body.appendChild(frame.element);
    return frame;
  }
  async function submit(event) {
    event.preventDefault();
    const id = ++request;
    const value = address.value;
    error.textContent = ''; errorCode.textContent = '';
    start();
    try {
      if (!ready) {
        ready = (async () => {
          await registerSW();
          const { default: LibcurlClient } = await import('/libcurl/index.mjs');
          const wisp = (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host + '/wisp/';
          const transport = new LibcurlClient({ wisp });
          await transport.init();
          scramjet = new $scramjetController.Controller({
            serviceworker: navigator.serviceWorker.controller,
            transport,
            config: { prefix: '/scramjet/', scramjetPath: '/scram/scramjet.js', wasmPath: '/scram/scramjet.wasm' }
          });
          await scramjet.wait();
        })().catch(err => { ready = null; throw err; });
      }
      await ready;
      if (id !== request) return;
      const url = search(value, searchEngine.value);
      createFrame();
      pending = { push: true };
      showPage();
      frame.go(url);
    } catch (err) { if (id === request) fail(err); }
  }
  function command(cmd) {
    if (pending) { publish(); return; }
    if (cmd === 'back' && index > 0) {
      if (index === 1) { showHome(); return; }
      pending = { target: index - 1 }; start();
      try { frame.back(); } catch (err) { finish(); }
    } else if (cmd === 'forward' && index < entries.length - 1) {
      if (home) { index = 1; showPage(); finish(); return; }
      pending = { target: index + 1 }; start();
      try { frame.forward(); } catch (err) { finish(); }
    } else if (cmd === 'reload') {
      if (home || !frame) { finish(); return; }
      pending = { target: index }; start();
      try { frame.reload(); } catch (err) { finish(); }
    } else publish();
  }
  form.addEventListener('submit', submit);
  window.addEventListener('message', event => {
    if (!parentOrigin || event.origin !== parentOrigin || event.source !== window.parent) return;
    const d = event.data;
    if (!d || typeof d !== 'object') return;
    if (d.cipherPing) publish();
    else if (['back', 'forward', 'reload'].includes(d.cipherNav)) command(d.cipherNav);
  });
  window.addEventListener('pagehide', () => { clearTimeout(timeout); timeout = null; });
  window.addEventListener('pageshow', publish);
  publish();
})();

