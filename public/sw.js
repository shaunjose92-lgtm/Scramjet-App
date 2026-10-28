importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

async function handleRequest(event) {
	await scramjet.loadConfig();
	if (scramjet.config && scramjet.route(event)) {
		const response = await scramjet.fetch(event);
		// A service worker can report crossOriginIsolated=false even when its
		// controlled page requires COEP. Match the headers on our outer page.
		if (["document", "iframe", "worker", "sharedworker", "style", "script"].includes(event.request.destination)) {
			const headers = new Headers(response.headers);
			headers.set("Cross-Origin-Embedder-Policy", "require-corp");
			headers.set("Cross-Origin-Opener-Policy", "same-origin");
			return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
		}
		return response;
	}
	return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});

self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
