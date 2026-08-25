import {NextResponse} from "next/server";
import type {NextRequest} from "next/server";
import {rateLimitShared} from "./lib/requestGuard";

function isBackendHost(host:string){const h=host.toLowerCase();return h==="dealer.wedontcarecars.com"||h.includes("wdcc-dealer-portal")||h.includes("wdcc-cpx-launch")}
export async function proxy(request:NextRequest){if(request.method!=="POST")return NextResponse.next();const host=request.headers.get("host")||"";if(isBackendHost(host))return NextResponse.next();const path=request.nextUrl.pathname;const g=path==="/api/leads"?await rateLimitShared(request,"leads",24,5*60_000):path==="/api/events"?await rateLimitShared(request,"events-edge",240,60_000):null;if(g&&!g.allowed)return NextResponse.json({ok:false,error:"rate_limited"},{status:429,headers:{"Retry-After":String(g.retryAfterSeconds),"Cache-Control":"no-store","X-WDCC-Rate-Mode":g.mode}});const response=NextResponse.next();if(g)response.headers.set("X-WDCC-Rate-Mode",g.mode);return response;}
export const config={matcher:["/api/leads","/api/events"]};
