import {currentUser} from "../../../../lib/auth";
import {isDealerRuntime} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/admin/export");
  try{
    const user=await currentUser();
    if(!user)return Response.json({ok:false,error:"Unauthorized"},{status:401,headers:{"Cache-Control":"private, no-store"}});
    if(user.role!=="platform_admin")return Response.json({ok:false,error:"Forbidden"},{status:403,headers:{"Cache-Control":"private, no-store"}});
    return Response.json({
      ok:false,
      error:"legacy_raw_export_retired",
      message:"Raw state export is disabled because it can contain authentication material. Use a scoped Neon report instead."
    },{status:410,headers:{"Cache-Control":"private, no-store","X-WDCC-Data-Authority":"neon"}});
  }catch(error){
    console.error("WDCC_ADMIN_EXPORT_AUTH_UNAVAILABLE",error);
    return Response.json({ok:false,error:"auth_service_unavailable"},{status:503,headers:{"Cache-Control":"no-store","Retry-After":"5"}});
  }
}
