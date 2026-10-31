/**
 * Secure intake adapter for Vercel, NOT ENABLED until an approved durable store exists.
 * Required environment: CPX_LEAD_STORE_URL (operator-controlled HTTPS Worker endpoint),
 * CPX_LEAD_STORE_TOKEN (random per-environment secret), CPX_SITE_ORIGIN (exact site origin).
 * The backend worker must enforce its own rate limiting, retention and opt-out handling.
 * Do not activate in production before privacy, compliance and D1 authorization review.
 */
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({accepted:false,error:'method_not_allowed'});}
  const expected=process.env.CPX_SITE_ORIGIN, dest=process.env.CPX_LEAD_STORE_URL, token=process.env.CPX_LEAD_STORE_TOKEN;
  if(!expected||!dest||!token||!dest.startsWith('https://'))return res.status(503).json({accepted:false,error:'not_configured'});
  if(req.headers.origin!==expected)return res.status(403).json({accepted:false,error:'origin_rejected'});
  const length=Number(req.headers['content-length']||0);
  if(length>6000)return res.status(413).json({accepted:false,error:'too_large'});
  const b=req.body||{};
  const text=x=>typeof x==='string'?x.trim():'';
  const clean={name:text(b.name),email:text(b.email).toLowerCase(),company:text(b.company),role:text(b.role),consent:b.consent===true,marketing:b.marketing===true};
  if(!clean.consent||clean.name.length<2||clean.name.length>100||clean.company.length<2||clean.company.length>130||clean.email.length>180||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email)||!['Brokerage','Property manager','Owner','Other'].includes(clean.role)||text(b.website))return res.status(400).json({accepted:false,error:'invalid_input'});
  try{
    const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),5000);
    let upstream;
    try{upstream=await fetch(dest,{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json','X-CPX-Source':'estateos-founding-three'},body:JSON.stringify(clean),signal:ctl.signal})}finally{clearTimeout(timeout)}
    if(!upstream.ok)return res.status(upstream.status===429?429:503).json({accepted:false,error:'intake_unavailable'});
    return res.status(202).json({accepted:true});
  }catch(e){return res.status(503).json({accepted:false,error:'intake_unavailable'})}
}