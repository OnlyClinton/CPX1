import { currentUser } from "../../../../lib/auth";
import { proxyDealer } from "../../../../lib/dealerProxy";
import { isDealerRuntime } from "../../../../lib/dealerRuntime";
import { readState } from "../../../../lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	if (!isDealerRuntime(request))
		return proxyDealer(request, "/api/admin/export");
	const user = await currentUser();
	const role = String(user?.role || "").toLowerCase();
	if (!user || !new Set(["platform_admin", "tenant_admin"]).has(role)) {
		return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
	}
	const state = await readState();
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	return new Response(JSON.stringify(state, null, 2) + "\n", {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Content-Disposition": `attachment; filename="wdcc-ledger-${stamp}.json"`,
			"Cache-Control": "private, no-store",
		},
	});
}
