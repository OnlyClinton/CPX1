import {currentUser} from "../../../../lib/auth";
import {isDealerRuntime} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {listPortalUsers} from "../../../../lib/wdccDb";

export const dynamic="force-dynamic";

async function requireAdmin(){
  const user=await currentUser();
  if(!user)return {error:Response.json({ok:false,error:"Unauthorized"},{status:401,headers:{"Cache-Control":"private, no-store"}})};
  if(user.role!=="platform_admin")return {error:Response.json({ok:false,error:"Forbidden"},{status:403,headers:{"Cache-Control":"private, no-store"}})};
  return {user};
}

export async function GET(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/admin/users");
  try{
    const access=await requireAdmin();
    if(access.error)return access.error;
    const records=await listPortalUsers();
    const users=records.map(record=>({
      id:record.id,
      email:record.email,
      username:record.email.split("@")[0]||record.email,
      displayName:record.name,
      role:record.role,
      disabled:record.status!=="active",
      status:record.status,
      tenantId:record.dealerId,
      dealerSlug:record.dealerSlug
    }));
    return Response.json({ok:true,users,count:users.length,source:"neon-canonical"},{headers:{"Cache-Control":"private, no-store","X-WDCC-Data-Authority":"neon"}});
  }catch(error){
    console.error("WDCC_ADMIN_USERS_READ_ERROR",error);
    return Response.json({ok:false,error:"admin_directory_unavailable"},{status:503,headers:{"Cache-Control":"no-store","Retry-After":"5"}});
  }
}

async function unsupported(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/admin/users");
  try{
    const access=await requireAdmin();
    if(access.error)return access.error;
    return Response.json({ok:false,error:"account_mutations_require_neon_auth_admin"},{status:501,headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("WDCC_ADMIN_USERS_AUTH_ERROR",error);
    return Response.json({ok:false,error:"auth_service_unavailable"},{status:503,headers:{"Cache-Control":"no-store","Retry-After":"5"}});
  }
}

export const POST=unsupported;
export const PATCH=unsupported;
