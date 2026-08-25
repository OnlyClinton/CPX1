const AUTH_BASE="https://ep-curly-breeze-ay2iih1f.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth";
export const dynamic="force-dynamic";

function roleFor(email:string){const value=email.toLowerCase();if(value==="admin@internal.wedontcarecars.com")return {role:"platform_admin",username:"admin",displayName:"WDCC Admin"};if(value==="dealer@internal.wedontcarecars.com")return {role:"dealer",username:"dealer",displayName:"WDCC Dealer"};return null;}
function copyCookies(upstream:Response,headers:Headers){const getter=(upstream.headers as any).getSetCookie;if(typeof getter==="function")for(const cookie of getter.call(upstream.headers))headers.append("set-cookie",cookie);else{const cookie=upstream.headers.get("set-cookie");if(cookie)headers.append("set-cookie",cookie);}}

export async function GET(request:Request){
  try{
    const cookie=request.headers.get("cookie")||"";
    if(!cookie)return Response.json({authenticated:false},{headers:{"cache-control":"private, no-store"}});
    const upstream=await fetch(`${AUTH_BASE}/get-session`,{headers:{accept:"application/json",cookie},cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(10000)});
    const text=await upstream.text();let data:any=null;try{data=text?JSON.parse(text):null;}catch{}
    const email=String(data?.user?.email||"").toLowerCase();const access=roleFor(email);
    if(!upstream.ok||!data?.user||!access)return Response.json({authenticated:false},{headers:{"cache-control":"private, no-store"}});
    const headers=new Headers({"content-type":"application/json","cache-control":"private, no-store, max-age=0"});copyCookies(upstream,headers);
    return new Response(JSON.stringify({authenticated:true,user:{id:data.user.id,email,username:access.username,displayName:data.user.name||access.displayName,role:access.role},session:{expiresAt:data?.session?.expiresAt||null}}),{status:200,headers});
  }catch(error){console.error("WDCC_NEON_AUTH_SESSION_ERROR",error);return Response.json({authenticated:false,error:"auth_service_unavailable"},{status:503,headers:{"cache-control":"no-store"}});}
}
