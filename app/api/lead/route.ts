import {GET as canonicalGET,POST as canonicalPOST} from "../leads/route";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  return canonicalGET(request);
}

export async function POST(request:Request){
  return canonicalPOST(request);
}
