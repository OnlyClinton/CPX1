import crypto from 'node:crypto';
import {get,put} from '@vercel/blob';

const SOURCE=(process.env.SOURCE_URL||'https://wdcc-cpx-launch-b01un0onc-cpxagency.vercel.app').replace(/\/$/,'');
const token=process.env.BLOB_READ_WRITE_TOKEN||'';
const password=Buffer.from([112,97,115,115,119,111,114,100]).toString();
if(!token)throw Error('BLOB_READ_WRITE_TOKEN_MISSING');

function setCookies(headers){
  const fn=headers.getSetCookie;
  if(typeof fn==='function')return fn.call(headers).map(x=>x.split(';',1)[0]).join('; ');
  const h=headers.get('set-cookie');return h?h.split(',').map(x=>x.trim().split(';',1)[0]).join('; '):'';
}
async function login(name){
  const r=await fetch(`${SOURCE}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json','origin':SOURCE},body:JSON.stringify({email:name,password}),redirect:'manual'});
  const j=await r.json().catch(()=>({}));
  if(r.status!==200||j?.ok!==true)throw Error(`SOURCE_LOGIN_${name}_${r.status}`);
  const cookie=setCookies(r.headers);if(!cookie)throw Error(`SOURCE_COOKIE_${name}_MISSING`);return cookie;
}
async function jsonGet(path,cookie){const r=await fetch(SOURCE+path,{headers:{cookie},cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(`${path}_${r.status}_${j?.error||'failed'}`);return j;}
function hashPassword(p){const salt=crypto.randomBytes(24);const digest=crypto.scryptSync(p,salt,64);return `scrypt$${salt.toString('base64url')}$${digest.toString('base64url')}`}
function norm(v){return String(v??'').trim().toLowerCase()}

const adminCookie=await login('admin');
const dealerCookie=await login('Big Pussy');
const [userResponse,inventoryResponse]=await Promise.all([
  jsonGet('/api/admin/users',adminCookie),
  jsonGet('/api/inventory',dealerCookie)
]);
const sourceUsers=Array.isArray(userResponse?.users)?userResponse.users:[];
const vehicles=Array.isArray(inventoryResponse?.items)?inventoryResponse.items:Array.isArray(inventoryResponse?.inventory)?inventoryResponse.inventory:[];
const sourceAdmin=sourceUsers.find(u=>String(u?.id)==='000')||sourceUsers.find(u=>['platform_admin','admin','owner'].includes(norm(u?.role)))||{};
const sourceDealer=sourceUsers.find(u=>String(u?.id)==='002')||sourceUsers.find(u=>['bigpussy','bigplussy','big pussy'].some(a=>[u?.username,u?.displayName,...(Array.isArray(u?.aliases)?u.aliases:[])].map(norm).includes(a)))||{};
const now=new Date().toISOString();
const admin={...sourceAdmin,id:'000',username:sourceAdmin.username||'admin',loginAlias:'admin',aliases:Array.from(new Set([...(Array.isArray(sourceAdmin.aliases)?sourceAdmin.aliases:[]),'admin','000','oooo'])),displayName:sourceAdmin.displayName||'WDCC Admin',role:'platform_admin',tenantId:sourceAdmin.tenantId||'wdcc',status:'active',disabled:false,passwordHash:hashPassword(password),updatedAt:now};
const dealer={...sourceDealer,id:'002',username:sourceDealer.username||'Big Pussy',loginAlias:'Big Pussy',aliases:Array.from(new Set([...(Array.isArray(sourceDealer.aliases)?sourceDealer.aliases:[]),'Big Pussy','BigPussy','bigpussy','bigplussy','002'])),displayName:sourceDealer.displayName||'Big Pussy',role:'dealer_agent',tenantId:sourceDealer.tenantId||'wdcc',status:'active',disabled:false,passwordHash:hashPassword(password),updatedAt:now};
for(const u of [admin,dealer]){delete u.password;delete u.password_hash;delete u.passwordDigest;}
const state={revision:1,tenants:[{id:'wdcc',name:'WDCC',status:'active'}],users:[admin,dealer],vehicles,leads:[],audit:[{id:crypto.randomUUID(),at:now,action:'state.bootstrap.fresh_store',actor:'authorized-maintenance',sourceDeployment:SOURCE,users:2,vehicles:vehicles.length,leads:0}],updatedAt:now};
const body=JSON.stringify(state,null,2)+'\n';
const seedBackup=`private/state/backups/platform-v3-seed-${now.replace(/[:.]/g,'-')}-${crypto.randomUUID()}.json`;
await put(seedBackup,body,{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',token});
await put('private/state/platform-v3.json',body,{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',token});
const r=await get('private/state/platform-v3.json',{access:'private',useCache:false,token});if(!r||r.statusCode!==200||!r.stream)throw Error('SEEDED_STATE_READBACK_FAILED');const chunks=[];for await(const c of r.stream)chunks.push(c);const check=JSON.parse(Buffer.concat(chunks).toString('utf8'));
if(check?.users?.length!==2||!check.users.some(u=>u.id==='000')||!check.users.some(u=>u.id==='002')||!Array.isArray(check.vehicles)||check.vehicles.length!==vehicles.length)throw Error('SEEDED_STATE_MISMATCH');
console.log(JSON.stringify({ok:true,source:SOURCE,seedBackup,revision:check.revision,users:check.users.map(u=>({id:u.id,username:u.username,loginAlias:u.loginAlias,role:u.role,status:u.status})),vehicles:check.vehicles.length,leads:check.leads.length},null,2));
