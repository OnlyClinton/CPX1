/** CPX RealEstate V8 lead relay: fail-closed until reviewed and configured.
 * NO live customer intake on the unconfigured preview. Do not log PII.
 * Required secrets: CPX_LEAD_STORE_URL, CPX_LEAD_STORE_TOKEN, CPX_SITE_ORIGIN.
 * An upstream Worker must verify Turnstile before persisting anything.
 */
const PRODUCTS = new Set(['estateos','marketplace','flexstay','hiddenmarket','prive']);
const ROLES = new Set(['Brokerage','Property manager','Owner','Buyer or renter','Investor or researcher','Other']);
const INTERESTS = new Set(['Product walkthrough','Property availability updates','Research demonstration','Owner yield review','Editorial and luxury partnerships']);
const txt = value => typeof value==='string' ? value.trim() : '';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({accepted:false,error:'method_not_allowed'});}
  const dest=process.env.CPX_LEAD_STORE_URL,secret=process.env.CPX_LEAD_STORE_TOKEN,origin=process.env.CPX_SITE_ORIGIN;
  if(!dest||!secret||!origin)return res.status(503).json({accepted:false,error:'not_configured'});
  let url;
  try{url=new URL(dest);if(url.protocol!=='https:'||!url.hostname||url.username||url.password)throw Error('unsafe URL')}catch{return res.status(503).json({accepted:false,error:'invalid_configuration'});}
  if(req.headers.origin!==origin)return res.status(403).json({accepted:false,error:'origin_rejected'});
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return res.status(415).json({accepted:false,error:'content_type_rejected'});
  const raw=req.body;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return res.status(400).json({accepted:false,error:'invalid_payload'});
  let bytes;try{bytes=Buffer.byteLength(JSON.stringify(raw),'utf8')}catch{return res.status(400).json({accepted:false,error:'invalid_payload'})}
  if(bytes>4096)return res.status(413).json({accepted:false,error:'too_large'});
  const cleaned={product:txt(raw.product),name:txt(raw.name),email:txt(raw.email).toLowerCase(),company:txt(raw.company),role:txt(raw.role),interest:txt(raw.interest),consent:raw.consent===true,marketing:raw.marketing===true,turnstileToken:txt(raw.turnstileToken)};
  if(!PRODUCTS.has(cleaned.product)||!ROLES.has(cleaned.role)||!INTERESTS.has(cleaned.interest)||!cleaned.consent||cleaned.name.length<2||cleaned.name.length>100||cleaned.company.length>130||cleaned.email.length>180||!/^[^\s@]{1,64}@[^\s@]+\.[^\s@]+$/.test(cleaned.email)||txt(raw.website))return res.status(400).json({accepted:false,error:'invalid_input'});
  // Must be present in production; upstream independently validates Turnstile.
  if(!cleaned.turnstileToken)return res.status(503).json({accepted:false,error:'bot_protection_unavailable'});
  try{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
    let upstream;
    try{upstream=await fetch(url.toString(),{method:'POST',headers:{'Authorization':'Bearer '+secret,'Content-Type':'application/json','X-CPX-Source':'v8-website'},body:JSON.stringify(cleaned),signal:controller.signal})}finally{clearTimeout(timeout)}
    if(!upstream.ok)return res.status(upstream.status===429?429:503).json({accepted:false,error:'intake_unavailable'});
    let out;try{out=await upstream.json()}catch{return res.status(503).json({accepted:false,error:'intake_unconfirmed'})}
    if(out?.accepted!==true)return res.status(503).json({accepted:false,error:'intake_unconfirmed'});
    return res.status(202).json({accepted:true});
  }catch{return res.status(503).json({accepted:false,error:'intake_unavailable'})}
}