import {currentUser} from "../../../lib/auth";
import {isDealerRuntime} from "../../../lib/dealerRuntime";
import {proxyDealer} from "../../../lib/dealerProxy";
import {getVehicle} from "../../../lib/wdccDb";
import {canStaffReadVehicleMedia,parseVehicleMediaPathname,readVehicleMediaPathname,vehicleMediaIsPublic} from "../../../lib/vehicleMedia";

export const dynamic="force-dynamic";
export const runtime="nodejs";

const commonHeaders={
  "X-Content-Type-Options":"nosniff",
  "Cross-Origin-Resource-Policy":"same-origin",
  "Cache-Control":"private, no-store"
};

function response(message:string,status:number){
  return new Response(message,{status,headers:commonHeaders});
}

export async function GET(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/media");
  const pathname=new URL(request.url).searchParams.get("p")||"";
  const parsed=parseVehicleMediaPathname(pathname);
  if(!parsed)return response("Not found",404);

  let vehicle:any;
  try{vehicle=await getVehicle(parsed.vehicleId,{includeNonPublic:true});}
  catch(error){
    console.error("WDCC_VEHICLE_MEDIA_INVENTORY_UNAVAILABLE",error);
    return response("Media unavailable",503);
  }
  if(!vehicle)return response("Not found",404);

  const associated=Array.isArray(vehicle.photoPathnames)&&vehicle.photoPathnames.some((value:unknown)=>String(value||"")===parsed.pathname);
  const publicListing=associated&&vehicleMediaIsPublic(vehicle);
  if(!publicListing){
    let user:any;
    try{user=await currentUser();}
    catch(error){
      console.error("WDCC_VEHICLE_MEDIA_AUTH_UNAVAILABLE",error);
      return response("Media unavailable",503);
    }
    if(!canStaffReadVehicleMedia(vehicle,user))return response("Not found",404);
  }

  try{
    const media=await readVehicleMediaPathname(parsed.pathname,{allowPublicFallback:publicListing});
    if(!media)return response("Not found",404);
    return new Response(media.stream,{status:200,headers:{
      ...commonHeaders,
      "Content-Type":media.metadata.contentType,
      "Content-Length":String(media.metadata.size),
      ...("etag" in media.metadata&&media.metadata.etag?{ETag:media.metadata.etag}:{}),
      "X-WDCC-Media-Provider":media.metadata.provider,
      "X-WDCC-Media-Access":media.access
    }});
  }catch(error){
    console.error("WDCC_VEHICLE_MEDIA_READ_UNAVAILABLE",error);
    return response("Media unavailable",503);
  }
}
