import crypto from "node:crypto";
import { cookies } from "next/headers";
import { type User, readState } from "./store";

const COOKIE = "__Host-wdcc_session";

function secret() {
	const value = process.env.SESSION_SECRET || "";
	if (value.length < 32) throw Error("SESSION_SECRET_NOT_CONFIGURED");
	return value;
}
function sign(value: string) {
	return crypto
		.createHmac("sha256", secret())
		.update(value)
		.digest("base64url");
}
export function verifyPassword(value: string, stored?: string) {
	if (!stored?.startsWith("scrypt$")) return false;
	const [, salt, digest] = stored.split("$");
	if (!salt || !digest) return false;
	try {
		const actual = crypto.scryptSync(value, Buffer.from(salt, "base64url"), 64);
		const expected = Buffer.from(digest, "base64url");
		return (
			actual.length === expected.length &&
			crypto.timingSafeEqual(actual, expected)
		);
	} catch {
		return false;
	}
}
function token(user: User) {
	const raw = Buffer.from(
		JSON.stringify({
			id: user.id,
			role: user.role,
			exp: Date.now() + 4 * 60 * 60 * 1000,
		}),
	).toString("base64url");
	return `${raw}.${sign(raw)}`;
}
function parse(value?: string | null) {
	if (!value) return null;
	const [raw, sig] = value.split(".");
	if (!raw || !sig) return null;
	try {
		const expected = Buffer.from(sign(raw));
		const supplied = Buffer.from(sig);
		if (
			expected.length !== supplied.length ||
			!crypto.timingSafeEqual(expected, supplied)
		)
			return null;
		const payload = JSON.parse(Buffer.from(raw, "base64url").toString());
		return Number(payload.exp) > Date.now() ? payload : null;
	} catch {
		return null;
	}
}
export async function currentUser() {
	const jar = await cookies();
	const payload = parse(jar.get(COOKIE)?.value);
	if (!payload) return null;
	const state = await readState();
	return (
		state.users.find(
			(user) =>
				user.id === payload.id && user.status !== "disabled" && !user.disabled,
		) || null
	);
}
export async function setSession(user: User) {
	const jar = await cookies();
	jar.set(COOKIE, token(user), {
		httpOnly: true,
		secure: true,
		sameSite: "strict",
		path: "/",
		maxAge: 4 * 60 * 60,
	});
}
export async function clearSession() {
	const jar = await cookies();
	jar.delete(COOKIE);
}
