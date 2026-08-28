import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {isDealerRuntime} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {processDueLeadOutbox} from "../../../../lib/wdccDb";

export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow","X-WDCC-Data-Authority":"neon"};

function validToken(request:Request,secret:string){
  const supplied=String(request.headers.get("authorization")||"");
  const expected=`Bearer ${secret}`;
  const left=Buffer.from(supplied),right=Buffer.from(expected);
  return left.length===right.length&&crypto.timingSafeEqual(left,right);
}

async function run(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/internal/lead-outbox");
  const secret=String(process.env.CRON_SECRET||"").trim();
  if(secret.length<32)return NextResponse.json({ok:false,error:"cron_secret_not_configured"},{status:503,headers});
  if(!validToken(request,secret))return NextResponse.json({ok:false,error:"Unauthorized"},{status:401,headers});
  try{
    const limit=Math.max(1,Math.min(Number(new URL(request.url).searchParams.get("limit")||5)||5,20));
    const results=await processDueLeadOutbox(limit);
    return NextResponse.json({ok:true,processed:results.filter(result=>result.processed).length,results,source:"neon-canonical"},{headers});
  }catch{
    return NextResponse.json({ok:false,error:"outbox_retry_failed"},{status:503,headers});
  }
}

export async function GET(request:Request){return run(request);}
export async function POST(request:Request){return run(request);}
