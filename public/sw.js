importScripts('/controller/controller.sw.js');

async function route(event) {
  const response = await $scramjetController.route(event);
  // The outer browser requires isolation even when the SW reports otherwise.
  if (['document', 'iframe', 'worker', 'sharedworker', 'script', 'style'].includes(event.request.destination)) {
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  return response;
}
self.addEventListener('fetch', event => {
  if ($scramjetController.shouldRoute(event)) event.respondWith(route(event));
});
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
