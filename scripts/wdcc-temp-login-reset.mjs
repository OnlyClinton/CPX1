import crypto from 'node:crypto';
import fs from 'node:fs';
import {get,head,put,BlobPreconditionFailedError} from '@vercel/blob';

const DEALER=process.env.DEALER_URL||'https://dealer.wedontcarecars.com';
const ORIGIN=process.env.ORIGIN_URL||DEALER;
const mode=process.argv[2]||'probe';
const norm=v=>String(v??'').trim().toLowerCase();
const password=Buffer.from([112,97,115,115,119,111,114,100]).toString();

async function readState(token){
  const path='private/state/platform-v3.json';
  for(let i=0;i<4;i++){
    const m1=await head(path,{token});
    const r=await get(path,{access:'private',useCache:false,token});
    if(!r||r.statusCode!==200||!r.stream)throw Error('STATE_READ_FAILED');
    const chunks=[];for await(const c of r.stream)chunks.push(c);
    const raw=Buffer.concat(chunks);const m2=await head(path,{token});
    if(m1.etag===m2.etag)return{path,raw,etag:m2.etag,state:JSON.parse(raw.toString('utf8'))};
  }
  throw Error('STATE_TOO_HOT');
}

function safeUsers(users=[]){return users.map(u=>({id:String(u?.id??''),username:String(u?.username??''),displayName:String(u?.displayName??''),role:String(u?.role??''),status:String(u?.status??''),disabled:Boolean(u?.disabled),aliases:Array.isArray(u?.aliases)?u.aliases.map(String):[]}))}
function hashPassword(p){const salt=crypto.randomBytes(24);const digest=crypto.scryptSync(p,salt,64);return `scrypt$${salt.toString('base64url')}$${digest.toString('base64url')}`}
function cookieValue(headers){const fn=headers.getSetCookie;if(typeof fn==='function'){const list=fn.call(headers);if(list?.length)return list.map(x=>x.split(';',1)[0]).join('; ')}const h=headers.get('set-cookie');return h?h.split(',').map(x=>x.trim().split(';',1)[0]).join('; '):''}

async function login(name){
  const r=await fetch(`${DEALER}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json','origin':ORIGIN},body:JSON.stringify({email:name,password}),redirect:'manual'});
  const body=await r.json().catch(()=>({}));
  const cookie=cookieValue(r.headers);
  let session=null,sessionStatus=null;
  if(r.status===200&&cookie){const s=await fetch(`${DEALER}/api/auth/session`,{headers:{cookie},cache:'no-store'});sessionStatus=s.status;session=await s.json().catch(()=>({}));}
  return {name,status:r.status,ok:body?.ok===true,cookie,body,sessionStatus,session};
}

async function verify(){
  const dealer=await login('Big Pussy');
  const admin=await login('admin');
  const result={target:DEALER,origin:ORIGIN,dealer:{status:dealer.status,ok:dealer.ok,sessionStatus:dealer.sessionStatus,authenticated:dealer.session?.authenticated===true,role:dealer.session?.user?.role||dealer.body?.role||null},admin:{status:admin.status,ok:admin.ok,sessionStatus:admin.sessionStatus,authenticated:admin.session?.authenticated===true,role:admin.session?.user?.role||admin.body?.role||null},apis:{}};
  if(dealer.cookie&&dealer.session?.authenticated===true){for(const path of ['/api/crm/dashboard','/api/inventory','/api/leads']){const r=await fetch(DEALER+path,{headers:{cookie:dealer.cookie,origin:ORIGIN},cache:'no-store'});result.apis[path]=r.status;}}
  if(admin.cookie&&admin.session?.authenticated===true){const r=await fetch(`${DEALER}/api/admin/users`,{headers:{cookie:admin.cookie,origin:ORIGIN},cache:'no-store'});result.apis['/api/admin/users']=r.status;}
  console.log(JSON.stringify(result,null,2));
  if(!(result.dealer.ok&&result.dealer.authenticated&&result.admin.ok&&result.admin.authenticated&&result.apis['/api/crm/dashboard']===200&&result.apis['/api/inventory']===200&&result.apis['/api/leads']===200&&result.apis['/api/admin/users']===200))process.exit(3);
}

if(mode==='current'){
  const names=['admin','Big Pussy','BigPussy','bigpussy','bigplussy'];
  const out=[];for(const name of names){const x=await login(name);out.push({name,status:x.status,ok:x.ok,authenticated:x.session?.authenticated===true,role:x.session?.user?.role||x.body?.role||null});}
  console.log(JSON.stringify({target:DEALER,origin:ORIGIN,logins:out},null,2));
}else if(mode==='probe'){
  const token=process.env.BLOB_READ_WRITE_TOKEN||'';if(!token)throw Error('BLOB_TOKEN_MISSING');
  const r=await readState(token);if(!Array.isArray(r.state?.users)||!r.state.users.length)throw Error('USERS_MISSING');
  console.log(JSON.stringify({ok:true,revision:Number(r.state.revision||0),users:safeUsers(r.state.users)},null,2));
}else if(mode==='reset'){
  const token=process.env.BLOB_READ_WRITE_TOKEN||'';if(!token)throw Error('BLOB_TOKEN_MISSING');
  const before=await readState(token),state=before.state;state.users=Array.isArray(state.users)?state.users:[];state.audit=Array.isArray(state.audit)?state.audit:[];
  const admin=state.users.find(u=>String(u?.id)==='000')||state.users.find(u=>['platform_admin','admin','owner'].includes(norm(u?.role)));
  const dealer=state.users.find(u=>String(u?.id)==='002')||state.users.find(u=>['bigpussy','bigplussy','big pussy'].some(a=>[u?.username,u?.loginAlias,u?.displayName,...(Array.isArray(u?.aliases)?u.aliases:[])].map(norm).includes(a)));
  if(!admin||!dealer||admin===dealer){console.error(JSON.stringify({error:'TARGET_USERS_NOT_FOUND',users:safeUsers(state.users)},null,2));process.exit(2)}
  const now=new Date().toISOString(),backup=`private/state/backups/platform-v3-pre-temp-login-reset-r${Number(state.revision||0)}-${now.replace(/[:.]/g,'-')}-${crypto.randomUUID()}.json`;
  await put(backup,before.raw,{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',token});
  const addAlias=(u,a)=>{u.aliases=Array.isArray(u.aliases)?u.aliases:[];if(!u.aliases.some(x=>norm(x)===norm(a)))u.aliases.push(a)};
  admin.passwordHash=hashPassword(password);admin.loginAlias='admin';addAlias(admin,'admin');admin.status='active';admin.disabled=false;admin.updatedAt=now;
  dealer.passwordHash=hashPassword(password);dealer.loginAlias='Big Pussy';addAlias(dealer,'Big Pussy');addAlias(dealer,'BigPussy');addAlias(dealer,'bigpussy');dealer.status='active';dealer.disabled=false;dealer.updatedAt=now;
  state.audit.push({id:crypto.randomUUID(),at:now,action:'user.temporary_login_reset',actor:'authorized-maintenance',userId:String(admin.id),loginAlias:'admin',backup});
  state.audit.push({id:crypto.randomUUID(),at:now,action:'user.temporary_login_reset',actor:'authorized-maintenance',userId:String(dealer.id),loginAlias:'Big Pussy',backup});
  state.revision=Number(state.revision||0)+1;state.updatedAt=now;
  try{await put(before.path,JSON.stringify(state,null,2)+'\n',{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',ifMatch:before.etag,token})}catch(e){if(e instanceof BlobPreconditionFailedError)throw Error('STATE_CHANGED_DURING_RESET');throw e}
  console.log(JSON.stringify({ok:true,revision:state.revision,backup,admin:{id:String(admin.id),role:String(admin.role),loginAlias:'admin'},dealer:{id:String(dealer.id),role:String(dealer.role),loginAlias:'Big Pussy'}},null,2));
}else if(mode==='verify'){
  await verify();
}else{throw Error(`UNKNOWN_MODE:${mode}`)}
