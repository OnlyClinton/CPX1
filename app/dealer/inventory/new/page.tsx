import {Suspense} from "react";
import VehicleEditor from "../VehicleEditor";

export default function VehicleEditorPage(){
  return <Suspense fallback={<main className="wdccGate">Loading vehicle editor…</main>}><VehicleEditor/></Suspense>;
}
