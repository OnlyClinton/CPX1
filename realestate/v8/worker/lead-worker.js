/** DEVELOPMENT-ONLY REVIEW: requires isolated D1 + Cloudflare Turnstile. No deployed binding. */
const t=x=>typeof x==='string'?x.trim():'';
const products=new Set(['estateos','marketplace','flexstay','hiddenmarket','prive']);
const roles=new Set(['Brokerage','Property manager','Owner','Buyer or renter','Investor or researcher','Other']);
const interests=new Set(['Product walkthrough','Property availability updates','Research demonstration','Owner yield review','Editorial and luxury partnerships']);
export default {async fetch(request,env){
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const reply=(s,obj)=>new Response(JSON.stringify(obj),{status:s,headers});
 if(request.method!=='POST')return reply(405,{accepted:false,error:'method_not_allowed'});
 if(!env.LEADS_DB||!env.LEAD_BEARER_TOKEN||!env.TURNSTILE_SECRET)return reply(503,{accepted:false,error:'not_configured'});
 if(request.headers.get('Authorization')!==`Bearer ${env.LEAD_BEARER_TOKEN}`)return reply(403,{accepted:false,error:'unauthorized'});
 let raw;try{raw=await request.text()}catch{return reply(400,{accepted:false,error:'invalid_body'})}
 if(new TextEncoder().encode(raw).byteLength>4096)return reply(413,{accepted:false,error:'too_large'});
 let b;try{b=JSON.parse(raw)}catch{return reply(400,{accepted:false,error:'invalid_json'})}
 const data={product:t(b.product),name:t(b.name),email:t(b.email).toLowerCase(),company:t(b.company),role:t(b.role),interest:t(b.interest),consent:b.consent===true,marketing:b.marketing===true};
 if(!products.has(data.product)||!roles.has(data.role)||!interests.has(data.interest)||!data.consent||data.name.length<2||data.name.length>100||data.company.length>130||data.email.length>180||!/^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/.test(data.email))return reply(400,{accepted:false,error:'invalid_input'});
 // A signed one-time captcha challenge is required; Vercel IP is not visitor identity.
 const token=t(b.turnstileToken);
 if(!token||token.length>2200)return reply(403,{accepted:false,error:'human_verification_required'});
 let check;try{
  const x=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:token})});
  check=await x.json();
 }catch{return reply(503,{accepted:false,error:'verification_unavailable'})}
 if(check.success!==true || (check.action && check.action!=='cpx-lead'))return reply(403,{accepted:false,error:'verification_failed'});
 const now=new Date().toISOString(),id=crypto.randomUUID();
 try{
  // Reject repeated email + product submissions within 12h; no publicly exposed lead counts.
  const previous=await env.LEADS_DB.prepare("SELECT id FROM cpx_leads WHERE product=? AND email=? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-12 hours') LIMIT 1").bind(data.product,data.email).first();
  if(previous)return reply(202,{accepted:true}); // idempotent without exposing whether email exists
  await env.LEADS_DB.prepare('INSERT INTO cpx_leads(id,product,interest,name,email,company,role,marketing_opt_in,consent_recorded_at,created_at,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id,data.product,data.interest,data.name,data.email,data.company,data.role,data.marketing?1:0,now,now,'new').run();
 }catch{return reply(503,{accepted:false,error:'store_error'})}
 return reply(202,{accepted:true});
}};