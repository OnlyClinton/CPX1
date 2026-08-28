import {currentUser} from "../../../../lib/auth";
import {isDealerRuntime} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";

export const dynamic="force-dynamic";

function unauthenticated(error?:string,status=200){
  return Response.json({authenticated:false,user:null,session:null,...(error?{error}:{})},{status,headers:{"cache-control":status===503?"no-store":"private, no-store",...(status===503?{"retry-after":"5"}:{})}});
}

export async function GET(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/auth/session");
  try{
    const user=await currentUser();
    if(!user)return unauthenticated();
    const tenantId=user.tenantId;
    const email=user.email||user.username||"";
    return Response.json({authenticated:true,role:user.role,tenantId,user:{id:user.id,displayName:user.displayName,username:user.username,email:user.email,role:user.role,tenantId},session:{email,role:user.role,tenantId,mustChangePassword:false}},{headers:{"cache-control":"private, no-store, max-age=0"}});
  }catch(error){
    console.error("WDCC_APP_SESSION_ERROR",error);
    return unauthenticated("auth_service_unavailable",503);
  }
}
