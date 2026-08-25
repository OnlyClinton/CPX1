import { NextResponse } from "next/server";
import { clearSession } from "../../../../lib/auth";
import { proxyDealer } from "../../../../lib/dealerProxy";
import { isDealerRuntime } from "../../../../lib/dealerRuntime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	if (!isDealerRuntime(request))
		return proxyDealer(request, "/api/auth/logout");
	try {
		await clearSession();
		return NextResponse.json(
			{ ok: true },
			{ headers: { "Cache-Control": "no-store" } },
		);
	} catch (error) {
		return NextResponse.json(
			{
				ok: false,
				error: error instanceof Error ? error.message : "logout_failed",
			},
			{ status: 500, headers: { "Cache-Control": "no-store" } },
		);
	}
}
