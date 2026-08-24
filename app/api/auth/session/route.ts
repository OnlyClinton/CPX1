import {NextResponse} from "next/server";
import {currentUser} from "../../../../lib/auth";
export const dynamic="force-dynamic";
export async function GET(){
  const u=await currentUser();
  if(!u){
    return NextResponse.json(
      {authenticated:false,user:null,session:null},
      {headers:{"Cache-Control":"private, no-store"}}
    );
  }
  const role=String((u as any).role??"");
  const tenantId=(u as any).tenantId??null;
  const user={
    id:String((u as any).id??""),
    email:String((u as any).email??""),
    username:String((u as any).username??""),
    role,tenantId
  };
  return NextResponse.json({
    authenticated:true,role,user,
    session:{email:user.email,role,tenantId,mustChangePassword:false}
  },{headers:{"Cache-Control":"private, no-store"}});
}

