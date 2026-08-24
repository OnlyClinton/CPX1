import {NextResponse} from "next/server";

export const dynamic="force-dynamic";

export async function GET(){
  return NextResponse.json({ok:false,error:"not_found"},{status:404,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
}

export async function POST(){
  return NextResponse.json({ok:false,error:"not_found"},{status:404,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
}
