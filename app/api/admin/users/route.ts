import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {readState,writeState} from "../../../../lib/store";
import {currentUser} from "../../../../lib/auth";
import {isDealerRuntime} from "../../../../lib/dealerRuntime";
import {proxyDealer} from "../../../../lib/dealerProxy";
export const dynamic="force-dynamic";

const norm=(v:unknown)=>String(v??"").trim().toLowerCase();
const safe=(u:any)=>({
  id:String(u?.id??""),
  email:String(u?.email??""),
  secondaryEmail:String(u?.secondaryEmail??""),
  username:String(u?.username??""),
  displayName:String(u?.displayName??""),
  business:String(u?.business??""),
  phone:String(u?.phone??""),
  role:String(u?.role??""),
  status:String(u?.status??""),
  disabled:Boolean(u?.disabled),
  aliases:Array.isArray(u?.aliases)?u.aliases.map(String):[]
});

async function requireAdmin(){
  const u=await currentUser();
  const role=String((u as any)?.role??"").toLowerCase();
  if(!u||!["platform_admin","admin","owner"].includes(role))throw Error("forbidden");
  return u as any;
}

export async function GET(request:Request){
  if(!isDealerRuntime(request))return proxyDealer(request,"/api/admin/users");
  try{
    await requireAdmin();
    const state=await readState();
    return NextResponse.json({
      ok:true,
      users:(Array.isArray(state.users)?state.users:[]).map(safe)
    },{headers:{"Cache-Control":"private, no-store"}});
  }catch{
    return NextResponse.json({ok:false,error:"forbidden"},{status:403});
  }
}

export async function POST(req:Request){
  if(!isDealerRuntime(req))return proxyDealer(req,"/api/admin/users");
  try{
    await requireAdmin();
    return NextResponse.json({
      ok:false,
      error:"neon_auth_provisioning_required",
      message:"Create identities in Neon Auth, then link their access here."
    },{status:501});
  }catch(error){
    return NextResponse.json({
      ok:false,error:error instanceof Error?error.message:"create_failed"
    },{status:403});
  }
}

export async function PATCH(req:Request){
  if(!isDealerRuntime(req))return proxyDealer(req,"/api/admin/users");
  try{
    const actor=await requireAdmin();
    const body=await req.json();
    const id=String(body?.id??"");
    const action=String(body?.action??"").toLowerCase();
    if(action==="password"){
      return NextResponse.json({
        ok:false,
        error:"neon_auth_password_management_required",
        message:"Password resets are managed by Neon Auth."
      },{status:501});
    }
    const state=await readState();
    state.users=Array.isArray(state.users)?state.users:[];
    state.audit=Array.isArray(state.audit)?state.audit:[];

    const i=state.users.findIndex((u:any)=>String(u?.id??"")===id);
    if(i<0)return NextResponse.json({ok:false,error:"not_found"},{status:404});
    if(id==="000"&&["disable","delete"].includes(action)){
      return NextResponse.json({ok:false,error:"admin_000_protected"},{status:409});
    }

    if(action==="delete"){
      state.users.splice(i,1);
    }else if(action==="disable"){
      state.users[i].disabled=true;
      state.users[i].status="disabled";
    }else if(action==="enable"){
      state.users[i].disabled=false;
      state.users[i].status="active";
    }else{
      return NextResponse.json({ok:false,error:"invalid_action"},{status:400});
    }

    state.audit.push({
      id:crypto.randomUUID(),at:new Date().toISOString(),
      action:`user.${action}`,actor:String(actor.id??""),userId:id
    });
    await writeState(state);
    return NextResponse.json({ok:true});
  }catch(error){
    return NextResponse.json({
      ok:false,error:error instanceof Error?error.message:"update_failed"
    },{status:403});
  }
}
