const crypto=require('node:crypto');
const {put}=require('@vercel/blob');

function send(res,status,obj){res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.setHeader('cache-control','no-store');res.end(JSON.stringify(obj))}
function body(req){let b=req.body;if(Buffer.isBuffer(b))b=b.toString('utf8');if(typeof b==='string')try{b=JSON.parse(b)}catch{b={}};return b&&typeof b==='object'?b:{}}
function key(token){const configured=String(process.env.WDCC_LEAD_ENCRYPTION_KEY||'').trim();if(!configured)throw new Error('lead_encryption_key_not_configured');return crypto.createHash('sha256').update(configured+'|wdcc-lead-v2').digest()}
function encrypt(obj,token){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(token),iv);const plain=Buffer.from(JSON.stringify(obj));const ct=Buffer.concat([cipher.update(plain),cipher.final()]);return {v:2,alg:'A256GCM',iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),data:ct.toString('base64url')}}
function marker(v){const text=Object.values(v||{}).map(x=>String(x||'')).join(' ');const m=text.match(/\bTEST-[A-Z0-9-]{3,48}\b/i);return m?m[0].toUpperCase():null}
module.exports=async function(req,res){
  if(req.method!=='POST')return send(res,405,{ok:false,error:'method_not_allowed'});
  try{
    const token=process.env.BLOB_READ_WRITE_TOKEN||process.env.WDCC_MEDIA_BLOB_READ_WRITE_TOKEN;
    if(!token)return send(res,503,{ok:false,error:'lead_store_not_bound'});
    if(!String(process.env.WDCC_LEAD_ENCRYPTION_KEY||'').trim())return send(res,503,{ok:false,error:'lead_encryption_not_bound'});
    const b=body(req),phone=String(b.phone||'').trim(),email=String(b.email||'').trim();
    if(!phone&&!email)return send(res,400,{ok:false,error:'contact_required'});
    const createdAt=new Date().toISOString(),leadId=crypto.randomUUID();
    const lead={schemaVersion:2,leadId,createdAt,intent:String(b.intent||b.type||'lead').slice(0,80),source:String(b.source||'wedontcarecars.com').slice(0,120),first:String(b.first||b.firstName||'').slice(0,120),last:String(b.last||b.lastName||'').slice(0,120),phone:phone.slice(0,80),email:email.slice(0,180),down:String(b.down||b.downPayment||'').slice(0,80),city:String(b.city||'').slice(0,120),vehicle:String(b.vehicle||'').slice(0,240),message:String(b.message||b.notes||'').slice(0,3000),consent:Boolean(b.consent),testMarker:marker(b)};
    const envelope=encrypt(lead,token),d=new Date(createdAt);const path=`private/wdcc/leads/${d.getUTCFullYear()}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${Date.now()}-${leadId}.json.enc`;
    const saved=await put(path,Buffer.from(JSON.stringify(envelope)),{access:'private',token,addRandomSuffix:false,contentType:'application/octet-stream'});
    console.log('WDCC_LEAD_STORED',JSON.stringify({leadId,createdAt,intent:lead.intent,testMarker:lead.testMarker,persistence:'private-encrypted-blob-ledger'}));
    return send(res,201,{ok:true,leadId,createdAt,testMarker:lead.testMarker,persistence:'private-encrypted-blob-ledger',receiptPath:saved.pathname||path});
  }catch(e){console.error('WDCC_LEAD_STORE_ERROR',String(e?.message||e));return send(res,500,{ok:false,error:'lead_store_failed'})}
};
