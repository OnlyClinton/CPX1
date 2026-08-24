import {NextResponse} from "next/server";
import {recordAnalyticsEvent} from "../../../lib/analyticsAudit";
import {proxyDealer} from "../../../lib/dealerProxy";

export const dynamic="force-dynamic";
const DEALER_PROJECT_ID="prj_fz5mN7Q5gImZ9UGpv1GDpHxPtLNB";
const CPX_BACKEND_PROJECT_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR";
const text=(v:unknown,max:number)=>String(v??"").trim().slice(0,max);

function canonicalRuntime(request:Request){
  const project=process.env.VERCEL_PROJECT_ID||"";
  if(project===DEALER_PROJECT_ID||project===CPX_BACKEND_PROJECT_ID)return true;
  const host=new URL(request.url).host.toLowerCase();
  return host==="dealer.wedontcarecars.com"||host.includes("wdcc-dealer-portal")||host.includes("wdcc-cpx-launch");
}

export async function POST(request:Request){
  if(!canonicalRuntime(request))return proxyDealer(request,"/api/events");
  try{
    const body=await request.json().catch(()=>({}));
    const event=text(body?.event??body?.name,100);
    if(!event)return NextResponse.json({ok:false,error:"event_required"},{status:400});
    const record=await recordAnalyticsEvent({
      event,at:text(body?.at,80)||undefined,
      sessionId:text(body?.sessionId,160)||null,anonymousUserId:text(body?.anonymousUserId,160)||null,
      leadId:text(body?.leadId,160)||null,vehicleId:text(body?.vehicleId,160)||null,
      source:text(body?.source,120)||null,medium:text(body?.medium,120)||null,
      campaign:text(body?.campaign,160)||null,content:text(body?.content,160)||null,
      referralCode:text(body?.referralCode,160)||null,pagePath:text(body?.pagePath??body?.path,300)||null,
      landingPath:text(body?.landingPath,300)||null,referrer:text(body?.referrer,700)||null,
      channel:text(body?.channel,80)||null,cta:text(body?.cta,100)||null,
      metadata:body?.metadata&&typeof body.metadata==="object"?body.metadata:null
    });
    return new Response(null,{status:204,headers:{"Cache-Control":"no-store","X-WDCC-Event-ID":record.id}});
  }catch(error){
    console.error("WDCC_ANALYTICS_PERSIST_FAILED",error);
    return NextResponse.json({ok:false,error:"analytics_persist_failed"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
