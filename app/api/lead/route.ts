import {GET as canonicalGET,POST as canonicalPOST} from "../leads/route";

export const dynamic="force-dynamic";

const BACKEND=(process.env.WDCC_DEALER_BACKEND_URL||"https://dealer.wedontcarecars.com").replace(/\/$/,"");
const DEALER_PROJECT_ID="prj_fz5mN7Q5gImZ9UGpv1GDpHxPtLNB";
const CPX_BACKEND_PROJECT_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR";

function isCanonicalRuntime(request:Request){
  const host=new URL(request.url).host.toLowerCase();
  const project=process.env.VERCEL_PROJECT_ID||"";
  return project===DEALER_PROJECT_ID||project===CPX_BACKEND_PROJECT_ID||host.includes("wdcc-dealer-portal")||host.includes("wdcc-cpx-launch")||host==="dealer.wedontcarecars.com";
}

function proxyHeaders(request:Request){
  const headers=new Headers();
  for(const name of ["content-type","accept","cookie","user-agent","idempotency-key"]){const value=request.headers.get(name);if(value)headers.set(name,value);}
  headers.set("x-wdcc-facade","lead-v2");
  return headers;
}

async function proxy(request:Request){
  try{
    const target=new URL("/api/leads",BACKEND);
    const source=new URL(request.url);
    target.search=source.search;
    const method=request.method.toUpperCase();
    const init:RequestInit={method,headers:proxyHeaders(request),cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(12000)};
    if(!["GET","HEAD"].includes(method))init.body=await request.arrayBuffer();
    const upstream=await fetch(target,init);
    const headers=new Headers(upstream.headers);
    headers.set("cache-control","no-store");
    headers.set("x-wdcc-lead-backend","stable-launch-alias");
    return new Response(upstream.body,{status:upstream.status,statusText:upstream.statusText,headers});
  }catch(error){
    console.error("WDCC_LEAD_FACADE_ERROR",{backend:BACKEND,error});
    return Response.json({ok:false,persisted:false,error:"lead_backend_unavailable"},{status:503,headers:{"cache-control":"no-store","retry-after":"5"}});
  }
}

export async function GET(request:Request){
  return isCanonicalRuntime(request)?canonicalGET(request):proxy(request);
}

export async function POST(request:Request){
  return isCanonicalRuntime(request)?canonicalPOST(request):proxy(request);
}
