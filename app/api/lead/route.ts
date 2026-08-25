import {GET as canonicalGET,POST as canonicalPOST} from "../leads/route";

export const dynamic="force-dynamic";

// /api/lead is a compatibility alias only. Runtime ownership, canonical V53
// routing, auth, idempotency, QA isolation and notifications all live in
// /api/leads so the two endpoints cannot drift onto different backends.
export async function GET(request:Request){
  return canonicalGET(request);
}

export async function POST(request:Request){
  return canonicalPOST(request);
}
