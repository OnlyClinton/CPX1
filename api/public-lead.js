const crypto=require("node:crypto");

const MAX_BODY_BYTES=64*1024;
const FORWARDED_HEADERS=["user-agent","accept-language","x-forwarded-for","x-vercel-forwarded-for","cf-connecting-ip"];

function send(res,status,body,extraHeaders={}){
  res.statusCode=status;
  res.setHeader("content-type","application/json; charset=utf-8");
  res.setHeader("cache-control","no-store");
  res.setHeader("x-wdcc-legacy-lead-route","canonical-forward-v1");
  for(const[name,value]of Object.entries(extraHeaders))if(value)res.setHeader(name,value);
  res.end(JSON.stringify(body));
}

function readBody(req){
  let value=req.body;
  if(Buffer.isBuffer(value)){
    if(value.byteLength>MAX_BODY_BYTES)throw Error("lead_payload_too_large");
    value=value.toString("utf8");
  }
  if(typeof value==="string"){
    if(Buffer.byteLength(value,"utf8")>MAX_BODY_BYTES)throw Error("lead_payload_too_large");
    try{value=JSON.parse(value);}catch{throw Error("invalid_request_body");}
  }
  if(!value||typeof value!=="object"||Array.isArray(value))throw Error("invalid_request_body");
  return value;
}

function canonicalLeadUrl(){
  const explicit=String(process.env.WDCC_CANONICAL_LEAD_URL||"").trim();
  const backend=String(process.env.WDCC_DEALER_BACKEND_URL||"").trim();
  if(!explicit&&!backend)return null;
  let target;
  try{target=explicit?new URL(explicit):new URL("/api/leads",`${backend.replace(/\/+$/g,"")}/`);}catch{return null;}
  if(target.username||target.password||target.search||target.hash||target.pathname!=="/api/leads")return null;
  if(target.protocol==="https:")return target;
  const environment=String(process.env.WDCC_ENVIRONMENT||"").trim().toLowerCase();
  const local=target.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(target.hostname);
  return local&&["dev","development","e2e","test"].includes(environment)?target:null;
}

function canonicalPayload(body,idempotencyKey){
  const first=String(body.first??body.firstName??"").trim();
  const last=String(body.last??body.lastName??"").trim();
  const suppliedName=String(body.name??"").trim();
  return {
    ...body,
    kind:body.kind??body.type??body.intent,
    name:suppliedName||`${first} ${last}`.trim(),
    downPayment:body.downPayment??body.down,
    vehicleInterest:body.vehicleInterest??body.desiredVehicle??body.vehicle,
    idempotencyKey
  };
}

module.exports=async function publicLeadCanonicalForward(req,res){
  if(req.method!=="POST")return send(res,405,{ok:false,persisted:false,error:"method_not_allowed"},{allow:"POST"});
  const target=canonicalLeadUrl();
  if(!target)return send(res,503,{ok:false,persisted:false,error:"canonical_lead_authority_unavailable"},{"retry-after":"5"});

  try{
    const body=readBody(req);
    const suppliedKey=String(req.headers?.["idempotency-key"]??body.idempotencyKey??"").trim().slice(0,160);
    const idempotencyKey=suppliedKey||crypto.randomUUID();
    const headers={"content-type":"application/json","accept":"application/json","idempotency-key":idempotencyKey};
    for(const name of FORWARDED_HEADERS){
      const value=req.headers?.[name];
      if(typeof value==="string"&&value.trim())headers[name]=value.trim().slice(0,500);
    }
    const upstream=await fetch(target,{
      method:"POST",headers,body:JSON.stringify(canonicalPayload(body,idempotencyKey)),
      redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(12_000)
    });
    const text=await upstream.text();
    let result;
    try{result=text?JSON.parse(text):{};}catch{return send(res,502,{ok:false,persisted:false,error:"canonical_lead_invalid_response"},{"retry-after":"5"});}
    return send(res,upstream.status,result,{
      "x-wdcc-data-authority":upstream.headers.get("x-wdcc-data-authority")||"neon",
      "x-wdcc-canonical-lead-status":String(upstream.status)
    });
  }catch(error){
    const code=error instanceof Error?error.message:"canonical_lead_forward_failed";
    if(code==="invalid_request_body")return send(res,400,{ok:false,persisted:false,error:code});
    if(code==="lead_payload_too_large")return send(res,413,{ok:false,persisted:false,error:code});
    console.error("WDCC_LEGACY_PUBLIC_LEAD_FORWARD_ERROR",code);
    return send(res,503,{ok:false,persisted:false,error:"canonical_lead_authority_unavailable"},{"retry-after":"5"});
  }
};
