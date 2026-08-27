"use client";

export async function uploadVehiclePhoto({vehicleId,requestId,file}:{vehicleId:string;requestId:string;file:File}){
  const form=new FormData();
  form.set("vehicleId",vehicleId);
  form.set("requestId",requestId);
  form.set("file",file,file.name);
  const response=await fetch("/api/upload",{method:"POST",credentials:"include",body:form,headers:{"X-WDCC-Request-ID":requestId}});
  const result:any=await response.json().catch(()=>({}));
  if(!response.ok||result?.ok!==true||!result?.pathname)throw Error(result?.error||`Photo upload failed (${response.status})`);
  return {pathname:String(result.pathname),provider:String(result.provider||"unknown"),sha256:String(result.sha256||"")};
}
