import {NextResponse} from "next/server";
import {readState} from "../../../../lib/store";
import {verifyPassword,setSession} from "../../../../lib/auth";
import {isTrustedWriteRequest,securityError} from "../../../../lib/request-security";
export const dynamic="force-dynamic";

const norm=(v:unknown)=>String(v??"").trim().toLowerCase();
const adminAliases=new Set(["admin","000","oooo","chyphnx@pm.me"]);
const dealerAliases=new Set(["bigpussy","bigplussy","002","bigcatscrap@gmail.com","sean@wedontcarecars.com"]);

function identities(u:any){
  return [u?.id,u?.email,u?.secondaryEmail,u?.username,u?.loginAlias,
    ...(Array.isArray(u?.aliases)?u.aliases:[])]
    .map(norm).filter(Boolean);
}

export async function POST(req:Request){
  if(!isTrustedWriteRequest(req))return securityError();
  try{
    const body=await req.json().catch(()=>({}));
    const supplied=norm(body?.email??body?.username??body?.login);
    const password=String(body?.password??"");
    if(!supplied||!password){
      return NextResponse.json({ok:false,error:"credentials_required"},{status:400,headers:{"Cache-Control":"private, no-store"}});
    }

    const state=await readState();
    const users=Array.isArray(state?.users)?state.users:[];
    const user=users.find((u:any)=>{
      if(u?.status==="disabled"||u?.disabled)return false;
      const ids=identities(u);
      if(ids.includes(supplied))return true;
      if(adminAliases.has(supplied)){
        return String(u?.id??"")==="000" ||
          String(u?.role??"").toLowerCase()==="platform_admin" ||
          ids.includes(norm(process.env.ADMIN_EMAIL||"chyphnx@pm.me"));
      }
      if(dealerAliases.has(supplied)){
        return String(u?.id??"")==="002" ||
          ids.includes(norm(process.env.DEALER_EMAIL||"bigcatscrap@gmail.com")) ||
          ids.includes(norm(process.env.DEALER_SECONDARY_EMAIL||"sean@wedontcarecars.com"));
      }
      return false;
    });

    const hash=(user as any)?.passwordHash ??
      (user as any)?.password_hash ??
      (user as any)?.passwordDigest;

    if(!user||!verifyPassword(password,hash)){
      return NextResponse.json({ok:false,error:"invalid_credentials"},{status:401,headers:{"Cache-Control":"private, no-store"}});
    }

    await setSession(user as any);
    const role=String((user as any).role??"");
    const tenantId=(user as any).tenantId??null;
    return NextResponse.json({
      ok:true,role,tenantId,
      name:String((user as any).displayName??""),
      mustChangePassword:false,
      user:{
        id:String((user as any).id??""),
        email:String((user as any).email??""),
        secondaryEmail:String((user as any).secondaryEmail??""),
        username:String((user as any).username??""),
        displayName:String((user as any).displayName??""),
        role,tenantId
      }
    },{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    console.error("WDCC_LOGIN_ERROR",error);
    return NextResponse.json({ok:false,error:"login_failed"},{status:500,headers:{"Cache-Control":"private, no-store"}});
  }
}
