import {NextResponse} from "next/server";

export const dynamic="force-dynamic";

export async function GET(){
  return NextResponse.json({
    ok:true,
    vercelEnv:process.env.VERCEL_ENV||null,
    hasDatabaseUrl:Boolean((process.env.DATABASE_URL||"").trim()),
    hasPostgresUrl:Boolean((process.env.POSTGRES_URL||"").trim()),
    hasNeonDatabaseUrl:Boolean((process.env.NEON_DATABASE_URL||"").trim()),
    hasBlobToken:Boolean((process.env.BLOB_READ_WRITE_TOKEN||"").trim()),
    hasBlobStoreId:Boolean((process.env.BLOB_STORE_ID||"").trim())
  },{headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});
}
