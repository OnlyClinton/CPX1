import { get } from "@vercel/blob";
import { proxyDealer } from "../../../lib/dealerProxy";
import { isDealerRuntime } from "../../../lib/dealerRuntime";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
	if (!isDealerRuntime(req)) return proxyDealer(req, "/api/media");
	const p = new URL(req.url).searchParams.get("p") || "";
	if (!p.startsWith("media/wdcc/"))
		return new Response("Not found", { status: 404 });
	const opt = process.env.BLOB_READ_WRITE_TOKEN
		? { token: process.env.BLOB_READ_WRITE_TOKEN }
		: {};
	const r = await get(p, { access: "private", useCache: true, ...opt });
	if (!r || r.statusCode !== 200 || !r.stream)
		return new Response("Not found", { status: 404 });
	return new Response(r.stream as any, {
		headers: {
			"Content-Type": r.blob.contentType || "application/octet-stream",
			"Cache-Control": "public,max-age=3600",
		},
	});
}
