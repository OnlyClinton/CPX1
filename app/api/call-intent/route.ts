import {NextResponse} from "next/server";
import {recordCallIntent} from "../../../lib/callIntent";
import {rateLimitShared} from "../../../lib/requestGuard";
import {resolveSource} from "../../../lib/sourceRegistry";

export const dynamic="force-dynamic";
const text=(v:unknown,max:number)=>String(v??"").trim().slice(0,max);

export async function POST(request:Request){
  const gate=await rateLimitShared(request,"call-intent",30,5*60_000);
  if(!gate.allowed)return NextResponse.json({ok:false,error:"rate_limited"},{status:429,headers:{"Retry-After":String(gate.retryAfterSeconds),"Cache-Control":"no-store","X-WDCC-Rate-Mode":gate.mode}});
  try{
    const body=await request.json().catch(()=>({}));
    const source=resolveSource(body?.source,body?.referralCode);
    const item=await recordCallIntent({tenantId:"wdcc",sessionId:text(body?.sessionId,160)||null,anonymousUserId:text(body?.anonymousUserId,160)||null,vehicleId:text(body?.vehicleId,160)||null,source:source.canonical||null,medium:text(body?.medium,120)||null,campaign:text(body?.campaign,160)||null,content:text(body?.content,160)||null,term:text(body?.term,160)||null,clickId:text(body?.clickId,220)||null,referralCode:text(body?.referralCode,160)||null,pagePath:text(body?.pagePath,300)||null,landingPath:text(body?.landingPath,300)||null,referrer:text(body?.referrer,700)||null,cta:text(body?.cta,100)||"call-sean"});
    return NextResponse.json({ok:true,intentId:item.id},{status:201,headers:{"Cache-Control":"no-store","X-WDCC-Rate-Mode":gate.mode}});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"call_intent_failed"},{status:500,headers:{"Cache-Control":"no-store"}})}
}
