import {Suspense} from "react";
import VehicleEditor from "../VehicleEditor";

type Params={edit?:string|string[]};

export default async function VehicleEditorPage({searchParams}:{searchParams:Promise<Params>}){
  const params=await searchParams;
  const raw=Array.isArray(params.edit)?params.edit[0]:params.edit;
  const editorKey=raw?`edit:${raw}`:"new-vehicle";
  return <Suspense fallback={<main className="wdccGate">Loading vehicle editor…</main>}><VehicleEditor key={editorKey}/></Suspense>;
}
