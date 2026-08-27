import http from "node:http";
import fs from "node:fs";
import crypto from "node:crypto";

const stateToken=process.env.STATE_TOKEN||"preview-state-token";
const mediaToken=process.env.MEDIA_TOKEN||"preview-media-token";
const password=process.env.PREVIEW_PASSWORD||"preview-only-password";
const hero=fs.readFileSync("public/wdcc-hero-v2.webp");
const now=new Date().toISOString();

let state={
  revision:10,
  tenants:[{id:"wdcc",name:"WDCC",status:"active"}],
  users:[
    {id:"wrong-first-dealer",tenantId:"wdcc",email:"other@internal.wedontcarecars.com",username:"other",displayName:"Wrong First Dealer",role:"dealer_agent",status:"active"},
    {id:"exact-dealer",tenantId:"wdcc",email:"dealer@internal.wedontcarecars.com",username:"dealer",loginAlias:"dealer",aliases:["dealer"],displayName:"WDCC Dealer",role:"dealer_agent",status:"active"},
    {id:"exact-admin",tenantId:"wdcc",email:"admin@internal.wedontcarecars.com",username:"admin",loginAlias:"admin",aliases:["admin"],displayName:"WDCC Admin",role:"platform_admin",status:"active"}
  ],
  vehicles:[],leads:[],audit:[],updatedAt:now
};

const media=new Map();
const makes=["Ford","Honda","Toyota","Kia","Nissan"];
const models=["F-150","Pilot","RAV4","Sportage","350Z"];
for(let i=1;i<=5;i++){
  const id=`fixture-${i}`;
  const path=`media/wdcc/${id}/hero.webp`;
  media.set(path,{body:hero,type:"image/webp"});
  state.vehicles.push({
    id,tenantId:"wdcc",year:2018+i,make:makes[i-1],model:models[i-1],trim:"",
    price:6900+i*1400,downPayment:1500+i*300,mileage:55000+i*17000,stock:`FIX-${i}`,
    status:"published",visibility:"public",internalOnly:false,transmission:"Automatic",
    drivetrain:i%2?"FWD":"AWD",fuelType:"Gasoline",description:"Preview-only local fixture vehicle.",
    photoPathnames:[path],primaryPhotoPathname:path,createdAt:now,updatedAt:now
  });
}

let conflictRemaining=1;
let failNextMedia=false;
const readBody=req=>new Promise((resolve,reject)=>{
  const chunks=[];
  req.on("data",chunk=>chunks.push(chunk));
  req.on("end",()=>resolve(Buffer.concat(chunks)));
  req.on("error",reject);
});
const send=(res,status,body,headers={})=>{
  const data=typeof body==="string"?body:JSON.stringify(body);
  res.writeHead(status,{"content-type":"application/json","cache-control":"no-store",...headers});
  res.end(data);
};

http.createServer(async(req,res)=>{
  const url=new URL(req.url,"http://local");
  if(req.method==="GET"&&url.pathname==="/health")return send(res,200,{ok:true,state:"readable",revision:state.revision});
  if(url.pathname!=="/state")return send(res,404,{ok:false,error:"not_found"});
  if(req.headers.authorization!==`Bearer ${stateToken}`)return send(res,401,{ok:false,error:"unauthorized"});
  if(req.method==="GET")return send(res,200,state,{"x-wdcc-state-revision":String(state.revision)});
  if(req.method==="PUT"){
    const next=JSON.parse((await readBody(req)).toString("utf8"));
    if(conflictRemaining>0){
      conflictRemaining--;
      state={...state,revision:state.revision+1,updatedAt:new Date().toISOString()};
      return send(res,409,{ok:false,error:"stale_revision",currentRevision:state.revision});
    }
    if(Number(next.revision)<=Number(state.revision))return send(res,409,{ok:false,error:"stale_revision",currentRevision:state.revision});
    state=next;
    return send(res,200,{ok:true,revision:state.revision});
  }
  return send(res,405,{ok:false,error:"method_not_allowed"});
}).listen(4101,"127.0.0.1");

http.createServer(async(req,res)=>{
  const url=new URL(req.url,"http://local");
  if(req.method==="POST"&&url.pathname==="/__control/fail-next"){
    if(req.headers.authorization!==`Bearer ${mediaToken}`)return send(res,401,{ok:false,error:"unauthorized"});
    failNextMedia=true;
    return send(res,200,{ok:true});
  }
  if(req.method==="GET"&&url.pathname==="/health")return send(res,200,{ok:true,storage:"ephemeral-preview-media"});
  if(url.pathname!=="/media")return send(res,404,{ok:false,error:"not_found"});
  if(req.headers.authorization!==`Bearer ${mediaToken}`)return send(res,401,{ok:false,error:"unauthorized"});
  const path=url.searchParams.get("p")||"";
  if(req.method==="PUT"){
    if(failNextMedia){failNextMedia=false;return send(res,503,{ok:false,error:"injected_media_failure"});}
    const body=await readBody(req);
    const type=String(req.headers["content-type"]||"application/octet-stream");
    const sha256=crypto.createHash("sha256").update(body).digest("hex");
    media.set(path,{body,type});
    return send(res,200,{ok:true,sha256,bytes:body.length});
  }
  if(req.method==="GET"||req.method==="HEAD"){
    const item=media.get(path);
    if(!item){res.writeHead(404,{"cache-control":"no-store"});return res.end();}
    res.writeHead(200,{"content-type":item.type,"content-length":String(item.body.length),"cache-control":"no-store"});
    return res.end(req.method==="HEAD"?undefined:item.body);
  }
  if(req.method==="DELETE"){
    media.delete(path);
    return send(res,200,{ok:true});
  }
  return send(res,405,{ok:false,error:"method_not_allowed"});
}).listen(4102,"127.0.0.1");

http.createServer(async(req,res)=>{
  const url=new URL(req.url,"http://local");
  if(req.method==="GET"&&url.pathname==="/health")return send(res,200,{ok:true,service:"preview-neon-auth"});
  if(req.method==="POST"&&url.pathname==="/sign-in/email"){
    const body=JSON.parse((await readBody(req)).toString("utf8")||"{}");
    const email=String(body.email||"").toLowerCase();
    if(body.password!==password||!["dealer@internal.wedontcarecars.com","admin@internal.wedontcarecars.com"].includes(email))return send(res,401,{error:"invalid_credentials"});
    return send(res,200,{user:{email,name:email.startsWith("admin@")?"WDCC Admin":"WDCC Dealer"}},{"set-cookie":`wdcc_neon_preview=${encodeURIComponent(email)}; Path=/; HttpOnly; SameSite=Lax`});
  }
  if(req.method==="GET"&&url.pathname==="/get-session"){
    const cookie=String(req.headers.cookie||"");
    const match=cookie.match(/(?:^|;\s*)wdcc_neon_preview=([^;]+)/);
    if(!match)return send(res,401,{user:null});
    const email=decodeURIComponent(match[1]);
    return send(res,200,{session:{active:true},user:{email,name:email.startsWith("admin@")?"WDCC Admin":"WDCC Dealer"}});
  }
  return send(res,404,{ok:false,error:"not_found"});
}).listen(4103,"127.0.0.1");

console.log("WDCC_LOCAL_FIXTURES_READY");
