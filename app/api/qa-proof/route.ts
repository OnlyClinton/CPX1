import {NextResponse} from "next/server";
import {readState,writeState} from "../../../lib/store";

export const dynamic="force-dynamic";
const BACKEND_PROJECT_ID="prj_a3oclCcy4sbA2tge4BX7VAKXE4KR";
const LEAD_ID="qa-proof-lead-20260824";
const VEHICLE_ID="qa-proof-vehicle-20260824";
const MARKER="TEST-WDCC-CRM-INVENTORY-20260824";

export async function POST(req:Request){
  const host=new URL(req.url).host.toLowerCase();
  const project=process.env.VERCEL_PROJECT_ID||"";
  if(project!==BACKEND_PROJECT_ID && !host.includes("wdcc-cpx-launch"))return NextResponse.json({ok:false,error:"backend_only"},{status:404});
  const state=await readState();const now=new Date().toISOString();let leadCreated=false,vehicleCreated=false,publishedTransition=false,changed=false;
  if(!state.leads.some((x:any)=>String(x.id)===LEAD_ID)){
    state.leads.push({id:LEAD_ID,tenantId:"wdcc",kind:"contact",name:"WDCC QA Proof Lead",phone:"813-555-0199",email:"qa-proof@invalid.example",vehicleInterest:"QA verification only",message:`${MARKER} fixed idempotent production proof`,preferredTime:"QA only",consent:true,status:"new",source:"qa-proof",createdBy:"system-qa-proof",createdByRole:"system",requestId:MARKER,createdAt:now,updatedAt:now});leadCreated=true;changed=true;
  }
  let vehicle:any=state.vehicles.find((x:any)=>String(x.id)===VEHICLE_ID);
  if(!vehicle){
    vehicle={id:VEHICLE_ID,tenantId:"wdcc",year:2017,make:"Toyota",model:"Camry",trim:"QA PROOF",price:9999,downPayment:1999,mileage:88000,stock:"R36TEST-QA-PROOF-20260824",description:`${MARKER} fixed idempotent publish-path proof`,badges:["R36-TEST"],photoPathnames:[],primaryPhotoPathname:null,featured:false,status:"draft",createdAt:now,updatedAt:now};state.vehicles.push(vehicle);vehicleCreated=true;changed=true;
  }
  if(vehicle.status!=="published"||vehicle.stock!=="R36TEST-QA-PROOF-20260824"){
    vehicle.status="published";vehicle.stock="R36TEST-QA-PROOF-20260824";vehicle.badges=["R36-TEST"];vehicle.updatedAt=now;publishedTransition=true;changed=true;
  }
  if(changed){state.audit.push({id:`qa-proof-audit-${Date.now()}`,at:now,action:"qa.proof.publish",actor:"system-qa-proof",leadId:LEAD_ID,vehicleId:VEHICLE_ID,marker:MARKER,publishedTransition});await writeState(state);}
  const verify=await readState();
  return NextResponse.json({ok:true,marker:MARKER,leadCreated,vehicleCreated,publishedTransition,lead:verify.leads.find((x:any)=>String(x.id)===LEAD_ID)||null,vehicle:verify.vehicles.find((x:any)=>String(x.id)===VEHICLE_ID)||null,counts:{leads:verify.leads.length,vehicles:verify.vehicles.length,audit:verify.audit.length}},{headers:{"Cache-Control":"no-store"}});
}
