"use strict";
const stockSW = '/sw.js';
async function registerSW() {
  if (!navigator.serviceWorker) throw new Error('This browser needs HTTPS and service-worker support.');
  const registration = await navigator.serviceWorker.register(stockSW, { updateViaCache: 'none' });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error('Browser setup timed out. Reload and try again.')), 15000);
    const worker = registration.installing || registration.waiting || registration.active;
    function done(error) {
      clearTimeout(timer);
      worker?.removeEventListener('statechange', check);
      navigator.serviceWorker.removeEventListener('controllerchange', check);
      error ? reject(error) : resolve();
    }
    function check() {
      if (navigator.serviceWorker.controller && registration.active?.state === 'activated') done();
      else if (worker?.state === 'redundant' && !registration.active) done(new Error('Browser setup failed. Please reload.'));
    }
    worker?.addEventListener('statechange', check);
    navigator.serviceWorker.addEventListener('controllerchange', check);
    check();
  });
  return registration;
}
