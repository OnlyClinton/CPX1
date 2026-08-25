import { NextResponse } from "next/server";
import { backendHealth } from "../../../lib/dealerProxy";
import { isDealerRuntime } from "../../../lib/dealerRuntime";
import { readState } from "../../../lib/store";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
	if (isDealerRuntime(request)) {
		try {
			const state = await readState();
			return NextResponse.json(
				{
					ok: true,
					degraded: false,
					service: "wdcc-canonical-authority",
					release: "WDCC-V53-CANONICAL",
					revision: state.revision,
					storage: {
						counts: {
							users: state.users.length,
							vehicles: state.vehicles.length,
							leads: state.leads.length,
							audit: state.audit.length,
						},
					},
					commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
				},
				{ headers: { "Cache-Control": "no-store" } },
			);
		} catch (error) {
			return NextResponse.json(
				{
					ok: false,
					degraded: true,
					error: error instanceof Error ? error.message : "state_failed",
				},
				{ status: 503 },
			);
		}
	}
	try {
		const { response, json } = await backendHealth();
		const ok = response.ok && json?.ok === true;
		return NextResponse.json(
			{
				...json,
				ok,
				degraded: !ok,
				service: "wdcc-facade",
				commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
			},
			{ status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
		);
	} catch {
		return NextResponse.json(
			{ ok: false, degraded: true, backend: "unreachable" },
			{ status: 503 },
		);
	}
}
