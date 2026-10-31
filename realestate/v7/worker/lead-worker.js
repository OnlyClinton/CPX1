/** Cloudflare Worker: deploy only after binding a dedicated D1 database and rotating LEAD_BEARER_TOKEN. */
export default {async fetch(request,env){
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  const reply=(code,body)=>new Response(JSON.stringify(body),{status:code,headers});
  if(request.method!=='POST')return reply(405,{error:'method_not_allowed'});
  if(!env.LEADS_DB||!env.LEAD_BEARER_TOKEN||!env.IP_HASH_SALT)return reply(503,{error:'not_configured'});
  if(request.headers.get('Authorization')!==`Bearer ${env.LEAD_BEARER_TOKEN}`)return reply(403,{error:'unauthorized'});
  if(Number(request.headers.get('Content-Length')||0)>6000)return reply(413,{error:'too_large'});
  let b;try{b=await request.json()}catch{return reply(400,{error:'invalid_json'})}
  const t=x=>typeof x==='string'?x.trim():'';
  const name=t(b.name),email=t(b.email).toLowerCase(),company=t(b.company),role=t(b.role);
  if(b.consent!==true||name.length<2||name.length>100||company.length<2||company.length>130||email.length>180||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['Brokerage','Property manager','Owner','Other'].includes(role))return reply(400,{error:'invalid_input'});
  const now=Date.now(),window=Math.floor(now/3600000),ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const hashInput=new TextEncoder().encode(env.IP_HASH_SALT+':'+ip+':'+window),digest=await crypto.subtle.digest('SHA-256',hashInput);
  const key=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  const count=await env.LEADS_DB.prepare('SELECT n FROM cpx_lead_rate WHERE fingerprint=?').bind(key).first();
  if(count&&count.n>=5)return reply(429,{error:'rate_limited'});
  const id=crypto.randomUUID(),timestamp=new Date(now).toISOString();
  try{await env.LEADS_DB.batch([
    env.LEADS_DB.prepare('INSERT INTO cpx_leads (id, name, email, company, role, marketing_opt_in, consent_recorded_at, created_at, status) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,name,email,company,role,b.marketing===true?1:0,timestamp,timestamp,'new'),
    env.LEADS_DB.prepare('INSERT INTO cpx_lead_rate(fingerprint,n,updated_at) VALUES(?,?,?) ON CONFLICT(fingerprint) DO UPDATE SET n=n+1,updated_at=excluded.updated_at').bind(key,1,timestamp)
  ])}catch{return reply(503,{error:'store_error'})}
  return reply(202,{accepted:true});
}};