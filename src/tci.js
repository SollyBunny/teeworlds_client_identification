import { mapKeyDiff, stripAddress, uniqueString } from "./util.js";

import { MASTERSRVS } from "./config.js";

export async function fetchMasterServersDefault() {
	async function fetchMasterServer(url) {
		const response = await fetch(url);
		const json = await response.json();
		return json;
	}
	return await Promise.all(MASTERSRVS.map(url => fetchMasterServer(url)));
}

export function processMasterServers(serverss) {
	const out = new Map();
	for (const { servers } of serverss)
		for (const server of servers)
			for (const address of server.addresses)
				out.set(stripAddress(address), server);
	return out;
}

export class TCIClient {
	constructor(tci, server, name, data) {
		this.tci = tci;
		this.server = server;
		this.token = uniqueString(this.tci.clients);
		this.name = name;
		this.updates = new Set(); // TCIClient
		this.deleted = false;
		this.server.clients.add(this);
		this.tci.clients.set(this.token, this);
		this.update(data);
	}
	delete() {
		if (this.deleted)
			return;
		this.deleted = true;
		if (this.server.deleted)
			return;
		if (!this.server.clients.has(this))
			return;
		this.server.clients.delete(this);
		this.tci.clients.delete(this.token);
		for (const client of this.server.clients)
			client.updates.add(this);
	}
	update(data) {
		if (this.deleted)
			return;
		if (!data) {
			this.delete();
			return;
		}
		this.data = data;
		for (const client of this.server.clients) {
			if (client === this)
				continue;
			client.updates.add(this);
		}
	}
	serialize() {
		return { name: this.name, data: this.deleted ? undefined : this.data };
	}
	serializeUpdates() {
		const out = [];
		for (const client of this.updates)
			out.push(client.serialize());
		this.updates.clear();
		return out;
	}
}

export class TCIServer {
	constructor(tci, addresses, names) {
		this.tci = tci;
		let thisNew = undefined;
		if (!Array.isArray(addresses))
			addresses = [addresses];
		// prevent duplicate server objects for same server with different addresses
		this.addresses = new Set(addresses.map(address => stripAddress(address)));
		for (const address of this.addresses) {
			thisNew = this.tci.servers.get(address);
			if (thisNew)
				break;
		}
		if (thisNew) {
			for (const address of this.addresses)
				this.tci.servers.set(address, thisNew);
			return thisNew;
		} else {
			for (const address of this.addresses)
				this.tci.servers.set(address, this);
		}
		this.clients = new Set();
		this.names = names;
		this.deleted = false;
	}
	delete() {
		if (this.deleted)
			return;
		this.deleted = true;
		for (const client of this.clients)
			client.delete();
		for (const address of this.addresses)
			this.tci.servers.delete(address);
		this.clients.clear();
		this.names.clear();
	}
	serializeClients(except) {
		const out = [];
		for (const client of this.clients)
			if (client !== except)
				out.push(client.serialize());
		return out;
	}
}

export class TCI {
	constructor(fetchMasterServers = fetchMasterServersDefault) {
		this.clients = new Map(); // token -> TCIClient
		this.servers = new Map(); // ip -> TCIServer
		this.fetchMasterServers = fetchMasterServers;
		this.updateWaiting = [];
		this.updateAutoStart();
	}
	async update() {
		const now = performance.now();
		if (this.lastUpdated && now - this.lastUpdated < 3 * 1000)
			return;
		if (this.updatingNow)
			return;
		this.updatingNow = true;
		this.lastUpdated = now;
		try {
			const servers = processMasterServers(await this.fetchMasterServers());
			const diff = mapKeyDiff(this.servers, servers);
			for (const deletedKey of diff.onlyA)
				this.servers.get(deletedKey).delete();
			for (const addedKey of diff.onlyB) {
				const names = new Set(servers.get(addedKey).info.clients.map(client => client.name));
				new TCIServer(this, servers.get(addedKey).addresses, names);
			}
			for (const sameKey of diff.both) {
				const names = new Set(servers.get(sameKey).info.clients.map(client => client.name));
				const server = this.servers.get(sameKey);
				for (const client of server.clients) {
					if (!names.has(client.name))
						client.delete();
				}
				server.names = names;
			}
		} finally {
			this.updatingNow = false;
			this.updateWaiting.forEach(resolve => resolve());
			this.updateWaiting = [];
		}
	}
	updateFinish() {
		return new Promise(resolve => this.updateWaiting.push(resolve));
	}
	updateAutoStart() {
		this.updateAutoStop();
		this.update();
		this.updateAutoInterval = setInterval(this.update.bind(this), 1 * 1000);
	}
	updateAutoStop() {
		if (this.updateAutoInterval === undefined)
			return;
		clearInterval(this.updateAutoInterval);
		this.updateAutoInterval = undefined;
	}
}

