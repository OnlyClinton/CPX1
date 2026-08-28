import {Suspense} from "react";
import {headers} from "next/headers";
import VehicleEditor from "../VehicleEditor";
import {isIsolatedWorkersDevPreview} from "../../../../lib/visualPreviewGate";

export default async function VehicleEditorPage(){
  const allowVisualProof=isIsolatedWorkersDevPreview(await headers());
  return <Suspense fallback={<main className="wdccGate">Loading vehicle editor…</main>}><VehicleEditor allowVisualProof={allowVisualProof}/></Suspense>;
}
