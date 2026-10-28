import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { setDefaultResultOrder } from "node:dns";
import { networkDiagnostics } from "./diagnostics.js";
import { hostname } from "node:os";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import { scramjetPath as originalScramjetPath } from "@mercuryworkshop/scramjet/path";
const libcurlPath = dirname(require.resolve("@mercuryworkshop/libcurl-transport"));
const controllerPath = fileURLToPath(new URL(".", import.meta.resolve("@mercuryworkshop/scramjet-controller")));

const scramjetPath = originalScramjetPath;
const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

// Wisp Configuration: Refer to the documentation at https://www.npmjs.com/package/@mercuryworkshop/wisp-js

logging.set_level(logging.ERROR);
setDefaultResultOrder("ipv4first");
Object.assign(wisp.options, {
	allow_udp_streams: false,
	hostname_blacklist: [/example\.com/],
	dns_method: "lookup",
    dns_result_order: "ipv4first",
    // wisp-js 0.4.1 measures this option in milliseconds.
    dns_ttl: 30000,
});

const fastify = Fastify({
    logger: { level: "error" },
    disableRequestLogging: true,
	serverFactory: (handler) => {
		return createServer()
			.on("request", (req, res) => {
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				socket.on("error", () => console.error("Wisp socket error"));
                if (req.url?.split("?", 1)[0] === "/wisp/") {
                    Promise.resolve().then(() => wisp.routeRequest(req, socket, head)).catch(() => {
                        console.error("Wisp upgrade failed"); socket.destroy();
                    });
                } else socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
			});
	},
});

fastify.register(fastifyStatic, {
	root: publicPath,
	decorateReply: true,
});

fastify.register(fastifyStatic, {
	root: scramjetPath,
	prefix: "/scram/",
	decorateReply: false,
});

fastify.register(fastifyStatic, {
	root: libcurlPath,
	prefix: "/libcurl/",
	decorateReply: false,
});

fastify.register(fastifyStatic, {
	root: controllerPath,
	prefix: "/controller/",
	decorateReply: false,
});

const checkNetwork = networkDiagnostics();
const requiredAssets = [
    [scramjetPath, 'scramjet.js'], [scramjetPath, 'scramjet.wasm'],
    [libcurlPath, 'index.mjs'], [controllerPath, 'controller.api.js'],
    [controllerPath, 'controller.sw.js'], [controllerPath, 'controller.inject.js']
];
fastify.get('/health/ready', async (_request, reply) => {
    const missing = requiredAssets.filter(([root, file]) => !existsSync(join(root, file))).map(([, file]) => file);
    reply.header('Cache-Control', 'no-store');
    return reply.code(missing.length ? 503 : 200).send({ status: missing.length ? 'not-ready' : 'ready', engine: '2.0.67-alpha.2', controller: '0.0.14', missing });
});
fastify.get('/health/network', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return checkNetwork();
});
fastify.setErrorHandler((error, request, reply) => {
    const status = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    // Do not log headers, cookies, request bodies, or browsing URLs.
    request.log.error({ requestId: request.id, status, code: error.code || 'SERVER_ERROR' }, 'Server request failed');
    reply.code(status).send({ error: status >= 500 ? 'Server request failed' : 'Invalid request', requestId: request.id });
});

fastify.setNotFoundHandler((res, reply) => {
	return reply.code(404).type("text/html").sendFile("404.html");
});

fastify.server.on("listening", () => {
	const address = fastify.server.address();

	// by default we are listening on 0.0.0.0 (every interface)
	// we just need to list a few
	console.log("Listening on:");
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	console.log(
		`\thttp://${
			address.family === "IPv6" ? `[${address.address}]` : address.address
		}:${address.port}`
	);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function shutdown() {
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    try { await fastify.close(); process.exit(0); }
    catch { process.exit(1); }
}

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 8080;

await fastify.listen({
	port: port,
	host: process.env.BIND_HOST || "0.0.0.0",
});
