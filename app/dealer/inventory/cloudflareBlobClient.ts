type UploadOptions={
  access?:string;
  handleUploadUrl?:string;
  clientPayload?:string;
  contentType?:string;
};

export async function upload(pathname:string,body:Blob,options:UploadOptions={}){
  let payload:any={};
  try{payload=JSON.parse(options.clientPayload||"{}")}catch{}
  const vehicleId=String(payload.vehicleId||"");
  const requestId=String(payload.requestId||crypto.randomUUID()).slice(0,160);
  if(!vehicleId)throw Error("Vehicle ID missing for upload");
  const endpoint=new URL(options.handleUploadUrl||"/api/upload",window.location.origin);
  endpoint.searchParams.set("vehicleId",vehicleId);
  endpoint.searchParams.set("pathname",pathname);
  const response=await fetch(endpoint.toString(),{
    method:"POST",
    credentials:"include",
    headers:{"Content-Type":options.contentType||body.type||"application/octet-stream","X-WDCC-Request-ID":requestId},
    body
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result?.pathname)throw Error(result?.error||`Upload failed (${response.status})`);
  return {
    url:String(result.url||`/api/media?p=${encodeURIComponent(result.pathname)}`),
    downloadUrl:String(result.url||`/api/media?p=${encodeURIComponent(result.pathname)}`),
    pathname:String(result.pathname),
    contentType:String(result.contentType||options.contentType||body.type||"application/octet-stream"),
    size:Number(result.size||body.size||0),
    uploadedAt:new Date()
  };
}
