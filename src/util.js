
export function stripAddress(address) {
	const index = address.indexOf("://");
	if (index === -1)
		return address;
	return address.slice(index + 3);
}

export function mapKeyDiff(a, b) {
	const out = {
		onlyA: [],
		onlyB: [],
		both: []
	};
	for (const key of a.keys())
		if (b.has(key))
			out.both.push(key);
		else
			out.onlyA.push(key);
	for (const key of b.keys())
		if (!a.has(key))
			out.onlyB.push(key);
	return out;
}

export function unreachable(what) {
	if (what)
		throw new Error(`Reached unreachable code: ${what}`);
	throw new Error("Reached unreachable code");
}

export function randomString(length = 64) {
	let out = "";
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	for (let i = 0; i < length; ++i)
		out += chars[Math.floor(Math.random() * chars.length)];
	return out;
}

export function uniqueString(strings, length = 64) {
	for (let _ = 0; _ < 100; ++_) {
		const out = randomString(length);
		if (!strings.has(out))
			return out;
	}
	unreachable();
}