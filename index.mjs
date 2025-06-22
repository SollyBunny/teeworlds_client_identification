#!/bin/env node

import HTTP from "http";

const PORT = 8080;
const MAX_REQUESTS_PER_60S = 60;
const MAX_REQUESTS_PER_5S = 5;
const MAX_BODY_SIZE = 4096;
const CLIENT_TIMEOUT = 10_000;
const MASTER_URL = "https://master4.ddnet.org/ddnet/15/servers.json";
const UPDATE_INTERVAL = 3_000;

const servers = new Map();

async function updateMasterServer() {
	let data
	try {
		data = await fetch(MASTER_URL).then(r => r.json());
	} catch (e) {
		// Probably 429
		setTimeout(updateMasterServer, UPDATE_INTERVAL * 3);
		return;
	}
	const now = performance.now();
	// Add new servers
	for (let { addresses, info: { clients } } of data.servers) {
		// Don't update empty servers
		if (clients.length === 0)
			continue;
		// Strip type
		addresses = new Set(addresses.map(address => {
			const i = address.indexOf("://");
			return i === -1 ? address : address.slice(i + 3);
		}));
		let server = {};
		// Get already populated server
		for(const address of addresses) {
			if (servers.get(address)) {
				server = servers.get(address);
				break;
			}
		}
		// Set new addresses
		for(const address of addresses)
			servers.set(address, server);
		// If not empty update server
		server.lastUpdated = now;
		// Add new clients
		if(!server.clients)
			server.clients = new Map();
		for (const { flag, name } of clients) {
			let client = server.clients.get(name);
			if (!client) {
				client = {};
				client.lastAcked = -Infinity;
				server.clients.set(name, client);
			}
			client.flag = flag;
			client.lastUpdated = now;
		}
		// Remove old clients
		for (const [name, { lastUpdated }] of server.clients.entries()) {
			if (lastUpdated < now)
				server.clients.delete(name);
		}
		// Unauth unacked clients
		for (const client of server.clients.values()) {
			if (client.lastAcked + CLIENT_TIMEOUT && client.authed)
				client.authed === false;
		}
	}
	// Delete old servers
	for (const [ address, server ] of servers.entries()) {
		if (server.lastUpdated < now)
			servers.delete(address);
	}
	console.log(servers);
	// Do it again
	setTimeout(updateMasterServer, UPDATE_INTERVAL);
}
updateMasterServer();

const reqs5s = new Map();
setInterval(() => reqs5s.clear(), 5_000);
const reqs60s = new Map();
setInterval(() => reqs60s.clear(), 60_000);

function API(body) {
	const { address, name, data } = body;
	if (!address)
		return { error: "Missing address" };
	if (!name)
		return { error: "Missing name" };
	if (!data)
		return { error: "Missing data" };
	if (!data?.iden)
		return { error: "Missing identification" };
	if (!data?.ver)
		return { error: "Missing version" };
	const server = servers.get(address);
	if (!address)
		return { error: "Invalid server" };
	const client = server.clients.get(name);
	if (!client)
		return { error: "Invalid name" };
	const out = {};
	// Flag check
	if (!client.authFlag)
		client.authFlag = Math.floor(Math.random() * (2 ** 31 - 1000)) + 1000;
	out.authFlag = client.authFlag;
	if (client.flag === client.authFlag)
		client.authed = true;
	if (client.authed) {
		client.lastAuthed = performance.now();
		client.data = data;
	}
	// Generate serverData
	out.data = Object.fromEntries(server.clients.entries()
		.filter(([_, { authed }]) => authed)
		.map(([name, client]) => [name, client.data])
	);
	return out;
}

const server = HTTP.createServer((req, res) => {
	// Get IP (probably behind cloudflare, so trust x-forwarded-for)
	const xForwardedFor = req.headers["x-forwarded-for"];
	const ip = xForwardedFor 
		? xForwardedFor.slice(0, xForwardedFor.indexOf(',')) || xForwardedFor.trim()
		: req.socket.remoteAddress;
	// Do rate limiting
	const req5s = reqs5s.get(ip) ?? 0;
	const req60s = reqs60s.get(ip) ?? 0;
	if (req5s > MAX_REQUESTS_PER_5S || req60s > MAX_REQUESTS_PER_60S) {
		res.writeHead(429, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: "Too many requests" }));
		res.destroy();
		return;
	}
	reqs5s.set(ip, req5s + 1);
	reqs60s.set(ip, req60s + 1);
	// Paths
	if (req.url === "/api") {
		let body = "";
		let bodySize = 0;
		req.on("data", chunk => {
			bodySize += chunk.length;
			if (bodySize > MAX_BODY_SIZE) {
				res.writeHead(413, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "Request body too large" }));
				req.destroy();
			} else {
				body += chunk;
			}
		});
		req.on("end", () => {
			let parsed;
			try {
				parsed = JSON.parse(body);
			} catch (e) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "Request is not valid JSON" }));
				req.destroy();
				return;
			}
			if (typeof(parsed) !== "object" || !parsed) {
				res.writeHead(400, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "JSON does not have a root object" }));
				req.destroy();
				return;
			}
			const out = API(parsed);
			res.writeHead(out.error ? 400 : 200, { "Content-Type": "application/json" });
			res.end(JSON.stringify(out));
			req.destroy();
		});
		return;
	}
	// 404
	res.writeHead(404, { "Content-Type": "text/html" });
	res.end("<h1>Not found</h1>");
});

server.headersTimeout = 500;
server.requestTimeout = 500;

server.listen(PORT, () => {
	console.log(`Server running at ${PORT}`);
});
