import {legacyAuthProxy} from "../../../../lib/legacyAuthProxy";

export const dynamic="force-dynamic";

export async function POST(request:Request){
  return legacyAuthProxy(request,"/api/auth/logout");
}
