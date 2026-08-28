import {headers} from "next/headers";
import {isIsolatedWorkersDevPreview} from "../../../lib/visualPreviewGate";
import VehicleDetailsClient from "./VehicleDetailsClient";

export default async function Vehicle({params}:{params:Promise<{id:string}>}){
  const[{id},requestHeaders]=await Promise.all([params,headers()]);
  return <VehicleDetailsClient id={String(id||"")} allowVisualFixture={isIsolatedWorkersDevPreview(requestHeaders)}/>;
}
