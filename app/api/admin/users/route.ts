import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { proxyDealer } from "../../../../lib/dealerProxy";
import { isDealerRuntime } from "../../../../lib/dealerRuntime";
import { readState, writeState } from "../../../../lib/store";
export const dynamic = "force-dynamic";

const norm = (v: unknown) =>
	String(v ?? "")
		.trim()
		.toLowerCase();
const roles = new Set(["dealer_agent", "tenant_admin", "platform_admin"]);
const safe = (u: any) => ({
	id: String(u?.id ?? ""),
	email: String(u?.email ?? ""),
	secondaryEmail: String(u?.secondaryEmail ?? ""),
	username: String(u?.username ?? ""),
	displayName: String(u?.displayName ?? ""),
	business: String(u?.business ?? ""),
	phone: String(u?.phone ?? ""),
	role: String(u?.role ?? ""),
	status: String(u?.status ?? ""),
	disabled: Boolean(u?.disabled),
	aliases: Array.isArray(u?.aliases) ? u.aliases.map(String) : [],
});

function hashPassword(password: string) {
	const salt = crypto.randomBytes(24);
	const digest = crypto.scryptSync(password, salt, 64);
	return `scrypt$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}
function ids(u: any) {
	return [
		u?.id,
		u?.email,
		u?.secondaryEmail,
		u?.username,
		u?.loginAlias,
		...(Array.isArray(u?.aliases) ? u.aliases : []),
	]
		.map(norm)
		.filter(Boolean);
}
function nextNormal(users: any[]) {
	const used = new Set(users.map((u) => String(u?.id ?? "")));
	if (!used.has("001")) return "001";
	let n = 3;
	while (used.has(String(n).padStart(3, "0"))) n++;
	return String(n).padStart(3, "0");
}
function nextCertification(users: any[]) {
	const used = new Set(users.map((u) => String(u?.id ?? "")));
	for (let n = 999; n >= 900; n--) {
		const id = String(n);
		if (!used.has(id)) return id;
	}
	throw Error("no_certification_slot");
}
async function requireAdmin() {
	const u = await currentUser();
	const role = String((u as any)?.role ?? "").toLowerCase();
	if (!u || !["platform_admin", "admin", "owner"].includes(role))
		throw Error("forbidden");
	return u as any;
}

export async function GET(request: Request) {
	if (!isDealerRuntime(request))
		return proxyDealer(request, "/api/admin/users");
	try {
		await requireAdmin();
		const state = await readState();
		return NextResponse.json(
			{
				ok: true,
				users: (Array.isArray(state.users) ? state.users : []).map(safe),
			},
			{ headers: { "Cache-Control": "private, no-store" } },
		);
	} catch {
		return NextResponse.json(
			{ ok: false, error: "forbidden" },
			{ status: 403 },
		);
	}
}

export async function POST(req: Request) {
	if (!isDealerRuntime(req)) return proxyDealer(req, "/api/admin/users");
	try {
		const actor = await requireAdmin();
		const body = await req.json();
		const email = norm(body?.email);
		const secondaryEmail = norm(body?.secondaryEmail);
		const username = String(body?.username ?? "").trim();
		const password = String(body?.password ?? "");
		const role = norm(body?.role || "dealer_agent");

		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
			return NextResponse.json(
				{ ok: false, error: "valid_email_required" },
				{ status: 400 },
			);
		}
		if (!/^[A-Za-z0-9._-]{2,64}$/.test(username)) {
			return NextResponse.json(
				{ ok: false, error: "valid_username_required" },
				{ status: 400 },
			);
		}
		if (password.length < 8) {
			return NextResponse.json(
				{ ok: false, error: "password_min_8" },
				{ status: 400 },
			);
		}
		if (!roles.has(role)) {
			return NextResponse.json(
				{ ok: false, error: "invalid_role" },
				{ status: 400 },
			);
		}

		const state = await readState();
		state.users = Array.isArray(state.users) ? state.users : [];
		state.audit = Array.isArray(state.audit) ? state.audit : [];
		const wanted = [email, secondaryEmail, norm(username)].filter(Boolean);
		if (state.users.some((u: any) => ids(u).some((x) => wanted.includes(x)))) {
			return NextResponse.json(
				{ ok: false, error: "duplicate_identity" },
				{ status: 409 },
			);
		}

		const id =
			body?.certification === true
				? nextCertification(state.users)
				: nextNormal(state.users);
		const now = new Date().toISOString();
		const user = {
			id,
			email,
			secondaryEmail,
			username,
			displayName: String(body?.displayName ?? "").trim(),
			business: String(body?.business ?? "").trim(),
			phone: String(body?.phone ?? "").trim(),
			role,
			tenantId: String(body?.tenantId ?? "wdcc"),
			status: "active",
			disabled: false,
			passwordHash: hashPassword(password),
			aliases: [],
			createdAt: now,
			updatedAt: now,
		};

		state.users.push(user);
		state.audit.push({
			id: crypto.randomUUID(),
			at: now,
			action: "user.create",
			actor: String(actor.id ?? ""),
			userId: id,
		});
		await writeState(state);
		return NextResponse.json({ ok: true, user: safe(user) }, { status: 201 });
	} catch (error) {
		return NextResponse.json(
			{
				ok: false,
				error: error instanceof Error ? error.message : "create_failed",
			},
			{ status: 403 },
		);
	}
}

export async function PATCH(req: Request) {
	if (!isDealerRuntime(req)) return proxyDealer(req, "/api/admin/users");
	try {
		const actor = await requireAdmin();
		const body = await req.json();
		const id = String(body?.id ?? "");
		const action = String(body?.action ?? "").toLowerCase();
		const state = await readState();
		state.users = Array.isArray(state.users) ? state.users : [];
		state.audit = Array.isArray(state.audit) ? state.audit : [];

		const i = state.users.findIndex((u: any) => String(u?.id ?? "") === id);
		if (i < 0)
			return NextResponse.json(
				{ ok: false, error: "not_found" },
				{ status: 404 },
			);
		if (id === "000" && ["disable", "delete"].includes(action)) {
			return NextResponse.json(
				{ ok: false, error: "admin_000_protected" },
				{ status: 409 },
			);
		}

		if (action === "delete") {
			state.users.splice(i, 1);
		} else if (action === "disable") {
			state.users[i].disabled = true;
			state.users[i].status = "disabled";
		} else if (action === "enable") {
			state.users[i].disabled = false;
			state.users[i].status = "active";
		} else if (action === "password") {
			const p = String(body?.password ?? "");
			if (p.length < 8)
				return NextResponse.json(
					{ ok: false, error: "password_min_8" },
					{ status: 400 },
				);
			state.users[i].passwordHash = hashPassword(p);
		} else {
			return NextResponse.json(
				{ ok: false, error: "invalid_action" },
				{ status: 400 },
			);
		}

		state.audit.push({
			id: crypto.randomUUID(),
			at: new Date().toISOString(),
			action: `user.${action}`,
			actor: String(actor.id ?? ""),
			userId: id,
		});
		await writeState(state);
		return NextResponse.json({ ok: true });
	} catch (error) {
		return NextResponse.json(
			{
				ok: false,
				error: error instanceof Error ? error.message : "update_failed",
			},
			{ status: 403 },
		);
	}
}
