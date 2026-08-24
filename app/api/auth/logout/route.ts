import {NextResponse} from "next/server";
import {clearSession} from "../../../../lib/auth";

export const dynamic="force-dynamic";

export async function POST(){
  try{
    await clearSession();
    return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    return NextResponse.json({ok:false,error:error instanceof Error?error.message:"logout_failed"},{status:500,headers:{"Cache-Control":"no-store"}});
  }
}
