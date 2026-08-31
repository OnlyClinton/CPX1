import {get} from "@vercel/blob";
import {currentUser} from "../../../lib/auth";
import {isDealerRuntime} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {isInternalVehicleRecord,isQaVehicleRecord,readState} from "../../../lib/store";
import {blobAuthority} from "../../../lib/wdccAuthority";

export const dynamic="force-dynamic";
const dealerRoles=new Set(["dealer_agent","tenant_admin","platform_admin"]);
const securityHeaders={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const notFound=()=>new Response("Not found",{status:404,headers:securityHeaders});

export async function GET(req:Request){
  const p=new URL(req.url).searchParams.get("p")||"";
  if(!p.startsWith("media/wdcc/"))return notFound();
  if(!isDealerRuntime(req))return proxyDealer(req,"/api/media");
  const vehicleId=p.split("/")[2]||"";
  if(!vehicleId)return notFound();
  const authority=blobAuthority();
  if(authority.mode==="missing"){
    console.error("WDCC_MEDIA_AUTHORITY_MISSING");
    return new Response("Media unavailable",{status:503,headers:securityHeaders});
  }
  try{
    const [state,user]=await Promise.all([readState(),currentUser().catch(()=>null)]);
    const vehicle:any=state.vehicles.find((item:any)=>String(item.id)===vehicleId);
    if(!vehicle)return notFound();
    const paths=[vehicle.primaryPhotoPathname,...(Array.isArray(vehicle.photoPathnames)?vehicle.photoPathnames:[])].map(value=>String(value||"")).filter(Boolean);
    if(!paths.includes(p))return notFound();
    const publicMedia=String(vehicle.status||"").toLowerCase()==="published"&&!isQaVehicleRecord(vehicle)&&!isInternalVehicleRecord(vehicle);
    const role=String(user?.role||"").toLowerCase();
    const dealerAllowed=Boolean(user&&dealerRoles.has(role)&&(role==="platform_admin"||String(user.tenantId||"wdcc")===String(vehicle.tenantId||"wdcc")));
    if(!publicMedia&&!dealerAllowed)return notFound();
    const r=await get(p,{access:"private",useCache:publicMedia,...authority.options});
    if(!r||r.statusCode!==200||!r.stream)return notFound();
    return new Response(r.stream as any,{headers:{"Content-Type":r.blob.contentType||"application/octet-stream","Cache-Control":publicMedia?"public, max-age=300, stale-while-revalidate=900":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch(error){
    console.error("WDCC_MEDIA_READ_ERROR",error instanceof Error?error.message:"unknown");
    return new Response("Media unavailable",{status:503,headers:securityHeaders});
  }
}
