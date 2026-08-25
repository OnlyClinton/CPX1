import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser } from "../../../../lib/auth";
import { proxyDealer } from "../../../../lib/dealerProxy";
import { isDealerRuntime } from "../../../../lib/dealerRuntime";
import { readState, writeState } from "../../../../lib/store";

export const dynamic = "force-dynamic";
const roles = new Set(["dealer_agent", "tenant_admin", "platform_admin"]);
const statuses = new Set([
	"new",
	"contacted",
	"engaged",
	"qualified",
	"appointment",
	"showed",
	"deal_working",
	"sold",
	"lost",
	"nurture",
]);
const text = (v: unknown, n: number) =>
	String(v ?? "")
		.trim()
		.slice(0, n);

export async function PATCH(
	req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	if (!isDealerRuntime(req)) {
		const { id } = await params;
		return proxyDealer(req, `/api/leads/${encodeURIComponent(id)}`);
	}
	const user = await currentUser();
	if (!user || !roles.has(String(user.role || "").toLowerCase()))
		return NextResponse.json(
			{ ok: false, error: "Unauthorized" },
			{ status: 401 },
		);
	try {
		const { id } = await params;
		const body = await req.json();
		const status = text(body?.status, 40).toLowerCase();
		if (status && !statuses.has(status))
			return NextResponse.json(
				{ ok: false, error: "invalid_status" },
				{ status: 400 },
			);
		const state = await readState();
		const index = state.leads.findIndex(
			(lead: any) => String(lead.id) === String(id),
		);
		if (index < 0)
			return NextResponse.json(
				{ ok: false, error: "not_found" },
				{ status: 404 },
			);
		const lead: any = state.leads[index];
		const platform = String(user.role || "").toLowerCase() === "platform_admin";
		if (
			!platform &&
			String(lead.tenantId || "wdcc") !== String(user.tenantId || "wdcc")
		)
			return NextResponse.json(
				{ ok: false, error: "Forbidden" },
				{ status: 403 },
			);
		const before = String(lead.status || "new");
		if (status) lead.status = status;
		if (body?.leadScore != null) {
			const score = Math.max(0, Math.min(100, Number(body.leadScore)));
			if (Number.isFinite(score)) lead.leadScore = score;
		}
		if (body?.note != null) lead.lastNote = text(body.note, 1200);
		if (body?.assignedTo != null) lead.assignedTo = text(body.assignedTo, 120);
		lead.updatedAt = new Date().toISOString();
		lead.updatedBy = user.id;
		state.audit.push({
			id: crypto.randomUUID(),
			at: lead.updatedAt,
			action: "lead.status_update",
			actor: user.id,
			leadId: lead.id,
			before,
			after: lead.status,
		});
		const saved = await writeState(state);
		return NextResponse.json(
			{ ok: true, item: lead, revision: saved.revision },
			{ headers: { "Cache-Control": "private, no-store" } },
		);
	} catch (error) {
		return NextResponse.json(
			{
				ok: false,
				error: error instanceof Error ? error.message : "lead_update_failed",
			},
			{ status: 500 },
		);
	}
}
