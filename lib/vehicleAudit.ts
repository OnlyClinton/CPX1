import {recordVehicleEvent,recentVehicleEvents} from "./wdccDb";

export type VehicleAuditEvent={
  action:string;
  outcome:"ok"|"failed"|"denied";
  requestId:string;
  vehicleId?:string|null;
  actorId?:string|null;
  actorRole?:string|null;
  year?:number|null;
  make?:string|null;
  model?:string|null;
  mileage?:number|null;
  stock?:string|null;
  status?:string|null;
  photoCount?:number|null;
  detail?:string|null;
};

export async function recordVehicleAudit(input:VehicleAuditEvent){
  try{
    const record=await recordVehicleEvent(input);
    console.log("WDCC_VEHICLE_EVENT",JSON.stringify(record));
    return record;
  }catch{
    console.error("WDCC_VEHICLE_AUDIT_WRITE_FAILED",JSON.stringify({
      requestId:input.requestId,action:input.action,error:"audit_write_failed"
    }));
    return {id:null,at:new Date().toISOString(),...input};
  }
}

export async function readRecentVehicleAudit(max=100){
  return recentVehicleEvents(max);
}
