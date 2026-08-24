const { put } = require("@vercel/blob");
const crypto=require("node:crypto");
const { backupVehicleMedia } = require("./_drive");
const BACKEND="https://wdcc-cpx-launch-1g64ifw47-cpxagency.vercel.app";
const MAX=4000000;
const ALLOWED=new Set(["image/jpeg","image/png","image/webp","image/avif"]);

function send(res,status,obj){
  res.statusCode=status;
  res.setHeader("content-type","application/json; charset=utf-8");
  res.setHeader("cache-control","private, no-store");
  res.end(JSON.stringify(obj));
}
async function session(cookie){
  if(!cookie)return null;
  const r=await fetch(BACKEND+"/api/auth/session",{headers:{cookie,"cache-control":"no-store"}});
  if(!r.ok)return null;
  const j=await r.json().catch(()=>null);
  return j&&j.authenticated?j:null;
}
function safeEqual(a,b){
  try{
    const A=Buffer.from(String(a));
    const B=Buffer.from(String(b));
    return A.length===B.length&&crypto.timingSafeEqual(A,B);
  }catch{return false}
}
function verifyCapability(cap,vehicleId,secret){
  if(!cap||!secret)return false;
  const i=cap.lastIndexOf(".");
  if(i<1)return false;
  const payload=cap.slice(0,i),sig=cap.slice(i+1);
  const expected=crypto.createHmac("sha256",secret).update(payload).digest("base64url");
  if(!safeEqual(sig,expected))return false;
  let j;
  try{j=JSON.parse(Buffer.from(payload,"base64url").toString("utf8"))}catch{return false}
  if(String(j.id)!==String(vehicleId))return false;
  if(!Number.isFinite(Number(j.exp))||Date.now()>Number(j.exp))return false;
  if(j.purpose!=="vehicle-photo")return false;
  return true;
}
async function bodyBuffer(req){
  if(Buffer.isBuffer(req.body))return req.body;
  if(req.body instanceof Uint8Array)return Buffer.from(req.body);
  if(typeof req.body==="string")return Buffer.from(req.body,"binary");
  return await new Promise((resolve,reject)=>{
    const chunks=[];let n=0;
    req.on("data",c=>{n+=c.length;if(n>MAX){reject(new Error("too_large"));req.destroy();return}chunks.push(Buffer.from(c))});
    req.on("end",()=>resolve(Buffer.concat(chunks)));
    req.on("error",reject);
  });
}
function safeName(v,type){
  const ext=type==="image/png"?".png":type==="image/webp"?".webp":type==="image/avif"?".avif":".jpg";
  let n=String(v||"vehicle-photo").replace(/\.[^.]+$/,"").replace(/[^A-Za-z0-9._-]+/g,"-").slice(0,80);
  return (n||"vehicle-photo")+ext;
}

module.exports=async function(req,res){
  try{
    if(req.method!=="POST")return send(res,405,{ok:false,error:"method_not_allowed"});
    const cookie=String(req.headers.cookie||"");
    if(!(await session(cookie)))return send(res,401,{ok:false,error:"unauthenticated"});

    const token=process.env.WDCC_MEDIA_BLOB_READ_WRITE_TOKEN||process.env.BLOB_READ_WRITE_TOKEN;
    if(!token)return send(res,503,{ok:false,error:"media_store_not_bound"});

    const u=new URL(req.url,"https://dealer.wedontcarecars.com");
    const vehicleId=String(u.searchParams.get("vehicleId")||"").trim();
    if(!vehicleId)return send(res,400,{ok:false,error:"vehicle_id_required"});

    const cap=String(req.headers["x-wdcc-upload-capability"]||"");
    if(!verifyCapability(cap,vehicleId,token)){
      return send(res,403,{ok:false,error:"invalid_or_expired_upload_capability"});
    }

    const origin=String(req.headers.origin||"");
    if(origin){try{const h=new URL(origin).hostname;if(h!=="dealer.wedontcarecars.com"&&!h.endsWith("-cpxagency.vercel.app"))return send(res,403,{ok:false,error:"invalid_origin"})}catch{return send(res,403,{ok:false,error:"invalid_origin"})}}

    const type=String(req.headers["content-type"]||"").split(";")[0].trim().toLowerCase();
    if(!ALLOWED.has(type))return send(res,415,{ok:false,error:"unsupported_image_type"});

    const declared=Number(req.headers["content-length"]||0);
    if(declared>MAX)return send(res,413,{ok:false,error:"image_too_large_after_compression"});

    const body=await bodyBuffer(req);
    if(!body.length)return send(res,400,{ok:false,error:"empty_image"});
    if(body.length>MAX)return send(res,413,{ok:false,error:"image_too_large_after_compression"});

    const filename=safeName(u.searchParams.get("name"),type);
    const blob=await put(`media/wdcc/${vehicleId}/${Date.now()}-${filename}`,body,{
      access:"public",
      token,
      addRandomSuffix:true,
      contentType:type,
      cacheControlMaxAge:31536000
    });
    const backup=await backupVehicleMedia({vehicleId,filename,body,contentType:type,blobUrl:blob.url,blobPathname:blob.pathname});
    return send(res,201,{ok:true,url:blob.url,pathname:blob.pathname,size:body.length,contentType:type,backup});
  }catch(err){
    console.error("WDCC_MEDIA_UPLOAD_ERROR",err);
    const msg=String(err?.message||"media_upload_failed");
    return send(res,msg==="too_large"?413:500,{ok:false,error:msg.slice(0,160)});
  }
};
