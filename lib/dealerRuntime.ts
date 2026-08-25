import crypto from "node:crypto";
const AUTHORITY_PROJECT_ID = "prj_a3oclCcy4sbA2tge4BX7VAKXE4KR";
export function isDealerRuntime(request?: Request) {
	if (process.env.VERCEL_PROJECT_ID === AUTHORITY_PROJECT_ID) return true;
	if (!request) return false;
	try {
		const host = new URL(request.url).host.toLowerCase();
		return (
			host === "wdcc-cpx-launch.vercel.app" ||
			host.startsWith("wdcc-cpx-launch-")
		);
	} catch {
		return false;
	}
}
export function requestId(request: Request) {
	const supplied = String(
		request.headers.get("x-wdcc-request-id") ||
			request.headers.get("x-request-id") ||
			"",
	)
		.trim()
		.slice(0, 160);
	return supplied || crypto.randomUUID();
}
