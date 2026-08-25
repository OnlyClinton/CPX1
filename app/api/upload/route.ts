import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { currentUser } from "../../../lib/auth";
import { proxyDealer } from "../../../lib/dealerProxy";
import { isDealerRuntime, requestId } from "../../../lib/dealerRuntime";
import { readState } from "../../../lib/store";
import { recordVehicleAudit } from "../../../lib/vehicleAudit";

export const dynamic = "force-dynamic";
const editorRoles = new Set(["dealer_agent", "tenant_admin", "platform_admin"]);

export async function POST(request: Request) {
	if (!isDealerRuntime(request)) return proxyDealer(request, "/api/upload");
	const rid = requestId(request);
	try {
		const body = (await request.json()) as HandleUploadBody;
		const result = await handleUpload({
			body,
			request,
			token: process.env.BLOB_READ_WRITE_TOKEN,
			onBeforeGenerateToken: async (pathname, clientPayload) => {
				const user = await currentUser();
				if (!user || !editorRoles.has(String(user.role || "").toLowerCase())) {
					await recordVehicleAudit({
						action: "vehicle.photo_authorize",
						outcome: "denied",
						requestId: rid,
						actorId: user?.id || null,
						actorRole: user?.role || null,
						detail: "auth_required",
					});
					throw Error("Unauthorized");
				}
				let payload: any = {};
				try {
					payload = JSON.parse(clientPayload || "{}");
				} catch {}
				const vehicleId = String(payload.vehicleId || "");
				const correlationId =
					String(payload.requestId || rid).slice(0, 160) || rid;
				if (!vehicleId || !pathname.startsWith(`media/wdcc/${vehicleId}/`)) {
					await recordVehicleAudit({
						action: "vehicle.photo_authorize",
						outcome: "failed",
						requestId: correlationId,
						vehicleId: vehicleId || null,
						actorId: user.id,
						actorRole: user.role,
						detail: "invalid_upload_path",
					});
					throw Error("Invalid upload path");
				}
				const state = await readState();
				const vehicle: any = state.vehicles.find(
					(item) => item.id === vehicleId,
				);
				if (!vehicle) throw Error("Vehicle not found");
				if (
					String(user.role).toLowerCase() !== "platform_admin" &&
					String(vehicle.tenantId || "wdcc") !== String(user.tenantId || "wdcc")
				)
					throw Error("Forbidden");
				if (String(vehicle.status || "").toLowerCase() === "archived")
					throw Error("Vehicle archived");
				await recordVehicleAudit({
					action: "vehicle.photo_authorize",
					outcome: "ok",
					requestId: correlationId,
					vehicleId,
					actorId: user.id,
					actorRole: user.role,
					year: vehicle.year,
					make: vehicle.make,
					model: vehicle.model,
					mileage: vehicle.mileage,
					stock: vehicle.stock,
					status: vehicle.status,
					photoCount: Array.isArray(vehicle.photoPathnames)
						? vehicle.photoPathnames.length
						: 0,
					detail: pathname,
				});
				return {
					allowedContentTypes: [
						"image/jpeg",
						"image/png",
						"image/webp",
						"image/avif",
					],
					maximumSizeInBytes: 15 * 1024 * 1024,
					addRandomSuffix: true,
					tokenPayload: JSON.stringify({
						vehicleId,
						userId: user.id,
						actorRole: user.role,
						tenantId: user.tenantId || "wdcc",
						requestId: correlationId,
						year: vehicle.year,
						make: vehicle.make,
						model: vehicle.model,
						mileage: vehicle.mileage,
						stock: vehicle.stock,
					}),
				};
			},
			onUploadCompleted: async ({ blob, tokenPayload }) => {
				let payload: any = {};
				try {
					payload = JSON.parse(tokenPayload || "{}");
				} catch {}
				await recordVehicleAudit({
					action: "vehicle.photo_uploaded",
					outcome: "ok",
					requestId: String(payload.requestId || rid),
					vehicleId: payload.vehicleId || null,
					actorId: payload.userId || null,
					actorRole: payload.actorRole || null,
					year: payload.year,
					make: payload.make,
					model: payload.model,
					mileage: payload.mileage,
					stock: payload.stock,
					detail: blob.pathname,
				});
			},
		});
		return NextResponse.json(result, {
			headers: { "Cache-Control": "no-store", "X-WDCC-Request-ID": rid },
		});
	} catch (error) {
		await recordVehicleAudit({
			action: "vehicle.photo_upload",
			outcome: "failed",
			requestId: rid,
			detail: error instanceof Error ? error.message : "upload_failed",
		});
		return NextResponse.json(
			{
				ok: false,
				error: error instanceof Error ? error.message : "upload_failed",
				requestId: rid,
			},
			{
				status: 400,
				headers: { "Cache-Control": "no-store", "X-WDCC-Request-ID": rid },
			},
		);
	}
}
