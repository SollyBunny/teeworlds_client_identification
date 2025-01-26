#!/bin/env node

import fs from "fs/promises";

import { TCI } from "../src/tci.js";

import { apiInit, apiUpdates, apiSet } from "../src/server.js";

const data = JSON.parse(await fs.readFile("./test/data.json"));

const tci = new TCI(() => [data]);
tci.updateAutoStop();
await tci.updateFinish();

async function test(fnc) {
	let str = fnc.toString();
	if (str.startsWith("async "))
		str = str.slice(6);
	if (str.startsWith("() => "))
		str = str.slice(6);
	let out;
	try {
		out = await fnc();
	} catch (error) {
		console.log(`Errored: ${str}`);
		throw error;
	}
	if (out !== true || out === undefined) {
		console.log(`Failed: ${str}`);
		console.log(out);
		process.exit(1);
	}
	console.log(`Passed: ${str}`);
}

let name, token, clients, client, code, iden;

console.log("Testing setup");
await test(() => tci.servers.size === 103);
const address = "1.13.79.127:8304";
const server = tci.servers.get(address);
await test(() => server.names.size === 26);
await test(() => server.clients.size === 0);

console.log("Testing apiInit");
name = "peanut";
await test(async () => !!({ body: { token, clients } } = await apiInit(tci, { address, name, data: { iden: "TClient" } })));
await test(() => !!token);
await test(() => clients.length === 0);
await test(async () => !!({ code } = await apiInit(tci, { address, name, data: { iden: "TClient" } })));
await test(() => code === 409);
await test(async () => !!({ code } = await apiInit(tci, { address, name: "NOTVALID", data: { iden: "TClient" } })));
await test(() => code === 404);
await test(async () => !!({ code } = await apiInit(tci, { address: "NOTVALID", name, data: { iden: "TClient" } })));
await test(() => code === 404);
await test(async () => !!({ code } = await apiInit(tci, { address, name, data: {} })));
await test(() => code === 400);
await test(async () => !!({ code } = await apiInit(tci, { address, data: {} })));
await test(() => code === 400);
await test(async () => !!({ code } = await apiInit(tci, { address, data: "NOTVALID" })));
await test(() => code === 400);
await test(async () => !!({ body: { clients: [client] } } = await apiInit(tci, { address })));
await test(() => !!client);
await test(async () => !!({ body: { clients: [client] } } = await apiInit(tci, { address, name })));
await test(() => !!client);
await test(() => client.data.iden === "TClient");
name = "peanut2";
await test(async () => !!({ body: { token, clients } } = await apiInit(tci, { address, name, data: { iden: "TClient" } })));
await test(() => !!token);
await test(() => clients.length === 1);
await test(async () => !!({ body: { clients } } = await apiInit(tci, { address })));
await test(() => clients.length === 2);

console.log("Testing apiSet");
await test(() => !!({ code } = apiSet(tci, { token: "NOTVALID", data: { iden: "TClient" } })));
await test(() => code === 403);
await test(() => !!({ code } = apiSet(tci, { data: { iden: "TClient" } })));
await test(() => code === 401);
await test(() => !!({ code } = apiSet(tci, { token, data: {} })));
await test(() => code === 400);
await test(() => !!({ code } = apiSet(tci, { token, data: "NOTVALID" })));
await test(() => code === 400);
await test(() => undefined === apiSet(tci, { token, data: { iden: "New" } }));
await test(async () => !!({ body: { clients: [{ data: { iden }}] } } = await apiInit(tci, { address, name })));
await test(() => iden === "New");
await test(() => undefined === apiSet(tci, { token }));
await test(() => !!({ code } = apiSet(tci, { token, data: { iden: "New" } })));
await test(() => code === 403);
await test(async () => !!({ body: { clients } } = await apiInit(tci, { address })));
await test(() => clients.length === 1);

console.log("Testing apiUpdate");
await test(() => !!({ body: { clients } } = apiUpdates(tci, { token })));
await test(() => code === 403);
await test(async () => !!({ body: { token, clients } } = await apiInit(tci, { address, name, data: { iden: "TClient" } })));
await test(() => !!token);
await test(() => clients.length === 1);
await test(() => !!({ code } = apiUpdates(tci, { token: "NOTVALID" })));
await test(() => code === 403);
await test(() => !!({ code } = apiUpdates(tci, {})));
await test(() => code === 401);
await test(() => !!({ body: { clients } } = apiUpdates(tci, { token })));
await test(() => clients.length === 0);
name = "CHENXIXIXIXI";
await test(async () => !!({ body: { clients } } = await apiInit(tci, { address, name, data: { iden: "TClient" } })));
await test(() => clients.length === 2);
await test(() => !!({ body: { clients } } = apiUpdates(tci, { token })));
await test(() => clients.length === 1);

console.log("All tests passed");
