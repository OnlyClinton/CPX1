import {currentUser} from "../../../../lib/auth";
import {isDealerRuntime} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
import {readState} from "../../../../lib/store";

export const dynamic="force-dynamic";

const downloadHeaders={"Cache-Control":"private, no-store, max-age=0, must-revalidate","Pragma":"no-cache","Expires":"0","Vary":"Cookie","X-Content-Type-Options":"nosniff"};

export async function GET(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/admin/export");
  const user=await currentUser().catch(()=>null);
  if(!user)return Response.json({ok:false,error:"Unauthorized"},{status:401,headers:downloadHeaders});
  if(String(user.role||"").toLowerCase()!=="platform_admin")return Response.json({ok:false,error:"Forbidden"},{status:403,headers:downloadHeaders});
  const state=await readState();
  const safeState={revision:state.revision,updatedAt:state.updatedAt,tenants:state.tenants,users:state.users.map(({passwordHash:_,...safe}:any)=>safe),vehicles:state.vehicles,leads:state.leads.map(({idempotencyKey:_,idempotencyHash:__,requestFingerprint:___,...safe}:any)=>safe),audit:state.audit.map(({idempotencyKey:_,idempotencyHash:__,...safe}:any)=>safe)};
  const stamp=new Date().toISOString().replace(/[:.]/g,"-");
  return new Response(JSON.stringify(safeState,null,2)+"\n",{
    headers:{
      ...downloadHeaders,
      "Content-Type":"application/json; charset=utf-8",
      "Content-Disposition":`attachment; filename="wdcc-ledger-${stamp}.json"`
    }
  });
}
