import {legacyAuthProxy} from "../../../../lib/legacyAuthProxy";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  return legacyAuthProxy(request,"/api/auth/session");
}
