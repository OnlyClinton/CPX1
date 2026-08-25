import crypto from 'node:crypto';
import {get,put} from '@vercel/blob';

const PATH='private/state/platform-v3.json';
const ADMIN_HASH='scrypt$Qa68zYS_v5mbOILTuEc8lA$QBLxEFPuDR6yJAFD9CFl2rK-krJDxvW8CD45FPb-tDXF6UJEGAeO0kzDHEDRi8n4mbJPJkQC-YEdDMLsb5NUog';
const DEALER_HASH='scrypt$1Ny0VuMBDahBpCmomM6rew$RZXt0YQvmLT6A-gMGaDigXBqw6X3zasfw20SxiaXS5MN4HI-zwFuRAmGWlIa1evzFjDmwwkETQ-mY5CO_DzrvA';
const norm=v=>String(v??'').trim().toLowerCase();
const ids=u=>[u?.id,u?.email,u?.secondaryEmail,u?.username,u?.loginAlias,...(Array.isArray(u?.aliases)?u.aliases:[])].map(norm).filter(Boolean);

async function read(){
  const r=await get(PATH,{access:'private',useCache:false});
  if(!r||r.statusCode!==200||!r.stream)throw new Error('STATE_READ_FAILED');
  const chunks=[]; for await(const c of r.stream)chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function pick(users,kind){
  const exact=users.find(u=>String(u?.id??'')===(kind==='admin'?'000':'002'));
  if(exact)return exact;
  const matches=users.filter(u=>{
    const a=ids(u);
    return kind==='admin'
      ? norm(u?.role)==='platform_admin'||a.some(x=>['admin','oooo','chyphnx@pm.me'].includes(x))
      : a.some(x=>['bigpussy','big pussy','bigplussy','bigcatscrap@gmail.com','sean@wedontcarecars.com'].includes(x));
  });
  if(matches.length!==1)throw new Error(`${kind.toUpperCase()}_USER_NOT_UNIQUE_${matches.length}`);
  return matches[0];
}

const state=await read();
if(!Array.isArray(state.users))throw new Error('USERS_MISSING');
const admin=pick(state.users,'admin');
const dealer=pick(state.users,'dealer');
if(admin===dealer)throw new Error('ADMIN_DEALER_COLLISION');

const oldRevision=Number(state.revision||0);
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const preBackup=`private/state/backups/platform-v3-pre-login-reset-r${oldRevision}-${stamp}-${crypto.randomUUID()}.json`;
const before=JSON.stringify(state,null,2)+'\n';
await put(preBackup,before,{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json'});

admin.passwordHash=ADMIN_HASH;
admin.status='active';
admin.disabled=false;
admin.loginAlias='admin';
admin.aliases=Array.from(new Set([...(Array.isArray(admin.aliases)?admin.aliases:[]),'admin','000']));

dealer.passwordHash=DEALER_HASH;
dealer.status='active';
dealer.disabled=false;
dealer.loginAlias='Big Pussy';
dealer.aliases=Array.from(new Set([...(Array.isArray(dealer.aliases)?dealer.aliases:[]),'Big Pussy','bigpussy','002']));

state.revision=oldRevision+1;
state.updatedAt=new Date().toISOString();
const after=JSON.stringify(state,null,2)+'\n';
const postBackup=`private/state/backups/platform-v3-login-reset-r${state.revision}-${stamp}-${crypto.randomUUID()}.json`;
await put(postBackup,after,{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json'});
await put(PATH,after,{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});

const check=await read();
const a=pick(check.users,'admin');
const d=pick(check.users,'dealer');
const ok=Number(check.revision)===state.revision&&a.passwordHash===ADMIN_HASH&&d.passwordHash===DEALER_HASH&&a.disabled===false&&d.disabled===false&&ids(a).includes('admin')&&ids(d).includes('big pussy');
if(!ok)throw new Error('READBACK_VERIFY_FAILED');
console.log('RESET_RESULT='+JSON.stringify({ok:true,fromRevision:oldRevision,toRevision:state.revision,adminId:String(a.id),dealerId:String(d.id),adminRole:String(a.role||''),dealerRole:String(d.role||''),preBackup,postBackup}));
