import express from "express";

import { TCIClient } from "./tci.js";
import { unreachable, stripAddress } from "./util.js";

export async function apiInit(tci,{ address, name, data }) {
	if (!address)
		return { code: 400, body: "Missing address" };
	if (!name && data)
		return { code: 400, body: "Data present but data is not" };
	await tci.update();
	const server = tci.servers.get(stripAddress(address));
	if (!server)
		return { code: 404, body: "Server not found" };
	if (!name && !data)
		return { body: { clients: server.serializeClients()} };
	if (name && !data) {
		if (!server.names.has(name)) // faster check using full name list
			return { code: 404, body: "Name not found" };
		for (const client of server.clients)
			if (client.name === name)
				return { body: { clients: [client.serialize()] } };
		return { code: 404, body: "Name not found" };
	}
	if (name && data) {
		if (!(data instanceof Object))
			return { code: 400, body: "Data is not an object" };
		if (!data.iden)
			return { code: 400, body: "Data is missing iden" };
		if (!server.names.has(name))
			return { code: 404, body: "Name not found" };
		for (const client of server.clients)
			if (client.name === name)
				return { code: 409, body: "Name already registered" };
		const client = new TCIClient(tci, server, name, data);
		return { body: { token: client.token, clients: server.serializeClients(client) } };
	}
	unreachable();
}

export function apiUpdates(tci, { token }) {
	if (!token)
		return { code: 401, body: "Missing token" };
	const client = tci.clients.get(token);
	if (!client)
		return { code: 403, body: "Invalid token" };
	return { body: { clients: client.serializeUpdates() } };
}

export function apiSet(tci, { token, data }) {
	if (!token)
		return { code: 401, body: "Missing token" };
	const client = tci.clients.get(token);
	if (!client)
		return { code: 403, body: "Invalid token" };
	if (data !== undefined) {
		if (!(data instanceof Object))
			return { code: 400, body: "Data is not an object" };
		if (!data.iden)
			return { code: 400, body: "Data is missing iden" };
	}
	client.update(data); // maybe undefined
}

export function createServer(port, obj, endpoints = [
	["/api/init", apiInit],
	["/api/updates", apiUpdates],
	["/api/set", apiSet],
]) { return new Promise(resolve => {
	const app = express();
	app.use(express.json({
		limit: "3KiB",
		strict: true,
	}));
	for (const [url, func] of endpoints)
		app.post(url, (req, res) => {
			if (!(req.body instanceof Object))
				return res.status(400).send("Body is not an object").end();
			if (req.headers.authorization)
				req.body.token = req.headers.authorization.slice(req.headers.authorization.indexOf(" ") + 1);
			const out = func(obj, req.body);
			if (!out)
				return res.end();
			const { code, body } = out;
			if (code === 401)
				res.setHeader("WWW-Authenticate", "Bearer");
			res.status(code ?? 200);
			if (body instanceof Object)
				res.json(body);
			else
				res.send(body);
			res.end();
		});
	app.listen(port, () => resolve(app));
}); }
